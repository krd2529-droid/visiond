export const makeHandoff=(count=3)=>({
  schema:'visiond.shopee-product-handoff',version:1,
  product:{visiond_product_id:7,page_1:{images:Array.from({length:count},(_,index)=>({url:`https://visiondonline.com/api/toys-center/gallery/7/${index}?v=${100+index}`,cover:index===0})),name:'ของสะสม "พิเศษ" 🚀',sku:'TOY-007',gtin:'8851234567890'},page_2:{category_path:['งานอดิเรกและของสะสม','ของสะสม','อื่นๆ'],brand:'VisionD',description:'บรรทัดหนึ่ง\r\nบรรทัดสอง \\ ทดสอบ',sales:{currency:'THB',price_minor:185000,stock:3},shipping:{weight_g:500,width_mm:120,length_mm:200,height_mm:80}}},
  validation:{complete:true,missing:[]}
});
export const makeThaiMartHandoff=(count=3)=>({
  schema:'visiond.thaimart-product-handoff',version:1,platform:'thaimart',
  product:{visiond_product_id:7,category_path:['งานอดิเรกและของสะสม','โมเดลและของสะสม','โมเดล / บอร์ดเกม / การ์ดเกม'],images:Array.from({length:count},(_,index)=>({url:`https://visiondonline.com/api/toys-center/gallery/7/${index}?v=${100+index}`,cover:index===0})),name:'โมเดลสะสมพิเศษ Thai Mart 🚀',description:'บรรทัดหนึ่ง\r\nบรรทัดสอง \\ ทดสอบ',sku:'TOY-007',sales:{currency:'THB',price_thb:1850,stock:0},shipping:{weight_g:500,dimensions_cm:{width_cm:12,length_cm:20,height_cm:8}}},
  validation:{complete:true,missing:[]}
});
export const clone=value=>structuredClone(value);
