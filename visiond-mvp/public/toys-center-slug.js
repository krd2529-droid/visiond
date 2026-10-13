const slugPart=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9ก-๙]/g,'');

export const compactToySlug=value=>slugPart(value).slice(0,100);

export function autoToySlug(title,sku){
  const suffix=slugPart(sku).slice(0,100);
  return slugPart(title).slice(0,100-suffix.length)+suffix;
}
