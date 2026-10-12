export const STOCK_STORES={
  'toys-center':{id:'toys-center',name:'Toys Center',publicPath:'/toyscenter',feedPath:'/api/toys-center/feed.csv'},
  zippo:{id:'zippo',name:'Zippo',publicPath:'/zippo',feedPath:'/api/stock/feed.csv?store=zippo'}
};
export function stockStore(url,{defaultStore='toys-center'}={}){
  const value=new URL(url).searchParams.get('store')||defaultStore;
  return STOCK_STORES[value]||null;
}
export function storeSettings(row,store){return{
  storefront_mode:row?.storefront_mode||'unlisted',
  page_id:row?.page_id||'',page_name:row?.page_name||store.name,
  catalog_id:row?.catalog_id||'',catalog_name:row?.catalog_name||'',
  page_association_status:store.id==='zippo'?'verified_in_meta_ui':'unverified',
  connection_status:'unverified',
  connection_message:'VisionD ยังไม่ได้ยืนยันสถานะการนำเข้าฟีดจาก Meta; Page และ Catalog ที่แสดงเป็นข้อมูลกำหนดค่า กรุณาตรวจสถานะจริงใน Meta Commerce Manager',
  public_path:store.publicPath,feed_path:store.feedPath
}}
export async function scopedStockProduct(ctx){
  const store=stockStore(ctx.request.url);
  if(!store)return null;
  return ctx.env.DB.prepare('SELECT id,store_id FROM toys_center_products WHERE id=? AND store_id=?').bind(ctx.params.id,store.id).first();
}
