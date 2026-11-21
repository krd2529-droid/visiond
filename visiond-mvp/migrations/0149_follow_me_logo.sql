-- Apply in one transaction after /assets/follow-me-logo.png is live.
-- Expected changes: one program and two existing Follow me key products.
UPDATE vision7_programs
SET cover_url='/assets/follow-me-logo.png'
WHERE id=4 AND code='auto-invite' AND cover_url='/auto-invite-cover.svg';

UPDATE products
SET cover_url='/assets/follow-me-logo.png',preview_urls='["/assets/follow-me-logo.png"]'
WHERE id=5504 AND slug='vbot-key-auto-invite-monthly' AND price=59000
  AND cover_url='/auto-invite-cover.svg' AND preview_urls='["/auto-invite-cover.svg"]';

UPDATE products
SET cover_url='/assets/follow-me-logo.png',preview_urls='["/assets/follow-me-logo.png"]'
WHERE id=5497 AND slug='vbot-key-auto-invite-lifetime' AND price=159000
  AND cover_url='/auto-invite-cover.svg' AND preview_urls='["/auto-invite-cover.svg"]';
