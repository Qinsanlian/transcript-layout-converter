/**
 * Static smoke checks (Node, zero dependencies): file pins, HTML wiring, i18n single-path.
 * Run from repo root: node tools/smoke-check.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const VENDOR_SHA256 = {
  "html2canvas.min.js": "e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb",
  "qrcode.min.js": "94a29cf772a183b1673f47cd91b8e80fa0044287eeb47a3c41f71fdac365898a",
};

function sha256File(abs) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(abs));
  return h.digest("hex");
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

for (const [name, expected] of Object.entries(VENDOR_SHA256)) {
  const abs = path.join(ROOT, name);
  if (!fs.existsSync(abs)) fail(`missing ${name}`);
  const got = sha256File(abs);
  if (got !== expected) fail(`${name}: sha256 mismatch\n  want ${expected}\n  got  ${got}`);
}

const indexPath = path.join(ROOT, "index.html");
const index = fs.readFileSync(indexPath, "utf8");
const requiredIds = [
  "transcript-page",
  "lang-select",
  "authorization-title",
  "gpa-policy-scale",
  "transcript-utc-inline-note",
  "document-id",
  "integrity-hash",
  "export-file-hash",
  "trusted-timestamp",
  "export-integrity-qr",
  "chsi-verify-code-display",
  "excel-upload",
  "import-excel-btn",
  "export-png",
  "legal-ack",
];
for (const id of requiredIds) {
  if (!index.includes(`id="${id}"`)) fail(`index.html: missing id="${id}"`);
}
if (!index.includes('class="security-audit')) {
  fail(`index.html: missing security-audit section (class="security-audit")`);
}

const scriptOrder = ["./qrcode.min.js", "./html2canvas.min.js", "./i18n.js"];
let pos = 0;
for (const src of scriptOrder) {
  const i = index.indexOf(src, pos);
  if (i < 0) fail(`index.html: missing or out-of-order script ${src}`);
  pos = i + src.length;
}
const i18nScriptEnd = index.indexOf("./i18n.js");
if (i18nScriptEnd < 0) fail("index.html: missing ./i18n.js");
const afterI18n = index.slice(i18nScriptEnd);
const scriptJsRel = afterI18n.indexOf("./script.js");
if (scriptJsRel < 0) fail("index.html: ./script.js must load after i18n.js");
const betweenI18nAndApp = afterI18n.slice(0, scriptJsRel);
const xlsxCdn = "cdn.sheetjs.com";
const xlsxLocal = "./xlsx.full.min.js";
const hasXlsxCdn = betweenI18nAndApp.includes(xlsxCdn) && betweenI18nAndApp.toLowerCase().includes("xlsx");
const hasXlsxLocal = betweenI18nAndApp.includes(`src="${xlsxLocal}"`);
if (!hasXlsxCdn && !hasXlsxLocal) {
  fail(
    "index.html: SheetJS missing between i18n.js and script.js — use CDN block or local <script src=\"./xlsx.full.min.js\"> (see README)."
  );
}
if (hasXlsxCdn && hasXlsxLocal) {
  fail("index.html: use either CDN SheetJS or local ./xlsx.full.min.js, not both");
}

const i18nPath = path.join(ROOT, "i18n.js");
const i18n = fs.readFileSync(i18nPath, "utf8");
if (i18n.includes("function applyTranscriptLanguage(lang)")) {
  fail("i18n.js: obsolete inner applyTranscriptLanguage(lang) — use applyTranscriptPageStrings only");
}
if (!i18n.includes("function applyTranscriptPageStrings(z)")) fail("i18n.js: missing applyTranscriptPageStrings");
if (!i18n.includes("window.applyTranscriptLanguage._applyPage = applyTranscriptPageStrings")) {
  fail("i18n.js: missing _applyPage assignment to applyTranscriptPageStrings");
}

console.log("smoke-check: ok (vendor sha256, index.html ids + scripts, i18n.js wiring)");
