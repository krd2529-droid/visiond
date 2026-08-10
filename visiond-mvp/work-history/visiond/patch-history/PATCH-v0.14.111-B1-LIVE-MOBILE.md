# VisionD v0.14.111 / V Easy v1.0.10 — B1 Live Mobile Operations

This patch restores packaged APK connectivity, adds safe unpaid-order cancellation, product editing/deletion, server bot controls and ready-channel chat switching. Mobile alerts are deduplicated, persisted, urgent-first and paginated; unresolved owner decisions remain pinned and can repeat sound on a controlled interval.

Boss receives only two files: VisionD Web ZIP and signed V Easy APK. The matching V Easy Source stays private, versioned and backed up inside the team, and every APK must still be rebuilt from that source; decompiling an old APK is forbidden. Real Redmi device verification remains pending. The present Nitron shell cannot honestly guarantee cross-app overlay or background notification after Android kills its process; the server bot itself remains online.

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ หลังทดสอบเครื่องจริงและเพิ่ม native foreground/push/overlay ถ้า Boss ต้องการให้ทำงานหลัง process ถูกปิด
