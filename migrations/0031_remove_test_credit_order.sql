-- Boss confirmed this exact manual credit order was generated only for testing.
-- Remove every dependent row before deleting the order so integrity checks do not
-- keep reporting a stale unlock record. No other order number is affected.

-- These three masked V Easy keys were also explicitly confirmed by Boss as
-- throwaway generated test data. Match both platform and last four characters so
-- licenses from any other application remain untouched.
DELETE FROM veasy_shops
WHERE license_id IN (
  SELECT l.id
  FROM vision7_licenses l
  JOIN vision7_programs p ON p.id=l.program_id
  WHERE lower(p.platform_type)='veasy' AND l.key_last4 IN ('F7HJ','UE65','IF6X')
);

DELETE FROM vision7_licenses
WHERE id IN (
  SELECT l.id
  FROM vision7_licenses l
  JOIN vision7_programs p ON p.id=l.program_id
  WHERE lower(p.platform_type)='veasy' AND l.key_last4 IN ('F7HJ','UE65','IF6X')
);

DELETE FROM unlock_logs
WHERE order_no = 'VD-CREDIT-1786366955307-50BE'
   OR order_id IN (SELECT id FROM orders WHERE order_no = 'VD-CREDIT-1786366955307-50BE');

DELETE FROM course_right_credits
WHERE order_id IN (SELECT id FROM orders WHERE order_no = 'VD-CREDIT-1786366955307-50BE');

DELETE FROM entitlements
WHERE order_id IN (SELECT id FROM orders WHERE order_no = 'VD-CREDIT-1786366955307-50BE');

DELETE FROM verified_slips
WHERE order_id IN (SELECT id FROM orders WHERE order_no = 'VD-CREDIT-1786366955307-50BE');

DELETE FROM order_slip_evidence
WHERE order_id IN (SELECT id FROM orders WHERE order_no = 'VD-CREDIT-1786366955307-50BE');

DELETE FROM order_items
WHERE order_id IN (SELECT id FROM orders WHERE order_no = 'VD-CREDIT-1786366955307-50BE');

DELETE FROM orders
WHERE order_no = 'VD-CREDIT-1786366955307-50BE';
