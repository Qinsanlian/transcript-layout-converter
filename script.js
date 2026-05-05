function formatTwo(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

let securityUpdateTimer = null;
let lastSecurityHash = "";
/** Last serialized integrity payload; skip SHA-256 + DOM writes when unchanged. */
let lastIntegrityPayloadString = null;

/** Cleared once <code>rawInputTokenHash</code> is set (save timer when no longer needed). */
let browserTranslationRawLockIntervalId = null;

/** Real values for fields masked as *** in transcript preview (privacy mode). */
const piiKeyBackup = Object.create(null);

/** Last “Issue And Digital Signature” line written at export (sidebar mirror). */
const issueSignatureLineBackup = { text: "" };

/** Last “Certification Institution Line” (full text; sidebar input may show a truncated preview). */
const certInstitutionLineBackup = { text: "" };

/** Coalesce {@link syncCertificationInstitutionLineToTranscript} with rapid Institution Name/Address typing (one rAF per frame). */
let certInstitutionLineSyncRafId = 0;

/** PII keys stored as canonical `YYYY-MM-DD` (DOB) or `YYYY-MM-DD` + optional time tail (Date Issued). */
const DATE_PII_KEYS = new Set(["dateOfBirth", "dateIssued"]);

/** Semantic tool version for local compliance audit trail (not auto-bumped). */
const TRANSCRIPT_TOOL_VERSION = "3.0.0-bilingual-en-zh";

/** Last successful PNG export metadata for transparency report (file-level digest, not DOM). */
let lastExportedPngFullSha256 = "";
let lastExportedPngFileName = "";
let lastExportedPngAtMs = 0;

/**
 * In-memory base64 for export-only Noto Serif SC {@code @font-face} (html2canvas clone); never persisted.
 * Populated by {@link loadNotoSerifSCFont}; stays {@code null} when local/network sources are unavailable.
 */
let notoSerifSCBase64 = null;

/** Expected SHA-256 of vendored `html2canvas.min.js` (see README.md and `tools/smoke-check.mjs`). */
const HTML2CANVAS_VENDOR_SHA256_EXPECTED =
  "e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb";

/** PNG / transcript PDF: user confirmed export checklist via modal (includes {@link phraseSha256} when typed phrase captured). */
const COMPLIANCE_EVENT_EXPORT_PREFLIGHT_CONFIRM = "export_preflight_confirm";
const COMPLIANCE_EVENT_TRANSPARENCY_REPORT_EXPORTED = "transparency_report_exported";

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

function formatExportDateYmdCompact(d) {
  const dt = d instanceof Date ? d : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function sanitizeExportFileToken(raw) {
  const s = raw == null ? "" : String(raw).trim();
  if (!s) {
    return "transcript";
  }
  return s.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 120);
}

function transcriptHasPlaceholderSchoolOrName() {
  const inst = document.querySelector('#transcript-page [data-edit-label="Institution Name"] .inline-edit-target')?.textContent ?? "";
  const student =
    piiKeyBackup.studentName != null && piiKeyBackup.studentName !== ""
      ? String(piiKeyBackup.studentName)
      : document.querySelector('#transcript-page [data-pii-key="studentName"]')?.textContent ?? "";
  const iLow = inst.toLowerCase();
  const sLow = student.toLowerCase();
  if (iLow.includes("example") || inst.includes("示例")) {
    return true;
  }
  if (sLow.includes("john doe") || student.includes("约翰·多伊")) {
    return true;
  }
  return false;
}

function buildExportPreflightNoticeParagraphs() {
  const p = uiPack();
  const parts = [];
  parts.push(p.exportConfirmDialog || "Proceed with export?");
  if (transcriptHasPlaceholderSchoolOrName()) {
    parts.push(
      (p.exportPreflightPlaceholderWarning || "").replace(/^\n+/, "").trim() ||
        (getUiLang() === "zh"
          ? "您的成绩单中可能仍包含占位数据，请先修改为真实信息后再导出。"
          : "Your transcript may still contain placeholder data; update it with real information before exporting.")
    );
  }
  const lawful = p.exportPreflightLawfulUseConfirm;
  if (lawful) {
    parts.push(lawful);
  }
  return parts;
}

function applyExportPreflightModalStaticStrings() {
  const modal = document.getElementById("export-preflight-modal");
  if (!modal) {
    return;
  }
  const p = uiPack();
  const title = document.getElementById("export-preflight-title");
  const typeHint = document.getElementById("export-preflight-type-hint");
  const cancelBtn = document.getElementById("export-preflight-cancel");
  const confirmBtn = document.getElementById("export-preflight-confirm");
  if (title) {
    title.textContent = p.exportPreflightModalTitle || "Export confirmation";
  }
  if (typeHint) {
    typeHint.textContent = p.exportPreflightTypePhraseHint || "Type the phrase below exactly:";
  }
  if (cancelBtn) {
    cancelBtn.textContent = p.exportPreflightCancelBtn || "Cancel";
  }
  if (confirmBtn) {
    confirmBtn.textContent = p.exportPreflightConfirmBtn || "Confirm export";
  }
}

/**
 * Custom modal: same checklist as legacy confirm, plus exact typed phrase. Logs {@link COMPLIANCE_EVENT_EXPORT_PREFLIGHT_CONFIRM} with phrase hash only.
 * @returns {Promise<boolean>}
 */
function requestExportPreflightConfirmAsync() {
  return openExportPreflightModalAndWait();
}

function bindExportPreflightModalOnce() {
  const modal = document.getElementById("export-preflight-modal");
  const bodyEl = document.getElementById("export-preflight-body");
  const phraseSample = document.getElementById("export-preflight-phrase-sample");
  const inp = document.getElementById("export-preflight-phrase-input");
  const errEl = document.getElementById("export-preflight-error");
  const cancelBtn = document.getElementById("export-preflight-cancel");
  const confirmBtn = document.getElementById("export-preflight-confirm");
  if (!modal || !bodyEl || !phraseSample || !inp || !cancelBtn || !confirmBtn || modal.dataset.exportPreflightBound) {
    return;
  }
  modal.dataset.exportPreflightBound = "1";
  let expectedPhrase = "";
  let finish = () => {};

  const close = (result) => {
    const r = finish;
    finish = () => {};
    modal.hidden = true;
    document.body.classList.remove("export-preflight-open");
    inp.value = "";
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = "";
    }
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }
    window.removeEventListener("keydown", onKeyDown);
    r(result);
  };

  function onKeyDown(ev) {
    if (!modal.hidden && ev.key === "Escape") {
      ev.preventDefault();
      close(false);
    }
  }

  const syncConfirmEnabled = () => {
    if (!confirmBtn) {
      return;
    }
    const typed = inp.value;
    const left = typed.normalize ? typed.normalize("NFC") : typed;
    const right = expectedPhrase.normalize ? expectedPhrase.normalize("NFC") : expectedPhrase;
    confirmBtn.disabled = left !== right;
  };

  inp.addEventListener("input", syncConfirmEnabled);

  cancelBtn.addEventListener("click", () => close(false));

  confirmBtn.addEventListener("click", () => {
    const p = uiPack();
    const typed = inp.value;
    const left = typed.normalize ? typed.normalize("NFC") : typed;
    const right = expectedPhrase.normalize ? expectedPhrase.normalize("NFC") : expectedPhrase;
    if (left !== right) {
      if (errEl) {
        errEl.textContent = p.exportPreflightMismatchError || "Phrase does not match.";
        errEl.hidden = false;
      }
      return;
    }
    confirmBtn.disabled = true;
    void (async () => {
      try {
        const phraseSha256 = await sha256Hex(
          JSON.stringify({ purpose: "export_preflight_typed_phrase_v1", phrase: left })
        );
        appendComplianceEventFireAndForget(COMPLIANCE_EVENT_EXPORT_PREFLIGHT_CONFIRM, { phraseSha256 });
        close(true);
      } catch (_e) {
        confirmBtn.disabled = false;
        syncConfirmEnabled();
      }
    })();
  });

  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) {
      close(false);
    }
  });

  window.__transcriptOpenExportPreflightModal = () =>
    new Promise((resolve) => {
      finish = resolve;
      const p = uiPack();
      expectedPhrase = "";
      const pool = Array.isArray(p.exportPreflightPhrasePool) ? p.exportPreflightPhrasePool.filter(Boolean) : [];
      expectedPhrase =
        pool.length > 0
          ? pool[Math.floor(Math.random() * pool.length)]
          : getUiLang() === "zh"
            ? "我承担全部法律责任"
            : "I accept full legal responsibility";

      while (bodyEl.firstChild) {
        bodyEl.removeChild(bodyEl.firstChild);
      }
      buildExportPreflightNoticeParagraphs().forEach((para) => {
        const pEl = document.createElement("p");
        pEl.className = "service-consent-statement export-preflight-notice-para";
        pEl.style.margin = "0 0 10px";
        pEl.textContent = para;
        bodyEl.appendChild(pEl);
      });
      phraseSample.textContent = expectedPhrase;
      inp.value = "";
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = "";
      }
      inp.placeholder = p.exportPreflightInputPlaceholder || "";
      modal.hidden = false;
      applyExportPreflightModalStaticStrings();
      syncConfirmEnabled();
      document.body.classList.add("export-preflight-open");
      window.addEventListener("keydown", onKeyDown);
      setTimeout(() => {
        try {
          inp.focus();
        } catch (_e) {
          /* ignore */
        }
      }, 30);
    });
}

function openExportPreflightModalAndWait() {
  if (typeof window.__transcriptOpenExportPreflightModal !== "function") {
    bindExportPreflightModalOnce();
  }
  if (typeof window.__transcriptOpenExportPreflightModal !== "function") {
    return Promise.resolve(false);
  }
  return window.__transcriptOpenExportPreflightModal();
}

function applyExportPurposeStatementForExport() {
  const inp = document.getElementById("export-purpose-input");
  const line = document.getElementById("export-purpose-statement");
  if (!line) {
    return;
  }
  const purpose = (inp && inp.value ? inp.value : "").trim();
  const p = uiPack();
  if (purpose && typeof p.exportPurposeLine === "function") {
    line.textContent = p.exportPurposeLine(formatAuditLocalWallClock(Date.now()), purpose);
    line.hidden = false;
  } else {
    line.textContent = "";
    line.hidden = true;
  }
}

function resetExportPurposeStatementDisplay() {
  const line = document.getElementById("export-purpose-statement");
  if (!line) {
    return;
  }
  line.textContent = "";
  line.hidden = true;
}

/** Sidebar-only label; `data-edit-label` on the transcript remains English for compliance keys. */
function localizedEditorFieldLabel(raw) {
  if (!raw) {
    return "";
  }
  const z = getUiLang();
  const dict = z === "zh" ? window.TRANSCRIPT_EDITOR_LABEL?.zh : window.TRANSCRIPT_EDITOR_LABEL?.en;
  if (dict && dict[raw]) {
    return dict[raw];
  }
  if (z === "en") {
    return raw;
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

/** Local wall clock for audit lines — always `YYYY-MM-DD HH:mm:ss` (24h) for consistency across locales. */
function formatAuditLocalWallClock(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Same calendar format as {@link formatAuditLocalWallClock} for export-time “Date Issued”. */
function formatYmdHmsFromDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return "";
  }
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Transcript page display: calendar part is localized; storage / sidebar stay `YYYY-MM-DD`.
 * @param {string} dateString Strict `YYYY-MM-DD` (any other string is returned unchanged).
 * @param {string} lang `"en"` → US-style short month (e.g. Jan 15, 2026); `zh` → `YYYY-MM-DD`.
 */
function formatDateForDisplay(dateString, lang) {
  const s = String(dateString ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(s);
  if (!m) {
    return s;
  }
  const [, y, mo, d] = m;
  if (lang === "en") {
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    if (Number.isNaN(dt.getTime())) {
      return s;
    }
    return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  return `${y}-${mo}-${d}`;
}

/** Localized calendar prefix + preserved suffix (e.g. export time ` HH:mm:ss`). */
function formatPiiCanonicalDateForTranscriptPage(canonical, lang) {
  const s = String(canonical ?? "").trim();
  const m = /^(\d{4}-\d{2}-\d{2})([\s\S]*)$/u.exec(s);
  if (!m) {
    return s;
  }
  return formatDateForDisplay(m[1], lang) + (m[2] || "");
}

function canonicalizeDateOfBirthForBackup(raw) {
  const s = String(raw ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/u.exec(s);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  m = /^(\d{2})-(\d{2})-(\d{4})$/u.exec(s);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return s;
}

function canonicalizePiiDateBackupValue(piiKey, raw) {
  const s = String(raw ?? "").trim();
  if (piiKey === "dateOfBirth") {
    return canonicalizeDateOfBirthForBackup(s);
  }
  if (piiKey === "dateIssued") {
    const m = /^(\d{4}-\d{2}-\d{2})([\s\S]*)$/u.exec(s);
    if (m) {
      return `${m[1]}${m[2] || ""}`;
    }
    return s;
  }
  return s;
}

window.formatDateForDisplay = formatDateForDisplay;
window.transcriptToolGetCanonicalPiiDateValue = function transcriptToolGetCanonicalPiiDateValue(key) {
  const v = piiKeyBackup[key];
  return v != null ? String(v) : "";
};

function parseTrustedTimestampElementToDate() {
  const el = document.getElementById("trusted-timestamp");
  const raw = (el?.textContent || "").trim();
  const p = uiPack();
  const fetching = (p.utcFetching || "").trim();
  const notYet = (p.utcNotFetched || "").trim();
  if (!raw || (notYet && raw === notYet) || (fetching && raw === fetching)) {
    return new Date();
  }
  const t = raw.replace(/\s+—\s+.*$/u, "").replace(/\s+-\s+.*$/u, "").replace(/（[^）]*）\s*$/u, "").trim();
  let tMs = Date.parse(t);
  if (!Number.isNaN(tMs)) {
    return new Date(tMs);
  }
  const m = t.match(/\d{4}-\d{2}-\d{2}[ T][\d:.]+/);
  if (m) {
    tMs = Date.parse(m[0]);
    if (!Number.isNaN(tMs)) {
      return new Date(tMs);
    }
  }
  return new Date();
}

/** After {@link fetchTrustedTimestamp}, stamps “Date Issued” on the transcript + sidebar mirror for PNG/PDF capture. */
function applyTranscriptDateIssuedForExportCapture() {
  const formatted = formatYmdHmsFromDate(parseTrustedTimestampElementToDate());
  if (!formatted) {
    return;
  }
  const lang = getUiLang() === "zh" ? "zh" : "en";
  const span = document.querySelector("#transcript-page [data-pii-key=\"dateIssued\"]");
  if (span) {
    piiKeyBackup.dateIssued = formatted;
    /* PNG/PDF capture may run while the privacy checkbox is still on; transcript must show the real issued stamp. */
    span.textContent = formatPiiCanonicalDateForTranscriptPage(formatted, lang);
  }
  const roInp = document.querySelector("#editor-form .editor-field--date-issued-auto input");
  if (roInp) {
    roInp.value = formatted.slice(0, 10);
  }
}

/** Live transcript line: localized labels, wall-clock time, full integrity hash (no decorative parentheses). */
function formatIssueAndDigitalSignatureDisplayLine(isZh, timeStr, fullHash) {
  const h = String(fullHash || "").toUpperCase();
  if (isZh) {
    return `签发日期：${timeStr} | 电子签哈希：${h}`;
  }
  return `Date of Issue: ${timeStr} | Digital Signature Hash: ${h}`;
}

/** Updates transcript + sidebar mirror; does not re-enter {@link collectIntegrityPayload}. */
function syncIssueAndDigitalSignatureLiveLine() {
  const node = document.querySelector('#transcript-page [data-edit-label="Issue And Digital Signature"]');
  if (!node) {
    return;
  }
  const hashEl = document.getElementById("integrity-hash");
  const fullHash = (hashEl && hashEl.dataset.fullHash) || lastSecurityHash || "";
  const isZh = getUiLang() === "zh";
  const timeStr = formatAuditLocalWallClock(Date.now());
  const line = formatIssueAndDigitalSignatureDisplayLine(isZh, timeStr, fullHash);
  writeEditableSurfaceText(node, line, { allowIssueSignatureLineWrite: true });
  const roInp = document.querySelector("#editor-form .editor-field--issue-signature-auto input");
  if (roInp) {
    roInp.value = line.length > 140 ? `${line.slice(0, 137)}…` : line;
  }
}

/** At PNG/PDF capture: refresh integrity hash then stamp cert line (no manual / no sample hash). */
async function applyIssueSignatureLineForExportCapture() {
  await updateSecurityArtifacts();
  const node = document.querySelector('#transcript-page [data-edit-label="Issue And Digital Signature"]');
  if (!node) {
    return;
  }
  const surf = node.querySelector(".inline-edit-target");
  if (!surf) {
    return;
  }
  const hashEl = document.getElementById("integrity-hash");
  const fullHash = (hashEl && hashEl.dataset.fullHash) || lastSecurityHash || "";
  const dt = formatYmdHmsFromDate(parseTrustedTimestampElementToDate());
  const isZh = getUiLang() === "zh";
  const line = formatIssueAndDigitalSignatureDisplayLine(isZh, dt, fullHash);
  surf.textContent = line;
  issueSignatureLineBackup.text = line;
  const roInp = document.querySelector("#editor-form .editor-field--issue-signature-auto input");
  if (roInp) {
    roInp.value = line.length > 140 ? `${line.slice(0, 137)}…` : line;
  }
}

/** Nodes that appear in the sidebar editor + export sync (excludes tool metadata, signature blocks, etc.). */
function isTranscriptSidebarEditNode(node) {
  if (!node || !node.dataset || node.dataset.editLabel == null) {
    return false;
  }
  if (node.dataset.protected === "true" || node.dataset.computed === "true") {
    return false;
  }
  if (node.closest(".term-block-inactive")) {
    return false;
  }
  if (node.closest("[data-metadata-protected=\"true\"]")) {
    return false;
  }
  if (node.closest("[data-signature-protected=\"true\"]")) {
    return false;
  }
  return true;
}

/** Course `tr` in `.term-block` tables: stable import/sidebar order (does not change when rows move in the transcript). */
function ensureCourseRowSidebarSlots() {
  document.querySelectorAll(".term-block").forEach((block) => {
    const rows = Array.from(block.querySelectorAll("tbody tr"));
    let max = -1;
    rows.forEach((row) => {
      const s = row.dataset.sidebarSlot;
      if (s != null && String(s).trim() !== "" && /^\d+$/u.test(String(s))) {
        max = Math.max(max, Number(s));
      }
    });
    rows.forEach((row) => {
      const s = row.dataset.sidebarSlot;
      if (s == null || String(s).trim() === "") {
        max += 1;
        row.dataset.sidebarSlot = String(max);
      }
    });
  });
}

function allocateNextSidebarSlotForTbody(tbody) {
  if (!tbody) {
    return "0";
  }
  let max = -1;
  Array.from(tbody.querySelectorAll("tr")).forEach((row) => {
    const s = row.dataset.sidebarSlot;
    if (s != null && String(s).trim() !== "" && /^\d+$/u.test(String(s))) {
      max = Math.max(max, Number(s));
    }
  });
  return String(max + 1);
}

function isActiveTermCourseTableDataCell(node) {
  if (!node || !node.matches || !node.matches("td")) {
    return false;
  }
  if (!node.dataset || node.dataset.editLabel == null) {
    return false;
  }
  const termBlock = node.closest(".term-block:not(.term-block-inactive)");
  if (!termBlock) {
    return false;
  }
  const tbody = node.closest("tbody");
  const courseTbody = termBlock.querySelector("tbody");
  if (!tbody || !courseTbody || tbody !== courseTbody) {
    return false;
  }
  return true;
}

function getCourseBodyEditNodesDocOrder(termBlock) {
  const tbody = termBlock.querySelector("tbody");
  if (!tbody) {
    return [];
  }
  const out = [];
  tbody.querySelectorAll("tr").forEach((tr) => {
    tr.querySelectorAll("td").forEach((td) => {
      if (!td.dataset.editLabel || td.dataset.computed === "true") {
        return;
      }
      if (!isTranscriptSidebarEditNode(td)) {
        return;
      }
      out.push(td);
    });
  });
  return out;
}

function collectCourseBodyEditNodesSidebarSlotOrder(termBlock) {
  const tbody = termBlock.querySelector("tbody");
  if (!tbody) {
    return [];
  }
  const rows = Array.from(tbody.querySelectorAll("tr"));
  rows.sort((a, b) => (Number(a.dataset.sidebarSlot) || 0) - (Number(b.dataset.sidebarSlot) || 0));
  const out = [];
  rows.forEach((tr) => {
    tr.querySelectorAll("td").forEach((td) => {
      if (!td.dataset.editLabel || td.dataset.computed === "true") {
        return;
      }
      if (!isTranscriptSidebarEditNode(td)) {
        return;
      }
      out.push(td);
    });
  });
  return out;
}

function courseBodyEditNodeSetsEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  const sa = new Set(a);
  for (let i = 0; i < b.length; i += 1) {
    if (!sa.has(b[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Sidebar + export sync iterate course fields in stable {@link HTMLTableRowElement#dataset}.sidebarSlot
 * order; transcript table DOM order still follows user row moves.
 */
function orderEditableNodesForSidebarStableCourseRows(all) {
  const out = [];
  let i = 0;
  while (i < all.length) {
    const node = all[i];
    if (!isActiveTermCourseTableDataCell(node)) {
      out.push(node);
      i += 1;
      continue;
    }
    const termBlock = node.closest(".term-block:not(.term-block-inactive)");
    const docOrder = getCourseBodyEditNodesDocOrder(termBlock);
    const docSet = new Set(docOrder);
    const sorted = collectCourseBodyEditNodesSidebarSlotOrder(termBlock);
    const use = sorted.length === docOrder.length && courseBodyEditNodeSetsEqual(sorted, docOrder) ? sorted : docOrder;
    out.push(...use);
    while (i < all.length && docSet.has(all[i])) {
      i += 1;
    }
  }
  return out;
}

const transcriptSignatureGuardDisposers = [];

function teardownTranscriptSignatureTamperGuards() {
  while (transcriptSignatureGuardDisposers.length) {
    const fn = transcriptSignatureGuardDisposers.pop();
    try {
      fn();
    } catch (_e) {
      /* ignore */
    }
  }
}

/** Re-binds tamper observers after demo/i18n updates so “expected” HTML matches current localized copy. */
function setupTranscriptSignatureTamperGuards() {
  teardownTranscriptSignatureTamperGuards();
  const page = document.getElementById("transcript-page");
  if (!page) {
    return;
  }
  page.querySelectorAll(".sign-box[data-signature-protected=\"true\"]").forEach((box) => {
    let expectedHtml = box.innerHTML;
    let restoring = false;
    const obs = new MutationObserver(() => {
      if (restoring || isBrowserMachineTranslating()) {
        return;
      }
      if (box.innerHTML !== expectedHtml) {
        restoring = true;
        box.innerHTML = expectedHtml;
        restoring = false;
      }
    });
    obs.observe(box, { childList: true, subtree: true, characterData: true });
    transcriptSignatureGuardDisposers.push(() => obs.disconnect());
  });
}

/** Call when transcript integrity fingerprint changes; updates the layout fingerprint last-change audit line. */
function setLayoutFingerprintEditedAtDisplay(tsMillis) {
  const anchors = transcriptToolExportAnchors;
  anchors.lastLayoutEditedAtMs = tsMillis;
  const line = document.getElementById("transcript-last-edited-display");
  if (line) {
    line.textContent = formatAuditLocalWallClock(tsMillis);
  }
}

/** Stamp immediately before transcript HTML is hashed into <code>out</code>; drives the PNG snapshot audit line. */
function setExportSnapshotQueuedAtDisplay(tsMillis) {
  const anchors = transcriptToolExportAnchors;
  anchors.lastExportSnapshotQueuedAtMs = tsMillis;
  const line = document.getElementById("transcript-export-snapshot-display");
  if (line) {
    line.textContent = formatAuditLocalWallClock(tsMillis);
  }
}

/**
 * Mutable export pipeline state (sidebar raw-input hash once per export, transcript HTML hash, audit log hash,
 * last QR JSON, edit/export timestamps). Module-local only (not exposed on `window`).
 */
const transcriptToolExportAnchors = {
  rawInputTokenHash: null,
  lastFinalTranscriptHash: null,
  lastAuditLogHash: null,
  lastQrPayload: null,
  lastLayoutEditedAtMs: null,
  lastExportSnapshotQueuedAtMs: null,
};

/** @type {null | (() => void)} Set by {@link bindTermSeasonControls} when term/year controls exist. */
let refreshTermSeasonHeadings = null;

/** @type {null | (() => void)} Disconnects the previous protected-zone observers before {@link bindProtectedStaticZonesGuard} rebinds. */
let transcriptGuardTeardown = null;

/** Column indices in each course row (0-based td order). */
const COURSE_COL_DESCRIPTION = 2;
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

/** Descending by minPercent for percent→letter lookup (avoid sorting on every cell). */
const US_PERCENT_GRADE_LADDER_DESC = Object.freeze(
  [...US_PERCENT_GRADE_LADDER].sort((a, b) => b.minPercent - a.minPercent)
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
  const rungs = US_PERCENT_GRADE_LADDER_DESC;
  for (let i = 0; i < rungs.length; i += 1) {
    const r = rungs[i];
    if (p >= r.minPercent) {
      return { letter: r.letter, gradePoint: r.gradePoint };
    }
  }
  return { letter: "F", gradePoint: 0.0 };
}

/** Chinese five-tier reference scale (documented in #grade-scale-disclaimer). */
const FIVE_SCALE_MAP = Object.freeze({
  优秀: { percent: 95, gpa: 4.0, letter: "A" },
  良好: { percent: 85, gpa: 3.0, letter: "B" },
  中等: { percent: 75, gpa: 2.0, letter: "C" },
  及格: { percent: 65, gpa: 1.0, letter: "D" },
  不及格: { percent: 55, gpa: 0.0, letter: "F" },
});

const PASS_FAIL_MAP = Object.freeze({
  合格: { percent: null, gpa: null, letter: null, gpaExcluded: true },
  不合格: { percent: 55, gpa: 0.0, letter: "F", gpaExcluded: false },
});

const FIVE_SCALE_DISPLAY_EN = Object.freeze({
  优秀: "Excellent",
  良好: "Good",
  中等: "Average",
  及格: "Satisfactory",
  不及格: "Fail",
});

function transcriptUsesNonPercentGradeScale() {
  return Array.from(document.querySelectorAll(".term-block:not(.term-block-inactive) tbody tr")).some((tr) => {
    const s = readRowGradeScale(tr);
    return s === "five" || s === "pass-fail" || s === "exempt";
  });
}

function applyGradeScaleDisclaimer() {
  const el = document.getElementById("grade-scale-disclaimer");
  if (!el) {
    return;
  }
  if (transcriptUsesNonPercentGradeScale()) {
    el.hidden = false;
    el.innerHTML = uiPack().gradeScaleDisclaimerHtml || uiPack().gradeScaleDisclaimerText || "";
  } else {
    el.hidden = true;
    el.innerHTML = "";
  }
}

function gradeCellDisplayLabel(zhKey) {
  if (!zhKey) {
    return "";
  }
  if (getUiLang() === "zh") {
    return zhKey;
  }
  if (zhKey === "合格") {
    return uiPack().passFailPassDisplay || "Pass";
  }
  if (zhKey === "不合格") {
    return uiPack().passFailFailDisplay || "Fail";
  }
  return FIVE_SCALE_DISPLAY_EN[zhKey] || zhKey;
}

function readRowGradeScale(row) {
  const s = row?.dataset?.gradeScale;
  if (s === "five" || s === "pass-fail" || s === "exempt" || s === "percent") {
    return s;
  }
  return "percent";
}

function readRowGradeValue(row) {
  return row?.dataset?.gradeValue != null ? String(row.dataset.gradeValue) : "";
}

function writeRowGradeState(row, scale, value) {
  if (!row) {
    return;
  }
  const sc =
    scale === "five" || scale === "pass-fail" || scale === "exempt" || scale === "percent" ? scale : "percent";
  row.dataset.gradeScale = sc;
  row.dataset.gradeValue = value == null ? "" : String(value);
  updateGradePercentDisplayCell(row);
}

function updateGradePercentDisplayCell(row) {
  const span = row?.querySelector("td.grade-percent-cell .grade-percent-display");
  if (!span) {
    return;
  }
  const scale = readRowGradeScale(row);
  const val = readRowGradeValue(row);
  if (scale === "exempt") {
    span.textContent = "";
    return;
  }
  if (scale === "percent") {
    span.textContent = val;
    return;
  }
  if (scale === "five" || scale === "pass-fail") {
    span.textContent = val ? gradeCellDisplayLabel(val) : "";
  }
}

/** Older layouts embedded controls in the percent cell; fold into row state + display-only span. */
function migrateLegacyGradeCellsToRowState() {
  document.querySelectorAll("td.grade-percent-cell .grade-type-select").forEach((sel) => {
    const td = sel.closest("td");
    const row = td?.closest("tr");
    if (!td || !row) {
      return;
    }
    const scale = sel.value;
    let val = "";
    if (scale === "percent") {
      val = td.querySelector(".percent-input")?.value ?? "";
    } else if (scale === "five" || scale === "pass-fail") {
      val = td.querySelector(".grade-keyword-select")?.value ?? "";
    }
    row.dataset.gradeScale = scale;
    row.dataset.gradeValue = val;
    const span = document.createElement("span");
    span.className = "grade-percent-display notranslate";
    span.setAttribute("translate", "no");
    td.innerHTML = "";
    td.appendChild(span);
    updateGradePercentDisplayCell(row);
  });
}

function rebuildGradeKeywordSelect(mode, selectedKey) {
  const sel = document.createElement("select");
  sel.className = "editor-grade-keyword-select notranslate";
  sel.setAttribute("translate", "no");
  sel.setAttribute("aria-label", mode === "five" ? "Five-tier grade" : "Pass/Fail grade");
  const map = mode === "five" ? FIVE_SCALE_MAP : PASS_FAIL_MAP;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = uiPack().gradeKeywordPlaceholder || "—";
  sel.appendChild(placeholder);
  Object.keys(map).forEach((k) => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = gradeCellDisplayLabel(k);
    if (k === selectedKey) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });
  return sel;
}

function syncGradeTypeSelectOptionLabels() {
  const t = uiPack();
  const p = t.gradeTypePercent || "Percent";
  const f = t.gradeTypeFive || "Five-tier";
  const pf = t.gradeTypePassFail || "Pass/Fail";
  const ex = t.gradeTypeExempt || "Exempt / waiver";
  document.querySelectorAll("#editor-form .editor-grade-type").forEach((sel) => {
    const opts = sel.querySelectorAll("option");
    if (opts[0]) {
      opts[0].textContent = p;
    }
    if (opts[1]) {
      opts[1].textContent = f;
    }
    if (opts[2]) {
      opts[2].textContent = pf;
    }
    if (opts[3]) {
      opts[3].textContent = ex;
    }
  });
  document.querySelectorAll("#editor-form .editor-grade-keyword-select").forEach((kw) => {
    const field = kw.closest(".editor-field");
    const mode = field?.querySelector(".editor-grade-type")?.value;
    const map = mode === "five" ? FIVE_SCALE_MAP : mode === "pass-fail" ? PASS_FAIL_MAP : null;
    if (!map) {
      return;
    }
    const cur = kw.value;
    Array.from(kw.options).forEach((o) => {
      if (!o.value) {
        return;
      }
      o.textContent = gradeCellDisplayLabel(o.value);
    });
    if (cur && map[cur]) {
      kw.value = cur;
    }
  });
}

/**
 * `i18n.js` invokes this after `applyTranscriptPageStrings` so sidebar grade-type labels and the transcript
 * grade-scale disclaimer stay aligned with the active locale.
 */
window.transcriptToolSyncGradeScaleUi = function transcriptToolSyncGradeScaleUi() {
  syncGradeTypeSelectOptionLabels();
  applyGradeScaleDisclaimer();
};

/**
 * Reads grade type + value from the row; maps five-tier / pass-fail / exempt to percent & GPA fields.
 * @returns {{ percent: number|null, gpa: number|null, letter: string|null, gpaExcluded: boolean, exempt: boolean, displayKeyword: string, usedMapGpa: boolean }}
 */
function convertGradeTypeToPercent(row) {
  const cells = Array.from(row.querySelectorAll("td"));
  const td = cells[COURSE_COL_PERCENT];
  const empty = () => ({
    percent: NaN,
    gpa: null,
    letter: null,
    gpaExcluded: false,
    exempt: false,
    displayKeyword: "",
    usedMapGpa: false,
  });
  if (!td) {
    return empty();
  }
  delete row.dataset.gpaExcluded;
  const scale = readRowGradeScale(row);
  const val = readRowGradeValue(row);
  if (scale === "percent") {
    const percentVal = parseTranscriptNumber(val);
    return {
      percent: percentVal,
      gpa: null,
      letter: null,
      gpaExcluded: false,
      exempt: false,
      displayKeyword: "",
      usedMapGpa: false,
    };
  }
  if (scale === "exempt") {
    row.dataset.gpaExcluded = "1";
    return {
      percent: null,
      gpa: null,
      letter: null,
      gpaExcluded: true,
      exempt: true,
      displayKeyword: "",
      usedMapGpa: false,
    };
  }
  const kw = val || "";
  const map = scale === "five" ? FIVE_SCALE_MAP : PASS_FAIL_MAP;
  const entry = kw ? map[kw] : undefined;
  if (!entry) {
    return { ...empty(), displayKeyword: kw };
  }
  if (entry.gpaExcluded) {
    row.dataset.gpaExcluded = "1";
  }
  const usedMapGpa = !entry.gpaExcluded && typeof entry.gpa === "number";
  return {
    percent: entry.percent != null && Number.isFinite(entry.percent) ? entry.percent : NaN,
    gpa: entry.gpa,
    letter: entry.letter,
    gpaExcluded: Boolean(entry.gpaExcluded),
    exempt: false,
    displayKeyword: kw,
    usedMapGpa,
  };
}

function getCoursePercentCellPayloadText(td) {
  const row = td?.closest("tr");
  if (!row) {
    return td?.textContent?.trim() || "";
  }
  const scale = readRowGradeScale(row);
  const val = readRowGradeValue(row);
  if (scale === "exempt") {
    return "";
  }
  if (scale === "percent") {
    return val.trim();
  }
  return val.trim();
}

/**
 * Bracket inner `Label~pct` only on selected percent bands; `97 – 100` has no bracket.
 * @param {{ rangeText: string, isBelow60Row?: boolean }} o
 */
function gradeLadderDisplayTierBracketInner(o) {
  const { rangeText, isBelow60Row } = o;
  if (isBelow60Row) {
    const v = FIVE_SCALE_MAP.不及格;
    return `${gradeCellDisplayLabel("不及格")}~${v.percent}`;
  }
  const t = String(rangeText).replace(/\u2212/g, "–").trim();
  const m = /^(\d+)\s*–\s*(\d+)$/.exec(t);
  if (!m) {
    return "";
  }
  const lo = Number(m[1]);
  const hiR = Number(m[2]);
  if (lo === 97 && hiR === 100) {
    return "";
  }
  if (lo === 93 && hiR === 96) {
    const v = FIVE_SCALE_MAP.优秀;
    return `${gradeCellDisplayLabel("优秀")}~${v.percent}`;
  }
  if (lo === 83 && hiR === 86) {
    const v = FIVE_SCALE_MAP.良好;
    return `${gradeCellDisplayLabel("良好")}~${v.percent}`;
  }
  if (lo === 73 && hiR === 76) {
    const v = FIVE_SCALE_MAP.中等;
    return `${gradeCellDisplayLabel("中等")}~${v.percent}`;
  }
  if (lo === 63 && hiR === 66) {
    if (getUiLang() === "zh") {
      return "合格~65";
    }
    const v = FIVE_SCALE_MAP.及格;
    return `${gradeCellDisplayLabel("及格")}~${v.percent}`;
  }
  return "";
}

function gradeLadderRangePrefixLen(rangeText, tierCore, _hi) {
  if (!tierCore) {
    return String(rangeText).length;
  }
  return String(rangeText).length + 3;
}

/** First column: `lo – hi | * { tierCore }` (pipe spaced); solo rows have range text only. */
function appendGradeLadderBandCell(td, rangeText, tierCore, _hi) {
  td.className = "grade-ladder-band-td";
  td.replaceChildren();
  const rangeEl = document.createElement("span");
  rangeEl.className =
    "grade-ladder-range" + (tierCore ? " grade-ladder-range-with-tier" : " grade-ladder-range-solo");
  if (tierCore) {
    rangeEl.textContent = `${rangeText} | `;
  } else {
    rangeEl.textContent = rangeText;
  }
  td.appendChild(rangeEl);
  if (!tierCore) {
    return;
  }
  const wrap = document.createElement("span");
  wrap.className = "grade-ladder-tier-wrap";
  const star = document.createElement("span");
  star.className = "grade-ladder-tier-star";
  star.textContent = "*";
  const sp0 = document.createElement("span");
  sp0.className = "grade-ladder-tier-sp";
  sp0.textContent = " ";
  const open = document.createElement("span");
  open.className = "grade-ladder-tier-brace grade-ladder-tier-open";
  open.textContent = "{";
  const sp1 = document.createElement("span");
  sp1.className = "grade-ladder-tier-sp";
  sp1.textContent = " ";
  const mid = document.createElement("span");
  mid.className = "grade-ladder-tier-mid";
  mid.textContent = tierCore;
  const sp2 = document.createElement("span");
  sp2.className = "grade-ladder-tier-sp";
  sp2.textContent = " ";
  const close = document.createElement("span");
  close.className = "grade-ladder-tier-brace grade-ladder-tier-close";
  close.textContent = "}";
  wrap.append(star, sp0, open, sp1, mid, sp2, close);
  td.appendChild(wrap);
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
    const gradePoint = Number(r.gradePoint).toFixed(1);
    rows.push({
      rangeText: `${lo} – ${hi}`,
      hi,
      tierCore: gradeLadderDisplayTierBracketInner({
        rangeText: `${lo} – ${hi}`,
        isBelow60Row: false,
      }),
      letter: r.letter,
      gradePoint,
    });
  }
  rows.push({
    rangeText: p.below60 || "Below 60",
    hi: null,
    tierCore: gradeLadderDisplayTierBracketInner({
      rangeText: p.below60 || "Below 60",
      isBelow60Row: true,
    }),
    letter: "F",
    gradePoint: "0.0",
  });
  rows.push({
    rangeText: p.gradeLadderExemptBand || "Exempt / waiver",
    hi: null,
    tierCore: null,
    letter: p.gradeTypeExempt || p.exemptGradeDisplay || "Exempt",
    gradePoint: p.gradeKeywordPlaceholder != null ? p.gradeKeywordPlaceholder : "—",
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
    const rows = getGradeLadderDisplayRows();
    const maxPrefixCh = Math.max(
      1,
      ...rows.map((r) => gradeLadderRangePrefixLen(r.rangeText, r.tierCore, r.hi))
    );
    const table = tbody.closest("table");
    if (table) {
      table.style.setProperty("--gl-prefix-ch", String(maxPrefixCh + 1));
    }
    rows.forEach(({ rangeText, tierCore, letter, gradePoint, hi }) => {
      const tr = document.createElement("tr");
      const td0 = document.createElement("td");
      appendGradeLadderBandCell(td0, rangeText, tierCore, hi);
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
  if (sbBody) {
    const sbTable = sbBody.closest("table");
    if (sbTable) {
      const sb =
        window.TRANSCRIPT_SIDEBAR?.[getUiLang()] || window.TRANSCRIPT_SIDEBAR?.en || {};
      sbTable.setAttribute("aria-label", sb.gradeLadderTableAria || "GPA conversion reference");
    }
  }
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

/** Derives Grade Pt, Grade, Quality Pts from percent / five-tier / pass-fail + credits. */
function applyGradeAndQualityFromPercent(row) {
  const cells = Array.from(row.querySelectorAll("td"));
  if (cells.length < 8) {
    return;
  }

  const creditsVal = parseTranscriptNumber(cells[COURSE_COL_CREDITS].textContent);
  const creditsEarned = Number.isFinite(creditsVal) ? creditsVal : 0;

  const conv = convertGradeTypeToPercent(row);

  const emptyComputed = () => {
    cells[COURSE_COL_GRADE_POINT].textContent = "";
    cells[COURSE_COL_GRADE_POINT].classList.add("num");
    cells[COURSE_COL_GRADE].textContent = "";
    cells[COURSE_COL_QUALITY].textContent = formatTwo(0);
    row.dataset.hours = formatTwo(creditsEarned);
    row.dataset.quality = formatTwo(0);
  };

  if (conv.exempt) {
    cells[COURSE_COL_GRADE_POINT].textContent = "";
    cells[COURSE_COL_GRADE_POINT].classList.add("num");
    cells[COURSE_COL_GRADE].textContent = uiPack().exemptGradeDisplay || "免考";
    cells[COURSE_COL_QUALITY].textContent = formatTwo(0);
    row.dataset.hours = formatTwo(0);
    row.dataset.quality = formatTwo(0);
    return;
  }

  if (conv.gpaExcluded) {
    cells[COURSE_COL_GRADE_POINT].textContent = "";
    cells[COURSE_COL_GRADE_POINT].classList.add("num");
    cells[COURSE_COL_GRADE].textContent = gradeCellDisplayLabel("合格");
    cells[COURSE_COL_QUALITY].textContent = formatTwo(0);
    row.dataset.hours = formatTwo(0);
    row.dataset.quality = formatTwo(0);
    return;
  }

  const useMapDirect = Boolean(conv.usedMapGpa && conv.gpa != null && conv.letter != null && Number.isFinite(conv.gpa));

  if (!useMapDirect) {
    const percentVal = conv.percent;
    if (!Number.isFinite(percentVal)) {
      emptyComputed();
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
    return;
  }

  const qualityPts = creditsEarned * Number(conv.gpa);
  cells[COURSE_COL_GRADE_POINT].textContent = Number(conv.gpa).toFixed(1);
  cells[COURSE_COL_GRADE_POINT].classList.add("num");
  cells[COURSE_COL_GRADE].textContent = gradeCellDisplayLabel(conv.displayKeyword);
  cells[COURSE_COL_QUALITY].textContent = formatTwo(qualityPts);
  row.dataset.hours = formatTwo(creditsEarned);
  row.dataset.quality = formatTwo(qualityPts);
}

function generateDocumentId() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `TRX-SAMPLE-${datePart}-001`;
}

function isPrivacyPreviewEnabled() {
  const el = document.getElementById("privacy-preview-toggle");
  return Boolean(el && el.checked);
}

/** Writes user-editable text into <span class="inline-edit-target"> when present; otherwise replaces node text (e.g. table headers). */
function writeEditableSurfaceText(node, value, options = {}) {
  const forceUnmaskedForExport = Boolean(options.forceUnmaskedForExport);
  const allowIssueSignatureLineWrite = Boolean(options.allowIssueSignatureLineWrite);
  const allowCertInstitutionLineWrite = Boolean(options.allowCertInstitutionLineWrite);
  const v = String(value ?? "");
  if (node?.dataset?.issueSignatureAuto === "true" && !allowIssueSignatureLineWrite) {
    return;
  }
  if (node?.dataset?.certInstitutionAuto === "true" && !allowCertInstitutionLineWrite) {
    return;
  }
  if (node.matches && node.matches("td.grade-percent-cell") && node.dataset.gradeComposite === "1") {
    const row = node.closest("tr");
    if (!row) {
      return;
    }
    try {
      const o = JSON.parse(v);
      if (o && typeof o.scale === "string") {
        writeRowGradeState(row, o.scale, o.value != null ? String(o.value) : "");
        return;
      }
    } catch (_e) {
      /* fall through */
    }
    writeRowGradeState(row, "percent", v);
    return;
  }
  const maskSpan = node.querySelector("[data-pii-mask]");
  const piiKey = maskSpan?.dataset?.piiKey;
  if (maskSpan && piiKey) {
    const canon = DATE_PII_KEYS.has(piiKey) ? canonicalizePiiDateBackupValue(piiKey, v) : v;
    piiKeyBackup[piiKey] = canon;
    const showMasked = !forceUnmaskedForExport && isPrivacyPreviewEnabled();
    if (showMasked) {
      maskSpan.textContent = "***";
    } else {
      const lang = getUiLang() === "zh" ? "zh" : "en";
      maskSpan.textContent = DATE_PII_KEYS.has(piiKey) ? formatPiiCanonicalDateForTranscriptPage(canon, lang) : canon;
    }
    return;
  }
  const surf = node.querySelector(".inline-edit-target");
  if (surf) {
    surf.textContent = v;
    if (node.dataset && node.dataset.issueSignatureAuto === "true") {
      issueSignatureLineBackup.text = v;
    }
    if (node.dataset && node.dataset.certInstitutionAuto === "true") {
      certInstitutionLineBackup.text = v;
    }
    return;
  }
  node.textContent = v;
}

function readInstitutionNameAndAddressFromTranscriptPage(page) {
  const p = page && page.nodeType === 1 ? page : document.getElementById("transcript-page");
  if (!p) {
    return { name: "", address: "" };
  }
  const nameEl = p.querySelector('[data-edit-label="Institution Name"] .inline-edit-target');
  const addrEl = p.querySelector('[data-edit-label="Institution Address"] .inline-edit-target');
  return {
    name: nameEl?.textContent?.trim() ?? "",
    address: addrEl?.textContent?.trim() ?? "",
  };
}

function buildCertificationInstitutionLineText(name, address) {
  const n = String(name ?? "").trim();
  const a = String(address ?? "").trim();
  if (!n && !a) {
    return "";
  }
  const zh = getUiLang() === "zh";
  if (zh) {
    if (!n) {
      return `院校：${a}`;
    }
    if (!a) {
      return `院校：${n}`;
    }
    return `院校：${n}，${a}`;
  }
  if (!n) {
    return `Institution: ${a}`;
  }
  if (!a) {
    return `Institution: ${n}`;
  }
  return `Institution: ${n}, ${a}`;
}

function scheduleInstitutionCertLineSync() {
  if (certInstitutionLineSyncRafId) {
    return;
  }
  certInstitutionLineSyncRafId = requestAnimationFrame(() => {
    certInstitutionLineSyncRafId = 0;
    syncCertificationInstitutionLineToTranscript();
  });
}

function syncCertificationInstitutionLineToTranscript() {
  const page = document.getElementById("transcript-page");
  if (!page) {
    return;
  }
  const node = page.querySelector('[data-edit-label="Certification Institution Line"]');
  if (!node) {
    return;
  }
  const { name, address } = readInstitutionNameAndAddressFromTranscriptPage(page);
  const text = buildCertificationInstitutionLineText(name, address);
  const surf = node.querySelector(".inline-edit-target");
  const prev = surf ? (surf.textContent ?? "").trim() : (node.textContent ?? "").trim();
  const roInp = document.querySelector("#editor-form .editor-field--cert-institution-auto input");
  const roShown = text.length > 140 ? `${text.slice(0, 137)}…` : text;
  const roVal = (roInp?.value ?? "").trim();
  if (prev === text && roVal === roShown) {
    return;
  }
  writeEditableSurfaceText(node, text, { allowCertInstitutionLineWrite: true });
  if (roInp && roInp.value !== roShown) {
    roInp.value = roShown;
  }
}

function getEditableNodePlainTextForPayload(node) {
  if (node.matches && node.matches("td.grade-percent-cell") && node.dataset.gradeComposite === "1") {
    const row = node.closest("tr");
    if (!row) {
      return "";
    }
    return JSON.stringify({ scale: readRowGradeScale(row), value: readRowGradeValue(row) });
  }
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

/**
 * Applies language-specific sample content for the transcript body (header, PII, course rows).
 * English presets mirror the shipped HTML; Chinese presets use {@link window.TRANSCRIPT_I18N_PACK}.zh.transcriptDemo.
 */
function applyTranscriptDemoPresets() {
  teardownTranscriptSignatureTamperGuards();
  const z = getUiLang();
  const demo = window.TRANSCRIPT_I18N_PACK?.[z]?.transcriptDemo;
  if (!demo) {
    setupTranscriptSignatureTamperGuards();
    return;
  }
  const page = document.getElementById("transcript-page");
  if (!page) {
    setupTranscriptSignatureTamperGuards();
    return;
  }

  if (demo.byEditLabel && typeof demo.byEditLabel === "object") {
    Object.entries(demo.byEditLabel).forEach(([label, val]) => {
      if (val == null) {
        return;
      }
      if (label === "Certification Institution Line") {
        return;
      }
      if (label === "Issue And Digital Signature") {
        return;
      }
      const node = page.querySelector(`[data-edit-label="${label}"]`);
      if (node) {
        writeEditableSurfaceText(node, String(val));
      }
    });
  }
  syncCertificationInstitutionLineToTranscript();

  if (demo.pii && typeof demo.pii === "object") {
    const lang = getUiLang() === "zh" ? "zh" : "en";
    Object.entries(demo.pii).forEach(([key, val]) => {
      const span = page.querySelector(`[data-pii-key="${key}"]`);
      if (!span) {
        return;
      }
      const v = String(val ?? "");
      piiKeyBackup[key] = DATE_PII_KEYS.has(key) ? canonicalizePiiDateBackupValue(key, v) : v;
      const canon = piiKeyBackup[key];
      span.textContent = isPrivacyPreviewEnabled()
        ? "***"
        : DATE_PII_KEYS.has(key)
          ? formatPiiCanonicalDateForTranscriptPage(String(canon), lang)
          : String(canon);
    });
  }

  const cMap = demo.coursesBySemester;
  if (cMap && typeof cMap === "object") {
    page.querySelectorAll(".term-block:not(.term-block-inactive)").forEach((block) => {
      const kind = block.dataset.semesterKind;
      if (kind !== "fall" && kind !== "spring") {
        return;
      }
      const rowList = cMap[kind];
      if (!Array.isArray(rowList)) {
        return;
      }
      const trs = block.querySelectorAll("tbody tr");
      rowList.forEach((cells, ri) => {
        const tr = trs[ri];
        if (!tr || !Array.isArray(cells)) {
          return;
        }
        const tds = tr.querySelectorAll("td");
        for (let c = 0; c < 8 && c < cells.length; c += 1) {
          if (!tds[c]) {
            continue;
          }
          if (c === COURSE_COL_PERCENT) {
            const tr = tds[c].closest("tr");
            if (tr) {
              writeRowGradeState(tr, "percent", String(cells[c] ?? ""));
            } else {
              tds[c].textContent = String(cells[c] ?? "");
            }
            continue;
          }
          writeEditableSurfaceText(tds[c], String(cells[c] ?? ""));
        }
        applyGradeAndQualityFromPercent(tr);
      });
    });
  }
  setupTranscriptSignatureTamperGuards();
}

const AUTOSAVE_BUNDLE_VERSION = 5;
/**
 * PII keys stored only in `bundle.shared` (stripped from `en` / `zh` partitions).
 * Domestic GPA inputs and `studentId` are cross-language authoritative / identity-aligned fields.
 */
const AUTOSAVE_SHARED_PII_KEYS = Object.freeze(["dateOfBirth", "studentEmail", "studentId"]);

function createEmptySharedPartition() {
  return {
    personalSsn: "",
    chsiCode: "",
    dateOfBirth: "",
    studentEmail: "",
    studentId: "",
    domesticTermGpa1: "",
    domesticTermGpa2: "",
  };
}

function cloneJsonDeep(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (_e) {
    return null;
  }
}

function extractSharedFieldsFromSnapshot(snap) {
  if (!snap || typeof snap !== "object") {
    return createEmptySharedPartition();
  }
  const pii = snap.pii && typeof snap.pii === "object" ? snap.pii : {};
  return {
    personalSsn: String(snap.personalSsn || "")
      .replace(/\D/g, "")
      .slice(0, 18),
    chsiCode: String(snap.chsiCode || ""),
    dateOfBirth: pii.dateOfBirth != null ? String(pii.dateOfBirth) : "",
    studentEmail: pii.studentEmail != null ? String(pii.studentEmail) : "",
    studentId: pii.studentId != null ? String(pii.studentId) : "",
    domesticTermGpa1: normalizeDomesticGpaForAutosave(snap.domesticTermGpa1 ?? ""),
    domesticTermGpa2: normalizeDomesticGpaForAutosave(snap.domesticTermGpa2 ?? ""),
  };
}

function stripSharedFieldsFromSnapshot(snap) {
  const o = cloneJsonDeep(snap);
  if (!o) {
    return null;
  }
  o.personalSsn = "";
  o.chsiCode = "";
  if (!o.pii || typeof o.pii !== "object") {
    o.pii = {};
  } else {
    o.pii = { ...o.pii };
  }
  AUTOSAVE_SHARED_PII_KEYS.forEach((k) => {
    delete o.pii[k];
  });
  delete o.domesticTermGpa1;
  delete o.domesticTermGpa2;
  return o;
}

function mergeSharedFieldsIntoSnapshot(langPart, shared) {
  const o = cloneJsonDeep(langPart);
  if (!o) {
    return null;
  }
  if (!shared || typeof shared !== "object") {
    return o;
  }
  o.personalSsn = String(shared.personalSsn || "")
    .replace(/\D/g, "")
    .slice(0, 18);
  o.chsiCode = String(shared.chsiCode || "");
  if (!o.pii || typeof o.pii !== "object") {
    o.pii = {};
  } else {
    o.pii = { ...o.pii };
  }
  o.pii.dateOfBirth = shared.dateOfBirth != null ? String(shared.dateOfBirth) : "";
  o.pii.studentEmail = shared.studentEmail != null ? String(shared.studentEmail) : "";
  o.pii.studentId = shared.studentId != null ? String(shared.studentId) : "";
  o.domesticTermGpa1 = normalizeDomesticGpaForAutosave(
    shared.domesticTermGpa1 != null ? shared.domesticTermGpa1 : ""
  );
  o.domesticTermGpa2 = normalizeDomesticGpaForAutosave(
    shared.domesticTermGpa2 != null ? shared.domesticTermGpa2 : ""
  );
  return o;
}

function isAutosaveBundlePayload(obj) {
  return Boolean(
    obj &&
      typeof obj === "object" &&
      obj.shared &&
      typeof obj.shared === "object" &&
      Object.prototype.hasOwnProperty.call(obj, "en") &&
      Object.prototype.hasOwnProperty.call(obj, "zh") &&
      Number(obj.v) >= AUTOSAVE_BUNDLE_VERSION
  );
}

function migrateFlatAutosaveToBundle(flat) {
  if (!flat || typeof flat !== "object") {
    return {
      v: AUTOSAVE_BUNDLE_VERSION,
      persistAcrossTabClose: false,
      shared: createEmptySharedPartition(),
      en: null,
      zh: null,
    };
  }
  const ui = flat.uiLang === "zh" ? "zh" : "en";
  const shared = extractSharedFieldsFromSnapshot(flat);
  const stripped = stripSharedFieldsFromSnapshot(flat);
  return {
    v: AUTOSAVE_BUNDLE_VERSION,
    persistAcrossTabClose: false,
    shared,
    en: ui === "en" ? stripped : null,
    zh: ui === "zh" ? stripped : null,
  };
}

function parseStoredAutosavePayload(raw) {
  if (!raw || !String(raw).trim()) {
    return { bundle: null, legacyFlat: null };
  }
  let obj = null;
  try {
    obj = JSON.parse(raw);
  } catch (_e) {
    return { bundle: null, legacyFlat: null };
  }
  if (!obj || typeof obj !== "object") {
    return { bundle: null, legacyFlat: null };
  }
  if (isAutosaveBundlePayload(obj)) {
    return { bundle: obj, legacyFlat: null };
  }
  if (obj.editByLabel || obj.pii || obj.coursesBySemester) {
    return { bundle: null, legacyFlat: obj };
  }
  return { bundle: null, legacyFlat: null };
}

function readAutosaveBundleFromLocalStorage() {
  let raw = "";
  try {
    raw = localStorage.getItem(TRANSCRIPT_TOOL_AUTOSAVE_KEY) || "";
  } catch (_e) {
    return null;
  }
  const parsed = parseStoredAutosavePayload(raw);
  if (parsed.bundle) {
    return parsed.bundle;
  }
  if (parsed.legacyFlat) {
    return migrateFlatAutosaveToBundle(parsed.legacyFlat);
  }
  return null;
}

function isLikelyNavigationReload() {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav && nav.type === "reload") {
      return true;
    }
  } catch (_e) {
    /* ignore */
  }
  try {
    if (performance.navigation && performance.navigation.type === 1) {
      return true;
    }
  } catch (_e2) {
    /* ignore */
  }
  return false;
}

function applySharedOverlayFromBundle(shared) {
  if (!shared || typeof shared !== "object") {
    return;
  }
  applyAutosaveSnapshot({
    personalSsn: String(shared.personalSsn || "")
      .replace(/\D/g, "")
      .slice(0, 18),
    chsiCode: String(shared.chsiCode || ""),
    domesticTermGpa1: normalizeDomesticGpaForAutosave(
      shared.domesticTermGpa1 != null ? shared.domesticTermGpa1 : ""
    ),
    domesticTermGpa2: normalizeDomesticGpaForAutosave(
      shared.domesticTermGpa2 != null ? shared.domesticTermGpa2 : ""
    ),
    pii: {
      dateOfBirth: shared.dateOfBirth != null ? String(shared.dateOfBirth) : "",
      studentEmail: shared.studentEmail != null ? String(shared.studentEmail) : "",
      studentId: shared.studentId != null ? String(shared.studentId) : "",
    },
  });
}

/**
 * Loads `bundle[uiLang]` merged with `bundle.shared`, or full demo presets + shared overlay when the slot is empty.
 */
function applyAutosaveBundlePartitionForUiLang(uiLang) {
  const want = uiLang === "zh" ? "zh" : "en";
  const bundle = readAutosaveBundleFromLocalStorage();
  if (!bundle) {
    applyTranscriptDemoPresets();
    return;
  }
  const part = bundle[want];
  if (part && typeof part === "object") {
    const merged = mergeSharedFieldsIntoSnapshot(part, bundle.shared);
    if (merged) {
      applyAutosaveSnapshot(merged);
    }
  } else {
    applyTranscriptDemoPresets();
    applySharedOverlayFromBundle(bundle.shared);
  }
}

/**
 * Persists the current UI language slot, then loads the other locale partition (+ shared fields) from autosave.
 * Replaces the prior language-switch privacy modal: EN/ZH editor state is stored separately in `localStorage`.
 */
function handleLangSelectChangeWithPersistedPartitions() {
  if (suppressLangSelectProgrammatic) {
    return;
  }
  const langSelect = document.getElementById("lang-select");
  if (!langSelect) {
    return;
  }
  const newLang = langSelect.value;
  if (newLang !== "zh" && newLang !== "en") {
    return;
  }
  const oldLang = window.__TRANSCRIPT_UI_LANG__ === "zh" ? "zh" : "en";
  if (newLang === oldLang) {
    return;
  }
  suppressLangSelectProgrammatic = true;
  langSelect.value = oldLang;
  suppressLangSelectProgrammatic = false;
  saveToLocalStorage();
  suppressLangSelectProgrammatic = true;
  langSelect.value = newLang;
  suppressLangSelectProgrammatic = false;
  applyAutosaveBundlePartitionForUiLang(newLang);
  if (typeof window.applyTranscriptLanguage === "function") {
    window.applyTranscriptLanguage(newLang);
  }
  resetEditorHistory();
  scheduleAutosaveToLocalStorage();
  scheduleEditorHistoryCapture();
  void updateSecurityArtifacts();
}

function collectIntegrityPayload() {
  const editable = Array.from(document.querySelectorAll("[data-edit-label]"))
    .filter(
      (node) =>
        !node.closest(".term-block-inactive") &&
        node.dataset.issueSignatureAuto !== "true" &&
        node.dataset.certInstitutionAuto !== "true"
    )
    .map((node) => ({
      label: node.dataset.editLabel || "",
      value: getEditableNodePlainTextForPayload(node),
    }));
  const rows = Array.from(document.querySelectorAll(".term-block:not(.term-block-inactive) tbody tr")).map((row) =>
    Array.from(row.querySelectorAll("td")).map((td, colIdx) =>
      colIdx === COURSE_COL_PERCENT ? getCoursePercentCellPayloadText(td) : td.textContent?.trim() || ""
    )
  );
  const docId = document.getElementById("document-id")?.textContent?.trim() || "";
  const ack = document.getElementById("legal-ack")?.checked || false;
  const personalSsn = document.getElementById("personal-ssn-input")?.value?.trim() ?? "";
  const chsiVerifyCode = document.getElementById("chsi-verify-code-input")?.value?.trim() ?? "";
  return JSON.stringify({
    docId,
    ack,
    editable,
    rows,
    personalSsn,
    chsiVerifyCode,
    non_official: true,
  });
}

function isSingleTermLayout() {
  const el = document.getElementById("term-layout-mode");
  return Boolean(el && el.value === "one");
}

function getActiveTermBlocks() {
  return Array.from(document.querySelectorAll(".term-block:not(.term-block-inactive)"));
}

/**
 * Optional domestic (institutional) term GPAs from the sidebar. Single-term layout ignores Term 2.
 * @returns {[number | null, number | null]}
 */
/** Treat stray zeros from older autosave as empty so placeholders stay visible. */
function normalizeDomesticGpaFromAutosave(raw) {
  if (raw == null) {
    return "";
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || Math.abs(raw) < 1e-9) {
      return "";
    }
    return String(raw);
  }
  const s = String(raw).trim();
  if (s === "" || s === "0" || s === "0.0" || s === "0.00") {
    return "";
  }
  const n = parseFloat(s);
  if (Number.isFinite(n) && Math.abs(n) < 1e-9) {
    return "";
  }
  return s;
}

function normalizeDomesticGpaForAutosave(raw) {
  return normalizeDomesticGpaFromAutosave(raw);
}

function readDomesticTermGpas() {
  const e1 = document.getElementById("domestic-term-gpa-1");
  const e2 = document.getElementById("domestic-term-gpa-2");
  if (!e1 || !e2) {
    return [null, null];
  }
  const single = isSingleTermLayout();
  const parseOne = (raw) => {
    const t = String(raw ?? "").trim();
    if (t === "") {
      return null;
    }
    const n = parseFloat(t);
    if (!Number.isFinite(n) || n < 0 || n > 4.0 + 1e-9) {
      return null;
    }
    return n;
  };
  return [parseOne(e1.value), single ? null : parseOne(e2.value)];
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
  const d2 = document.getElementById("domestic-term-gpa-2");
  const d2Lbl = document.getElementById("domestic-term-gpa-2-label");
  if (d2) {
    d2.disabled = single;
    d2.classList.toggle("term-control-muted", single);
  }
  if (d2Lbl) {
    d2Lbl.classList.toggle("term-control-muted", single);
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
    fillTermTotals({ skipGradeRowPass: true });
  });
}

/**
 * SHA-256 over bytes when {@link SubtleCrypto#digest} is unavailable (e.g. <code>file://</code>).
 * MIT-style compact core; length uses {@link BigInt} when present for &gt;4GiB-safe bit counts.
 */
function sha256DigestHexJs(u8) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
    0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0xfc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3,
    0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814,
    0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const rotr = (n, x) => (x >>> n) | (x << (32 - n));
  const l = u8.length;
  const z = (56 - ((l + 1) % 64) + 64) % 64;
  const buf = new Uint8Array(l + 1 + z + 8);
  buf.set(u8);
  buf[l] = 0x80;
  const dv = new DataView(buf.buffer);
  let bitLenHi = 0;
  let bitLenLo = 0;
  if (typeof BigInt === "function") {
    const bits = BigInt(l) * 8n;
    bitLenHi = Number((bits >> 32n) & 0xffffffffn);
    bitLenLo = Number(bits & 0xffffffffn);
  } else {
    bitLenLo = (l >>> 0) * 8;
    bitLenHi = ((l / 0x20000000) | 0) * 8;
  }
  dv.setUint32(buf.length - 8, bitLenHi >>> 0, false);
  dv.setUint32(buf.length - 4, bitLenLo >>> 0, false);
  let H0 = 0x6a09e667;
  let H1 = 0xbb67ae85;
  let H2 = 0x3c6ef372;
  let H3 = 0xa54ff53a;
  let H4 = 0x510e527f;
  let H5 = 0x9b05688c;
  let H6 = 0x1f83d9ab;
  let H7 = 0x5be0cd19;
  const W = new Uint32Array(64);
  for (let off = 0; off < buf.length; off += 64) {
    for (let i = 0; i < 16; i += 1) {
      W[i] = dv.getUint32(off + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3);
      const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = H0;
    let b = H1;
    let c = H2;
    let d = H3;
    let e = H4;
    let f = H5;
    let g = H6;
    let h = H7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }
  const H = [H0, H1, H2, H3, H4, H5, H6, H7];
  let hex = "";
  for (let i = 0; i < 8; i += 1) {
    const x = H[i];
    for (let k = 28; k >= 0; k -= 4) {
      hex += ((x >>> k) & 15).toString(16);
    }
  }
  return hex;
}

/** Prefer Web Crypto; fall back to {@link sha256DigestHexJs} when <code>crypto.subtle</code> is missing. */
async function sha256HexFromBinary(u8) {
  const buf = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  if (globalThis.crypto && crypto.subtle && typeof crypto.subtle.digest === "function") {
    try {
      const digest = await crypto.subtle.digest("SHA-256", ab);
      return hexFromBuffer(digest);
    } catch (_e) {
      /* fall through to JS implementation */
    }
  }
  return sha256DigestHexJs(buf);
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  return sha256HexFromBinary(data);
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
  const fileEl = document.getElementById("export-qr-fallback-file");
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
  const onFile = typeof location !== "undefined" && location.protocol === "file:";
  const showQrProblem = libMissing || renderOk === false;
  if (fileEl) {
    fileEl.hidden = !(onFile && showQrProblem);
  }
  const fileHidden = !fileEl || fileEl.hidden;
  wrap.hidden = libEl.hidden && renderEl.hidden && fileHidden;
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
  const anchors = transcriptToolExportAnchors;
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
  const anchors = transcriptToolExportAnchors;
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
  const anchors = transcriptToolExportAnchors;
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
  const anchors = transcriptToolExportAnchors;
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

function readComplianceMirrorSummaryLines() {
  try {
    const raw = localStorage.getItem(COMPLIANCE_LS_KEY);
    if (!raw) {
      return [];
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) {
      return [];
    }
    return arr.map((e) => {
      const ts = typeof e.ts === "number" ? e.ts : 0;
      const ty = e.type != null ? String(e.type) : "unknown";
      return `${formatAuditLocalWallClock(ts)} - ${ty}`;
    });
  } catch (_e) {
    return [];
  }
}

function resolveHtml2canvasVersionString() {
  try {
    if (typeof window.html2canvas === "function" && window.html2canvas.version) {
      return String(window.html2canvas.version);
    }
  } catch (_e) {
    /* ignore */
  }
  return "unknown (bundled; see README)";
}

function resolveJsPdfVersionString() {
  try {
    const ns = window.jspdf;
    if (ns && ns.jsPDF && ns.jsPDF.API && ns.jsPDF.API.version) {
      return String(ns.jsPDF.API.version);
    }
  } catch (_e) {
    /* ignore */
  }
  return "unknown (bundled)";
}

function appendExportSuccessReceiptUI(statusEl, docId, fullHashLowerHex) {
  if (!statusEl || !fullHashLowerHex) {
    return;
  }
  const p = uiPack();
  const short8 = fullHashLowerHex.slice(0, 8).toUpperCase();
  const summary =
    typeof p.exportReceiptSummary === "function" ? p.exportReceiptSummary(docId, short8) : "";
  if (summary) {
    statusEl.textContent = `${statusEl.textContent}\n\n${summary}`;
  }
  const panel = document.getElementById("export-receipt-panel");
  const body = document.getElementById("export-receipt-body");
  if (!panel || !body) {
    return;
  }
  const utcIso = new Date().toISOString();
  const localStr = formatAuditLocalWallClock(Date.now());
  const fullDisp = fullHashLowerHex.toUpperCase();
  body.textContent =
    typeof p.exportReceiptDetail === "function"
      ? p.exportReceiptDetail(docId, fullDisp, localStr, utcIso)
      : "";
  panel.hidden = false;
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
  const anchors = transcriptToolExportAnchors;
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
  if (payload === lastIntegrityPayloadString) {
    return;
  }
  const hash = await sha256Hex(payload);
  if (hash !== lastSecurityHash) {
    hashEl.dataset.fullHash = hash;
    hashEl.textContent = hash.slice(0, 16).toUpperCase();
    lastSecurityHash = hash;
    setLayoutFingerprintEditedAtDisplay(Date.now());
  }
  lastIntegrityPayloadString = payload;
  scheduleLiveExportQrPreview();
  syncIssueAndDigitalSignatureLiveLine();
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
        if (colIdx === COURSE_COL_PERCENT) {
          cell.dataset.gradeComposite = "1";
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

  // Stable per-row slot for sidebar / export ordering (import order); independent of tbody DOM order.
  ensureCourseRowSidebarSlots();

  // Keep `Term N Row M - …` keys aligned with current `.term-block` DOM order (e.g. fall/spring swap).
  // Without this, `if (!cell.dataset.editLabel)` above leaves stale labels on course cells.
  Array.from(document.querySelectorAll(".term-block")).forEach((block) => {
    updateRowIndexes(block);
  });
}

function fillEditorGradeTypeSelectOptions(selectEl) {
  const t = uiPack();
  const pairs = [
    ["percent", t.gradeTypePercent || "Percent"],
    ["five", t.gradeTypeFive || "Five-tier"],
    ["pass-fail", t.gradeTypePassFail || "Pass/Fail"],
    ["exempt", t.gradeTypeExempt || "Exempt / waiver"],
  ];
  selectEl.innerHTML = "";
  pairs.forEach(([val, lab]) => {
    const o = document.createElement("option");
    o.value = val;
    o.textContent = lab;
    selectEl.appendChild(o);
  });
}

function populateEditorGradeValueSlot(slotEl, scale, value) {
  slotEl.replaceChildren();
  if (scale === "percent") {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "editor-grade-percent-input";
    inp.setAttribute("inputmode", "decimal");
    inp.placeholder = "0–100";
    inp.value = value;
    slotEl.appendChild(inp);
    return;
  }
  if (scale === "five" || scale === "pass-fail") {
    slotEl.appendChild(rebuildGradeKeywordSelect(scale, value));
    return;
  }
  if (scale === "exempt") {
    const p = document.createElement("p");
    p.className = "editor-grade-exempt-note";
    p.textContent = uiPack().editorGradeExemptHint || uiPack().exemptGradeDisplay || "—";
    slotEl.appendChild(p);
  }
}

function readGradeCompositeFromEditorField(field) {
  const typeSel = field.querySelector(".editor-grade-type");
  const scale = typeSel?.value || "percent";
  const inp = field.querySelector(".editor-grade-percent-input");
  const kw = field.querySelector(".editor-grade-keyword-select");
  if (scale === "percent") {
    return { scale, value: inp?.value?.trim() ?? "" };
  }
  if (scale === "five" || scale === "pass-fail") {
    return { scale, value: kw?.value ?? "" };
  }
  return { scale: "exempt", value: "" };
}

function mountCoursePercentCreditsValidation(field, input, editLabel) {
  const lab = editLabel || "";
  const isPercent = /\s-\sPercent$/u.test(lab);
  const isCredits = /\s-\sCredits$/u.test(lab);
  if (!isPercent && !isCredits) {
    return;
  }
  const errEl = document.createElement("p");
  errEl.className = "editor-field-error-msg";
  errEl.hidden = true;
  field.appendChild(errEl);
  const run = () => {
    const raw = String(input.value || "").trim();
    let ok = true;
    let msg = "";
    if (raw === "") {
      ok = true;
    } else if (isPercent) {
      const n = parseTranscriptNumber(raw);
      ok = Number.isFinite(n) && n >= 0 && n <= 100;
      msg = ok ? "" : sidebarI18nText("editorPercentInvalidHint") || "";
    } else {
      const n = parseTranscriptNumber(raw);
      ok = Number.isFinite(n) && n >= 0 && n <= 999;
      msg = ok ? "" : sidebarI18nText("editorCreditsInvalidHint") || "";
    }
    input.classList.toggle("editor-field-input-error", !ok);
    errEl.textContent = msg;
    errEl.hidden = ok;
  };
  input.addEventListener("input", run);
  run();
}

function attachGradeCompositeEditorListeners(field, row, node) {
  const typeSel = field.querySelector(".editor-grade-type");
  const slot = field.querySelector(".editor-grade-value-slot");
  let complianceDebounceTimer = null;
  field.addEventListener("focusin", () => {
    field.dataset.complianceEditBaseline = JSON.stringify(readGradeCompositeFromEditorField(field));
  });
  const push = () => {
    const st = readGradeCompositeFromEditorField(field);
    writeRowGradeState(row, st.scale, st.value);
    applyGradeAndQualityFromPercent(row);
    fillTermTotals({ skipGradeRowPass: true });
    scheduleSecurityArtifactsUpdate();
    scheduleAutosaveToLocalStorage();
    scheduleEditorHistoryCapture();
    const baseline = field.dataset.complianceEditBaseline ?? "";
    const after = JSON.stringify(st);
    clearTimeout(complianceDebounceTimer);
    complianceDebounceTimer = setTimeout(() => {
      if (baseline !== after) {
        void logFieldEditComplianceRecord(node.dataset.editLabel || "", baseline, after);
        field.dataset.complianceEditBaseline = after;
      }
    }, 800);
  };
  const wireCompositePercentValidation = () => {
    field.querySelector(".editor-grade-percent-error")?.remove();
    const pctIn = field.querySelector(".editor-grade-percent-input");
    if (!pctIn || typeSel?.value !== "percent") {
      return;
    }
    const errEl = document.createElement("p");
    errEl.className = "editor-field-error-msg editor-grade-percent-error";
    errEl.hidden = true;
    field.appendChild(errEl);
    const runPct = () => {
      const raw = String(pctIn.value || "").trim();
      let ok = true;
      let msg = "";
      if (raw === "") {
        ok = true;
      } else {
        const n = parseTranscriptNumber(raw);
        ok = Number.isFinite(n) && n >= 0 && n <= 100;
        msg = ok ? "" : sidebarI18nText("editorPercentInvalidHint") || "";
      }
      pctIn.classList.toggle("editor-field-input-error", !ok);
      errEl.textContent = msg;
      errEl.hidden = ok;
    };
    pctIn.addEventListener("input", runPct);
    runPct();
  };
  typeSel?.addEventListener("change", () => {
    writeRowGradeState(row, typeSel.value, "");
    if (slot) {
      populateEditorGradeValueSlot(slot, typeSel.value, "");
    }
    wireCompositePercentValidation();
    push();
  });
  field.addEventListener("input", (ev) => {
    if (ev.target.classList.contains("editor-grade-percent-input")) {
      push();
    }
  });
  field.addEventListener("change", (ev) => {
    if (ev.target.classList.contains("editor-grade-keyword-select")) {
      push();
    }
  });
  wireCompositePercentValidation();
}

function buildEditor() {
  const form = document.getElementById("editor-form");
  if (!form) {
    return;
  }
  if (certInstitutionLineSyncRafId) {
    cancelAnimationFrame(certInstitutionLineSyncRafId);
    certInstitutionLineSyncRafId = 0;
  }
  form.innerHTML = "";

  const transcriptPageRoot = document.getElementById("transcript-page");
  const editableNodes = orderEditableNodesForSidebarStableCourseRows(
    Array.from(document.querySelectorAll("[data-edit-label]")).filter((node) => isTranscriptSidebarEditNode(node))
  );
  editableNodes.forEach((node, idx) => {
    const field = document.createElement("div");
    field.className = "editor-field";

    const label = document.createElement("label");
    const id = `field-${idx + 1}`;
    label.setAttribute("for", id);
    label.textContent = localizedEditorFieldLabel(node.dataset.editLabel);

    const maskSpan = node.querySelector("[data-pii-mask]");
    const piiKey = maskSpan?.dataset?.piiKey;

    if (node.dataset.issueSignatureAuto === "true") {
      field.className = "editor-field editor-field--issue-signature-auto";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = id;
      inp.readOnly = true;
      inp.tabIndex = -1;
      inp.autocomplete = "off";
      inp.title = sidebarI18nText("issueSignatureAutoTitle") || "";
      const surf = node.querySelector(".inline-edit-target");
      const initial = (surf?.textContent?.trim() || issueSignatureLineBackup.text || "").trim();
      inp.value = initial.length > 140 ? `${initial.slice(0, 137)}…` : String(initial);
      const hint = document.createElement("p");
      hint.className = "field-input-hint field-input-hint--muted";
      hint.textContent = sidebarI18nText("issueSignatureAutoHint") || "";
      field.appendChild(label);
      field.appendChild(inp);
      field.appendChild(hint);
      form.appendChild(field);
      return;
    }

    if (node.dataset.certInstitutionAuto === "true") {
      field.className = "editor-field editor-field--cert-institution-auto";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = id;
      inp.readOnly = true;
      inp.tabIndex = -1;
      inp.autocomplete = "off";
      inp.title = sidebarI18nText("certInstitutionLineAutoTitle") || "";
      const surf = node.querySelector(".inline-edit-target");
      let initial = "";
      if (transcriptPageRoot) {
        const { name, address } = readInstitutionNameAndAddressFromTranscriptPage(transcriptPageRoot);
        initial = buildCertificationInstitutionLineText(name, address);
      } else {
        initial = certInstitutionLineBackup.text || (surf?.textContent?.trim() ?? "");
      }
      certInstitutionLineBackup.text = initial;
      inp.value = initial.length > 140 ? `${initial.slice(0, 137)}…` : String(initial);
      const hint = document.createElement("p");
      hint.className = "field-input-hint field-input-hint--muted";
      hint.textContent = sidebarI18nText("certInstitutionLineAutoHint") || "";
      field.appendChild(label);
      field.appendChild(inp);
      field.appendChild(hint);
      form.appendChild(field);
      return;
    }

    if (node.dataset.dateIssuedAuto === "true") {
      field.className = "editor-field editor-field--date-issued-auto";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = id;
      inp.readOnly = true;
      inp.tabIndex = -1;
      inp.autocomplete = "off";
      inp.placeholder = sidebarI18nText("datePlaceholderYmd") || "YYYY-MM-DD";
      inp.title = sidebarI18nText("dateIssuedAutoTitle") || "";
      let initial = piiKeyBackup.dateIssued;
      if (initial === undefined || initial === null) {
        const shownRaw = maskSpan?.textContent?.trim() || "";
        const shown = shownRaw === "***" ? "" : shownRaw;
        initial = canonicalizePiiDateBackupValue("dateIssued", shown);
        piiKeyBackup.dateIssued = initial;
      }
      const full = String(initial ?? "");
      inp.value = /^(\d{4}-\d{2}-\d{2})/u.test(full) ? full.slice(0, 10) : full;
      const hint = document.createElement("p");
      hint.className = "field-input-hint field-input-hint--muted";
      hint.textContent = sidebarI18nText("dateIssuedAutoHint") || "";
      field.appendChild(label);
      field.appendChild(inp);
      field.appendChild(hint);
      form.appendChild(field);
      return;
    }

    const appendStandardInput = (input) => {
      let complianceDebounceTimer = null;
      input.addEventListener("focusin", () => {
        input.dataset.complianceEditBaseline = input.value;
      });
      input.addEventListener("input", () => {
        const v = input.value;
        writeEditableSurfaceText(node, v);
        if (node.dataset.editLabel === "Institution Name" || node.dataset.editLabel === "Institution Address") {
          scheduleInstitutionCertLineSync();
        }

        const row = node.closest("tr");
        if (row && row.closest(".term-block")) {
          applyGradeAndQualityFromPercent(row);
          fillTermTotals({ skipGradeRowPass: true });
        }
        scheduleSecurityArtifactsUpdate();
        scheduleAutosaveToLocalStorage();
        scheduleEditorHistoryCapture();

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
      const elab = node.dataset.editLabel || "";
      const isCourseDescriptionMove =
        /^Term \d+ Row \d+ - Description$/u.test(elab) && node.matches("td") && node.closest(".term-block tbody");
      if (isCourseDescriptionMove) {
        const courseRow = node.closest("tr");
        if (courseRow) {
          field.dataset.rowMoveLabel = elab;
          const shell = document.createElement("div");
          shell.className = "editor-input-row-with-moves";
          shell.appendChild(input);
          field.appendChild(shell);
          form.appendChild(field);
          mountCourseRowOrderControls(field, courseRow, shell);
          return;
        }
      }
      field.appendChild(input);
      mountCoursePercentCreditsValidation(field, input, elab);
      form.appendChild(field);
    };

    if (node.matches("td.grade-percent-cell") && node.dataset.gradeComposite === "1") {
      const row = node.closest("tr");
      if (!row) {
        return;
      }
      field.dataset.gradeCompositeField = "1";
      const typeSel = document.createElement("select");
      typeSel.className = "editor-grade-type";
      typeSel.id = id;
      fillEditorGradeTypeSelectOptions(typeSel);
      typeSel.value = readRowGradeScale(row);
      const slot = document.createElement("div");
      slot.className = "editor-grade-value-slot";
      populateEditorGradeValueSlot(slot, typeSel.value, readRowGradeValue(row));
      label.setAttribute("for", id);
      field.appendChild(label);
      field.appendChild(typeSel);
      field.appendChild(slot);
      attachGradeCompositeEditorListeners(field, row, node);
      form.appendChild(field);
      return;
    }

    const input = document.createElement("input");
    input.id = id;
    if (piiKey === "dateOfBirth") {
      input.placeholder = sidebarI18nText("datePlaceholderYmd") || "YYYY-MM-DD";
    }

    if (maskSpan && piiKey) {
      let initial = piiKeyBackup[piiKey];
      if (initial === undefined || initial === null) {
        const shownRaw = maskSpan.textContent.trim();
        const shown = shownRaw === "***" ? "" : shownRaw;
        initial = DATE_PII_KEYS.has(piiKey) ? canonicalizePiiDateBackupValue(piiKey, shown) : shown;
        piiKeyBackup[piiKey] = initial;
      }
      input.value =
        piiKey === "dateOfBirth"
          ? canonicalizeDateOfBirthForBackup(String(piiKeyBackup[piiKey] ?? ""))
          : String(piiKeyBackup[piiKey] ?? "");
    } else {
      const surf = node.querySelector(".inline-edit-target");
      input.value = surf ? surf.textContent.trim() : node.textContent.trim();
    }

    if (node.dataset.editLabel === "Institution Address") {
      input.placeholder = sidebarI18nText("institutionAddressPlaceholder") || input.placeholder;
    }

    appendStandardInput(input);
  });
  syncCertificationInstitutionLineToTranscript();
}

/**
 * Re-writes `data-edit-label` on editable cells in one term table after row reorder so sidebar keys stay
 * `Term N Row M - …` aligned with DOM order.
 */
function updateRowIndexes(termBlock) {
  if (!termBlock) {
    return;
  }
  const termIdx = Array.from(document.querySelectorAll(".term-block")).indexOf(termBlock);
  if (termIdx < 0) {
    return;
  }
  const termSlot = `Term ${termIdx + 1}`;
  Array.from(termBlock.querySelectorAll("tbody tr")).forEach((row, rowIdx) => {
    Array.from(row.querySelectorAll("td")).forEach((cell, colIdx) => {
      if (colIdx === COURSE_COL_GRADE_POINT || colIdx === COURSE_COL_GRADE || colIdx === COURSE_COL_QUALITY) {
        cell.dataset.computed = "true";
        delete cell.dataset.editLabel;
        return;
      }
      if (colIdx === COURSE_COL_PERCENT) {
        cell.dataset.gradeComposite = "1";
      }
      const headerName = COURSE_EDIT_HEADER_KEYS_EN[colIdx] || `Column ${colIdx + 1}`;
      cell.dataset.editLabel = `${termSlot} Row ${rowIdx + 1} - ${headerName}`;
    });
  });
}

/**
 * ⏫/▲/▼/⏬ row reorder controls sit inside the sidebar “Description” (course title) input row, right end of the composite control.
 * ⏫/⏬ move to first/last row in the term tbody; ▲/▼ swap with the adjacent row only.
 * @param {HTMLElement} field
 * @param {HTMLTableRowElement} tr
 * @param {HTMLElement} shell Host for the text input + buttons (`.editor-input-row-with-moves`).
 */
function mountCourseRowOrderControls(field, tr, shell) {
  if (!field || !tr || !shell) {
    return;
  }
  shell.querySelector(".course-row-actions")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "course-row-actions";
  const topAria = sidebarI18nText("courseRowMoveTopAria") || "Move course row to top of term list";
  const bottomAria = sidebarI18nText("courseRowMoveBottomAria") || "Move course row to bottom of term list";
  const toTop = document.createElement("button");
  toTop.type = "button";
  toTop.className = "course-row-move-top";
  toTop.setAttribute("aria-label", topAria);
  toTop.title = topAria;
  toTop.textContent = "⏫";
  const up = document.createElement("button");
  up.type = "button";
  up.className = "course-row-move-up";
  up.setAttribute("aria-label", "Move course row up");
  up.textContent = "▲";
  const down = document.createElement("button");
  down.type = "button";
  down.className = "course-row-move-down";
  down.setAttribute("aria-label", "Move course row down");
  down.textContent = "▼";
  const toBottom = document.createElement("button");
  toBottom.type = "button";
  toBottom.className = "course-row-move-bottom";
  toBottom.setAttribute("aria-label", bottomAria);
  toBottom.title = bottomAria;
  toBottom.textContent = "⏬";
  wrap.appendChild(toTop);
  wrap.appendChild(up);
  wrap.appendChild(down);
  wrap.appendChild(toBottom);
  shell.appendChild(wrap);
  toTop.addEventListener("click", (ev) => {
    ev.preventDefault();
    moveRowToTop(tr);
  });
  up.addEventListener("click", (ev) => {
    ev.preventDefault();
    moveRowUp(tr);
  });
  down.addEventListener("click", (ev) => {
    ev.preventDefault();
    moveRowDown(tr);
  });
  toBottom.addEventListener("click", (ev) => {
    ev.preventDefault();
    moveRowToBottom(tr);
  });
  updateCourseRowMoveDisabled(tr, wrap);
}

function updateCourseRowMoveDisabled(tr, wrap) {
  if (!tr || !wrap) {
    return;
  }
  const tbody = tr.parentElement;
  const rows = tbody ? Array.from(tbody.querySelectorAll("tr")) : [];
  const i = rows.indexOf(tr);
  const toTop = wrap.querySelector(".course-row-move-top");
  const up = wrap.querySelector(".course-row-move-up");
  const down = wrap.querySelector(".course-row-move-down");
  const toBottom = wrap.querySelector(".course-row-move-bottom");
  const atFirst = i <= 0;
  const atLast = i < 0 || i >= rows.length - 1;
  if (toTop) {
    toTop.disabled = atFirst;
  }
  if (up) {
    up.disabled = atFirst;
  }
  if (down) {
    down.disabled = atLast;
  }
  if (toBottom) {
    toBottom.disabled = atLast;
  }
}

/** Syncs row-move control disabled state for sidebar row controls after DOM reorder or rebuild. */
function attachRowActionButtons() {
  const page = document.getElementById("transcript-page");
  const form = document.getElementById("editor-form");
  if (!page || !form) {
    return;
  }
  page.querySelectorAll("td .course-row-actions").forEach((el) => el.remove());
  page.querySelectorAll(".term-block:not(.term-block-inactive) tbody tr").forEach((tr) => {
    const tds = tr.querySelectorAll("td");
    const descTd = tds[COURSE_COL_DESCRIPTION];
    const lab = descTd?.dataset?.editLabel;
    if (!lab) {
      return;
    }
    const field = Array.from(form.querySelectorAll(".editor-field")).find((f) => f.dataset.rowMoveLabel === lab);
    if (!field) {
      return;
    }
    const shell = field.querySelector(".editor-input-row-with-moves");
    if (!shell) {
      return;
    }
    let wrap = shell.querySelector(".course-row-actions");
    if (!wrap) {
      mountCourseRowOrderControls(field, tr, shell);
      wrap = shell.querySelector(".course-row-actions");
    }
    if (wrap) {
      updateCourseRowMoveDisabled(tr, wrap);
    }
  });
}

/**
 * After reorder + sidebar rebuild, scroll the row’s field into view and focus the move control the
 * user was using. Focusing the Description input would steal the next mouse click from ▲/▼; focusing
 * the same button keeps Space/Enter repeats reliable and avoids accidental text selection.
 * @param {"up"|"down"|"top"|"bottom"} which
 */
function refocusCourseRowOrderControlAfterReorder(tr, which) {
  if (!tr || !which) {
    return;
  }
  const tds = tr.querySelectorAll("td");
  const descTd = tds[COURSE_COL_DESCRIPTION];
  const lab = descTd?.dataset?.editLabel;
  if (!lab) {
    return;
  }
  const form = document.getElementById("editor-form");
  if (!form) {
    return;
  }
  const field = Array.from(form.querySelectorAll(".editor-field")).find((f) => f.dataset.rowMoveLabel === lab);
  if (!field) {
    return;
  }
  const wrap = field.querySelector(".course-row-actions");
  if (!wrap) {
    return;
  }
  field.scrollIntoView({ block: "nearest", inline: "nearest" });
  const sel =
    which === "up"
      ? ".course-row-move-up"
      : which === "down"
        ? ".course-row-move-down"
        : which === "top"
          ? ".course-row-move-top"
          : ".course-row-move-bottom";
  wrap.querySelector(sel)?.focus();
}

function finalizeCourseRowOrderChange(tr, refocusWhich) {
  applyGradeAndQualityFromPercent(tr);
  fillTermTotals({ skipGradeRowPass: true });
  scheduleAutosaveToLocalStorage();
  scheduleSecurityArtifactsUpdate();
  refreshEditablePanel();
  scheduleEditorHistoryCapture();
  requestAnimationFrame(() => {
    refocusCourseRowOrderControlAfterReorder(tr, refocusWhich);
  });
}

/** Swaps this course row with the previous sibling inside the same tbody. */
function moveRowUp(tr) {
  const prev = tr.previousElementSibling;
  if (!prev) {
    return;
  }
  const termBlock = tr.closest(".term-block");
  tr.parentNode.insertBefore(tr, prev);
  if (termBlock) {
    updateRowIndexes(termBlock);
  }
  finalizeCourseRowOrderChange(tr, "up");
}

/** Moves this course row to the first position inside the same tbody (one action). */
function moveRowToTop(tr) {
  const tbody = tr.parentElement;
  if (!tbody || tbody.tagName !== "TBODY") {
    return;
  }
  const first = tbody.firstElementChild;
  if (!first || first === tr) {
    return;
  }
  const termBlock = tr.closest(".term-block");
  tbody.insertBefore(tr, first);
  if (termBlock) {
    updateRowIndexes(termBlock);
  }
  finalizeCourseRowOrderChange(tr, "top");
}

/** Swaps this course row with the next sibling inside the same tbody. */
function moveRowDown(tr) {
  const next = tr.nextElementSibling;
  if (!next) {
    return;
  }
  const termBlock = tr.closest(".term-block");
  tr.parentNode.insertBefore(tr, next.nextSibling);
  if (termBlock) {
    updateRowIndexes(termBlock);
  }
  finalizeCourseRowOrderChange(tr, "down");
}

/** Moves this course row to the last position inside the same tbody (one action). */
function moveRowToBottom(tr) {
  const tbody = tr.parentElement;
  if (!tbody || tbody.tagName !== "TBODY") {
    return;
  }
  const last = tbody.lastElementChild;
  if (!last || last === tr) {
    return;
  }
  const termBlock = tr.closest(".term-block");
  tbody.appendChild(tr);
  if (termBlock) {
    updateRowIndexes(termBlock);
  }
  finalizeCourseRowOrderChange(tr, "bottom");
}

function refreshEditablePanel() {
  migrateLegacyGradeCellsToRowState();
  registerAutoEditableCells();
  buildEditor();
  fillTermTotals();
  syncGradeTypeSelectOptionLabels();
  syncGpaDiscrepancyReportButtonVisibility();
  scheduleSecurityArtifactsUpdate();
  attachRowActionButtons();
  syncDuplicateRowPickerOptions();
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
    syncPersonalSsnDisplay(forceUnmaskedForExport);
    return;
  }
  const editableNodes = orderEditableNodesForSidebarStableCourseRows(
    Array.from(document.querySelectorAll("[data-edit-label]")).filter((node) => isTranscriptSidebarEditNode(node))
  );
  const fields = Array.from(document.querySelectorAll("#editor-form .editor-field"));
  if (editableNodes.length === 0 || editableNodes.length !== fields.length) {
    /* Signature-line SSN is outside the sidebar↔edit-label pairing; still refresh for PNG/PDF. */
    syncPersonalSsnDisplay(forceUnmaskedForExport);
    return;
  }
  for (let idx = 0; idx < editableNodes.length; idx += 1) {
    const node = editableNodes[idx];
    const field = fields[idx];
    if (field.dataset.gradeCompositeField === "1") {
      const row = node.closest("tr");
      if (row && node.closest(".term-block")) {
        const st = readGradeCompositeFromEditorField(field);
        writeRowGradeState(row, st.scale, st.value);
        applyGradeAndQualityFromPercent(row);
      }
      continue;
    }
    if (field.classList.contains("editor-field--date-issued-auto")) {
      continue;
    }
    if (field.classList.contains("editor-field--issue-signature-auto")) {
      continue;
    }
    if (field.classList.contains("editor-field--cert-institution-auto")) {
      continue;
    }
    const input = field.querySelector("input") || field.querySelector("select");
    const v = input.value;
    const maskSpan = node.querySelector("[data-pii-mask]");
    const piiKey = maskSpan?.dataset?.piiKey;
    if (maskSpan && piiKey) {
      writeEditableSurfaceText(node, v, { forceUnmaskedForExport });
    } else {
      writeEditableSurfaceText(node, v);
    }
    const row = node.closest("tr");
    if (row && row.closest(".term-block")) {
      applyGradeAndQualityFromPercent(row);
    }
  }
  syncCertificationInstitutionLineToTranscript();
  fillTermTotals({ skipGradeRowPass: true });
  syncPersonalSsnDisplay(forceUnmaskedForExport);
  scheduleSecurityArtifactsUpdate(0);
}

function createBlankRow() {
  const row = document.createElement("tr");
  row.dataset.hours = "3.00";
  row.dataset.quality = "9.00";
  row.dataset.gradeScale = "percent";
  row.dataset.gradeValue = "85";
  const nc = uiPack().newCourse || "New Course";
  row.innerHTML = `
    <td>SUBJ</td>
    <td>0000</td>
    <td></td>
    <td class="num grade-percent-cell notranslate" translate="no"><span class="grade-percent-display notranslate" translate="no">85</span></td>
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
  const dupBtn = document.getElementById("duplicate-course-row");
  const termSelect = document.getElementById("term-select");
  if (!addBtn || !removeBtn || !termSelect) {
    return;
  }

  if (termSelect && !termSelect.dataset.dupPickerSync) {
    termSelect.dataset.dupPickerSync = "1";
    termSelect.addEventListener("change", () => syncDuplicateRowPickerOptions());
  }

  if (dupBtn && !dupBtn.dataset.boundDup) {
    dupBtn.dataset.boundDup = "1";
    dupBtn.addEventListener("click", () => duplicateCourseRowAtPicker());
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
    const row = createBlankRow();
    row.dataset.sidebarSlot = allocateNextSidebarSlotForTbody(tbody);
    tbody.appendChild(row);
    refreshEditablePanel();
    attachRowActionButtons();
    scheduleAutosaveToLocalStorage();
    scheduleEditorHistoryCapture();
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
    attachRowActionButtons();
    scheduleAutosaveToLocalStorage();
    scheduleEditorHistoryCapture();
  });
}

const IMPORT_TEMPLATE_FILENAME = "transcript_import_template.csv";
const IMPORT_MAX_ROWS = 300;

function normalizeImportHeaderCell(h) {
  return String(h ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function buildImportColumnIndex(headerRow) {
  const headers = headerRow.map((c) => normalizeImportHeaderCell(c));
  const findIdx = (candidates) => {
    for (let i = 0; i < headers.length; i += 1) {
      if (candidates.includes(headers[i])) {
        return i;
      }
    }
    return undefined;
  };
  return {
    subject: findIdx(["subject", "course type", "课程类型", "课程性质"]),
    courseNumber: findIdx(["course number", "coursenumber", "course no", "course_no", "课号"]),
    description: findIdx(["description", "课程名称", "课程描述"]),
    percent: findIdx(["percent", "%", "百分制", "score", "成绩", "分数", "grade score"]),
    credits: findIdx(["credits", "credit hours", "credit hrs", "学分"]),
    /** Optional: percent | five | pass-fail | exempt (or 百分制 / 五级制 / 二级制 / 免考). */
    gradeType: findIdx([
      "grade type",
      "gradetype",
      "score type",
      "成绩类型",
      "分数类型",
      "等级类型",
      "成绩制",
    ]),
  };
}

function importColumnIndexIsComplete(idx) {
  return (
    idx.subject !== undefined &&
    idx.courseNumber !== undefined &&
    idx.description !== undefined &&
    idx.percent !== undefined &&
    idx.credits !== undefined
  );
}

function clampImportPercent(n) {
  if (!Number.isFinite(n)) {
    return NaN;
  }
  return Math.min(100, Math.max(0, n));
}

function clampImportCredits(n) {
  if (!Number.isFinite(n)) {
    return NaN;
  }
  return Math.min(999, Math.max(0, n));
}

function formatPercentForTranscriptCell(p) {
  if (!Number.isFinite(p)) {
    return "";
  }
  const r = Math.round(p * 100) / 100;
  if (Math.abs(r - Math.round(r)) < 1e-6) {
    return String(Math.round(r));
  }
  return r.toFixed(2);
}

/** Maps template / spreadsheet grade-type cells to internal select values. */
function normalizeImportedGradeType(raw) {
  const s = normalizeImportHeaderCell(raw);
  if (!s) {
    return null;
  }
  const map = Object.freeze({
    percent: "percent",
    "%": "percent",
    "百分制": "percent",
    numeric: "percent",
    number: "percent",
    five: "five",
    "five-tier": "five",
    "five tier": "five",
    "5-tier": "five",
    "五级": "five",
    "五级制": "five",
    "pass-fail": "pass-fail",
    passfail: "pass-fail",
    "pass fail": "pass-fail",
    "二级": "pass-fail",
    "二级制": "pass-fail",
    pf: "pass-fail",
    exempt: "exempt",
    免考: "exempt",
    免修: "exempt",
    "免考/免修": "exempt",
    "免考免修": "exempt",
    waiver: "exempt",
    exemption: "exempt",
  });
  return map[s] || null;
}

function importMapScoreToFiveKeyword(raw) {
  const t = String(raw ?? "").trim();
  if (FIVE_SCALE_MAP[t]) {
    return t;
  }
  const lower = t.toLowerCase();
  const enToZh = Object.freeze({
    excellent: "优秀",
    good: "良好",
    average: "中等",
    fair: "中等",
    satisfactory: "及格",
    marginal: "及格",
    failure: "不及格",
    failed: "不及格",
    fail: "不及格",
  });
  return enToZh[lower] || "";
}

function importMapScoreToPassFailKeyword(raw) {
  const t = String(raw ?? "").trim();
  if (PASS_FAIL_MAP[t]) {
    return t;
  }
  const lower = t.toLowerCase();
  if (lower === "pass" || t === "合格") {
    return "合格";
  }
  if (lower === "fail" || t === "不合格") {
    return "不合格";
  }
  return "";
}

/**
 * Resolves score cell + optional explicit grade type into transcript controls.
 * @returns {{ ok: boolean, mode: string, value: string }}
 */
function parseImportGradeFields(explicitTypeStr, scoreCellStr) {
  const explicit = normalizeImportedGradeType(explicitTypeStr);
  const raw = String(scoreCellStr ?? "").trim();
  if (explicit) {
    if (explicit === "exempt") {
      return { ok: true, mode: "exempt", value: "" };
    }
    if (explicit === "percent") {
      const n = parseTranscriptNumber(raw);
      if (!Number.isFinite(n)) {
        return { ok: false, mode: "percent", value: raw };
      }
      return { ok: true, mode: "percent", value: raw };
    }
    if (explicit === "five") {
      const kw = importMapScoreToFiveKeyword(raw);
      return kw ? { ok: true, mode: "five", value: kw } : { ok: false, mode: "five", value: raw };
    }
    if (explicit === "pass-fail") {
      const kw = importMapScoreToPassFailKeyword(raw);
      return kw ? { ok: true, mode: "pass-fail", value: kw } : { ok: false, mode: "pass-fail", value: raw };
    }
    return { ok: false, mode: explicit, value: raw };
  }

  if (raw === "") {
    return { ok: false, mode: "percent", value: "" };
  }
  if (/^(免考|免修|免考\/免修|exempt|exemption|waiver)$/i.test(raw)) {
    return { ok: true, mode: "exempt", value: "" };
  }
  if (PASS_FAIL_MAP[raw]) {
    return { ok: true, mode: "pass-fail", value: raw };
  }
  const lower = raw.toLowerCase();
  if (lower === "pass" || raw === "合格") {
    return { ok: true, mode: "pass-fail", value: "合格" };
  }
  if (lower === "fail" || raw === "不合格") {
    return { ok: true, mode: "pass-fail", value: "不合格" };
  }
  if (FIVE_SCALE_MAP[raw]) {
    return { ok: true, mode: "five", value: raw };
  }
  const kwFive = importMapScoreToFiveKeyword(raw);
  if (kwFive) {
    return { ok: true, mode: "five", value: kwFive };
  }
  const n = parseTranscriptNumber(raw);
  if (Number.isFinite(n)) {
    return { ok: true, mode: "percent", value: raw };
  }
  return { ok: false, mode: "percent", value: raw };
}

function fillImportedCourseRow(row, rec) {
  const cells = row.querySelectorAll("td");
  if (cells.length < 8) {
    return;
  }
  writeEditableSurfaceText(cells[0], rec.subject ?? "");
  writeEditableSurfaceText(cells[1], rec.courseNumber ?? "");
  writeEditableSurfaceText(cells[2], rec.description ?? "");
  const c = clampImportCredits(parseTranscriptNumber(rec.credits));
  const pctTd = cells[COURSE_COL_PERCENT];
  if (!pctTd.querySelector(".grade-percent-display")) {
    pctTd.textContent = "";
    const span = document.createElement("span");
    span.className = "grade-percent-display notranslate";
    span.setAttribute("translate", "no");
    pctTd.appendChild(span);
  }
  const parsed = parseImportGradeFields(rec.gradeType ?? "", rec.percent ?? "");
  if (parsed.ok) {
    const val =
      parsed.mode === "percent"
        ? formatPercentForTranscriptCell(clampImportPercent(parseTranscriptNumber(parsed.value)))
        : parsed.value;
    writeRowGradeState(row, parsed.mode, val);
  } else {
    writeRowGradeState(row, "percent", "");
  }
  cells[COURSE_COL_CREDITS].textContent = formatTwo(c);
  applyGradeAndQualityFromPercent(row);
}

function readWorkbookFirstSheetAoA(uint8, extHint) {
  if (typeof XLSX === "undefined" || !XLSX.read) {
    throw new Error("SheetJS (XLSX) not loaded — check script tag / network.");
  }
  const ext = (extHint || "").toLowerCase();
  const isCsv = ext.endsWith(".csv");
  const attempts = [];
  if (isCsv) {
    attempts.push(() => XLSX.read(uint8, { type: "array", codepage: 65001 }));
    attempts.push(() => XLSX.read(uint8, { type: "array", codepage: 936 }));
    attempts.push(() => {
      const txt = new TextDecoder("utf-8", { fatal: false }).decode(uint8);
      return XLSX.read(txt, { type: "string" });
    });
  } else {
    attempts.push(() => XLSX.read(uint8, { type: "array", bookVBA: false }));
  }
  let lastErr = null;
  for (let a = 0; a < attempts.length; a += 1) {
    try {
      const wb = attempts[a]();
      const sheetName = wb.SheetNames && wb.SheetNames[0];
      if (!sheetName) {
        throw new Error("No worksheet in file.");
      }
      const sheet = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      if (!aoa || aoa.length === 0) {
        throw new Error("Empty sheet.");
      }
      const headerRow = aoa[0].map((c) => String(c));
      const idx = buildImportColumnIndex(headerRow);
      if (!importColumnIndexIsComplete(idx)) {
        lastErr = new Error(
          "Header row must include Subject/Course Type, Course Number, Description, Percent (or score text), and Credits. Optional: Grade Type (percent, five, pass-fail, exempt). See template."
        );
        continue;
      }
      return aoa;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || "Parse failed."));
}

function bindExcelImport() {
  const dlBtn = document.getElementById("download-import-template-btn");
  const importBtn = document.getElementById("import-excel-btn");
  const fileInput = document.getElementById("excel-upload");
  const termSelect = document.getElementById("term-select");
  if (!dlBtn || !importBtn || !fileInput || !termSelect) {
    return;
  }

  dlBtn.addEventListener("click", () => {
    const p = uiPack();
    const BOM = "\uFEFF";
    const lines = [
      "Subject,Course Number,Description,Percent,Credits,Grade Type",
      "MATH,101,Advanced Mathematics,85,4,percent",
      "ENG,201,College English,90,3,",
      "PE,110,Physical Education,免考,1,exempt",
      "ART,120,Studio Art,良好,2,five",
    ];
    const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = IMPORT_TEMPLATE_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    const tpl = p.importDiagTemplateOk || "Import: CSV template downloaded ({filename}, UTF-8 BOM).";
    setUploadDiagnostics(tpl.replace("{filename}", IMPORT_TEMPLATE_FILENAME), "ok");
  });

  importBtn.addEventListener("click", async () => {
    const p = uiPack();
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      window.alert(p.importAlertNoFile || "Please select a file.");
      return;
    }
    if (typeof XLSX === "undefined" || !XLSX.read) {
      window.alert(p.importAlertNoLib || "SheetJS not loaded.");
      setUploadDiagnostics("Import: SheetJS (XLSX) not available.", "error");
      return;
    }

    const name = (file.name || "").toLowerCase();
    const okExt = name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!okExt) {
      window.alert(p.importAlertBadExt || "Unsupported type.");
      setUploadDiagnostics("Import: unsupported file extension.", "error");
      return;
    }

    setUploadDiagnostics(p.importDiagReading || "Import: Reading file…", "neutral");
    try {
      const buf = await file.arrayBuffer();
      const uint8 = new Uint8Array(buf);
      const aoa = readWorkbookFirstSheetAoA(uint8, name);
      const idx = buildImportColumnIndex(aoa[0].map((c) => String(c)));
      if (!importColumnIndexIsComplete(idx)) {
        throw new Error(
          "Could not find required columns (Subject/Course Type, Course Number, Description, Percent/Score, Credits). Optional: Grade Type. Use the downloaded template."
        );
      }

      const blocks = getActiveTermBlocks();
      if (blocks.length === 0) {
        throw new Error("No active term section on the transcript.");
      }
      const block = blocks[Number(termSelect.value)] || blocks[0];
      const tbody = block.querySelector("tbody");
      if (!tbody) {
        throw new Error("Could not find course table body for the selected term.");
      }

      const pick = (row, key) => {
        const i = idx[key];
        if (i === undefined || i < 0) {
          return "";
        }
        const v = row[i];
        return v != null ? String(v).trim() : "";
      };

      let added = 0;
      let skipped = 0;
      let skippedInvalid = 0;
      for (let r = 1; r < aoa.length; r += 1) {
        if (added >= IMPORT_MAX_ROWS) {
          skipped += aoa.length - r;
          break;
        }
        const row = aoa[r];
        if (!Array.isArray(row) || row.every((c) => String(c ?? "").trim() === "")) {
          continue;
        }
        const rec = {
          subject: pick(row, "subject"),
          courseNumber: pick(row, "courseNumber"),
          description: pick(row, "description"),
          percent: pick(row, "percent"),
          credits: pick(row, "credits"),
          gradeType: pick(row, "gradeType"),
        };
        const cRaw = parseTranscriptNumber(rec.credits);
        const hasPositiveCredits = Number.isFinite(cRaw) && cRaw > 0;
        const parsed = parseImportGradeFields(rec.gradeType, rec.percent);
        if (!hasPositiveCredits && !parsed.ok) {
          skippedInvalid += 1;
          skipped += 1;
          continue;
        }
        if (!Number.isFinite(cRaw)) {
          skipped += 1;
          continue;
        }
        if (!parsed.ok) {
          skipped += 1;
          continue;
        }

        const newRow = createBlankRow();
        newRow.dataset.sidebarSlot = allocateNextSidebarSlotForTbody(tbody);
        tbody.appendChild(newRow);
        fillImportedCourseRow(newRow, rec);
        added += 1;
      }

      refreshEditablePanel();
      attachRowActionButtons();
      fillTermTotals({ skipGradeRowPass: true });
      /* Flush debounced autosave so a refresh right after import cannot lose newly appended rows. */
      if (autosaveTimer) {
        window.clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      saveToLocalStorage();
      scheduleSecurityArtifactsUpdate(0);
      appendComplianceEventFireAndForget("course_data_import", {
        fileName: file.name,
        fileSize: file.size,
        termSelectValue: termSelect.value,
        rowsAdded: added,
        rowsSkipped: skipped,
      });
      const resTpl = p.importDiagResult || "Import: {added} row(s); {skipped} skipped.";
      const invalidTpl = p.importDiagInvalidRows || "";
      let msg = resTpl.replace("{added}", String(added)).replace("{skipped}", String(skipped));
      if (skippedInvalid > 0 && invalidTpl) {
        msg += ` ${invalidTpl.replace("{n}", String(skippedInvalid))}`;
      }
      if (added > 0) {
        const autoSv =
          sidebarI18nText("importAutoSavedSuffix") ||
          (getUiLang() === "zh" ? "，已自动保存" : " (auto-saved)");
        msg += autoSv;
      }
      setUploadDiagnostics(msg, added > 0 ? "ok" : "error");
      fileInput.value = "";
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      const pre = p.importDiagFailPrefix || "Import failed:";
      setUploadDiagnostics(`${pre} ${msg}`, "error");
      window.alert(`${pre}\n${msg}`);
    }
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

  /** Center emblem: visible for screening without fighting course rows (tuned with `.center-watermark-image img` in style.css). */
  const centerWatermarkDisplayOpacity = "0.78";

  /** Decode and rasterize to PNG without recoloring — keeps the institution emblem in original color and alpha. */
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
        watermark.style.opacity = centerWatermarkDisplayOpacity;
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
          watermark.style.opacity = centerWatermarkDisplayOpacity;
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
  const y = now.getFullYear();
  if (orderEl.value === "fall-spring") {
    year1El.value = String(y - 1);
    year2El.value = String(y);
  } else {
    year1El.value = String(y - 1);
    year2El.value = String(y - 1);
  }

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
    fillTermTotals({ skipGradeRowPass: true });
  };

  orderEl.addEventListener("change", applyTermTitles);
  year1El.addEventListener("input", applyTermTitles);
  year2El.addEventListener("input", applyTermTitles);
  applyTermTitles();
  /** Re-run after UI language change; `fall`/`spring` labels come from {@link uiPack} and were previously stuck in the prior language. */
  refreshTermSeasonHeadings = applyTermTitles;
}

function bindDomesticGpaInputs() {
  const wireDomesticGpaInput = (inp) => {
    if (!inp || inp.dataset.domesticGpaBound === "1") {
      return;
    }
    inp.dataset.domesticGpaBound = "1";
    inp.addEventListener("input", () => {
      fillTermTotals({ skipGradeRowPass: true });
      scheduleSecurityArtifactsUpdate();
    });
  };
  wireDomesticGpaInput(document.getElementById("domestic-term-gpa-1"));
  wireDomesticGpaInput(document.getElementById("domestic-term-gpa-2"));
  const gpaPh = uiPack().domesticGpaPlaceholder || sidebarI18nText("domesticGpaPlaceholder") || "X.xx";
  const dg1 = document.getElementById("domestic-term-gpa-1");
  const dg2 = document.getElementById("domestic-term-gpa-2");
  if (dg1) dg1.placeholder = gpaPh;
  if (dg2) dg2.placeholder = gpaPh;
  if (dg1) dg1.value = normalizeDomesticGpaFromAutosave(dg1.value);
  if (dg2) dg2.value = normalizeDomesticGpaFromAutosave(dg2.value);
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
  lockPlainTextNode(document.getElementById("transcript-non-official-disclaimer"), t.nonOfficialFooterLine || "");
  lockPlainTextNode(document.getElementById("personal-ssn-label"), t.personalSsnLabel);
}

let autosaveRestoreToastTimer = null;

function showAutosaveRestoreToast() {
  const el = document.getElementById("autosave-restore-toast");
  if (!el) {
    return;
  }
  const z = getUiLang() === "zh" ? "zh" : "en";
  const t = window.TRANSCRIPT_SIDEBAR?.[z]?.autosaveRestoreToast || window.TRANSCRIPT_SIDEBAR?.en?.autosaveRestoreToast;
  if (!t) {
    return;
  }
  el.textContent = t;
  el.hidden = false;
  if (autosaveRestoreToastTimer) {
    window.clearTimeout(autosaveRestoreToastTimer);
  }
  autosaveRestoreToastTimer = window.setTimeout(() => {
    autosaveRestoreToastTimer = null;
    el.hidden = true;
    el.textContent = "";
  }, 3000);
}

let editorGenericToastTimer = null;

function showEditorGenericToast(message, ms = 4200) {
  const el = document.getElementById("editor-generic-toast");
  if (!el || !message) {
    return;
  }
  el.textContent = message;
  el.hidden = false;
  if (editorGenericToastTimer) {
    window.clearTimeout(editorGenericToastTimer);
  }
  editorGenericToastTimer = window.setTimeout(() => {
    editorGenericToastTimer = null;
    el.hidden = true;
    el.textContent = "";
  }, ms);
}

/** In-memory undo/redo for editor + transcript (snapshots never written to localStorage). */
const EDITOR_UNDO_STACK_MAX = 45;
let editorHistoryStates = [];
let editorHistoryPtr = -1;
let editorHistoryMuted = false;
let editorHistoryDebounceTimer = null;

let editorSsnUndoSessionKey = null;

function getEditorSsnUndoSessionKeyBytes() {
  if (!editorSsnUndoSessionKey || editorSsnUndoSessionKey.length !== 32) {
    editorSsnUndoSessionKey = new Uint8Array(32);
    if (globalThis.crypto && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(editorSsnUndoSessionKey);
    } else {
      for (let i = 0; i < 32; i += 1) {
        editorSsnUndoSessionKey[i] = (Math.random() * 256) | 0;
      }
    }
  }
  return editorSsnUndoSessionKey;
}

function encodeSsnDigitsForUndoStack(digits) {
  const d = String(digits || "").replace(/\D/g, "").slice(0, 18);
  if (!d) {
    return { personalSsn: "", personalSsnStackDigest: "", personalSsnStackEnc: null };
  }
  const enc = new Uint8Array(d.length);
  const key = getEditorSsnUndoSessionKeyBytes();
  for (let i = 0; i < d.length; i += 1) {
    enc[i] = d.charCodeAt(i) ^ key[i % key.length];
  }
  const te = new TextEncoder();
  const digest = sha256DigestHexJs(te.encode(`ssn-undo|${d}`));
  return { personalSsn: "", personalSsnStackDigest: digest, personalSsnStackEnc: Array.from(enc) };
}

function decodeSsnFromUndoSnapshot(data) {
  if (!data || typeof data !== "object") {
    return "";
  }
  if (!data.personalSsnStackEnc || !Array.isArray(data.personalSsnStackEnc)) {
    return String(data.personalSsn || "").replace(/\D/g, "").slice(0, 18);
  }
  const enc = Uint8Array.from(data.personalSsnStackEnc);
  const key = getEditorSsnUndoSessionKeyBytes();
  let out = "";
  for (let i = 0; i < enc.length; i += 1) {
    out += String.fromCharCode(enc[i] ^ key[i % key.length]);
  }
  return out.replace(/\D/g, "").slice(0, 18);
}

function normalizeSnapshotForApply(data) {
  if (!data || typeof data !== "object") {
    return data;
  }
  const o = { ...data };
  if (o.personalSsnStackEnc && Array.isArray(o.personalSsnStackEnc)) {
    o.personalSsn = decodeSsnFromUndoSnapshot(o);
    delete o.personalSsnStackEnc;
    delete o.personalSsnStackDigest;
  }
  return o;
}

function snapshotEditorHistoryPayload() {
  try {
    const snap = JSON.parse(JSON.stringify(collectAutosaveSnapshot()));
    const ssn = String(snap.personalSsn || "").replace(/\D/g, "").slice(0, 18);
    const enc = encodeSsnDigitsForUndoStack(ssn);
    snap.personalSsn = enc.personalSsn;
    if (enc.personalSsnStackDigest) {
      snap.personalSsnStackDigest = enc.personalSsnStackDigest;
    }
    if (enc.personalSsnStackEnc) {
      snap.personalSsnStackEnc = enc.personalSsnStackEnc;
    } else {
      delete snap.personalSsnStackEnc;
      delete snap.personalSsnStackDigest;
    }
    return snap;
  } catch (_e) {
    return null;
  }
}

function resetEditorHistory() {
  const s = snapshotEditorHistoryPayload();
  editorHistoryStates = s ? [s] : [];
  editorHistoryPtr = editorHistoryStates.length - 1;
  updateUndoRedoUi();
}

function updateUndoRedoUi() {
  const u = document.getElementById("editor-undo-btn");
  const r = document.getElementById("editor-redo-btn");
  if (u) {
    u.disabled = editorHistoryPtr <= 0;
  }
  if (r) {
    r.disabled = false;
  }
}

function scheduleEditorHistoryCapture() {
  if (editorHistoryMuted) {
    return;
  }
  if (editorHistoryDebounceTimer) {
    clearTimeout(editorHistoryDebounceTimer);
  }
  editorHistoryDebounceTimer = window.setTimeout(() => {
    editorHistoryDebounceTimer = null;
    pushEditorHistoryIfChanged();
  }, 500);
}

function pushEditorHistoryIfChanged() {
  if (editorHistoryMuted) {
    return;
  }
  const snap = snapshotEditorHistoryPayload();
  if (!snap) {
    return;
  }
  let curJson;
  try {
    curJson = JSON.stringify(snap);
  } catch (_e) {
    return;
  }
  const prev = editorHistoryStates[editorHistoryPtr];
  try {
    if (prev && JSON.stringify(prev) === curJson) {
      return;
    }
  } catch (_e) {
    /* ignore */
  }
  editorHistoryStates = editorHistoryStates.slice(0, editorHistoryPtr + 1);
  editorHistoryStates.push(snap);
  /* Keep index 0 as the session-open baseline; drop the oldest non-initial entry when over capacity. */
  while (editorHistoryStates.length > EDITOR_UNDO_STACK_MAX) {
    if (editorHistoryStates.length <= 1) {
      break;
    }
    editorHistoryStates.splice(1, 1);
    if (editorHistoryPtr > 0) {
      editorHistoryPtr -= 1;
    }
  }
  editorHistoryPtr = editorHistoryStates.length - 1;
  updateUndoRedoUi();
}

function applyEditorHistoryEntry(snap) {
  if (!snap || typeof snap !== "object") {
    return;
  }
  editorHistoryMuted = true;
  try {
    const normalized = normalizeSnapshotForApply(snap);
    const want = normalized.uiLang === "zh" || normalized.uiLang === "en" ? normalized.uiLang : getUiLang();
    const prevLang = getUiLang();
    const ls = document.getElementById("lang-select");
    if (ls) {
      ls.value = want;
    }
    applyAutosaveSnapshot(normalized);
    if (want !== prevLang && typeof window.applyTranscriptLanguage === "function") {
      window.applyTranscriptLanguage(want);
    } else {
      refreshEditablePanel();
    }
  } finally {
    editorHistoryMuted = false;
  }
}

function performEditorUndo() {
  if (editorHistoryPtr <= 0) {
    return;
  }
  editorHistoryPtr -= 1;
  applyEditorHistoryEntry(editorHistoryStates[editorHistoryPtr]);
  updateUndoRedoUi();
}

function performEditorResetToInitial() {
  const z = getUiLang() === "zh" ? "zh" : "en";
  const s = window.TRANSCRIPT_SIDEBAR?.[z] || window.TRANSCRIPT_SIDEBAR?.en || {};
  const title = s.resetEditorTitle || "Reset Editor";
  const msg = s.resetEditorMessage || "Reset to initial editor state? This cannot be undone.";
  if (!window.confirm(`${title}\n\n${msg}`)) {
    return;
  }
  resetAllEditorDataToDemoPresetsCore();
  resetEditorHistory();
  scheduleAutosaveToLocalStorage();
  scheduleEditorHistoryCapture();
  void updateSecurityArtifacts();
}

function manualSaveToLocalStorage() {
  if (editorHistoryDebounceTimer) {
    window.clearTimeout(editorHistoryDebounceTimer);
    editorHistoryDebounceTimer = null;
    pushEditorHistoryIfChanged();
  }
  const z = getUiLang() === "zh" ? "zh" : "en";
  const okMsg = window.TRANSCRIPT_SIDEBAR?.[z]?.manualSaveOk || window.TRANSCRIPT_SIDEBAR?.en?.manualSaveOk || "Saved.";
  try {
    saveToLocalStorage({ persistCrossTab: true });
    showEditorGenericToast(okMsg, 3200);
  } catch (_e) {
    const fail =
      window.TRANSCRIPT_SIDEBAR?.[z]?.manualSaveFail ||
      window.TRANSCRIPT_SIDEBAR?.en?.manualSaveFail ||
      "Save failed.";
    showEditorGenericToast(fail, 5200);
  }
}

function bindTranscriptScrollTopButton() {
  const btn = document.getElementById("transcript-scroll-top-btn");
  if (!btn || btn.dataset.scrollTopBound === "1") {
    return;
  }
  btn.dataset.scrollTopBound = "1";
  const sync = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    btn.hidden = y <= 300;
  };
  window.addEventListener("scroll", sync, { passive: true });
  sync();
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
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
  /* Pause signature-box observers while mutating SSN / PII; otherwise a prior "***" snapshot is restored over real digits. */
  teardownTranscriptSignatureTamperGuards();
  if (enabled) {
    document.querySelectorAll("#transcript-page [data-pii-mask]").forEach((el) => {
      const k = el.dataset.piiKey;
      if (!k) {
        return;
      }
      if (!DATE_PII_KEYS.has(k)) {
        const cur = el.textContent;
        if (cur !== "***") {
          piiKeyBackup[k] = cur;
        }
      }
      el.textContent = "***";
    });
    const ssnIn = document.getElementById("personal-ssn-input");
    if (ssnIn) {
      piiKeyBackup.personalSsn = ssnIn.value;
    }
    syncPersonalSsnDisplay();
  } else {
    const lang = getUiLang() === "zh" ? "zh" : "en";
    document.querySelectorAll("#transcript-page [data-pii-mask]").forEach((el) => {
      const k = el.dataset.piiKey;
      if (!k) {
        return;
      }
      const raw = piiKeyBackup[k] ?? "";
      el.textContent = DATE_PII_KEYS.has(k) ? formatPiiCanonicalDateForTranscriptPage(String(raw), lang) : String(raw);
    });
    /* Transcript body is unmasked while the checkbox may still be on; show digits on the sheet, not ***. */
    syncPersonalSsnDisplay(true);
  }
  page.classList.toggle("privacy-preview-active", enabled);
  /* Signature tamper guards snapshot `.sign-box` innerHTML; after blur on/off the SSN span changes — re-baseline so export unmask is not reverted to "***". */
  setupTranscriptSignatureTamperGuards();
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
  const hintEl = document.getElementById("personal-ssn-sensitive-hint");
  let ssnHintTimer = null;
  let ssnAuditTimer = null;
  const showSsnSensitiveHint = () => {
    if (!hintEl) {
      return;
    }
    const t = uiPack().ssnSensitiveHint;
    if (!t) {
      return;
    }
    hintEl.textContent = t;
    hintEl.hidden = false;
    clearTimeout(ssnHintTimer);
    ssnHintTimer = setTimeout(() => {
      hintEl.hidden = true;
      ssnHintTimer = null;
    }, 2000);
  };
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
    const hadNonEmpty = el.dataset.ssnPrevNonEmpty === "1";
    sanitizeTo18Digits();
    const nowEmpty = !el.value.trim();
    if (!nowEmpty && !hadNonEmpty) {
      showSsnSensitiveHint();
    }
    el.dataset.ssnPrevNonEmpty = nowEmpty ? "" : "1";
    syncPersonalSsnDisplay();
    scheduleSecurityArtifactsUpdate();
    const baseline = el.dataset.complianceSsnBaseline ?? "";
    clearTimeout(ssnAuditTimer);
    ssnAuditTimer = setTimeout(() => {
      const after = el.value;
      if (baseline !== after) {
        void logFieldEditComplianceRecord(`${sidebarI18nText("ssn")} (sidebar)`, baseline, after);
        el.dataset.complianceSsnBaseline = after;
      }
    }, 800);
    scheduleAutosaveToLocalStorage();
    scheduleEditorHistoryCapture();
  };
  el.addEventListener("input", onChange);
  sanitizeTo18Digits();
  if (!el.value.trim()) {
    el.dataset.ssnPrevNonEmpty = "";
  } else {
    el.dataset.ssnPrevNonEmpty = "1";
  }
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
  if (typeof transcriptGuardTeardown === "function") {
    try {
      transcriptGuardTeardown();
    } finally {
      transcriptGuardTeardown = null;
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

  transcriptGuardTeardown = () => {
    disposers.forEach((fn) => {
      try {
        fn();
      } catch (_e) {
        /* ignore */
      }
    });
  };
}

/** Primary public UTC JSON service (often rate-limited or flaky). */
const TRUSTED_TIMESTAMP_API_URL = "https://worldtimeapi.org/api/timezone/Etc/UTC";
/** Secondary time API (different operator / routing; improves success rate). */
const TRUSTED_TIMESTAMP_TIMEAPI_URL = "https://timeapi.io/api/Time/current/zone?timeZone=UTC";
/** Cloudflare edge trace includes a monotonic UTC unix timestamp line. */
const TRUSTED_TIMESTAMP_CLOUDFLARE_TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace";

function parseWorldTimeApiUtc(data) {
  if (!data || typeof data !== "object") {
    return "";
  }
  const utcStr =
    (typeof data.utc_datetime === "string" && data.utc_datetime) ||
    (typeof data.datetime === "string" && data.datetime) ||
    (data.unixtime != null && Number.isFinite(Number(data.unixtime))
      ? new Date(Number(data.unixtime) * 1000).toISOString()
      : "");
  return utcStr || "";
}

function parseTimeApiIoUtc(data) {
  if (!data || typeof data !== "object") {
    return "";
  }
  const dt = typeof data.dateTime === "string" ? data.dateTime.trim() : "";
  if (!dt) {
    return "";
  }
  if (/Z$|[+-]\d{2}:\d{2}$/.test(dt)) {
    return dt;
  }
  return `${dt}Z`;
}

function parseCloudflareTraceUtc(text) {
  if (typeof text !== "string") {
    return "";
  }
  const m = /(?:^|\n)ts=(\d+(?:\.\d+)?)/m.exec(text);
  if (!m) {
    return "";
  }
  const sec = parseFloat(m[1]);
  if (!Number.isFinite(sec)) {
    return "";
  }
  return new Date(Math.floor(sec * 1000)).toISOString();
}

function fetchWithDeadline(url, deadlineMs) {
  const ac = new AbortController();
  const tid = setTimeout(() => {
    try {
      ac.abort();
    } catch (_e) {
      /* ignore */
    }
  }, deadlineMs);
  return fetch(url, { cache: "no-store", mode: "cors", signal: ac.signal }).finally(() => {
    clearTimeout(tid);
  });
}

async function fetchUtcFromWorldTimeApi(deadlineMs) {
  const res = await fetchWithDeadline(TRUSTED_TIMESTAMP_API_URL, deadlineMs);
  if (!res.ok) {
    throw new Error(`worldtimeapi HTTP ${res.status}`);
  }
  const data = await res.json();
  const utcStr = parseWorldTimeApiUtc(data);
  if (!utcStr) {
    throw new Error("worldtimeapi empty");
  }
  return utcStr;
}

async function fetchUtcFromTimeApiIo(deadlineMs) {
  const res = await fetchWithDeadline(TRUSTED_TIMESTAMP_TIMEAPI_URL, deadlineMs);
  if (!res.ok) {
    throw new Error(`timeapi HTTP ${res.status}`);
  }
  const data = await res.json();
  const utcStr = parseTimeApiIoUtc(data);
  if (!utcStr) {
    throw new Error("timeapi empty");
  }
  return utcStr;
}

async function fetchUtcFromCloudflareTrace(deadlineMs) {
  const res = await fetchWithDeadline(TRUSTED_TIMESTAMP_CLOUDFLARE_TRACE_URL, deadlineMs);
  if (!res.ok) {
    throw new Error(`cloudflare trace HTTP ${res.status}`);
  }
  const text = await res.text();
  const utcStr = parseCloudflareTraceUtc(text);
  if (!utcStr) {
    throw new Error("cloudflare trace empty");
  }
  return utcStr;
}

/**
 * Request current UTC time from public services (parallel race), write to #trusted-timestamp.
 * If every remote fails (rate limits, regional routing, ad blockers, etc.), show ISO UTC from the
 * browser clock with an explicit fallback label — not “offline”, since the user may still be online.
 */
async function fetchTrustedTimestamp() {
  const el = document.getElementById("trusted-timestamp");
  if (!el) {
    return;
  }
  const p = uiPack();
  el.textContent = p.utcFetching || "Fetching UTC…";
  const deadlineMs = 12000;
  const tasks = [
    fetchUtcFromWorldTimeApi(deadlineMs),
    fetchUtcFromTimeApiIo(deadlineMs),
    fetchUtcFromCloudflareTrace(deadlineMs),
  ];
  let utcStr = "";
  try {
    if (typeof Promise.any === "function") {
      utcStr = await Promise.any(tasks);
    } else {
      const settled = await Promise.allSettled(tasks);
      for (let i = 0; i < settled.length; i += 1) {
        const r = settled[i];
        if (r.status === "fulfilled" && r.value) {
          utcStr = r.value;
          break;
        }
      }
    }
  } catch (_e) {
    utcStr = "";
  }
  if (utcStr) {
    el.textContent = utcStr;
    return;
  }
  const iso = new Date().toISOString();
  el.textContent =
    typeof p.utcBrowserFallback === "function"
      ? p.utcBrowserFallback(iso)
      : `${iso} — ${p.utcOffline || "UTC unavailable (offline)"}`;
}

function resolveTranscriptJsPDFConstructor() {
  const ns = window.jspdf;
  if (ns) {
    if (typeof ns.jsPDF === "function") {
      return ns.jsPDF;
    }
    if (typeof ns.default === "function") {
      return ns.default;
    }
  }
  if (typeof window.jsPDF === "function") {
    return window.jsPDF;
  }
  return null;
}

/** Shared control: A3 only; single sheet with uniform scale-to-fit (no page slicing / cropping). */
function readTranscriptPdfPageSpec() {
  const sel = document.getElementById("export-pdf-layout");
  const v = sel && sel.value === "a3-landscape" ? "a3-landscape" : "a3-portrait";
  if (v === "a3-landscape") {
    return { format: "a3", orientation: "landscape" };
  }
  return { format: "a3", orientation: "portrait" };
}

/**
 * One PDF page, full image scaled to fit inside margins (no truncation; may shrink text when content is tall).
 * @param {string} outBaseName Filename without extension, e.g. <code>id-gpa-discrepancy</code>
 * @param {{ format?: string, orientation?: string, rasterMime?: "image/png" | "image/jpeg", rasterQuality?: number }} [pageSpec] Pass <code>rasterMime: "image/jpeg"</code> for long transcripts so jsPDF is not fed a multi‑hundred‑MB PNG data URL (blank/corrupt PDFs in some viewers).
 */
async function addCanvasToPdfSingleSheetFit(JsPDFCtor, canvas, outBaseName, pageSpec) {
  const format = pageSpec && pageSpec.format ? pageSpec.format : "a3";
  const orientation = pageSpec && pageSpec.orientation ? pageSpec.orientation : "portrait";
  const rasterMime = pageSpec && pageSpec.rasterMime ? pageSpec.rasterMime : "image/png";
  const rasterQ =
    pageSpec && pageSpec.rasterQuality != null && Number.isFinite(pageSpec.rasterQuality)
      ? Math.min(1, Math.max(0.5, pageSpec.rasterQuality))
      : 0.92;
  const pdf = new JsPDFCtor({ unit: "mm", format, orientation });
  const marginMm = 8;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const availW = pageW - marginMm * 2;
  const availH = pageH - marginMm * 2;
  const pxW = Math.max(1, canvas.width);
  const pxH = Math.max(1, canvas.height);
  const imgAspect = pxH / pxW;
  let drawW = availW;
  let drawH = drawW * imgAspect;
  if (drawH > availH) {
    drawH = availH;
    drawW = drawH / imgAspect;
  }
  const x = marginMm + (availW - drawW) / 2;
  const y = marginMm + (availH - drawH) / 2;
  const useJpeg = rasterMime === "image/jpeg";
  const imgData = useJpeg ? canvas.toDataURL("image/jpeg", rasterQ) : canvas.toDataURL("image/png");
  pdf.addImage(imgData, useJpeg ? "JPEG" : "PNG", x, y, drawW, drawH);
  const docIdForMeta = sanitizeExportFileToken(
    typeof document !== "undefined" ? document.getElementById("document-id")?.textContent : ""
  );
  const isZh = getUiLang() === "zh";
  const metaTitle = isZh
    ? `成绩单排版对照件 – ${docIdForMeta}`
    : `Transcript layout aid – ${docIdForMeta}`;
  const subjectCore = isZh
    ? "非官方版式文件；非机构签发的正式文件"
    : "Unofficial layout; NOT an institutional document";
  const metaSubject = `${subjectCore} | toolVersion=${TRANSCRIPT_TOOL_VERSION}`;
  const metaKeywords = isZh ? "成绩单, 排版, 非官方, GPA, 换算" : "transcript, layout, unofficial, GPA, conversion";
  const metaAuthor = "Transcript Layout Tool (transcript-layout-converter-bilingual)";
  const metaCreator = "Transcript Layout Tool";
  try {
    if (typeof pdf.setProperties === "function") {
      pdf.setProperties({
        title: metaTitle,
        subject: metaSubject,
        author: metaAuthor,
        keywords: metaKeywords,
        creator: metaCreator,
      });
    } else if (pdf && typeof pdf.setDocumentProperties === "function") {
      pdf.setDocumentProperties({
        title: metaTitle,
        subject: metaSubject,
        author: metaAuthor,
        keywords: metaKeywords,
        creator: metaCreator,
      });
    }
  } catch (_metaErr) {
    /* metadata is best-effort; export must still complete */
  }
  const ab = pdf.output("arraybuffer");
  const sha = await sha256HexFromBinary(new Uint8Array(ab));
  pdf.save(`${outBaseName}.pdf`);
  return sha;
}

/**
 * Raster exports use <code>scrollHeight</code> for canvas sizing. The security pattern layer may need a
 * temporary paint clip during measure; text watermarks keep their designed transforms so PNG and PDF match
 * the on-page appearance (see <code>#transcript-raster-export-fix</code> in the html2canvas clone).
 * @returns {() => void}
 */
function beginTranscriptRasterExportLayoutHold(transcriptPage) {
  if (!transcriptPage) {
    return () => {};
  }
  const restores = [];

  const sp = transcriptPage.querySelector(".security-pattern");
  if (sp) {
    const oPrev = sp.style.overflow;
    const cPrev = sp.style.contain;
    sp.style.overflow = "hidden";
    sp.style.contain = "paint";
    restores.push(() => {
      if (oPrev) {
        sp.style.overflow = oPrev;
      } else {
        sp.style.removeProperty("overflow");
      }
      if (cPrev) {
        sp.style.contain = cPrev;
      } else {
        sp.style.removeProperty("contain");
      }
    });
  }

  return () => {
    restores.reverse().forEach((fn) => fn());
  };
}

/** Dedupe concurrent {@link loadNotoSerifSCFont} runs (preload + export may overlap). */
let notoSerifSCLoadPromise = null;

/**
 * Peek decoded font bytes from a base64 prefix so {@code data:} URLs use the correct MIME / {@code format()}.
 * @param {string} b64
 * @returns {Uint8Array|null}
 */
function transcriptExportPeekFontMagicFromBase64(b64) {
  const needBytes = 12;
  const groupCount = Math.ceil(needBytes / 3);
  const sliceLen = groupCount * 4;
  const chunk = b64.length <= sliceLen ? b64 : b64.slice(0, sliceLen);
  let bin = "";
  try {
    bin = atob(chunk);
  } catch (_e) {
    return null;
  }
  const u8 = new Uint8Array(needBytes);
  for (let i = 0; i < needBytes && i < bin.length; i += 1) {
    u8[i] = bin.charCodeAt(i) & 0xff;
  }
  return u8;
}

/**
 * @param {string} b64
 * @returns {{ mime: string, format: string }}
 */
function transcriptExportFontDataUrlFragmentFromBase64(b64) {
  const u8 = transcriptExportPeekFontMagicFromBase64(b64);
  if (!u8 || u8.length < 4) {
    return { mime: "font/ttf", format: "truetype" };
  }
  if (u8[0] === 0x77 && u8[1] === 0x4f && u8[2] === 0x46 && u8[3] === 0x32) {
    return { mime: "font/woff2", format: "woff2" };
  }
  if (u8[0] === 0x4f && u8[1] === 0x54 && u8[2] === 0x54 && u8[3] === 0x4f) {
    return { mime: "font/otf", format: "opentype" };
  }
  return { mime: "font/ttf", format: "truetype" };
}

/**
 * Preloads Noto Serif SC for raster export: local {@code ./NotoSerifSC[wght].ttf} first, then Google Fonts CSS
 * URLs, then a raw GitHub TTF fallback. Leaves {@link notoSerifSCBase64} {@code null} if every path fails (browser fonts apply).
 */
async function loadNotoSerifSCFont() {
  if (notoSerifSCBase64) {
    return;
  }
  if (!notoSerifSCLoadPromise) {
    notoSerifSCLoadPromise = (async () => {
      const assignFromArrayBuffer = (ab) => {
        notoSerifSCBase64 = arrayBufferToBase64ForPdf(ab);
      };
      try {
        const localRes = await fetch("./NotoSerifSC[wght].ttf", { cache: "force-cache" });
        if (localRes.ok) {
          assignFromArrayBuffer(await localRes.arrayBuffer());
          return;
        }
      } catch (_e) {
        /* Local file missing or unreadable — try network fallbacks. */
      }
      try {
        const cssRes = await fetch(
          "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap",
          { mode: "cors", cache: "force-cache" }
        );
        if (!cssRes.ok) {
          throw new Error("noto_serif_sc_css_http");
        }
        const cssText = await cssRes.text();
        const urlCandidates = [];
        const urlRe = /url\s*\(\s*([^)]+?)\s*\)/gi;
        let mm;
        while ((mm = urlRe.exec(cssText)) !== null) {
          let href = mm[1].trim().replace(/^["']|["']$/g, "");
          if (href.indexOf("https:") === 0 || href.indexOf("http:") === 0) {
            if (urlCandidates.indexOf(href) === -1) {
              urlCandidates.push(href);
            }
          }
        }
        if (urlCandidates.length) {
          let bestBuf = null;
          let bestLen = 0;
          for (let ci = 0; ci < urlCandidates.length; ci += 1) {
            try {
              const fr = await fetch(urlCandidates[ci], { mode: "cors", cache: "force-cache" });
              if (!fr.ok) {
                continue;
              }
              const buf = await fr.arrayBuffer();
              const n = buf.byteLength;
              if (n > bestLen) {
                bestLen = n;
                bestBuf = buf;
              }
            } catch (_e2) {
              /* try next candidate */
            }
          }
          if (bestBuf && bestLen > 2048) {
            assignFromArrayBuffer(bestBuf);
            return;
          }
        }
      } catch (_e) {
        /* Google Fonts CSS / gstatic path unusable in this environment. */
      }
      try {
        const rawRes = await fetch(
          "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
          { cache: "force-cache" }
        );
        if (rawRes.ok) {
          assignFromArrayBuffer(await rawRes.arrayBuffer());
        }
      } catch (_e) {
        /* Raw GitHub fallback failed — leave notoSerifSCBase64 null. */
      }
    })();
  }
  try {
    await notoSerifSCLoadPromise;
  } finally {
    notoSerifSCLoadPromise = null;
  }
}

/**
 * Renders <code>#transcript-page</code> after export-side sync, QR payload, and UTC line (PNG + transcript PDF).
 * @param {{ intent?: "png" | "pdf" }} [options] PNG is viewed 1:1 — use a wider clone viewport + looser table whitespace in the raster clone only.
 */
async function captureTranscriptPageToCanvasForExport(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rasterIntent = opts.intent === "png" ? "png" : "pdf";
  if (isBrowserMachineTranslating()) {
    const p = uiPack();
    const msg =
      p.exportBlockedBrowserTranslation ||
      "Browser translation detected. Please disable page translation and retry.";
    const e = new Error(msg);
    e.code = "EXPORT_BROWSER_TRANSLATION_BLOCKED";
    throw e;
  }
  await captureRawInputToken();
  teardownTranscriptSignatureTamperGuards();
  syncTranscriptTextFromSideEditorForExport(true);
  applyGradeScaleDisclaimer();
  syncChsiVerifyCodeToTranscript();
  await generateExportQRPayload();
  await fetchTrustedTimestamp();
  applyTranscriptDateIssuedForExportCapture();
  await applyIssueSignatureLineForExportCapture();
  const target = document.getElementById("transcript-page");
  if (!target) {
    throw new Error("transcript-page missing");
  }
  const releaseRasterHold = beginTranscriptRasterExportLayoutHold(target);
  try {
    const sh1 = target.scrollHeight;
    const sw1 = target.scrollWidth;
    const maxHeightPx = 4961;
    const contentHeightPx = Math.max(1, sh1);
    const contentWidthPx = Math.max(1, sw1);
    let exportScale = 2;
    if (!isSingleTermLayout()) {
      if (contentHeightPx * exportScale > maxHeightPx) {
        exportScale = Math.floor((maxHeightPx / contentHeightPx) * 100) / 100;
        if (!(exportScale > 0)) {
          exportScale = maxHeightPx / contentHeightPx;
        }
      }
    }
    const MAX_CANVAS_EDGE = 16384;
    const MAX_CANVAS_PIXELS = 200000000;
    const edgeScaleCap = Math.min(
      MAX_CANVAS_EDGE / contentWidthPx,
      MAX_CANVAS_EDGE / contentHeightPx
    );
    const areaScaleCap = Math.sqrt(MAX_CANVAS_PIXELS / (contentWidthPx * contentHeightPx));
    exportScale = Math.min(exportScale, edgeScaleCap, areaScaleCap);
    const MAX_EXPORT_HEIGHT_PX = 11000;
    if (contentHeightPx * exportScale > MAX_EXPORT_HEIGHT_PX) {
      const cappedH = MAX_EXPORT_HEIGHT_PX / contentHeightPx;
      exportScale = Math.min(exportScale, cappedH);
      console.warn(
        "[export] Transcript raster height would exceed a safe limit; capture scale was reduced. PNG/PDF may appear smaller."
      );
      exportScale = Math.max(0.25, exportScale);
      if (contentHeightPx * exportScale > MAX_EXPORT_HEIGHT_PX) {
        exportScale = cappedH;
      }
    }
    if (!(exportScale > 0) || !Number.isFinite(exportScale)) {
      exportScale = Math.min(1, maxHeightPx / contentHeightPx, edgeScaleCap, areaScaleCap);
    }
    if (!(exportScale > 0) || !Number.isFinite(exportScale)) {
      exportScale = 0.05;
    }
    exportScale = Math.floor(exportScale * 1000) / 1000;
    exportScale = Math.max(0.01, exportScale);
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    if (rasterIntent === "png") {
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
    }
    const brPost = target.getBoundingClientRect();
    const stableW = Math.max(
      952,
      target.offsetWidth,
      Math.ceil(brPost.width),
      Math.ceil(target.scrollWidth)
    );
    const stableH = Math.max(
      1,
      Math.ceil(target.scrollHeight),
      Math.ceil(brPost.height),
      target.offsetHeight
    );
    const capW = stableW;
    const capH = stableH;
    const innerW = typeof window.innerWidth === "number" ? window.innerWidth : 0;
    const innerH = typeof window.innerHeight === "number" ? window.innerHeight : 0;
    /* html2canvas clone viewport must stay wide enough for 9.9in sheet + flex row math; pad aggressively. */
    const windowWidthForClone =
      rasterIntent === "png"
        ? Math.max(capW + 560, innerW, 1680)
        : Math.max(capW + 240, innerW, 1280);
    const windowHeightForClone =
      rasterIntent === "png"
        ? Math.min(16384, Math.max(capH + 480, innerH, 960))
        : Math.min(16384, Math.max(capH + 240, innerH, 720));
    syncPersonalSsnDisplay(true);
    setupTranscriptSignatureTamperGuards();
    await loadNotoSerifSCFont();
    return await window.html2canvas(target, {
      backgroundColor: "#ffffff",
      scale: exportScale,
      width: capW,
      height: capH,
      windowWidth: windowWidthForClone,
      windowHeight: windowHeightForClone,
      useCORS: true,
      foreignObjectRendering: false,
      imageTimeout: 15000,
      scrollX: 0,
      scrollY: 0,
      onclone(clonedDoc) {
        const de = clonedDoc.documentElement;
        const bo = clonedDoc.body;
        if (de) {
          de.style.setProperty("min-width", `${stableW}px`);
          de.style.setProperty("width", `${windowWidthForClone}px`);
        }
        if (bo) {
          bo.style.setProperty("min-width", `${stableW}px`);
          bo.style.setProperty("width", `${windowWidthForClone}px`);
          bo.style.setProperty("margin", "0");
        }
        const root = clonedDoc.getElementById("transcript-page");
        if (!root) {
          return;
        }
        /* Raster fixes live in style.css under `.export-raster-mode` (clone only) to avoid large <style> injection. */
        root.classList.add("export-raster-mode");
        if (rasterIntent === "png") {
          root.classList.add("export-raster--png");
        }
        if (notoSerifSCBase64 && clonedDoc.head) {
          const frag = transcriptExportFontDataUrlFragmentFromBase64(notoSerifSCBase64);
          const fontStyle = clonedDoc.createElement("style");
          fontStyle.textContent =
            "\n@font-face {\n  font-family: 'Noto Serif SC';\n  src: url(data:" +
            frag.mime +
            ";base64," +
            notoSerifSCBase64 +
            ") format('" +
            frag.format +
            "');\n  font-weight: 400 700;\n  font-style: normal;\n}\n";
          clonedDoc.head.appendChild(fontStyle);
        }
        /* Live page uses overflow:hidden for screen layout; cloning with that can clip long transcripts in raster exports. */
        root.style.setProperty("overflow", "visible");
        root.style.setProperty("box-shadow", "none");
        const pat = root.querySelector(".security-pattern");
        if (pat) {
          pat.style.setProperty("overflow", "hidden");
          pat.style.setProperty("contain", "paint");
        }
        const gps = root.querySelector("#gpa-policy-scale");
        if (gps) {
          gps.style.setProperty("overflow-x", "visible");
          gps.style.setProperty("overflow-y", "visible");
          gps.style.setProperty("max-height", "none");
        }
        const wmPack = window.TRANSCRIPT_I18N_PACK?.[getUiLang() === "zh" ? "zh" : "en"] || {};
        const wmText =
          wmPack.exportWatermarkText ||
          "UNOFFICIAL LAYOUT AID – NOT AN INSTITUTIONAL DOCUMENT";
        const legalOverlay = clonedDoc.createElement("div");
        legalOverlay.className = "transcript-export-legal-raster-overlay notranslate";
        legalOverlay.setAttribute("translate", "no");
        legalOverlay.setAttribute("aria-hidden", "true");
        legalOverlay.textContent = wmText;
        root.appendChild(legalOverlay);
      },
    });
  } finally {
    releaseRasterHold();
  }
}

/** “通用国内教务系统”模拟：合格按 65 分走百分制阶梯；免考不计入 GPA 学时。 */
function institutionalGpaRowMetrics(row) {
  const cells = Array.from(row.querySelectorAll("td"));
  if (cells.length < 8) {
    return null;
  }
  const creditsVal = parseTranscriptNumber(cells[COURSE_COL_CREDITS].textContent);
  const credits = Number.isFinite(creditsVal) ? creditsVal : 0;
  const scale = readRowGradeScale(row);
  const val = readRowGradeValue(row);
  if (scale === "exempt") {
    return { hours: 0, quality: 0, instGp: null };
  }
  if (scale === "percent") {
    const p = parseTranscriptNumber(val);
    if (!Number.isFinite(p)) {
      return { hours: 0, quality: 0, instGp: null };
    }
    const { gradePoint } = resolveUsLetterGradeFromPercent(p);
    return { hours: credits, quality: gradePoint * credits, instGp: gradePoint };
  }
  if (scale === "five") {
    const e = FIVE_SCALE_MAP[val];
    if (!e || !Number.isFinite(e.percent)) {
      return { hours: 0, quality: 0, instGp: null };
    }
    const { gradePoint } = resolveUsLetterGradeFromPercent(e.percent);
    return { hours: credits, quality: gradePoint * credits, instGp: gradePoint };
  }
  if (scale === "pass-fail") {
    if (val === "合格") {
      const { gradePoint } = resolveUsLetterGradeFromPercent(65);
      return { hours: credits, quality: gradePoint * credits, instGp: gradePoint };
    }
    if (val === "不合格") {
      const { gradePoint } = resolveUsLetterGradeFromPercent(55);
      return { hours: credits, quality: gradePoint * credits, instGp: gradePoint };
    }
  }
  return { hours: 0, quality: 0, instGp: null };
}

function syncGpaDiscrepancyReportButtonVisibility() {
  const btn = document.getElementById("export-gpa-discrepancy-report");
  if (!btn) {
    return;
  }
  /* Always show: PDF lists every row (percent / five-tier / pass-fail / exempt) plus tier reference;
   * hiding when only percent was too easy to mistake for a removed feature. */
  btn.hidden = false;
}

function gpaDiscrepancyReportCopy() {
  const zh = getUiLang() === "zh";
  const p = uiPack();
  return {
    title: zh ? "成绩换算与 GPA 差异说明对照表" : "Grade conversion & GPA discrepancy reference",
    doc: zh ? "文档编号" : "Document ID",
    genAt: zh ? "生成时间" : "Generated",
    colDesc: zh ? "课程名称" : "Description",
    colFmt: zh ? "成绩格式" : "Grade format",
    colRaw: zh ? "原始录入值" : "Raw entry",
    colCred: zh ? "学分" : "Credits",
    colDisp: zh ? "成绩单显示" : "Shown on transcript",
    colToolGp: zh ? "本工具绩点" : "Tool grade pt",
    colToolQp: zh ? "本工具质量分" : "Tool qual. pts",
    colInstGp: zh ? "机构模拟绩点" : "Inst. sim. grade pt",
    colInstQp: zh ? "机构模拟质量分" : "Inst. sim. qual. pts",
    toolCum: zh ? "本工具累计 GPA" : "Tool cumulative GPA",
    instCum: zh ? "机构模拟累计 GPA" : "Institutional sim. cumulative GPA",
    excluded: zh ? "不计入" : "Excluded",
    refTitle: "等级制成绩换算参考表",
    refColTier: zh ? "等级" : "Tier",
    refColPct: zh ? "对应百分制" : "Percent",
    refColGp: zh ? "对应绩点" : "Grade pt",
    refColPolicy: zh ? "本工具 GPA 计算处理方式" : "Tool GPA treatment",
  };
}

function buildGpaDiscrepancyReportHostElement() {
  const copy = gpaDiscrepancyReportCopy();
  const zh = getUiLang() === "zh";
  const docId = document.getElementById("document-id")?.textContent?.trim() || "transcript";
  const nowStr = formatAuditLocalWallClock(Date.now());
  const disclaimer = uiPack().gradeScaleDisclaimerText || "";

  const host = document.createElement("div");
  host.className = "gpa-discrepancy-pdf-host";
  host.setAttribute("lang", getUiLang() === "zh" ? "zh-CN" : "en");
  host.style.cssText =
    "position:fixed;left:-220mm;top:0;box-sizing:border-box;width:190mm;padding:10mm;background:#fff;color:#111;font:11px/1.35 system-ui,-apple-system,'Segoe UI',sans-serif;";

  const tblStyle = "border-collapse:collapse;width:100%;table-layout:fixed;";
  const thtd =
    "border:1px solid #333;padding:5px 6px;vertical-align:top;word-wrap:break-word;text-align:left;";
  const thtdNum = `${thtd}text-align:right;`;

  const h1 = document.createElement("h1");
  h1.style.cssText = "font-size:16px;margin:0 0 8px;font-weight:700;";
  h1.textContent = copy.title;

  const meta = document.createElement("p");
  meta.style.cssText = "margin:0 0 12px;font-size:11px;";
  meta.textContent = `${copy.doc}: ${docId}  |  ${copy.genAt}: ${nowStr}`;

  const courseTable = document.createElement("table");
  courseTable.style.cssText = tblStyle;

  const headTr = document.createElement("tr");
  [
    copy.colDesc,
    copy.colFmt,
    copy.colRaw,
    copy.colCred,
    copy.colDisp,
    copy.colToolGp,
    copy.colToolQp,
    copy.colInstGp,
    copy.colInstQp,
  ].forEach((lab) => {
    const th = document.createElement("th");
    th.style.cssText = `${thtd}background:#f2f2f2;font-weight:700;`;
    th.textContent = lab;
    headTr.appendChild(th);
  });
  courseTable.appendChild(headTr);

  let sumToolH = 0;
  let sumToolQ = 0;
  let sumInstH = 0;
  let sumInstQ = 0;

  document.querySelectorAll(".term-block:not(.term-block-inactive) tbody tr").forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 8) {
      return;
    }
    const desc = cells[2]?.textContent?.trim() || "";
    const fmt = (() => {
      const s = readRowGradeScale(row);
      if (s === "percent") {
        return uiPack().gradeTypePercent || "Percent";
      }
      if (s === "five") {
        return uiPack().gradeTypeFive || "Five-tier";
      }
      if (s === "pass-fail") {
        return uiPack().gradeTypePassFail || "Pass/Fail";
      }
      if (s === "exempt") {
        return uiPack().gradeTypeExempt || "Exempt";
      }
      return s;
    })();
    const raw = readRowGradeValue(row) || (readRowGradeScale(row) === "exempt" ? "" : "");
    const cred = cells[COURSE_COL_CREDITS]?.textContent?.trim() || "";
    const disp = row.querySelector(".grade-percent-display")?.textContent?.trim() || "";
    const dispFinal =
      readRowGradeScale(row) === "exempt"
        ? uiPack().exemptGradeDisplay || "Exempt"
        : disp || "—";

    const toolGpTxt = cells[COURSE_COL_GRADE_POINT]?.textContent?.trim() || "";
    const toolQpTxt = cells[COURSE_COL_QUALITY]?.textContent?.trim() || "";
    const toolGpNum = parseTranscriptNumber(toolGpTxt);
    const toolExcluded = row.dataset.gpaExcluded === "1" || readRowGradeScale(row) === "exempt";
    const toolGpCell = toolExcluded ? copy.excluded : Number.isFinite(toolGpNum) ? toolGpNum.toFixed(1) : "—";

    const inst = institutionalGpaRowMetrics(row);
    const instGpCell =
      inst && inst.instGp != null && Number.isFinite(inst.instGp) ? inst.instGp.toFixed(1) : "—";
    const instQpCell = inst ? formatTwo(inst.quality) : formatTwo(0);

    const gh = parseTranscriptNumber(row.dataset.hours || "0");
    const tq = parseTranscriptNumber(row.dataset.quality || "0");
    if (Number.isFinite(gh)) {
      sumToolH += gh;
    }
    if (Number.isFinite(tq)) {
      sumToolQ += tq;
    }
    if (inst) {
      sumInstH += inst.hours;
      sumInstQ += inst.quality;
    }

    const tr = document.createElement("tr");
    const vals = [desc, fmt, raw, cred, dispFinal, toolGpCell, toolQpTxt, instGpCell, instQpCell];
    vals.forEach((text, i) => {
      const td = document.createElement("td");
      td.style.cssText = i === 3 || i >= 5 ? thtdNum : thtd;
      td.textContent = text;
      tr.appendChild(td);
    });
    courseTable.appendChild(tr);
  });

  const footTr = document.createElement("tr");
  const toolGpa = sumToolH > 0 ? sumToolQ / sumToolH : 0;
  const instGpa = sumInstH > 0 ? sumInstQ / sumInstH : 0;
  const tdA = document.createElement("td");
  tdA.colSpan = 5;
  tdA.style.cssText = `${thtd};font-weight:700;background:#fafafa;`;
  tdA.textContent = `${copy.toolCum}: ${formatTwo(toolGpa)}`;
  const tdB = document.createElement("td");
  tdB.colSpan = 4;
  tdB.style.cssText = `${thtd};font-weight:700;background:#fafafa;text-align:right;`;
  tdB.textContent = `${copy.instCum}: ${formatTwo(instGpa)}`;
  footTr.appendChild(tdA);
  footTr.appendChild(tdB);
  courseTable.appendChild(footTr);

  const refH2 = document.createElement("h2");
  refH2.style.cssText = "font-size:14px;margin:16px 0 8px;font-weight:700;";
  refH2.textContent = copy.refTitle;

  const refTable = document.createElement("table");
  refTable.style.cssText = tblStyle;
  const refHead = document.createElement("tr");
  [copy.refColTier, copy.refColPct, copy.refColGp, copy.refColPolicy].forEach((lab) => {
    const th = document.createElement("th");
    th.style.cssText = `${thtd}background:#f2f2f2;font-weight:700;`;
    th.textContent = lab;
    refHead.appendChild(th);
  });
  refTable.appendChild(refHead);

  const refRows = [
    ["优秀", "95", "4.0", zh ? "正常计入 GPA" : "Included in GPA"],
    ["良好", "85", "3.0", zh ? "正常计入 GPA" : "Included in GPA"],
    ["中等", "75", "2.0", zh ? "正常计入 GPA" : "Included in GPA"],
    ["及格", "65", "1.0", zh ? "正常计入 GPA" : "Included in GPA"],
    ["不及格", "55", "0.0", zh ? "正常计入 GPA（绩点为 0）" : "Included in GPA (grade pt 0)"],
    [
      "合格",
      zh ? "65（通用标准）" : "65 (common convention)",
      zh ? "1.0（机构对照用）" : "1.0 (for inst. sim.)",
      zh
        ? "本工具不计入 GPA，仅作机构模拟对比参考"
        : "Excluded from tool GPA; used only for institutional simulation",
    ],
    ["免考", "—", "—", zh ? "所有算法均不计入 GPA" : "Excluded from all GPA calculations"],
  ];
  refRows.forEach((cells) => {
    const tr = document.createElement("tr");
    cells.forEach((text, i) => {
      const td = document.createElement("td");
      td.style.cssText = i >= 1 && i <= 2 ? thtdNum : thtd;
      td.textContent = text;
      tr.appendChild(td);
    });
    refTable.appendChild(tr);
  });

  const discP = document.createElement("p");
  discP.style.cssText = "margin:16px 0 0;font-size:10.5px;line-height:1.45;text-align:justify;";
  discP.textContent = disclaimer;

  host.appendChild(h1);
  host.appendChild(meta);
  host.appendChild(courseTable);
  host.appendChild(refH2);
  host.appendChild(refTable);
  host.appendChild(discP);

  return host;
}

async function doExportGpaDiscrepancyReport() {
  const status = document.getElementById("export-status");
  const p = uiPack();
  const JsPDFCtor = resolveTranscriptJsPDFConstructor();
  if (!JsPDFCtor) {
    if (status) {
      status.textContent = p.exportPdfJsPdfMissing || "jsPDF library not loaded";
      status.style.color = "#7a0000";
    }
    appendComplianceEventFireAndForget("export_gpa_discrepancy_pdf_failure", { reason: "jspdf_not_loaded" });
    return;
  }
  if (typeof window.html2canvas !== "function") {
    if (status) {
      status.textContent = p.exportFailCanvas || "html2canvas not loaded";
      status.style.color = "#7a0000";
    }
    return;
  }

  const blurWasOn = isPrivacyPreviewEnabled();
  try {
    if (blurWasOn) {
      applyPrivacyPreviewToTranscript(false);
    }
    await captureRawInputToken();
    syncTranscriptTextFromSideEditorForExport(true);
    applyGradeScaleDisclaimer();
    fillTermTotals();

    if (status) {
      status.textContent = p.exportGpaDiscrepancyRendering || "Rendering…";
      status.style.color = "#3b3b3b";
    }

    const host = buildGpaDiscrepancyReportHostElement();
    document.body.appendChild(host);
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    const capW = Math.max(1, Math.ceil(host.scrollWidth));
    const capH = Math.max(1, Math.ceil(host.scrollHeight));
    const MAX_CANVAS_EDGE = 16384;
    const MAX_CANVAS_PIXELS = 200000000;
    let h2Scale = 2;
    h2Scale = Math.min(
      h2Scale,
      MAX_CANVAS_EDGE / capW,
      MAX_CANVAS_EDGE / capH,
      Math.sqrt(MAX_CANVAS_PIXELS / (capW * capH))
    );
    if (!(h2Scale > 0) || !Number.isFinite(h2Scale)) {
      h2Scale = Math.min(1, MAX_CANVAS_EDGE / capW, MAX_CANVAS_EDGE / capH);
    }
    h2Scale = Math.floor(Math.max(0.25, h2Scale) * 1000) / 1000;
    const canvas = await window.html2canvas(host, {
      backgroundColor: "#ffffff",
      scale: h2Scale,
      width: capW,
      height: capH,
      useCORS: true,
      foreignObjectRendering: false,
      imageTimeout: 15000,
      scrollX: 0,
      scrollY: 0,
    });
    host.remove();

    const docId = document.getElementById("document-id")?.textContent?.trim() || "transcript";
    const pdfPageSpec = readTranscriptPdfPageSpec();
    const pdfSha = await addCanvasToPdfSingleSheetFit(JsPDFCtor, canvas, `${docId}-gpa-discrepancy`, pdfPageSpec);

    if (status) {
      status.textContent =
        typeof p.exportGpaDiscrepancyComplete === "function"
          ? p.exportGpaDiscrepancyComplete(docId)
          : `Export: Complete (${docId}-gpa-discrepancy.pdf)`;
      status.style.color = "#0a5d16";
      if (pdfSha) {
        appendExportSuccessReceiptUI(status, docId, pdfSha);
      }
    }
    appendComplianceEventFireAndForget("export_gpa_discrepancy_pdf_success", {
      docId,
      pdfLayout: pdfPageSpec.orientation,
    });
  } catch (err) {
    const base = p.exportGpaDiscrepancyFail || "Export failed";
    const hint = err && err.message ? String(err.message).slice(0, 120) : "";
    if (status) {
      status.textContent = hint ? `${base} (${hint})` : base;
      status.style.color = "#7a0000";
    }
    appendComplianceEventFireAndForget("export_gpa_discrepancy_pdf_failure", {
      reason: "render_failed",
      detail: String(err && err.message ? err.message : err).slice(0, 160),
    });
  } finally {
    if (blurWasOn) {
      applyPrivacyPreviewToTranscript(true);
      refreshEditablePanel();
    }
  }
}

function bindExportGpaDiscrepancyReport() {
  const btn = document.getElementById("export-gpa-discrepancy-report");
  const status = document.getElementById("export-status");
  if (!btn) {
    return;
  }
  btn.addEventListener("click", async () => {
    const ack = document.getElementById("legal-ack");
    if (!ack || !ack.checked) {
      if (status) {
        status.textContent = uiPack().exportBlocked || "Export blocked";
        status.style.color = "#8a6d00";
      }
      appendComplianceEventFireAndForget("export_blocked", { reason: "legal_ack_required_gpa_pdf" });
      ack?.focus();
      return;
    }
    await doExportGpaDiscrepancyReport();
  });
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

    if (!(await requestExportPreflightConfirmAsync())) {
      return;
    }

    const blurWasOn = isPrivacyPreviewEnabled();

    try {
      if (blurWasOn) {
        applyPrivacyPreviewToTranscript(false);
      }
      applyExportPurposeStatementForExport();
      status.textContent = p.exportRendering || "Export: Rendering PNG…";
      status.style.color = "#3b3b3b";
      /* Trusted UTC + transcript “Date Issued” are refreshed again inside capture; pre-call keeps layout aligned if capture batches later. */
      await fetchTrustedTimestamp();
      applyTranscriptDateIssuedForExportCapture();
      const canvas = await captureTranscriptPageToCanvasForExport({ intent: "png" });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        throw new Error("Failed to encode PNG blob");
      }
      const exportHashEl = document.getElementById("export-file-hash");
      let exportPngSha256 = "";
      if (exportHashEl) {
        const hashSlice = blob.slice(0, blob.size, blob.type || "image/png");
        exportPngSha256 = await sha256HexFromBinary(new Uint8Array(await hashSlice.arrayBuffer()));
        exportHashEl.textContent = exportPngSha256.slice(0, 24).toUpperCase();
        exportHashEl.dataset.fullSha256 = exportPngSha256;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const docIdRaw = document.getElementById("document-id")?.textContent?.trim() || "transcript";
      const docId = sanitizeExportFileToken(docIdRaw);
      const ymd = formatExportDateYmdCompact();
      const hash8 = exportPngSha256 ? exportPngSha256.slice(0, 8).toUpperCase() : "00000000";
      const baseName = `${docId}_${ymd}_${hash8}`;
      const downloadName = `${baseName}.png`;
      link.href = url;
      link.download = downloadName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (exportPngSha256) {
        lastExportedPngFullSha256 = exportPngSha256;
        lastExportedPngFileName = downloadName;
        lastExportedPngAtMs = Date.now();
      }
      status.textContent =
        typeof p.exportComplete === "function"
          ? p.exportComplete(baseName)
          : `Export: Complete (${downloadName})`;
      status.style.color = "#0a5d16";
      if (exportPngSha256) {
        appendExportSuccessReceiptUI(status, docId, exportPngSha256);
        void (async () => {
          const docIdHash = (await sha256Hex(JSON.stringify({ docId }))).slice(0, 40);
          await appendComplianceEvent("export_png_success", {
            exportFileSha256: exportPngSha256,
            docIdHash,
          });
        })();
      }
    } catch (err) {
      const pErr = uiPack();
      if (err && err.code === "EXPORT_BROWSER_TRANSLATION_BLOCKED") {
        status.textContent =
          pErr.exportBlockedBrowserTranslation ||
          "Browser translation detected. Please disable page translation and retry.";
        status.style.color = "#7a0000";
        appendComplianceEventFireAndForget("export_png_failure", { reason: "browser_translation_blocked" });
        return;
      }
      const baseMsg = pErr.exportFailPng || "Export failed: PNG render error";
      const hint = err && err.message ? String(err.message).slice(0, 120) : "";
      status.textContent = hint ? `${baseMsg} (${hint})` : baseMsg;
      status.style.color = "#7a0000";
      appendComplianceEventFireAndForget("export_png_failure", {
        reason: "render_or_encode_failed",
        detail: String(err && err.message ? err.message : err).slice(0, 160),
      });
    } finally {
      resetExportPurposeStatementDisplay();
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

function bindExportTranscriptPdf() {
  const btn = document.getElementById("export-transcript-pdf");
  const status = document.getElementById("export-status");
  if (!btn || !status) {
    return;
  }
  btn.addEventListener("click", async () => {
    const ack = document.getElementById("legal-ack");
    if (!ack || !ack.checked) {
      status.textContent = uiPack().exportBlocked || "Export blocked: confirm legal acknowledgment in the sidebar.";
      status.style.color = "#8a6d00";
      appendComplianceEventFireAndForget("export_blocked", { reason: "legal_ack_required_transcript_pdf" });
      ack?.focus();
      return;
    }
    const p = uiPack();
    if (typeof window.html2canvas !== "function") {
      status.textContent = p.exportFailCanvas || "Export failed: html2canvas not loaded";
      status.style.color = "#7a0000";
      appendComplianceEventFireAndForget("export_transcript_pdf_failure", { reason: "html2canvas_not_loaded" });
      return;
    }
    const JsPDFCtor = resolveTranscriptJsPDFConstructor();
    if (!JsPDFCtor) {
      status.textContent = p.exportPdfJsPdfMissing || "jsPDF library not loaded";
      status.style.color = "#7a0000";
      appendComplianceEventFireAndForget("export_transcript_pdf_failure", { reason: "jspdf_not_loaded" });
      return;
    }
    if (!(await requestExportPreflightConfirmAsync())) {
      return;
    }

    const blurWasOn = isPrivacyPreviewEnabled();
    try {
      if (blurWasOn) {
        applyPrivacyPreviewToTranscript(false);
      }
      applyExportPurposeStatementForExport();
      status.textContent = p.exportTranscriptPdfRendering || "Export: Rendering transcript PDF…";
      status.style.color = "#3b3b3b";
      await fetchTrustedTimestamp();
      applyTranscriptDateIssuedForExportCapture();
      const canvas = await captureTranscriptPageToCanvasForExport({ intent: "pdf" });
      const docId = sanitizeExportFileToken(document.getElementById("document-id")?.textContent?.trim() || "transcript");
      const pdfPageSpec = readTranscriptPdfPageSpec();
      const rasterQ = 0.93;
      const jpegDataUrl = canvas.toDataURL("image/jpeg", rasterQ);
      const b64 = jpegDataUrl.split(",")[1] || "";
      if (!b64) {
        throw new Error("JPEG rasterization failed (empty payload)");
      }
      const binStr = atob(b64);
      const u8 = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i += 1) {
        u8[i] = binStr.charCodeAt(i);
      }
      const jpegDigest = await sha256HexFromBinary(u8);
      const hash8 = jpegDigest.slice(0, 8).toUpperCase();
      const ymd = formatExportDateYmdCompact();
      const pdfBase = `${docId}_${ymd}_${hash8}-transcript-a3`;
      const pdfSha = await addCanvasToPdfSingleSheetFit(JsPDFCtor, canvas, pdfBase, {
        ...pdfPageSpec,
        rasterMime: "image/jpeg",
        rasterQuality: rasterQ,
      });
      status.textContent =
        typeof p.exportTranscriptPdfComplete === "function"
          ? p.exportTranscriptPdfComplete(pdfBase)
          : `Export: Complete (${pdfBase}.pdf)`;
      status.style.color = "#0a5d16";
      if (pdfSha) {
        appendExportSuccessReceiptUI(status, docId, pdfSha);
      }
      appendComplianceEventFireAndForget("export_transcript_pdf_success", {
        docId,
        pdfLayout: pdfPageSpec.orientation,
      });
    } catch (err) {
      const pErr = uiPack();
      if (err && err.code === "EXPORT_BROWSER_TRANSLATION_BLOCKED") {
        status.textContent =
          pErr.exportBlockedBrowserTranslation ||
          "Browser translation detected. Please disable page translation and retry.";
        status.style.color = "#7a0000";
        appendComplianceEventFireAndForget("export_transcript_pdf_failure", { reason: "browser_translation_blocked" });
      } else {
        const base = p.exportTranscriptPdfFail || "Export failed: transcript PDF";
        const hint = err && err.message ? String(err.message).slice(0, 120) : "";
        status.textContent = hint ? `${base} (${hint})` : base;
        status.style.color = "#7a0000";
        appendComplianceEventFireAndForget("export_transcript_pdf_failure", {
          reason: "render_failed",
          detail: String(err && err.message ? err.message : err).slice(0, 160),
        });
      }
    } finally {
      resetExportPurposeStatementDisplay();
      if (blurWasOn) {
        applyPrivacyPreviewToTranscript(true);
        refreshEditablePanel();
      }
    }
  });
}

/**
 * Term totals: Attempted / Earned = sum of credits in each row; GPA Hours / Quality / Term GPA use
 * {@link row.dataset.hours} and {@link row.dataset.quality} (Pass-only rows contribute 0 GPA hours).
 * Cumulative: two-term mode = sum of every active term; single-term mode = same totals as the one
 * visible term (`.term-block:not(.term-block-inactive)`). Cumulative nodes are re-resolved each run
 * because language switching updates totals row labels without rebuilding those nodes.
 */
function fillTermTotals(options) {
  const skipGradeRowPass = Boolean(options && options.skipGradeRowPass);
  applyTermLayoutMode();
  /** Cumulative GPA band thresholds for neutral Academic Standing labels (see `.standing`). */
  const STANDING_EXCELLENT_MIN = 3.5;
  const STANDING_GOOD_MIN = 3.0;
  const STANDING_FAIR_MIN = 2.0;

  const sumAttemptedCreditsFromRows = (rows) =>
    rows.reduce((sum, row) => {
      const cells = row.querySelectorAll("td");
      const c = parseTranscriptNumber(cells[COURSE_COL_CREDITS]?.textContent);
      return sum + (Number.isFinite(c) ? c : 0);
    }, 0);

  const sumGpaHoursQualityFromRows = (rows) => {
    let hours = 0;
    let quality = 0;
    rows.forEach((row) => {
      const gh = parseTranscriptNumber(row.dataset.hours || "0");
      const q = parseTranscriptNumber(row.dataset.quality || "0");
      hours += Number.isFinite(gh) ? gh : 0;
      quality += Number.isFinite(q) ? q : 0;
    });
    return { hours, quality };
  };

  const termBlocks = getActiveTermBlocks();
  const singleTerm = isSingleTermLayout();
  const domesticSlots = readDomesticTermGpas();
  const showDomesticPair = domesticSlots.slice(0, termBlocks.length).some((d) => d != null);

  let cumDomesticNum = 0;
  let cumDomesticDen = 0;

  termBlocks.forEach((block, idx) => {
    const rows = Array.from(block.querySelectorAll("tbody tr"));
    if (!skipGradeRowPass) {
      rows.forEach((row) => applyGradeAndQualityFromPercent(row));
    }
    const attempted = sumAttemptedCreditsFromRows(rows);
    const earned = attempted;
    const { hours: gpaHours, quality } = sumGpaHoursQualityFromRows(rows);
    const gpa = gpaHours > 0 ? quality / gpaHours : 0;

    block.querySelector(".attempted").textContent = formatTwo(attempted);
    block.querySelector(".earned").textContent = formatTwo(earned);
    block.querySelector(".gpa-hours").textContent = formatTwo(gpaHours);
    block.querySelector(".quality").textContent = formatTwo(quality);

    const domesticG = idx < domesticSlots.length ? domesticSlots[idx] : null;
    if (domesticG != null && Number.isFinite(domesticG)) {
      cumDomesticNum += domesticG * gpaHours;
      cumDomesticDen += gpaHours;
    }

    const intlEl = block.querySelector(".term-gpa");
    const domEl = block.querySelector(".term-gpa-domestic");
    const sepEl = block.querySelector(".term-gpa-sep");
    if (intlEl) {
      intlEl.textContent = formatTwo(gpa);
    }
    if (domEl && sepEl) {
      if (showDomesticPair) {
        domEl.style.display = "";
        sepEl.style.display = "";
        domEl.textContent = domesticG != null ? formatTwo(domesticG) : "—";
      } else {
        domEl.style.display = "none";
        sepEl.style.display = "none";
        domEl.textContent = "";
      }
    }
  });

  let cumulativeAttempted = 0;
  let cumulativeEarned = 0;
  let cumulativeGpaHours = 0;
  let cumulativeQuality = 0;
  if (singleTerm) {
    const primary = document.querySelector(".term-block:not(.term-block-inactive)");
    if (primary) {
      const rows = Array.from(primary.querySelectorAll("tbody tr"));
      cumulativeAttempted = sumAttemptedCreditsFromRows(rows);
      cumulativeEarned = cumulativeAttempted;
      const sums = sumGpaHoursQualityFromRows(rows);
      cumulativeGpaHours = sums.hours;
      cumulativeQuality = sums.quality;
    }
  } else {
    termBlocks.forEach((block) => {
      const rows = Array.from(block.querySelectorAll("tbody tr"));
      cumulativeAttempted += sumAttemptedCreditsFromRows(rows);
      const sums = sumGpaHoursQualityFromRows(rows);
      cumulativeGpaHours += sums.hours;
      cumulativeQuality += sums.quality;
    });
    cumulativeEarned = cumulativeAttempted;
  }

  const cumulativeGpa = cumulativeGpaHours > 0 ? cumulativeQuality / cumulativeGpaHours : 0;
  const cumAttempted = document.getElementById("cum-attempted");
  const cumEarned = document.getElementById("cum-earned");
  const cumGpaHours = document.getElementById("cum-gpa-hours");
  const cumQuality = document.getElementById("cum-quality");
  const cumGpa = document.getElementById("cum-gpa");
  const cumGpaDomestic = document.getElementById("cum-gpa-domestic");
  const cumGpaSep = document.querySelector(".cumulative-box .cum-gpa-sep");
  if (cumAttempted) cumAttempted.textContent = formatTwo(cumulativeAttempted);
  if (cumEarned) cumEarned.textContent = formatTwo(cumulativeEarned);
  if (cumGpaHours) cumGpaHours.textContent = formatTwo(cumulativeGpaHours);
  if (cumQuality) cumQuality.textContent = formatTwo(cumulativeQuality);
  if (cumGpa) cumGpa.textContent = formatTwo(cumulativeGpa);

  const cumDomesticGpa = cumDomesticDen > 0 ? cumDomesticNum / cumDomesticDen : null;
  const showCumDomestic = cumDomesticDen > 0;
  if (cumGpaDomestic && cumGpaSep) {
    if (showCumDomestic) {
      cumGpaDomestic.style.display = "";
      cumGpaSep.style.display = "";
      cumGpaDomestic.textContent = formatTwo(cumDomesticGpa);
    } else {
      cumGpaDomestic.style.display = "none";
      cumGpaSep.style.display = "none";
      cumGpaDomestic.textContent = "";
    }
  }

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
  applyGradeScaleDisclaimer();
}

/**
 * Intentional `window` exports for manual QA, console scripting, or external test harnesses (not referenced from `index.html`).
 * `i18n.js` / wizard hooks use the other `window.transcriptTool*` symbols defined elsewhere in this file.
 */
/** Hash sidebar raw inputs once per export so the integrity QR can bind to pre-capture form state. */
window.captureRawInputToken = captureRawInputToken;
/** SHA-256 of canonical transcript HTML (export-time digest). */
window.captureFinalTranscriptHash = captureFinalTranscriptHash;
/** SHA-256 of the local compliance / audit mirror used in QR payloads. */
window.captureAuditLogHash = captureAuditLogHash;
/** Builds the export JSON payload and refreshes the on-page integrity QR (await during PNG/PDF capture). */
window.generateExportQRPayload = generateExportQRPayload;
/** Renders payload JSON into `#export-integrity-qr` (or another host) via `qrcode.min.js`; used by export + live preview. */
window.renderStandardQrToImage = renderStandardQrToImage;

function initOfflineQrLibrarySelfCheck() {
  updateExportQrFallback({});
}

const TRANSCRIPT_TOOL_AUTOSAVE_KEY = "transcript-tool-autosave";
const SHARE_HASH_PREFIX = "#share=";
/** Session-only consent flag: survives refresh, cleared when the tab is discarded. */
const TRANSCRIPT_TOOL_SESSION_CONSENT_KEY = "transcript-tool-session-consent-v1";
/**
 * Same-tab lifecycle marker (exact key name per product spec). Absent after the tab is closed → next open
 * treats storage as stale; present across reloads → `localStorage` autosave is restored on refresh.
 */
const TRANSCRIPT_SESSION_ACTIVE_KEY = "transcriptSessionActive";
/** @deprecated Migrated off `localStorage`; cleared when the user passes the consent gate. */
const TRANSCRIPT_TOOL_CONSENT_HASH_KEY = "transcript-tool-consent-hash";

let autosaveTimer = null;
let lastAutosaveJson = null;
/** When true, `lang-select` `value` is being set from code (avoid nested `change` handlers). */
let suppressLangSelectProgrammatic = false;

function sidebarI18nText(key) {
  const z = getUiLang() === "zh" ? "zh" : "en";
  const sb = window.TRANSCRIPT_SIDEBAR && window.TRANSCRIPT_SIDEBAR[z];
  return (sb && sb[key]) || "";
}

function getEditableSidebarSyncNodes() {
  return orderEditableNodesForSidebarStableCourseRows(
    Array.from(document.querySelectorAll("[data-edit-label]")).filter((node) => isTranscriptSidebarEditNode(node))
  );
}

function collectEditorSnapshotByEditLabel() {
  const nodes = orderEditableNodesForSidebarStableCourseRows(
    Array.from(document.querySelectorAll("[data-edit-label]")).filter((node) => isTranscriptSidebarEditNode(node))
  );
  const fields = Array.from(document.querySelectorAll("#editor-form .editor-field"));
  const map = {};
  for (let i = 0; i < nodes.length && i < fields.length; i += 1) {
    if (nodes[i].dataset.issueSignatureAuto === "true") {
      continue;
    }
    if (nodes[i].dataset.editLabel === "Certification Institution Line") {
      continue;
    }
    const label = nodes[i].dataset.editLabel || `idx_${i}`;
    const inp = fields[i].querySelector("input") || fields[i].querySelector("select");
    if (inp) {
      map[label] = inp.value ?? "";
    }
  }
  return map;
}

function collectCoursesBySemesterForSave() {
  const page = document.getElementById("transcript-page");
  if (!page) {
    return {};
  }
  const out = {};
  page.querySelectorAll(".term-block[data-semester-kind]").forEach((block) => {
    const kind = block.dataset.semesterKind;
    if (!kind) {
      return;
    }
    const rows = [];
    block.querySelectorAll("tbody tr").forEach((tr) => {
      rows.push(Array.from(tr.querySelectorAll("td")).map((td) => td.textContent?.trim() || ""));
    });
    out[kind] = rows;
  });
  return out;
}

function collectAutosaveSnapshot() {
  const docIdEl = document.getElementById("document-id");
  const pii = {};
  Object.keys(piiKeyBackup).forEach((k) => {
    pii[k] = piiKeyBackup[k];
  });
  return {
    v: 4,
    uiLang: getUiLang(),
    documentId: docIdEl?.textContent?.trim() || "",
    editByLabel: collectEditorSnapshotByEditLabel(),
    pii,
    coursesBySemester: collectCoursesBySemesterForSave(),
    termLayoutMode: document.getElementById("term-layout-mode")?.value || "two",
    termOrder: document.getElementById("term-order")?.value || "fall-spring",
    termYear1: document.getElementById("term-year-1")?.value || "",
    termYear2: document.getElementById("term-year-2")?.value || "",
    termSelect: document.getElementById("term-select")?.value || "0",
    personalSsn: document.getElementById("personal-ssn-input")?.value || "",
    chsiCode: document.getElementById("chsi-verify-code-input")?.value || "",
    legalAck: Boolean(document.getElementById("legal-ack")?.checked),
    privacyPreview: Boolean(document.getElementById("privacy-preview-toggle")?.checked),
    domesticTermGpa1: normalizeDomesticGpaForAutosave(document.getElementById("domestic-term-gpa-1")?.value),
    domesticTermGpa2: normalizeDomesticGpaForAutosave(document.getElementById("domestic-term-gpa-2")?.value),
    exportPurpose: document.getElementById("export-purpose-input")?.value || "",
  };
}

/**
 * Writes the bilingual autosave bundle: per-`uiLang` partitions plus `shared`
 * (SSN, CHSI, DOB, email, student ID, domestic term GPAs).
 * @param {{ persistCrossTab?: boolean }} [opts]
 */
function saveToLocalStorage(opts) {
  const z = getUiLang() === "zh" ? "zh" : "en";
  const failMsg =
    window.TRANSCRIPT_SIDEBAR?.[z]?.autosaveFailedToast || window.TRANSCRIPT_SIDEBAR?.en?.autosaveFailedToast || "";
  try {
    const full = collectAutosaveSnapshot();
    let bundle = readAutosaveBundleFromLocalStorage();
    if (!bundle) {
      bundle = {
        v: AUTOSAVE_BUNDLE_VERSION,
        persistAcrossTabClose: false,
        shared: extractSharedFieldsFromSnapshot(full),
        en: null,
        zh: null,
      };
    }
    bundle.v = AUTOSAVE_BUNDLE_VERSION;
    bundle.shared = extractSharedFieldsFromSnapshot(full);
    const stripped = stripSharedFieldsFromSnapshot(full);
    if (stripped) {
      stripped.uiLang = z;
      bundle[z] = stripped;
    }
    if (opts && opts.persistCrossTab) {
      bundle.persistAcrossTabClose = true;
    }
    const json = JSON.stringify(bundle);
    if (json === lastAutosaveJson) {
      return;
    }
    localStorage.setItem(TRANSCRIPT_TOOL_AUTOSAVE_KEY, json);
    lastAutosaveJson = json;
  } catch (_e) {
    if (failMsg) {
      showEditorGenericToast(failMsg, 6500);
    }
  }
}

function scheduleAutosaveToLocalStorage() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
  }
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    saveToLocalStorage();
  }, 800);
}

function applyCoursesSnapshot(cMap) {
  const page = document.getElementById("transcript-page");
  if (!page || !cMap || typeof cMap !== "object") {
    return;
  }
  page.querySelectorAll(".term-block[data-semester-kind]").forEach((block) => {
    const kind = block.dataset.semesterKind;
    if (!kind) {
      return;
    }
    const rowList = cMap[kind];
    if (!Array.isArray(rowList)) {
      return;
    }
    const tbody = block.querySelector("tbody");
    if (!tbody) {
      return;
    }
    /* Shipped HTML has a fixed row count per term; imports add rows. Grow/shrink tbody to match snapshot or refresh drops extra courses. */
    let trs = Array.from(tbody.querySelectorAll("tr"));
    while (trs.length < rowList.length) {
      const nr = createBlankRow();
      nr.dataset.sidebarSlot = allocateNextSidebarSlotForTbody(tbody);
      tbody.appendChild(nr);
      trs = Array.from(tbody.querySelectorAll("tr"));
    }
    while (trs.length > rowList.length) {
      const last = trs[trs.length - 1];
      if (!last) {
        break;
      }
      tbody.removeChild(last);
      trs = Array.from(tbody.querySelectorAll("tr"));
    }
    trs = Array.from(tbody.querySelectorAll("tr"));
    rowList.forEach((cells, ri) => {
      const tr = trs[ri];
      if (!tr || !Array.isArray(cells)) {
        return;
      }
      const tds = tr.querySelectorAll("td");
      for (let c = 0; c < 8 && c < cells.length; c += 1) {
        if (tds[c]) {
          tds[c].textContent = String(cells[c] ?? "");
        }
      }
      applyGradeAndQualityFromPercent(tr);
    });
    updateRowIndexes(block);
  });
  attachRowActionButtons();
}

function applyAutosaveSnapshot(data) {
  if (!data || typeof data !== "object") {
    return;
  }
  data = normalizeSnapshotForApply(data);
  const page = document.getElementById("transcript-page");
  if (!page) {
    return;
  }
  if (data.editByLabel && typeof data.editByLabel === "object") {
    if (data.editByLabel.Program != null && data.editByLabel["Type of Education"] == null) {
      data.editByLabel["Type of Education"] = data.editByLabel.Program;
    }
    const byLabel = new Map();
    page.querySelectorAll("[data-edit-label]").forEach((n) => {
      const lab = n.dataset.editLabel;
      if (lab && isTranscriptSidebarEditNode(n)) {
        byLabel.set(lab, n);
      }
    });
    Object.entries(data.editByLabel).forEach(([label, val]) => {
      if (label === "Issue And Digital Signature") {
        return;
      }
      if (label === "Certification Institution Line") {
        return;
      }
      const node = byLabel.get(label);
      if (node) {
        writeEditableSurfaceText(node, String(val ?? ""));
      }
    });
  }
  if (data.pii && typeof data.pii === "object") {
    const lang = getUiLang() === "zh" ? "zh" : "en";
    Object.entries(data.pii).forEach(([key, val]) => {
      const span = Array.from(page.querySelectorAll("[data-pii-key]")).find((sp) => sp.dataset.piiKey === key);
      if (!span) {
        return;
      }
      const v = String(val ?? "");
      piiKeyBackup[key] = DATE_PII_KEYS.has(key) ? canonicalizePiiDateBackupValue(key, v) : v;
      const canon = piiKeyBackup[key];
      span.textContent = isPrivacyPreviewEnabled()
        ? "***"
        : DATE_PII_KEYS.has(key)
          ? formatPiiCanonicalDateForTranscriptPage(String(canon), lang)
          : String(canon);
    });
  }
  const ssnIn = document.getElementById("personal-ssn-input");
  if (ssnIn && typeof data.personalSsn === "string") {
    ssnIn.value = data.personalSsn.replace(/\D/g, "").slice(0, 18);
    syncPersonalSsnDisplay();
  }
  const chsiIn = document.getElementById("chsi-verify-code-input");
  if (chsiIn && typeof data.chsiCode === "string") {
    chsiIn.value = data.chsiCode;
    syncChsiVerifyCodeToTranscript();
  }
  const d1 = document.getElementById("domestic-term-gpa-1");
  if (d1 && data.domesticTermGpa1 != null) {
    d1.value = normalizeDomesticGpaFromAutosave(data.domesticTermGpa1);
  }
  const d2 = document.getElementById("domestic-term-gpa-2");
  if (d2 && data.domesticTermGpa2 != null) {
    d2.value = normalizeDomesticGpaFromAutosave(data.domesticTermGpa2);
  }
  const expPur = document.getElementById("export-purpose-input");
  if (expPur && typeof data.exportPurpose === "string") {
    expPur.value = data.exportPurpose;
  }
  const tlm = document.getElementById("term-layout-mode");
  if (tlm && data.termLayoutMode) {
    tlm.value = data.termLayoutMode;
  }
  const to = document.getElementById("term-order");
  if (to && data.termOrder) {
    to.value = data.termOrder;
  }
  const y1 = document.getElementById("term-year-1");
  if (y1 && data.termYear1 != null) {
    y1.value = String(data.termYear1);
  }
  const y2 = document.getElementById("term-year-2");
  if (y2 && data.termYear2 != null) {
    y2.value = String(data.termYear2);
  }
  const ts = document.getElementById("term-select");
  if (ts && data.termSelect != null) {
    ts.value = String(data.termSelect);
  }
  const ack = document.getElementById("legal-ack");
  if (ack && typeof data.legalAck === "boolean") {
    ack.checked = data.legalAck;
  }
  const priv = document.getElementById("privacy-preview-toggle");
  if (priv && typeof data.privacyPreview === "boolean") {
    priv.checked = data.privacyPreview;
    applyPrivacyPreviewToTranscript(data.privacyPreview);
  }
  const docIdEl = document.getElementById("document-id");
  if (docIdEl && typeof data.documentId === "string" && data.documentId.trim()) {
    docIdEl.textContent = data.documentId.trim();
  }
  applyCoursesSnapshot(data.coursesBySemester);
  syncCertificationInstitutionLineToTranscript();
}

function loadFromLocalStorage() {
  let raw = "";
  try {
    raw = localStorage.getItem(TRANSCRIPT_TOOL_AUTOSAVE_KEY) || "";
  } catch (_e) {
    return false;
  }
  if (!raw.trim()) {
    return false;
  }
  try {
    const parsed = parseStoredAutosavePayload(raw);
    let bundle = parsed.bundle;
    if (!bundle && parsed.legacyFlat) {
      bundle = migrateFlatAutosaveToBundle(parsed.legacyFlat);
    }
    if (!bundle) {
      return false;
    }
    const langSel = document.getElementById("lang-select");
    const want = langSel && (langSel.value === "zh" || langSel.value === "en") ? langSel.value : "en";
    const part = bundle[want];
    if (part && typeof part === "object") {
      const merged = mergeSharedFieldsIntoSnapshot(part, bundle.shared);
      if (merged) {
        applyAutosaveSnapshot(merged);
      }
    } else {
      applyTranscriptDemoPresets();
      applySharedOverlayFromBundle(bundle.shared);
    }
    if (langSel) {
      langSel.value = want;
    }
    if (typeof window.applyTranscriptLanguage === "function") {
      window.applyTranscriptLanguage(want);
    }
    /* Default-on privacy: after restoring autosave, always mask transcript PII until the user turns the toggle off. */
    const privAfterAutosave = document.getElementById("privacy-preview-toggle");
    if (privAfterAutosave) {
      privAfterAutosave.checked = true;
    }
    applyPrivacyPreviewToTranscript(true);
    showAutosaveRestoreToast();
    lastAutosaveJson = raw;
    return true;
  } catch (_e) {
    try {
      localStorage.removeItem(TRANSCRIPT_TOOL_AUTOSAVE_KEY);
    } catch (_e2) {
      /* ignore */
    }
    lastAutosaveJson = null;
    return false;
  }
}

function buildSharePayload() {
  const snap = collectAutosaveSnapshot();
  const { pii: _omitPii, personalSsn: _omitSsn, privacyPreview: _omitPriv, exportPurpose: _omitEp, ...rest } = snap;
  void _omitPii;
  void _omitSsn;
  void _omitPriv;
  void _omitEp;
  return {
    v: 1,
    ...rest,
  };
}

function generateShareableUrl() {
  const payload = buildSharePayload();
  const json = JSON.stringify(payload);
  const base = `${location.origin}${location.pathname}${location.search}`;
  return `${base}${SHARE_HASH_PREFIX}${encodeURIComponent(json)}`;
}

function tryConsumeShareHash() {
  let h = "";
  try {
    h = typeof location !== "undefined" ? location.hash || "" : "";
  } catch (_e) {
    return false;
  }
  if (!h.startsWith(SHARE_HASH_PREFIX)) {
    return false;
  }
  const enc = h.slice(SHARE_HASH_PREFIX.length);
  let data = null;
  try {
    data = JSON.parse(decodeURIComponent(enc));
  } catch (_e) {
    return false;
  }
  if (!data || typeof data !== "object") {
    return false;
  }
  if (!data.editByLabel || typeof data.editByLabel !== "object") {
    return false;
  }
  applyAutosaveSnapshot({
    editByLabel: data.editByLabel,
    coursesBySemester: data.coursesBySemester,
    termLayoutMode: data.termLayoutMode,
    termOrder: data.termOrder,
    termYear1: data.termYear1,
    termYear2: data.termYear2,
    termSelect: data.termSelect,
    chsiCode: data.chsiCode,
    legalAck: data.legalAck,
    documentId: data.documentId,
    domesticTermGpa1: data.domesticTermGpa1,
    domesticTermGpa2: data.domesticTermGpa2,
    personalSsn: "",
    pii: {},
  });
  const langSel = document.getElementById("lang-select");
  const want = data.uiLang === "zh" || data.uiLang === "en" ? data.uiLang : getUiLang();
  if (langSel) {
    langSel.value = want;
  }
  if (typeof window.applyTranscriptLanguage === "function") {
    window.applyTranscriptLanguage(want);
  }
  try {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  } catch (_e) {
    /* ignore */
  }
  const ban = document.getElementById("share-data-banner");
  if (ban) {
    ban.textContent = sidebarI18nText("shareDataWarning");
    ban.hidden = false;
  }
  saveToLocalStorage();
  return true;
}

function bindExportReceiptClose() {
  const btn = document.getElementById("export-receipt-close");
  const panel = document.getElementById("export-receipt-panel");
  if (!btn || !panel) {
    return;
  }
  if (btn.dataset.bound) {
    return;
  }
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => {
    panel.hidden = true;
  });
}

function bindExportTransparencyReport() {
  const btn = document.getElementById("export-transparency-report");
  const status = document.getElementById("export-status");
  if (!btn || !status) {
    return;
  }
  btn.addEventListener("click", async () => {
    const ack = document.getElementById("legal-ack");
    const p = uiPack();
    if (!ack || !ack.checked) {
      status.textContent = p.exportBlocked || "Export blocked: confirm legal acknowledgment in the sidebar.";
      status.style.color = "#8a6d00";
      appendComplianceEventFireAndForget("export_blocked", { reason: "legal_ack_required" });
      ack?.focus();
      return;
    }
    const JsPDF = resolveTranscriptJsPDFConstructor();
    if (typeof JsPDF !== "function") {
      status.textContent = p.exportPdfJsPdfMissing || "jsPDF library not loaded";
      status.style.color = "#7a0000";
      return;
    }
    status.textContent = p.transparencyGenerating || status.dataset.transparencyGenerating || "";
    status.style.color = "#3b3b3b";
    try {
      const docId = document.getElementById("document-id")?.textContent?.trim() || "transcript";
      const repGenAt = formatAuditLocalWallClock(Date.now());
      const hashEl = document.getElementById("export-file-hash");
      const pngHashFull =
        (hashEl && hashEl.dataset && hashEl.dataset.fullSha256) || lastExportedPngFullSha256 || "";
      const pngHashLine = pngHashFull
        ? `${p.transparencyReportPngSha256FullLabel || "Last exported PNG — full SHA-256 (file digest)"}: ${pngHashFull}`
        : `${p.transparencyReportPngSha256FullLabel || "Last exported PNG — full SHA-256 (file digest)"}: ${
            p.transparencyReportNoPriorPngExport || "(No completed PNG export in this session yet.)"
          }`;
      const title = `${p.transparencyReportTitle || "Session transparency report"} — ${TRANSCRIPT_TOOL_VERSION}`;
      const lines = [
        title,
        "",
        p.transparencyReportExportDigestHeader || "Exported artifact digest (PNG file, not this page’s DOM):",
        pngHashLine,
        `${p.transparencyReportLastPngFileNameLabel || "Last PNG file name"}: ${
          lastExportedPngFileName || p.transparencyReportFieldNone || "—"
        }`,
        `${p.transparencyReportLastPngExportedAtLabel || "Last PNG export time (local wall clock)"}: ${
          lastExportedPngAtMs ? formatAuditLocalWallClock(lastExportedPngAtMs) : p.transparencyReportFieldNone || "—"
        }`,
        `${p.transparencyReportGeneratedAtLabel || "This transparency report generated (local wall clock)"}: ${repGenAt}`,
        p.transparencyReportPngHashDisclaimer ||
          "The following hash is the digest of the downloaded PNG file, not the web page content. / 以下哈希为已下载的 PNG 文件摘要，非网页内容摘要。",
        "",
        `Session UI locale (reference): ${getUiLang() === "zh" ? "zh" : "en"}`,
        "",
        `Tool version: ${TRANSCRIPT_TOOL_VERSION}`,
        `html2canvas: ${resolveHtml2canvasVersionString()}`,
        `jsPDF: ${resolveJsPdfVersionString()}`,
        `QRCode global: ${typeof window.QRCode === "function" ? "present" : "absent"}`,
        `Document ID: ${docId}`,
        "",
        p.transparencyReportComplianceHeader || "Compliance log (timestamps and event types only):",
        ...readComplianceMirrorSummaryLines().slice(-200),
      ];
      const doc = new JsPDF({ unit: "mm", format: "a4" });
      const margin = 14;
      const maxW = doc.internal.pageSize.getWidth() - margin * 2;
      const pageH = doc.internal.pageSize.getHeight();
      let y = 18;
      const addWrapped = (text) => {
        const raw = text == null ? "" : String(text);
        const chunks =
          typeof doc.splitTextToSize === "function" ? doc.splitTextToSize(raw, maxW) : [raw];
        const arr = Array.isArray(chunks) ? chunks : [String(chunks)];
        for (let i = 0; i < arr.length; i += 1) {
          if (y > pageH - 16) {
            doc.addPage();
            y = 18;
          }
          doc.text(arr[i], margin, y);
          y += 5;
        }
      };
      for (let j = 0; j < lines.length; j += 1) {
        addWrapped(lines[j]);
      }
      const footer = typeof p.transparencyReportFooter === "string" ? p.transparencyReportFooter : "";
      if (footer) {
        y += 4;
        addWrapped(footer);
      }
      const fileName = `${docId}_transparency.pdf`;
      doc.save(fileName);
      appendComplianceEventFireAndForget(COMPLIANCE_EVENT_TRANSPARENCY_REPORT_EXPORTED, {
        docId,
        timestamp: Date.now(),
      });
      const pDone = uiPack();
      const cap = pDone.transparencyFileNameCaption || status.dataset.transparencyFileNameCaption || "File name";
      const base = pDone.transparencyComplete || status.dataset.transparencyComplete || "";
      const zhLine = base ? `${base}（${cap}：${fileName}）` : fileName;
      const enLine = base ? `${base} (${cap}: ${fileName})` : fileName;
      status.textContent = getUiLang() === "zh" ? zhLine : enLine;
      status.style.color = "#0a5d16";
    } catch (_e) {
      status.textContent = p.transparencyReportFail || "Could not generate transparency report.";
      status.style.color = "#7a0000";
    }
  });
}

function bindSystemSelfCheck() {
  const btn = document.getElementById("system-self-check");
  if (!btn) {
    return;
  }
  btn.addEventListener("click", async () => {
    const status = document.getElementById("export-status");
    const p = uiPack();
    console.log("=== Transcript tool self-check ===");
    console.log("Tool version:", TRANSCRIPT_TOOL_VERSION);
    let h2cSha = "(fetch failed)";
    try {
      const res = await fetch("./html2canvas.min.js", { cache: "no-store" });
      const buf = new Uint8Array(await res.arrayBuffer());
      h2cSha = await sha256HexFromBinary(buf);
    } catch (err) {
      console.warn("html2canvas fetch/hash error:", err);
    }
    console.log("html2canvas.min.js SHA-256:", h2cSha);
    console.log("Matches README / smoke expected:", h2cSha === HTML2CANVAS_VENDOR_SHA256_EXPECTED);
    console.log("qrcode.min.js (global QRCode):", typeof window.QRCode === "function" ? "present" : "absent");
    const PdfCtor = resolveTranscriptJsPDFConstructor();
    console.log("jsPDF constructor:", typeof PdfCtor === "function" ? "present" : "absent");
    ["perimeter-warning", "tamper-warning-line", "legal-confirmation-line", "legal-ack"].forEach((id) => {
      console.log(`#${id}:`, document.getElementById(id) ? "ok" : "MISSING");
    });
    let logCount = 0;
    try {
      const raw = localStorage.getItem(COMPLIANCE_LS_KEY);
      const arr = JSON.parse(raw || "[]");
      logCount = Array.isArray(arr) ? arr.length : 0;
    } catch (_e) {
      logCount = 0;
    }
    console.log("Compliance mirror entry count:", logCount);
    console.log("=== End self-check ===");
    appendComplianceEventFireAndForget("system_self_check", {});
    if (status && p.systemSelfCheckComplete) {
      status.textContent = p.systemSelfCheckComplete;
      status.style.color = "#3b3b3b";
    }
  });
}

function bindWizardModeControls() {
  const toggle = document.getElementById("wizard-mode-toggle");
  const chrome = document.getElementById("wizard-chrome");
  const aside = document.querySelector(".editor-panel");
  const steps = Array.from(document.querySelectorAll(".sidebar-wizard-step"));
  const tabs = Array.from(document.querySelectorAll(".wizard-tab"));
  if (!toggle || !chrome || !aside || steps.length === 0) {
    return;
  }
  let currentStep = 1;
  const applyStep = (n) => {
    currentStep = n;
    tabs.forEach((tab) => {
      const sn = Number(tab.dataset.wizardStep);
      const on = sn === n;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    steps.forEach((el) => {
      const sn = Number(el.dataset.wizardStep);
      el.classList.toggle("sidebar-wizard-step--hidden", toggle.checked && sn !== n);
    });
    const s = window.TRANSCRIPT_SIDEBAR?.[getUiLang() === "zh" ? "zh" : "en"] || {};
    const comp = document.getElementById("wizard-step-compliance");
    if (comp) {
      const key = n === 1 ? "wizardCompliance1" : n === 2 ? "wizardCompliance2" : "wizardCompliance3";
      comp.innerHTML = s[key] || "";
    }
  };
  /** `i18n.js` calls this after sidebar string updates so wizard step compliance copy matches the active language. */
  window.transcriptToolRefreshWizardCompliance = () => applyStep(currentStep);
  toggle.addEventListener("change", () => {
    chrome.hidden = !toggle.checked;
    aside.classList.toggle("wizard-mode-on", toggle.checked);
    if (!toggle.checked) {
      steps.forEach((el) => el.classList.remove("sidebar-wizard-step--hidden"));
    } else {
      applyStep(currentStep);
    }
  });
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (!toggle.checked) {
        return;
      }
      applyStep(Number(tab.dataset.wizardStep) || 1);
    });
  });
  chrome.hidden = !toggle.checked;
  aside.classList.toggle("wizard-mode-on", toggle.checked);
  if (toggle.checked) {
    applyStep(1);
  }
}

/** Clears autosave, resets sidebar + transcript to demo presets, and regenerates a fresh document id. */
function resetAllEditorDataToDemoPresetsCore() {
  try {
    localStorage.removeItem(TRANSCRIPT_TOOL_AUTOSAVE_KEY);
  } catch (_e) {
    /* ignore */
  }
  lastAutosaveJson = null;
  const ssn = document.getElementById("personal-ssn-input");
  if (ssn) {
    ssn.value = "";
  }
  const chsi = document.getElementById("chsi-verify-code-input");
  if (chsi) {
    chsi.value = "SAMPLE_CODE_DO_NOT_VERIFY";
  }
  const expPur = document.getElementById("export-purpose-input");
  if (expPur) {
    expPur.value = "";
  }
  const d1 = document.getElementById("domestic-term-gpa-1");
  const d2 = document.getElementById("domestic-term-gpa-2");
  if (d1) d1.value = "";
  if (d2) d2.value = "";
  const ack = document.getElementById("legal-ack");
  if (ack) {
    ack.checked = false;
  }
  const priv = document.getElementById("privacy-preview-toggle");
  if (priv) {
    priv.checked = true;
    applyPrivacyPreviewToTranscript(true);
  }
  const tlm = document.getElementById("term-layout-mode");
  if (tlm) {
    tlm.value = "two";
  }
  const to = document.getElementById("term-order");
  if (to) {
    to.value = "fall-spring";
  }
  const y1 = document.getElementById("term-year-1");
  const y2 = document.getElementById("term-year-2");
  const now = new Date();
  if (y1) {
    y1.value = String(now.getFullYear());
  }
  if (y2) {
    y2.value = String(now.getFullYear() - 1);
  }
  applyTermLayoutMode();
  applyTranscriptDemoPresets();
  syncChsiVerifyCodeToTranscript();
  const docIdEl = document.getElementById("document-id");
  if (docIdEl) {
    docIdEl.textContent = generateDocumentId();
  }
  refreshLegalAckStatusText();
  refreshEditablePanel();
  fillTermTotals();
  refreshTermSeasonHeadings?.();
  updateSecurityArtifacts();
  scheduleAutosaveToLocalStorage();
}

function bindResetAllDataButton() {
  const btn = document.getElementById("reset-all-data");
  if (!btn || btn.dataset.bound === "1") {
    return;
  }
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => {
    const msg = sidebarI18nText("resetAllConfirm") || "Reset all data? This cannot be undone.";
    if (!window.confirm(msg)) {
      return;
    }
    resetAllEditorDataToDemoPresetsCore();
  });
}

function bindShareLinkButton() {
  const btn = document.getElementById("generate-share-link");
  if (!btn || btn.dataset.bound === "1") {
    return;
  }
  btn.dataset.bound = "1";
  btn.addEventListener("click", async () => {
    const es = document.getElementById("export-status");
    let url = "";
    try {
      url = generateShareableUrl();
    } catch (_e) {
      if (es) {
        es.textContent = "Share link could not be generated.";
        es.style.color = "#7a0000";
      }
      return;
    }
    if (url.length > 60000 && es) {
      es.textContent = "Share link too long for the clipboard; reduce course rows or fields.";
      es.style.color = "#7a0000";
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch (_e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      } catch (_e2) {
        if (es) {
          es.textContent = "Could not copy link (clipboard blocked).";
          es.style.color = "#7a0000";
        }
        return;
      }
    }
    if (es) {
      es.textContent = sidebarI18nText("shareLinkCopied");
      es.style.color = "#0a5d16";
    }
  });
}

function bindAutosaveAndValidationListeners() {
  const form = document.getElementById("editor-form");
  if (form && !form.dataset.autosaveBound) {
    form.dataset.autosaveBound = "1";
    const onFormEdit = () => {
      scheduleAutosaveToLocalStorage();
      scheduleEditorHistoryCapture();
    };
    form.addEventListener("input", (ev) => {
      const t = ev.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        onFormEdit();
      }
    });
    form.addEventListener("change", (ev) => {
      const t = ev.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement) {
        onFormEdit();
      }
    });
  }
  const wire = (id) => {
    const el = document.getElementById(id);
    if (el && !el.dataset.autosaveBound) {
      el.dataset.autosaveBound = "1";
      const bump = () => {
        scheduleAutosaveToLocalStorage();
        scheduleEditorHistoryCapture();
      };
      el.addEventListener("input", bump);
      el.addEventListener("change", bump);
    }
  };
  wire("personal-ssn-input");
  wire("chsi-verify-code-input");
  wire("export-purpose-input");
  ["term-layout-mode", "term-order", "term-year-1", "term-year-2", "term-select"].forEach(wire);
  ["domestic-term-gpa-1", "domestic-term-gpa-2"].forEach(wire);
  const ack = document.getElementById("legal-ack");
  if (ack && !ack.dataset.autosaveBound) {
    ack.dataset.autosaveBound = "1";
    ack.addEventListener("change", () => {
      scheduleAutosaveToLocalStorage();
      scheduleEditorHistoryCapture();
    });
  }
  const priv = document.getElementById("privacy-preview-toggle");
  if (priv && !priv.dataset.autosaveBound) {
    priv.dataset.autosaveBound = "1";
    priv.addEventListener("change", () => {
      scheduleAutosaveToLocalStorage();
      scheduleEditorHistoryCapture();
    });
  }
}

function bindEditorUndoRedoControls() {
  const u = document.getElementById("editor-undo-btn");
  const r = document.getElementById("editor-redo-btn");
  const m = document.getElementById("manual-autosave-btn");
  if (u && !u.dataset.undoBound) {
    u.dataset.undoBound = "1";
    u.addEventListener("click", () => performEditorUndo());
  }
  if (r && !r.dataset.redoBound) {
    r.dataset.redoBound = "1";
    r.addEventListener("click", () => performEditorResetToInitial());
  }
  if (m && !m.dataset.manualSaveBound) {
    m.dataset.manualSaveBound = "1";
    m.addEventListener("click", () => manualSaveToLocalStorage());
  }
}

function bindEditorUndoHotkeys() {
  if (document.documentElement.dataset.editorUndoKeys) {
    return;
  }
  document.documentElement.dataset.editorUndoKeys = "1";
  document.addEventListener(
    "keydown",
    (ev) => {
      if (!ev.ctrlKey || ev.metaKey || ev.altKey) {
        return;
      }
      const form = document.getElementById("editor-form");
      if (!form || !form.contains(document.activeElement)) {
        return;
      }
      const k = String(ev.key || "").toLowerCase();
      if (k === "z" && !ev.shiftKey) {
        if (editorHistoryPtr > 0) {
          ev.preventDefault();
          performEditorUndo();
        }
      }
    },
    true
  );
}

function syncDuplicateRowPickerOptions() {
  const pick = document.getElementById("duplicate-row-pick");
  const termSelect = document.getElementById("term-select");
  if (!pick || !termSelect) {
    return;
  }
  const blocks = getActiveTermBlocks();
  const block = blocks[Number(termSelect.value)] || blocks[0];
  const tbody = block?.querySelector("tbody");
  const rows = tbody ? Array.from(tbody.querySelectorAll("tr")) : [];
  const prev = pick.value;
  pick.innerHTML = "";
  rows.forEach((tr, idx) => {
    const tds = tr.querySelectorAll("td");
    const desc = (tds[COURSE_COL_DESCRIPTION]?.textContent || "").trim().slice(0, 48);
    const opt = document.createElement("option");
    opt.value = String(idx + 1);
    opt.textContent = desc ? `${idx + 1}. ${desc}` : `${idx + 1}`;
    pick.appendChild(opt);
  });
  if (rows.length === 0) {
    const opt = document.createElement("option");
    opt.value = "0";
    opt.textContent = "—";
    pick.appendChild(opt);
  }
  if (prev && [...pick.options].some((o) => o.value === prev)) {
    pick.value = prev;
  } else if (pick.options.length) {
    pick.selectedIndex = pick.options.length - 1;
  }
}

function duplicateCourseRowAtPicker() {
  const termSelect = document.getElementById("term-select");
  const pick = document.getElementById("duplicate-row-pick");
  const blocks = getActiveTermBlocks();
  if (!termSelect || !pick || blocks.length === 0) {
    return;
  }
  const block = blocks[Number(termSelect.value)] || blocks[0];
  const tbody = block.querySelector("tbody");
  if (!tbody) {
    return;
  }
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const n = Number.parseInt(pick.value, 10);
  const tr = rows[Number.isFinite(n) && n > 0 ? n - 1 : rows.length - 1];
  if (!tr) {
    return;
  }
  const clone = tr.cloneNode(true);
  clone.dataset.sidebarSlot = allocateNextSidebarSlotForTbody(tbody);
  tbody.insertBefore(clone, tr.nextSibling);
  const termBlock = tr.closest(".term-block");
  if (termBlock) {
    updateRowIndexes(termBlock);
  }
  applyGradeAndQualityFromPercent(clone);
  fillTermTotals({ skipGradeRowPass: true });
  scheduleAutosaveToLocalStorage();
  scheduleSecurityArtifactsUpdate();
  refreshEditablePanel();
  scheduleEditorHistoryCapture();
}

function bindCourseFilterControls() {
  const inp = document.getElementById("course-filter-input");
  const clr = document.getElementById("course-filter-clear");
  if (!inp || inp.dataset.courseFilterBound) {
    return;
  }
  inp.dataset.courseFilterBound = "1";
  const apply = () => {
    const q = String(inp.value || "").trim().toLowerCase();
    document.querySelectorAll(".term-block tbody tr").forEach((tr) => {
      const desc = (tr.querySelectorAll("td")[COURSE_COL_DESCRIPTION]?.textContent || "").toLowerCase();
      const match = !q || desc.includes(q);
      tr.classList.toggle("course-filter-match", Boolean(q) && match);
      tr.classList.toggle("course-filter-dimmed", Boolean(q) && !match);
    });
  };
  inp.addEventListener("input", apply);
  if (clr) {
    clr.addEventListener("click", () => {
      inp.value = "";
      apply();
    });
  }
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape" || document.activeElement !== inp) {
      return;
    }
    inp.value = "";
    apply();
  });
}

function bindSidebarOverlayToggle() {
  const root = document.querySelector(".layout-root");
  const toggle = document.getElementById("sidebar-open-toggle");
  const backdrop = document.getElementById("sidebar-backdrop");
  const aside = document.getElementById("sidebar-editor");
  if (!root || !toggle || toggle.dataset.sidebarToggleBound) {
    return;
  }
  toggle.dataset.sidebarToggleBound = "1";
  const setOpen = (open) => {
    root.classList.toggle("sidebar-overlay-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (aside) {
      if (window.innerWidth < 1100) {
        aside.setAttribute("aria-hidden", open ? "false" : "true");
      } else {
        aside.removeAttribute("aria-hidden");
      }
    }
  };
  toggle.addEventListener("click", () => {
    setOpen(!root.classList.contains("sidebar-overlay-open"));
  });
  backdrop?.addEventListener("click", () => setOpen(false));
  window.addEventListener(
    "resize",
    () => {
      if (window.innerWidth >= 1100) {
        setOpen(false);
      }
    },
    { passive: true }
  );
}

function buildProjectJsonDownloadBlob() {
  const snap = collectAutosaveSnapshot();
  const out = { ...snap, personalSsn: "" };
  if (snap.personalSsn) {
    const te = new TextEncoder();
    out.personalSsnSha256 = sha256DigestHexJs(te.encode(String(snap.personalSsn).replace(/\D/g, "").slice(0, 18)));
  }
  return new Blob([JSON.stringify(out, null, 2)], { type: "application/json;charset=utf-8" });
}

function bindProjectJsonBackupControls() {
  const ex = document.getElementById("export-project-json");
  const imBtn = document.getElementById("import-project-json-btn");
  const imIn = document.getElementById("import-project-json-input");
  if (!imBtn || !imIn) {
    return;
  }
  if (!imBtn.dataset.projJsonImportBound) {
    imBtn.dataset.projJsonImportBound = "1";
    imBtn.addEventListener("click", () => imIn.click());
  }
  if (!imIn.dataset.projJsonFileBound) {
    imIn.dataset.projJsonFileBound = "1";
    imIn.addEventListener("change", () => {
    const z = getUiLang() === "zh" ? "zh" : "en";
    const s = window.TRANSCRIPT_SIDEBAR?.[z] || window.TRANSCRIPT_SIDEBAR?.en || {};
    const file = imIn.files && imIn.files[0];
    imIn.value = "";
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ""));
        editorHistoryMuted = true;
        try {
          applyAutosaveSnapshot(normalizeSnapshotForApply(data));
          const want = data.uiLang === "zh" || data.uiLang === "en" ? data.uiLang : getUiLang();
          const ls = document.getElementById("lang-select");
          if (ls) {
            ls.value = want;
          }
          if (typeof window.applyTranscriptLanguage === "function") {
            window.applyTranscriptLanguage(want);
          } else {
            refreshEditablePanel();
          }
        } finally {
          editorHistoryMuted = false;
        }
        resetEditorHistory();
        saveToLocalStorage();
        showEditorGenericToast(s.projectJsonImportedToast || "Loaded.", 3200);
      } catch (_e) {
        showEditorGenericToast(s.projectJsonImportFailToast || "Invalid JSON.", 5200);
      }
    };
    reader.onerror = () => showEditorGenericToast(s.projectJsonImportFailToast || "Invalid JSON.", 5200);
    reader.readAsText(file, "UTF-8");
  });
  }
  if (!ex || ex.dataset.projJsonBound) {
    return;
  }
  ex.dataset.projJsonBound = "1";
  ex.addEventListener("click", () => {
    const z = getUiLang() === "zh" ? "zh" : "en";
    const s = window.TRANSCRIPT_SIDEBAR?.[z] || window.TRANSCRIPT_SIDEBAR?.en || {};
    const blob = buildProjectJsonDownloadBlob();
    const docId = (document.getElementById("document-id")?.textContent || "transcript").trim().replace(/\s+/g, "_");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${docId || "transcript"}_project.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2500);
    showEditorGenericToast(s.projectJsonExportedToast || "Saved.", 3200);
    saveToLocalStorage({ persistCrossTab: true });
  });
}

/** Virtual filename for jsPDF VFS (need not match the source file on disk). */
const REVIEWER_GUIDE_ZH_FONT_VFS = "NotoSerifSC-embed.ttf";

function arrayBufferToBase64ForPdf(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < u8.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

let _reviewerGuideZhFontBase64 = null;
let _reviewerGuideZhFontPromise = null;

async function loadReviewerGuideZhFontBase64() {
  if (_reviewerGuideZhFontBase64) {
    return _reviewerGuideZhFontBase64;
  }
  if (!_reviewerGuideZhFontPromise) {
    _reviewerGuideZhFontPromise = (async () => {
      const urls = [];
      const localFontNames = [
        "NotoSerifSC-Regular.ttf",
        "NotoSerifSC[wght].ttf",
      ];
      for (let li = 0; li < localFontNames.length; li += 1) {
        try {
          urls.push(new URL(localFontNames[li], window.location.href).href);
        } catch (_e) {
          /* ignore invalid base URL */
        }
      }
      urls.push(
        "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
      );
      let lastErr = null;
      for (let i = 0; i < urls.length; i += 1) {
        try {
          const res = await fetch(urls[i], { cache: "force-cache" });
          if (!res.ok) {
            lastErr = new Error(`HTTP ${res.status}`);
            continue;
          }
          const b64 = arrayBufferToBase64ForPdf(await res.arrayBuffer());
          if (!b64) {
            lastErr = new Error("empty_font");
            continue;
          }
          _reviewerGuideZhFontBase64 = b64;
          return b64;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error("reviewer_guide_font_load_failed");
    })();
  }
  try {
    return await _reviewerGuideZhFontPromise;
  } finally {
    _reviewerGuideZhFontPromise = null;
  }
}

async function registerReviewerGuideZhFont(doc) {
  const b64 = await loadReviewerGuideZhFontBase64();
  doc.addFileToVFS(REVIEWER_GUIDE_ZH_FONT_VFS, b64);
  doc.addFont(REVIEWER_GUIDE_ZH_FONT_VFS, "NotoSerifSC", "normal");
  doc.setFont("NotoSerifSC", "normal");
}

async function exportReviewerVerificationGuidePdf() {
  const z = getUiLang() === "zh" ? "zh" : "en";
  const s = window.TRANSCRIPT_SIDEBAR?.[z] || window.TRANSCRIPT_SIDEBAR?.en || {};
  const g = s.reviewerGuidePdf || {};
  const lines = [
    g.title || "",
    "",
    g.p1 || "",
    "",
    g.p2 || "",
    "",
    g.p3 || "",
    "",
    g.p4 || "",
    "",
    g.p5 || "",
    "",
    g.p6 || "",
    "",
    g.footer || "",
  ];
  const PdfCtor = resolveTranscriptJsPDFConstructor();
  if (!PdfCtor) {
    showEditorGenericToast(s.exportPdfJsPdfMissing || "jsPDF missing", 4000);
    return;
  }
  const doc = new PdfCtor({ unit: "pt", format: "a4" });
  if (z === "zh") {
    try {
      await registerReviewerGuideZhFont(doc);
    } catch (_e) {
      showEditorGenericToast(
        z === "zh"
          ? "无法加载中文字体（Noto Serif SC），请将 NotoSerifSC[wght].ttf 或 NotoSerifSC-Regular.ttf 放在页面同目录后重试，或联网后重试。"
          : "Failed to load the Chinese font (Noto Serif SC) for the reviewer guide PDF.",
        5200
      );
      return;
    }
  }
  const margin = 48;
  let y = margin;
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = doc.internal.pageSize.getWidth() - margin * 2;
  doc.setFontSize(13);
  doc.text(lines[0], margin, y);
  y += 22;
  doc.setFontSize(10);
  for (let i = 2; i < lines.length; i += 1) {
    const para = lines[i];
    if (!para) {
      y += 10;
      continue;
    }
    const parts = doc.splitTextToSize(para, maxW);
    if (y + parts.length * 14 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(parts, margin, y);
    y += parts.length * 14 + 8;
  }
  const fn = (g.fileName || "reviewer_verification_guide") + ".pdf";
  doc.save(fn);
}

function getServiceConsentPack() {
  const sel = document.getElementById("lang-select");
  const v = sel?.value;
  if (v === "zh" || v === "en") {
    const p = window.TRANSCRIPT_I18N_PACK?.[v];
    if (p && p.serviceConsent) {
      return p.serviceConsent;
    }
  }
  const nav = (navigator.language || "").toLowerCase();
  const z = nav.startsWith("zh") ? "zh" : "en";
  return window.TRANSCRIPT_I18N_PACK?.[z]?.serviceConsent || window.TRANSCRIPT_I18N_PACK?.en?.serviceConsent;
}

function applyServiceConsentModalStrings() {
  const modal = document.getElementById("service-consent-modal");
  if (!modal || modal.hidden) {
    return;
  }
  const sc = getServiceConsentPack();
  if (!sc) {
    return;
  }
  const title = document.getElementById("service-consent-title");
  const stmt = document.getElementById("service-consent-statement");
  const inp = document.getElementById("consent-name-input");
  const btn = document.getElementById("consent-start-btn");
  if (title) {
    title.textContent = sc.title || "";
  }
  if (stmt) {
    stmt.textContent = sc.statement || "";
  }
  if (inp) {
    inp.placeholder = sc.placeholder || "";
  }
  if (btn) {
    btn.textContent = sc.button || "";
    btn.disabled = !inp?.value?.trim();
  }
}

function hasSessionServiceConsentAck() {
  try {
    return sessionStorage.getItem(TRANSCRIPT_TOOL_SESSION_CONSENT_KEY) === "1";
  } catch (_e) {
    return false;
  }
}

function bindServiceConsentGate(runMainInit) {
  const modal = document.getElementById("service-consent-modal");
  const inp = document.getElementById("consent-name-input");
  const btn = document.getElementById("consent-start-btn");
  if (!modal || !inp || !btn) {
    runMainInit();
    return;
  }
  if (hasSessionServiceConsentAck()) {
    modal.hidden = true;
    runMainInit();
    return;
  }
  modal.hidden = false;
  document.body.classList.add("service-consent-open");
  applyServiceConsentModalStrings();
  if (!btn.dataset.consentBound) {
    btn.dataset.consentBound = "1";
    inp.addEventListener("input", () => {
      btn.disabled = !inp.value.trim();
    });
    btn.addEventListener("click", async () => {
      const raw = inp.value.trim();
      if (!raw) {
        return;
      }
      const normalized = raw.normalize ? raw.normalize("NFC") : raw;
      const nameHash = await sha256Hex(
        JSON.stringify({ purpose: "transcript_tool_service_consent_v1", name: normalized })
      );
      try {
        sessionStorage.setItem(TRANSCRIPT_TOOL_SESSION_CONSENT_KEY, "1");
      } catch (_e) {
        /* storage blocked */
      }
      try {
        localStorage.removeItem(TRANSCRIPT_TOOL_CONSENT_HASH_KEY);
      } catch (_e2) {
        /* ignore */
      }
      appendComplianceEventFireAndForget("service_consent_ack", {
        nameHash,
        ts: Date.now(),
      });
      modal.hidden = true;
      document.body.classList.remove("service-consent-open");
      runMainInit();
    });
  }
}

function runTranscriptToolApplicationInit() {
void initComplianceAuditLog();

bindCourseRowControls();
bindExcelImport();
bindPhotoUpload();
bindLogoUpload();
bindCenterWatermarkUpload();
bindProtectionControls();
bindPrivacyPreviewControls();
bindExportPng();
bindExportTranscriptPdf();
bindExportGpaDiscrepancyReport();
bindExportReceiptClose();
bindExportPreflightModalOnce();
bindExportTransparencyReport();
bindSystemSelfCheck();
bindPersonalSsnInput();
bindChsiVerifyCodeInput();
bindDomesticGpaInputs();

const langSelect = document.getElementById("lang-select");
if (langSelect && !langSelect.dataset.i18nBound) {
  langSelect.dataset.i18nBound = "1";
  langSelect.addEventListener("change", handleLangSelectChangeWithPersistedPartitions);
  const nav = (navigator.language || "").toLowerCase();
  suppressLangSelectProgrammatic = true;
  langSelect.value = nav.startsWith("zh") ? "zh" : "en";
  suppressLangSelectProgrammatic = false;
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

let transcriptHydratedFromUrlOrStorage = false;
const isNewSession = (() => {
  try {
    return !sessionStorage.getItem(TRANSCRIPT_SESSION_ACTIVE_KEY);
  } catch (_e) {
    return true;
  }
})();

if (tryConsumeShareHash()) {
  transcriptHydratedFromUrlOrStorage = true;
  try {
    sessionStorage.setItem(TRANSCRIPT_SESSION_ACTIVE_KEY, "1");
  } catch (_e) {
    /* sessionStorage blocked */
  }
} else if (isNewSession) {
  /* New top-level browsing session: drop any prior tab’s autosave, then demo (no `loadFromLocalStorage`). */
  try {
    localStorage.removeItem(TRANSCRIPT_TOOL_AUTOSAVE_KEY);
  } catch (_e) {
    /* ignore */
  }
  try {
    sessionStorage.setItem(TRANSCRIPT_SESSION_ACTIVE_KEY, "1");
  } catch (_e2) {
    /* ignore */
  }
  applyTranscriptDemoPresets();
} else {
  let storedAutosave = "";
  try {
    storedAutosave = localStorage.getItem(TRANSCRIPT_TOOL_AUTOSAVE_KEY) || "";
  } catch (_e) {
    storedAutosave = "";
  }
  const parsed = parseStoredAutosavePayload(storedAutosave);
  const hasPersisted =
    Boolean(storedAutosave.trim()) &&
    (parsed.bundle ? Boolean(parsed.bundle.en || parsed.bundle.zh) : Boolean(parsed.legacyFlat));
  if (!hasPersisted) {
    applyTranscriptDemoPresets();
  } else if (loadFromLocalStorage()) {
    transcriptHydratedFromUrlOrStorage = true;
  } else {
    applyTranscriptDemoPresets();
  }
}
refreshEditablePanel();
bindWizardModeControls();
bindResetAllDataButton();
bindShareLinkButton();
bindAutosaveAndValidationListeners();
bindTranscriptScrollTopButton();
if (transcriptHydratedFromUrlOrStorage) {
  refreshTermSeasonHeadings?.();
}
if (transcriptHydratedFromUrlOrStorage) {
  syncTermSelectOptionsForActiveTerms();
}
initOfflineQrLibrarySelfCheck();
initBrowserTranslationRawLockWatcher();
updateSecurityArtifacts();
if (transcriptHydratedFromUrlOrStorage) {
  try {
    lastAutosaveJson = localStorage.getItem(TRANSCRIPT_TOOL_AUTOSAVE_KEY);
  } catch (_e) {
    lastAutosaveJson = null;
  }
}
setupTranscriptSignatureTamperGuards();
attachRowActionButtons();
bindEditorUndoRedoControls();
bindEditorUndoHotkeys();
bindCourseFilterControls();
bindSidebarOverlayToggle();
bindProjectJsonBackupControls();
const reviewerGuideBtn = document.getElementById("export-reviewer-guide-pdf");
if (reviewerGuideBtn && !reviewerGuideBtn.dataset.boundReviewerGuide) {
  reviewerGuideBtn.dataset.boundReviewerGuide = "1";
  reviewerGuideBtn.addEventListener("click", () => exportReviewerVerificationGuidePdf());
}
resetEditorHistory();
/* Silent flush on refresh/close: `saveToLocalStorage` no-ops when unchanged; new tab clears autosave via `TRANSCRIPT_SESSION_ACTIVE_KEY`. */
if (!document.documentElement.dataset.beforeUnloadTranscriptSilentSaveBound) {
  document.documentElement.dataset.beforeUnloadTranscriptSilentSaveBound = "1";
  window.addEventListener("beforeunload", () => {
    if (autosaveTimer) {
      window.clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    saveToLocalStorage();
  });
}
/* Warm export raster font in the background; capture also awaits this so first export is fast when local TTF exists. */
void loadNotoSerifSCFont();
}
/**
 * `i18n.js` calls this after `applyTranscriptPageStrings` so ladder DOM, protected zones, and term headings
 * stay consistent with the new language (must run before the GPA-scale guard locks its snapshot).
 */
window.transcriptToolAfterLanguageChange = function () {
  /* Must fill ladder tbody BEFORE locking #gpa-policy-scale; otherwise the guard snapshot has an empty tbody and the observer strips all rows. */
  try {
    renderGradeLadderTables();
    bindProtectedStaticZonesGuard();
    bindProtectedAuthorizationAndFooter();
    refreshTermSeasonHeadings?.();
    syncTermSelectOptionsForActiveTerms();
    refreshLegalAckStatusText();
    refreshEditablePanel();
    syncChsiVerifyCodeToTranscript();
    const es = document.getElementById("export-status");
    const p = uiPack();
    if (es && p.exportReady) {
      es.textContent = p.exportReady;
    }
    const erClose = document.getElementById("export-receipt-close");
    if (erClose && p.exportReceiptClose) {
      erClose.textContent = p.exportReceiptClose;
    }
    const rp = document.getElementById("export-receipt-panel");
    if (rp) {
      rp.hidden = true;
    }
    setUploadDiagnostics(p.uploadsReady || "Uploads: Ready", "neutral");
    applyServiceConsentModalStrings();
    applyExportPreflightModalStaticStrings();
  } finally {
    /* Language switch updates totals labels without rebuilding numeric nodes; always re-sync values from the sidebar. */
    fillTermTotals({ skipGradeRowPass: true });
    attachRowActionButtons();
    void updateSecurityArtifacts();
  }
};

bindServiceConsentGate(runTranscriptToolApplicationInit);
