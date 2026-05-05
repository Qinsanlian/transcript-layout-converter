# Development Log: 7-Day Journey (April 29 - May 5, 2026)

## Day 1 · April 29, 2026
**Ideation & Strategic Decision**

- Spent approximately 1.5 days conceptualizing the project
- Inspiration: A frontend transcript formatting tool commonly misused by students
- Strategic pivot: Borrow the design approach but create a **compliant version only**
- Core positioning: Original + Chinese version + English version (dual-language, non-replacement of institutional authority)
- V1 prototype: English-only, minimal features
- **Critical rejection**: Initially considered self-signed hash QR codes for verification
  - Realization: This would require self-attestation of credential authenticity
  - Decision: **Actively abandoned** - we have no authority to verify transcripts

---

## Day 2 · April 30, 2026
**Bilingual Framework & Triple-Hash Verification**

- V2: Implemented dual-language framework (Chinese + English versions)
- Introduced triple-hash verification system to validate data integrity
- **Key insight**: Hashes prove *user's own layout wasn't tampered with*, NOT that transcripts are authentic
- Shift in philosophy: User responsibility > Tool responsibility

---

## Day 3 · May 1, 2026
**Integration & Strategic Constraint**

- V3: Merged language versions into unified platform
- Identified data entry burden: manual entry of all course information is tedious
- Considered OCR as solution to automate data extraction
- **Critical decision: REJECTED OCR**
  - Reason: OCR would shift responsibility from user to tool
  - Privacy concern: Automatic image processing without explicit consent
  - Accuracy concern: OCR errors could propagate through calculations
- Alternative: Implemented **Excel (SheetJS) import** instead
- V4: First version with complete feature parity and user control

---

## Day 4 · May 2, 2026
**Authority Integration & Multi-Format Support**

- V5: Discovered critical gap - CHSI (China Higher Education Student Information) system exists as real authority
  - Integrated CHSI verification code input field
  - Added direct link to `bgcx.jsp` verification portal
- Identified real-world data complexity:
  - Percentage-based grading (100-point scale)
  - Five-tier grading systems
  - Two-tier grading systems
  - Exemption/Waiver courses
- V6: Implemented **automatic grading system detection** and GPA calculation logic
- Discovered discrepancy: International GPA vs. Domestic GPA (~0.2 difference)
  - Decision: Added both GPA scales with non-accusatory explanation
  - Transparency: Let users understand the difference without judgment
- Added **A3 single-page PDF export** for professional presentation

---

## Day 5 · May 3, 2026
**Legal Risk Attribution & Security Hardening**

- Focused on establishing clear legal boundaries and compliance framework
- **Non-removable watermark system**: "UNOFFICIAL LAYOUT AID" merged at raster level
  - Watermark cannot be removed via DOM manipulation
  - Persists in both PNG and PDF exports
- **PDF metadata injection**: Every exported PDF includes document properties declaring: "Unofficial layout; NOT an institutional document"
- **Data isolation**: Complete separation between Chinese and English data
  - Only certificate ID and core fields are shared
  - Language-specific customization fully isolated
- **No credential simulation**: Explicitly documented that tool will never generate signatures, seals, or official stamps
- Created `PRODUCT_POSITIONING.md` with clear boundary statement
- Implemented **session transparency logging** with file hashes and timestamps

---

## Day 6 · May 4, 2026
**Quality Assurance & User Experience Hardening**

- P0 security and UX bug fixes:
  - Fixed certificate ID display issue (was showing `***`, now shows actual input)
  - Fixed date bracketing format issues
  - Fixed critical refresh bug where user data was lost after manual save
- Implemented **mandatory export confirmation** (user must type confirmation phrase)
- Added **Ctrl+Z undo stack** with full transaction history
- Added **one-click reset** to restore template defaults
- Conducted comprehensive validation:
  - Created 7 test groups covering all major features
  - Validated all export formats (PNG, PDF, A3)
  - Verified watermark rendering on all exports
  - Tested data persistence across sessions
- **All 7 test groups passed validation** ✅

---

## Day 7 · May 5, 2026
**Final Validation & Launch**

- Resolved remaining edge cases:
  - Undo functionality behavior after manual save (confirmed as designed)
  - Excel import auto-save missing safeguards (added)
  - Refresh/close/privacy clearance popup logic (full alignment)
  - Language switching modal alignment (fixed)
- Completed full validation checklist across all 7 test groups ✅
- Force-pushed final version to GitHub via SSH
- Wrote comprehensive release notes and updated README
- Sent formal request to GitHub Education team for review and community sharing
- Project status: **Production-ready with comprehensive safeguards**

---

## Design Philosophy Summary

This 7-day development cycle demonstrates:
1. **Ethical constraints-first approach** - Security and compliance built in from day one, not added later
2. **Principled rejections** - Actively abandoned multiple "easy solutions" (self-signed hashes, OCR, unverified data)
3. **Responsibility assignment** - Clear allocation of liability (user, tool, institution)
4. **User empowerment** - Providing tools without shifting responsibility
5. **Transparency** - Every decision documented and explained

**Core principle**: When helping others, you don't have to choose between being helpful and being responsible.