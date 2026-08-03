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
  };

  // ---------- presets ----------
  const presets = window.EXACTKB_PRESETS || [];
  const countries = window.EXACTKB_COUNTRIES || [];

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
    els.minKB.value = p.minKB ?? "";
    els.maxKB.value = p.maxKB ?? "";
    els.width.value = p.width ?? "";
    els.height.value = p.height ?? "";
    if (p.format) els.format.value = p.format;
    els.presetNote.textContent = p.note || "";
    els.presetNote.style.display = p.note ? "block" : "none";
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
      if (els.fileInput.files.length) handleFiles([...els.fileInput.files]);
      els.fileInput.value = "";
    });
    ["dragenter", "dragover"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })
    );
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); })
    );
    drop.addEventListener("drop", (e) => {
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) handleFiles(files);
    });
    document.addEventListener("paste", (e) => {
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) handleFiles(files);
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
    return { minKB, maxKB, width, height, format };
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

  async function compressToTarget(file, s, onStatus) {
    const bitmap = await loadBitmap(file, onStatus);
    const maxBytes = Math.floor(s.maxKB * 1024);
    const minBytes = s.minKB ? Math.ceil(s.minKB * 1024) : 0;
    const type = s.format === "png" ? "image/png" : s.format === "webp" ? "image/webp" : "image/jpeg";

    let scale = 1.0;
    let best = null;

    for (let round = 0; round < 12; round++) {
      onStatus(`Compressing… (pass ${round + 1})`);
      const canvas = drawToCanvas(bitmap, s.width, s.height, scale);

      if (type === "image/png") {
        const blob = await canvasToBlob(canvas, "image/png");
        if (blob.size <= maxBytes) { best = { blob, canvas }; break; }
      } else {
        // binary-search encode quality (JPEG/WebP) at this scale
        let lo = 0.02, hi = 0.97, fit = null;
        for (let i = 0; i < 9; i++) {
          const q = (lo + hi) / 2;
          const blob = await canvasToBlob(canvas, type, q);
          if (!blob || blob.type !== type) {
            throw new Error("Your browser can't encode " + s.format.toUpperCase() + " — choose JPG output instead.");
          }
          if (blob.size > maxBytes) hi = q; else { fit = { blob, canvas, q }; lo = q; }
        }
        if (fit) { best = fit; break; }
      }
      // still too big even at lowest quality — shrink dimensions and retry.
      // If exact W×H was requested we can't shrink; bail with honest error.
      if (s.width && s.height) {
        throw new Error(`Can't reach ${s.maxKB} KB at exactly ${s.width}×${s.height}px in ${s.format.toUpperCase()}. Try JPG format or a higher KB limit.`);
      }
      scale *= 0.8;
      if (Math.min(bitmap.width, bitmap.height) * scale < 32) break;
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
        root.querySelector(".result-status").textContent = "Done — fits the requirement ✓";
        root.querySelector(".result-meta").textContent =
          `${fmtKB(srcFile.size)} → ${fmtKB(blob.size)} · ${canvas.width}×${canvas.height}px`;
        const a = document.createElement("a");
        a.className = "btn btn-download";
        a.href = url;
        const ext = s.format === "png" ? "png" : s.format === "webp" ? "webp" : "jpg";
        const base = srcFile.name.replace(/\.[^.]+$/, "");
        a.download = `${base}-${Math.round(blob.size / 1024)}kb.${ext}`;
        a.textContent = "Download";
        root.querySelector(".result-action").appendChild(a);
      },
    };
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", () => {
    populatePresets();
    wireDropZone();
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  });
})();
