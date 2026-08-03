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
  for(const product of catalogProducts){
    await env.DB.prepare(`INSERT OR IGNORE INTO products(slug,title,short_description,description,price,cover_url,category,status,source) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(product.slug,product.title,product.short_description,product.description,product.price,product.cover_url,product.category,'published','catalog').run();
  }
}
