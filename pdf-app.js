/* ExactKB PDF — client-side exact-size PDF compressor.
   Renders each page with pdf.js, re-encodes as JPEG, rebuilds with pdf-lib,
   binary-searching quality (then render scale) to land under the KB target. */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const BASE = new URL(".", document.currentScript.src).href;
  const MAX_PAGES = 60;

  const els = {
    drop: $("#drop"),
    fileInput: $("#file-input"),
    maxKB: $("#max-kb"),
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
      item.innerHTML = `<div class="queue-thumb">📄</div><div class="queue-body"><div class="queue-name"></div><div class="queue-size"></div></div>`;
      item.querySelector(".queue-name").textContent = f.name;
      item.querySelector(".queue-size").textContent = fmtKB(f.size);
      const rm = document.createElement("button");
      rm.className = "queue-remove";
      rm.type = "button";
      rm.setAttribute("aria-label", "Remove " + f.name);
      rm.textContent = "✕";
      rm.addEventListener("click", () => { pending.splice(idx, 1); renderQueue(); });
      item.appendChild(rm);
      els.queue.appendChild(item);
    });
    els.queue.style.display = pending.length ? "flex" : "none";
    els.go.disabled = pending.length === 0;
    els.go.textContent = pending.length
      ? `Compress ${pending.length} PDF${pending.length > 1 ? "s" : ""} →`
      : "Compress →";
  }
  function queueFiles(files) { pending.push(...files); renderQueue(); }

  // ---------- lazy lib loading ----------
  let libsPromise = null;
  function loadLibs() {
    if (!libsPromise) {
      libsPromise = (async () => {
        await loadScript(BASE + "vendor/pdf.min.js");
        await loadScript(BASE + "vendor/pdf-lib.min.js");
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + "vendor/pdf.worker.min.js";
      })();
    }
    return libsPromise;
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load PDF engine."));
      document.head.appendChild(s);
    });
  }

  // ---------- intake ----------
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
  }

  async function handleFiles(files) {
    const maxKB = parseFloat(els.maxKB.value) || null;
    if (!maxKB) { alert("Set a maximum size in KB — the number the upload form gives you."); return; }
    els.resultsSection.style.display = "block";
    for (const file of files) {
      const card = makeCard(file);
      els.results.prepend(card.root);
      try {
        if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
          throw new Error("Not a PDF. For images, use the image tool on the home page.");
        }
        card.setStatus("Loading PDF engine…");
        await loadLibs();
        const out = await compressPdf(file, maxKB * 1024, (msg) => card.setStatus(msg));
        card.finish(file, out);
      } catch (err) {
        card.fail(err.message || String(err));
      }
    }
    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------- engine ----------
  async function renderPages(pdf, scale, onStatus) {
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      onStatus(`Rendering page ${i}/${pdf.numPages}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const base = page.getViewport({ scale: 1 });
      pages.push({ canvas, ptWidth: base.width, ptHeight: base.height });
    }
    return pages;
  }

  function canvasToJpeg(canvas, q) {
    return new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
  }

  async function buildPdf(pages, quality) {
    const doc = await window.PDFLib.PDFDocument.create();
    for (const p of pages) {
      const jpegBlob = await canvasToJpeg(p.canvas, quality);
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const img = await doc.embedJpg(jpegBytes);
      const page = doc.addPage([p.ptWidth, p.ptHeight]);
      page.drawImage(img, { x: 0, y: 0, width: p.ptWidth, height: p.ptHeight });
    }
    const bytes = await doc.save();
    return new Blob([bytes], { type: "application/pdf" });
  }

  // COLOR-PRESERVING contrast stretch for text pages: gain computed from the
  // luma histogram, applied identically to all RGB channels — crisp text,
  // colors untouched (never silently grayscale a user's PDF).
  function enhancePage(canvas) {
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

  function isDocPage(canvas) {
    const ctx = canvas.getContext("2d");
    const w = Math.min(256, canvas.width), h = Math.min(256, canvas.height);
    const d = ctx.getImageData(0, 0, w, h).data;
    let sat = 0;
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      sat += Math.max(r, g, b) - Math.min(r, g, b);
    }
    return sat / n < 28;
  }

  async function pageJpegSizes(pages, q) {
    let total = 0;
    for (const p of pages) total += (await canvasToJpeg(p.canvas, q)).size;
    return total;
  }

  async function compressPdf(file, maxBytes, onStatus) {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    if (pdf.numPages > MAX_PAGES) {
      throw new Error(`This PDF has ${pdf.numPages} pages — the limit is ${MAX_PAGES}. Split it first.`);
    }

    // Clarity engine: hold a quality floor, trade render resolution first;
    // relax the floor only when nothing fits. Text pages get grayscale +
    // contrast so they stay readable at small sizes.
    const floors = [0.72, 0.55, 0.38, 0.2, 0.08];
    const scales = [1.5, 1.2, 0.95, 0.75, 0.6, 0.45];
    const overhead = 6000 + 2200 * pdf.numPages; // pdf-lib structure estimate
    const cache = {};
    let doc = null;

    for (const qFloor of floors) {
      for (const scale of scales) {
        if (!cache[scale]) {
          const pages = await renderPages(pdf, scale, onStatus);
          if (doc === null) doc = isDocPage(pages[0].canvas);
          if (doc) pages.forEach((p) => enhancePage(p.canvas));
          cache[scale] = pages;
        }
        const pages = cache[scale];
        onStatus(`Optimizing… (${Math.round(scale * 100)}% render, quality ≥ ${Math.round(qFloor * 100)}%)`);
        if ((await pageJpegSizes(pages, qFloor)) + overhead > maxBytes) continue;
        // fits at the floor — binary-search the best quality, then assemble
        let lo = qFloor, hi = 0.9, q = qFloor;
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          if ((await pageJpegSizes(pages, mid)) + overhead > maxBytes) hi = mid;
          else { q = mid; lo = mid; }
        }
        let blob = await buildPdf(pages, q);
        while (blob.size > maxBytes && q > 0.06) {   // estimate was optimistic — nudge down
          q = Math.max(0.05, q - 0.08);
          blob = await buildPdf(pages, q);
        }
        if (blob.size <= maxBytes) return { blob, pages: pdf.numPages, q };
      }
    }
    throw new Error("Couldn't fit under that size — this PDF has too many pages for the limit. Try a higher KB limit or split the file.");
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
      finish(srcFile, out) {
        const url = URL.createObjectURL(out.blob);
        root.querySelector(".result-thumb").innerHTML = "📄";
        root.querySelector(".result-status").textContent = "Done — fits the requirement ✓";
        root.querySelector(".result-meta").textContent =
          `${fmtKB(srcFile.size)} → ${fmtKB(out.blob.size)} · ${out.pages} page${out.pages > 1 ? "s" : ""}`;
        const a = document.createElement("a");
        a.className = "btn btn-download";
        a.href = url;
        const base = srcFile.name.replace(/\.pdf$/i, "");
        a.download = `${base}-${Math.round(out.blob.size / 1024)}kb.pdf`;
        a.textContent = "Download";
        root.querySelector(".result-action").appendChild(a);
      },
    };
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", () => {
    if (window.PDF_PRESET?.maxKB) els.maxKB.value = window.PDF_PRESET.maxKB;
    wireDropZone();
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  });
})();
