/* ExactKB — client-side exact-size image compressor. Files never leave the device. */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // Base URL of the app assets (works from / and from /landing-page/ dirs)
  const BASE = new URL(".", document.currentScript.src).href;

  const scriptLoaders = {};
  function loadScriptOnce(path) {
    if (!scriptLoaders[path]) {
      scriptLoaders[path] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = BASE + path;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Could not load " + path));
        document.head.appendChild(s);
      });
    }
    return scriptLoaders[path];
  }

  function isHeic(file) {
    return /image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
  }

  // Primary HEIC decoder: current libheif (handles new iPhone HDR/10-bit files).
  async function heicViaLibheif(file) {
    await loadScriptOnce("vendor/libheif-bundle.js");
    let lib = window.libheif;
    if (typeof lib === "function") lib = await lib();      // factory variant
    if (lib && typeof lib.then === "function") lib = await lib; // promise variant
    const decoder = new lib.HeifDecoder();
    const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
    if (!images || !images.length) throw new Error("no image in HEIC container");
    const img = images[0];
    const w = img.get_width(), h = img.get_height();
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(w, h);
    await new Promise((resolve, reject) => {
      img.display(imageData, (ok) => (ok ? resolve() : reject(new Error("libheif display failed"))));
    });
    ctx.putImageData(imageData, 0, 0);
    images.forEach((i) => { try { i.free(); } catch (_) {} });
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  }

  // Secondary HEIC decoder: heic2any (older libheif, kept as fallback).
  async function heicViaHeic2any(file) {
    await loadScriptOnce("vendor/heic2any.min.js");
    const blob = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const jpeg = Array.isArray(blob) ? blob[0] : blob;
    return new File([jpeg], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  }

  async function heicToJpeg(file) {
    try { return await heicViaLibheif(file); }
    catch (e) { console.warn("libheif decode failed, trying heic2any:", e); }
    return heicViaHeic2any(file);
  }

  const els = {
    drop: $("#drop"),
    fileInput: $("#file-input"),
    country: $("#country"),
    preset: $("#preset"),
    minKB: $("#min-kb"),
    maxKB: $("#max-kb"),
    width: $("#out-width"),
    height: $("#out-height"),
    format: $("#out-format"),
    presetNote: $("#preset-note"),
    results: $("#results"),
    resultsSection: $("#results-section"),
    queue: $("#queue"),
    go: $("#go"),
  };

  // ---------- file queue (nothing runs until the button is pressed) ----------
  const pending = [];

  function renderQueue() {
    if (!els.queue || !els.go) return;
    els.queue.innerHTML = "";
    pending.forEach((f, idx) => {
      const item = document.createElement("div");
      item.className = "queue-item";
      const thumb = document.createElement("div");
      thumb.className = "queue-thumb";
      if (f._url) {
        const img = document.createElement("img");
        img.src = f._url; img.alt = "";
        thumb.appendChild(img);
      } else {
        thumb.textContent = "🖼";
      }
      const body = document.createElement("div");
      body.className = "queue-body";
      body.innerHTML = `<div class="queue-name"></div><div class="queue-size"></div>`;
      body.querySelector(".queue-name").textContent = f.name;
      body.querySelector(".queue-size").textContent = fmtKB(f.size);
      const rm = document.createElement("button");
      rm.className = "queue-remove";
      rm.type = "button";
      rm.setAttribute("aria-label", "Remove " + f.name);
      rm.textContent = "✕";
      rm.addEventListener("click", () => {
        if (f._url) URL.revokeObjectURL(f._url);
        pending.splice(idx, 1);
        renderQueue();
      });
      item.append(thumb, body, rm);
      els.queue.appendChild(item);
    });
    els.queue.style.display = pending.length ? "flex" : "none";
    els.go.disabled = pending.length === 0;
    els.go.textContent = pending.length
      ? `Compress ${pending.length} file${pending.length > 1 ? "s" : ""} →`
      : "Compress →";
  }

  function queueFiles(files) {
    for (const f of files) {
      if (/^image\//.test(f.type)) {
        try { f._url = URL.createObjectURL(f); } catch (_) { /* no preview */ }
      }
      pending.push(f);
    }
    renderQueue();
  }

  // ---------- presets ----------
  const presets = window.EXACTKB_PRESETS || [];
  const countries = window.EXACTKB_COUNTRIES || [];
  let currentDpi = null; // set by print-photo presets; stamped into JPEG output

  function fillPresetList(countryId, selectId) {
    els.preset.innerHTML = "";
    // "custom" always available at the top, then that country's presets
    const list = [
      ...presets.filter((p) => p.id === "custom"),
      ...presets.filter((p) => p.country === countryId && p.id !== "custom"),
    ];
    for (const p of list) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label;
      els.preset.appendChild(opt);
    }
    if (selectId && list.some((p) => p.id === selectId)) els.preset.value = selectId;
  }

  function populatePresets() {
    if (!els.preset || !els.country) return;
    for (const c of countries) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      els.country.appendChild(opt);
    }
    const wanted = window.PAGE_PRESET || null;
    const startCountry = wanted?.country || "global";
    els.country.value = startCountry;
    fillPresetList(startCountry, wanted?.id || "custom");
    applyPresetValues(wanted || presets.find((p) => p.id === "custom"));

    els.country.addEventListener("change", () => {
      fillPresetList(els.country.value, "custom");
      applyPresetValues(presets.find((p) => p.id === "custom"));
    });
    els.preset.addEventListener("change", () => {
      const p = presets.find((x) => x.id === els.preset.value);
      if (p) applyPresetValues(p);
    });
  }
  function applyPresetValues(p) {
    currentDpi = p.dpi || null;
    els.minKB.value = p.minKB ?? "";
    els.maxKB.value = p.maxKB ?? "";
    els.width.value = p.width ?? "";
    els.height.value = p.height ?? "";
    if (p.format) els.format.value = p.format;
    els.presetNote.textContent = p.note || "";
    els.presetNote.style.display = p.note ? "block" : "none";
  }

  // ---------- requirement parser (the "paste what the form said" magic box) ----------
  function parseRequirement(text) {
    let t = " " + text.toLowerCase().replace(/,/g, " ") + " ";
    // normalize negated-maximum phrasings so "more than" can't read as a minimum
    t = t.replace(/(not?\s+(?:be\s+)?(?:more|greater|larger|bigger)\s+than|not\s+to\s+exceed|must\s+not\s+exceed|no\s+more\s+than|not\s+exceeding|should\s+not\s+exceed|cannot\s+exceed)/g, " max ");
    const out = {};
    // dimensions: 200x230, 200 × 230 px, 3.5 x 4.5 cm, 2x2 in
    const dim = t.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(px|pixels?|cm|mm|inch(?:es)?|in\b)?/);
    if (dim && !/kb|mb/.test(dim[0])) {
      const unit = (dim[3] || "px").slice(0, 2);
      const toPx = (v) =>
        unit === "cm" ? Math.round((v / 2.54) * 300)
        : unit === "mm" ? Math.round((v / 25.4) * 300)
        : unit === "in" ? Math.round(v * 300)
        : Math.round(v);
      const w = toPx(parseFloat(dim[1])), h = toPx(parseFloat(dim[2]));
      if (w >= 16 && h >= 16 && w <= 20000 && h <= 20000) { out.width = w; out.height = h; }
    }
    // size range: "10-20 kb", "between 20 and 50 kb", "20 to 300 kb"
    const range = t.match(/(\d+(?:\.\d+)?)\s*(kb|mb)?\s*(?:-|–|—|to|and)\s*(\d+(?:\.\d+)?)\s*(kb|mb)/);
    if (range) {
      const unit2 = range[4] === "mb" ? 1024 : 1;
      const unit1 = range[2] ? (range[2] === "mb" ? 1024 : 1) : unit2;
      const a = parseFloat(range[1]) * unit1, b = parseFloat(range[3]) * unit2;
      out.minKB = Math.min(a, b); out.maxKB = Math.max(a, b);
    } else {
      const sizes = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(kb|mb)\b/g)]
        .map((m) => ({ v: parseFloat(m[1]) * (m[2] === "mb" ? 1024 : 1), idx: m.index }));
      if (sizes.length >= 2) {
        const vals = sizes.map((s) => s.v).sort((x, y) => x - y);
        out.minKB = vals[0]; out.maxKB = vals[vals.length - 1];
      } else if (sizes.length === 1) {
        const before = t.slice(Math.max(0, sizes[0].idx - 40), sizes[0].idx);
        if (/(min|at ?least|minimum|more than|greater|above|over)\s*[^.]*$/.test(before)) out.minKB = sizes[0].v;
        else out.maxKB = sizes[0].v;
      }
    }
    const fm = t.match(/\b(jpe?g|jpg|png|webp)\b/);
    if (fm) out.format = fm[1].startsWith("j") ? "jpeg" : fm[1] === "png" ? "png" : "webp";
    return out;
  }

  function applyParsed(p) {
    if (p.minKB != null) els.minKB.value = Math.round(p.minKB * 10) / 10;
    if (p.maxKB != null) els.maxKB.value = Math.round(p.maxKB * 10) / 10;
    if (p.width != null) els.width.value = p.width;
    if (p.height != null) els.height.value = p.height;
    if (p.format) els.format.value = p.format;
  }

  function parsedSummary(p) {
    const bits = [];
    if (p.minKB != null && p.maxKB != null) bits.push(`${p.minKB}–${p.maxKB} KB`);
    else if (p.maxKB != null) bits.push(`max ${p.maxKB} KB`);
    else if (p.minKB != null) bits.push(`min ${p.minKB} KB`);
    if (p.width) bits.push(`${p.width}×${p.height} px`);
    if (p.format) bits.push(p.format.toUpperCase());
    return bits.join(" · ");
  }

  function wireMagicBox() {
    const input = $("#magic"), btn = $("#magic-apply"), result = $("#magic-result");
    if (!input || !btn) return;
    const run = () => {
      const text = input.value.trim();
      if (!text) return;
      const p = parseRequirement(text);
      const summary = parsedSummary(p);
      if (summary) {
        applyParsed(p);
        result.textContent = `✓ Understood: ${summary} — settings filled in below.`;
        result.className = "magic-result ok";
      } else {
        result.textContent = "Couldn't find a size in that text — look for something like \"max 50 KB\" or \"200×230 px\" and paste that part.";
        result.className = "magic-result err";
      }
      result.style.display = "block";
    };
    btn.addEventListener("click", run);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(); } });
    input.addEventListener("paste", () => setTimeout(run, 50));
  }

  // ---------- shareable requirement links ----------
  const SHARE_BASE = "https://suncal.github.io/exactkb/";
  function currentShareUrl() {
    const p = new URLSearchParams();
    if (els.minKB.value) p.set("min", els.minKB.value);
    if (els.maxKB.value) p.set("max", els.maxKB.value);
    if (els.width.value) p.set("w", els.width.value);
    if (els.height.value) p.set("h", els.height.value);
    if (els.format.value !== "jpeg") p.set("fmt", els.format.value);
    return SHARE_BASE + "?" + p.toString() + "#tool";
  }

  async function openShareModal() {
    const url = currentShareUrl();
    let modal = document.getElementById("share-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "share-modal";
      modal.className = "compare-modal";
      modal.innerHTML = `
        <div class="compare-box share-box" role="dialog" aria-label="Share this requirement">
          <div class="compare-head"><span>Share this requirement</span><button class="compare-close" aria-label="Close">✕</button></div>
          <p class="share-sub">Send this link to anyone — ExactKB opens with these exact settings already filled in. Perfect for classmates, family, or clients.</p>
          <div class="share-row"><input class="share-url" readonly><button class="btn btn-download share-copy" type="button">Copy</button></div>
          <div class="share-qr" aria-label="QR code"></div>
        </div>`;
      modal.addEventListener("click", (e) => {
        if (e.target === modal || e.target.classList.contains("compare-close")) modal.style.display = "none";
      });
      modal.querySelector(".share-copy").addEventListener("click", async () => {
        const btn = modal.querySelector(".share-copy");
        try {
          await navigator.clipboard.writeText(modal.querySelector(".share-url").value);
          btn.textContent = "Copied ✓";
        } catch (_) {
          modal.querySelector(".share-url").select();
          document.execCommand("copy");
          btn.textContent = "Copied ✓";
        }
        setTimeout(() => { btn.textContent = "Copy"; }, 1800);
      });
      document.body.appendChild(modal);
    }
    modal.querySelector(".share-url").value = url;
    const qrBox = modal.querySelector(".share-qr");
    qrBox.innerHTML = "";
    try {
      await loadScriptOnce("vendor/qrcode.js");
      const qr = window.qrcode(0, "M");
      qr.addData(url);
      qr.make();
      qrBox.innerHTML = qr.createImgTag(4, 8);
    } catch (_) { /* QR optional */ }
    modal.style.display = "flex";
  }

  function applyUrlParams() {
    const sp = new URLSearchParams(location.search);
    if (!sp.has("max") && !sp.has("min") && !sp.has("w")) return;
    const p = {
      minKB: sp.has("min") ? parseFloat(sp.get("min")) : null,
      maxKB: sp.has("max") ? parseFloat(sp.get("max")) : null,
      width: sp.has("w") ? parseInt(sp.get("w"), 10) : null,
      height: sp.has("h") ? parseInt(sp.get("h"), 10) : null,
      format: ["png", "webp"].includes(sp.get("fmt")) ? sp.get("fmt") : null,
    };
    applyParsed(p);
    const result = $("#magic-result");
    if (result) {
      result.textContent = `✓ Shared requirement loaded: ${parsedSummary(p) || "custom settings"}`;
      result.className = "magic-result ok";
      result.style.display = "block";
    }
  }

  // ---------- file intake ----------
  function wireDropZone() {
    const drop = els.drop;
    if (!drop) return;
    drop.addEventListener("click", () => els.fileInput.click());
    drop.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); els.fileInput.click(); }
    });
    els.fileInput.addEventListener("change", () => {
      if (els.fileInput.files.length) queueFiles([...els.fileInput.files]);
      els.fileInput.value = "";
    });
    if (els.go) {
      els.go.addEventListener("click", () => {
        if (!pending.length) return;
        const files = pending.splice(0);
        renderQueue();
        files.forEach((f) => { if (f._url) { URL.revokeObjectURL(f._url); delete f._url; } });
        handleFiles(files);
      });
    }
    ["dragenter", "dragover"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })
    );
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); })
    );
    drop.addEventListener("drop", (e) => {
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) queueFiles(files);
    });
    document.addEventListener("paste", (e) => {
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) queueFiles(files);
    });
  }

  async function handleFiles(files) {
    const settings = readSettings();
    if (settings.error) { alert(settings.error); return; }
    els.resultsSection.style.display = "block";
    for (const file of files) {
      const card = makeCard(file);
      els.results.prepend(card.root);
      try {
        if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
          throw new Error("This is a PDF — use the PDF compressor instead (link below the drop zone).");
        }
        const out = await compressToTarget(file, settings, (msg) => card.setStatus(msg));
        if (settings.dpi && out.blob.type === "image/jpeg") {
          out.blob = await stampJpegDpi(out.blob, settings.dpi);
        }
        card.finish(file, out, settings);
      } catch (err) {
        card.fail(err.message || String(err));
      }
    }
    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function readSettings() {
    const minKB = parseFloat(els.minKB.value) || null;
    const maxKB = parseFloat(els.maxKB.value) || null;
    const width = parseInt(els.width.value, 10) || null;
    const height = parseInt(els.height.value, 10) || null;
    const format = els.format.value; // "jpeg" | "png"
    if (!maxKB) return { error: "Set a maximum size in KB — that's the number the upload form gives you." };
    if (minKB && minKB >= maxKB) return { error: "Minimum KB must be smaller than maximum KB." };
    return { minKB, maxKB, width, height, format, dpi: format === "jpeg" ? currentDpi : null };
  }

  // ---------- engine ----------
  function decodeViaImg(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode failed")); };
      img.src = url;
    });
  }

  // Decode anything the browser or our converters can read, regardless of
  // what the file claims to be. iPhone HEICs frequently arrive renamed as
  // .jpg after passing through Windows/WhatsApp/email — so on any decode
  // failure we still attempt HEIC conversion before giving up.
  async function loadBitmap(file, onStatus) {
    const tryNative = async () => {
      if (window.createImageBitmap) {
        try { return await createImageBitmap(file); } catch (_) { /* fall through */ }
      }
      return decodeViaImg(file);
    };

    if (isHeic(file)) {
      onStatus("Converting HEIC…");
      try {
        const jpeg = await heicToJpeg(file);
        return await createImageBitmap(jpeg);
      } catch (_) {
        // Safari decodes HEIC natively — try that before failing
        try { return await tryNative(); } catch (_) { /* fall through to error */ }
        throw new Error("Couldn't convert this HEIC. Quick fix: email or WhatsApp the photo to yourself (that converts it to JPG), then drop the JPG here.");
      }
    }

    try {
      return await tryNative();
    } catch (_) {
      // Mislabeled HEIC? (common when iPhone photos pass through Windows)
      try {
        onStatus("Retrying as HEIC…");
        const jpeg = await heicToJpeg(file);
        return await createImageBitmap(jpeg);
      } catch (_) {
        throw new Error("Couldn't read this file as an image. Supported: JPG, PNG, HEIC, WebP, AVIF, SVG, GIF, BMP. If it came from an iPhone, email it to yourself first — that converts it to JPG.");
      }
    }
  }

  function drawToCanvas(bitmap, targetW, targetH, scale) {
    const srcW = bitmap.width, srcH = bitmap.height;
    let w, h, sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (targetW && targetH) {
      // cover-crop to the exact requested aspect, then scale
      w = targetW; h = targetH;
      const srcAspect = srcW / srcH, dstAspect = targetW / targetH;
      if (srcAspect > dstAspect) { sw = Math.round(srcH * dstAspect); sx = Math.round((srcW - sw) / 2); }
      else { sh = Math.round(srcW / dstAspect); sy = Math.round((srcH - sh) / 2); }
    } else if (targetW) {
      w = targetW; h = Math.round(srcH * (targetW / srcW));
    } else if (targetH) {
      h = targetH; w = Math.round(srcW * (targetH / srcH));
    } else {
      w = srcW; h = srcH;
    }
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // white background so transparent PNGs don't turn black as JPEG
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  // ---------- clarity engine ----------
  // Classify content: documents/text get text-optimized processing and a
  // higher quality floor; photos trade resolution before quality.
  function sampleAnalysis(bitmap) {
    const sw = 256, sh = Math.max(1, Math.round((bitmap.height * 256) / bitmap.width));
    const c = document.createElement("canvas");
    c.width = sw; c.height = sh;
    const ctx = c.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, sw, sh);
    const d = ctx.getImageData(0, 0, sw, sh).data;
    const n = sw * sh;
    const luma = new Float32Array(n);
    let satSum = 0;
    for (let i = 0; i < n; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      satSum += Math.max(r, g, b) - Math.min(r, g, b);
      luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    let edges = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 1; x < sw; x++) {
        if (Math.abs(luma[y * sw + x] - luma[y * sw + x - 1]) > 40) edges++;
      }
    }
    return { isDoc: satSum / n < 28 && edges / n > 0.02 };
  }

  // COLOR-PRESERVING contrast stretch for document-like images: lo/hi come
  // from the luma histogram but the same gain applies to every RGB channel,
  // so text gets crisp dark-on-white while colors (stamps, seals, ink,
  // muted photos misdetected as docs) stay colors. The compressor must
  // never silently grayscale — that's an explicit Document Cleaner mode only.
  function enhanceDoc(canvas) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height, n = w * h;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) {
      hist[(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) | 0]++;
    }
    const cut = n * 0.02;
    let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > cut) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > cut) { hi = v; break; } }
    const range = Math.max(24, hi - lo);
    for (let i = 0; i < n * 4; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v = ((d[i + c] - lo) * 255) / range;
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Light unsharp mask — restores edge crispness lost to downscaling.
  function sharpen(canvas, k) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);
    const s = src.data, o = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const up = y > 0 ? s[i - w * 4 + c] : s[i + c];
          const dn = y < h - 1 ? s[i + w * 4 + c] : s[i + c];
          const lf = x > 0 ? s[i - 4 + c] : s[i + c];
          const rt = x < w - 1 ? s[i + 4 + c] : s[i + c];
          const v = s[i + c] * (1 + 4 * k) - k * (up + dn + lf + rt);
          o[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
        o[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  async function compressToTarget(file, s, onStatus) {
    const bitmap = await loadBitmap(file, onStatus);
    const maxBytes = Math.floor(s.maxKB * 1024);
    const minBytes = s.minKB ? Math.ceil(s.minKB * 1024) : 0;
    const type = s.format === "png" ? "image/png" : s.format === "webp" ? "image/webp" : "image/jpeg";
    const locked = !!(s.width && s.height);

    let best = null;

    if (type === "image/png") {
      // PNG is lossless — dimensions are the only lever
      let scale = 1.0;
      for (let round = 0; round < 12; round++) {
        onStatus(`Compressing… (pass ${round + 1})`);
        const canvas = drawToCanvas(bitmap, s.width, s.height, locked ? 1 : scale);
        const blob = await canvasToBlob(canvas, "image/png");
        if (blob.size <= maxBytes) { best = { blob, canvas }; break; }
        if (locked) {
          throw new Error(`Can't reach ${s.maxKB} KB at exactly ${s.width}×${s.height}px in PNG. Try JPG format or a higher KB limit.`);
        }
        scale *= 0.8;
        if (Math.min(bitmap.width, bitmap.height) * scale < 32) break;
      }
    } else {
      // Clarity engine: never let quality collapse into mush. Hold a quality
      // floor and trade resolution first — a smaller sharp image always beats
      // a big blurry one. Documents get text-optimized processing and a
      // higher floor; floors relax only when there is no other way to fit.
      const analysis = sampleAnalysis(bitmap);
      // [qualityFloor, minDimension] pairs: each relaxation step allows both a
      // lower floor AND smaller dimensions, so results degrade toward
      // small-and-sharp — never large-and-mushy.
      const floors = analysis.isDoc
        ? [[0.8, 500], [0.62, 380], [0.45, 280], [0.32, 200], [0.22, 120], [0.1, 48], [0.02, 32]]
        : [[0.62, 140], [0.45, 110], [0.3, 90], [0.15, 48], [0.02, 32]];

      outer:
      for (const [qFloor, minDim] of floors) {
        let scale = 1.0;
        for (let round = 0; round < 20; round++) {
          onStatus(`Optimizing… (${Math.round((locked ? 1 : scale) * 100)}% size, quality ≥ ${Math.round(qFloor * 100)}%)`);
          const canvas = drawToCanvas(bitmap, s.width, s.height, locked ? 1 : scale);
          const effScale = canvas.width / (locked ? canvas.width : bitmap.width);
          if (analysis.isDoc) { enhanceDoc(canvas); sharpen(canvas, 0.35); }
          else if (effScale < 0.8) { sharpen(canvas, 0.2); }

          const atFloor = await canvasToBlob(canvas, type, qFloor);
          if (!atFloor || atFloor.type !== type) {
            throw new Error("Your browser can't encode " + s.format.toUpperCase() + " — choose JPG output instead.");
          }
          if (atFloor.size <= maxBytes) {
            // fits at the floor — push quality as high as the budget allows
            let lo = qFloor, hi = 0.95, fit = { blob: atFloor, q: qFloor };
            for (let i = 0; i < 7; i++) {
              const q = (lo + hi) / 2;
              const blob = await canvasToBlob(canvas, type, q);
              if (blob.size > maxBytes) hi = q; else { fit = { blob, q }; lo = q; }
            }
            best = { blob: fit.blob, canvas, q: fit.q };
            break outer;
          }
          if (locked) break; // dimensions fixed — relax the floor instead
          scale *= 0.85;
          if (Math.min(bitmap.width, bitmap.height) * scale < minDim) break;
        }
      }
      if (!best && locked) {
        throw new Error(`Can't reach ${s.maxKB} KB at exactly ${s.width}×${s.height}px in ${s.format.toUpperCase()}. Try JPG format or a higher KB limit.`);
      }
    }

    if (!best) throw new Error(`Couldn't fit under ${s.maxKB} KB. Try JPG output or relax the limit.`);

    // Below the form's minimum? Pad up into the window (JPEG only).
    if (minBytes && best.blob.size < minBytes) {
      if (type !== "image/jpeg") {
        throw new Error("This file is below the form's minimum size — choose JPG output so it can be padded up into range.");
      }
      // First try simply raising quality/scale into the window.
      const grown = await growJpegIntoWindow(bitmap, s, minBytes, maxBytes);
      best.blob = grown || await padJpeg(best.blob, minBytes, maxBytes);
    }
    return best;
  }

  async function growJpegIntoWindow(bitmap, s, minBytes, maxBytes) {
    const canvas = drawToCanvas(bitmap, s.width, s.height, 1.0);
    let lo = 0.02, hi = 0.99, inWindow = null;
    for (let i = 0; i < 10; i++) {
      const q = (lo + hi) / 2;
      const blob = await canvasToBlob(canvas, "image/jpeg", q);
      if (blob.size > maxBytes) hi = q;
      else { if (blob.size >= minBytes) inWindow = blob; lo = q; }
    }
    return inWindow;
  }

  // ---------- ZIP builder (store method — JPEGs don't recompress) ----------
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  async function buildZip(entries) {
    const chunks = [], central = [];
    let offset = 0;
    const enc = new TextEncoder();
    for (const e of entries) {
      const data = new Uint8Array(await e.blob.arrayBuffer());
      const name = enc.encode(e.name);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(10, 0, true); // stored
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      chunks.push(new Uint8Array(local.buffer), name, data);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdStart = offset;
    let cdSize = 0;
    for (const c of central) { chunks.push(c); cdSize += c.length; }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, cdStart, true);
    chunks.push(new Uint8Array(end.buffer));
    return new Blob(chunks, { type: "application/zip" });
  }

  const completed = [];
  function registerCompleted(name, blob) {
    completed.push({ name, blob });
    let bar = document.getElementById("zip-bar");
    if (!bar) {
      bar = document.createElement("button");
      bar.id = "zip-bar";
      bar.className = "btn-zip";
      bar.type = "button";
      bar.addEventListener("click", async () => {
        bar.textContent = "Zipping…";
        const zip = await buildZip(completed);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(zip);
        a.download = "exactkb-files.zip";
        a.click();
        bar.textContent = `Download all ${completed.length} as .zip`;
      });
      els.resultsSection.querySelector("h2").after(bar);
    }
    bar.style.display = completed.length > 1 ? "inline-block" : "none";
    bar.textContent = `Download all ${completed.length} as .zip`;
  }

  // ---------- before/after compare modal ----------
  function openCompare(beforeUrl, afterUrl, beforeLabel, afterLabel) {
    let modal = document.getElementById("compare-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "compare-modal";
      modal.className = "compare-modal";
      modal.innerHTML = `
        <div class="compare-box" role="dialog" aria-label="Before and after comparison">
          <div class="compare-head"><span>Before / After</span><button class="compare-close" aria-label="Close">✕</button></div>
          <div class="compare-grid">
            <figure><img class="cmp-before" alt="original"><figcaption></figcaption></figure>
            <figure><img class="cmp-after" alt="compressed"><figcaption></figcaption></figure>
          </div>
        </div>`;
      modal.addEventListener("click", (e) => {
        if (e.target === modal || e.target.classList.contains("compare-close")) modal.style.display = "none";
      });
      document.body.appendChild(modal);
    }
    modal.querySelector(".cmp-before").src = beforeUrl;
    modal.querySelector(".cmp-after").src = afterUrl;
    modal.querySelectorAll("figcaption")[0].textContent = beforeLabel;
    modal.querySelectorAll("figcaption")[1].textContent = afterLabel;
    modal.style.display = "flex";
  }

  // ---------- DPI stamping (JFIF density patch — for print photo specs) ----------
  async function stampJpegDpi(blob, dpi) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    // APP0/JFIF segment: FF E0 len 'JFIF\0' ver units xd xd yd yd
    if (buf[2] === 0xff && buf[3] === 0xe0 && buf[6] === 0x4a && buf[7] === 0x46) {
      buf[13] = 1; // density units: dots per inch
      buf[14] = (dpi >> 8) & 0xff; buf[15] = dpi & 0xff;
      buf[16] = (dpi >> 8) & 0xff; buf[17] = dpi & 0xff;
      return new Blob([buf], { type: "image/jpeg" });
    }
    return blob;
  }

  // Insert JPEG COM (comment) segments after SOI to legitimately grow the file.
  async function padJpeg(blob, minBytes, maxBytes) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return blob;
    const target = Math.min(Math.ceil((minBytes + maxBytes) / 2), maxBytes - 64);
    let need = target - buf.length;
    if (need <= 4) return blob;
    const segments = [];
    while (need > 4) {
      const payload = Math.min(need - 4, 65533 - 2);
      const seg = new Uint8Array(4 + payload);
      seg[0] = 0xff; seg[1] = 0xfe;
      seg[2] = (payload + 2) >> 8; seg[3] = (payload + 2) & 0xff;
      // fill with spaces (0x20) — a plain comment block
      seg.fill(0x20, 4);
      segments.push(seg);
      need -= seg.length;
    }
    const total = buf.length + segments.reduce((a, x) => a + x.length, 0);
    const out = new Uint8Array(total);
    out.set(buf.subarray(0, 2), 0);
    let off = 2;
    for (const seg of segments) { out.set(seg, off); off += seg.length; }
    out.set(buf.subarray(2), off);
    return new Blob([out], { type: "image/jpeg" });
  }

  // ---------- result cards ----------
  function fmtKB(bytes) {
    return bytes >= 1024 * 1024
      ? (bytes / 1024 / 1024).toFixed(2) + " MB"
      : (bytes / 1024).toFixed(1) + " KB";
  }

  function makeCard(file) {
    const root = document.createElement("div");
    root.className = "result-card";
    root.innerHTML = `
      <div class="result-thumb"><div class="spinner" aria-hidden="true"></div></div>
      <div class="result-body">
        <div class="result-name"></div>
        <div class="result-status">Reading file…</div>
        <div class="result-meta"></div>
      </div>
      <div class="result-action"></div>`;
    root.querySelector(".result-name").textContent = file.name;
    return {
      root,
      setStatus(msg) { root.querySelector(".result-status").textContent = msg; },
      fail(msg) {
        root.classList.add("failed");
        root.querySelector(".result-status").textContent = msg;
        root.querySelector(".result-thumb").innerHTML = "⚠️";
      },
      finish(srcFile, out, s) {
        const { blob, canvas } = out;
        const url = URL.createObjectURL(blob);
        const thumb = root.querySelector(".result-thumb");
        thumb.innerHTML = "";
        const img = document.createElement("img");
        img.src = url; img.alt = "compressed preview";
        thumb.appendChild(img);
        // before/after compare (Squoosh-style, but works on every batch file)
        let beforeUrl = null;
        try { beforeUrl = URL.createObjectURL(srcFile); } catch (_) {}
        if (beforeUrl) {
          thumb.classList.add("thumb-compare");
          thumb.title = "Click to compare before / after";
          thumb.addEventListener("click", () =>
            openCompare(
              beforeUrl, url,
              `Original · ${fmtKB(srcFile.size)}`,
              `Compressed · ${fmtKB(blob.size)} · ${canvas.width}×${canvas.height}px`
            )
          );
        }
        root.querySelector(".result-status").textContent = "Done — fits the requirement ✓";
        root.querySelector(".result-meta").textContent =
          `${fmtKB(srcFile.size)} → ${fmtKB(blob.size)} · ${canvas.width}×${canvas.height}px` +
          (out.q ? ` · quality ${Math.round(out.q * 100)}%` : "");
        const a = document.createElement("a");
        a.className = "btn btn-download";
        a.href = url;
        const ext = s.format === "png" ? "png" : s.format === "webp" ? "webp" : "jpg";
        const base = srcFile.name.replace(/\.[^.]+$/, "");
        a.download = `${base}-${Math.round(blob.size / 1024)}kb.${ext}`;
        a.textContent = "Download";
        root.querySelector(".result-action").appendChild(a);
        registerCompleted(a.download, blob);
      },
    };
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", () => {
    populatePresets();
    wireDropZone();
    wireMagicBox();
    applyUrlParams();
    const shareBtn = document.getElementById("share-btn");
    if (shareBtn) shareBtn.addEventListener("click", openShareModal);
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  });
})();
