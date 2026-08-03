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
  };

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

  async function compressPdf(file, maxBytes, onStatus) {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    if (pdf.numPages > MAX_PAGES) {
      throw new Error(`This PDF has ${pdf.numPages} pages — the limit is ${MAX_PAGES}. Split it first.`);
    }

    const scales = [1.5, 1.1, 0.8, 0.55];
    for (let si = 0; si < scales.length; si++) {
      const pages = await renderPages(pdf, scales[si], onStatus);
      // binary-search JPEG quality at this render scale
      let lo = 0.05, hi = 0.9, fit = null;
      for (let i = 0; i < 7; i++) {
        const q = (lo + hi) / 2;
        onStatus(`Compressing… (pass ${si + 1}.${i + 1})`);
        const blob = await buildPdf(pages, q);
        if (blob.size > maxBytes) hi = q;
        else { fit = { blob, q }; lo = q; }
      }
      if (fit) return { blob: fit.blob, pages: pdf.numPages };
      // too big even at q≈0.05 → try a smaller render scale
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
