# PATCH vX.Y.Z — HANDOFF

## 1. แก้อะไร

- Scope:
- Intended outcome:

## 2. แก้ไฟล์ใด

- `path/to/file`

## 3. ทดสอบอะไรและผลเป็นอย่างไร

- Focused test:
- Regression:
- Predeploy:
- Syntax/build:
- Security/secret scan:

## 4. Commit identity

- Ledger value: `SELF`
- Resolve: `git log -1 --format=%H -- patch-ledgers/vX.Y.Z.json`
- Parent commit:

## 5. วิธีย้อนกลับ

- Safe rollback commit:
- Revert command for review: `git revert <resolved-commit-id>`
- Required retest:
- Push/Deploy owner: Boss only

## Status

- EVENT CASE ID:
- Completion condition:
- Remaining items:
- Next required action:
- IMPLEMENTED:
- PUSHED:
- DEPLOYED:
- PRODUCTION_VALIDATED:

End every delivery with exactly one:
- `EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมรับ Event Case ใหม่`
- `EVENT CASE: ยังไม่เสร็จ — ต้องทำต่อให้จบ`
- `EVENT CASE: PAUSED BY BOSS — ยังไม่เสร็จ`
