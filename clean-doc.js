/* ExactKB Document Cleaner — restore readability of photographed/scanned
   documents: remove shadows, stains, yellowing; sharpen text. 100% client-side.
   Deliberately non-generative: never invents content — enhancement only. */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const BASE = new URL(".", document.currentScript.src).href;

  const els = {
    drop: $("#drop"),
    fileInput: $("#file-input"),
    mode: $("#clean-mode"),
    maxKB: $("#max-kb"),
    format: $("#out-format"),
    results: $("#results"),
    resultsSection: $("#results-section"),
  };

  // ---------- shared loaders (HEIC support) ----------
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
  async function heicToJpeg(file) {
    try {
      await loadScriptOnce("vendor/libheif-bundle.js");
      let lib = window.libheif;
      if (typeof lib === "function") lib = await lib();
      if (lib && typeof lib.then === "function") lib = await lib;
      const decoder = new lib.HeifDecoder();
      const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
      if (!images || !images.length) throw new Error("empty HEIC");
      const img = images[0];
      const w = img.get_width(), h = img.get_height();
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(w, h);
      await new Promise((res, rej) => img.display(imageData, (ok) => (ok ? res() : rej(new Error("display failed")))));
      ctx.putImageData(imageData, 0, 0);
      images.forEach((i) => { try { i.free(); } catch (_) {} });
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.95));
      return new File([blob], "converted.jpg", { type: "image/jpeg" });
    } catch (_) {
      await loadScriptOnce("vendor/heic2any.min.js");
      const blob = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
      const jpeg = Array.isArray(blob) ? blob[0] : blob;
      return new File([jpeg], "converted.jpg", { type: "image/jpeg" });
    }
  }
  async function loadBitmap(file) {
    if (isHeic(file)) {
      const jpeg = await heicToJpeg(file);
      return createImageBitmap(jpeg);
    }
    try { return await createImageBitmap(file); }
    catch (_) {
      try { const jpeg = await heicToJpeg(file); return await createImageBitmap(jpeg); }
      catch (_) { throw new Error("Couldn't read this file as an image. Use JPG, PNG, HEIC, WebP or similar."); }
    }
  }

  // ---------- cleaning engine ----------
  function cleanCanvas(bitmap, mode) {
    const MAXDIM = 3000;
    const scale = Math.min(1, MAXDIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);

    // Estimate the page background (illumination + paper tint) by heavy
    // downscale-blur, then divide it out — removes shadows and yellowing
    // without touching the ink.
    const s1 = document.createElement("canvas");
    s1.width = 32; s1.height = Math.max(1, Math.round((h * 32) / w));
    s1.getContext("2d").drawImage(canvas, 0, 0, s1.width, s1.height);
    const s2 = document.createElement("canvas");
    s2.width = 8; s2.height = Math.max(1, Math.round((s1.height * 8) / s1.width));
    s2.getContext("2d").drawImage(s1, 0, 0, s2.width, s2.height);
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = w; bgCanvas.height = h;
    const bgCtx = bgCanvas.getContext("2d");
    bgCtx.imageSmoothingEnabled = true;
    bgCtx.imageSmoothingQuality = "high";
    bgCtx.drawImage(s2, 0, 0, w, h);
    const bg = bgCtx.getImageData(0, 0, w, h).data;

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const n = w * h;
    const WHITE = 248;

    if (mode === "color") {
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < 3; c++) {
          const bgv = Math.max(40, bg[i * 4 + c]);
          const v = (d[i * 4 + c] * WHITE) / bgv;
          d[i * 4 + c] = v > 255 ? 255 : v;
        }
      }
    } else {
      // grayscale flatten
      for (let i = 0; i < n; i++) {
        const lum = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
        const bgl = Math.max(40, 0.299 * bg[i * 4] + 0.587 * bg[i * 4 + 1] + 0.114 * bg[i * 4 + 2]);
        let v = (lum * WHITE) / bgl;
        v = v > 255 ? 255 : v;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      }
    }
    ctx.putImageData(img, 0, 0);

    // contrast stretch (2%–98% percentiles on luma)
    stretchContrast(canvas, mode === "bw");
    sharpenCanvas(canvas, 0.35);
    return canvas;
  }

  function stretchContrast(canvas, hard) {
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
        let v = ((d[i + c] - lo) * 255) / range;
        if (hard) v = v < 120 ? v * 0.35 : v > 180 ? 255 : ((v - 120) / 60) * (255 - 42) + 42;
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function sharpenCanvas(canvas, k) {
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

  function canvasToBlob(canvas, type, q) {
    return new Promise((r) => canvas.toBlob(r, type, q));
  }

  async function exportCanvas(canvas, format, maxKB) {
    const type = format === "png" ? "image/png" : "image/jpeg";
    if (!maxKB) {
      const blob = await canvasToBlob(canvas, type, 0.92);
      return { blob, canvas };
    }
    const maxBytes = maxKB * 1024;
    if (type === "image/png") {
      const blob = await canvasToBlob(canvas, type);
      if (blob.size <= maxBytes) return { blob, canvas };
      throw new Error(`PNG won't fit under ${maxKB} KB — choose JPG output.`);
    }
    let work = canvas;
    for (let round = 0; round < 10; round++) {
      let lo = 0.3, hi = 0.95, fit = null;
      const atFloor = await canvasToBlob(work, type, 0.3);
      if (atFloor.size <= maxBytes) {
        fit = { blob: atFloor, q: 0.3 };
        for (let i = 0; i < 7; i++) {
          const q = (lo + hi) / 2;
          const b = await canvasToBlob(work, type, q);
          if (b.size > maxBytes) hi = q; else { fit = { blob: b, q }; lo = q; }
        }
        return { blob: fit.blob, canvas: work, q: fit.q };
      }
      const nw = Math.round(work.width * 0.85), nh = Math.round(work.height * 0.85);
      if (Math.min(nw, nh) < 200) break;
      const smaller = document.createElement("canvas");
      smaller.width = nw; smaller.height = nh;
      const sctx = smaller.getContext("2d");
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(work, 0, 0, nw, nh);
      work = smaller;
    }
    throw new Error(`Couldn't fit under ${maxKB} KB while keeping the text readable. Try a higher limit.`);
  }

  // ---------- UI ----------
  function fmtKB(bytes) {
    return bytes >= 1024 * 1024
      ? (bytes / 1024 / 1024).toFixed(2) + " MB"
      : (bytes / 1024).toFixed(1) + " KB";
  }

  function makeCard(file) {
    const root = document.createElement("div");
    root.className = "result-card";
    root.innerHTML = `
      <div class="result-thumb" style="width:110px;height:110px;flex-basis:110px"><div class="spinner" aria-hidden="true"></div></div>
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
      finish(srcFile, out, format) {
        const url = URL.createObjectURL(out.blob);
        const thumb = root.querySelector(".result-thumb");
        thumb.innerHTML = "";
        const img = document.createElement("img");
        img.src = url; img.alt = "cleaned preview";
        thumb.appendChild(img);
        root.querySelector(".result-status").textContent = "Cleaned ✓";
        root.querySelector(".result-meta").textContent =
          `${fmtKB(srcFile.size)} → ${fmtKB(out.blob.size)} · ${out.canvas.width}×${out.canvas.height}px` +
          (out.q ? ` · quality ${Math.round(out.q * 100)}%` : "");
        const a = document.createElement("a");
        a.className = "btn btn-download";
        a.href = url;
        const ext = format === "png" ? "png" : "jpg";
        const base = srcFile.name.replace(/\.[^.]+$/, "");
        a.download = `${base}-cleaned.${ext}`;
        a.textContent = "Download";
        root.querySelector(".result-action").appendChild(a);
      },
    };
  }

  async function handleFiles(files) {
    const mode = els.mode.value;
    const maxKB = parseFloat(els.maxKB.value) || null;
    const format = els.format.value;
    els.resultsSection.style.display = "block";
    for (const file of files) {
      const card = makeCard(file);
      els.results.prepend(card.root);
      try {
        card.setStatus("Reading…");
        const bitmap = await loadBitmap(file);
        card.setStatus("Removing shadows & stains…");
        await new Promise((r) => setTimeout(r, 30)); // let the status paint
        const canvas = cleanCanvas(bitmap, mode);
        card.setStatus(maxKB ? "Fitting to size…" : "Finishing…");
        const out = await exportCanvas(canvas, format, maxKB);
        card.finish(file, out, format);
      } catch (err) {
        card.fail(err.message || String(err));
      }
    }
    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

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

  document.addEventListener("DOMContentLoaded", () => {
    wireDropZone();
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  });
})();
