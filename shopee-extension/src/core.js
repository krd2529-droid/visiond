(function installVisionDShopeeCore(scope){
  'use strict';

  const SCHEMA='visiond.shopee-product-handoff';
  const VERSION=1;
  const CATEGORY_PATH=['งานอดิเรกและของสะสม','ของสะสม','อื่นๆ'];
  const DEFAULT_IMAGE_ORIGINS=['https://visiondonline.com'];
  const SENSITIVE_KEY=/(?:^|_)(?:cost|password|passcode|session|token|secret|cookie|account|customer|order|payment|vault|image_2|meta_image|r2_key|image_key)(?:_|$)/i;
  const PROTOTYPE_KEYS=new Set(['__proto__','constructor','prototype']);
  const plainObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
  const sameKeys=(value,expected)=>plainObject(value)&&Object.keys(value).sort().join('\0')===[...expected].sort().join('\0');
  const finiteInteger=(value,min)=>Number.isSafeInteger(value)&&value>=min;
  const nonEmpty=value=>typeof value==='string'&&value.trim().length>0;
  const makeError=(code,path,message,details)=>({code,path,message,...(details?{details}: {})});

  function scanSensitiveKeys(value,path='$',errors=[]){
    const stack=[{value,path,depth:0}];let nodes=0;
    while(stack.length){
      const current=stack.pop();nodes+=1;
      if(nodes>5000){errors.push(makeError('structure_limit',current.path,'JSON มีโครงสร้างใหญ่เกินขอบเขต'));break}
      if(current.depth>32){errors.push(makeError('structure_limit',current.path,'JSON ซ้อนลึกเกินขอบเขต'));continue}
      if(Array.isArray(current.value)){for(let index=current.value.length-1;index>=0;index--)stack.push({value:current.value[index],path:`${current.path}[${index}]`,depth:current.depth+1});continue}
      if(!plainObject(current.value))continue;
      for(const[key,entry]of Object.entries(current.value)){
        const next=`${current.path}.${key}`;
        if(PROTOTYPE_KEYS.has(key))errors.push(makeError('prototype_field',next,'ไฟล์มีชื่อฟิลด์ที่อาจเปลี่ยน prototype'));
        if(SENSITIVE_KEY.test(key))errors.push(makeError('private_field',next,'ไฟล์มีชื่อฟิลด์ส่วนตัวที่ไม่อนุญาต'));
        stack.push({value:entry,path:next,depth:current.depth+1});
      }
    }
    return errors;
  }

  function validateImage(image,index,productId,allowedOrigins,errors,seen){
    const path=`$.product.page_1.images[${index}]`;
    if(!sameKeys(image,['url','cover'])){errors.push(makeError('unexpected_shape',path,'โครงสร้างรูปไม่ตรงกับ handoff v1'));return null}
    if(typeof image.cover!=='boolean')errors.push(makeError('wrong_type',`${path}.cover`,'cover ต้องเป็น boolean'));
    let parsed=null;
    try{parsed=new URL(image.url)}catch{}
    if(!parsed||parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash||parsed.port){
      errors.push(makeError('invalid_image_url',`${path}.url`,'URL รูปต้องเป็น HTTPS ที่ไม่มี credential หรือ fragment'));
    }else if(!allowedOrigins.includes(parsed.origin)){
      errors.push(makeError('untrusted_image_origin',`${path}.url`,'URL รูปไม่ได้มาจาก VisionD origin ที่อนุญาต',{origin:parsed.origin}));
    }else{
      const route=parsed.pathname.match(/^\/api\/toys-center\/gallery\/(\d+)\/(\d+)$/),params=[...parsed.searchParams.entries()];
      const position=route?Number(route[2]):-1;
      const validRoute=route&&route[1]===String(productId)&&route[2]===String(position)&&position>=0&&position<=9;
      const validQuery=params.length===1&&params[0][0]==='v'&&/^[1-9]\d*$/.test(params[0][1]);
      if(!validRoute||!validQuery)errors.push(makeError('invalid_image_route',`${path}.url`,'URL รูปต้องผูกกับ product id, ตำแหน่ง 0–9 และ v ที่ถูกต้อง'));
      else{
        const identity=`${route[1]}:${route[2]}`;
        if(seen.identities.has(identity))errors.push(makeError('duplicate_image_identity',`${path}.url`,'ตำแหน่งรูป VisionD ซ้ำ แม้ URL หรือ version ต่างกัน'));
        seen.identities.add(identity);
      }
    }
    if(seen.urls.has(image.url))errors.push(makeError('duplicate_image',`${path}.url`,'URL รูปซ้ำ'));
    seen.urls.add(image.url);
    return parsed;
  }

  function validateHandoff(input,options={}){
    const errors=scanSensitiveKeys(input);
    const allowedOrigins=Array.isArray(options.allowedImageOrigins)&&options.allowedImageOrigins.length?options.allowedImageOrigins:DEFAULT_IMAGE_ORIGINS;
    if(!sameKeys(input,['schema','version','product','validation'])){
      errors.push(makeError('unexpected_shape','$','ไฟล์ต้องมีเฉพาะ schema, version, product และ validation ของ handoff v1'));
      return{ok:false,errors,value:null};
    }
    if(input.schema!==SCHEMA)errors.push(makeError('wrong_schema','$.schema',`ต้องเป็น ${SCHEMA}`));
    if(input.version!==VERSION)errors.push(makeError('wrong_version','$.version',`รองรับเฉพาะ version ${VERSION}`));
    if(!sameKeys(input.validation,['complete','missing']))errors.push(makeError('unexpected_shape','$.validation','validation ไม่ตรงกับ handoff v1'));
    else{
      if(input.validation.complete!==true)errors.push(makeError('incomplete','$.validation.complete','VisionD ระบุว่าข้อมูลยังไม่ครบ',{missing:Array.isArray(input.validation.missing)?input.validation.missing:[]}));
      if(!Array.isArray(input.validation.missing)||input.validation.missing.some(item=>typeof item!=='string'))errors.push(makeError('wrong_type','$.validation.missing','missing ต้องเป็นรายการข้อความ'));
      else if(input.validation.missing.length)errors.push(makeError('incomplete','$.validation.missing','ต้องแก้ missing fields ใน VisionD ก่อน'));
    }
    const product=input.product;
    if(!sameKeys(product,['visiond_product_id','page_1','page_2'])){
      errors.push(makeError('unexpected_shape','$.product','product ไม่ตรงกับ handoff v1'));
      return{ok:false,errors,value:null};
    }
    if(!finiteInteger(product.visiond_product_id,1))errors.push(makeError('invalid_value','$.product.visiond_product_id','VisionD product id ไม่ถูกต้อง'));
    const page1=product.page_1,page2=product.page_2;
    if(!sameKeys(page1,['images','name','sku','gtin']))errors.push(makeError('unexpected_shape','$.product.page_1','page_1 ไม่ตรงกับ handoff v1'));
    else{
      if(!nonEmpty(page1.name))errors.push(makeError('missing_required','$.product.page_1.name','ไม่มีชื่อสินค้า'));
      else if(page1.name.length>120)errors.push(makeError('title_too_long','$.product.page_1.name','ชื่อสินค้า Shopee ต้องไม่เกิน 120 ตัวอักษร',{length:page1.name.length,max:120}));
      if(!nonEmpty(page1.sku))errors.push(makeError('missing_required','$.product.page_1.sku','ไม่มี SKU'));
      if(!nonEmpty(page1.gtin))errors.push(makeError('missing_required','$.product.page_1.gtin','ไม่มี GTIN'));
      if(!Array.isArray(page1.images)||page1.images.length<1||page1.images.length>10)errors.push(makeError('invalid_image_count','$.product.page_1.images','รูปต้องมี 1–10 รูป'));
      else{
        const seen={urls:new Set(),identities:new Set()};
        page1.images.forEach((image,index)=>validateImage(image,index,product.visiond_product_id,allowedOrigins,errors,seen));
        const covers=page1.images.filter(image=>image&&image.cover===true);
        if(covers.length!==1)errors.push(makeError('invalid_cover','$.product.page_1.images','ต้องมีรูปปกหนึ่งรูปพอดี'));
        if(page1.images[0]?.cover!==true)errors.push(makeError('cover_order','$.product.page_1.images[0]','รูปปกต้องอยู่ลำดับแรก'));
      }
    }
    if(!sameKeys(page2,['category_path','brand','description','sales','shipping']))errors.push(makeError('unexpected_shape','$.product.page_2','page_2 ไม่ตรงกับ handoff v1'));
    else{
      if(!Array.isArray(page2.category_path)||page2.category_path.length!==CATEGORY_PATH.length||page2.category_path.some((item,index)=>item!==CATEGORY_PATH[index]))errors.push(makeError('wrong_category','$.product.page_2.category_path','หมวดหมู่ไม่ตรงกับหมวดที่ VisionD ล็อกไว้'));
      if(!nonEmpty(page2.brand))errors.push(makeError('missing_required','$.product.page_2.brand','ไม่มีแบรนด์'));
      if(!nonEmpty(page2.description))errors.push(makeError('missing_required','$.product.page_2.description','ไม่มีรายละเอียดสินค้า'));
      if(!sameKeys(page2.sales,['currency','price_minor','stock']))errors.push(makeError('unexpected_shape','$.product.page_2.sales','sales ไม่ตรงกับ handoff v1'));
      else{
        if(page2.sales.currency!=='THB')errors.push(makeError('unsupported_currency','$.product.page_2.sales.currency','รองรับเฉพาะ THB'));
        if(!finiteInteger(page2.sales.price_minor,1))errors.push(makeError('invalid_value','$.product.page_2.sales.price_minor','ราคาต้องเป็นจำนวนเต็มหน่วยย่อยที่มากกว่า 0'));
        if(!finiteInteger(page2.sales.stock,0))errors.push(makeError('invalid_value','$.product.page_2.sales.stock','สต็อกต้องเป็นจำนวนเต็มตั้งแต่ 0'));
      }
      if(!sameKeys(page2.shipping,['weight_g','width_mm','length_mm','height_mm']))errors.push(makeError('unexpected_shape','$.product.page_2.shipping','shipping ไม่ตรงกับ handoff v1'));
      else for(const key of['weight_g','width_mm','length_mm','height_mm'])if(!finiteInteger(page2.shipping[key],1))errors.push(makeError('invalid_value',`$.product.page_2.shipping.${key}`,`${key} ต้องเป็นจำนวนเต็มบวก`));
    }
    if(errors.length)return{ok:false,errors,value:null};
    return{ok:true,errors:[],value:structuredClone(input)};
  }

  const decimal=(integer,scale)=>{
    const places=String(scale).length-1,digits=String(integer).padStart(places+1,'0'),whole=digits.slice(0,-places),fraction=digits.slice(-places).replace(/0+$/,'');
    return fraction?`${whole}.${fraction}`:whole;
  };
  function page2FieldValues(handoff){
    const page=handoff.product.page_2;
    return{
      brand:page.brand,
      description:page.description,
      price:decimal(page.sales.price_minor,100),
      stock:String(page.sales.stock),
      weight:decimal(page.shipping.weight_g,1000),
      width:decimal(page.shipping.width_mm,10),
      length:decimal(page.shipping.length_mm,10),
      height:decimal(page.shipping.height_mm,10)
    };
  }

  function handoffFingerprint(handoff){
    const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:plainObject(value)?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value);
    return canonical(handoff);
  }

  scope.VisionDShopeeCore=Object.freeze({SCHEMA,VERSION,CATEGORY_PATH:Object.freeze([...CATEGORY_PATH]),DEFAULT_IMAGE_ORIGINS:Object.freeze([...DEFAULT_IMAGE_ORIGINS]),validateHandoff,page2FieldValues,handoffFingerprint,scanSensitiveKeys});
})(globalThis);
