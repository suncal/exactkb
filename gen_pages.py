#!/usr/bin/env python3
"""Generate ExactKB SEO landing pages + sitemap. Run: python3 gen_pages.py"""
import html
import json
import os

BASE_URL = "https://suncal.github.io/exactkb"
ROOT = os.path.dirname(os.path.abspath(__file__))

# slug -> page definition
# preset: {id, country, minKB, maxKB, width, height, format} (None where N/A)
PAGES = {
    # ---------- generic KB targets ----------
    "compress-image-to-10kb": {
        "title": "Compress Image to 10 KB Online — Free, Exact & Private",
        "desc": "Reduce any photo to under 10 KB without endless retries. Exact-size targeting, runs in your browser, nothing uploaded.",
        "h1": "Compress an image to 10 KB",
        "sub": "For the strictest upload forms — signatures, thumb impressions, tiny attachment limits. Drop your image and get a file under 10 KB on the first try.",
        "preset": {"id": "custom", "country": "global", "minKB": None, "maxKB": 10, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "10 KB is one of the tightest limits any form asks for — at this size, dimensions matter more than quality. ExactKB automatically finds the right combination of both, shrinking the image only as much as needed to slip under the limit.",
            "Everything happens in your browser. Your file is never uploaded to a server, which matters when the image is a signature or an identity document.",
        ],
        "faqs": [
            ("Will a 10 KB image still be readable?", "For signatures and simple images, yes. For detailed photos, expect visible quality loss — 10 KB is very small. ExactKB preserves as much detail as the limit allows."),
            ("What if the form also wants specific dimensions?", "Enter the width and height in pixels and ExactKB will crop-and-fit to exactly those dimensions while hitting the KB target."),
        ],
    },
    "compress-image-to-20kb": {
        "title": "Compress Image to 20 KB Online — Free, Exact & Private",
        "desc": "Get any photo under 20 KB in one try. Exact-size compression for exam forms and portals. 100% in-browser — files never uploaded.",
        "h1": "Compress an image to 20 KB",
        "sub": "The classic exam-portal limit. Drop your photo, get a file that's under 20 KB — first try, no retry loop.",
        "preset": {"id": "custom", "country": "global", "minKB": None, "maxKB": 20, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "\"Signature must not exceed 20 KB\" — if you've applied to any government exam or job portal, you've met this message. Regular compressors make you guess a quality setting and retry until the portal stops rejecting you. ExactKB targets 20 KB directly and lands inside it.",
            "If your form specifies a window like 10–20 KB, set the minimum too: ExactKB will pad the file up if it compresses below the floor, which is a common hidden reason portals reject files.",
        ],
        "faqs": [
            ("My portal says 10–20 KB. What do I enter?", "Min 10, Max 20. ExactKB guarantees the output lands inside that window — including growing the file if it comes out too small."),
            ("Is my photo private?", "Completely. Compression runs inside your browser; the image never leaves your device."),
        ],
    },
    "compress-image-to-50kb": {
        "title": "Compress Image to 50 KB Online — Free, Exact & Private",
        "desc": "Compress any photo to under 50 KB for exam and government portals. Exact targeting, country presets, no upload — fully private.",
        "h1": "Compress an image to 50 KB",
        "sub": "The most common photo limit on application portals worldwide. One drop, one download, it fits.",
        "preset": {"id": "custom", "country": "global", "minKB": None, "maxKB": 50, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "50 KB is the default photo ceiling on hundreds of application systems — Indian exam boards, bank recruitment portals, university forms, and older government sites worldwide. ExactKB compresses straight to the target instead of making you loop through trial and error.",
            "Need 20–50 KB specifically? Set both bounds and the output is guaranteed inside the window.",
        ],
        "faqs": [
            ("Can I do many photos at once?", "Yes — drop multiple files and each is compressed to the same target."),
            ("Which formats can I upload?", "JPG, PNG, WebP, GIF and BMP. Output is JPG (smallest) or PNG."),
        ],
    },
    "compress-image-to-100kb": {
        "title": "Compress Image to 100 KB Online — Free, Exact & Private",
        "desc": "Reduce photos to under 100 KB with exact-size targeting. Free, in-browser, private — nothing is ever uploaded.",
        "h1": "Compress an image to 100 KB",
        "sub": "For job portals, document uploads and web forms with a 100 KB ceiling.",
        "preset": {"id": "custom", "country": "global", "minKB": None, "maxKB": 100, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "At 100 KB most photos survive compression with barely visible quality loss — if the compressor is smart about it. ExactKB binary-searches the quality setting to use every kilobyte you're allowed, instead of overshooting to a needlessly small, needlessly ugly file.",
        ],
        "faqs": [
            ("Will it look worse than the original?", "At 100 KB, usually imperceptibly — ExactKB uses the highest quality that still fits your limit."),
        ],
    },
    "compress-image-to-200kb": {
        "title": "Compress Image to 200 KB Online — Free, Exact & Private",
        "desc": "Get any image under 200 KB in one step. Exact-size compression in your browser — files never leave your device.",
        "h1": "Compress an image to 200 KB",
        "sub": "A common ceiling for tax portals, university applications and CMS uploads.",
        "preset": {"id": "custom", "country": "global", "minKB": None, "maxKB": 200, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "Whether it's an income-tax portal, a university admission form, or your company's CMS, 200 KB limits are everywhere. ExactKB fits your image inside the cap at the best quality the budget allows — no guesswork, no retry loop.",
        ],
        "faqs": [
            ("Can it also fix the dimensions?", "Yes — add width/height in pixels and ExactKB crops and scales to exactly that size while hitting the KB target."),
        ],
    },
    "compress-jpeg-to-10kb": {
        "title": "Compress JPEG to 10 KB — Signature & Thumb Files, Free & Private",
        "desc": "Compress JPG/JPEG files to 10 KB for signature uploads. Exact-size targeting with minimum-size padding. In-browser and private.",
        "h1": "Compress a JPEG to 10 KB",
        "sub": "Built for signature and thumb-impression uploads with single-digit KB limits.",
        "preset": {"id": "custom", "country": "global", "minKB": None, "maxKB": 10, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "Tiny JPEG targets are almost always signature fields. The trick is that portals often enforce a minimum too — a 4 KB scan gets rejected just like a 40 KB one. ExactKB handles both directions: it compresses down to the cap and pads up past the floor.",
        ],
        "faqs": [
            ("My signature scan is already tiny and still gets rejected. Why?", "Most likely it's below the form's minimum size. Enter the minimum KB and ExactKB will grow the file into the accepted range."),
        ],
    },
    "increase-image-size-to-20kb": {
        "title": "Increase Image Size to 20 KB (or any KB) — Free Online Tool",
        "desc": "Portal rejecting your photo for being too small? Grow any image to meet a minimum KB requirement — valid files, in-browser, private.",
        "h1": "Increase an image's file size to meet a minimum KB",
        "sub": "The reverse problem nobody serves: your file is too SMALL for the form. ExactKB pads it into the accepted range with valid JPEG data.",
        "preset": {"id": "custom", "country": "global", "minKB": 20, "maxKB": 50, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "Forms that specify \"20–50 KB\" reject files under 20 KB just as firmly as files over 50 — and almost every compressor can only shrink. ExactKB grows your file into the window using legitimate JPEG metadata, so the result opens everywhere and passes portal validation.",
            "Set the minimum and maximum from your form, drop the image, and download a file that lands inside the window.",
        ],
        "faqs": [
            ("Is padding a file safe/legit?", "Yes — ExactKB adds standard JPEG comment metadata, which every image viewer and upload validator treats as a normal part of the file. The picture itself is unchanged."),
            ("Why would a form have a minimum size at all?", "Portals use minimums as a crude quality check — very small files are assumed to be unreadable scans."),
        ],
    },
    # ---------- India ----------
    "ssc-photo-signature-resize": {
        "title": "SSC Photo & Signature Resize — 20–50 KB Photo, 10–20 KB Signature",
        "desc": "Resize your SSC CGL/CHSL/MTS photo (20–50 KB, 200×230) and signature (10–20 KB, 140×60) to the exact spec. Free, private, in-browser.",
        "h1": "SSC photo & signature resizer",
        "sub": "One tap to the standard SSC spec: photo 20–50 KB at 200×230 px, signature 10–20 KB at 140×60 px.",
        "preset": {"id": "ssc-photo", "country": "in", "minKB": 20, "maxKB": 50, "width": 200, "height": 230, "format": "jpeg"},
        "intro": [
            "SSC portals validate both the file size window and the pixel dimensions, and reject anything outside either — which is why photos that \"look fine\" keep bouncing. This page is preset to the standard photograph spec; switch the preset to SSC Signature for the 140×60, 10–20 KB signature file.",
            "Always cross-check the exact numbers in your exam's current notification — specs occasionally change between recruitment cycles.",
        ],
        "faqs": [
            ("My photo keeps getting rejected even under 50 KB. Why?", "Usually the dimensions — SSC expects roughly 200×230 px — or the file being under the 20 KB minimum. This preset fixes all three at once."),
            ("Does this work for CGL, CHSL, MTS, GD?", "The 20–50 KB / 10–20 KB pattern is standard across SSC recruitments, but verify your notification's annexure to be sure."),
        ],
    },
    "ibps-photo-signature-resize": {
        "title": "IBPS / SBI Photo & Signature Resize — Exact Size in One Click",
        "desc": "Resize IBPS & SBI photo (20–50 KB, 200×230), signature (10–20 KB, 140×60), thumb (20–50 KB) and declaration (50–100 KB). Free & private.",
        "h1": "IBPS / SBI photo, signature, thumb & declaration resizer",
        "sub": "All four IBPS upload files, each to its exact spec — photo, signature, left-thumb impression and handwritten declaration.",
        "preset": {"id": "ibps-photo", "country": "in", "minKB": 20, "maxKB": 50, "width": 200, "height": 230, "format": "jpeg"},
        "intro": [
            "Bank recruitment portals (IBPS PO/Clerk/SO, SBI, RRB) require four separately-specced uploads, and each has both a size window and exact dimensions. Use the preset menu above to switch between Photograph, Signature, Thumb impression and Handwritten declaration — each lands inside its window on the first try.",
        ],
        "faqs": [
            ("What are the four IBPS file specs?", "Commonly: photo 20–50 KB at 200×230 px; signature 10–20 KB at 140×60 px; left thumb 20–50 KB at 240×240 px; declaration 50–100 KB at 800×400 px. Verify in your notification."),
            ("The portal says my signature is too small. What do I do?", "That's the 10 KB minimum. ExactKB pads files up into the window automatically when you set the minimum."),
        ],
    },
    "upsc-photo-resize": {
        "title": "UPSC Photo & Signature Resize — 20–300 KB JPG for OTR",
        "desc": "Resize your UPSC photo or signature to the 20–300 KB JPG spec for One-Time Registration. Free, exact, private, in-browser.",
        "h1": "UPSC photo & signature resizer (20–300 KB)",
        "sub": "Preset to the UPSC OTR window: JPG between 20 KB and 300 KB.",
        "preset": {"id": "upsc-photo", "country": "in", "minKB": 20, "maxKB": 300, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "UPSC's One-Time Registration accepts JPGs from 20 KB to 300 KB — generous at the top, but phone photos still overshoot it and old scans undershoot it. ExactKB lands your file inside the window either way.",
            "Recent UPSC notifications also ask that the photo be recent, with your name and date visible where required — read your notification's photo instructions carefully; the file size is only one of the checks.",
        ],
        "faqs": [
            ("Does UPSC require exact pixel dimensions?", "The OTR spec is primarily a size window (20–300 KB). Check your specific notification for any added dimension or content requirements."),
        ],
    },
    "neet-photo-signature-resize": {
        "title": "NEET Photo & Signature Resize — 10–200 KB Photo, 4–30 KB Signature",
        "desc": "Resize your NEET passport photo (10–200 KB) and signature (4–30 KB) to NTA's exact spec. Free, private, in-browser.",
        "h1": "NEET photo & signature resizer",
        "sub": "Preset to NTA's windows: passport photo 10–200 KB, signature 4–30 KB.",
        "preset": {"id": "neet-photo", "country": "in", "minKB": 10, "maxKB": 200, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "NTA's NEET application takes a passport-size photo between 10 and 200 KB and a signature between 4 and 30 KB, both JPG. Switch the preset above for the signature file. Both land inside their windows in one pass.",
        ],
        "faqs": [
            ("Postcard photo too?", "Some NEET cycles also request a postcard-size (4×6) photo — use Custom with the size window from your information bulletin."),
        ],
    },
    "pan-card-photo-resize": {
        "title": "PAN Card Photo & Signature Resize — Under 50 KB for NSDL/UTIITSL",
        "desc": "Resize your photo and signature for online PAN applications — under 50 KB at the right dimensions. Free, private, in-browser.",
        "h1": "PAN card photo & signature resizer",
        "sub": "For NSDL / UTIITSL online PAN applications — photo and signature under 50 KB.",
        "preset": {"id": "pan-photo", "country": "in", "minKB": None, "maxKB": 50, "width": 213, "height": 213, "format": "jpeg"},
        "intro": [
            "Online PAN applications reject oversized photos and signatures silently more often than any other Indian portal — the limits are small and the error messages unhelpful. This preset produces a compliant JPEG in one step. Verify the current spec on the NSDL or UTIITSL page for your application type.",
        ],
        "faqs": [
            ("Photo or signature — same spec?", "They differ slightly by portal and application type. Use this preset for the photo and Custom for the signature with the numbers your portal shows."),
        ],
    },
    # ---------- US ----------
    "us-visa-photo-240kb": {
        "title": "US Visa Photo — 600×600, Under 240 KB (DS-160 Spec) Free Tool",
        "desc": "Make your DS-160 US visa photo exactly 600×600 px and under 240 KB. Private — your photo never leaves your browser.",
        "h1": "US visa (DS-160) photo — 600×600, under 240 KB",
        "sub": "Preset to the State Department's digital spec: square JPEG, 600×600 px, max 240 KB.",
        "preset": {"id": "us-visa-photo", "country": "us", "minKB": None, "maxKB": 240, "width": 600, "height": 600, "format": "jpeg"},
        "intro": [
            "The DS-160 photo tool wants a square JPEG between 600×600 and 1200×1200 pixels, no larger than 240 KB. Phone cameras produce photos 20× that size, so almost everyone hits the limit. ExactKB crops to a perfect square, scales to 600×600 and fits under 240 KB in one pass — and your photo stays on your device.",
            "Remember the content rules too: recent photo, plain white background, full face, no glasses. Verify at travel.state.gov before submitting.",
        ],
        "faqs": [
            ("Is this also the spec for the DV lottery?", "The DV (Green Card) lottery uses the same 600×600 / 240 KB digital spec — there's a dedicated preset for it as well."),
            ("Is my visa photo uploaded anywhere?", "No — processing is entirely inside your browser. Nothing is transmitted."),
        ],
    },
    "dv-lottery-photo-600x600": {
        "title": "DV Lottery Photo Resize — 600×600 JPEG Under 240 KB, Free & Private",
        "desc": "Green Card lottery photo to spec in one click: exactly 600×600 px JPEG under 240 KB. In-browser and private.",
        "h1": "DV Lottery (Green Card) photo — 600×600, under 240 KB",
        "sub": "The exact E-DV entry spec: square JPEG, 600×600 px, max 240 KB.",
        "preset": {"id": "us-dv-lottery", "country": "us", "minKB": None, "maxKB": 240, "width": 600, "height": 600, "format": "jpeg"},
        "intro": [
            "Every October, millions of DV entries are rejected over photo technicalities. The digital requirements are strict but simple: exactly square, 600×600 pixels minimum, JPEG, and no more than 240 KB. ExactKB produces exactly that from any phone photo.",
            "Content rules (recent photo, neutral expression, plain background, no glasses) are checked by humans later — get those right too. Verify at dvprogram.state.gov.",
        ],
        "faqs": [
            ("Can a rejected photo cost me the lottery?", "Yes — entries with non-compliant photos are disqualified, and you only get one entry per year. It's worth getting the file exactly to spec."),
        ],
    },
    # ---------- UK / EU / CA ----------
    "uk-passport-photo-digital": {
        "title": "UK Passport Digital Photo — 750×950 px, 50 KB–10 MB, Free Tool",
        "desc": "Fit your UK passport photo to GOV.UK's digital spec: at least 750×950 px, between 50 KB and 10 MB. Private, in-browser.",
        "h1": "UK passport digital photo — 750×950, 50 KB–10 MB",
        "sub": "Preset to the GOV.UK online application spec.",
        "preset": {"id": "uk-passport-photo", "country": "uk", "minKB": 50, "maxKB": 10000, "width": 750, "height": 950, "format": "jpeg"},
        "intro": [
            "GOV.UK's online passport service takes a digital photo of at least 750×950 pixels, sized between 50 KB and 10 MB. The unusual part is the minimum — over-compressed photos get rejected. ExactKB respects both bounds and the portrait aspect ratio.",
        ],
        "faqs": [
            ("Can I use a phone selfie?", "GOV.UK allows photos taken by someone else on a phone against a plain light background — the file just has to meet the size and quality rules. No selfies (arm's length shots distort the face)."),
        ],
    },
    "schengen-visa-photo-size": {
        "title": "Schengen Visa Photo Size — 35×45 mm Digital, Free Resize Tool",
        "desc": "Resize your Schengen visa photo to 35×45 mm proportions at upload-friendly file size. Private, in-browser, free.",
        "h1": "Schengen visa photo — 35×45 mm",
        "sub": "Preset to the standard Schengen 35×45 mm proportion (≈827×1063 px) at a portal-friendly size.",
        "preset": {"id": "schengen-photo", "country": "eu", "minKB": None, "maxKB": 1000, "width": 827, "height": 1063, "format": "jpeg"},
        "intro": [
            "All 29 Schengen states share the 35×45 mm photo standard, but each country's application portal sets its own upload cap — most between 500 KB and 2 MB. This preset produces the correct proportions at a size every portal accepts; check your consulate's portal for its exact cap and adjust the Max KB if needed.",
        ],
        "faqs": [
            ("Which countries does this cover?", "The 35×45 mm standard applies to every Schengen member (France, Germany, Italy, Spain, Netherlands…). Only the upload cap differs by portal."),
        ],
    },
    "canada-visa-photo-420x540": {
        "title": "Canada Visa Photo — 420×540 px for IRCC, Free Resize Tool",
        "desc": "Resize your Canada visa photo to IRCC's 420×540 px digital spec, under the 4 MB upload cap. Private and free.",
        "h1": "Canada visa photo — 420×540 px (IRCC)",
        "sub": "Preset to IRCC's digital photo spec with the 4 MB portal cap.",
        "preset": {"id": "ca-visa-photo", "country": "ca", "minKB": None, "maxKB": 4000, "width": 420, "height": 540, "format": "jpeg"},
        "intro": [
            "IRCC's online applications want a visa photo of at least 420×540 pixels and cap every uploaded file at 4 MB. ExactKB fits both constraints in one pass. Verify the current spec at canada.ca for your visa class.",
        ],
        "faqs": [
            ("Does this work for study and work permits too?", "The photo spec and 4 MB cap apply across most IRCC online applications — verify your checklist to be sure."),
        ],
    },
    # ---------- everyday / social ----------
    "whatsapp-dp-resize": {
        "title": "WhatsApp DP Resize — Perfect 640×640 Profile Photo, Free",
        "desc": "Make your WhatsApp profile photo a crisp 640×640 square so the app doesn't blur it. In-browser and private.",
        "h1": "WhatsApp profile photo — perfect 640×640",
        "sub": "Pre-crop your DP to WhatsApp's native square so the app doesn't recompress it into mush.",
        "preset": {"id": "whatsapp-dp", "country": "global", "minKB": None, "maxKB": 500, "width": 640, "height": 640, "format": "jpeg"},
        "intro": [
            "WhatsApp stores profile photos as 640×640 squares. Upload anything else and the app crops and recompresses it — which is why DPs often look blurrier than the original. Doing the crop yourself at exactly 640×640 keeps control of what's in frame and how sharp it stays.",
        ],
        "faqs": [
            ("Why does my DP look blurry?", "WhatsApp aggressively recompresses large uploads. A pre-sized 640×640 file under 500 KB needs minimal recompression and stays sharp."),
        ],
    },
    "compress-image-for-email": {
        "title": "Compress Images for Email — Fit Under the 25 MB Limit, Free",
        "desc": "Shrink photos to fit email attachment limits without ruining quality. Batch support, in-browser, private.",
        "h1": "Compress images for email attachments",
        "sub": "Fit your photos under Gmail/Outlook's 25 MB cap — or make them polite 200 KB attachments.",
        "preset": {"id": "custom", "country": "global", "minKB": None, "maxKB": 500, "width": 2048, "height": None, "format": "jpeg"},
        "intro": [
            "Modern phone photos run 4–12 MB each — three attachments and Gmail refuses to send. This preset resizes to 2048 px (plenty for viewing on any screen) at ~500 KB each, so a dozen photos travel in one email. Drop them all at once; each is compressed in your browser.",
        ],
        "faqs": [
            ("Will the recipient notice quality loss?", "On screen, no — 2048 px at high JPEG quality looks identical in an email client. For print-quality originals, send full files via a link instead."),
        ],
    },
    "compress-image-for-discord": {
        "title": "Compress Images for Discord — Fit the 10 MB Upload Limit, Free",
        "desc": "Shrink screenshots, art and photos under Discord's 10 MB free-tier limit without Nitro. In-browser and private.",
        "h1": "Compress images for Discord",
        "sub": "Fit under the 10 MB free-tier limit — no Nitro required.",
        "preset": {"id": "discord-10mb", "country": "global", "minKB": None, "maxKB": 10000, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "Discord's free tier caps uploads at 10 MB — an easy ceiling to hit with high-res art, scans, or phone photos. ExactKB fits your file just under the cap at the best possible quality, so you don't have to hand it to a random compressor site or pay for Nitro to share one file.",
        ],
        "faqs": [
            ("What about GIFs and videos?", "Animated GIFs are converted to a static frame for now — video and GIF support is on the roadmap."),
        ],
    },
    "heic-to-jpg": {
        "title": "HEIC to JPG Converter — Free, Private, In-Browser",
        "desc": "Convert iPhone HEIC photos to JPG instantly in your browser — no upload, no signup. Optionally fit an exact KB size too.",
        "h1": "Convert HEIC to JPG",
        "sub": "iPhone photos → universal JPG, right in your browser. Nothing is uploaded anywhere.",
        "preset": {"id": "custom", "country": "global", "minKB": None, "maxKB": 10000, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "iPhones shoot HEIC by default — great for storage, useless for upload forms, Windows PCs, and half the web. Drop your HEIC files here and get standard JPGs back in seconds. Conversion happens entirely on your device.",
            "Bonus over ordinary converters: if the form you're filling also has a size limit, set the Max KB and the output will fit it in the same step.",
        ],
        "faqs": [
            ("Why does my iPhone take HEIC photos?", "HEIC halves the storage of JPG at the same quality, so Apple made it the default. You can switch in Settings → Camera → Formats → Most Compatible — or just convert here when needed."),
            ("Is the photo quality preserved?", "Yes — conversion uses a high-quality setting by default. Add a KB limit only if a form requires one."),
        ],
    },
    "youtube-thumbnail-resize": {
        "title": "YouTube Thumbnail Resize — 1280×720 Under 2 MB, Free",
        "desc": "Resize any image to YouTube's exact thumbnail spec: 1280×720, 16:9, under 2 MB. In-browser and private.",
        "h1": "YouTube thumbnail resizer — 1280×720",
        "sub": "YouTube's exact spec: 1280×720 px (16:9), max 2 MB.",
        "preset": {"id": "youtube-thumbnail", "country": "global", "minKB": None, "maxKB": 2000, "width": 1280, "height": 720, "format": "jpeg"},
        "intro": [
            "YouTube rejects thumbnails over 2 MB and stretches anything that isn't 16:9. This preset crops your image to exactly 1280×720 and fits it under the cap at the best quality — one drop, one download, ready to upload in YouTube Studio.",
        ],
        "faqs": [
            ("JPG or PNG for thumbnails?", "Both work. JPG is smaller; PNG is better for text-heavy thumbnails with flat colors. Switch the output format above if you prefer PNG."),
        ],
    },
    "bangladesh-govt-job-photo": {
        "title": "BD Govt Job Photo & Signature Resize — 300×300 & 300×80 (Teletalk)",
        "desc": "Resize your Bangladesh government job application photo (300×300, ≤100 KB) and signature (300×80, ≤60 KB) to the Teletalk spec. Free & private.",
        "h1": "Bangladesh govt job photo & signature resizer",
        "sub": "The standard Teletalk spec: photo 300×300 px under 100 KB, signature 300×80 px under 60 KB.",
        "preset": {"id": "bd-govt-photo", "country": "bd", "minKB": None, "maxKB": 100, "width": 300, "height": 300, "format": "jpeg"},
        "intro": [
            "Almost every Bangladesh government job application runs through Teletalk's portal, and it enforces the same two files everywhere: a 300×300 photo under 100 KB and a 300×80 signature under 60 KB. Use the preset menu above to switch between them — each comes out exactly to spec.",
        ],
        "faqs": [
            ("Does this work for all BD govt circulars?", "The 300×300 / 300×80 pattern is the Teletalk standard used across ministries and directorates. Always verify your specific circular's annexure."),
        ],
    },
    "jamb-photo-resize": {
        "title": "JAMB Photo Resize — Under 50 KB for Registration, Free & Private",
        "desc": "Compress your JAMB registration passport photo to under 50 KB with a clean white background crop. In-browser and private.",
        "h1": "JAMB registration photo — under 50 KB",
        "sub": "Nigeria's JAMB registration photo spec: JPG under 50 KB, white or light background.",
        "preset": {"id": "jamb-photo", "country": "ng", "minKB": None, "maxKB": 50, "width": None, "height": None, "format": "jpeg"},
        "intro": [
            "JAMB registration rejects oversized photos, and cyber-café queues charge for every retry. Compress your passport photo to under 50 KB here first — free, on your own phone, in seconds. Remember the content rules too: recent photo, white or light background, no caps or glasses. Verify current requirements at jamb.gov.ng.",
        ],
        "faqs": [
            ("Can I use a phone photo?", "Yes — a clear phone photo against a white wall works if it meets JAMB's content rules. This tool handles the file-size side."),
        ],
    },
    "linkedin-photo-resize": {
        "title": "LinkedIn Profile Photo Resize — Sharp 400×400+, Free & Private",
        "desc": "Crop and size your LinkedIn headshot to a crisp square that uploads clean. In-browser, private, free.",
        "h1": "LinkedIn profile photo resizer",
        "sub": "A sharp square headshot at LinkedIn's recommended size — without opening Photoshop.",
        "preset": {"id": "linkedin-photo", "country": "global", "minKB": None, "maxKB": 8000, "width": 800, "height": 800, "format": "jpeg"},
        "intro": [
            "LinkedIn recommends a square photo of at least 400×400 pixels (up to 8 MB). This preset crops to a clean square at 800×800 — sharp on retina screens, small enough to upload instantly. Your headshot is processed on your device and never uploaded to any server.",
        ],
        "faqs": [
            ("Why 800×800 and not 400×400?", "LinkedIn displays photos at various sizes; an 800×800 source stays sharp on high-DPI screens while remaining a small file."),
        ],
    },
}


# ---------- PDF pages ----------
PDF_PAGES = {
    "compress-pdf": {
        "title": "Compress PDF to Any Exact KB Size — Free, Private, In-Browser",
        "desc": "Compress a PDF to the exact KB size an upload form demands — 100 KB, 200 KB, anything. Runs entirely in your browser; documents never uploaded.",
        "h1": "Compress a PDF to the exact size the form demands",
        "sub": "Set the KB limit from your upload form, drop the PDF, download a file that fits — first try.",
        "maxKB": 200,
        "intro": [
            "Scanned documents balloon into multi-megabyte PDFs, and portals cap uploads at a few hundred KB. ExactKB re-renders each page and finds the highest quality that fits your exact limit — no retry loop, no uploading your documents to a stranger's server.",
            "Everything runs in your browser. Certificates, bank statements, ID scans — they never leave your device.",
        ],
        "faqs": [
            ("Will the text still be readable?", "Yes — ExactKB uses the highest quality your KB budget allows. At very tight limits on long documents, expect softer text; the tool warns you if a limit is unreachable."),
            ("Does the text stay selectable?", "No — pages are re-rendered as images to guarantee the size target, which is what upload portals care about. Keep your original for archival."),
            ("How many pages can it handle?", "Up to 60 pages. For bigger files, split the PDF first."),
        ],
    },
    "compress-pdf-to-100kb": {
        "title": "Compress PDF to 100 KB Online — Free, Exact & Private",
        "desc": "Get any PDF under 100 KB for strict upload portals. Exact targeting, in-browser, documents never uploaded.",
        "h1": "Compress a PDF to 100 KB",
        "sub": "For the strictest document-upload limits on government and application portals.",
        "maxKB": 100,
        "intro": [
            "A 100 KB cap usually means a one-or-two-page document — a certificate, a signed form, an ID scan. ExactKB re-renders your pages at the highest quality that fits under 100 KB, entirely on your device.",
        ],
        "faqs": [
            ("My 20-page PDF won't fit under 100 KB. Why?", "100 KB across 20 pages is ~5 KB per page — physically too little for readable text. Split the document or check whether the portal allows multiple uploads."),
        ],
    },
    "compress-pdf-to-200kb": {
        "title": "Compress PDF to 200 KB Online — Free, Exact & Private",
        "desc": "Compress any PDF under 200 KB for tax portals, applications and government uploads. In-browser and private.",
        "h1": "Compress a PDF to 200 KB",
        "sub": "The most common PDF ceiling on tax and application portals.",
        "maxKB": 200,
        "intro": [
            "Income-tax portals, university applications, and visa document checklists love the 200 KB cap. Drop your PDF and get one that fits — your documents are processed on your device and never uploaded.",
        ],
        "faqs": [
            ("Is 200 KB enough for a scanned document?", "Comfortably, for 1–5 pages. Longer scans may come out softer — the tool always uses the best quality your limit allows."),
        ],
    },
    "compress-pdf-to-500kb": {
        "title": "Compress PDF to 500 KB Online — Free, Exact & Private",
        "desc": "Fit any PDF under 500 KB in one step. Exact-size compression in your browser — files never leave your device.",
        "h1": "Compress a PDF to 500 KB",
        "sub": "For portals with a half-megabyte document cap.",
        "maxKB": 500,
        "intro": [
            "500 KB is generous — most scanned documents fit with quality to spare. ExactKB uses your full budget instead of over-compressing, so the result stays crisp while passing the portal's check on the first try.",
        ],
        "faqs": [
            ("Can I compress several PDFs at once?", "Yes — drop multiple files and each is fitted to the same limit."),
        ],
    },
}


def render_pdf(slug, p):
    preset_json = json.dumps({"maxKB": p["maxKB"]})
    intro_html = "\n      ".join(f"<p>{para}</p>" for para in p["intro"])
    faq_html = "\n      ".join(
        f'<p class="faq-q">{html.escape(q)}</p>\n      <p>{a}</p>' for q, a in p["faqs"]
    )
    related = [s for s in PDF_PAGES if s != slug]
    related_html = "\n        ".join(
        f'<a href="../{s}/">{PDF_PAGES[s]["h1"]}</a>' for s in related
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(p["title"])}</title>
  <meta name="description" content="{html.escape(p["desc"])}">
  <link rel="canonical" href="{BASE_URL}/{slug}/">
  <link rel="stylesheet" href="../style.css?v=8">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🎯</text></svg>">
  <meta property="og:title" content="{html.escape(p["title"])}">
  <meta property="og:description" content="{html.escape(p["desc"])}">
  <meta property="og:type" content="website">
</head>
<body>
  <header>
    <div class="wrap header-inner">
      <a class="logo" href="../">Exact<span>KB</span> 🎯</a>
      <div class="trust">100% in your browser — files never leave your device</div>
    </div>
  </header>

  <main class="wrap">
    <section class="hero">
      <h1>{p["h1"]}</h1>
      <p class="sub">{p["sub"]}</p>
      <div class="badges">
        <span class="badge">✓ Exact-size targeting</span>
        <span class="badge">🔒 Never uploaded — private</span>
        <span class="badge">Free, no signup</span>
      </div>
    </section>

    <section class="tool" id="tool">
      <div class="step-label"><span class="n">1</span> Set your limit</div>
      <div class="controls">
        <div class="field full">
          <label for="max-kb">Max size (KB) *</label>
          <input type="number" id="max-kb" min="10" placeholder="e.g. 200" value="{p["maxKB"]}">
        </div>
      </div>

      <div class="step-label"><span class="n">2</span> Add your PDFs</div>
      <div class="drop" id="drop" role="button" tabindex="0" aria-label="Choose or drop PDF files">
        <div class="big">📄</div>
        <div class="main">Drop PDFs here or click to choose</div>
        <div class="hint">Up to 60 pages per file · multiple files OK · nothing is uploaded</div>
      </div>
      <input type="file" id="file-input" accept="application/pdf,.pdf" multiple hidden>
      <div class="queue" id="queue"></div>
      <button class="btn-go" id="go" type="button" disabled>Compress →</button>

      <div id="results-section">
        <h2>Your files</h2>
        <div id="results"></div>
      </div>
    </section>

    <section class="content">
      {intro_html}

      <h2>FAQ</h2>
      {faq_html}
      <p class="faq-q">Is my document uploaded to a server?</p>
      <p>No. The PDF engine runs entirely in your browser — certificates, statements and ID scans never leave your device.</p>

      <h2>More tools</h2>
      <div class="related">
        {related_html}
        <a href="../">Image compressor (photos, signatures) →</a>
      </div>
    </section>
  </main>

  <footer>
    <div class="wrap">
      ExactKB — free exact-size compression · <a href="../">Home</a> · Files are processed on your device and never uploaded. © <span id="year"></span>
    </div>
  </footer>

  <script>window.PDF_PRESET = {preset_json};</script>
  <script src="../pdf-app.js?v=8"></script>
</body>
</html>
"""


def render(slug, p):
    preset_json = json.dumps({k: v for k, v in p["preset"].items()})
    intro_html = "\n      ".join(f"<p>{para}</p>" for para in p["intro"])
    faq_html = "\n      ".join(
        f'<p class="faq-q">{html.escape(q)}</p>\n      <p>{a}</p>' for q, a in p["faqs"]
    )
    related = [s for s in PAGES if s != slug][:8]
    related_html = "\n        ".join(
        f'<a href="../{s}/">{PAGES[s]["h1"]}</a>' for s in related
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(p["title"])}</title>
  <meta name="description" content="{html.escape(p["desc"])}">
  <link rel="canonical" href="{BASE_URL}/{slug}/">
  <link rel="stylesheet" href="../style.css?v=8">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🎯</text></svg>">
  <meta property="og:title" content="{html.escape(p["title"])}">
  <meta property="og:description" content="{html.escape(p["desc"])}">
  <meta property="og:type" content="website">
</head>
<body>
  <header>
    <div class="wrap header-inner">
      <a class="logo" href="../">Exact<span>KB</span> 🎯</a>
      <div class="trust">100% in your browser — files never leave your device</div>
    </div>
  </header>

  <main class="wrap">
    <section class="hero">
      <h1>{p["h1"]}</h1>
      <p class="sub">{p["sub"]}</p>
      <div class="badges">
        <span class="badge">✓ Exact-size targeting</span>
        <span class="badge">🔒 Never uploaded — works offline</span>
        <span class="badge">Free, no signup</span>
      </div>
    </section>

    <section class="tool" id="tool">
      <div class="step-label"><span class="n">1</span> Set your target</div>
      <div class="controls">
        <div class="field">
          <label for="country">Country / region</label>
          <select id="country" aria-label="Country or region"></select>
        </div>
        <div class="field">
          <label for="preset">Preset (portal / document)</label>
          <select id="preset" aria-label="Document preset"></select>
        </div>
        <div class="size-row">
          <div class="field">
            <label for="min-kb">Min size (KB, optional)</label>
            <input type="number" id="min-kb" min="1" placeholder="e.g. 20">
          </div>
          <div class="field">
            <label for="max-kb">Max size (KB) *</label>
            <input type="number" id="max-kb" min="1" placeholder="e.g. 50">
          </div>
          <div class="field">
            <label for="out-width">Width px (optional)</label>
            <input type="number" id="out-width" min="16" placeholder="auto">
          </div>
          <div class="field">
            <label for="out-height">Height px (optional)</label>
            <input type="number" id="out-height" min="16" placeholder="auto">
          </div>
        </div>
        <div class="field">
          <label for="out-format">Output format</label>
          <select id="out-format">
            <option value="jpeg" selected>JPG — universal, smallest for photos</option>
            <option value="webp">WebP — modern, even smaller</option>
            <option value="png">PNG — lossless, best for graphics</option>
          </select>
        </div>
        <p id="preset-note"></p>
      </div>

      <div class="step-label"><span class="n">2</span> Add your files</div>
      <div class="drop" id="drop" role="button" tabindex="0" aria-label="Choose or drop images">
        <div class="big">📸</div>
        <div class="main">Drop images here, paste, or click to choose</div>
        <div class="hint">JPG · PNG · HEIC (iPhone) · WebP · GIF · BMP — multiple files OK · nothing is uploaded</div>
      </div>
      <input type="file" id="file-input" accept="image/*,.heic,.heif,.avif,.svg" multiple hidden>
      <div class="queue" id="queue"></div>
      <button class="btn-go" id="go" type="button" disabled>Compress →</button>

      <div id="results-section">
        <h2>Your files</h2>
        <div id="results"></div>
      </div>
    </section>

    <section class="content">
      {intro_html}

      <h2>How it works</h2>
      <ol>
        <li><strong>Check the target.</strong> This page is preset for the spec above — adjust any number to match your exact form.</li>
        <li><strong>Drop your photo.</strong> ExactKB finds the best quality and dimensions that land inside the size window — including padding files up when a form has a minimum size.</li>
        <li><strong>Download.</strong> The file fits the requirement on the first try.</li>
      </ol>

      <h2>FAQ</h2>
      {faq_html}
      <p class="faq-q">Is my photo uploaded to a server?</p>
      <p>No. ExactKB runs entirely in your browser. Your file never leaves your device — this page even works offline.</p>

      <h2>More tools</h2>
      <div class="related">
        {related_html}
        <a href="../">All presets →</a>
      </div>
    </section>
  </main>

  <footer>
    <div class="wrap">
      <div class="footer-bottom">
        <div>© <span id="year"></span> ExactKB · <a href="../">Home</a> · <a href="../privacy/">Privacy</a> · <a href="../terms/">Terms</a> · Files are processed on your device and never uploaded. Not affiliated with any government agency or portal.</div>
      </div>
    </div>
  </footer>

  <script>window.PAGE_PRESET = {preset_json};</script>
  <script src="../presets.js?v=8"></script>
  <script src="../app.js?v=8"></script>
</body>
</html>
"""


def main():
    urls = [f"{BASE_URL}/"]
    for slug, p in PAGES.items():
        outdir = os.path.join(ROOT, slug)
        os.makedirs(outdir, exist_ok=True)
        with open(os.path.join(outdir, "index.html"), "w") as f:
            f.write(render(slug, p))
        urls.append(f"{BASE_URL}/{slug}/")
    for slug, p in PDF_PAGES.items():
        outdir = os.path.join(ROOT, slug)
        os.makedirs(outdir, exist_ok=True)
        with open(os.path.join(outdir, "index.html"), "w") as f:
            f.write(render_pdf(slug, p))
        urls.append(f"{BASE_URL}/{slug}/")
    # hand-authored tool pages (not generated, but belong in the sitemap)
    urls.append(f"{BASE_URL}/clean-document/")
    with open(os.path.join(ROOT, "sitemap.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            f.write(f"  <url><loc>{u}</loc></url>\n")
        f.write("</urlset>\n")
    with open(os.path.join(ROOT, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nSitemap: {BASE_URL}/sitemap.xml\n")
    print(f"Generated {len(PAGES)} image pages + {len(PDF_PAGES)} PDF pages + sitemap ({len(urls)} URLs)")


if __name__ == "__main__":
    main()
