UPDATE users
SET seller_payment_status='approved',
    seller_payment_verified_at=COALESCE(seller_payment_verified_at,CURRENT_TIMESTAMP),
    seller_payment_verified_by=NULL
WHERE seller_payment_status IN ('pending','rejected')
  AND TRIM(COALESCE(seller_bank_name,''))<>''
  AND TRIM(COALESCE(seller_account_name,''))<>''
  AND TRIM(COALESCE(seller_account_number,''))<>'';
