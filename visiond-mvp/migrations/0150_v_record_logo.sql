-- Apply in one transaction only after /assets/v-record-logo.png is live.
-- Keep program, offers, products, release, and existing licenses otherwise unchanged.
UPDATE vision7_programs
SET cover_url='/assets/v-record-logo.png'
WHERE id=2 AND code='v-record'
  AND cover_url='/api/media/vision7/apps/v-record/cover-3e3488cb-4ab2-44c5-a643-db0b5fb8b292.png';

UPDATE products
SET cover_url='/assets/v-record-logo.png',preview_urls='["/assets/v-record-logo.png"]'
WHERE id=5289 AND slug='vbot-key-v-record-monthly' AND price=19900
  AND cover_url='/api/media/vision7/apps/v-record/cover-3e3488cb-4ab2-44c5-a643-db0b5fb8b292.png'
  AND preview_urls='["/api/media/vision7/apps/v-record/cover-3e3488cb-4ab2-44c5-a643-db0b5fb8b292.png"]';

UPDATE products
SET cover_url='/assets/v-record-logo.png',preview_urls='["/assets/v-record-logo.png"]'
WHERE id=5290 AND slug='vbot-key-v-record-yearly' AND price=99900
  AND cover_url='/api/media/vision7/apps/v-record/cover-3e3488cb-4ab2-44c5-a643-db0b5fb8b292.png'
  AND preview_urls='["/api/media/vision7/apps/v-record/cover-3e3488cb-4ab2-44c5-a643-db0b5fb8b292.png"]';
