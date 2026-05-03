# Product positioning (keep aligned with shipped copy and behavior)

## Core principles

This project is a **formatting and layout utility** (structuring information for registrar or international-office review, exporting PNG, etc.). It **does not** provide diploma certification, official issuance, or any “this tool is the authority” service. A common real-world pattern is that campus systems **ship electronic exports without embedded seals**, while **wet-stamped printouts** issued by the empowered office remain the acceptable outgoing record—whether an English layout must be **re-reviewed and re-stamped** is decided by each school on the spot.

### Design premise: usability and “walking through the checkpoint”

When the “compliant path” demands an impractically pristine format, language bundle, and artefact mix that diverges from everyday student reality (signed Chinese papers on hand, flaky public verification endpoints, intranet/VPN constraints), **friction pushes people toward shortcuts and grey markets**—not excusing fraud, but acknowledging product responsibility: **the legitimate path must be competitive in effort** so people still choose the checkpoint. Scolding cannot replace **institutional and platform verification workflows**; this stack keeps **required fields light** and spells out **printing, sealing, and external-use rules in plain English** so **honest students doing the right thing** are not forced out by layout gatekeeping first.

### Digital ease + physical workflow: situating “authority” humanely

Ease of use cannot end in the browser alone: **typesetting, preview, export** and **printing, queuing at offices, applying seals, binding per policy** are contiguous legs of the same journey—the tool handles the front leg and names who owns the rear. “Authority” here is not an abstract scare-word; it answers **which office or platform gets the final say on this step**. A humane stance keeps **layout in the tool while truth and legal effect stay with the school and counterpart rules**—neither belittling the registrar nor pretending the tool can mint trust.

### Physical reality: system of record lives with the registrar and archives, not inside a layout engine

**Ground truth** and **externally persuasive conclusions** cannot be auto-generated in someone’s browser tab; they settle through **official/campus channels**, most often **wet-stamped paperwork with retrievable records**. In practice many schools respond well when you **state the use case**, assemble **originals / copies / sanctioned translation memos** per their instructions that day, and **coordinate with the registrar or international office**—you can absolutely **earn stamps and acceptance above board**. Compared with long-term reliance on **fabricated personas, payment/risk chains, or jittery grey-market tooling**, budgeting time for **multiple window visits plus thorough communication** tends to be **lower aggregate risk and less soul-crushing**, and it habituates the workplace norms around **integrity and authorization**.

**Verification and attestation** always belong to **institutions stronger than us** inside their workflows, including:

- **Schools** (colleges / registrars / international offices): adjudicate authenticity, apply seals, issue formal attestations.
- **Employers, governments, visa posts, merchant platforms**, etc.—each verifies within **its own system**. None of that is this tool’s remit; we cannot substitute their judgments.

## What this tool actually does

- Threads **digital layout ease** (editing, English scaffolding, PNG export) with **physical workflow ease** (printing, registrar routing, pairing with stamped Chinese dossiers) in copy so users see **one actionable path**, not only a plausible-looking raster.
- Helps users **structure, format, and export information consistent with registrar facts**, lowering communication cost when gigantic Chinese transcripts bury the signal.
- **English transcript façades**: headings and explanatory copy rely on accurate user-supplied wording (do not cheat reviewers with careless machine translation); rows and aggregates stay structured so external readers parse quickly; outbound validity remains **whatever the registrar’s seals and bilingual rules require that day**.
- Through local journaling, **page integrity fingerprints (SHA-256)**, and informed consent, aids users in **proving that what they screened or exported matched the edit state locally**—not the same thing as operating a “verification bureau,” and **not** swapping out formal enrollment checks performed elsewhere.
- The sidebar **Government ID (18-digit)** field is labeled in **neutral, international wording** on purpose: it drives transcript layout placeholders and a **local salted hash watermark**, accepts **digits only**, and stores **hashes only** in the local compliance log—never plaintext. It is **not** US-SSN-specific and is **not** an invitation to paste a real national ID card number; students and instructors should read the in-app privacy note for the exact behavior.

### DOM guard and browser translation

The tool contains DOM guard logic. If a browser’s built-in translation feature is active, the tamper-proofing will temporarily yield to prevent a script conflict. For the most secure experience, users should consider using the tool with page translation disabled.

## What this tool explicitly does not do

- Never claims “this tool authenticated the dossier.”
- Never equates the utility with Campus Solutions exports, Ministry databases, merchant student portals, or any third-party official channel.
- **Does not help** fabricate enrollment or spoof foreign **education pricing, gated student perks, etc.** Enforcement belongs to **issuers plus platform vetting stacks**; the honest stance here is aiding **students with real enrollment who merely need sane layout tooling**.
- PNGs and fingerprints only prove **snapshot consistency at export-time on-device**—they **cannot** replace mandated **student identity / enrollment attestation** for pricing programs elsewhere.

## When the registrar pushes back: stay reassuring without crossing lines

Resistance is rarely about denying your coursework; it is **risk framing**: fear that the artefact resembles an **official registrar export**, reputational sensitivity, or **internal policy restricting templates, mastheads, or bilingual inserts to staff printers**. Echo their concern, then reshape **presentation and binder strategy**—never **truthfulness**.

Suggested sequence (adapt per institution):

1. **Pinpoint the choke point**: Missing seal requirement? Mandated stock? Translation must originate from their office? Rejecting Fayette-style mastheads? Ask for something **published or written** (memo, intranet cite; at minimum take careful notes yourself).
2. **Two-folder approach (steady in practice)**. **Pack A**: follow registrar/international templates **verbatim with official seals**—the “hardware authority.” **Pack B**: this tool’s **supplementary readable English appendix** paired with **a rider** stating datasets align with Pack A but the appendix itself **holds zero independent attestations**. Complaints tend to focus on treating **only Pack B as official**, not on Pack B existing.
3. **Visually converge**: if Word/PDF **study-abroad schemas** exist, remap columns and nomenclature in this workbook to resemble them (**without forging seals or forged letterhead**).
4. **Additive fixes**: bilingual course abstracts, residency/credit conversion memos, grade ladders—with **department or registrar factual sign-off**. That boosts confidence **without rewriting the authoritative record**.
5. **Bright lines**: forging or stealing registrar seals/signatures; implying official endorsement for this workbook when none exists; manipulating official grade systems or contact hours.**Do not.** Everything else tends to fold into **binder order plus an explanatory cover sheet**.
6. **Escalate calmly**: departmental coordinator → registrar window → international relations / supervising dean—carry **summaries of counterpart requirements**, articulate **why legible English presentation matters**; diplomacy beats frontal assault.

Product/engineering-wise we keep pinning the boundary at **layouts aligned with official Chinese dossiers minus forged authority**; **how seals attach or annexes behave** settles through conversation—assist legible artefacts and **risk reduction**, yet **never collides with authoritative policy through fabrication**.

Whenever UI copy or mechanics change later, revisit this document so nothing drifts sideways.
