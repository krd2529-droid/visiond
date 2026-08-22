const count=value=>Math.max(0,Number(value)||0);

export function partnerDelivery(item,packageItems=[]){
  const bundleItemCount=count(item.delivery_bundle_item_count);
  return {
    method:'visiond_claim',
    content_type:'digital_download',
    package_type:bundleItemCount?'bundle':'single',
    file_format:String(item.file_type||'PDF'),
    file_count:count(item.delivery_file_count),
    page_count:count(item.pages),
    total_size_bytes:count(item.delivery_total_size),
    bundle_item_count:bundleItemCount,
    access_note:'รับสิทธิ์และดาวน์โหลดผ่าน VisionD หลังยืนยันการชำระเงิน',
    ...(packageItems.length?{items:packageItems.map(entry=>({
      id:Number(entry.id),
      title:String(entry.title||''),
      file_format:String(entry.file_type||'PDF'),
      file_count:count(entry.file_count),
      page_count:count(entry.pages)
    }))}:{})
  };
}
