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
      importAlertNoFile: "Please select an Excel or CSV file first.",
      importAlertNoLib:
        "Spreadsheet library failed to load. Serve this page over HTTP(S) and allow cdn.sheetjs.com (or bundle xlsx locally).",
      importAlertBadExt: "Unsupported file type. Use .csv, .xlsx, or .xls.",
      importDiagTemplateOk: "Import: CSV template downloaded ({filename}, UTF-8 BOM).",
      importDiagReading: "Import: Reading file…",
      importDiagResult: "Import: {added} row(s) appended; {skipped} skipped. Reconcile with the official record.",
      importDiagFailPrefix: "Import failed:",
      personalSsnLabel: "Government ID (18-digit)",
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
      standingLabel: "Academic Standing",
      courseHeaders: ["Course Type", "Course Number", "Description", "Percent", "Grade Pt", "Grade", "Credits", "Quality Pts"],
      studentStrong: ["Name:", "Student ID:", "Date of Birth:", "Date Issued:", "Program:", "College:", "Major:", "Citizenship:"],
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
      gradeTableHead: ["Percent band", "Letter", "Grade Point"],
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
      exportComplete: (id) => `Export: Complete (${id}.png)`,
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
      conversion1: `<strong>Computation.</strong> Per row, enter <strong>percent score (0–100)</strong> and <strong>credits earned</strong> only. <strong>Grade point</strong> and <strong>letter grade</strong> are read exclusively from the ladder above (not manually assigned). <strong>Quality points</strong> = grade point × credits. <strong>Term GPA</strong> = sum of quality points ÷ sum of credits for that term. <strong>Cumulative GPA</strong> = sum of quality points ÷ sum of credits across all terms shown. Course type, course number, and description are for identification only and do not enter the GPA formula.`,
      conversion2: `<strong>Disclaimer.</strong> This ladder is illustrative for this sample only. It is not official grading policy and does not supersede official academic records, degree rules, or institutional policy.`,
      conversion3: `<strong>Transfer credit.</strong> Final recognition of courses and credits rests solely with the receiving institution, including its review of contact hours, syllabus equivalence, and applicable policy.`,
      /** Sample transcript body when UI language is English (matches default HTML). */
      transcriptDemo: {
        byEditLabel: {
          "Institution Name": "Example University",
          "Issuing Office": "Office of the University Registrar",
          "Document Title": "Academic Transcript",
          "Institution Address": "123 Example Street, Example City, EX 00000, USA",
          "Certification Institution Line":
            "Institution: Example University, 123 Example Street, Example City, EX 00000",
          "Issue And Digital Signature":
            "Date of Issue: 01/02/2000 | Digital Signature Hash: SAMPLE-SIGNATURE-HASH-NOT-VALID",
          "Signature Label": "Registrar's Personal Signature",
        },
        pii: {
          studentName: "John Doe",
          studentId: "000-00-0000",
          dateOfBirth: "01/01/2000",
          dateIssued: "01/02/2000",
          program: "Example Program",
          college: "Example College",
          major: "Example Major",
          citizenship: "Example Country",
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
      importAlertNoFile: "请先选择 Excel 或 CSV 文件。",
      importAlertNoLib: "表格解析库未加载。请通过 HTTP(S) 打开页面并允许 cdn.sheetjs.com（或将 xlsx 库置于本地）。",
      importAlertBadExt: "不支持的扩展名。请使用 .csv、.xlsx 或 .xls。",
      importDiagTemplateOk: "导入：已下载 CSV 模板（{filename}，UTF-8 BOM）。",
      importDiagReading: "导入：正在读取文件…",
      importDiagResult: "导入：已追加 {added} 行；跳过 {skipped} 行。请与官方成绩单核对。",
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
      standingLabel: "学业状态",
      courseHeaders: ["课程类型", "课号", "课程名称", "百分制", "等级点", "等级", "学分", "质量分"],
      studentStrong: ["姓名：", "学号：", "出生日期：", "签发日期：", "项目：", "学院：", "专业：", "国籍："],
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
      gradeTableHead: ["百分区间", "等级", "绩点"],
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
      exportComplete: (id) => `导出：已完成（${id}.png）`,
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
      conversion1: `<strong>计算说明。</strong> 每行仅填写<strong>百分制成绩（0–100）</strong>与<strong>获得学分</strong>。<strong>绩点</strong>与<strong>字母等级</strong>仅按上表阶梯读取（不可手改）。<strong>质量分</strong> = 绩点 × 学分。<strong>学期 GPA</strong> = 本学期质量分之和 ÷ 本学期学分之和。<strong>累计 GPA</strong> = 所列学期质量分总和 ÷ 学分总和。课程类型、课号、课程名称仅作标识，不参与公式。`,
      conversion2: `<strong>免责声明。</strong> 本阶梯仅为本示范件说明用途，非官方评分政策，不替代校方正式成绩存档、学位规则或校内制度。`,
      conversion3: `<strong>转学分。</strong> 课程与学分的最终认定以接收院校为准，包括对学时、大纲对等及适用政策的审查。`,
      /** Sample transcript body when UI language is Chinese (numeric fields kept consistent with English ladder). */
      transcriptDemo: {
        byEditLabel: {
          "Institution Name": "示例大学",
          "Issuing Office": "大学注册办公室",
          "Document Title": "学业成绩单",
          "Institution Address": "示范路 123 号，示范市，EX 00000，美国",
          "Certification Institution Line": "院校：示例大学，示范路 123 号，示范市，EX 00000，美国",
          "Issue And Digital Signature": "签发日期：01/02/2000 | 电子签哈希：SAMPLE-SIGNATURE-HASH-NOT-VALID",
          "Signature Label": "注册本人签字",
        },
        pii: {
          studentName: "约翰·多伊",
          studentId: "000-00-0000",
          dateOfBirth: "01/01/2000",
          dateIssued: "01/02/2000",
          program: "示例项目",
          college: "示例学院",
          major: "示例专业",
          citizenship: "示例国家",
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
    en: {},
    zh: {
      "Institution Name": "学校名称",
      "Issuing Office": "出具部门",
      "Document Title": "文件标题",
      "Institution Address": "学校地址",
      "Student Name": "姓名",
      "Student ID": "学号",
      "Date of Birth": "出生日期",
      "Date Issued": "签发日期",
      "Program": "项目",
      "College": "学院",
      "Major": "专业",
      "Citizenship": "国籍",
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
        "The <strong>18-digit</strong> field supports layout and a local hash watermark; logs store hashes only, not plaintext. Enter digits you accept on the printed layout; avoid sensitive values on public terminals.",
      blurSpan: "Blur preview (shared spaces)",
      blurHint:
        "Masks transcript PII as <strong>***</strong> and softens the photo; sidebar fields remain editable. PNG export temporarily uses full values, then masking restores if this option stays enabled.",
      pngTitle: "What PNG contains",
      pngBody:
        "Includes transcript body, security block, and QR only—not the left toolbar. Finalize wording on the transcript page (including the selected display language) before export.",
      logo: "Institution Logo",
      wm: "Institution Emblem Watermark (Center)",
      photo: "Student Photo",
      ssn: "Government ID (18-digit)",
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
      importSection: "Bulk course import",
      importHint:
        "Columns: Subject (or Course Type), Course Number, Description, Percent, Credits. First worksheet only; UTF-8 CSV recommended.",
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
      importDiagFailPrefix: "Import failed:",
      langLabel: "Language / 语言",
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
      wm: "校徽水印（居中）",
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
      importSection: "批量导入课程",
      importHint:
        "列：Subject/课程类型、Course Number/课号、Description/课程名称、Percent/百分制、Credits/学分。仅读取首张工作表；建议 UTF-8 CSV。",
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
      importDiagFailPrefix: "导入失败：",
      langLabel: "Language / 语言",
    },
  };

  function applySidebarStrings(lang) {
    const z = lang === "zh" ? "zh" : "en";
    const s = SIDEBAR[z];
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
    mapLabel("center-watermark-upload", s.wm);
    mapLabel("photo-upload", s.photo);
    mapLabel("personal-ssn-input", s.ssn);
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
    if (addB) addB.textContent = s.addRow;
    if (rmB) rmB.textContent = s.removeRow;
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
    mapLabel("term-year-1", s.y1);
    mapLabel("term-year-2", s.y2);
    const fin = document.querySelectorAll(".toolbox label.tool-label");
    fin.forEach((lb) => {
      if (lb.textContent.includes("Finalize") || lb.textContent.includes("完成")) lb.textContent = s.finalize;
    });
    const reg = document.getElementById("regen-doc-id");
    const ex = document.getElementById("export-png");
    if (reg) reg.textContent = s.regen;
    if (ex) ex.textContent = s.exportPng;
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
    if (lib) lib.innerHTML = s.qrLib;
    if (ren) ren.innerHTML = s.qrRender;
    const ll = document.querySelector('label[for="lang-select"]');
    if (ll) ll.textContent = s.langLabel;
  }

  window.TRANSCRIPT_I18N_PACK = PACK;
  window.TRANSCRIPT_SIDEBAR = SIDEBAR;
  window.TRANSCRIPT_EDITOR_LABEL = EDITOR_LABEL;

  window.applyTranscriptLanguage = function (lang) {
    const z = lang === "zh" ? "zh" : "en";
    applySidebarStrings(z);
    window.applyTranscriptLanguage._applyPage(z);
  };

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
    const perimeter = document.getElementById("perimeter-warning");
    if (perimeter) perimeter.textContent = t.perimeter;
    const tamper = document.getElementById("tamper-warning-line");
    if (tamper) tamper.textContent = t.tamper;
    const legal = document.getElementById("legal-confirmation-line");
    if (legal) legal.textContent = t.legalConfirm;
    const seal = document.getElementById("university-seal");
    if (seal) seal.textContent = t.universitySeal;
    const authTitle = document.getElementById("authorization-title");
    if (authTitle) authTitle.textContent = t.authTitle;
    const authText = document.getElementById("authorization-text");
    if (authText) authText.textContent = t.authText;
    setAuthorizationWatermark(t);
    const foot = document.getElementById("transcript-end-note");
    if (foot) foot.textContent = t.footerNote;
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
        const an = chsi.querySelectorAll("p.audit-inline-note");
        if (an[1]) an[1].innerHTML = `<strong>${t.chsiFiling}</strong> ${t.chsiFilingBody}`;
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

    document.querySelectorAll(".term-block").forEach((block) => {
      const ths = block.querySelectorAll("thead th");
      t.courseHeaders.forEach((text, i) => {
        if (ths[i]) ths[i].textContent = text;
      });
      const tr = block.querySelector(".totals-row");
      if (!tr) return;
      const spans = tr.querySelectorAll("span");
      if (spans[0]) spans[0].innerHTML = `<strong>${t.termTotals}</strong>`;
      const keys = ["attempted", "earned", "gpa-hours", "quality", "term-gpa"];
      const labs = [t.attempted, t.earned, t.gpaHours, t.qualityPts, t.termGpa];
      for (let i = 0; i < keys.length; i++) {
        const el = tr.querySelector(`.${keys[i]}`);
        const sp = spans[i + 1];
        if (sp && el) sp.innerHTML = `${labs[i]}<strong class="${keys[i]}">${escapeHtml(el.textContent)}</strong>`;
      }
    });

    const cum = document.querySelector(".cumulative-box .totals-row.final");
    if (cum) {
      const spans = cum.querySelectorAll("span");
      if (spans[0]) spans[0].innerHTML = `<strong>${t.cumTotals}</strong>`;
      const map = [
        ["cum-attempted", t.attempted],
        ["cum-earned", t.earned],
        ["cum-gpa-hours", t.gpaHours],
        ["cum-quality", t.qualityPts],
        ["cum-gpa", t.cumGpa],
      ];
      map.forEach(([id, label], idx) => {
        const el = document.getElementById(id);
        const sp = spans[idx + 1];
        if (sp && el) sp.innerHTML = `${label}<strong id="${id}">${escapeHtml(el.textContent)}</strong>`;
      });
    }

    const scale = document.getElementById("gpa-policy-scale");
    if (scale) {
      const h3 = scale.querySelector("#gpa-scale-title");
      const h4 = scale.querySelector("#percent-letter-heading");
      if (h3) h3.textContent = t.gradeScaleTitle;
      if (h4) h4.textContent = t.gradeScaleSub;
      const trh = scale.querySelector("#percent-letter-scale-table thead tr");
      if (trh) {
        trh.innerHTML = t.gradeTableHead.map((x) => `<th>${escapeHtml(x)}</th>`).join("");
      }
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

    window.__TRANSCRIPT_UI_LANG__ = z;
    if (typeof window.transcriptToolAfterLanguageChange === "function") {
      window.transcriptToolAfterLanguageChange(z);
    }
  }

  window.applyTranscriptLanguage._applyPage = applyTranscriptPageStrings;
})();
