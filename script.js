function formatTwo(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

let securityUpdateTimer = null;
let lastSecurityHash = "";

/** Cleared once <code>rawInputTokenHash</code> is set (save timer when no longer needed). */
let browserTranslationRawLockIntervalId = null;

/** Real values for fields masked as *** in transcript preview (privacy mode). */
const piiKeyBackup = Object.create(null);

/** Semantic tool version for local compliance audit trail (not auto-bumped). */
const TRANSCRIPT_TOOL_VERSION = "3.0.0-bilingual-en-zh";

function getUiLang() {
  try {
    const v = document.getElementById("lang-select")?.value;
    if (v === "zh") return "zh";
    if (v === "en") return "en";
  } catch (_e) {
    /* ignore */
  }
  return window.__TRANSCRIPT_UI_LANG__ === "zh" ? "zh" : "en";
}

/** Canonical English column names for stable `data-edit-label` keys (transcript thead text may be localized). */
const COURSE_EDIT_HEADER_KEYS_EN = Object.freeze([
  "Course Type",
  "Course Number",
  "Description",
  "Percent",
  "Grade Pt",
  "Grade",
  "Credits",
  "Quality Pts",
]);

const SCALE_CANONICAL_TITLE = "US GPA Policy Scale";

function uiPack() {
  return window.TRANSCRIPT_I18N_PACK?.[getUiLang()] || window.TRANSCRIPT_I18N_PACK?.en || {};
}

/** Sidebar-only label; `data-edit-label` on the transcript remains English for compliance keys. */
function localizedEditorFieldLabel(raw) {
  if (!raw) {
    return "";
  }
  if (getUiLang() === "en") {
    return raw;
  }
  const dict = window.TRANSCRIPT_EDITOR_LABEL?.zh;
  if (dict && dict[raw]) {
    return dict[raw];
  }
  const mTerm = /^Term (\d+) Row (\d+) - (.+)$/.exec(raw);
  if (mTerm) {
    const enHeaders = window.TRANSCRIPT_I18N_PACK?.en?.courseHeaders || [];
    const zhHeaders = window.TRANSCRIPT_I18N_PACK?.zh?.courseHeaders || [];
    const idx = enHeaders.indexOf(mTerm[3]);
    const zhHead = idx >= 0 ? zhHeaders[idx] : mTerm[3];
    return `第 ${mTerm[1]} 学期 第 ${mTerm[2]} 行 — ${zhHead}`;
  }
  const mSi = /^Student Info (\d+)$/.exec(raw);
  if (mSi) {
    return `学生信息 ${mSi[1]}`;
  }
  if (/^US GPA Policy Scale Header (\d+)$/.test(raw)) {
    const m = /^US GPA Policy Scale Header (\d+)$/.exec(raw);
    return `成绩换算表 表头 ${m[1]}`;
  }
  if (/^US GPA Policy Scale Row (\d+) Col (\d+)$/.test(raw)) {
    const m = /^US GPA Policy Scale Row (\d+) Col (\d+)$/.exec(raw);
    return `成绩换算表 第 ${m[1]} 行 第 ${m[2]} 列`;
  }
  return raw;
}

function formatAuditLocalWallClock(ms) {
  try {
    return new Intl.DateTimeFormat(getUiLang() === "zh" ? "zh-CN" : undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(new Date(ms));
  } catch (_e) {
    return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
  }
}

/** Call when transcript integrity fingerprint changes — updates the “layout fingerprint last change” audit line. */
function setLayoutFingerprintEditedAtDisplay(tsMillis) {
  const anchors = window.transcriptToolExportAnchors;
  anchors.lastLayoutEditedAtMs = tsMillis;
  const line = document.getElementById("transcript-last-edited-display");
  if (line) {
    line.textContent = formatAuditLocalWallClock(tsMillis);
  }
}

/** Stamp immediately before transcript HTML is hashed into <code>out</code>; drives the PNG snapshot audit line. */
function setExportSnapshotQueuedAtDisplay(tsMillis) {
  const anchors = window.transcriptToolExportAnchors;
  anchors.lastExportSnapshotQueuedAtMs = tsMillis;
  const line = document.getElementById("transcript-export-snapshot-display");
  if (line) {
    line.textContent = formatAuditLocalWallClock(tsMillis);
  }
}

/** Holds raw-form hash (once), latest transcript HTML hash, audit log hash, last QR payload. Global for export tooling. */
window.transcriptToolExportAnchors = {
  rawInputTokenHash: null,
  lastFinalTranscriptHash: null,
  lastAuditLogHash: null,
  lastQrPayload: null,
  lastLayoutEditedAtMs: null,
  lastExportSnapshotQueuedAtMs: null,
};

/** Column indices in each course row (0-based td order). */
const COURSE_COL_PERCENT = 3;
const COURSE_COL_GRADE_POINT = 4;
const COURSE_COL_GRADE = 5;
const COURSE_COL_CREDITS = 6;
const COURSE_COL_QUALITY = 7;

/**
 * Authoritative percent → letter → grade-point ladder (ascending by minPercent).
 * Lookup rule: clamp score to [0, 100]; if &lt; 60 → F. Else pick the highest rung with score ≥ minPercent
 * (equivalent to each letter covering [minPercent, nextRung.minPercent), top rung through 100).
 * Quality Pts = gradePoint × Credits Earned. Display tables are generated from this array only.
 */
const US_PERCENT_GRADE_LADDER = Object.freeze(
  [
    { minPercent: 60, letter: "D-", gradePoint: 0.7 },
    { minPercent: 63, letter: "D", gradePoint: 1.0 },
    { minPercent: 67, letter: "D+", gradePoint: 1.3 },
    { minPercent: 70, letter: "C-", gradePoint: 1.7 },
    { minPercent: 73, letter: "C", gradePoint: 2.0 },
    { minPercent: 77, letter: "C+", gradePoint: 2.3 },
    { minPercent: 80, letter: "B-", gradePoint: 2.7 },
    { minPercent: 83, letter: "B", gradePoint: 3.0 },
    { minPercent: 87, letter: "B+", gradePoint: 3.3 },
    { minPercent: 90, letter: "A-", gradePoint: 3.7 },
    { minPercent: 93, letter: "A", gradePoint: 4.0 },
    { minPercent: 97, letter: "A+", gradePoint: 4.0 },
  ].sort((a, b) => a.minPercent - b.minPercent)
);

function parseTranscriptNumber(raw) {
  if (raw == null) {
    return NaN;
  }
  const t = String(raw)
    .replace(/\u2212/g, "-")
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  if (t === "") {
    return NaN;
  }
  return parseFloat(t);
}

function resolveUsLetterGradeFromPercent(percent) {
  if (!Number.isFinite(percent)) {
    return { letter: "", gradePoint: 0 };
  }
  let p = percent;
  if (p > 100) {
    p = 100;
  }
  if (p < 0) {
    p = 0;
  }
  if (p < 60) {
    return { letter: "F", gradePoint: 0.0 };
  }
  const rungs = [...US_PERCENT_GRADE_LADDER].sort((a, b) => b.minPercent - a.minPercent);
  for (let i = 0; i < rungs.length; i += 1) {
    const r = rungs[i];
    if (p >= r.minPercent) {
      return { letter: r.letter, gradePoint: r.gradePoint };
    }
  }
  return { letter: "F", gradePoint: 0.0 };
}

/** Rows for reference tables: high score → low, then F. */
function getGradeLadderDisplayRows() {
  const p = uiPack();
  const asc = [...US_PERCENT_GRADE_LADDER];
  const rows = [];
  for (let i = asc.length - 1; i >= 0; i -= 1) {
    const r = asc[i];
    const lo = r.minPercent;
    const hi = i + 1 < asc.length ? asc[i + 1].minPercent - 1 : 100;
    rows.push({
      rangeText: `${lo} – ${hi}`,
      letter: r.letter,
      gradePoint: Number(r.gradePoint).toFixed(1),
    });
  }
  rows.push({
    rangeText: p.below60 || "Below 60",
    letter: "F",
    gradePoint: "0.0",
  });
  return rows;
}

function renderGradeLadderTables() {
  const sbBody = document.querySelector("#grade-ladder-sidebar-tbody");
  const txBody = document.querySelector("#grade-ladder-transcript-tbody");
  const fill = (tbody) => {
    if (!tbody) {
      return;
    }
    tbody.replaceChildren();
    getGradeLadderDisplayRows().forEach(({ rangeText, letter, gradePoint }) => {
      const tr = document.createElement("tr");
      const td0 = document.createElement("td");
      td0.textContent = rangeText;
      const td1 = document.createElement("td");
      td1.textContent = letter;
      const td2 = document.createElement("td");
      td2.textContent = gradePoint;
      tr.appendChild(td0);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    });
  };
  fill(sbBody);
  fill(txBody);
}

/** Dev-time check: ladder boundaries match the published tiers. */
function assertStrictGradeLadderSamples() {
  const samples = [
    [100, "A+", 4.0],
    [97, "A+", 4.0],
    [96.99, "A", 4.0],
    [93, "A", 4.0],
    [92.99, "A-", 3.7],
    [90, "A-", 3.7],
    [89.99, "B+", 3.3],
    [87, "B+", 3.3],
    [86.99, "B", 3.0],
    [60, "D-", 0.7],
    [59.99, "F", 0.0],
  ];
  for (const [p, letter, gp] of samples) {
    const r = resolveUsLetterGradeFromPercent(p);
    if (r.letter !== letter || r.gradePoint !== gp) {
      console.error("[grade ladder] mismatch", { p, expected: { letter, gp }, got: r });
    }
  }
}

/** Derives Grade Pt, Grade, Quality Pts from Percent + Credits (ladder); other course columns unchanged. */
function applyGradeAndQualityFromPercent(row) {
  const cells = Array.from(row.querySelectorAll("td"));
  if (cells.length < 8) {
    return;
  }

  const percentVal = parseTranscriptNumber(cells[COURSE_COL_PERCENT].textContent);
  const creditsVal = parseTranscriptNumber(cells[COURSE_COL_CREDITS].textContent);
  const creditsEarned = Number.isFinite(creditsVal) ? creditsVal : 0;

  if (!Number.isFinite(percentVal)) {
    cells[COURSE_COL_GRADE_POINT].textContent = "";
    cells[COURSE_COL_GRADE_POINT].classList.add("num");
    cells[COURSE_COL_GRADE].textContent = "";
    cells[COURSE_COL_QUALITY].textContent = formatTwo(0);
    row.dataset.hours = formatTwo(creditsEarned);
    row.dataset.quality = formatTwo(0);
    return;
  }

  const { letter, gradePoint } = resolveUsLetterGradeFromPercent(percentVal);
  const qualityPts = creditsEarned * gradePoint;

  cells[COURSE_COL_GRADE_POINT].textContent = Number(gradePoint).toFixed(1);
  cells[COURSE_COL_GRADE_POINT].classList.add("num");
  cells[COURSE_COL_GRADE].textContent = letter;
  cells[COURSE_COL_QUALITY].textContent = formatTwo(qualityPts);
  row.dataset.hours = formatTwo(creditsEarned);
  row.dataset.quality = formatTwo(qualityPts);
}

function generateDocumentId() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  return `TRX-${datePart}-${randomPart}`;
}

function isPrivacyPreviewEnabled() {
  const el = document.getElementById("privacy-preview-toggle");
  return Boolean(el && el.checked);
}

/** Writes user-editable text into <span class="inline-edit-target"> when present; otherwise replaces node text (e.g. table headers). */
function writeEditableSurfaceText(node, value) {
  const v = String(value ?? "");
  const maskSpan = node.querySelector("[data-pii-mask]");
  const piiKey = maskSpan?.dataset?.piiKey;
  if (maskSpan && piiKey) {
    piiKeyBackup[piiKey] = v;
    maskSpan.textContent = isPrivacyPreviewEnabled() ? "***" : v;
    return;
  }
  const surf = node.querySelector(".inline-edit-target");
  if (surf) {
    surf.textContent = v;
    return;
  }
  node.textContent = v;
}

function getEditableNodePlainTextForPayload(node) {
  const surf = node.querySelector(".inline-edit-target");
  if (surf && (node.matches("th") || node.matches("h1") || node.matches("h2"))) {
    return surf.textContent?.trim() || "";
  }
  if (
    surf &&
    node.matches("p") &&
    !node.querySelector("[data-pii-mask]")
  ) {
    return surf.textContent?.trim() || "";
  }
  if (surf && node.matches("span") && node.dataset.editLabel) {
    return surf.textContent?.trim() || "";
  }
  const span = node.querySelector("[data-pii-mask]");
  if (!span) {
    return node.textContent?.trim() || "";
  }
  const k = span.dataset.piiKey;
  const strong = node.querySelector(":scope > strong");
  const val =
    k && piiKeyBackup[k] !== undefined && piiKeyBackup[k] !== null
      ? String(piiKeyBackup[k])
      : span.textContent?.trim() || "";
  if (strong) {
    const lab = strong.textContent?.trim() || "";
    return `${lab} ${val}`.trim();
  }
  return val;
}

function collectIntegrityPayload() {
  const editable = Array.from(document.querySelectorAll("[data-edit-label]"))
    .filter((node) => !node.closest(".term-block-inactive"))
    .map((node) => ({
      label: node.dataset.editLabel || "",
      value: getEditableNodePlainTextForPayload(node),
    }));
  const rows = Array.from(document.querySelectorAll(".term-block:not(.term-block-inactive) tbody tr")).map((row) =>
    Array.from(row.querySelectorAll("td")).map((td) => td.textContent?.trim() || "")
  );
  const docId = document.getElementById("document-id")?.textContent?.trim() || "";
  const ack = document.getElementById("legal-ack")?.checked || false;
  const personalSsn = document.getElementById("personal-ssn-input")?.value?.trim() ?? "";
  const chsiVerifyCode = document.getElementById("chsi-verify-code-input")?.value?.trim() ?? "";
  return JSON.stringify({ docId, ack, editable, rows, personalSsn, chsiVerifyCode });
}

function isSingleTermLayout() {
  const el = document.getElementById("term-layout-mode");
  return Boolean(el && el.value === "one");
}

function getActiveTermBlocks() {
  return Array.from(document.querySelectorAll(".term-block:not(.term-block-inactive)"));
}

/** Hides the second term panel when {@link isSingleTermLayout}; dims Term 2 year (unused). */
function applyTermLayoutMode() {
  const blocks = Array.from(document.querySelectorAll(".term-block"));
  if (blocks.length < 2) {
    return;
  }
  const single = isSingleTermLayout();
  blocks.forEach((block, idx) => {
    if (single && idx === 1) {
      block.classList.add("term-block-inactive");
    } else {
      block.classList.remove("term-block-inactive");
    }
  });
  const year2 = document.getElementById("term-year-2");
  const year2Lbl = document.querySelector('label[for="term-year-2"]');
  if (year2) {
    year2.disabled = single;
    year2.classList.toggle("term-control-muted", single);
  }
  if (year2Lbl) {
    year2Lbl.classList.toggle("term-control-muted", single);
  }
}

function syncTermSelectOptionsForActiveTerms() {
  const termSelect = document.getElementById("term-select");
  if (!termSelect) {
    return;
  }
  const t = uiPack();
  const termWord = t.termWord || "Term";
  const labels = Array.from(document.querySelectorAll(".term-block h2")).map((h2) => {
    const inner = h2.querySelector(".inline-edit-target");
    return ((inner || h2).textContent || "").trim() || termWord;
  });
  if (isSingleTermLayout()) {
    termSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "0";
    opt.textContent = `${termWord} (${labels[0] || t.term1 || "Term 1"})`;
    termSelect.appendChild(opt);
    termSelect.value = "0";
    return;
  }
  while (termSelect.options.length < 2) {
    termSelect.appendChild(document.createElement("option"));
  }
  termSelect.options[0].value = "0";
  termSelect.options[1].value = "1";
  termSelect.options[0].textContent = `${t.term1 || "Term 1"} (${labels[0] || "?"})`;
  termSelect.options[1].textContent = `${t.term2 || "Term 2"} (${labels[1] || "?"})`;
}

function bindTermLayoutMode() {
  const el = document.getElementById("term-layout-mode");
  if (!el) {
    return;
  }
  el.addEventListener("change", () => {
    applyTermLayoutMode();
    syncTermSelectOptionsForActiveTerms();
    refreshEditablePanel();
  });
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexFromBuffer(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Show “script missing” vs “privacy / canvas blocked” help text (never blame file path after a successful draw). */
function updateExportQrFallback({ renderOk } = {}) {
  const wrap = document.getElementById("export-qr-fallback-wrap");
  const libEl = document.getElementById("export-qr-fallback-lib");
  const renderEl = document.getElementById("export-qr-fallback-render");
  if (!wrap || !libEl || !renderEl) {
    return;
  }
  const libMissing = typeof QRCode === "undefined";
  libEl.hidden = !libMissing;
  if (typeof renderOk === "boolean") {
    renderEl.hidden = libMissing || renderOk === true;
  } else {
    renderEl.hidden = true;
  }
  wrap.hidden = libEl.hidden && renderEl.hidden;
}

function normalizeQrHost(host, size) {
  const canvases = [...host.querySelectorAll("canvas")];
  const imgs = [...host.querySelectorAll("img")];
  for (const c of canvases) {
    c.classList.add("export-integrity-qr-surface");
    c.style.boxSizing = "border-box";
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
  }
  for (const im of imgs) {
    im.classList.add("export-integrity-qr-surface");
    im.style.boxSizing = "border-box";
    im.style.width = `${size}px`;
    im.style.height = `${size}px`;
  }
  let visibleImg = imgs.find((im) => {
    const st = getComputedStyle(im);
    return (
      st.display !== "none" &&
      st.visibility !== "hidden" &&
      parseFloat(st.opacity || "1") > 0.05 &&
      Boolean(im.src && im.src.startsWith("data:"))
    );
  });
  if (!visibleImg) {
    visibleImg = imgs.find((im) => im.style.display === "block" && im.src && im.src.startsWith("data:"));
  }
  if (visibleImg) {
    for (const c of canvases) {
      c.style.display = "none";
    }
    visibleImg.style.display = "block";
    visibleImg.style.visibility = "visible";
    return;
  }
  const mainCanvas = canvases[0];
  if (mainCanvas) {
    for (const im of imgs) {
      im.style.display = "none";
    }
    mainCanvas.style.display = "block";
    mainCanvas.style.visibility = "visible";
  }
}

function qrHostLooksPopulated(host, size = 120) {
  const minDim = Math.max(18, Math.floor(size * 0.12));
  for (const img of host.querySelectorAll("img")) {
    const st = getComputedStyle(img);
    if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity || "1") <= 0.05) {
      continue;
    }
    if (!img.src || !img.src.startsWith("data:")) {
      continue;
    }
    if ((img.complete && img.naturalWidth >= minDim && img.naturalHeight >= minDim) || img.offsetWidth >= minDim) {
      return true;
    }
  }
  for (const c of host.querySelectorAll("canvas")) {
    const st = getComputedStyle(c);
    if (st.display === "none" || st.visibility === "hidden") {
      continue;
    }
    /** Require layout width — avoids false success on an empty/bit-unready backing store early in compositing. */
    if (c.width >= minDim && c.height >= minDim && c.offsetWidth >= minDim) {
      return true;
    }
  }
  const tbl = host.querySelector("table");
  if (tbl && tbl.querySelectorAll("td").length >= 64) {
    return true;
  }
  if (host.querySelector('svg.export-integrity-qr-surface[viewBox]')) {
    return true;
  }
  return false;
}

async function waitForQrHost(host, size, maxMs = 520) {
  const t0 = performance.now();
  while (performance.now() - t0 < maxMs) {
    normalizeQrHost(host, size);
    if (qrHostLooksPopulated(host, size)) {
      return true;
    }
    await new Promise((r) => requestAnimationFrame(r));
  }
  normalizeQrHost(host, size);
  return qrHostLooksPopulated(host, size);
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Encode + module layout without relying on canvas readback — works better under strict canvas-hardening.
 * Depends on davidshimjs <code>QRCode</code> internal <code>_oQRCode</code> (<code>getModuleCount</code> / <code>isDark</code>) after <code>makeCode</code>.
 */
function mountSvgQrFromModel(model, targetEl, sizePx, fgHex, bgHex, applyHostBox) {
  if (!model || typeof model.getModuleCount !== "function" || typeof model.isDark !== "function") {
    return false;
  }
  const n = model.getModuleCount();
  if (!Number.isFinite(n) || n < 9) {
    return false;
  }
  const cell = sizePx / n;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${sizePx} ${sizePx}`);
  svg.setAttribute("width", String(sizePx));
  svg.setAttribute("height", String(sizePx));
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("export-integrity-qr-surface");

  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(sizePx));
  bg.setAttribute("height", String(sizePx));
  bg.setAttribute("fill", bgHex);
  svg.appendChild(bg);

  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (model.isDark(row, col)) {
        const r = document.createElementNS(SVG_NS, "rect");
        r.setAttribute("x", String(col * cell));
        r.setAttribute("y", String(row * cell));
        r.setAttribute("width", String(cell));
        r.setAttribute("height", String(cell));
        r.setAttribute("fill", fgHex);
        svg.appendChild(r);
      }
    }
  }

  targetEl.replaceChildren();
  applyHostBox();
  targetEl.appendChild(svg);
  return true;
}

/**
 * Builds matrix in a disposable element; never mounts canvas/table/svg from the library into the transcript host.
 */
/** davidshimjs keeps the matrix on <code>_oQRCode</code>; tolerate minifier renames by scanning keys. */
function extractQrModelFromInstance(qr) {
  if (!qr || typeof qr !== "object") {
    return null;
  }
  /** @type {any} */
  const q = qr;
  if (q._oQRCode && typeof q._oQRCode.getModuleCount === "function") {
    return q._oQRCode;
  }
  const keys = Object.keys(q);
  for (let i = 0; i < keys.length; i += 1) {
    const cand = q[keys[i]];
    if (
      cand &&
      typeof cand === "object" &&
      typeof cand.getModuleCount === "function" &&
      typeof cand.isDark === "function"
    ) {
      return cand;
    }
  }
  return null;
}

function tryQrSvgMatrixFallback(text, targetEl, size, applyHostBox) {
  const levels = [];
  try {
    levels.push(QRCode.CorrectLevel.M);
  } catch (_e) {
    /* ignore */
  }
  try {
    levels.push(QRCode.CorrectLevel.L);
  } catch (_e) {
    /* ignore */
  }
  if (!levels.length) {
    levels.push(undefined);
  }

  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText =
    "position:fixed!important;left:-9999px!important;top:0!important;width:1px!important;height:1px!important;" +
    "opacity:0!important;pointer-events:none!important;overflow:hidden!important;visibility:hidden!important";
  document.body.appendChild(holder);
  try {
    for (let i = 0; i < levels.length; i += 1) {
      holder.replaceChildren();
      const lvl = levels[i];
      try {
        const opts = {
          width: size,
          height: size,
          colorDark: "#111111",
          colorLight: "#ffffff",
        };
        if (lvl !== undefined) {
          opts.correctLevel = lvl;
        }
        const qr = new QRCode(holder, opts);
        qr.makeCode(text);
        const model = extractQrModelFromInstance(qr);
        const ok = mountSvgQrFromModel(model, targetEl, size, "#111111", "#ffffff", applyHostBox);
        if (ok) {
          targetEl.dataset.qrRenderMode = "svg-matrix";
          return true;
        }
      } catch (_e) {
        /* try next level */
      }
    }
    return false;
  } finally {
    holder.remove();
  }
}

/**
 * Renders a QR offline via <code>qrcode.min.js</code>.
 * Prefer <strong>inline</strong> drawing into the host (no <code>toDataURL</code>), for Edge/Chrome balanced privacy / canvas-hardening.
 * Fallback: off-screen render + <code>drawImage</code> copy, then optional data URL <code>img</code>.
 */
async function renderStandardQrToImage(payload, targetEl, size = 120) {
  if (!targetEl || typeof QRCode === "undefined") {
    return false;
  }

  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  const tag = String(targetEl.tagName || "").toUpperCase();
  const blockTag = tag === "DIV" || tag === "SECTION" || tag === "FIGURE";

  const applyHostBox = () => {
    targetEl.style.boxSizing = "border-box";
    targetEl.style.position = "relative";
    targetEl.style.width = `${size}px`;
    targetEl.style.height = `${size}px`;
    targetEl.style.backgroundColor = "#ffffff";
    targetEl.style.backgroundImage = "none";
  };

  async function tryInline() {
    if (!blockTag) {
      return false;
    }
    try {
      targetEl.replaceChildren();
      applyHostBox();
      const qr = new QRCode(targetEl, {
        width: size,
        height: size,
        colorDark: "#111111",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
      qr.makeCode(text);
      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(r));
      });
      await new Promise((r) => setTimeout(r, 0));
      const ok = await waitForQrHost(targetEl, size, 560);
      if (ok) {
        targetEl.dataset.qrRenderMode = "inline";
        await new Promise((r) => requestAnimationFrame(r));
      }
      return ok;
    } catch (_e) {
      return false;
    }
  }

  async function tryOffscreen() {
    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      `width:${size}px`,
      `height:${size}px`,
      "opacity:0",
      "pointer-events:none",
      "overflow:hidden",
      "z-index:-1",
    ].join(";");

    document.body.appendChild(holder);

    try {
      const qr = new QRCode(holder, {
        width: size,
        height: size,
        colorDark: "#111111",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
      qr.makeCode(text);
      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(r));
      });
      await new Promise((r) => setTimeout(r, 0));
      await waitForQrHost(holder, size, 400);

      const sourceCanvas = holder.querySelector("canvas");
      const tableEl = holder.querySelector("table");

      let pngUrl = "";

      /** Lazy <code>toDataURL</code> — some privacy presets block canvas readbacks; skip if draw/copy already succeeds. */
      const ensurePngDataUrl = () => {
        if (pngUrl) {
          return pngUrl;
        }
        if (sourceCanvas && sourceCanvas.width >= 1 && sourceCanvas.height >= 1) {
          try {
            pngUrl = sourceCanvas.toDataURL("image/png");
          } catch (_e) {
            pngUrl = "";
          }
        }
        return pngUrl;
      };

      if (blockTag) {
        targetEl.replaceChildren();
        applyHostBox();

        /** Prefer <code>drawImage</code> before <code>toDataURL</code> (stricter privacy stacks may block readbacks). */
        if (sourceCanvas && sourceCanvas.width >= 1) {
          const out = document.createElement("canvas");
          out.className = "export-integrity-qr-surface";
          out.width = size;
          out.height = size;
          let ctx = null;
          try {
            ctx = out.getContext("2d", { alpha: false, willReadFrequently: false });
          } catch (_e) {
            ctx = null;
          }
          if (!ctx) {
            ctx = out.getContext("2d");
          }
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);
            ctx.imageSmoothingEnabled = false;
            let copiedOk = false;
            try {
              ctx.drawImage(sourceCanvas, 0, 0, size, size);
              copiedOk = true;
            } catch (_e) {
              copiedOk = false;
            }
            if (copiedOk) {
              targetEl.appendChild(out);
              targetEl.dataset.qrRenderMode = "nested-canvas";
              await new Promise((r) => requestAnimationFrame(r));
              return true;
            }
          }
        }

        if (ensurePngDataUrl()) {
          const img = document.createElement("img");
          img.className = "export-integrity-qr-surface";
          img.width = size;
          img.height = size;
          img.alt = "";
          img.decoding = "sync";
          img.loading = "eager";
          img.src = ensurePngDataUrl();
          try {
            await img.decode();
          } catch (_e) {
            /* onload may still paint */
          }
          targetEl.appendChild(img);
          targetEl.dataset.qrRenderMode = "img-dataurl";
          await new Promise((r) => requestAnimationFrame(r));
          return true;
        }

        if (tableEl) {
          const t = tableEl;
          t.classList.add("export-integrity-qr-surface");
          t.style.borderCollapse = "collapse";
          t.style.width = `${size}px`;
          t.style.height = `${size}px`;
          targetEl.appendChild(t);
          targetEl.dataset.qrRenderMode = "table";
          return true;
        }

        return false;
      }

      ensurePngDataUrl();

      if (tag === "CANVAS" && sourceCanvas && sourceCanvas.width >= 1) {
        targetEl.width = size;
        targetEl.height = size;
        const ctx = targetEl.getContext("2d");
        if (!ctx) {
          return false;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false;
        try {
          ctx.drawImage(sourceCanvas, 0, 0, size, size);
        } catch (_e) {
          return false;
        }
        return true;
      }

      if (tag === "IMG" && pngUrl) {
        targetEl.width = size;
        targetEl.height = size;
        targetEl.src = pngUrl;
        return true;
      }

      return false;
    } catch (_err) {
      return false;
    } finally {
      holder.remove();
    }
  }

  if (blockTag && tryQrSvgMatrixFallback(text, targetEl, size, applyHostBox)) {
    return true;
  }
  if (await tryInline()) {
    return true;
  }
  if (await tryOffscreen()) {
    return true;
  }
  if (targetEl && targetEl.dataset) {
    targetEl.dataset.qrRenderMode = "";
  }
  return false;
}

/** Build canonical object from <code>#editor-form</code> inputs (sorted keys → deterministic JSON). */
function collectEditorFormInputMap() {
  const form = document.getElementById("editor-form");
  if (!form) {
    return {};
  }
  const inputs = Array.from(form.querySelectorAll("input"));
  const flat = {};
  inputs.forEach((inp, idx) => {
    const key = inp.id?.trim() || `field_${idx}`;
    flat[key] = inp.value ?? "";
  });
  const sortedKeys = Object.keys(flat).sort();
  const canonical = {};
  sortedKeys.forEach((k) => {
    canonical[k] = flat[k];
  });
  return canonical;
}

/**
 * One-time sidebar form snapshot SHA-256: captured on first export, or when machine translation engages
 * (see {@link tickLockRawOnMachineTranslate}), before DOM rewrites from the translator.
 * Same hash returned on subsequent calls.
 */
async function captureRawInputToken() {
  const anchors = window.transcriptToolExportAnchors;
  if (anchors.rawInputTokenHash) {
    return anchors.rawInputTokenHash;
  }
  const canonical = collectEditorFormInputMap();
  const hash = await sha256Hex(JSON.stringify(canonical));
  anchors.rawInputTokenHash = hash;
  return hash;
}

/** SHA-256 of <code>#transcript-page</code> innerHTML at export time (after sidebar sync applied). */
async function captureFinalTranscriptHash() {
  const el = document.getElementById("transcript-page");
  const anchors = window.transcriptToolExportAnchors;
  if (!el) {
    anchors.lastFinalTranscriptHash = "";
    return "";
  }
  const hash = await sha256Hex(el.innerHTML);
  anchors.lastFinalTranscriptHash = hash;
  return hash;
}

/** SHA-256 of full compliance mirror JSON array from localStorage (<code>'transcript-tool-compliance-log-mirror-v1'</code>). */
async function captureAuditLogHash() {
  const anchors = window.transcriptToolExportAnchors;
  let arr = [];
  try {
    const raw = localStorage.getItem("transcript-tool-compliance-log-mirror-v1");
    arr = JSON.parse(raw || "[]");
  } catch {
    arr = [];
  }
  if (!Array.isArray(arr)) {
    arr = [];
  }
  const hash = await sha256Hex(JSON.stringify(arr));
  anchors.lastAuditLogHash = hash;
  return hash;
}

/**
 * Full export payload (includes one-time <code>raw</code> sidebar snapshot) and draws onto <code>#export-integrity-qr</code>; export path only.
 */
async function generateExportQRPayload() {
  const anchors = window.transcriptToolExportAnchors;
  /** Stamp transcript DOM before <code>out</code> hash so PNG capture, QR payload, and timeline labels stay aligned */
  setExportSnapshotQueuedAtDisplay(Date.now());
  const raw = anchors.rawInputTokenHash || (await captureRawInputToken());
  const [out, audit] = await Promise.all([captureFinalTranscriptHash(), captureAuditLogHash()]);
  const editedAtIso =
    anchors.lastLayoutEditedAtMs != null ? new Date(anchors.lastLayoutEditedAtMs).toISOString() : null;
  const exportedAtIso =
    anchors.lastExportSnapshotQueuedAtMs != null
      ? new Date(anchors.lastExportSnapshotQueuedAtMs).toISOString()
      : new Date().toISOString();
  const payload = {
    act: "transcript_tool_export_v1",
    raw,
    out,
    audit,
    editedAt: editedAtIso,
    exportedAt: exportedAtIso,
    msg: "Session-local integrity tag; not an official certification channel.",
  };
  anchors.lastQrPayload = payload;
  const qrJson = JSON.stringify(payload);
  const imgEl = document.getElementById("export-integrity-qr");
  const ok = imgEl ? await renderStandardQrToImage(qrJson, imgEl, 120) : false;
  updateExportQrFallback({ renderOk: ok });
  return payload;
}

let liveQrDebounceTimer = null;

/**
 * Live-edit preview: QR encodes current <code>innerHTML</code> digest + compliance mirror hash (no sidebar <code>raw</code> until export runs <code>generateExportQRPayload</code>).
 */
async function refreshLiveExportQrPreview() {
  if (typeof QRCode === "undefined") {
    return;
  }
  const host = document.getElementById("export-integrity-qr");
  if (!host) {
    return;
  }
  try {
    const [out, audit] = await Promise.all([captureFinalTranscriptHash(), captureAuditLogHash()]);
    const previewPayload = {
      act: "transcript_tool_live_preview_v1",
      out,
      audit,
      msg: "Live preview; PNG export replaces this with the full binding (includes sidebar snapshot).",
    };
    const ok = await renderStandardQrToImage(JSON.stringify(previewPayload), host, 120);
    updateExportQrFallback({ renderOk: ok });
  } catch (_e) {
    /** Transient hash/async errors: do not flip to “privacy blocked” (avoids false positives). */
    updateExportQrFallback({});
  }
}

function scheduleLiveExportQrPreview() {
  if (typeof QRCode === "undefined") {
    return;
  }
  if (liveQrDebounceTimer) {
    clearTimeout(liveQrDebounceTimer);
  }
  liveQrDebounceTimer = setTimeout(() => {
    liveQrDebounceTimer = null;
    void refreshLiveExportQrPreview();
  }, 650);
}

/* -------------------------------------------------------------------------- */
/* Local compliance audit log (IndexedDB primary, localStorage mirror/fallback) */
/* -------------------------------------------------------------------------- */

const COMPLIANCE_DB_NAME = "transcript-tool-compliance-v1";
const COMPLIANCE_STORE = "events";
const COMPLIANCE_DB_VERSION = 1;
const COMPLIANCE_LS_KEY = "transcript-tool-compliance-log-mirror-v1";
const COMPLIANCE_LS_MAX = 800;

let complianceDbPromise;

function mirrorComplianceToLocalStorage(record) {
  try {
    let arr = [];
    try {
      const raw = localStorage.getItem(COMPLIANCE_LS_KEY);
      arr = JSON.parse(raw || "[]");
    } catch {
      arr = [];
    }
    if (!Array.isArray(arr)) {
      arr = [];
    }
    arr.push(record);
    while (arr.length > COMPLIANCE_LS_MAX) {
      arr.shift();
    }
    localStorage.setItem(COMPLIANCE_LS_KEY, JSON.stringify(arr));
  } catch (_e) {
    /* Quota or private mode — ignore */
  }
}

function getComplianceDb() {
  if (complianceDbPromise !== undefined) {
    return complianceDbPromise;
  }
  if (!window.indexedDB) {
    complianceDbPromise = Promise.resolve(null);
    return complianceDbPromise;
  }
  complianceDbPromise = new Promise((resolve) => {
    const req = indexedDB.open(COMPLIANCE_DB_NAME, COMPLIANCE_DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(COMPLIANCE_STORE)) {
        db.createObjectStore(COMPLIANCE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(COMPLIANCE_STORE)) {
        resolve(null);
        return;
      }
      resolve(db);
    };
  });
  return complianceDbPromise;
}

async function appendComplianceEventToIdb(record) {
  const db = await getComplianceDb();
  if (!db) {
    return;
  }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(COMPLIANCE_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IDB tx error"));
    tx.objectStore(COMPLIANCE_STORE).add(record);
  });
}

/**
 * Append one compliance / traceability event. Always mirrors to localStorage; writes IndexedDB when available.
 * Payload must not contain raw identity fields — use hashes or structural facts only.
 */
async function appendComplianceEvent(type, payload) {
  const record = { ts: Date.now(), type, payload: payload || {} };
  mirrorComplianceToLocalStorage(record);
  try {
    await appendComplianceEventToIdb(record);
  } catch (_e) {
    /* IndexedDB unavailable or failed — mirror already holds a copy */
  }
}

function appendComplianceEventFireAndForget(type, payload) {
  const record = { ts: Date.now(), type, payload: payload || {} };
  mirrorComplianceToLocalStorage(record);
  void appendComplianceEventToIdb(record).catch(() => {});
}

async function logFieldEditComplianceRecord(fieldLabel, beforeText, afterText) {
  const label = fieldLabel || "unknown_field";
  const b = String(beforeText ?? "");
  const a = String(afterText ?? "");
  if (b === a) {
    return;
  }
  const [valueHashBefore, valueHashAfter] = await Promise.all([
    sha256Hex(JSON.stringify({ field: label, v: b })),
    sha256Hex(JSON.stringify({ field: label, v: a })),
  ]);
  await appendComplianceEvent("field_edit", {
    field: label,
    valueHashBefore,
    valueHashAfter,
  });
}

async function initComplianceAuditLog() {
  await appendComplianceEvent("tool_start", {
    toolVersion: TRANSCRIPT_TOOL_VERSION,
    href: (typeof location !== "undefined" && location.pathname) || "",
  });
}

/**
 * Browser translation (Chrome/Google, Edge/Microsoft, common extensions) rewrites DOM heavily.
 * Our tamper-guard MutationObservers compare innerHTML / textContent and would fight the translator
 * in a tight loop and freeze the tab. When this returns true, observers must not restore DOM.
 */
function isBrowserMachineTranslating() {
  const html = document.documentElement;
  const body = document.body;
  if (!html || !body) {
    return false;
  }
  if (
    html.classList.contains("translated-ltr") ||
    html.classList.contains("translated-rtl") ||
    body.classList.contains("translated-ltr") ||
    body.classList.contains("translated-rtl")
  ) {
    return true;
  }
  // Microsoft Edge translator often wraps text nodes with elements carrying _mst* attributes.
  if (document.querySelector("[_msttexthash], [_msthash], [_msthidden]")) {
    return true;
  }
  // Immersive Translate and similar tools mark the DOM while walking/updating nodes.
  if (
    document.querySelector(
      "[data-immersive-translate-walking], [data-immersive-translate-translate], iframe.imt-translated-result"
    )
  ) {
    return true;
  }
  return false;
}

/**
 * While <code>rawInputTokenHash</code> is still empty, detects browser/extension machine translation and
 * runs {@link captureRawInputToken} so export QR “raw” binds to sidebar values before translators rewrite DOM.
 */
function tickLockRawOnMachineTranslate() {
  const anchors = window.transcriptToolExportAnchors;
  if (anchors.rawInputTokenHash) {
    if (browserTranslationRawLockIntervalId != null) {
      window.clearInterval(browserTranslationRawLockIntervalId);
      browserTranslationRawLockIntervalId = null;
    }
    return;
  }
  if (!isBrowserMachineTranslating()) {
    return;
  }
  void captureRawInputToken();
}

function initBrowserTranslationRawLockWatcher() {
  tickLockRawOnMachineTranslate();
  if (browserTranslationRawLockIntervalId != null) {
    return;
  }
  browserTranslationRawLockIntervalId = window.setInterval(tickLockRawOnMachineTranslate, 400);
}

function isSupportedImageFile(file) {
  if (!file) return false;
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const okMime = mime.startsWith("image/");
  const okExt = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".svg", ".tif", ".tiff", ".heic", ".heif"]
    .some((ext) => name.endsWith(ext));
  return okMime || okExt;
}

function showUnsupportedImageAlert(file) {
  const filename = file?.name || "Unknown file";
  const p = uiPack();
  setUploadDiagnostics(
    typeof p.uploadUnsupportedDiag === "function" ? p.uploadUnsupportedDiag(filename) : `Uploads: Unsupported type (${filename}).`,
    "error"
  );
  window.alert(
    typeof p.uploadUnsupportedAlert === "function"
      ? p.uploadUnsupportedAlert(filename)
      : `Cannot read image: ${filename}\nUse PNG, JPG, JPEG, WEBP, BMP, GIF, SVG, or TIFF (HEIC/HEIF varies by browser).`
  );
}

function setUploadDiagnostics(message, level = "neutral") {
  const el = document.getElementById("upload-diagnostics");
  if (!el) {
    return;
  }
  el.textContent = message;
  el.classList.remove("status-neutral", "status-ok", "status-error");
  if (level === "ok") {
    el.classList.add("status-ok");
  } else if (level === "error") {
    el.classList.add("status-error");
  } else {
    el.classList.add("status-neutral");
  }
}

async function updateSecurityArtifacts() {
  const hashEl = document.getElementById("integrity-hash");
  const docIdEl = document.getElementById("document-id");
  if (!hashEl || !docIdEl) {
    return;
  }
  const payload = collectIntegrityPayload();
  const hash = await sha256Hex(payload);
  if (hash !== lastSecurityHash) {
    hashEl.dataset.fullHash = hash;
    hashEl.textContent = hash.slice(0, 16).toUpperCase();
    lastSecurityHash = hash;
    setLayoutFingerprintEditedAtDisplay(Date.now());
  }
  scheduleLiveExportQrPreview();
}

function scheduleSecurityArtifactsUpdate(delayMs = 120) {
  if (securityUpdateTimer) {
    clearTimeout(securityUpdateTimer);
  }
  securityUpdateTimer = setTimeout(() => {
    securityUpdateTimer = null;
    updateSecurityArtifacts();
  }, delayMs);
}

function refreshLegalAckStatusText() {
  const ack = document.getElementById("legal-ack");
  const ackStatus = document.getElementById("ack-status");
  if (!ack || !ackStatus) {
    return;
  }
  const p = uiPack();
  if (ack.checked) {
    ackStatus.textContent = p.ackConfirmed || "Legal acknowledgment: Confirmed";
    ackStatus.style.color = "#0a5d16";
  } else {
    ackStatus.textContent = p.ackPending || "Legal acknowledgment: Pending";
    ackStatus.style.color = "#7a0000";
  }
}

function bindProtectionControls() {
  const regenBtn = document.getElementById("regen-doc-id");
  const docIdEl = document.getElementById("document-id");
  const ack = document.getElementById("legal-ack");
  const ackStatus = document.getElementById("ack-status");
  if (!regenBtn || !docIdEl || !ack || !ackStatus) {
    return;
  }

  const applyAckStatus = () => {
    refreshLegalAckStatusText();
  };

  docIdEl.textContent = generateDocumentId();
  applyAckStatus();

  regenBtn.addEventListener("click", async () => {
    docIdEl.textContent = generateDocumentId();
    await updateSecurityArtifacts();
  });

  ack.addEventListener("change", async () => {
    applyAckStatus();
    appendComplianceEventFireAndForget("legal_acknowledgment", { acknowledged: Boolean(ack.checked) });
    await updateSecurityArtifacts();
  });
}

function registerAutoEditableCells() {
  const termBlocks = Array.from(document.querySelectorAll(".term-block"));
  termBlocks.forEach((block, termIdx) => {
    const termSlot = `Term ${termIdx + 1}`;

    block.querySelectorAll("thead th").forEach((th) => {
      // Standard transcript column titles are regulatory; lock them out of the side editor/export sync.
      th.dataset.protected = "true";
      delete th.dataset.editLabel;
    });

    Array.from(block.querySelectorAll("tbody tr")).forEach((row, rowIdx) => {
      Array.from(row.querySelectorAll("td")).forEach((cell, colIdx) => {
        if (colIdx === COURSE_COL_GRADE_POINT || colIdx === COURSE_COL_GRADE || colIdx === COURSE_COL_QUALITY) {
          cell.dataset.computed = "true";
          delete cell.dataset.editLabel;
          return;
        }
        if (!cell.dataset.editLabel) {
          const headerName = COURSE_EDIT_HEADER_KEYS_EN[colIdx] || `Column ${colIdx + 1}`;
          cell.dataset.editLabel = `${termSlot} Row ${rowIdx + 1} - ${headerName}`;
        }
      });
    });
  });

  document.querySelectorAll(".student-box p").forEach((p, idx) => {
    if (!p.dataset.editLabel) {
      p.dataset.editLabel = `Student Info ${idx + 1}`;
    }
  });

  const scale = document.getElementById("gpa-policy-scale");
  if (scale && scale.dataset.protected !== "true") {
    const scaleTitle = SCALE_CANONICAL_TITLE;
    scale.querySelectorAll("thead th").forEach((th, idx) => {
      if (!th.dataset.editLabel) {
        th.dataset.editLabel = `${scaleTitle} Header ${idx + 1}`;
      }
    });
    scale.querySelectorAll("tbody tr").forEach((tr, rowIdx) => {
      tr.querySelectorAll("td").forEach((td, colIdx) => {
        if (!td.dataset.editLabel) {
          td.dataset.editLabel = `${scaleTitle} Row ${rowIdx + 1} Col ${colIdx + 1}`;
        }
      });
    });
  }
}

function buildEditor() {
  const form = document.getElementById("editor-form");
  if (!form) {
    return;
  }
  form.innerHTML = "";

  const editableNodes = Array.from(document.querySelectorAll("[data-edit-label]")).filter(
    (node) =>
      node.dataset.protected !== "true" &&
      node.dataset.computed !== "true" &&
      !node.closest(".term-block-inactive")
  );
  editableNodes.forEach((node, idx) => {
    const field = document.createElement("div");
    field.className = "editor-field";

    const label = document.createElement("label");
    const input = document.createElement("input");
    const id = `field-${idx + 1}`;
    label.setAttribute("for", id);
    label.textContent = localizedEditorFieldLabel(node.dataset.editLabel);
    input.id = id;

    const maskSpan = node.querySelector("[data-pii-mask]");
    const piiKey = maskSpan?.dataset?.piiKey;

    if (maskSpan && piiKey) {
      let initial = piiKeyBackup[piiKey];
      if (initial === undefined || initial === null) {
        const shown = maskSpan.textContent.trim();
        initial = shown === "***" ? "" : shown;
        piiKeyBackup[piiKey] = initial;
      }
      input.value = String(initial);
    } else {
      const surf = node.querySelector(".inline-edit-target");
      input.value = surf ? surf.textContent.trim() : node.textContent.trim();
    }

    let complianceDebounceTimer = null;
    input.addEventListener("focusin", () => {
      input.dataset.complianceEditBaseline = input.value;
    });
    input.addEventListener("input", () => {
      const v = input.value;
      if (maskSpan && piiKey) {
        piiKeyBackup[piiKey] = v;
        maskSpan.textContent = isPrivacyPreviewEnabled() ? "***" : v;
      } else {
        writeEditableSurfaceText(node, v);
      }

      const row = node.closest("tr");
      if (row && row.closest(".term-block")) {
        applyGradeAndQualityFromPercent(row);
        fillTermTotals();
      }
      scheduleSecurityArtifactsUpdate();

      const baseline = input.dataset.complianceEditBaseline ?? "";
      clearTimeout(complianceDebounceTimer);
      complianceDebounceTimer = setTimeout(() => {
        const after = input.value;
        if (baseline !== after) {
          void logFieldEditComplianceRecord(node.dataset.editLabel || "", baseline, after);
          input.dataset.complianceEditBaseline = after;
        }
      }, 800);
    });

    field.appendChild(label);
    field.appendChild(input);
    form.appendChild(field);
  });
}

function refreshEditablePanel() {
  registerAutoEditableCells();
  buildEditor();
  fillTermTotals();
  scheduleSecurityArtifactsUpdate();
}

/**
 * Re-applies sidebar #editor-form values onto #transcript-page editable nodes so the PNG
 * matches the strings in the form (intended English). Mitigates machine-translation extensions
 * rewriting the transcript DOM before html2canvas.
 */
/**
 * @param {boolean} [forceUnmaskedForExport] When true (PNG path), write real PII from the form even if the privacy toggle is still checked — must run after applyPrivacyPreviewToTranscript(false).
 */
function syncTranscriptTextFromSideEditorForExport(forceUnmaskedForExport = false) {
  const transcriptPage = document.getElementById("transcript-page");
  if (!transcriptPage) {
    return;
  }
  const editableNodes = Array.from(document.querySelectorAll("[data-edit-label]")).filter(
    (node) =>
      node.dataset.protected !== "true" &&
      node.dataset.computed !== "true" &&
      !node.closest(".term-block-inactive")
  );
  const inputs = Array.from(document.querySelectorAll("#editor-form input"));
  if (editableNodes.length === 0 || editableNodes.length !== inputs.length) {
    return;
  }
  for (let idx = 0; idx < editableNodes.length; idx++) {
    const node = editableNodes[idx];
    const input = inputs[idx];
    const v = input.value;
    const maskSpan = node.querySelector("[data-pii-mask]");
    const piiKey = maskSpan?.dataset?.piiKey;
    if (maskSpan && piiKey) {
      piiKeyBackup[piiKey] = v;
      const showMasked = !forceUnmaskedForExport && isPrivacyPreviewEnabled();
      maskSpan.textContent = showMasked ? "***" : v;
    } else {
      writeEditableSurfaceText(node, v);
    }
    const row = node.closest("tr");
    if (row && row.closest(".term-block")) {
      applyGradeAndQualityFromPercent(row);
    }
  }
  fillTermTotals();
  syncPersonalSsnDisplay(forceUnmaskedForExport);
  scheduleSecurityArtifactsUpdate(0);
}

function createBlankRow() {
  const row = document.createElement("tr");
  row.dataset.hours = "3.00";
  row.dataset.quality = "9.00";
  const nc = uiPack().newCourse || "New Course";
  row.innerHTML = `
    <td>SUBJ</td>
    <td>0000</td>
    <td></td>
    <td class="num">85</td>
    <td class="num">3.0</td>
    <td>B</td>
    <td class="num">3.00</td>
    <td class="num">9.00</td>
  `;
  const descCell = row.querySelectorAll("td")[2];
  if (descCell) {
    descCell.textContent = nc;
  }
  return row;
}

function bindCourseRowControls() {
  const addBtn = document.getElementById("add-course-row");
  const removeBtn = document.getElementById("remove-course-row");
  const termSelect = document.getElementById("term-select");
  if (!addBtn || !removeBtn || !termSelect) {
    return;
  }

  addBtn.addEventListener("click", () => {
    const blocks = getActiveTermBlocks();
    if (blocks.length === 0) {
      return;
    }
    const block = blocks[Number(termSelect.value)] || blocks[0];
    const tbody = block.querySelector("tbody");
    if (!tbody) {
      return;
    }
    tbody.appendChild(createBlankRow());
    refreshEditablePanel();
  });

  removeBtn.addEventListener("click", () => {
    const blocks = getActiveTermBlocks();
    if (blocks.length === 0) {
      return;
    }
    const block = blocks[Number(termSelect.value)] || blocks[0];
    const tbody = block.querySelector("tbody");
    if (!tbody || tbody.rows.length === 0) {
      return;
    }
    tbody.removeChild(tbody.lastElementChild);
    refreshEditablePanel();
  });
}

function bindPhotoUpload() {
  const fileInput = document.getElementById("photo-upload");
  const photo = document.getElementById("student-photo-preview");
  const placeholder = document.getElementById("photo-placeholder");
  if (!fileInput || !photo || !placeholder) {
    return;
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      return;
    }
    if (!isSupportedImageFile(file)) {
      showUnsupportedImageAlert(file);
      fileInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      photo.src = String(reader.result || "");
      photo.style.display = "block";
      placeholder.style.display = "none";
      setUploadDiagnostics(
        typeof uiPack().uploadPhotoOk === "function" ? uiPack().uploadPhotoOk(file.name) : `Uploads: Student photo loaded (${file.name}).`,
        "ok"
      );
      scheduleSecurityArtifactsUpdate();
    };
    reader.onerror = () => {
      setUploadDiagnostics(
        typeof uiPack().uploadPhotoFail === "function" ? uiPack().uploadPhotoFail(file.name) : `Uploads: Student photo read failed (${file.name}).`,
        "error"
      );
    };
    reader.readAsDataURL(file);
  });
}

function bindLogoUpload() {
  const fileInput = document.getElementById("logo-upload");
  const logo = document.getElementById("logo-preview");
  const placeholder = document.getElementById("logo-placeholder");
  if (!fileInput || !logo || !placeholder) {
    return;
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      return;
    }
    if (!isSupportedImageFile(file)) {
      showUnsupportedImageAlert(file);
      fileInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      logo.src = String(reader.result || "");
      logo.style.display = "block";
      placeholder.style.display = "none";
      logo.closest(".logo-box")?.classList.add("logo-box-has-image");
      setUploadDiagnostics(
        typeof uiPack().uploadLogoOk === "function" ? uiPack().uploadLogoOk(file.name) : `Uploads: Institution logo loaded (${file.name}).`,
        "ok"
      );
      scheduleSecurityArtifactsUpdate();
    };
    reader.onerror = () => {
      setUploadDiagnostics(
        typeof uiPack().uploadLogoFail === "function" ? uiPack().uploadLogoFail(file.name) : `Uploads: Institution logo read failed (${file.name}).`,
        "error"
      );
    };
    reader.readAsDataURL(file);
  });
}

function bindCenterWatermarkUpload() {
  const fileInput = document.getElementById("center-watermark-upload");
  const watermark = document.getElementById("center-watermark-preview");
  if (!fileInput || !watermark) {
    return;
  }

  const toWatermarkDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const rawReader = new FileReader();
      rawReader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(String(rawReader.result || ""));
            return;
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 8) {
              continue;
            }
            const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
            const stampTone = Math.max(52, Math.min(142, gray - 18));
            const boostedAlpha = Math.max(118, Math.min(218, Math.round(a * 0.86)));

            data[i] = stampTone;
            data[i + 1] = stampTone;
            data[i + 2] = stampTone;
            data[i + 3] = boostedAlpha;
          }

          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error("Failed to decode emblem image."));
        img.src = String(rawReader.result || "");
      };
      rawReader.onerror = () => reject(new Error("Failed to read emblem file."));
      rawReader.readAsDataURL(file);
    });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      return;
    }
    if (!isSupportedImageFile(file)) {
      showUnsupportedImageAlert(file);
      fileInput.value = "";
      return;
    }
    toWatermarkDataUrl(file)
      .then((watermarkUrl) => {
        watermark.src = watermarkUrl;
        watermark.style.display = "block";
        watermark.style.opacity = "0.44";
        setUploadDiagnostics(
          typeof uiPack().uploadWmOk === "function" ? uiPack().uploadWmOk(file.name) : `Uploads: Center watermark loaded (${file.name}).`,
          "ok"
        );
        scheduleSecurityArtifactsUpdate();
      })
      .catch(() => {
        const fallbackReader = new FileReader();
        fallbackReader.onload = () => {
          watermark.src = String(fallbackReader.result || "");
          watermark.style.display = "block";
          watermark.style.opacity = "0.44";
          setUploadDiagnostics(
            typeof uiPack().uploadWmFallback === "function"
              ? uiPack().uploadWmFallback(file.name)
              : `Uploads: Center watermark loaded (fallback) (${file.name}).`,
            "ok"
          );
          scheduleSecurityArtifactsUpdate();
        };
        fallbackReader.onerror = () => {
          setUploadDiagnostics(
            typeof uiPack().uploadWmFail === "function" ? uiPack().uploadWmFail(file.name) : `Uploads: Center watermark processing failed (${file.name}).`,
            "error"
          );
        };
        fallbackReader.readAsDataURL(file);
      });
  });
}

function bindTermSeasonControls() {
  const orderEl = document.getElementById("term-order");
  const year1El = document.getElementById("term-year-1");
  const year2El = document.getElementById("term-year-2");
  const termTitles = Array.from(document.querySelectorAll(".term-block h2"));
  const termSelect = document.getElementById("term-select");
  if (!orderEl || !year1El || !year2El || termTitles.length < 2 || !termSelect) {
    return;
  }

  const now = new Date();
  year1El.value = String(now.getFullYear());
  year2El.value = String(now.getFullYear() - 1);

  const reorderTermBlocksDom = (order) => {
    const fallBlock = document.querySelector('.term-block[data-semester-kind="fall"]');
    const springBlock = document.querySelector('.term-block[data-semester-kind="spring"]');
    if (!fallBlock || !springBlock || fallBlock === springBlock) {
      return;
    }
    const parent = fallBlock.parentNode;
    if (!parent) {
      return;
    }
    if (order === "fall-spring") {
      parent.insertBefore(fallBlock, springBlock);
    } else {
      parent.insertBefore(springBlock, fallBlock);
    }
  };

  const applyTermTitles = () => {
    const y1 = parseInt(year1El.value, 10) || now.getFullYear();
    const y2 = parseInt(year2El.value, 10) || now.getFullYear() - 1;
    const order = orderEl.value;
    reorderTermBlocksDom(order);
    const titles = Array.from(document.querySelectorAll(".term-block h2"));
    if (titles.length < 2) {
      return;
    }
    const pack = uiPack();
    const t1 = order === "fall-spring" ? `${pack.fall} ${y1}` : `${pack.spring} ${y1}`;
    const t2 = order === "fall-spring" ? `${pack.spring} ${y2}` : `${pack.fall} ${y2}`;
    const setTermHeading = (h2, text) => {
      const surf = h2.querySelector(".inline-edit-target");
      if (surf) {
        surf.textContent = text;
      } else {
        h2.textContent = text;
      }
    };
    setTermHeading(titles[0], t1);
    setTermHeading(titles[1], t2);
    applyTermLayoutMode();
    syncTermSelectOptionsForActiveTerms();
    refreshEditablePanel();
  };

  orderEl.addEventListener("change", applyTermTitles);
  year1El.addEventListener("input", applyTermTitles);
  year2El.addEventListener("input", applyTermTitles);
  applyTermTitles();
  /** Re-run after UI language change; `fall`/`spring` labels come from {@link uiPack} and were previously stuck in the prior language. */
  window.transcriptToolRefreshTermSeasonHeadings = applyTermTitles;
}

function lockPlainTextNode(node, expectedTrimmed) {
  if (!node) {
    return;
  }
  if (node._plainLockTeardown) {
    node._plainLockTeardown();
    node._plainLockTeardown = null;
  }
  node.textContent = expectedTrimmed;
  node.dataset.protected = "true";
  delete node.dataset.editLabel;
  let restoring = false;
  const obs = new MutationObserver(() => {
    if (restoring || isBrowserMachineTranslating()) {
      return;
    }
    if ((node.textContent || "").trim() !== expectedTrimmed) {
      restoring = true;
      node.textContent = expectedTrimmed;
      restoring = false;
    }
  });
  obs.observe(node, { childList: true, characterData: true, subtree: true });
  node._plainLockTeardown = () => {
    obs.disconnect();
    node._plainLockTeardown = null;
  };
}

function bindProtectedAuthorizationAndFooter() {
  const t = uiPack();
  lockPlainTextNode(document.getElementById("university-seal"), t.universitySeal);
  lockPlainTextNode(document.getElementById("authorization-title"), t.authTitle);
  lockPlainTextNode(document.getElementById("authorization-text"), t.authText);
  lockPlainTextNode(document.getElementById("transcript-end-note"), t.footerNote);
  lockPlainTextNode(document.getElementById("personal-ssn-label"), t.personalSsnLabel);
}

/**
 * @param {boolean} [forceUnmaskedForExport] When true, show the real digit string on the transcript for PNG capture while the sidebar privacy toggle may still be on.
 */
function syncPersonalSsnDisplay(forceUnmaskedForExport = false) {
  const input = document.getElementById("personal-ssn-input");
  const display = document.getElementById("personal-ssn-display");
  if (!input || !display) {
    return;
  }
  piiKeyBackup.personalSsn = input.value;
  const showMasked = !forceUnmaskedForExport && isPrivacyPreviewEnabled();
  display.textContent = showMasked ? "***" : input.value;
}

function applyPrivacyPreviewToTranscript(enabled) {
  const page = document.getElementById("transcript-page");
  if (!page) {
    return;
  }
  if (enabled) {
    document.querySelectorAll("#transcript-page [data-pii-mask]").forEach((el) => {
      const k = el.dataset.piiKey;
      if (!k) {
        return;
      }
      const cur = el.textContent;
      if (cur !== "***") {
        piiKeyBackup[k] = cur;
      }
      el.textContent = "***";
    });
    const ssnIn = document.getElementById("personal-ssn-input");
    if (ssnIn) {
      piiKeyBackup.personalSsn = ssnIn.value;
    }
    syncPersonalSsnDisplay();
  } else {
    document.querySelectorAll("#transcript-page [data-pii-mask]").forEach((el) => {
      const k = el.dataset.piiKey;
      if (!k) {
        return;
      }
      el.textContent = piiKeyBackup[k] ?? "";
    });
    syncPersonalSsnDisplay();
  }
  page.classList.toggle("privacy-preview-active", enabled);
}

function bindPrivacyPreviewControls() {
  const toggle = document.getElementById("privacy-preview-toggle");
  if (!toggle) {
    return;
  }
  toggle.addEventListener("change", () => {
    applyPrivacyPreviewToTranscript(toggle.checked);
    refreshEditablePanel();
  });
}

function bindPersonalSsnInput() {
  const el = document.getElementById("personal-ssn-input");
  if (!el) {
    return;
  }
  let ssnAuditTimer = null;
  const sanitizeTo18Digits = () => {
    const digits = el.value.replace(/\D/g, "").slice(0, 18);
    if (digits !== el.value) {
      el.value = digits;
    }
  };
  el.addEventListener("focusin", () => {
    el.dataset.complianceSsnBaseline = el.value;
  });
  const onChange = () => {
    sanitizeTo18Digits();
    syncPersonalSsnDisplay();
    scheduleSecurityArtifactsUpdate();
    const baseline = el.dataset.complianceSsnBaseline ?? "";
    clearTimeout(ssnAuditTimer);
    ssnAuditTimer = setTimeout(() => {
      const after = el.value;
      if (baseline !== after) {
        void logFieldEditComplianceRecord("Government ID (18-digit) (sidebar)", baseline, after);
        el.dataset.complianceSsnBaseline = after;
      }
    }, 800);
  };
  el.addEventListener("input", onChange);
  sanitizeTo18Digits();
  syncPersonalSsnDisplay();
}

/** Sync sidebar CHSI online verification code into the transcript security-audit block. */
function syncChsiVerifyCodeToTranscript() {
  const inp = document.getElementById("chsi-verify-code-input");
  const out = document.getElementById("chsi-verify-code-display");
  if (!out) {
    return;
  }
  const v = (inp?.value ?? "").trim();
  const p = uiPack();
  out.textContent = v || p.chsiEmpty || "Not provided";
}

function bindChsiVerifyCodeInput() {
  const el = document.getElementById("chsi-verify-code-input");
  if (!el) {
    return;
  }
  const onInput = () => {
    syncChsiVerifyCodeToTranscript();
    scheduleSecurityArtifactsUpdate();
  };
  el.addEventListener("input", onInput);
  syncChsiVerifyCodeToTranscript();
}

function bindProtectedStaticZonesGuard() {
  if (typeof window.__transcriptGuardTeardown === "function") {
    try {
      window.__transcriptGuardTeardown();
    } finally {
      window.__transcriptGuardTeardown = null;
    }
  }
  const protectedScale = document.getElementById("gpa-policy-scale");
  const securityAudit = document.querySelector(".security-audit");
  const transcriptPage = document.getElementById("transcript-page");
  const certification = document.querySelector(".certification");
  const perimeterWarning = document.getElementById("perimeter-warning");
  const tamperWarningLine = document.getElementById("tamper-warning-line");
  const legalConfirmationLine = document.getElementById("legal-confirmation-line");
  if (!protectedScale || !securityAudit || !transcriptPage || !certification || !perimeterWarning || !tamperWarningLine || !legalConfirmationLine) {
    return;
  }

  const disposers = [];

  const lockedScaleHtml = protectedScale.innerHTML;
  const lockedPerimeterWarningText = (perimeterWarning.textContent || "").trim();
  const lockedTamperWarningText = (tamperWarningLine.textContent || "").trim();
  const lockedLegalConfirmationText = (legalConfirmationLine.textContent || "").trim();
  let restoring = false;

  const noteIds = ["conversion-note-1", "conversion-note-2", "conversion-note-3"];
  const lockedNotes = noteIds.map((id) => {
    const el = document.getElementById(id);
    return { id, text: el ? el.textContent : "" };
  });

  const scaleObserver = new MutationObserver(() => {
    if (restoring || isBrowserMachineTranslating()) {
      return;
    }
    if (protectedScale.innerHTML !== lockedScaleHtml) {
      restoring = true;
      protectedScale.innerHTML = lockedScaleHtml;
      restoring = false;
    }
  });
  scaleObserver.observe(protectedScale, { childList: true, characterData: true, subtree: true });
  disposers.push(() => scaleObserver.disconnect());

  const notesObserver = new MutationObserver(() => {
    if (restoring || isBrowserMachineTranslating()) {
      return;
    }
    lockedNotes.forEach(({ id, text }) => {
      const node = document.getElementById(id);
      if (node && (node.textContent || "").trim() !== (text || "").trim()) {
        restoring = true;
        node.textContent = text;
        restoring = false;
      }
    });
  });
  notesObserver.observe(protectedScale, { childList: true, characterData: true, subtree: true });
  disposers.push(() => notesObserver.disconnect());

  const runStructuralRestore = () => {
    if (restoring || isBrowserMachineTranslating()) {
      return;
    }
    const currentPerimeter = document.getElementById("perimeter-warning");
    if (!currentPerimeter) {
      restoring = true;
      const restored = document.createElement("section");
      restored.className = "perimeter-warning";
      restored.id = "perimeter-warning";
      restored.dataset.editLabel = "Perimeter Warning";
      restored.dataset.protected = "true";
      restored.textContent = lockedPerimeterWarningText || "";
      transcriptPage.insertBefore(restored, securityAudit);
      restoring = false;
    } else if ((currentPerimeter.textContent || "").trim() !== lockedPerimeterWarningText) {
      restoring = true;
      currentPerimeter.textContent = lockedPerimeterWarningText || "";
      restoring = false;
    }

    const currentTamper = document.getElementById("tamper-warning-line");
    if (!currentTamper) {
      restoring = true;
      const restored = document.createElement("p");
      restored.className = "warning-line notranslate";
      restored.id = "tamper-warning-line";
      restored.dataset.editLabel = "Tamper Warning";
      restored.dataset.protected = "true";
      restored.setAttribute("translate", "no");
      restored.textContent = lockedTamperWarningText || "";
      certification.insertBefore(restored, certification.firstElementChild);
      restoring = false;
    } else if ((currentTamper.textContent || "").trim() !== lockedTamperWarningText) {
      restoring = true;
      currentTamper.textContent = lockedTamperWarningText || "";
      restoring = false;
    }

    const currentLegal = document.getElementById("legal-confirmation-line");
    if (!currentLegal) {
      restoring = true;
      const restored = document.createElement("p");
      restored.className = "sample-line notranslate";
      restored.id = "legal-confirmation-line";
      restored.dataset.editLabel = "Legal Confirmation";
      restored.dataset.protected = "true";
      restored.setAttribute("translate", "no");
      restored.textContent = lockedLegalConfirmationText || "";
      const insertAfter = document.getElementById("tamper-warning-line");
      if (insertAfter && insertAfter.parentNode === certification) {
        certification.insertBefore(restored, insertAfter.nextSibling);
      } else {
        certification.insertBefore(restored, certification.firstElementChild);
      }
      restoring = false;
    } else if ((currentLegal.textContent || "").trim() !== lockedLegalConfirmationText) {
      restoring = true;
      currentLegal.textContent = lockedLegalConfirmationText || "";
      restoring = false;
    }
  };

  // Only direct child-list changes (e.g. section removed). Subtree on the whole transcript
  // would fire for every translated cell and stall the page.
  const fixedBlockObserverPage = new MutationObserver(() => runStructuralRestore());
  fixedBlockObserverPage.observe(transcriptPage, { childList: true });
  disposers.push(() => fixedBlockObserverPage.disconnect());
  const fixedBlockObserverCert = new MutationObserver(() => runStructuralRestore());
  fixedBlockObserverCert.observe(certification, { childList: true });
  disposers.push(() => fixedBlockObserverCert.disconnect());

  // Narrow text tamper watches to specific nodes to avoid whole-page observer overhead.
  const observeTextLock = (target, expectedText) => {
    const obs = new MutationObserver(() => {
      if (restoring || isBrowserMachineTranslating()) {
        return;
      }
      if ((target.textContent || "").trim() !== expectedText) {
        restoring = true;
        target.textContent = expectedText;
        restoring = false;
      }
    });
    obs.observe(target, { childList: true, characterData: true, subtree: true });
    disposers.push(() => obs.disconnect());
  };
  observeTextLock(perimeterWarning, lockedPerimeterWarningText);
  observeTextLock(tamperWarningLine, lockedTamperWarningText);
  observeTextLock(legalConfirmationLine, lockedLegalConfirmationText);

  window.__transcriptGuardTeardown = () => {
    disposers.forEach((fn) => {
      try {
        fn();
      } catch (_e) {
        /* ignore */
      }
    });
  };
}

/** Public UTC time service; called during export only, alongside local clock lines. */
const TRUSTED_TIMESTAMP_API_URL = "https://worldtimeapi.org/api/timezone/Etc/UTC";

/**
 * Request current UTC time from a public API and write it to #trusted-timestamp.
 * On failure, show an offline hint; does not replace local clock records.
 */
async function fetchTrustedTimestamp() {
  const el = document.getElementById("trusted-timestamp");
  if (!el) {
    return;
  }
  const p = uiPack();
  el.textContent = p.utcFetching || "Fetching UTC…";
  try {
    const res = await fetch(TRUSTED_TIMESTAMP_API_URL, { cache: "no-store", mode: "cors" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const utcStr =
      (typeof data.utc_datetime === "string" && data.utc_datetime) ||
      (typeof data.datetime === "string" && data.datetime) ||
      (data.unixtime != null && Number.isFinite(Number(data.unixtime))
        ? new Date(Number(data.unixtime) * 1000).toISOString()
        : "");
    if (!utcStr) {
      throw new Error("empty time");
    }
    el.textContent = utcStr;
  } catch (_e) {
    el.textContent = p.utcOffline || "UTC unavailable (offline)";
  }
}

function bindExportPng() {
  const btn = document.getElementById("export-png");
  const status = document.getElementById("export-status");
  const target = document.getElementById("transcript-page");
  if (!btn || !status || !target) {
    return;
  }

  const doExport = async () => {
    const p = uiPack();
    if (typeof window.html2canvas !== "function") {
      status.textContent = p.exportFailCanvas || "Export failed: html2canvas not loaded";
      status.style.color = "#7a0000";
      appendComplianceEventFireAndForget("export_png_failure", { reason: "html2canvas_not_loaded" });
      return;
    }

    const blurWasOn = isPrivacyPreviewEnabled();

    try {
      if (blurWasOn) {
        applyPrivacyPreviewToTranscript(false);
      }
      await captureRawInputToken();
      syncTranscriptTextFromSideEditorForExport(true);
      syncChsiVerifyCodeToTranscript();
      await generateExportQRPayload();
      await fetchTrustedTimestamp();
      status.textContent = p.exportRendering || "Export: Rendering PNG…";
      status.style.color = "#3b3b3b";
      const canvas = await window.html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        throw new Error("Failed to encode PNG blob");
      }
      const exportHashEl = document.getElementById("export-file-hash");
      let exportPngSha256 = "";
      if (exportHashEl) {
        const bytes = await blob.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        exportPngSha256 = hexFromBuffer(digest);
        exportHashEl.textContent = exportPngSha256.slice(0, 24).toUpperCase();
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const docId = document.getElementById("document-id")?.textContent?.trim() || "transcript";
      link.href = url;
      link.download = `${docId}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent =
        typeof p.exportComplete === "function" ? p.exportComplete(docId) : `Export: Complete (${docId}.png)`;
      status.style.color = "#0a5d16";
      if (exportPngSha256) {
        void (async () => {
          const docIdHash = (await sha256Hex(JSON.stringify({ docId }))).slice(0, 40);
          await appendComplianceEvent("export_png_success", {
            exportFileSha256: exportPngSha256,
            docIdHash,
          });
        })();
      }
    } catch (err) {
      status.textContent = uiPack().exportFailPng || "Export failed: PNG render error";
      status.style.color = "#7a0000";
      appendComplianceEventFireAndForget("export_png_failure", {
        reason: "render_or_encode_failed",
        detail: String(err && err.message ? err.message : err).slice(0, 160),
      });
    } finally {
      if (blurWasOn) {
        applyPrivacyPreviewToTranscript(true);
        refreshEditablePanel();
      }
    }
  };

  btn.addEventListener("click", async () => {
    const ack = document.getElementById("legal-ack");
    if (!ack || !ack.checked) {
      status.textContent = uiPack().exportBlocked || "Export blocked: confirm legal acknowledgment in the sidebar.";
      status.style.color = "#8a6d00";
      appendComplianceEventFireAndForget("export_blocked", { reason: "legal_ack_required" });
      ack?.focus();
      return;
    }
    await doExport();
  });
}

/**
 * Term totals (per term): Attempted = Earned = GPA Hours = sum of credits;
 * Quality Points = sum of Quality Pts; Term GPA = Quality Points ÷ GPA Hours.
 * Cumulative: each cumulative field = sum of the corresponding term totals; Cumulative GPA = cumulative QP ÷ cumulative GPA Hours.
 */
function fillTermTotals() {
  /** Cumulative GPA band thresholds for neutral Academic Standing labels (see `.standing`). */
  const STANDING_EXCELLENT_MIN = 3.5;
  const STANDING_GOOD_MIN = 3.0;
  const STANDING_FAIR_MIN = 2.0;

  const termBlocks = getActiveTermBlocks();
  let cumulativeHours = 0;
  let cumulativeQuality = 0;

  termBlocks.forEach((block) => {
    const rows = Array.from(block.querySelectorAll("tbody tr"));
    rows.forEach((row) => applyGradeAndQualityFromPercent(row));
    // Attempted / Earned / GPA Hours = sum of Credits Earned; Quality Points = sum of Quality Pts; Term GPA = QP / GPA Hours.
    const hours = rows.reduce((sum, row) => {
      const v = parseTranscriptNumber(row.dataset.hours || "0");
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const quality = rows.reduce((sum, row) => {
      const v = parseTranscriptNumber(row.dataset.quality || "0");
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const gpa = hours > 0 ? quality / hours : 0;

    block.querySelector(".attempted").textContent = formatTwo(hours);
    block.querySelector(".earned").textContent = formatTwo(hours);
    block.querySelector(".gpa-hours").textContent = formatTwo(hours);
    block.querySelector(".quality").textContent = formatTwo(quality);
    block.querySelector(".term-gpa").textContent = formatTwo(gpa);

    cumulativeHours += hours;
    cumulativeQuality += quality;
  });

  const cumulativeGpa = cumulativeHours > 0 ? cumulativeQuality / cumulativeHours : 0;
  document.getElementById("cum-attempted").textContent = formatTwo(cumulativeHours);
  document.getElementById("cum-earned").textContent = formatTwo(cumulativeHours);
  document.getElementById("cum-gpa-hours").textContent = formatTwo(cumulativeHours);
  document.getElementById("cum-quality").textContent = formatTwo(cumulativeQuality);
  document.getElementById("cum-gpa").textContent = formatTwo(cumulativeGpa);

  // Academic Standing labels are GPA-band estimates only (not edited in the sidebar).
  const p = uiPack();
  let standingText = p.standingNA || "Academic Standing: Not Available";
  const gpa = cumulativeGpa;
  if (Number.isFinite(gpa) && !Number.isNaN(gpa) && gpa > 0) {
    if (gpa >= STANDING_EXCELLENT_MIN) {
      standingText = p.standingExcellent || "Academic Standing: Excellent";
    } else if (gpa >= STANDING_GOOD_MIN) {
      standingText = p.standingGood || "Academic Standing: Good";
    } else if (gpa >= STANDING_FAIR_MIN) {
      standingText = p.standingFair || "Academic Standing: Fair";
    } else {
      standingText = p.standingLow || "Academic Standing: Low";
    }
  }
  const standingSurf = document.querySelector(".standing .inline-edit-target");
  if (standingSurf) {
    standingSurf.textContent = standingText;
  }
}

window.captureRawInputToken = captureRawInputToken;
window.captureFinalTranscriptHash = captureFinalTranscriptHash;
window.captureAuditLogHash = captureAuditLogHash;
window.generateExportQRPayload = generateExportQRPayload;
window.renderStandardQrToImage = renderStandardQrToImage;

function initOfflineQrLibrarySelfCheck() {
  updateExportQrFallback({});
}

window.transcriptToolAfterLanguageChange = function () {
  /* Must fill ladder tbody BEFORE locking #gpa-policy-scale; otherwise the guard snapshot has an empty tbody and the observer strips all rows. */
  renderGradeLadderTables();
  bindProtectedStaticZonesGuard();
  bindProtectedAuthorizationAndFooter();
  if (typeof window.transcriptToolRefreshTermSeasonHeadings === "function") {
    window.transcriptToolRefreshTermSeasonHeadings();
  }
  syncTermSelectOptionsForActiveTerms();
  refreshLegalAckStatusText();
  refreshEditablePanel();
  syncChsiVerifyCodeToTranscript();
  const es = document.getElementById("export-status");
  const p = uiPack();
  if (es && p.exportReady) {
    es.textContent = p.exportReady;
  }
  setUploadDiagnostics(p.uploadsReady || "Uploads: Ready", "neutral");
};

void initComplianceAuditLog();

bindCourseRowControls();
bindPhotoUpload();
bindLogoUpload();
bindCenterWatermarkUpload();
bindProtectionControls();
bindPrivacyPreviewControls();
bindExportPng();
bindPersonalSsnInput();
bindChsiVerifyCodeInput();

const langSelect = document.getElementById("lang-select");
if (langSelect && !langSelect.dataset.i18nBound) {
  langSelect.dataset.i18nBound = "1";
  langSelect.addEventListener("change", () => {
    if (typeof window.applyTranscriptLanguage === "function") {
      window.applyTranscriptLanguage(langSelect.value);
    }
  });
  const nav = (navigator.language || "").toLowerCase();
  langSelect.value = nav.startsWith("zh") ? "zh" : "en";
}

if (typeof window.applyTranscriptLanguage === "function") {
  window.applyTranscriptLanguage(langSelect?.value || "en");
} else {
  renderGradeLadderTables();
  bindProtectedStaticZonesGuard();
  bindProtectedAuthorizationAndFooter();
}

assertStrictGradeLadderSamples();

applyTermLayoutMode();
bindTermLayoutMode();
bindTermSeasonControls();
initOfflineQrLibrarySelfCheck();
initBrowserTranslationRawLockWatcher();
updateSecurityArtifacts();
