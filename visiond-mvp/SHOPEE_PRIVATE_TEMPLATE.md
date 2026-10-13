# Private Shopee workbook setup

Stock export uses a seller's official Shopee XLSX workbook stored in the private `visiond-files` R2 bucket. The workbook bytes must never be committed, placed in `public/`, or served through a download route.

1. Confirm which Shopee seller account receives each Stock store's products. Do not assume `toys-center` and `zippo` share a seller account. The previously supplied workbook was used for Toys Center; its suitability for Zippo is not yet verified.
2. For each verified seller, upload the unmodified official workbook to `visiond-files` under an opaque key matching `private/shopee-templates/<name>.xlsx`. Keep the source file outside the repository. Verify the uploaded object's size is 1–2,097,152 bytes and compute its SHA-256 from the source.
3. In the Cloudflare Pages Production environment, set `SHOPEE_TEMPLATE_TOYS_CENTER_R2_KEY` and `SHOPEE_TEMPLATE_TOYS_CENTER_SHA256` for the Toys Center seller and/or `SHOPEE_TEMPLATE_ZIPPO_R2_KEY` and `SHOPEE_TEMPLATE_ZIPPO_SHA256` for the Zippo seller. Use the corresponding private R2 key and 64-character hex SHA-256. Leave an unverified store unset. These are explicit per-store mappings; export never falls back to the other store's workbook and rejects any bytes that no longer match the configured hash.
4. Redeploy the Pages production environment after changing variables. Test one published product's XLSX download through the authenticated Stock page, verify the workbook structure and store-specific metadata, then have the seller test import in Shopee Seller Centre. A successful VisionD download alone does not prove Seller Centre acceptance.
5. To rotate a template, upload under a new private key, change only the affected store variable, verify export, then remove the old R2 object after confirming no store still references it. A missing or invalid mapping returns a private, actionable error and no workbook.

The existing `FILES` R2 binding supplies the workbook. No database migration, public asset, or per-export upload is required.
