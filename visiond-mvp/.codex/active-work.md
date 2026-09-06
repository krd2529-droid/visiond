# Active patch: Vtools visual redesign

- Event: PATCH_DELIVERED
- Outcome: หน้า /vtools ใช้ธีม VisionD ชัดเจน มี VX hero และแพ็กเกจที่ดูเป็นหน้าสินค้าจริงทั้ง desktop/mobile
- Preserve: ราคาและสิทธิ์ 30 วัน, 10/20/30 บัญชี, การเพิ่มตะกร้า, EasySlip, deep link ของ Affiliate และแคตตาล็อก Vtools
- Acceptance: canonical VisionD header; richer visual hierarchy; responsive without overflow; existing Vtools purchase tests pass
- Phase: desktop/mobile visual and regression tests PASS; production verified
- Files: public/vtools.html, public/vtools.css, scripts/test-vtools-browser.mjs
- Delivered: 5231e54a on origin/main; /vtools production contains v014599 assets
