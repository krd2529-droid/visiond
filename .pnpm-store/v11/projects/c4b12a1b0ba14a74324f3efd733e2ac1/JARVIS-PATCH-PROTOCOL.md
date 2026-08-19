# JARVIS Patch Protocol — VisionD

When a VisionD ZIP is received with `J` or `เจ`:
1. Read VERSION, latest PATCH note, VISIOND-ROADMAP, VISIOND-MARKETING-PLAN and CUSTOMER-DATA-ANALYSIS.
2. Inspect available aggregate customer/business data before choosing work. Never invent production findings when data is unavailable.
3. Preserve security boundaries, especially Boss/Admin/User/Guest and Elon isolation.
4. Implement the selected patch with minimal regression surface.
5. Run relevant QA, security/regression and predeploy checks.
6. Update VERSION and patch notes.
7. Update roadmap statuses: Implemented / Deployed / Validated separately.
8. Update marketing plan from measured outcomes.
9. Update customer-data analysis with privacy-minimized findings and the evidence window used.
10. Report after delivery: what changed, what data says, what remains, and the recommended next patch.
11. If the current roadmap/marketing phase is complete, draft the next phase automatically as PROPOSED for Boss review.

Data rule: aggregate/minimum necessary. Never place customer PII, slip data, secrets, tokens or API keys in roadmap/marketing/handoff files.

## Evidence-first rule — ห้ามเดางาน (บังคับทุกแพตและทุก Event Case)

- ห้ามระบุสาเหตุ สรุปสถานะ หรือแก้โค้ดจากการคาดเดา ภาพหน้าจอเพียงอย่างเดียว หรือความเป็นไปได้ที่ยังไม่ได้พิสูจน์
- ก่อนแก้ต้องมีหลักฐานตรวจสอบย้อนกลับได้อย่างน้อยหนึ่งรายการ: เส้นทางโค้ดจริง, Log ที่ปิดบังข้อมูลสำคัญ, HTTP/API response และรหัสสถานะ, ข้อมูลฐานข้อมูลแบบลดข้อมูลส่วนตัว, หรือผลทดสอบที่ทำซ้ำได้
- ต้องแยกคำรายงานให้ชัดเจนเป็น `ข้อเท็จจริงที่ยืนยันแล้ว`, `สิ่งที่ยังไม่ทราบ`, และ `ขั้นตอนตรวจถัดไป` ห้ามนำสมมติฐานไปรายงานเป็นข้อเท็จจริง
- หากยังเข้าถึงหลักฐานที่จำเป็นไม่ได้ ให้หยุดการแก้จุดนั้นและรายงาน `ยังไม่ทราบสาเหตุ — ต้องเก็บหลักฐานเพิ่ม` ห้ามทดลองแก้หลายแนวทางลงงานจริงเพื่อหวังให้หาย
- การเพิ่ม Diagnostic ต้องไม่แสดงหรือบันทึก Password, Token, API Key, App Secret, ข้อมูลบัตร/ธนาคาร หรือข้อมูลส่วนตัวเต็ม และต้องลบ/ลด Diagnostic ชั่วคราวเมื่อจบงาน
- ก่อน Commit ต้องอ้างหลักฐานต้นเหตุ หลักฐานหลังแก้ และผลทดสอบใน Patch Ledger; ถ้าพิสูจน์ไม่ได้ ห้ามใช้สถานะ `DONE-VERIFIED` หรือ `EVENT CASE: เสร็จทั้งหมดแล้ว`

## Mandatory standard patch loop (v0.14.191+)

Every patch and every Event Case must use this exact loop:

`ตรวจโค้ด → แก้ → รันทดสอบ → เจอข้อผิดพลาด → แก้อีก → ทดสอบใหม่`

- Repeat the same loop until the relevant focused, regression, security and predeploy checks pass.
- Errors found during the loop remain in the current patch. Do not increment the patch number merely because another fix/test iteration is required.
- A new patch number starts only for a new Event Case or an explicitly continued patch whose remaining scope is recorded.
- Commit only after the loop passes. Boss controls Push and Deploy unless Boss explicitly orders otherwise.


## Guest identity rule
Never collapse unauthenticated visitors into one `guest` identity. Use the platform's hashed per-browser/device visitor key. When a guest authenticates, claim prior events into the user where technically safe. Treat device/browser identity as a technical visitor, not proof of a unique natural person.

## First-order gift rule
The automatic digital gift is granted only after an authoritative paid first customer order, exactly once, from backend logic. System gift orders must be identifiable and excluded from revenue. Analyze its real conversion uplift before expanding the incentive.

## Event queue rule (v0.14.49+)
Every patch has two ordered queues.
1. `EVENT CASE` — Boss-inserted/ad-hoc work. Always execute first.
2. `EVENT ROADMAP` — planned work. Use remaining safe patch capacity only after Event Case is complete.
If an Event Case cannot safely finish in one patch, mark it `CONTINUE NEXT PATCH`, state the exact remaining scope at delivery, and keep it ahead of all roadmap work. Never let unfinished cases silently pile up.

Roadmap work rotates across major tracks so one track cannot monopolize releases: Growth/Data → Commerce/Conversion → Product/Production → Course/Creator → Security/QA → Marketing, then repeat. Production evidence, security, payment or auth risk may override rotation.

After every patch report: Event Case completed/remaining; Event Roadmap completed/remaining; data signals; exact recommended next patch order.

## Permanent template control rule (v0.14.189+)

- Every Event Case and Event Roadmap queue that creates or changes a page must reuse the canonical VisionD template assets before adding page-specific CSS.
- The language switcher is one compact pill: content-width, maximum 100% of its container, TH/EN controls centered, and never a full-width navigation row on mobile.
- The canonical header renders exactly one cart action. Its badge must use the normalized `vd_cart` quantity total: unique digital/program products count once, Vision 5 resale rights use their valid quantity, and the total is capped at 30.
- The mobile menu toggle is a responsive layout control, not a canonical content button. It must stay hidden above 800px, appear only at 800px or below, and remain exempt from runtime button classification.
- Boss/Admin account surfaces must lead with Control Center work. Do not render the member account sidebar, its mobile menu toggle, or customer notification message cards for staff; those components remain available only to member/customer roles.
- Desktop, Android-size and iPhone-size template checks are mandatory. New one-off header, language-switcher or button geometry is forbidden unless Boss approves a named exception.

## Continuous frontend Button/Event coverage rule (v0.14.205+)

- Every patch that creates or changes frontend UI must update Button/Event coverage in the same patch. This includes buttons, button-like links, menus, tabs, accordions, form submissions, toggles, dialogs, upload controls, retry actions and confirmation actions.
- Coverage must verify the intended handler or submit path, loading/disabled/success/error states, keyboard accessibility where applicable, and the absence of duplicate, ghost or unreachable controls.
- The same interaction must be checked on desktop, Android-size and iPhone-size layouts. Responsive-only controls must also prove that they are hidden outside their intended breakpoint.
- Add the new or changed interaction to a focused automated test and record that test as evidence in the patch ledger. A visual-only inspection is not sufficient.
- A frontend patch cannot be closed, committed or marked `DONE-VERIFIED` while any new or changed interaction lacks Button/Event coverage. Record it as a remaining Event Case item and continue the standard patch loop until it passes.
- This is a living rule: coverage expands whenever frontend work expands; later features may not rely only on an older page-wide test.
- Coverage is full-stack whenever an interaction reaches the server: trace the frontend handler through the API route, authorization/role boundary, input validation, idempotency or duplicate protection, database/file mutation, success response and safe error response.
- Backend tests must prove both an allowed path and the important denied/invalid path. A button is not covered merely because its click handler exists or the API returns any response.
- If an interaction is intentionally UI-only, record `UI-ONLY` with evidence that it performs no network or persistent-data operation; do not invent a backend dependency.


## EVENT CASE STATUS REPORTING
After EVERY patch, the delivery report MUST end with exactly one clear Event Case state:
- `EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมรับ Event Case ใหม่`
- `EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`
If unfinished, list every remaining Event Case item and make continuation the next-patch priority. Never mark a case complete because only one subtask shipped.

## Mandatory patch handoff + rollback rule (v0.14.185+)

Every patch must record these five items before delivery:
1. What changed — concise scope and intended outcome.
2. Changed files — exact repository paths.
3. Tests — commands/contracts and pass/fail/warn results.
4. Commit identity — use `SELF` inside the patch ledger because a Git commit cannot contain its own final hash; resolve it with `git log -1 --format=%H -- <ledger-file>`. Report the resolved hash after commit.
5. Rollback — record both `parent_commit` and `safe_rollback_commit`, plus a non-destructive `git revert` procedure. Never assume the parent is production-safe.

Required files:
- `SAFE-BASELINE.md` — last production version/commit explicitly validated by Boss, plus unvalidated candidate.
- `patch-ledgers/vX.Y.Z.json` — machine-readable five-item handoff.
- `work-history/visiond/patch-history/PATCH-vX.Y.Z-*.md` — human-readable reasoning and cautions for material patches.

Status meanings must stay separate:
- `IMPLEMENTED`: code and local QA complete.
- `PUSHED`: Boss pushed the commit.
- `DEPLOYED`: hosting completed.
- `PRODUCTION_VALIDATED`: Boss or recorded live evidence confirmed critical paths.
Only `PRODUCTION_VALIDATED` may replace the safe baseline.

Rollback safety:
- Prefer `git revert <bad-commit>` to preserve later history and data.
- Never use broad file overlay, `git reset --hard`, automatic Push, or automatic Deploy.
- Re-run regression, predeploy, security scan and visible-version checks on the revert commit.

## One request = one Event Case completion guard (v0.14.186+)

- Treat one user-requested topic as one Event Case with a clear completion condition.
- Do not mark the Event Case complete merely because one patch, one turn, one commit, or one subtask finished.
- If any required part remains at delivery, the final report must prominently state: `EVENT CASE: ยังไม่เสร็จ — ต้องทำต่อให้จบ`.
- The report must list every remaining item, the exact blocker/status, and the next action required to finish.
- Before starting an unrelated new Event Case, warn Boss that the active Event Case remains unfinished and recommend completing it first.
- Boss may explicitly reorder or pause work; record that decision as `PAUSED BY BOSS` without mislabeling the Event Case complete.
- A new request that adds acceptance criteria to the active topic remains part of the same Event Case.

## Course media and minimum-price rule (v0.14.288+)

## Paper-doll PDF set rule (v0.14.312+)

- PDF แต่ละไฟล์ต้นทางเป็นคนละกลุ่ม แม้ผู้ใช้ไม่ต้องตั้งชื่อประเภท ระบบห้ามรวมหน้าทุกไฟล์เป็นกองเดียวก่อนแบ่ง
- เมื่อตั้งจำนวนตะกร้า ทุกตะกร้าต้องได้หน้าจากทุก PDF ตามลำดับเดิม โดยกระจายเศษให้ตะกร้าแรกทีละหน้า
- ต้องตรวจผลรวมช่วงหน้าว่าไม่มีหน้าซ้ำและไม่มีหน้าตกหล่น พร้อม Preview ก่อนสร้างจริง
- สร้างเป็นร่างเท่านั้น และใช้ตัวสร้าง Slug ปกติของหมวด `paper-doll` (`paper-doll-NNN`) โดยห้ามสร้างรูปแบบ Slug ใหม่
- PD-SET-001 ต้องแปลงต้นทาง PNG/PDF/ZIP เป็นกลุ่มหน้าก่อนแบ่ง และห้ามเปลี่ยนกติกากระจายหน้าหรือ Slug เดิม
- PD-SET-001 ห้ามจำกัดขนาดไฟล์ต้นทางใน Frontend เพราะยังประมวลผลในเครื่องผู้ใช้; ให้ตรวจเพดานเฉพาะไฟล์ผลลัพธ์ก่อนเรียก API

- วิดีโอ EP ขนาดใหญ่ต้องอัปโหลดแบบ multipart ห้ามส่งไฟล์ทั้งก้อนผ่าน Worker request เดียว
- หน้าเจ้าของคอร์สต้องแนะนำไฟล์ 720p หรือ 480p และไม่อ้างว่าระบบแปลงหรือตัดคลิปให้อัตโนมัติหากยังไม่มี media processor จริง
- ราคาคอร์สต้องตรวจขั้นต่ำทั้ง UI และ API ห้ามพึ่ง `min` ของ HTML เพียงจุดเดียว
- ค่าขั้นต่ำปัจจุบันคือ 499 บาท หากเปลี่ยนต้องแก้ผ่าน shared course rule และมี regression test
# กฎโครงสร้างหน้าเดียว (เพิ่มใน v0.14.297)

- หนึ่งฟอร์มหรือหนึ่ง workflow ต้องมี controller ที่เขียน state และ submit handler เพียงชุดเดียว
- เมื่อเปลี่ยน workflow ให้ค้นหา HTML, script tag, MutationObserver, event handler และไฟล์เสริมทุกจุดที่มีผลต่อ runtime เพื่อระบุ controller เจ้าของงานให้ชัดเจน
- ต้องมี regression test ยืนยันว่า asset เก่าไม่ถูกโหลดและไม่สามารถกลับมาเขียนหน้าทับหลังรีเฟรช

## กฎ EP ภายในตะกร้าคอร์ส (เพิ่มใน v0.14.298)

- EP ต้องใช้ controller ปัจจุบันชุดเดียวกับหน้าสร้างคอร์ส และผูกด้วย `course_id` ของตะกร้าเสมอ
- ก่อนมี `course_id` แสดงสถานะรอบันทึกตะกร้า ห้ามสร้างแถว EP เปล่าในฐานข้อมูลเพื่อจำลองหน้าจอ
- ห้ามพับหรือซ่อน workspace EP; หลังบันทึกตะกร้าต้องเปิดฟอร์ม EP ต่อในหน้าเดิมทันที
- ตรวจชื่อและสื่อของทุก EP ทั้งหน้าเว็บและ API ก่อนส่งตรวจ

## กฎตามตัวโค้ดและเจ้าของฟีเจอร์ (เพิ่มใน v0.14.303)

- ฟีเจอร์ใหม่หรือฟีเจอร์ที่แก้สาระสำคัญต้องมีรหัสถาวรรูปแบบ `DOMAIN-CAPABILITY-NNN` และใช้รหัสเดียวกันใน Feature Map, จุดสำคัญของโค้ด, ปุ่ม/API ที่เกี่ยวข้อง และการทดสอบ
- ชื่อไฟล์ ฟังก์ชัน ตัวแปร ฟิลด์ข้อมูล ปุ่ม และ API ต้องสื่อหน้าที่จริง ห้ามใช้ชื่อกว้างอย่าง `handleData`, `doAction` หรือ `button1` เมื่อสามารถตั้งชื่อที่เจาะจงได้
- ปุ่มหรือ interaction สำคัญต้องมี `id` ที่ไม่ซ้ำและ `data-feature` เพื่อค้นหาเส้นทางจาก UI ไปยัง handler/API ได้
- บันทึกฟีเจอร์ใน `FEATURE-MAP.md` โดยระบุ หน้า, ไฟล์, ฟังก์ชัน/ตัวควบคุม, API, ฐานข้อมูล/ตาราง/ฟิลด์, Input, Output, Reads, Writes, สิทธิ์, สิ่งห้ามกระทบ และการทดสอบ
- คอมเมนต์ใช้เฉพาะขอบเขตโมดูล ฟีเจอร์ API หรือกฎธุรกิจที่ชื่อโค้ดอธิบายไม่พอ ไม่ใส่คอมเมนต์ทุกบรรทัด และต้องแก้คอมเมนต์พร้อมโค้ดเสมอ; คอมเมนต์เก่าที่ไม่ตรงถือเป็นบั๊ก
- ก่อนแก้ฟีเจอร์เดิมให้ค้นหารหัสใน Feature Map ก่อน หากส่วนที่แตะยังไม่มีรหัส ให้สร้างรายการสำหรับขอบเขตที่แก้ในแพตช์เดียวกัน
- ห้ามเดาฐานข้อมูล ตาราง ฟิลด์ หรือเจ้าของ state ต้องตรวจหลักฐานจาก schema, query และเส้นทาง runtime ก่อนบันทึก
- ห้ามเปลี่ยนชื่อ API หรือฟิลด์ฐานข้อมูลเดิมจำนวนมากเพียงเพื่อให้เข้ากฎนี้ หากต้องเปลี่ยนต้องเป็น migration แยกพร้อม compatibility และ rollback
- การทดสอบของฟีเจอร์ต้องอ้างรหัสฟีเจอร์และพิสูจน์ทั้งผลที่ต้องได้กับ `ห้ามกระทบ`; ฟีเจอร์ frontend ยังคงต้องผ่าน Button/Event coverage ตามกฎเดิม
