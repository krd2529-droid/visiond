# PATCH v0.14.80 — Multi-category Promotion Hotfix

## Cause

The old system stored one `promotion_scope` string. Saving a second category replaced the first category by design.

## Fix

- Store an atomic JSON category list in `promotion_scopes` while retaining `promotion_scope` compatibility.
- Validate every selected category before writing settings.
- Apply the same discount to every selected category.
- Replace the single dropdown with clear multi-category checkboxes.
- “All categories” remains mutually exclusive and resale-rights stays excluded.
