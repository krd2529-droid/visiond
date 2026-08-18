# v0.14.125 — Global Test User Identity

- Added a site-wide `is_test_user` flag and migrated legacy Vision 5 test accounts.
- Boss can create test users directly from the member administration screen.
- Test users share the controlled display name `รัฐสิทธิ ดำรงรถการ`; usernames, emails, IDs and histories remain unique.
- Public registration rejects duplicate customer names; the controlled duplicate name is assigned only through Boss operations.
- Existing test users are renamed during schema initialization and payment-name validation accepts the approved spelling variants.
