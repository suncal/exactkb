/* ExactKB Request Kits — a shareable checklist of file requirements.
   The whole kit is encoded in the URL (or inlined on official kit pages):
   no server, no accounts, files never leave the device.
   Runs in two modes: opener (#kit-root) and builder (#kit-builder). */
(function () {
  "use strict";

  const $ = (sel, el) => (el || document).querySelector(sel);
  const E = () => window.ExactKBEngine;
  const KIT_BASE = "https://suncal.github.io/exactkb/kit/";

  // ---------- codec (base64url JSON in the fragment) ----------
  function encodeKit(kit) {
    const json = JSON.stringify(kit);
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeKit(str) {
    try {
      const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(escape(atob(b64)));
      const kit = JSON.parse(json);
      if (!kit || !Array.isArray(kit.s) || !kit.s.length) return null;
      return kit;
    } catch (_) { return null; }
  }
  function kitFromPage() {
    if (window.KIT_DATA) return window.KIT_DATA;
    const m = location.hash.match(/k=([A-Za-z0-9_-]+)/);
    return m ? decodeKit(m[1]) : null;
  }
  function slugName(name, i) {
    const s = String(name || "file_" + (i + 1)).toLowerCase()
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return s || "file_" + (i + 1);
  }
  function specLine(s) {
    const bits = [];
    if (s.min != null && s.max != null) bits.push(`${s.min}–${s.max} KB`);
    else if (s.max != null) bits.push(`≤ ${s.max} KB`);
    else if (s.min != null) bits.push(`≥ ${s.min} KB`);
    if (s.w && s.h) bits.push(`${s.w}×${s.h} px`);
    bits.push((s.f || "jpeg") === "jpeg" ? "JPG" : String(s.f).toUpperCase());
    return bits.join(" · ");
  }

  // ---------- opener ----------
  function initOpener(root) {
    if (new URLSearchParams(location.search).get("embed") === "1") {
      document.body.classList.add("embed");
    }
    const kit = kitFromPage();
    if (!kit) {
      root.innerHTML = `
        <div class="kit-error">
          <p><strong>This kit link is missing or damaged.</strong></p>
          <p>Ask the sender for a fresh link, or <a href="../build-kit/">build your own kit</a>.</p>
        </div>`;
      return;
    }
    const done = new Array(kit.s.length).fill(null);

    const head = document.createElement("div");
    head.className = "kit-head";
    head.innerHTML = `
      <div class="kit-title"></div>
      <div class="kit-sub">${kit.s.length} file${kit.s.length > 1 ? "s" : ""} needed · each is fitted to its exact requirement on your device — nothing is uploaded.</div>`;
    head.querySelector(".kit-title").textContent = kit.t || "Document request";
    root.appendChild(head);

    const list = document.createElement("div");
    list.className = "kit-slots";
    root.appendChild(list);

    kit.s.forEach((spec, i) => {
      const slot = document.createElement("div");
      slot.className = "kit-slot";
      slot.innerHTML = `
        <div class="kit-slot-num">${i + 1}</div>
        <div class="kit-slot-body">
          <div class="kit-slot-name"></div>
          <div class="kit-slot-spec"></div>
          <div class="kit-slot-note"></div>
          <div class="kit-slot-status"></div>
        </div>
        <div class="kit-slot-action">
          <button class="btn kit-choose" type="button">Choose file</button>
          <input type="file" accept="image/*,.heic,.heif,.avif,.svg" hidden>
        </div>`;
      slot.querySelector(".kit-slot-name").textContent = spec.n || `File ${i + 1}`;
      slot.querySelector(".kit-slot-spec").textContent = specLine(spec);
      const noteEl = slot.querySelector(".kit-slot-note");
      if (spec.note) noteEl.textContent = spec.note; else noteEl.remove();

      const input = slot.querySelector("input");
      const btn = slot.querySelector(".kit-choose");
      const status = slot.querySelector(".kit-slot-status");
      btn.addEventListener("click", () => input.click());
      // whole-slot drop support
      ["dragenter", "dragover"].forEach((ev) =>
        slot.addEventListener(ev, (e) => { e.preventDefault(); slot.classList.add("over"); }));
      ["dragleave", "drop"].forEach((ev) =>
        slot.addEventListener(ev, (e) => { e.preventDefault(); slot.classList.remove("over"); }));
      slot.addEventListener("drop", (e) => {
        const f = e.dataTransfer?.files?.[0];
        if (f) processSlot(f);
      });
      input.addEventListener("change", () => {
        if (input.files[0]) processSlot(input.files[0]);
        input.value = "";
      });
      list.appendChild(slot);

      async function processSlot(file) {
        slot.classList.remove("ok", "failed");
        status.style.display = "block";
        status.textContent = "Working…";
        btn.disabled = true;
        try {
          const settings = {
            minKB: spec.min ?? null, maxKB: spec.max ?? null,
            width: spec.w ?? null, height: spec.h ?? null,
            format: spec.f || "jpeg",
            dpi: spec.dpi || null,
          };
          if (!settings.maxKB) settings.maxKB = 10000; // kits may spec dims only
          const out = await E().compressToTarget(file, settings, (m) => { status.textContent = m; });
          if (settings.dpi && out.blob.type === "image/jpeg") {
            out.blob = await E().stampJpegDpi(out.blob, settings.dpi);
          }
          const ext = settings.format === "png" ? "png" : settings.format === "webp" ? "webp" : "jpg";
          const name = `${slugName(spec.n, i)}.${ext}`;
          done[i] = { name, blob: out.blob };
          slot.classList.add("ok");
          status.innerHTML = "";
          const ok = document.createElement("span");
          ok.textContent = `✓ Ready — ${E().fmtKB(out.blob.size)}${out.canvas ? ` · ${out.canvas.width}×${out.canvas.height}px` : ""} `;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(out.blob);
          a.download = name;
          a.textContent = "download";
          status.append(ok, a);
          btn.textContent = "Replace";
        } catch (err) {
          done[i] = null;
          slot.classList.add("failed");
          status.textContent = err.message || String(err);
          btn.textContent = "Try another file";
        }
        btn.disabled = false;
        updateBundle();
      }
    });

    const bundle = document.createElement("div");
    bundle.className = "kit-bundle";
    bundle.innerHTML = `
      <div class="kit-progress"></div>
      <button class="btn-go" type="button" disabled>Download bundle (.zip)</button>`;
    root.appendChild(bundle);
    const progress = bundle.querySelector(".kit-progress");
    const zipBtn = bundle.querySelector("button");

    function updateBundle() {
      const ready = done.filter(Boolean);
      progress.textContent = `${ready.length} of ${kit.s.length} ready`;
      zipBtn.disabled = ready.length === 0;
      zipBtn.textContent = ready.length === kit.s.length
        ? `Download complete bundle (.zip)`
        : `Download ${ready.length || ""} ${ready.length === 1 ? "file" : "files"} (.zip)`.replace("  ", " ");
    }
    updateBundle();
    zipBtn.addEventListener("click", async () => {
      const ready = done.filter(Boolean);
      if (!ready.length) return;
      zipBtn.textContent = "Zipping…";
      const zip = await E().buildZip(ready);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zip);
      a.download = slugName(kit.t, 0) + "_files.zip";
      a.click();
      updateBundle();
    });
  }

  // ---------- builder ----------
  function initBuilder(root) {
    const presets = window.EXACTKB_PRESETS || [];
    const rowsEl = $("#kb-rows", root);
    const rows = [];

    function addRow(prefill) {
      const row = document.createElement("div");
      row.className = "kb-row";
      row.innerHTML = `
        <div class="kb-grid">
          <div class="field kb-name"><label>File name</label><input type="text" placeholder="e.g. Photograph"></div>
          <div class="field"><label>Prefill from preset</label><select class="kb-preset"><option value="">— optional —</option></select></div>
          <div class="field"><label>Min</label><div class="input-wrap"><input type="number" class="kb-min" min="1" placeholder="opt"><span class="unit">KB</span></div></div>
          <div class="field"><label>Max</label><div class="input-wrap"><input type="number" class="kb-max" min="1" placeholder="e.g. 50"><span class="unit">KB</span></div></div>
          <div class="field"><label>Width</label><div class="input-wrap"><input type="number" class="kb-w" min="16" placeholder="auto"><span class="unit">PX</span></div></div>
          <div class="field"><label>Height</label><div class="input-wrap"><input type="number" class="kb-h" min="16" placeholder="auto"><span class="unit">PX</span></div></div>
          <div class="field"><label>Format</label><select class="kb-f"><option value="jpeg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option></select></div>
        </div>
        <button class="kb-remove queue-remove" type="button" aria-label="Remove this file">✕</button>`;
      const presetSel = row.querySelector(".kb-preset");
      for (const p of presets) {
        if (p.id === "custom") continue;
        const opt = document.createElement("option");
        opt.value = p.id; opt.textContent = p.label;
        presetSel.appendChild(opt);
      }
      presetSel.addEventListener("change", () => {
        const p = presets.find((x) => x.id === presetSel.value);
        if (!p) return;
        row.querySelector(".kb-min").value = p.minKB ?? "";
        row.querySelector(".kb-max").value = p.maxKB ?? "";
        row.querySelector(".kb-w").value = p.width ?? "";
        row.querySelector(".kb-h").value = p.height ?? "";
        row.querySelector(".kb-f").value = p.format || "jpeg";
        if (!row.querySelector(".kb-name input").value) {
          row.querySelector(".kb-name input").value = p.label.replace(/\s*\(.*$/, "");
        }
      });
      row.querySelector(".kb-remove").addEventListener("click", () => {
        rows.splice(rows.indexOf(row), 1);
        row.remove();
      });
      if (prefill) {
        row.querySelector(".kb-name input").value = prefill.n || "";
        row.querySelector(".kb-min").value = prefill.min ?? "";
        row.querySelector(".kb-max").value = prefill.max ?? "";
      }
      rows.push(row);
      rowsEl.appendChild(row);
    }

    $("#kb-add", root).addEventListener("click", () => addRow());
    addRow({ n: "Photograph", max: 50 });
    addRow({ n: "Signature", max: 20 });

    $("#kb-generate", root).addEventListener("click", async () => {
      const title = $("#kb-title", root).value.trim() || "Document request";
      const slots = rows.map((row) => {
        const num = (sel) => { const v = parseFloat(row.querySelector(sel).value); return isNaN(v) ? null : v; };
        const s = {
          n: row.querySelector(".kb-name input").value.trim() || null,
          min: num(".kb-min"), max: num(".kb-max"),
          w: num(".kb-w"), h: num(".kb-h"),
          f: row.querySelector(".kb-f").value,
        };
        Object.keys(s).forEach((k) => { if (s[k] == null || s[k] === "jpeg") delete s[k]; });
        return s;
      }).filter((s) => s.max != null || s.min != null || (s.w && s.h));
      if (!slots.length) {
        alert("Add at least one file with a size limit (or exact dimensions).");
        return;
      }
      const url = KIT_BASE + "#k=" + encodeKit({ t: title, s: slots });
      const out = $("#kb-output", root);
      out.style.display = "block";
      $("#kb-link", root).value = url;
      $("#kb-open", root).href = url;
      $("#kb-embed", root).value =
        `<iframe src="${url.replace("/kit/", "/kit/?embed=1")}" style="width:100%;min-height:${140 + slots.length * 110}px;border:1px solid #e5e9f2;border-radius:12px" title="${title.replace(/"/g, "&quot;")}"></iframe>`;
      const qrBox = $("#kb-qr", root);
      qrBox.innerHTML = "";
      try {
        await E().loadScriptOnce("vendor/qrcode.js");
        const qr = window.qrcode(0, "M");
        qr.addData(url);
        qr.make();
        qrBox.innerHTML = qr.createImgTag(3, 8);
      } catch (_) { /* QR optional */ }
      out.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    $("#kb-copy", root).addEventListener("click", async () => {
      const btn = $("#kb-copy", root);
      try { await navigator.clipboard.writeText($("#kb-link", root).value); }
      catch (_) { $("#kb-link", root).select(); document.execCommand("copy"); }
      btn.textContent = "Copied ✓";
      setTimeout(() => { btn.textContent = "Copy link"; }, 1800);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const opener = document.getElementById("kit-root");
    const builder = document.getElementById("kit-builder");
    if (opener) initOpener(opener);
    if (builder) initBuilder(builder);
  });
})();
