// ExactKB Spec Registry — upload requirements for portals worldwide, grouped by country.
// Specs drift year to year; every preset tells the user to verify against the
// current official source. This registry IS the moat: keep it current, keep it growing.

window.EXACTKB_COUNTRIES = [
  { id: "global", label: "🌍 Worldwide / Web" },
  { id: "in", label: "🇮🇳 India" },
  { id: "us", label: "🇺🇸 United States" },
  { id: "uk", label: "🇬🇧 United Kingdom" },
  { id: "eu", label: "🇪🇺 Europe / Schengen" },
  { id: "ca", label: "🇨🇦 Canada" },
  { id: "au", label: "🇦🇺 Australia" },
];

window.EXACTKB_PRESETS = [
  // ---------- Worldwide / Web ----------
  {
    id: "custom", country: "global",
    label: "Custom (set your own target)",
    minKB: null, maxKB: 100, width: null, height: null, format: "jpeg", note: ""
  },
  {
    id: "email-25mb", country: "global",
    label: "Email attachment (≤ 25 MB)",
    minKB: null, maxKB: 25000, width: null, height: null, format: "jpeg",
    note: "Gmail/Outlook attachment limit is 25 MB."
  },
  {
    id: "discord-10mb", country: "global",
    label: "Discord upload (≤ 10 MB)",
    minKB: null, maxKB: 10000, width: null, height: null, format: "jpeg",
    note: "Discord free-tier upload limit is 10 MB."
  },
  {
    id: "whatsapp-dp", country: "global",
    label: "WhatsApp profile photo (640×640)",
    minKB: null, maxKB: 500, width: 640, height: 640, format: "jpeg",
    note: "Square crop at 640×640 px — uploads without WhatsApp's blurry recompression."
  },
  {
    id: "linkedin-photo", country: "global",
    label: "LinkedIn profile photo (400×400, ≤ 8 MB)",
    minKB: null, maxKB: 8000, width: 400, height: 400, format: "jpeg",
    note: "LinkedIn recommends a square photo of at least 400×400 px, max 8 MB."
  },
  {
    id: "web-hero", country: "global",
    label: "Website image (≤ 200 KB, fast-loading)",
    minKB: null, maxKB: 200, width: 1600, height: null, format: "jpeg",
    note: "A good rule of thumb for fast pages: hero images under 200 KB at ~1600 px wide."
  },

  // ---------- India ----------
  {
    id: "ssc-photo", country: "in",
    label: "SSC — Photograph (20–50 KB)",
    minKB: 20, maxKB: 50, width: 200, height: 230, format: "jpeg",
    note: "Common SSC (CGL/CHSL/MTS) spec: JPEG 20–50 KB, approx 200×230 px. Verify against your exam's latest notification."
  },
  {
    id: "ssc-signature", country: "in",
    label: "SSC — Signature (10–20 KB)",
    minKB: 10, maxKB: 20, width: 140, height: 60, format: "jpeg",
    note: "Common SSC signature spec: JPEG 10–20 KB, approx 140×60 px. Verify against your exam's latest notification."
  },
  {
    id: "ibps-photo", country: "in",
    label: "IBPS / SBI — Photograph (20–50 KB)",
    minKB: 20, maxKB: 50, width: 200, height: 230, format: "jpeg",
    note: "IBPS/SBI photo: JPEG 20–50 KB, 200×230 px. Verify against the latest official notification."
  },
  {
    id: "ibps-signature", country: "in",
    label: "IBPS / SBI — Signature (10–20 KB)",
    minKB: 10, maxKB: 20, width: 140, height: 60, format: "jpeg",
    note: "IBPS/SBI signature: JPEG 10–20 KB, 140×60 px. Verify against the latest official notification."
  },
  {
    id: "ibps-thumb", country: "in",
    label: "IBPS — Left thumb impression (20–50 KB)",
    minKB: 20, maxKB: 50, width: 240, height: 240, format: "jpeg",
    note: "IBPS thumb impression: JPEG 20–50 KB, 240×240 px. Verify against the latest official notification."
  },
  {
    id: "ibps-declaration", country: "in",
    label: "IBPS — Handwritten declaration (50–100 KB)",
    minKB: 50, maxKB: 100, width: 800, height: 400, format: "jpeg",
    note: "IBPS handwritten declaration: JPEG 50–100 KB, 800×400 px. Verify against the latest official notification."
  },
  {
    id: "upsc-photo", country: "in",
    label: "UPSC OTR — Photo / Signature (20–300 KB)",
    minKB: 20, maxKB: 300, width: null, height: null, format: "jpeg",
    note: "UPSC One-Time Registration accepts JPG 20–300 KB. Verify against the latest UPSC notification."
  },
  {
    id: "neet-photo", country: "in",
    label: "NEET — Passport photo (10–200 KB)",
    minKB: 10, maxKB: 200, width: null, height: null, format: "jpeg",
    note: "NEET passport-size photo: JPG 10–200 KB. Verify against the latest NTA information bulletin."
  },
  {
    id: "neet-signature", country: "in",
    label: "NEET — Signature (4–30 KB)",
    minKB: 4, maxKB: 30, width: null, height: null, format: "jpeg",
    note: "NEET signature: JPG 4–30 KB. Verify against the latest NTA information bulletin."
  },
  {
    id: "pan-photo", country: "in",
    label: "PAN card — Photo (≤ 50 KB)",
    minKB: null, maxKB: 50, width: 213, height: 213, format: "jpeg",
    note: "Online PAN application photo: JPEG up to 50 KB. Verify on the NSDL/UTIITSL portal."
  },
  {
    id: "aadhaar-doc", country: "in",
    label: "Aadhaar / govt doc upload (≤ 2 MB)",
    minKB: null, maxKB: 2000, width: null, height: null, format: "jpeg",
    note: "Most Indian govt document uploads (Aadhaar update, DigiLocker) cap at 2 MB. Verify on the portal."
  },

  // ---------- United States ----------
  {
    id: "us-visa-photo", country: "us",
    label: "US Visa DS-160 photo (600×600, ≤ 240 KB)",
    minKB: null, maxKB: 240, width: 600, height: 600, format: "jpeg",
    note: "DS-160 digital photo: square JPEG, 600×600 px minimum, max 240 KB. Verify at travel.state.gov."
  },
  {
    id: "us-dv-lottery", country: "us",
    label: "DV Lottery (Green Card) photo (600×600, ≤ 240 KB)",
    minKB: null, maxKB: 240, width: 600, height: 600, format: "jpeg",
    note: "Diversity Visa entry photo: JPEG exactly 600×600 px, max 240 KB. Verify at dvprogram.state.gov."
  },
  {
    id: "uscis-upload", country: "us",
    label: "USCIS online filing document (≤ 6 MB)",
    minKB: null, maxKB: 6000, width: null, height: null, format: "jpeg",
    note: "USCIS online accounts cap most evidence uploads at 6 MB per file. Verify at uscis.gov."
  },
  {
    id: "us-passport-photo", country: "us",
    label: "US Passport photo (2×2 in, 600×600 digital)",
    minKB: null, maxKB: 240, width: 600, height: 600, format: "jpeg",
    note: "US passport photo is 2×2 inches; the digital tool expects square 600×600 to 1200×1200 px. Verify at travel.state.gov."
  },

  // ---------- United Kingdom ----------
  {
    id: "uk-passport-photo", country: "uk",
    label: "UK Passport digital photo (750×950 min, 50 KB–10 MB)",
    minKB: 50, maxKB: 10000, width: 750, height: 950, format: "jpeg",
    note: "GOV.UK digital passport photo: at least 750×950 px, between 50 KB and 10 MB. Verify at gov.uk."
  },
  {
    id: "uk-visa-doc", country: "uk",
    label: "UK Visa document upload (≤ 6 MB)",
    minKB: null, maxKB: 6000, width: null, height: null, format: "jpeg",
    note: "UKVI online applications generally cap document uploads at 6 MB. Verify on your application portal."
  },

  // ---------- Europe / Schengen ----------
  {
    id: "schengen-photo", country: "eu",
    label: "Schengen visa photo (35×45 mm, ≤ 1 MB typical)",
    minKB: null, maxKB: 1000, width: 827, height: 1063, format: "jpeg",
    note: "Schengen photo is 35×45 mm (≈827×1063 px at 600 dpi). Portal upload limits vary by country — verify on your consulate's portal."
  },
  {
    id: "eu-passport-generic", country: "eu",
    label: "EU national ID / passport portal (≤ 2 MB typical)",
    minKB: null, maxKB: 2000, width: null, height: null, format: "jpeg",
    note: "Most EU national application portals cap uploads at 1–2 MB. Verify on your country's portal."
  },

  // ---------- Canada ----------
  {
    id: "ircc-doc", country: "ca",
    label: "IRCC document upload (≤ 4 MB)",
    minKB: null, maxKB: 4000, width: null, height: null, format: "jpeg",
    note: "IRCC (immigration) online uploads cap at 4 MB per file. Verify at canada.ca."
  },
  {
    id: "ca-visa-photo", country: "ca",
    label: "Canada visa photo (420×540, ≤ 4 MB)",
    minKB: null, maxKB: 4000, width: 420, height: 540, format: "jpeg",
    note: "Canada visa digital photo: minimum 420×540 px. Verify at canada.ca."
  },

  // ---------- Australia ----------
  {
    id: "immi-doc", country: "au",
    label: "ImmiAccount document upload (≤ 5 MB)",
    minKB: null, maxKB: 5000, width: null, height: null, format: "jpeg",
    note: "Australian ImmiAccount uploads cap at 5 MB per file. Verify at immi.homeaffairs.gov.au."
  },
  {
    id: "au-passport-photo", country: "au",
    label: "Australia passport photo (35×45 mm print spec)",
    minKB: null, maxKB: 2000, width: 827, height: 1063, format: "jpeg",
    note: "Australian passport photos are 35×45 mm; digital services vary. Verify at passports.gov.au."
  },
];
