export const catalogProducts=[1,2,3,4].map(number=>({
  slug:`dinosaur-coloring-200-set-${number}`,
  title:`ชุดรวมระบายสีไดโนเสาร์ 200 แผ่นชุดที่ ${number}`,
  short_description:'ชุดระบายสีไดโนเสาร์ · 200 แผ่น',
  description:'ไฟล์ PDF ขนาด A4 รวมภาพระบายสีไดโนเสาร์ 200 แผ่น พร้อมพิมพ์',
  price:19900,
  cover_url:`/assets/dinosaur-set-${number}.jpeg`,
  category:'dinosaur'
}));

export async function ensureCatalogProducts(env){
  // Starter products were only deployment demos. Real products are now created from Admin/Vision 2.
  return env;
}
