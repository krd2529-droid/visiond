const PAGE_SIZE=24;

const formatPrice=value=>`${Number(value).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})} บาท`;
const availabilityText=value=>value==='in stock'?'พร้อมขาย':'สินค้าหมด';
const conditionText=value=>value==='new'?'สภาพใหม่':'มือสอง';

function productPath(item){return `/toyscenter?product=${encodeURIComponent(item.slug)}`}

function productImageStage(item,doc){
  const stage=doc.createElement('div'),image=doc.createElement('img');
  stage.className='store-image-stage';
  image.src=item.image_2_url;
  image.alt=`${item.title} — รูปสินค้า`;
  image.loading='eager';
  image.decoding='async';
  stage.append(image);
  return stage;
}

export function createProductCard(item,doc=globalThis.document){
  const link=doc.createElement('a'),body=doc.createElement('div'),title=doc.createElement('h2'),price=doc.createElement('p'),availability=doc.createElement('p');
  link.className='store-product';
  link.href=productPath(item);
  link.setAttribute('aria-label',`ดูรายละเอียด ${item.title}`);
  title.textContent=item.title;
  price.className='price';
  price.textContent=formatPrice(item.price);
  availability.className='availability';
  availability.textContent=availabilityText(item.availability);
  body.className='store-product-body';
  body.append(title,price,availability);
  link.append(productImageStage(item,doc),body);
  return link;
}

function detailRow(label,value,doc){
  const row=doc.createElement('div'),term=doc.createElement('dt'),description=doc.createElement('dd');
  row.className='store-detail-row';
  term.textContent=label;
  description.textContent=String(value);
  row.append(term,description);
  return row;
}

function detailFigure(item,doc){
  const figure=doc.createElement('figure'),caption=doc.createElement('figcaption');
  figure.className='store-detail-figure';
  caption.textContent='รูปสินค้า';
  figure.append(productImageStage(item,doc),caption);
  return figure;
}

export function createProductDetail(item,doc=globalThis.document){
  const article=doc.createElement('article'),back=doc.createElement('a'),layout=doc.createElement('div'),gallery=doc.createElement('div'),information=doc.createElement('div'),title=doc.createElement('h2'),price=doc.createElement('p'),availability=doc.createElement('p'),descriptionTitle=doc.createElement('h3'),description=doc.createElement('p'),details=doc.createElement('dl');
  article.className='store-detail';
  back.className='store-back-link';
  back.href='/toyscenter';
  back.textContent='← กลับไปดูสินค้าทั้งหมด';
  layout.className='store-detail-layout';
  gallery.className='store-detail-gallery';
  gallery.setAttribute('aria-label','รูปสินค้า');
  gallery.append(detailFigure(item,doc));
  information.className='store-detail-information';
  title.textContent=item.title;
  price.className='price';
  price.textContent=formatPrice(item.price);
  availability.className='store-detail-availability';
  availability.textContent=availabilityText(item.availability);
  descriptionTitle.textContent='รายละเอียดสินค้า';
  description.className='store-detail-description';
  description.textContent=item.description||'';
  details.className='store-detail-facts';
  details.append(detailRow('สภาพสินค้า',conditionText(item.condition),doc));
  if(String(item.brand||'').trim())details.append(detailRow('แบรนด์',item.brand,doc));
  if(item.quantity!==null&&item.quantity!==undefined&&item.quantity!=='')details.append(detailRow('จำนวน',Number(item.quantity).toLocaleString('th-TH'),doc));
  information.append(title,price,availability,descriptionTitle,description,details);
  layout.append(gallery,information);
  article.append(back,layout);
  return article;
}

async function responseJson(response){
  try{return await response.json()}catch{return{error:'ระบบส่งข้อมูลสินค้าที่อ่านไม่ได้'}}
}

export function startStorefront(doc=globalThis.document,win=globalThis.window,request=globalThis.fetch){
  const root=doc.querySelector('#storeProducts'),status=doc.querySelector('#storeStatus'),pageText=doc.querySelector('#storePage'),pager=doc.querySelector('.pager'),previous=doc.querySelector('#storePrev'),next=doc.querySelector('#storeNext'),robots=doc.querySelector('#robotsMeta');
  let page=1,total=0;
  async function load(){
    const wanted=(new URL(win.location.href).searchParams.get('product')||'').trim(),detailMode=Boolean(wanted);
    status.textContent='กำลังโหลดสินค้า…';
    status.removeAttribute('data-state');
    pager.hidden=detailMode;
    root.classList.toggle('store-grid--detail',detailMode);
    try{
      const response=await request(detailMode?`/api/toys-center/products?slug=${encodeURIComponent(wanted)}`:`/api/toys-center/products?page=${page}`),data=await responseJson(response);
      if(!response.ok)throw new Error(data.error||'โหลดข้อมูลสินค้าไม่สำเร็จ');
      root.replaceChildren();
      if(detailMode){
        if(!data.item)throw new Error('ไม่พบสินค้า');
        root.append(createProductDetail(data.item,doc));
        doc.title=`${data.item.title} | Toys Center | VisionD`;
        status.textContent='';
        return;
      }
      const items=Array.isArray(data.items)?data.items:[];
      items.forEach(item=>root.append(createProductCard(item,doc)));
      total=Number(data.pagination?.total||0);
      robots.content=data.storefront_mode==='public'?'index,follow':'noindex,follow';
      pageText.textContent=`หน้า ${page} / ${Math.max(1,Math.ceil(total/PAGE_SIZE))}`;
      previous.disabled=page<=1;
      next.disabled=page*PAGE_SIZE>=total;
      status.textContent=items.length?'':'ยังไม่มีสินค้าที่เผยแพร่';
    }catch(error){
      root.replaceChildren();
      status.dataset.state='error';
      status.textContent=error instanceof Error?error.message:'โหลดข้อมูลสินค้าไม่สำเร็จ';
    }
  }
  previous.addEventListener('click',()=>{if(page>1){page-=1;load()}});
  next.addEventListener('click',()=>{if(page*PAGE_SIZE<total){page+=1;load()}});
  const ready=load();
  return{load,ready};
}

if(typeof document!=='undefined'&&typeof window!=='undefined')startStorefront();
