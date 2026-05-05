/**
 * Bilingual UI pack (English / 中文) for transcript layout tool.
 * Loaded before script.js; calls window.transcriptToolAfterLanguageChange() after DOM text updates.
 */
(function () {
  "use strict";

  /** Escape text so it is safe inside HTML element contents (prevents XSS when assigned to innerHTML). */
  function escapeHtml(raw) {
    if (raw == null) {
      return "";
    }
    return String(raw)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const PACK = {
    en: {
      htmlLang: "en",
      docTitle: "Academic Transcript Layout Converter",
      watermark: `THIS FILE IS ONLY FOR PERSONAL EDUCATION APPLICATION / NON-COMMERCIAL DISCOUNT USE.
I ACKNOWLEDGE MY ACTIONS, WARRANT THAT MY PERSONAL INFORMATION IS TRUE AND VALID,
AND ACCEPT THE CORRESPONDING LEGAL CONSEQUENCES.`,
      perimeter: "WARNING: SECURITY PAPER BACKGROUND - VOID IF ALTERED OR REPRODUCED WITHOUT AUTHORIZATION",
      tamper: "Unauthorized alteration is strictly prohibited.",
      legalConfirm: "I confirm this document is true and valid, and I accept all related legal responsibility.",
      universitySeal: "University Seal\n(see Institutional Authorization below)",
      authTitle: "Institutional Authorization",
      authText: "Authorized upon official review; this document is true and valid.",
      footerNote: "For personal use only. This document is true and valid.",
      nonOfficialFooterLine: "This document was prepared with a layout tool and is not an official transcript.",
      importAlertNoFile: "Please select an Excel or CSV file first.",
      importAlertNoLib:
        "Spreadsheet library failed to load. Serve this page over HTTP(S) and allow cdn.sheetjs.com (or bundle xlsx locally).",
      importAlertBadExt: "Unsupported file type. Use .csv, .xlsx, or .xls.",
      importDiagTemplateOk: "Import: CSV template downloaded ({filename}, UTF-8 BOM).",
      importDiagReading: "Import: Reading file…",
      importDiagResult: "Import: {added} row(s) appended; {skipped} skipped. Reconcile with the official record.",
      importDiagInvalidRows: "({n} row(s) had no valid score/percent and no non-zero credits.)",
      importDiagFailPrefix: "Import failed:",
      personalSsnLabel: "PRC Resident Identity Number (18 digits)",
      standingDisclaimer:
        "Academic Standing is estimated from cumulative GPA using simple demonstration bands in this tool. For layout and sample use only; not an official academic status from any school or authority.",
      docIdLabel: "Document ID:",
      docIdPending: "Pending",
      chsiBlockTitle: "CHSI verification (reviewers)",
      chsiBlockP1:
        'For PRC credentials, identity and enrollment status are established by <a href="https://www.chsi.com.cn/" target="_blank" rel="noopener noreferrer">CHSI</a>; this sheet is user layout only.',
      chsiProcedure: "Verification:",
      chsiProcedureBody:
        "CHSI <em>Online Verification</em> + code below. CHSI prevails over this layout.",
      chsiCodeLine: "CHSI online verification code:",
      chsiBgcxLine:
        '<strong>Online verification (report) URL:</strong> <a href="https://www.chsi.com.cn/xlcx/bgcx.jsp" target="_blank" rel="noopener noreferrer">https://www.chsi.com.cn/xlcx/bgcx.jsp</a> <span lang="en">(CHSI online check for verification reports; follow the live CHSI page if the path changes.)</span>',
      chsiFiling: "Submission:",
      chsiFilingBody:
        'Where policy allows, pair with CHSI&rsquo;s <cite>Online Verification Report of Student Record</cite> for side-by-side review.',
      integrityLabel: "Integrity check (SHA-256):",
      exportHashLabel: "Last exported PNG digest:",
      integrityNoteTitle: "Content hash (reconciliation):",
      integrityNoteBody:
        "Truncated SHA-256 of editable content at the timestamps below—cross-check copies or internal files; <strong>not</strong> registrar- or CHSI-issued.",
      fpLine: "Layout fingerprint updated (local time):",
      pngQueueLine: "PNG export snapshot queued (local time):",
      utcLine: "Export reference time (UTC, public time service):",
      utcNotFetched: "Not yet fetched",
      utcNoteTitle: "UTC reference:",
      utcNoteBody:
        "Taken at export from public NTP-style sources (first success). <strong>Not</strong> legal/institutional time attestation; if all fail, <strong>browser UTC</strong> is labeled. Reconcile on local timestamps + hash.",
      printCueTitle: "Layout anti-tamper (visual)",
      printCueBody:
        "Microprint, watermark, VOID tiling—quick visual screening only; official stock and seals follow the issuer.",
      scopeShortTitle: "Metadata scope:",
      scopeShortBody:
        "ID, hashes, UTC, CHSI code, QR are <strong>tool metadata</strong> for routing and checks—<strong>not</strong> degree or transcript authenticity findings.",
      qrCaption: "Integrity QR",
      qrCaptionStrong: "(export-bound)",
      qrFollowTitle: "Payload:",
      qrFollowBody:
        "Snapshot at export (sidebar fields, transcript HTML digest, compliance log refs). Confirms file ↔ export pairing; <strong>supplementary</strong> to CHSI / registrar verification only.",
      qrAria: "Export integrity QR code",
      photoPh: "Photo",
      logoPh: "LOGO",
      photoAlt: "Student photo preview",
      logoAlt: "Institution logo preview",
      wmAlt: "Center watermark preview",
      termTotals: "Term Totals",
      cumTotals: "Cumulative Totals",
      attempted: "Attempted:",
      earned: "Earned:",
      gpaHours: "GPA Hours:",
      qualityPts: "Quality Points:",
      termGpa: "Term GPA:",
      cumGpa: "Cumulative GPA:",
      sidebarTermSettingsTitle: "Term order & calendar years",
      sidebarDomesticGpaTitle: "Actual domestic GPA",
      sidebarDomesticGpaLead:
        "Optional: your institution’s per-term GPA for side-by-side display on the transcript. Does not change course-level ladder math.",
      domesticTermGpaLabel1: "Term 1 — domestic semester total (optional)",
      domesticTermGpaLabel2: "Term 2 — domestic semester total (optional)",
      domesticGpaPlaceholder: "X.xx",
      gpaSeparator: " / ",
      domesticGpaSidebarNote:
        "Optional institutional (domestic) GPA for display only. Left blank: only the tool’s international ladder GPA is shown. Cumulative domestic GPA is a weighted mean over terms where you entered a value.",
      domesticGpaAuditNoteTranscript:
        "Domestic / international GPA pair (when entered): domestic is user-supplied for layout comparison; international is computed from this tool’s ladder. Not an official registrar statement.",
      domesticGpaEditorAuditNote:
        "Domestic term GPA fields are optional sidebar inputs; they do not change course-level ladder math. Integrity QR and hashes focus on transcript HTML and sidebar course editor—treat domestic GPA as supplementary metadata.",
      standingLabel: "Academic Standing",
      courseHeaders: ["Course Type", "Course Number", "Description", "Percent", "Grade Pt", "Grade", "Credits", "Quality Pts"],
      studentStrong: [
        "Name:",
        "Student ID:",
        "Date of Birth:",
        "Date Issued:",
        "Type of Education:",
        "College:",
        "Major:",
        "Duration of Study:",
        "Citizenship:",
        "Student Email:",
      ],
      scaleHtml: null,
      chsiEmpty: "Not provided",
      termWord: "Term",
      term1: "Term 1",
      term2: "Term 2",
      fall: "Fall",
      spring: "Spring",
      newCourse: "New Course",
      below60: "Below 60",
      standingPrefix: "Academic Standing:",
      standingNA: "Academic Standing: Not Available",
      standingExcellent: "Academic Standing: Excellent",
      standingGood: "Academic Standing: Good",
      standingFair: "Academic Standing: Fair",
      standingLow: "Academic Standing: Low",
      gradeCaption: "Matches transcript footer ladder",
      gradeTableHead: ["Percent band · five-tier ref", "Ladder grade", "Grade Point"],
      gradeLadderExemptBand: "Exempt / waiver (credits counted; excluded from GPA)",
      ackConfirmed: "Legal acknowledgment: Confirmed",
      ackPending: "Legal acknowledgment: Pending",
      utcFetching: "Fetching UTC…",
      utcOffline: "UTC unavailable (offline)",
      utcBrowserFallback: (iso) =>
        `${iso} — browser UTC (public time APIs unreachable; not the same as “offline”)`,
      exportBlocked: "Export blocked: confirm legal acknowledgment in the sidebar.",
      exportRendering: "Export: Rendering PNG…",
      exportFailCanvas: "Export failed: html2canvas not loaded",
      exportFailPng: "Export failed: PNG render error",
      exportReady: "Export: Ready",
      exportConfirmDialog:
        "Please verify line by line: name, student ID, courses, grades, and GPA.\nBy exporting you confirm that all data are true and accurate and that you accept full legal responsibility.\nProceed with export?",
      exportPreflightPlaceholderWarning:
        "\n\nYour transcript may still contain placeholder data; update it with real information before exporting.",
      exportPreflightLawfulUseConfirm:
        "I confirm that this file is for personal, lawful use only and will NOT be used for fraudulent or misleading purposes.",
      exportWatermarkText: "UNOFFICIAL LAYOUT AID – NOT AN INSTITUTIONAL DOCUMENT",
      exportBlockedBrowserTranslation:
        "Browser translation detected. Please disable page translation and retry.",
      exportPreflightModalTitle: "Export confirmation",
      exportPreflightTypePhraseHint: "Type the phrase below exactly (case and punctuation must match):",
      exportPreflightPhrasePool: [
        "I accept full legal responsibility",
        "I confirm lawful use and accept full liability",
      ],
      exportPreflightInputPlaceholder: "Type the phrase here",
      exportPreflightCancelBtn: "Cancel",
      exportPreflightConfirmBtn: "Confirm Export",
      exportPreflightMismatchError: "The phrase does not match. Check capitalization and spacing.",
      transparencyReportExportDigestHeader: "Last completed PNG export (file-level digest, not DOM):",
      transparencyReportPngSha256FullLabel: "Full SHA-256 of last downloaded PNG file",
      transparencyReportNoPriorPngExport: "(No completed PNG export in this session yet.)",
      transparencyReportLastPngFileNameLabel: "Last PNG file name",
      transparencyReportLastPngExportedAtLabel: "Last PNG export time (local wall clock)",
      transparencyReportGeneratedAtLabel: "This transparency report generated (local wall clock)",
      transparencyReportPngHashDisclaimer:
        "The following hash is the digest of the downloaded PNG file, not the web page content. / 以下哈希为已下载的 PNG 文件摘要，非网页内容摘要。",
      transparencyReportFieldNone: "—",
      exportPurposeLine: (localTime, purpose) =>
        `This file was generated by the user at ${localTime} for the stated purpose: “${purpose}”. Any use beyond this purpose is not attributable to this tool or its authors.`,
      exportPurposePlaceholder: "e.g. graduate school application materials",
      transparencyReportTitle: "Session transparency report",
      transparencyReportFooter:
        "This report documents facts about this browser session’s use of the tool only; it is not a certification of file content authenticity.",
      transparencyReportComplianceHeader: "Compliance log (timestamps and event types only):",
      transparencyGenerating: "Generating transparency report…",
      transparencyComplete: "Transparency report exported",
      transparencyFileNameCaption: "File name",
      transparencyReportFail: "Could not generate transparency report (see export status).",
      systemSelfCheckComplete: "Self-check finished; see the browser console for details.",
      exportReceiptSummary: (docId, short8) =>
        `Security receipt: document ID ${docId}; file hash prefix ${short8}. This receipt is for your records only and proves you used this tool to generate the file—it is not a certification of content authenticity.`,
      exportReceiptDetail: (docId, fullHash, localTime, utcIso) =>
        `Document ID: ${docId}\nFull SHA-256: ${fullHash}\nLocal time: ${localTime}\nUTC: ${utcIso}`,
      exportReceiptClose: "Dismiss receipt",
      ssnSensitiveHint:
        "You are entering a sensitive national ID number. It is used only for local layout placeholders and a hash watermark; logs store hashes only. Confirm you are on a private device and clear site data after use.",
      serviceConsent: {
        title: "Service Consent",
        statement:
          "This tool provides layout assistance only. You accept full legal responsibility for all data you enter with this tool and for all files you generate with it.",
        placeholder: "Enter your full name here",
        button: "Start using",
      },
      exportComplete: (baseName) => `Export: Complete (${baseName}.png)`,
      uploadsReady: "Uploads: Ready",
      uploadPhotoOk: (fn) => `Uploads: Student photo loaded (${fn}).`,
      uploadPhotoFail: (fn) => `Uploads: Student photo read failed (${fn}).`,
      uploadLogoOk: (fn) => `Uploads: Institution logo loaded (${fn}).`,
      uploadLogoFail: (fn) => `Uploads: Institution logo read failed (${fn}).`,
      uploadWmOk: (fn) => `Uploads: Center watermark loaded (${fn}).`,
      uploadWmFallback: (fn) => `Uploads: Center watermark loaded (fallback) (${fn}).`,
      uploadWmFail: (fn) => `Uploads: Center watermark processing failed (${fn}).`,
      uploadUnsupportedDiag: (fn) =>
        `Uploads: Unsupported type (${fn}). Allowed: PNG, JPG, JPEG, WEBP, BMP, GIF, SVG, TIFF.`,
      uploadUnsupportedAlert: (fn) =>
        `Cannot read image: ${fn}\nUse PNG, JPG, JPEG, WEBP, BMP, GIF, SVG, or TIFF (HEIC/HEIF varies by browser).`,
      gradeScaleTitle: "Grading Reference (Percent to GPA)",
      gradeScaleSub: "Letter-grade ladder (authoritative for calculations)",
      conversion1: `<span class="grade-scale-disclaimer__para"><strong>Computation.</strong> Per row, enter <strong>percent score (0–100)</strong> and <strong>credits earned</strong> only. <strong>Grade point</strong> and <strong>letter grade</strong> are read exclusively from the ladder above (not manually assigned).</span><span class="grade-scale-disclaimer__para"><strong>Quality points</strong> = grade point × credits. <strong>Term GPA</strong> = sum of quality points ÷ sum of credits for that term. <strong>Cumulative GPA</strong> = sum of quality points ÷ sum of credits across all terms shown.</span><span class="grade-scale-disclaimer__para">Course type, course number, and description are for identification only and do not enter the GPA formula.</span>`,
      conversion2: `<span class="grade-scale-disclaimer__para">This grading scale is provided for reference only and does not replace official institutional policies.</span>`,
      conversion3: `<span class="grade-scale-disclaimer__para"><strong>Transfer credit.</strong> Final recognition of courses and credits rests solely with the receiving institution, including its review of contact hours, syllabus equivalence, and applicable policy.</span>`,
      gradeScaleDisclaimerHtml:
        '<span class="grade-scale-disclaimer__para"><strong>Grading scale conversion note.</strong> Courses labeled <strong>Excellent / Good / Average / Pass</strong> are mapped to percent scores using a common five-tier mainland standard (95 / 85 / 75 / 65) for <em>GPA estimation only</em>; the original level on the record remains authoritative.</span><span class="grade-scale-disclaimer__para">Courses marked <strong>Exempt</strong> (e.g. PE waiver) earn credit per institutional rules but are <strong>excluded from GPA</strong> by usual academic convention.</span>',
      gradeScaleDisclaimerText:
        "Grading scale conversion note: Courses labeled Excellent / Good / Average / Pass are mapped to percent scores using a common five-tier mainland standard (95 / 85 / 75 / 65) for GPA estimation only; the original level on the record remains authoritative. Courses marked Exempt (e.g. PE waiver) earn credit per institutional rules but are excluded from GPA by usual academic convention.",
      gradeTypePercent: "Percent",
      gradeTypeFive: "Five-tier",
      gradeTypePassFail: "Pass/Fail",
      gradeTypeExempt: "Exempt / waiver",
      exemptGradeDisplay: "Exempt",
      editorGradeExemptHint: "Exempt courses carry credit but do not affect GPA. The percent cell stays blank on the transcript.",
      exemptScoreCellPlaceholder: "",
      gradeKeywordPlaceholder: "—",
      passFailPassDisplay: "Pass",
      passFailFailDisplay: "Fail",
      /** Sample transcript body when UI language is English (matches default HTML). */
      transcriptDemo: {
        byEditLabel: {
          "Institution Name": "Example University",
          "Issuing Office": "Office of Academic Affairs and Student Development",
          "Document Title": "Academic Transcript",
          "Institution Address": "123 University Way, College Town, CA 90210, United States",
          "Certification Institution Line":
            "Institution: Example University, 123 University Way, College Town, CA 90210, United States",
          "Signature Label": "Registrar's Personal Signature",
        },
        pii: {
          studentName: "John Doe",
          studentId: "000-00-0000",
          dateOfBirth: "2000-01-01",
          dateIssued: "2000-01-01",
          program: "Regular Higher Education (3-year Full-time)",
          college: "Example College / School",
          major: "Applied Chemical Technology",
          academicSystem: "Three-year program (example)",
          citizenship: "Example Country",
          studentEmail: "student.name@university.example.edu",
        },
        coursesBySemester: {
          fall: [
            ["CS", "1428", "Foundations of Computer Science I", "96", "4.0", "A", "4.00", "16.00"],
            ["MATH", "2358", "Discrete Mathematics I", "94", "4.0", "A", "3.00", "12.00"],
            ["CS", "2308", "Foundations of Computer Science II", "86", "3.0", "B", "3.00", "9.00"],
            ["ENG", "1320", "College Writing II", "90", "3.7", "A-", "3.00", "11.10"],
            ["COMM", "1310", "Fund. of Human Communication", "92", "3.7", "A-", "3.00", "11.10"],
          ],
          spring: [
            ["MATH", "2358", "Discrete Mathematics I", "82", "2.7", "B-", "3.00", "8.10"],
            ["CS", "1428", "Foundations of Computer Science I", "84", "3.0", "B", "4.00", "12.00"],
            ["HIST", "1310", "History of US to 1877", "91", "3.7", "A-", "3.00", "11.10"],
            ["ART", "2313", "Introduction to Fine Arts", "95", "4.0", "A", "3.00", "12.00"],
            ["ENG", "1310", "College Writing I", "93", "4.0", "A", "3.00", "12.00"],
          ],
        },
      },
    },
    zh: {
      htmlLang: "zh-CN",
      docTitle: "学术成绩单版式转换器（第二次修订）",
      watermark: `本文件仅供个人教育申请及非商业教育优惠用途。
本人确认行为属实，并保证所填个人信息真实有效，
知悉相应法律后果并愿意承担相关责任。`,
      perimeter: "警示：安全底纹纸张 — 涂改或未经授权复制无效",
      tamper: "严禁未经授权涂改。",
      legalConfirm: "本人确认本文件内容真实有效，并承担相关法律责任。",
      universitySeal: "学校印章\n（见下方院校授权声明）",
      authTitle: "院校授权声明",
      authText: "经官方审核后方为有效；本件内容真实有效。",
      footerNote: "仅供个人正当用途使用。本件内容真实有效。",
      nonOfficialFooterLine: "本文件由版式工具生成，非官方签发文件。",
      importAlertNoFile: "请先选择 Excel 或 CSV 文件。",
      importAlertNoLib: "表格解析库未加载。请通过 HTTP(S) 打开页面并允许 cdn.sheetjs.com（或将 xlsx 库置于本地）。",
      importAlertBadExt: "不支持的扩展名。请使用 .csv、.xlsx 或 .xls。",
      importDiagTemplateOk: "导入：已下载 CSV 模板（{filename}，UTF-8 BOM）。",
      importDiagReading: "导入：正在读取文件…",
      importDiagResult: "导入：已追加 {added} 行；跳过 {skipped} 行。请与官方成绩单核对。",
      importDiagInvalidRows: "（其中 {n} 行：成绩/百分制不可解析且无有效非零学分。）",
      importDiagFailPrefix: "导入失败：",
      personalSsnLabel: "政府身份证件（18 位数字）",
      standingDisclaimer:
        "学业状态由本工具根据累计 GPA 与简单演示分档规则估算，仅供版式与示范使用；不代表任何学校或主管机构的正式学业状态评定。",
      docIdLabel: "文档编号：",
      docIdPending: "待生成",
      chsiBlockTitle: "学信网核验（审核方）",
      chsiBlockP1:
        '中国大陆高等教育身份与在学状态以学信网（<a href="https://www.chsi.com.cn/" target="_blank" rel="noopener noreferrer">CHSI</a>）为准；本件为用户排版呈现。',
      chsiProcedure: "验证：",
      chsiProcedureBody: "学信网<em>在线验证</em> + 下方验证码；学信网结论优先于本版式。",
      chsiCodeLine: "学信网在线验证码：",
      chsiBgcxLine:
        '<strong>学籍/学历在线查验网址：</strong><a href="https://www.chsi.com.cn/xlcx/bgcx.jsp" target="_blank" rel="noopener noreferrer">https://www.chsi.com.cn/xlcx/bgcx.jsp</a>（验证报告在线核验入口，以学信网当前页面为准）。',
      chsiFiling: "递交：",
      chsiFilingBody: "政策允许时，请与《教育部学籍在线验证报告》一并对照审阅。",
      integrityLabel: "完整性校验（SHA-256）：",
      exportHashLabel: "上次导出 PNG 摘要：",
      integrityNoteTitle: "内容哈希（对账）：",
      integrityNoteBody:
        "可编辑区 SHA-256 截断值，与下方时间戳对应；供副本或内部留档比对，<strong>非</strong>校方或学信网签发。",
      fpLine: "版式指纹（本地时间）：",
      pngQueueLine: "PNG 排队（本地时间）：",
      utcLine: "UTC 参考（公共服务）：",
      utcNotFetched: "尚未获取",
      utcNoteTitle: "UTC 参考：",
      utcNoteBody:
        "导出时自公共授时源取最先成功一路；<strong>非</strong>法定/机构授时。远端不可达时回退<strong>本机浏览器 UTC</strong>并标注。对账以本地时间两行与本哈希为准。",
      printCueTitle: "版式防伪（目视）",
      printCueBody: "微印、水印、VOID 底纹仅供目视初筛；正式用纸与签章以出具方规定为准。",
      scopeShortTitle: "元数据范围：",
      scopeShortBody:
        "文档编号、哈希、UTC、学信网码、二维码均为<strong>工具侧元数据</strong>，便于流转与抽查；<strong>不构成</strong>学历或成绩真伪认定。",
      qrCaption: "完整性二维码",
      qrCaptionStrong: "（绑定导出）",
      qrFollowTitle: "载荷：",
      qrFollowBody:
        "导出瞬间快照（侧栏字段、成绩单 HTML 摘要、合规日志指针）；核对「文件—导出」一致性。<strong>补充手段</strong>，不得替代学信网或校方核验。",
      qrAria: "导出完整性二维码",
      photoPh: "照片",
      logoPh: "校徽",
      photoAlt: "学生照片预览",
      logoAlt: "学校徽标预览",
      wmAlt: "校徽水印预览",
      termTotals: "学期合计",
      cumTotals: "累计合计",
      attempted: "尝试学分：",
      earned: "获得学分：",
      gpaHours: "GPA 学时：",
      qualityPts: "质量分：",
      termGpa: "学期 GPA：",
      cumGpa: "累计 GPA：",
      sidebarTermSettingsTitle: "学期顺序与学年",
      sidebarDomesticGpaTitle: "实际国内 GPA",
      sidebarDomesticGpaLead:
        "选填：按学期填入校方/国内教务系统给出的「学期 GPA」，用于成绩单上与工具重算结果并排对照；不参与逐课阶梯换算。",
      domesticTermGpaLabel1: "学期一 — 国内学期合计 GPA（选填）",
      domesticTermGpaLabel2: "学期二 — 国内学期合计 GPA（选填）",
      domesticGpaPlaceholder: "X.xx",
      gpaSeparator: " / ",
      domesticGpaSidebarNote:
        "选填：校方/国内算法学期 GPA，仅用于对照展示；不修改课程行的国际阶梯换算。未填则只显示国际 GPA。累计国内 GPA 仅对已填学期按 GPA 学时加权。",
      domesticGpaAuditNoteTranscript:
        "国内 / 国际 GPA（填写后）：国内为侧栏自填对照用；国际为本工具按阶梯重算结果，不代表校方正式记载。",
      domesticGpaEditorAuditNote:
        "国内学期 GPA 为侧栏选填，不参与逐课换算。完整性二维码与哈希以成绩单 HTML 及课程编辑侧栏为主，国内 GPA 视为补充元数据。",
      standingLabel: "学业状态",
      courseHeaders: ["课程类型", "课号", "课程名称", "百分制", "等级点", "等级", "学分", "质量分"],
      studentStrong: [
        "姓名：",
        "学号：",
        "出生日期：",
        "签发日期：",
        "培养层次：",
        "学院：",
        "专业：",
        "学制：",
        "国籍：",
        "学生邮箱：",
      ],
      scaleHtml: null,
      chsiEmpty: "未提供",
      termWord: "学期",
      term1: "学期一",
      term2: "学期二",
      fall: "秋季",
      spring: "春季",
      newCourse: "新课程",
      below60: "低于 60",
      standingPrefix: "学业状态：",
      standingNA: "学业状态：暂无",
      standingExcellent: "学业状态：优秀",
      standingGood: "学业状态：良好",
      standingFair: "学业状态：一般",
      standingLow: "学业状态：偏低",
      gradeCaption: "与成绩单页脚阶梯一致",
      gradeTableHead: ["百分区间 · 五级对照", "阶梯等级", "绩点"],
      gradeLadderExemptBand: "免考 / 免修（计学分、不计入 GPA）",
      ackConfirmed: "法律确认：已勾选",
      ackPending: "法律确认：待勾选",
      utcFetching: "正在获取 UTC…",
      utcOffline: "未能获取可信时间（离线）",
      utcBrowserFallback: (iso) =>
        `${iso} — 本机浏览器 UTC（公共授时接口均不可用；不等同于“离线”）`,
      exportBlocked: "导出已阻止：请先在侧栏勾选法律确认。",
      exportRendering: "导出：正在渲染 PNG…",
      exportFailCanvas: "导出失败：未加载 html2canvas",
      exportFailPng: "导出失败：PNG 渲染错误",
      exportReady: "导出：就绪",
      exportConfirmDialog:
        "请逐项核对：姓名、学号、课程、成绩与 GPA。\n导出即表示您确认所填数据真实准确，并承担相应法律责任。\n是否继续导出？",
      exportPreflightPlaceholderWarning: "\n\n您的成绩单中可能仍包含占位数据，请先修改为真实信息后再导出。",
      exportPreflightLawfulUseConfirm: "我确认本文件仅供个人合法用途，不会用于欺诈或误导。",
      exportWatermarkText: "非官方排版对照件 — 非机构签发文件",
      exportBlockedBrowserTranslation: "检测到浏览器翻译正在运行，请关闭页面翻译后重试。",
      exportPreflightModalTitle: "导出前确认",
      exportPreflightTypePhraseHint: "请逐字输入下方短句（大小写与标点须完全一致）：",
      exportPreflightPhrasePool: ["我承担全部法律责任", "我确认合法使用并接受全部责任"],
      exportPreflightInputPlaceholder: "在此输入短句",
      exportPreflightCancelBtn: "取消",
      exportPreflightConfirmBtn: "确认导出",
      exportPreflightMismatchError: "短句不一致，请检查大小写与空格。",
      transparencyReportExportDigestHeader: "最近一次完整 PNG 导出（文件级摘要，非网页 DOM）：",
      transparencyReportPngSha256FullLabel: "最近一次已下载 PNG 文件的完整 SHA-256",
      transparencyReportNoPriorPngExport: "（本会话尚无已完成的 PNG 导出。）",
      transparencyReportLastPngFileNameLabel: "最近一次 PNG 文件名",
      transparencyReportLastPngExportedAtLabel: "最近一次 PNG 导出时间（本地时钟）",
      transparencyReportGeneratedAtLabel: "本透明报告生成时间（本地时钟）",
      transparencyReportPngHashDisclaimer:
        "The following hash is the digest of the downloaded PNG file, not the web page content. / 以下哈希为已下载的 PNG 文件摘要，非网页内容摘要。",
      transparencyReportFieldNone: "—",
      exportPurposeLine: (localTime, purpose) =>
        `本文件由用户于 ${localTime} 生成，声明用途为「${purpose}」。超出该用途的使用，不由本工具或其作者承担。`,
      exportPurposePlaceholder: "例如：海外研究生院申请材料",
      transparencyReportTitle: "会话透明报告",
      transparencyReportFooter:
        "本报告仅记录本浏览器会话中使用本工具的技术事实，不构成对文件内容真实性的认证。",
      transparencyReportComplianceHeader: "合规日志（仅时间戳与事件类型）：",
      transparencyGenerating: "正在生成透明报告…",
      transparencyComplete: "透明报告已导出",
      transparencyFileNameCaption: "文件名",
      transparencyReportFail: "无法生成透明报告（请查看导出状态区）。",
      systemSelfCheckComplete: "自检完成；详情请查看浏览器控制台。",
      exportReceiptSummary: (docId, short8) =>
        `安全收据：文档编号 ${docId}；文件哈希前缀 ${short8}。收据仅供您自行留档，证明您曾使用本工具生成该文件，不构成对内容真实性的认证。`,
      exportReceiptDetail: (docId, fullHash, localTime, utcIso) =>
        `文档编号：${docId}\n完整 SHA-256：${fullHash}\n本地时间：${localTime}\nUTC：${utcIso}`,
      exportReceiptClose: "关闭收据",
      ssnSensitiveHint:
        "您正在输入个人敏感信息。该字段仅用于本地版式占位与哈希水印；日志仅存哈希。请确认使用私密设备，用后清除站点数据。",
      serviceConsent: {
        title: "服务同意",
        statement:
          "本工具仅提供版式辅助。您对本工具中输入的全部数据及由此生成的全部文件承担完全的法律责任。",
        placeholder: "请在此输入您的姓名",
        button: "开始使用",
      },
      exportComplete: (baseName) => `导出：已完成（${baseName}.png）`,
      uploadsReady: "上传：就绪",
      uploadPhotoOk: (fn) => `上传：学生照片已载入（${fn}）。`,
      uploadPhotoFail: (fn) => `上传：学生照片读取失败（${fn}）。`,
      uploadLogoOk: (fn) => `上传：学校徽标已载入（${fn}）。`,
      uploadLogoFail: (fn) => `上传：学校徽标读取失败（${fn}）。`,
      uploadWmOk: (fn) => `上传：居中水印已载入（${fn}）。`,
      uploadWmFallback: (fn) => `上传：居中水印已载入（备用处理）（${fn}）。`,
      uploadWmFail: (fn) => `上传：居中水印处理失败（${fn}）。`,
      uploadUnsupportedDiag: (fn) =>
        `上传：不支持的类型（${fn}）。允许：PNG、JPG、JPEG、WEBP、BMP、GIF、SVG、TIFF。`,
      uploadUnsupportedAlert: (fn) =>
        `无法读取图片：${fn}\n请使用 PNG、JPG、JPEG、WEBP、BMP、GIF、SVG 或 TIFF（HEIC/HEIF 因浏览器而异）。`,
      gradeScaleTitle: "成绩换算参考（百分制 → GPA）",
      gradeScaleSub: "字母等级阶梯（计算以本表为准）",
      conversion1: `<span class="grade-scale-disclaimer__para">每行仅填写<strong>百分制成绩（0–100）</strong>与<strong>获得学分</strong>。<strong>绩点</strong>与<strong>字母等级</strong>仅按上表阶梯读取（不可手改）。</span><span class="grade-scale-disclaimer__para"><strong>质量分</strong> = 绩点 × 学分。<strong>学期 GPA</strong> = 本学期质量分之和 ÷ 本学期学分之和。<strong>累计 GPA</strong> = 所列学期质量分总和 ÷ 学分总和。</span><span class="grade-scale-disclaimer__para">课程类型、课号、课程名称仅作标识，不参与公式。</span>`,
      conversion2: `<span class="grade-scale-disclaimer__para"><strong>免责声明</strong>　本阶梯仅为本示范件说明用途，非官方评分政策，不替代校方正式成绩存档、学位规则或校内制度。</span>`,
      conversion3: `<span class="grade-scale-disclaimer__para"><strong>转学分</strong>　课程与学分的最终认定以接收院校为准，包括对学时、大纲对等及适用政策的审查。</span>`,
      gradeScaleDisclaimerHtml:
        '<span class="grade-scale-disclaimer__para"><strong>等级制成绩换算说明</strong>　标记为「优秀 / 良好 / 中等 / 及格」的课程，其百分制对应分数系根据中国高校通用五级制换算标准（优=95，良=85，中=75，及格=65）自动生成，<em>仅用于 GPA 估算</em>。原始成绩等级以学校官方存档为准。</span><span class="grade-scale-disclaimer__para">标记为「免考」的课程，其学分按学校规定计入总学时，但根据学术惯例<strong>不纳入 GPA 计算</strong>。</span>',
      gradeScaleDisclaimerText:
        "等级制成绩换算说明：标记为「优秀 / 良好 / 中等 / 及格」的课程，其百分制对应分数系根据中国高校通用五级制换算标准（优=95，良=85，中=75，及格=65）自动生成，仅用于 GPA 估算。原始成绩等级以学校官方存档为准。标记为「免考」的课程，其学分按学校规定计入总学时，但根据学术惯例不纳入 GPA 计算。",
      gradeTypePercent: "百分制",
      gradeTypeFive: "五级制",
      gradeTypePassFail: "二级制",
      gradeTypeExempt: "免考/免修",
      exemptGradeDisplay: "免考",
      editorGradeExemptHint: "免考课程计入学分但不纳入 GPA；成绩单上百分制栏留空。",
      exemptScoreCellPlaceholder: "",
      gradeKeywordPlaceholder: "—",
      passFailPassDisplay: "合格",
      passFailFailDisplay: "不合格",
      /** Sample transcript body when UI language is Chinese (numeric fields kept consistent with English ladder). */
      transcriptDemo: {
        byEditLabel: {
          "Institution Name": "示例大学",
          "Issuing Office": "教务处学生发展部",
          "Document Title": "学业成绩单",
          "Institution Address": "XX省XX市XX区XX路XX号，XXXXXX(邮编)",
          "Certification Institution Line": "院校：示例大学，XX省XX市XX区XX路XX号，XXXXXX(邮编)",
          "Signature Label": "注册本人签字",
        },
        pii: {
          studentName: "约翰·多伊",
          studentId: "000-00-0000",
          dateOfBirth: "2000-01-01",
          dateIssued: "2000-01-01",
          program: "普通高等教育（三年全日制）",
          college: "XX二级学院",
          major: "应用化工技术",
          academicSystem: "三年制",
          citizenship: "示例国家",
          studentEmail: "student@mail.example.edu.cn",
        },
        coursesBySemester: {
          fall: [
            ["CS", "1428", "计算机科学基础 I", "96", "4.0", "A", "4.00", "16.00"],
            ["MATH", "2358", "离散数学 I", "94", "4.0", "A", "3.00", "12.00"],
            ["CS", "2308", "计算机科学基础 II", "86", "3.0", "B", "3.00", "9.00"],
            ["ENG", "1320", "大学英语写作 II", "90", "3.7", "A-", "3.00", "11.10"],
            ["COMM", "1310", "人类传播学基础", "92", "3.7", "A-", "3.00", "11.10"],
          ],
          spring: [
            ["MATH", "2358", "离散数学 I", "82", "2.7", "B-", "3.00", "8.10"],
            ["CS", "1428", "计算机科学基础 I", "84", "3.0", "B", "4.00", "12.00"],
            ["HIST", "1310", "美国历史至 1877", "91", "3.7", "A-", "3.00", "11.10"],
            ["ART", "2313", "美术概论", "95", "4.0", "A", "3.00", "12.00"],
            ["ENG", "1310", "大学英语写作 I", "93", "4.0", "A", "3.00", "12.00"],
          ],
        },
      },
    },
  };

  /** Sidebar editor labels only; canonical `data-edit-label` on the transcript stays English. */
  const EDITOR_LABEL = {
    en: {
      "Type of Education": "Type of Education",
      "Academic System": "Duration of Study",
      "Student Email": "Student Email",
      "Certification Institution Line": "Institution & address line (auto-generated)",
    },
    zh: {
      "Institution Name": "学校名称",
      "Issuing Office": "出具部门",
      "Document Title": "文件标题",
      "Institution Address": "学校地址",
      "Student Name": "姓名",
      "Student ID": "学号",
      "Date of Birth": "出生日期",
      "Date Issued": "签发日期",
      "Type of Education": "培养层次",
      "College": "学院",
      "Major": "专业",
      "Academic System": "学制",
      "Citizenship": "国籍",
      "Student Email": "学生邮箱",
      "Term Title 1": "学期标题一",
      "Term Title 2": "学期标题二",
      "Certification Institution Line": "院校与地址行",
      "Issue And Digital Signature": "签发日期与数字摘要行",
      "Signature Label": "签章栏文字",
    },
  };

  function L(lang) {
    return PACK[lang === "zh" ? "zh" : "en"];
  }

  /** In-box diagonal watermark; PACK.authTitle / PACK.authText, repeated with short gaps */
  function setAuthorizationWatermark(t) {
    const el = document.querySelector(".authorization-box .authorization-watermark");
    if (!el) return;
    const chunk = `${t.authTitle || ""}\n${t.authText || ""}`.trim();
    if (!chunk) return;
    el.textContent = `${chunk}\n\n${chunk}\n\n${chunk}`;
  }


  const SIDEBAR = {
    en: {
      h2: "For authors",
      intro: "Edits on the left update the transcript in real time. Recommended order: media and identifiers, courses and terms, then export.",
      scopeP1:
        "<strong>Scope.</strong> English layout and GPA arithmetic only. Does not substitute registrar, CHSI, or reviewer determinations on authenticity.",
      scopeP2:
        "<strong>Your responsibility.</strong> Align all data with the authoritative record; confirm seal, bilingual, and print/PDF requirements with your office—policies differ, confirm in writing where needed.",
      scopeP3:
        "<strong>Export.</strong> PNG captures the transcript page (including the security block), not the sidebar. Legal acknowledgment below is required before export.",
      detailsSummary: "Privacy, blur preview, and local audit log",
      privacyTitle: "Privacy",
      privacyBody1:
        "Work in a private environment. All processing is local to this browser (comparable to editing a sensitive PDF offline).",
      privacyBody2:
        "On a <strong>shared workstation</strong>, clear <strong>site data for this origin</strong> after use (typically under Cookies or site settings).",
      auditTitle: "Local audit log",
      auditBody1:
        "May retain <strong>hashed</strong> event metadata (version, acknowledgments, edits, exports) for your own accountability trail. <strong>No network upload.</strong> Clear site data to remove.",
      auditBody2:
        "The <strong>PRC Resident Identity Number (18 digits)</strong> field supports layout and a local hash watermark; logs store hashes only, not plaintext. Enter digits you accept on the printed layout; avoid sensitive values on public terminals.",
      blurSpan: "Blur preview (shared spaces)",
      blurHint:
        "Masks transcript PII as <strong>***</strong> and softens the photo; sidebar fields remain editable. PNG export temporarily uses full values, then masking restores if this option stays enabled.",
      pngTitle: "What PNG contains",
      pngBody:
        "Includes transcript body, security block, and QR only—not the left toolbar. Finalize wording on the transcript page (including the selected display language) before export.",
      logo: "Institution Logo",
      logoUploadTimingHint:
        "<strong>Strong recommendation:</strong> upload the institution logo <strong>after</strong> entering the other transcript data, to reduce the risk of broken or corrupted PNG/PDF exports.",
      wm: "Institution Emblem Watermark (Center)",
      wmUploadTip:
        "💡 Tip: Upload the watermark after filling in all other information for the best export result.",
      autosaveRestoreToast: "📋 Last session data restored.",
      scrollTopAriaLabel: "Back to top",
      courseRowMoveTopAria: "Move this course row to the first row of the term (one jump; ▲ only swaps with the row above)",
      courseRowMoveBottomAria: "Move this course row to the last row of the term (one jump; ▼ only swaps with the row below)",
      photo: "Student Photo",
      ssn: "PRC Resident Identity Number (18 digits)",
      chsi: "CHSI online verification code",
      chsiPh: "Optional; appears in transcript security block",
      chsiTitle: "CHSI (author)",
      chsiP1:
        "<strong>Obtaining the code.</strong> At <a href=\"https://www.chsi.com.cn/\" target=\"_blank\" rel=\"noopener noreferrer\">chsi.com.cn</a>, open your archive, request an online verification report, and paste the code here. It appears in the transcript security section for reviewers.",
      chsiP2:
        "<strong>Submission.</strong> When rules permit, include CHSI&rsquo;s <cite>Online Verification Report of Student Record</cite> so reviewers can match code to report.",
      courseRows: "Course rows",
      termOpt0: "Term 1 (Fall 2024)",
      termOpt1: "Term 2 (Spring 2025)",
      addRow: "Add Row",
      removeRow: "Remove Last Row",
      termLayout: "Terms on transcript",
      termTwo: "Two terms",
      termOne: "Single term (e.g. first-year, one semester)",
      termHint:
        "<strong>Single-term mode</strong> hides the second term. <strong>Fall then Spring</strong> is the default (typical China intake: autumn term first, then the following spring). Use <strong>Term season order</strong> below if your school files the other way.",
      gradeLadder: "GPA ladder (auto-recalculation)",
      gpaInTitle: "GPA inputs",
      gpaInBody:
        "Only <strong>Percent</strong> and <strong>Credits</strong> enter the GPA calculation. Edits update <strong>Grade Pt</strong>, <strong>Grade</strong>, and <strong>Quality Pts</strong> per the ladder (quality pts = grade pt × credits earned).",
      nonCalcTitle: "Non-calculated columns",
      nonCalcBody: "<strong>Course Type / Course Number / Description</strong> are descriptive only and excluded from formulas.",
      perTitle: "Per term",
      perLi1: "<strong>Attempted / Earned / GPA Hours</strong> = sum of credits earned (identical here).",
      perLi2: "<strong>Quality Points</strong> = sum of row <strong>Quality Pts</strong>.",
      perLi3: "<strong>Term GPA</strong> = Quality Points ÷ GPA Hours.",
      cumTitle: "Cumulative",
      cumLi1: "Carry term totals forward in semester order.",
      cumLi2: "<strong>Cumulative GPA</strong> = cumulative Quality Points ÷ cumulative GPA Hours.",
      termOrder: "Term Season Order",
      springFall: "Spring then Fall",
      fallSpring: "Fall then Spring",
      y1: "Year for Term 1",
      y2: "Year for Term 2",
      finalize: "Finalize and export",
      regen: "Regenerate Document ID",
      exportPng: "Export Transcript as PNG",
      pdfLayoutLabel: "PDF page (A3)",
      pdfLayoutPortrait: "A3 portrait — one sheet, scale to fit",
      pdfLayoutLandscape: "A3 landscape — one sheet, scale to fit",
      pdfLayoutHint:
        "Transcript PDF and GPA discrepancy PDF use this layout: the whole capture on <strong>one A3 page</strong> with uniform scaling (nothing is cropped; very long tables may print smaller).",
      exportTranscriptPdf: "Export transcript as PDF (A3)",
      exportTranscriptPdfRendering: "Export: Rendering transcript PDF…",
      exportTranscriptPdfComplete: (baseName) => `Export: Complete (${baseName}.pdf)`,
      exportTranscriptPdfFail: "Export failed: transcript PDF",
      exportGpaDiscrepancyPdf: "Export GPA discrepancy report (PDF)",
      exportGpaDiscrepancyRendering: "Export: Rendering discrepancy PDF…",
      exportGpaDiscrepancyComplete: (id) => `Export: Complete (${id}-gpa-discrepancy.pdf)`,
      exportGpaDiscrepancyFail: "Export failed: GPA discrepancy PDF",
      exportPdfJsPdfMissing: "jsPDF library not loaded",
      legalSpan:
        "I acknowledge legal responsibility for authenticity and lawful use, and I will not use exports to falsely claim eligibility for merchant or education-pricing programmes.",
      legalFollow:
        "<strong>Summary:</strong> You attest that the information is accurate, that use will be lawful, and that exports will not be used to obtain student pricing or benefits without eligibility. This tool <strong>does not</strong> certify academic records; verification remains with your institution and reviewers.",
      uploadDiag: "Upload status",
      secSummary: "Security block, UTC & QR (matches transcript; author notes)",
      secP1:
        "<strong>Audience.</strong> On-transcript security copy is for <strong>reviewers</strong>; this foldout is for you as author—semantics, limits, and fixes.",
      secP2:
        "<strong>Timestamps.</strong> Fingerprint and PNG-queue lines use the <strong>browser local clock</strong>. <strong>UTC reference</strong> is taken at export from public time sources; <strong>not</strong> legal or institutional attestation.",
      secP3:
        "<strong>UTC detail.</strong> Parallel public sources, <strong>first success</strong>; if all fail, labeled <strong>browser UTC</strong>. Reconcile on local timestamps + content hash (not a substitute for issuer records).",
      secP4:
        "<strong>Print cues.</strong> Microprint, watermark, VOID tiling—visual screening only; official stock and seals follow the issuer.",
      secP5:
        "<strong>QR.</strong> Export-bound snapshot (sidebar fields, transcript HTML digest, compliance log refs)—file ↔ export pairing; <strong>supplementary</strong> to CHSI/registrar checks only. Blank QR area: see below.",
      qrLib:
        "<strong>QR library missing:</strong> place <code>qrcode.min.js</code> (not qrious) next to <code>index.html</code> and open via HTTP (not <code>file://</code>).",
      qrRender:
        "<strong>QR render blocked:</strong> tracking protection or strict canvas policies may prevent drawing. Try relaxing protections for this origin, allowlisting the site, or serving from <code>127.0.0.1</code> / <code>localhost</code>.",
      qrFile:
        "<strong>Opened as <code>file://</code>:</strong> many browsers restrict canvas, modules, and local scripts. Serve this folder over HTTP instead, for example <code>python3 -m http.server</code> from the project directory, then open <code>http://127.0.0.1:8000/</code>.",
      gradeLadderTableAria: "GPA conversion reference",
      importSection: "Bulk course import",
      importHint:
        "Columns: Subject (or Course Type), Course Number, Description, Percent or score text, Credits, optional Grade Type (percent / five / pass-fail / exempt or 百分制 / 五级制 / 二级制 / 免考). Score cell may be a number (85), Chinese tier (良好), Pass/Fail (合格), or 免考 when type is omitted. First worksheet only; UTF-8 CSV recommended.",
      importDownload: "Download CSV template",
      importRun: "Import into selected term",
      importFile: "File",
      importLiability:
        "<strong>Excel/CSV import.</strong> Each imported course row is equivalent to manual entry. Verify against your official registrar transcript before use. You are solely responsible for accuracy.",
      importAlertNoFile: "Please select an Excel or CSV file first.",
      importAlertNoLib:
        "Spreadsheet library failed to load. Serve this page over HTTP(S) and allow cdn.sheetjs.com (or bundle xlsx locally).",
      importAlertBadExt: "Unsupported file type. Use .csv, .xlsx, or .xls.",
      importDiagTemplateOk: "Import: CSV template downloaded ({filename}, UTF-8 BOM).",
      importDiagReading: "Import: Reading file…",
      importDiagResult: "Import: {added} row(s) appended; {skipped} skipped. Reconcile with the official record.",
      importDiagInvalidRows: "({n} row(s) had no valid score/percent and no non-zero credits.)",
      importAutoSavedSuffix: " (auto-saved)",
      importDiagFailPrefix: "Import failed:",
      langLabel: "Language / 语言",
      wizardToggle: "Step-by-step wizard",
      wizardTab1: "① Identity",
      wizardTab2: "② Courses",
      wizardTab3: "③ Preview & export",
      wizardCompliance1:
        "<strong>Step 1.</strong> Enter layout identifiers and optional CHSI code only as allowed by policy. This tool does not issue credentials.",
      wizardCompliance2:
        "<strong>Step 2.</strong> Course rows and GPA ladder are for layout and arithmetic only; reconcile every cell with the official record.",
      wizardCompliance3:
        "<strong>Step 3.</strong> Exports capture the transcript page, not the sidebar. Confirm legal acknowledgment before PNG/PDF.",
      resetAllData: "Reset all data",
      resetAllConfirm:
        "Reset all data? This clears courses, identity fields, and the local backup. This cannot be undone.",
      shareLinkBtn: "Copy share link",
      exportPurposeLabel: "Export purpose (optional)",
      exportTransparencyReport: "Export transparency report (PDF)",
      systemSelfCheck: "System self-check",
      shareLinkCopied: "Link copied to clipboard.",
      shareDataWarning:
        "You are viewing shared data from another person. Verify before use. The national ID number field was not included in the link.",
      datePlaceholderYmd: "YYYY-MM-DD",
      dateIssuedAutoTitle: "Date Issued is set automatically on PNG/PDF export (trusted UTC fetch, then local YYYY-MM-DD HH:mm:ss).",
      dateIssuedAutoHint: "Refreshes when you export; not editable here.",
      domesticGpaPlaceholder: "X.xx",
      issueSignatureAutoTitle:
        "Issue date and digital signature line are assembled at export from the trusted time and the transcript content hash.",
      issueSignatureAutoHint: "Refreshes on PNG/PDF export; not editable here.",
      certInstitutionLineAutoTitle:
        "This line is assembled automatically from Institution Name and Institution Address; not editable here.",
      certInstitutionLineAutoHint: "Edits to those two fields update this line on the transcript.",
      institutionAddressPlaceholder: "Example: 123 University Way, College Town, CA 90210, United States",
      sidebarUndoRedoLabel: "Undo / redo",
      editorUndoBtn: "Undo",
      editorRedoBtn: "Redo",
      editorResetToInitialBtn: "Reset to initial",
      manualSaveNow: "Save now",
      autosaveFailedToast: "Autosave failed. Please export a JSON backup.",
      manualSaveOk: "Saved to this browser.",
      manualSaveFail: "Could not save to this browser (storage may be full or blocked).",
      resetEditorTitle: "Reset Editor",
      resetEditorMessage: "Reset to initial editor state? This cannot be undone.",
      resetEditorConfirm: "Yes, Reset",
      resetEditorCancel: "No, Keep",
      editorRedoRestoreNextConfirm:
        "Restore the next saved editor state? Personal fields in that snapshot will reappear as saved.",
      editorRedoClearPersonalConfirm:
        "Clear all personal information (name, ID, dates, program, college, major, citizenship, email, ID number, CHSI code)? Course rows will be kept.",
      editorRedoClearPersonalDone: "Personal information cleared; courses kept.",
      duplicateRowLabel: "Row to duplicate",
      duplicateRowHint: "Pick a course row in the selected term; its values are copied into a new row below.",
      duplicateRowBtn: "Duplicate row",
      courseFilterLabel: "Filter courses",
      courseFilterPlaceholder: "Search in course description…",
      courseFilterClear: "Clear",
      exportProjectJson: "Save project (.json)",
      importProjectJson: "Load project (.json)",
      exportReviewerGuidePdf: "Export reviewer verification guide (PDF)",
      projectJsonExportedToast: "Project JSON downloaded.",
      projectJsonImportedToast: "Project loaded from JSON.",
      projectJsonImportFailToast: "Could not read that JSON file.",
      editorPercentInvalidHint: "Enter a percent from 0 to 100.",
      editorCreditsInvalidHint: "Enter credits from 0 to 999.",
      reviewerGuidePdf: {
        title: "Reviewer verification guide (this tool)",
        p1: "This page is a layout helper only. It does not issue credentials, seals, or official transcripts.",
        p2: "CHSI (China): Compare the verification code on the transcript with the student’s CHSI Online Verification Report on the official CHSI website. Follow the live CHSI instructions if they change.",
        p3: "File hash: After export, this tool shows a SHA-256 digest. If you kept the original PNG, you can hash that file with any SHA-256 utility and compare it to the digest on the security block.",
        p4: "This document is not an official transcript. Use it only where policy allows, together with genuine materials from the school or CHSI.",
        p5:
          "PNG/PDF raster exports: an additional semi-transparent “UNOFFICIAL LAYOUT AID” overlay is merged at capture time inside the html2canvas clone. It is not part of the editable transcript DOM and cannot be removed from the downloaded image/PDF without re-encoding the file.",
        p6:
          "Session tools: after PNG export the UI shows a SHA-256 digest of the downloaded file; the session transparency PDF can repeat that digest. CHSI verification codes, when entered by the author, appear on the transcript security block—verify against the official CHSI report.",
        footer: "Thank you for reviewing carefully.",
        fileName: "reviewer_verification_guide_en",
      },
    },
    zh: {
      h2: "撰写者工作区",
      intro: "左侧编辑后，右侧成绩单实时更新。建议顺序：媒体与标识、课程与学期、最后导出。",
      scopeP1: "<strong>范围。</strong> 仅提供版式与 GPA 算术辅助，不替代校方、学信网或审核方对真实性的认定。",
      scopeP2:
        "<strong>你的责任。</strong> 所有数据须与权威记录一致；盖章、双语、打印/PDF 等要求请以就读院校规定为准，必要时书面确认。",
      scopeP3: "<strong>导出。</strong> PNG 仅包含成绩单页面（含安全区），不含左侧工具栏。导出前须勾选下方法律确认。",
      detailsSummary: "隐私、模糊预览与本地审计日志",
      privacyTitle: "隐私",
      privacyBody1: "请在私密环境使用。全部处理均在浏览器本地完成（类似离线编辑敏感 PDF）。",
      privacyBody2: "在<strong>公共或共享电脑</strong>上使用后，请清除本来源的<strong>站点数据</strong>（通常在 Cookie 或站点设置中）。",
      auditTitle: "本地审计日志",
      auditBody1:
        "可能保留<strong>哈希化</strong>事件元数据（版本、确认、编辑、导出等）供你自行说明操作轨迹。<strong>不上传云端。</strong>清除站点数据即可删除。",
      auditBody2:
        "<strong>18 位数字</strong>字段用于版式与本地哈希水印；日志仅存哈希，不存明文。请仅填写你愿意出现在纸面版式上的数字；公共终端勿填高敏信息。",
      blurSpan: "模糊预览（公共空间）",
      blurHint:
        "将成绩单中的敏感信息以 <strong>***</strong> 显示并弱化照片；侧栏仍可编辑。导出 PNG 时会短暂使用完整数据，导出后若仍勾选则恢复模糊。",
      pngTitle: "PNG 包含内容",
      pngBody: "仅包含成绩单正文、安全区与二维码，不包含左侧工具栏。导出前请确认页面正文用语已就绪。",
      logo: "学校徽标",
      logoUploadTimingHint:
        "<strong>强烈建议：</strong>请先填写完其他数据<strong>再</strong>上传校徽，以免导出 PNG/PDF 时出现异常或文件损坏。",
      wm: "校徽水印（居中）",
      wmUploadTip: "💡 建议：在所有内容填写完毕后上传水印，以获得最佳导出效果。",
      autosaveRestoreToast: "📋 已恢复上次的编辑数据。",
      scrollTopAriaLabel: "回到顶部",
      courseRowMoveTopAria: "将该课程行移到本学期列表最上方（一键置顶，非逐格交换）",
      courseRowMoveBottomAria: "将该课程行移到本学期列表最下方（一键置底，非逐格交换）",
      photo: "学生照片",
      ssn: "政府身份证件（18 位数字）",
      chsi: "学信网在线验证码",
      chsiPh: "选填，显示在成绩单学信网栏目",
      chsiTitle: "学信网（撰写者）",
      chsiP1:
        "<strong>获取验证码。</strong> 访问 <a href=\"https://www.chsi.com.cn/\" target=\"_blank\" rel=\"noopener noreferrer\">chsi.com.cn</a>，在学信档案中申请《教育部学籍在线验证报告》，将验证码粘贴到上方；成绩单安全区向审核方展示。",
      chsiP2: "<strong>递交建议。</strong> 在允许的情况下，请与学信网《教育部学籍在线验证报告》一并提交，便于审核方对照。",
      courseRows: "课程行",
      termOpt0: "学期一（秋季 2024）",
      termOpt1: "学期二（春季 2025）",
      addRow: "添加一行",
      removeRow: "删除末行",
      termLayout: "成绩单上的学期",
      termTwo: "两学期",
      termOne: "单学期（如大一仅一学期）",
      termHint:
        "<strong>单学期模式</strong>会隐藏第二个学期板块。默认与一般中国高校入学顺序一致：<strong>先秋后春</strong>；若校方材料为先春后秋，可在下方<strong>学期季节顺序</strong>中切换。",
      gradeLadder: "GPA 阶梯（自动重算）",
      gpaInTitle: "参与 GPA 的列",
      gpaInBody:
        "仅<strong>百分制成绩</strong>与<strong>学分</strong>进入 GPA 计算；修改后按阶梯即时更新<strong>等级点</strong>、<strong>等级</strong>与<strong>质量分</strong>（质量分 = 等级点 × 获得学分）。",
      nonCalcTitle: "不参与公式的列",
      nonCalcBody: "<strong>课程类型 / 课号 / 课程名称</strong>仅作说明，不参与公式。",
      perTitle: "按学期",
      perLi1: "<strong>尝试 / 获得 / GPA 学时</strong>：本学期各课程获得学分之和（本表中三者相同）。",
      perLi2: "<strong>质量分</strong>：各行<strong>质量分</strong>之和。",
      perLi3: "<strong>学期 GPA</strong>：质量分 ÷ GPA 学时。",
      cumTitle: "累计",
      cumLi1: "按学期顺序将上述汇总累加。",
      cumLi2: "<strong>累计 GPA</strong>：累计质量分 ÷ 累计 GPA 学时。",
      termOrder: "学期季节顺序",
      springFall: "春季 → 秋季",
      fallSpring: "秋季 → 春季",
      y1: "学期一对应年份",
      y2: "学期二对应年份",
      finalize: "完成与导出",
      regen: "重新生成文档编号",
      exportPng: "导出成绩单为 PNG",
      pdfLayoutLabel: "PDF 页面（A3）",
      pdfLayoutPortrait: "A3 竖向 — 单页整版缩放适配",
      pdfLayoutLandscape: "A3 横向 — 单页整版缩放适配",
      pdfLayoutHint:
        "成绩单 PDF 与 GPA 差异说明 PDF 均使用该版式：<strong>整张 A3 一页</strong>内等比缩放完整内容（不裁切；内容过长时字体会相应变小）。",
      exportTranscriptPdf: "导出成绩单为 PDF（A3）",
      exportTranscriptPdfRendering: "导出：正在生成成绩单 PDF…",
      exportTranscriptPdfComplete: (baseName) => `导出：已完成（${baseName}.pdf）`,
      exportTranscriptPdfFail: "导出失败：成绩单 PDF",
      exportGpaDiscrepancyPdf: "导出 GPA 差异说明对照表（PDF）",
      exportGpaDiscrepancyRendering: "导出：正在生成差异说明 PDF…",
      exportGpaDiscrepancyComplete: (id) => `导出：已完成（${id}-gpa-discrepancy.pdf）`,
      exportGpaDiscrepancyFail: "导出失败：GPA 差异说明 PDF",
      exportPdfJsPdfMissing: "未加载 jsPDF 库",
      legalSpan:
        "本人确认对信息真实性及合法使用承担法律责任，且不会利用导出文件虚假申报商户或教育优惠等资格。",
      legalFollow:
        "<strong>摘要：</strong>您确认所填信息准确、使用合法，且不会未取得资格而以导出内容申领学生价或相关优惠。本工具<strong>不能</strong>认证成绩或学历；核验仍归属您的就读院校与审核方。",
      uploadDiag: "上传状态",
      secSummary: "安全区、UTC 与二维码（与正文一致；撰写说明）",
      secP1:
        "<strong>读者。</strong> 成绩单安全区正文面向<strong>审核方</strong>；本折叠区面向撰写者，说明时间含义、限制与排错。",
      secP2:
        "<strong>时间戳。</strong> 版式指纹与 PNG 排队为<strong>浏览器本地时钟</strong>。<strong>UTC 参考</strong>在导出时取自公共授时源；<strong>非</strong>法律或机构授时。",
      secP3:
        "<strong>UTC 细节。</strong>多路公共源并行，<strong>取最先成功</strong>；均失败则回退<strong>已标注的本机浏览器 UTC</strong>。对账以本地时间两行与内容哈希为准（不能替代校方留档）。",
      secP4: "<strong>印刷。</strong>微印、水印、VOID 底纹仅供目视初筛；正式用纸与签章以出具方规定为准。",
      secP5:
        "<strong>二维码。</strong>绑定导出快照（侧栏字段、成绩单 HTML 摘要、合规日志引用等），用于核对「文件—导出」是否一致，<strong>仅作补充</strong>，不得替代学信网或校方核验。区域空白见下文。",
      qrLib:
        "<strong>二维码库缺失：</strong>请将 <code>qrcode.min.js</code>（非 qrious）与 <code>index.html</code> 放在同一目录，并通过 HTTP（勿用 <code>file://</code>）打开。",
      qrRender:
        "<strong>二维码渲染被拦截：</strong>跟踪防护或严格 canvas 策略可能阻止绘制。可短暂放宽站点保护、加入白名单，或使用 <code>127.0.0.1</code> / <code>localhost</code> 提供页面。",
      qrFile:
        "<strong>当前为 <code>file://</code> 打开：</strong>多数浏览器会限制 canvas、模块与本地脚本。请改用 HTTP 提供本目录，例如在项目目录执行 <code>python3 -m http.server</code>，再访问 <code>http://127.0.0.1:8000/</code>。",
      gradeLadderTableAria: "GPA 换算对照表",
      importSection: "批量导入课程",
      importHint:
        "列：Subject/课程类型、Course Number/课号、Description/课程名称、Percent 或成绩文本、Credits/学分、可选 Grade Type/成绩类型（percent、five、pass-fail、exempt 或 百分制、五级制、二级制、免考等）。不写类型时，可按单元格自动识别：数字为百分制，优秀/良好等为五级制，合格/不合格为二级制，免考/免修为免考。仅首张工作表；建议 UTF-8 CSV。",
      importDownload: "下载 CSV 模板",
      importRun: "导入到当前学期",
      importFile: "文件",
      importLiability:
        "<strong>Excel/CSV 导入。</strong>每条导入的课程行均视同手工录入。使用前须与校方官方成绩单核对；准确性由使用者自负。",
      importAlertNoFile: "请先选择 Excel 或 CSV 文件。",
      importAlertNoLib: "表格解析库未加载。请通过 HTTP(S) 打开页面并允许 cdn.sheetjs.com（或将 xlsx 库置于本地）。",
      importAlertBadExt: "不支持的扩展名。请使用 .csv、.xlsx 或 .xls。",
      importDiagTemplateOk: "导入：已下载 CSV 模板（{filename}，UTF-8 BOM）。",
      importDiagReading: "导入：正在读取文件…",
      importDiagResult: "导入：已追加 {added} 行；跳过 {skipped} 行。请与官方成绩单核对。",
      importDiagInvalidRows: "（其中 {n} 行：成绩/百分制不可解析且无有效非零学分。）",
      importAutoSavedSuffix: "，已自动保存",
      importDiagFailPrefix: "导入失败：",
      langLabel: "Language / 语言",
      wizardToggle: "启用分步向导",
      wizardTab1: "① 身份信息",
      wizardTab2: "② 课程数据",
      wizardTab3: "③ 预览导出",
      wizardCompliance1:
        "<strong>步骤 1。</strong>仅按政策填写版式标识与可选学信网验证码。本工具不签发任何凭证。",
      wizardCompliance2:
        "<strong>步骤 2。</strong>课程行与 GPA 阶梯仅用于版式与算术演示；每个单元格须与官方成绩单核对。",
      wizardCompliance3:
        "<strong>步骤 3。</strong>导出仅包含成绩单页面，不含侧栏。导出 PNG/PDF 前须完成法律确认。",
      resetAllData: "重置所有数据",
      resetAllConfirm:
        "确认重置所有数据？此操作将清空课程与身份信息，并删除本地备份。此操作不可撤销。",
      shareLinkBtn: "生成分享链接",
      exportPurposeLabel: "导出用途说明（选填）",
      exportTransparencyReport: "导出透明报告（PDF）",
      systemSelfCheck: "系统自检",
      shareLinkCopied: "链接已复制到剪贴板。",
      shareDataWarning:
        "您正在查看来自他人的分享数据，请核对后使用。分享链接中不包含政府身份证件号码。",
      datePlaceholderYmd: "YYYY-MM-DD",
      dateIssuedAutoTitle: "签发日期在导出 PNG/PDF 时自动写入（先取可信 UTC，再按本地时间格式化为 YYYY-MM-DD HH:mm:ss）。",
      dateIssuedAutoHint: "每次导出时刷新；此处不可手改。",
      domesticGpaPlaceholder: "X.xx",
      issueSignatureAutoTitle: "该行在导出时由可信时间与正文内容哈希自动生成。",
      issueSignatureAutoHint: "随 PNG/PDF 导出刷新；此处不可手改。",
      certInstitutionLineAutoTitle: "本行由侧栏「学校名称」「学校地址」自动生成；此处不可手改。",
      certInstitutionLineAutoHint: "修改上述两项后，成绩单上的本行会随之更新。",
      institutionAddressPlaceholder: "示例：[街道地址、城市、邮编、国家]",
      sidebarUndoRedoLabel: "撤销 / 重做",
      editorUndoBtn: "撤销",
      editorRedoBtn: "重做",
      editorResetToInitialBtn: "一键还原",
      manualSaveNow: "立即保存",
      autosaveFailedToast: "自动保存失败，请导出 JSON 备份以防数据丢失。",
      manualSaveOk: "已保存到本浏览器。",
      manualSaveFail: "无法写入本浏览器（可能存储已满或被阻止）。",
      resetEditorTitle: "还原编辑器",
      resetEditorMessage: "是否还原到编辑器最初的状态？此操作不可撤销。",
      resetEditorConfirm: "是，还原",
      resetEditorCancel: "否，保持",
      editorRedoRestoreNextConfirm: "是否恢复到下一步已保存的编辑状态？该快照中的个人信息将按当时内容显示。",
      editorRedoClearPersonalConfirm:
        "是否清除全部个人信息（姓名、学号、出生/签发日期、培养层次、学院、专业、学制、国籍、邮箱、证件号、学信网验证码等）？课程行将保留。",
      editorRedoClearPersonalDone: "已清除个人信息，课程数据已保留。",
      duplicateRowLabel: "要复制的行",
      duplicateRowHint: "选择当前学期中的一行课程，其内容会复制到紧邻的下一行。",
      duplicateRowBtn: "复制行",
      courseFilterLabel: "筛选课程",
      courseFilterPlaceholder: "在课程名称中搜索…",
      courseFilterClear: "清除",
      exportProjectJson: "保存项目（.json）",
      importProjectJson: "载入项目（.json）",
      exportReviewerGuidePdf: "导出审核方核验说明（PDF）",
      projectJsonExportedToast: "已下载项目 JSON。",
      projectJsonImportedToast: "已从 JSON 载入项目。",
      projectJsonImportFailToast: "无法读取该 JSON 文件。",
      editorPercentInvalidHint: "请输入 0–100 的百分制成绩。",
      editorCreditsInvalidHint: "请输入 0–999 的学分。",
      reviewerGuidePdf: {
        title: "审核方核验说明（本工具）",
        p1: "本页面仅为成绩单版式排版辅助，不签发任何证明、公章或官方成绩单。",
        p2: "学信网（中国大陆）：请对照学生提供的《教育部学籍在线验证报告》与本工具中的在线验证码，在学信网官网完成核验；请以学信网实时页面为准。",
        p3: "文件哈希：导出完成后，工具会显示 SHA-256 摘要。若您保留了原始 PNG，可用任意 SHA-256 工具计算该文件并与安全区中的摘要比对。",
        p4: "本文件不是官方成绩单，请在政策允许范围内使用，并与校方或学信网等权威材料一并核对。",
        p5:
          "PNG/PDF 栅格导出：在 html2canvas 克隆文档中会额外合成一层半透明「非官方排版对照件」水印，该层不属于可编辑成绩单 DOM，若不重新编码图像/文件则无法从已下载的 PNG/PDF 中剥离。",
        p6:
          "会话工具：PNG 导出完成后界面会显示已下载 PNG 文件的 SHA-256；会话透明报告 PDF 可再次列出该摘要。撰写者若填写学信网在线验证码，会显示在成绩单安全区，请与学信网官方在线验证报告对照核验。",
        footer: "感谢您的认真审核。",
        fileName: "reviewer_verification_guide_zh",
      },
    },
  };

  function applySidebarStrings(lang) {
    const z = lang === "zh" ? "zh" : "en";
    const s = SIDEBAR[z];
    const p = L(z);
    const set = (sel, html) => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    };
    set(".editor-panel > h2", s.h2);
    set(".sidebar-intro-lead", s.intro);
    const note = document.querySelector(".sidebar-purpose-note");
    if (note) {
      const ps = note.querySelectorAll("p");
      if (ps[0]) ps[0].innerHTML = s.scopeP1;
      if (ps[1]) ps[1].innerHTML = s.scopeP2;
      if (ps[2]) ps[2].innerHTML = s.scopeP3;
    }
    const sum = document.querySelector(".editor-supplemental-disclosure > summary");
    if (sum) sum.textContent = s.detailsSummary;
    set(".privacy-gentle-note-title", s.privacyTitle);
    const pb = document.querySelectorAll(".privacy-gentle-note-body");
    if (pb[0]) pb[0].innerHTML = s.privacyBody1;
    if (pb[1]) pb[1].innerHTML = s.privacyBody2;
    set(".compliance-log-note-title", s.auditTitle);
    const cb = document.querySelectorAll(".compliance-log-note-body");
    if (cb[0]) cb[0].innerHTML = s.auditBody1;
    if (cb[1]) cb[1].innerHTML = s.auditBody2;
    const blurSp = document.querySelector(".privacy-preview-toggle-label span");
    if (blurSp) blurSp.textContent = s.blurSpan;
    set(".privacy-preview-hint", s.blurHint);
    set(".export-png-fidelity-note-title", s.pngTitle);
    set(".export-png-fidelity-note-body", s.pngBody);

    const mapLabel = (forId, text) => {
      const lb = document.querySelector(`label.tool-label[for="${forId}"]`);
      if (lb) lb.textContent = text;
    };
    mapLabel("logo-upload", s.logo);
    const logoTimingHint = document.getElementById("logo-upload-timing-hint");
    if (logoTimingHint) {
      logoTimingHint.innerHTML = s.logoUploadTimingHint || "";
    }
    mapLabel("center-watermark-upload", s.wm);
    const wmTip = document.getElementById("center-watermark-upload-timing-hint");
    if (wmTip) {
      wmTip.textContent = s.wmUploadTip || "";
    }
    const scrollTopBtn = document.getElementById("transcript-scroll-top-btn");
    if (scrollTopBtn) {
      scrollTopBtn.setAttribute("aria-label", s.scrollTopAriaLabel || "Back to top");
    }
    mapLabel("photo-upload", s.photo);
    mapLabel("personal-ssn-input", s.ssn);
    mapLabel("export-purpose-input", s.exportPurposeLabel);
    const expPur = document.getElementById("export-purpose-input");
    if (expPur) {
      expPur.placeholder = PACK[z].exportPurposePlaceholder || "";
    }
    const trBtn = document.getElementById("export-transparency-report");
    if (trBtn) {
      trBtn.textContent = s.exportTransparencyReport || "";
    }
    const scBtn = document.getElementById("system-self-check");
    if (scBtn) {
      scBtn.textContent = s.systemSelfCheck || "";
    }
    const erClose = document.getElementById("export-receipt-close");
    if (erClose) {
      erClose.textContent = PACK[z].exportReceiptClose || "";
    }
    const exportStatus = document.getElementById("export-status");
    if (exportStatus) {
      exportStatus.dataset.transparencyGenerating = PACK[z].transparencyGenerating || "";
      exportStatus.dataset.transparencyComplete = PACK[z].transparencyComplete || "";
      exportStatus.dataset.transparencyFileNameCaption = PACK[z].transparencyFileNameCaption || "";
    }
    mapLabel("chsi-verify-code-input", s.chsi);
    const chsiIn = document.getElementById("chsi-verify-code-input");
    if (chsiIn) chsiIn.placeholder = s.chsiPh;
    const cg = document.querySelector(".chsi-sidebar-guide");
    if (cg) {
      const ct = cg.querySelector(".chsi-sidebar-guide-title");
      const cp = cg.querySelectorAll("p");
      if (ct) ct.textContent = s.chsiTitle;
      if (cp[0]) cp[0].innerHTML = s.chsiP1;
      if (cp[1]) cp[1].innerHTML = s.chsiP2;
    }
    mapLabel("term-select", s.courseRows);
    const secLbl = document.querySelector(".excel-import-section-label");
    if (secLbl) secLbl.textContent = s.importSection;
    const imHint = document.querySelector(".excel-import-hint");
    if (imHint) imHint.textContent = s.importHint;
    const dlb = document.getElementById("download-import-template-btn");
    if (dlb) dlb.textContent = s.importDownload;
    const ib = document.getElementById("import-excel-btn");
    if (ib) ib.textContent = s.importRun;
    mapLabel("excel-upload", s.importFile);
    const disc = document.querySelector(".import-disclaimer");
    if (disc) disc.innerHTML = s.importLiability;
    const addB = document.getElementById("add-course-row");
    const rmB = document.getElementById("remove-course-row");
    const dupB = document.getElementById("duplicate-course-row");
    if (addB) addB.textContent = s.addRow;
    if (rmB) rmB.textContent = s.removeRow;
    if (dupB) dupB.textContent = s.duplicateRowBtn || dupB.textContent;
    const dupLb = document.getElementById("duplicate-row-pick-label");
    if (dupLb) dupLb.textContent = s.duplicateRowLabel || "";
    const dupHint = document.getElementById("duplicate-row-hint");
    if (dupHint) dupHint.textContent = s.duplicateRowHint || "";
    const urLab = document.getElementById("sidebar-undo-redo-label");
    if (urLab) urLab.textContent = s.sidebarUndoRedoLabel || "";
    const undoB = document.getElementById("editor-undo-btn");
    const redoB = document.getElementById("editor-redo-btn");
    const saveNow = document.getElementById("manual-autosave-btn");
    if (undoB) undoB.textContent = s.editorUndoBtn || "Undo";
    if (redoB) redoB.textContent = s.editorResetToInitialBtn || s.editorRedoBtn || "Redo";
    if (saveNow) saveNow.textContent = s.manualSaveNow || "Save now";
    const exJson = document.getElementById("export-project-json");
    const imJson = document.getElementById("import-project-json-btn");
    const rvPdf = document.getElementById("export-reviewer-guide-pdf");
    if (exJson) exJson.textContent = s.exportProjectJson || exJson.textContent;
    if (imJson) imJson.textContent = s.importProjectJson || imJson.textContent;
    if (rvPdf) rvPdf.textContent = s.exportReviewerGuidePdf || rvPdf.textContent;
    const cfLab = document.getElementById("course-filter-label");
    const cfIn = document.getElementById("course-filter-input");
    const cfClr = document.getElementById("course-filter-clear");
    if (cfLab) cfLab.textContent = s.courseFilterLabel || "";
    if (cfIn) cfIn.placeholder = s.courseFilterPlaceholder || "";
    if (cfClr) cfClr.textContent = s.courseFilterClear || "";
    mapLabel("term-layout-mode", s.termLayout);
    const tlm = document.getElementById("term-layout-mode");
    if (tlm && tlm.options[0]) tlm.options[0].textContent = s.termTwo;
    if (tlm && tlm.options[1]) tlm.options[1].textContent = s.termOne;
    set("#term-layout-hint", s.termHint);
    const grl = document.querySelector(".grade-rules-ref > .tool-label");
    if (grl) grl.textContent = s.gradeLadder;
    const grt = document.querySelector(".grade-rules-ref .grade-rules-table thead tr");
    if (grt) {
      grt.innerHTML = PACK[z].gradeTableHead.map((x) => `<th>${escapeHtml(x)}</th>`).join("");
    }
    const gcap = document.querySelector(".grade-rules-ref .grade-rules-table-caption");
    if (gcap) gcap.textContent = PACK[z].gradeCaption;
    const cards = document.querySelectorAll(".grade-rules-card");
    if (cards[0]) {
      cards[0].querySelector("h4").textContent = s.gpaInTitle;
      cards[0].querySelector("p").innerHTML = s.gpaInBody;
    }
    if (cards[1]) {
      cards[1].querySelector("h4").textContent = s.nonCalcTitle;
      cards[1].querySelector("p").innerHTML = s.nonCalcBody;
    }
    if (cards[2]) {
      cards[2].querySelector("h4").textContent = s.perTitle;
      const lis = cards[2].querySelectorAll("li");
      if (lis[0]) lis[0].innerHTML = s.perLi1;
      if (lis[1]) lis[1].innerHTML = s.perLi2;
      if (lis[2]) lis[2].innerHTML = s.perLi3;
    }
    if (cards[3]) {
      cards[3].querySelector("h4").textContent = s.cumTitle;
      const lis = cards[3].querySelectorAll("li");
      if (lis[0]) lis[0].textContent = s.cumLi1;
      if (lis[1]) lis[1].innerHTML = s.cumLi2;
    }
    mapLabel("term-order", s.termOrder);
    const to = document.getElementById("term-order");
    if (to) {
      for (const opt of to.options) {
        if (opt.value === "fall-spring") opt.textContent = s.fallSpring;
        if (opt.value === "spring-fall") opt.textContent = s.springFall;
      }
    }
    const secTerm = document.getElementById("sidebar-section-term-title");
    if (secTerm) {
      secTerm.textContent =
        p.sidebarTermSettingsTitle || s.sidebarTermSettingsTitle || (z === "zh" ? "学期顺序与学年" : "Term order & calendar years");
    }
    const secDomTitle = document.getElementById("sidebar-section-domestic-title");
    if (secDomTitle) {
      secDomTitle.textContent =
        p.sidebarDomesticGpaTitle || s.sidebarDomesticGpaTitle || (z === "zh" ? "实际国内 GPA" : "Actual domestic GPA");
    }
    const secDomLead = document.getElementById("sidebar-section-domestic-lead");
    if (secDomLead) {
      secDomLead.textContent =
        p.sidebarDomesticGpaLead ||
        s.sidebarDomesticGpaLead ||
        (z === "zh"
          ? "选填：按学期填入校方/国内教务系统给出的「学期 GPA」，用于成绩单上与工具重算结果并排对照；不参与逐课阶梯换算。"
          : "Optional: your institution’s per-term GPA for side-by-side display on the transcript. Does not change course-level ladder math.");
    }
    mapLabel("term-year-1", s.y1);
    mapLabel("term-year-2", s.y2);
    mapLabel("domestic-term-gpa-1", p.domesticTermGpaLabel1);
    mapLabel("domestic-term-gpa-2", p.domesticTermGpaLabel2);
    const dgPh1 = document.getElementById("domestic-term-gpa-1");
    const dgPh2 = document.getElementById("domestic-term-gpa-2");
    const gpaPh = p.domesticGpaPlaceholder || s.domesticGpaPlaceholder || "X.xx";
    if (dgPh1) dgPh1.placeholder = gpaPh;
    if (dgPh2) dgPh2.placeholder = gpaPh;
    const dSide = document.getElementById("domestic-gpa-sidebar-note");
    if (dSide) dSide.textContent = s.domesticGpaSidebarNote || "";
    const dEd = document.getElementById("domestic-gpa-editor-audit-note");
    if (dEd) dEd.textContent = s.domesticGpaEditorAuditNote || "";
    const dTx = document.getElementById("domestic-gpa-transcript-audit");
    if (dTx) dTx.textContent = s.domesticGpaAuditNoteTranscript || "";
    const finLb = document.getElementById("sidebar-finalize-heading");
    if (finLb) finLb.textContent = s.finalize;
    const reg = document.getElementById("regen-doc-id");
    const ex = document.getElementById("export-png");
    const gpaPdf = document.getElementById("export-gpa-discrepancy-report");
    if (reg) reg.textContent = s.regen;
    if (ex) ex.textContent = s.exportPng;
    mapLabel("export-pdf-layout", s.pdfLayoutLabel);
    const pdfHint = document.getElementById("export-pdf-layout-hint");
    if (pdfHint) pdfHint.innerHTML = s.pdfLayoutHint;
    const pdfSel = document.getElementById("export-pdf-layout");
    if (pdfSel) {
      const opts = pdfSel.querySelectorAll("option");
      if (opts[0]) opts[0].textContent = s.pdfLayoutPortrait;
      if (opts[1]) opts[1].textContent = s.pdfLayoutLandscape;
    }
    const exPdf = document.getElementById("export-transcript-pdf");
    if (exPdf) exPdf.textContent = s.exportTranscriptPdf;
    if (gpaPdf) gpaPdf.textContent = s.exportGpaDiscrepancyPdf;
    const ackSp = document.querySelector("#legal-ack + span");
    if (ackSp) ackSp.innerHTML = s.legalSpan;
    set(".legal-ack-summary-follow", s.legalFollow);
    mapLabel("upload-diagnostics", s.uploadDiag);
    const secDet = document.querySelector(".security-audit-writer-guide > summary");
    if (secDet) secDet.textContent = s.secSummary;
    const gb = document.querySelector(".security-audit-writer-guide-body");
    if (gb) {
      const pp = gb.querySelectorAll("p");
      if (pp[0]) pp[0].innerHTML = s.secP1;
      if (pp[1]) pp[1].innerHTML = s.secP2;
      if (pp[2]) pp[2].innerHTML = s.secP3;
      if (pp[3]) pp[3].innerHTML = s.secP4;
      if (pp[4]) pp[4].innerHTML = s.secP5;
    }
    const lib = document.getElementById("export-qr-fallback-lib");
    const ren = document.getElementById("export-qr-fallback-render");
    const qf = document.getElementById("export-qr-fallback-file");
    if (lib) lib.innerHTML = s.qrLib;
    if (ren) ren.innerHTML = s.qrRender;
    if (qf) qf.innerHTML = s.qrFile || "";
    const ll = document.querySelector('label[for="lang-select"]');
    if (ll) ll.textContent = s.langLabel;

    const wizLab = document.getElementById("wizard-mode-label-text");
    if (wizLab) wizLab.textContent = s.wizardToggle || "";
    const wt1 = document.getElementById("wizard-tab-1");
    const wt2 = document.getElementById("wizard-tab-2");
    const wt3 = document.getElementById("wizard-tab-3");
    if (wt1) wt1.textContent = s.wizardTab1 || "";
    if (wt2) wt2.textContent = s.wizardTab2 || "";
    if (wt3) wt3.textContent = s.wizardTab3 || "";
    const rst = document.getElementById("reset-all-data");
    if (rst) rst.textContent = s.resetAllData || "";
    const shr = document.getElementById("generate-share-link");
    if (shr) shr.textContent = s.shareLinkBtn || "";
    if (typeof window.transcriptToolRefreshWizardCompliance === "function") {
      window.transcriptToolRefreshWizardCompliance();
    }
  }

  window.TRANSCRIPT_I18N_PACK = PACK;
  window.TRANSCRIPT_SIDEBAR = SIDEBAR;
  window.TRANSCRIPT_EDITOR_LABEL = EDITOR_LABEL;

  window.applyTranscriptLanguage = function (lang) {
    const z = lang === "zh" ? "zh" : "en";
    applySidebarStrings(z);
    window.applyTranscriptLanguage._applyPage(z);
  };

  /**
   * Course table headers, totals row labels, and GPA scale thead: update text only (no innerHTML rebuild)
   * to reduce layout thrash on language switch.
   */
  function applyTranscriptPageKeyedI18n(t) {
    const root = document.getElementById("transcript-page");
    if (!root) {
      return;
    }
    const sep = t.gpaSeparator != null ? t.gpaSeparator : " / ";
    root.querySelectorAll("[data-i18n-key]").forEach((el) => {
      const key = el.dataset.i18nKey;
      if (!key) {
        return;
      }
      if (key === "courseHead") {
        const idx = Number(el.dataset.i18nIdx);
        if (Number.isFinite(idx) && t.courseHeaders[idx] != null) {
          el.textContent = t.courseHeaders[idx];
        }
        return;
      }
      if (key === "gpaScaleTh") {
        const idx = Number(el.dataset.i18nIdx);
        if (Number.isFinite(idx) && t.gradeTableHead[idx] != null) {
          el.textContent = t.gradeTableHead[idx];
        }
        return;
      }
      if (key === "termTotalsTitle") {
        el.textContent = t.termTotals;
        return;
      }
      if (key === "cumTotalsTitle") {
        el.textContent = t.cumTotals;
        return;
      }
      if (key === "lineAttempted") {
        el.textContent = t.attempted;
        return;
      }
      if (key === "lineEarned") {
        el.textContent = t.earned;
        return;
      }
      if (key === "lineGpaHours") {
        el.textContent = t.gpaHours;
        return;
      }
      if (key === "lineQuality") {
        el.textContent = t.qualityPts;
        return;
      }
      if (key === "lineTermGpa") {
        el.textContent = t.termGpa;
        return;
      }
      if (key === "lineCumGpa") {
        el.textContent = t.cumGpa;
        return;
      }
    });
    root.querySelectorAll(".term-gpa-sep").forEach((n) => {
      n.textContent = sep;
    });
    root.querySelectorAll(".cum-gpa-sep").forEach((n) => {
      n.textContent = sep;
    });
  }

  /** Apply transcript-page strings from PACK (not the sidebar). */
  function applyTranscriptPageStrings(z) {
    const t = L(z);
    document.documentElement.lang = t.htmlLang;
    const aside = document.querySelector(".editor-panel");
    if (aside) aside.setAttribute("lang", t.htmlLang);
    const page = document.getElementById("transcript-page");
    if (page) page.setAttribute("lang", t.htmlLang);
    document.title = t.docTitle;

    document.querySelectorAll("#transcript-page .watermark-layer").forEach((wm) => {
      wm.textContent = t.watermark;
    });
    const seal = document.getElementById("university-seal");
    if (seal) seal.textContent = t.universitySeal;
    const authTitle = document.getElementById("authorization-title");
    if (authTitle) authTitle.textContent = t.authTitle;
    const authText = document.getElementById("authorization-text");
    if (authText) authText.textContent = t.authText;
    setAuthorizationWatermark(t);
    const foot = document.getElementById("transcript-end-note");
    if (foot) foot.textContent = t.footerNote;
    const nonOff = document.getElementById("transcript-non-official-disclaimer");
    if (nonOff) nonOff.textContent = t.nonOfficialFooterLine || "";
    const ssnLab = document.getElementById("personal-ssn-label");
    if (ssnLab) ssnLab.textContent = t.personalSsnLabel;
    const sd = document.querySelector(".standing-disclaimer");
    if (sd) sd.textContent = t.standingDisclaimer;
    const standing = document.querySelector(".standing");
    if (standing) standing.setAttribute("data-edit-label", t.standingLabel);

    const sa = document.querySelector(".security-audit");
    if (sa) {
      const ps = sa.querySelectorAll(":scope > p");
      if (ps[0]) {
        const idv = document.getElementById("document-id")?.textContent || t.docIdPending;
        ps[0].innerHTML = `<strong>${t.docIdLabel}</strong> <span id="document-id">${escapeHtml(idv)}</span>`;
      }
      const chsi = sa.querySelector(".security-audit-chsi");
      if (chsi) {
        const cp = chsi.querySelectorAll("p");
        if (cp[0]) cp[0].innerHTML = `<strong>${t.chsiBlockTitle}</strong>`;
        if (cp[1]) cp[1].innerHTML = t.chsiBlockP1;
        if (cp[2]) cp[2].innerHTML = `<strong>${t.chsiProcedure}</strong> ${t.chsiProcedureBody}`;
        const code = document.getElementById("chsi-verify-code-display")?.textContent || t.chsiEmpty;
        const line = chsi.querySelector(".chsi-verify-line-transcript");
        if (line) {
          line.innerHTML = `<strong>${t.chsiCodeLine}</strong> <code id="chsi-verify-code-display" class="chsi-verify-code-display">${escapeHtml(code)}</code>`;
        }
        const bgcxLine = chsi.querySelector("#chsi-bgcx-url-line-transcript");
        if (bgcxLine && t.chsiBgcxLine) {
          bgcxLine.innerHTML = t.chsiBgcxLine;
        }
        const an = chsi.querySelectorAll("p.audit-inline-note");
        const filingIdx = an.length > 2 ? 2 : 1;
        if (an[filingIdx]) {
          an[filingIdx].innerHTML = `<strong>${t.chsiFiling}</strong> ${t.chsiFilingBody}`;
        }
      }
      const integ = Array.from(sa.querySelectorAll(":scope > p")).find((p) => p.querySelector("#integrity-hash"));
      if (integ) {
        const ih = document.getElementById("integrity-hash")?.textContent || t.docIdPending;
        integ.innerHTML = `<strong>${t.integrityLabel}</strong> <span id="integrity-hash">${escapeHtml(ih)}</span>`;
      }
      const exh = Array.from(sa.querySelectorAll(":scope > p")).find((p) => p.querySelector("#export-file-hash"));
      if (exh) {
        const eh = document.getElementById("export-file-hash")?.textContent || t.docIdPending;
        exh.innerHTML = `<strong>${t.exportHashLabel}</strong> <span id="export-file-hash">${escapeHtml(eh)}</span>`;
      }
      const allNotes = sa.querySelectorAll("p.audit-inline-note");
      allNotes.forEach((p) => {
        const st = p.textContent || "";
        if (st.includes("Truncated") || st.includes("截断")) {
          p.innerHTML = `<strong>${t.integrityNoteTitle}</strong> ${t.integrityNoteBody}`;
        }
      });
      const tls = sa.querySelectorAll("p.audit-time-line");
      if (tls[0]) {
        const v = document.getElementById("transcript-last-edited-display")?.textContent || "—";
        tls[0].innerHTML = `<strong>${t.fpLine}</strong> <span id="transcript-last-edited-display">${escapeHtml(v)}</span>`;
      }
      if (tls[1]) {
        const v = document.getElementById("transcript-export-snapshot-display")?.textContent || "—";
        tls[1].innerHTML = `<strong>${t.pngQueueLine}</strong> <span id="transcript-export-snapshot-display">${escapeHtml(v)}</span>`;
      }
      if (tls[2]) {
        const v = document.getElementById("trusted-timestamp")?.textContent || t.utcNotFetched;
        tls[2].innerHTML = `<strong>${t.utcLine}</strong> <span id="trusted-timestamp">${escapeHtml(v)}</span>`;
      }
      const utcNote = document.getElementById("transcript-utc-inline-note");
      if (utcNote) {
        utcNote.innerHTML = `<strong>${t.utcNoteTitle}</strong> ${t.utcNoteBody}`;
      }
      const phys = sa.querySelector(".security-audit-physical-layer");
      if (phys) {
        const pp = phys.querySelectorAll("p");
        if (pp[0]) pp[0].innerHTML = `<strong>${t.printCueTitle}</strong>`;
        if (pp[1]) pp[1].textContent = t.printCueBody;
      }
      const trust = sa.querySelector("p.audit-trust-short");
      if (trust) trust.innerHTML = `<strong>${t.scopeShortTitle}</strong> ${t.scopeShortBody}`;
      const qrRow = sa.querySelector(".export-qr-row");
      if (qrRow) {
        qrRow.setAttribute("lang", t.htmlLang);
        const cap = qrRow.querySelector(".export-qr-caption");
        const fol = qrRow.querySelector(".export-qr-caption-follow");
        if (cap) cap.innerHTML = `<strong>${t.qrCaption}</strong> ${t.qrCaptionStrong}`;
        if (fol) fol.innerHTML = `<strong>${t.qrFollowTitle}</strong> ${t.qrFollowBody}`;
        const qrHost = document.getElementById("export-integrity-qr");
        if (qrHost) qrHost.setAttribute("aria-label", t.qrAria);
      }
    }

    applyTranscriptPageKeyedI18n(t);

    const scale = document.getElementById("gpa-policy-scale");
    if (scale) {
      const h3 = scale.querySelector("#gpa-scale-title");
      const h4 = scale.querySelector("#percent-letter-heading");
      if (h3) h3.textContent = t.gradeScaleTitle;
      if (h4) h4.textContent = t.gradeScaleSub;
      const cap = scale.querySelector(".grade-rules-table-caption");
      if (cap) cap.textContent = t.gradeCaption;
      const n1 = document.getElementById("conversion-note-1");
      const n2 = document.getElementById("conversion-note-2");
      const n3 = document.getElementById("conversion-note-3");
      if (n1) n1.innerHTML = t.conversion1;
      if (n2) n2.innerHTML = t.conversion2;
      if (n3) n3.innerHTML = t.conversion3;
    }

    const cols = document.querySelectorAll(".student-box .info-column");
    let si = 0;
    cols.forEach((col) => {
      col.querySelectorAll("p").forEach((p) => {
        const strong = p.querySelector("strong");
        if (strong && t.studentStrong[si]) strong.textContent = t.studentStrong[si];
        si++;
      });
    });

    const ph = document.getElementById("photo-placeholder");
    if (ph) ph.textContent = t.photoPh;
    const lh = document.getElementById("logo-placeholder");
    if (lh) lh.textContent = t.logoPh;
    const spa = document.getElementById("student-photo-preview");
    if (spa) spa.alt = t.photoAlt;
    const lo = document.getElementById("logo-preview");
    if (lo) lo.alt = t.logoAlt;
    const cw = document.getElementById("center-watermark-preview");
    if (cw) cw.alt = t.wmAlt;

    const perimeter = document.getElementById("perimeter-warning");
    if (perimeter) perimeter.textContent = t.perimeter;
    const tamper = document.getElementById("tamper-warning-line");
    if (tamper) tamper.textContent = t.tamper;
    const legal = document.getElementById("legal-confirmation-line");
    if (legal) legal.textContent = t.legalConfirm;

    window.__TRANSCRIPT_UI_LANG__ = z;
    if (typeof window.transcriptToolSyncGradeScaleUi === "function") {
      window.transcriptToolSyncGradeScaleUi();
    }
    if (typeof window.transcriptToolAfterLanguageChange === "function") {
      window.transcriptToolAfterLanguageChange(z);
    }

    /* Date of Birth / Date Issued: canonical storage is YYYY-MM-DD (+ optional time on issued); transcript shows localized calendar. */
    (function applyTranscriptPagePiiDateDisplayFormatting() {
      const tp = document.getElementById("transcript-page");
      if (!tp || typeof window.formatDateForDisplay !== "function") {
        return;
      }
      const getCanon =
        typeof window.transcriptToolGetCanonicalPiiDateValue === "function"
          ? window.transcriptToolGetCanonicalPiiDateValue
          : function () {
              return "";
            };
      const line = function (raw) {
        const s = String(raw ?? "").trim();
        const m = /^(\d{4}-\d{2}-\d{2})([\s\S]*)$/u.exec(s);
        if (!m) {
          return s;
        }
        return window.formatDateForDisplay(m[1], z) + (m[2] || "");
      };
      ["dateOfBirth", "dateIssued"].forEach(function (key) {
        const span = tp.querySelector('[data-pii-key="' + key + '"]');
        if (!span || span.textContent === "***") {
          return;
        }
        const raw = String(getCanon(key) || "").trim();
        if (!raw) {
          return;
        }
        span.textContent = line(raw);
      });
    })();
  }

  window.applyTranscriptLanguage._applyPage = applyTranscriptPageStrings;
})();
