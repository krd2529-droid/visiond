export const VPAGE_CREDIT_SLUG='vpage-credit';
export const VPAGE_CREDIT_PRICE=99900;

export const isVpageCreditProduct=product=>
  String(product?.slug||'')===VPAGE_CREDIT_SLUG&&String(product?.product_kind||'')==='vpage-credit';
