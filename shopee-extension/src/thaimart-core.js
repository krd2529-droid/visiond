(function installVisionDThaiMartCore(scope){
  'use strict';

  const SCHEMA='visiond.thaimart-product-handoff';
  const VERSION=1;
  const PLATFORM='thaimart';
  const CATEGORY_PATH=['งานอดิเรกและของสะสม','โมเดลและของสะสม','โมเดล / บอร์ดเกม / การ์ดเกม'];
  const DEFAULT_IMAGE_ORIGINS=['https://visiondonline.com'];
  const SENSITIVE_KEY=/(?:^|_)(?:cost|password|passcode|session|token|secret|cookie|account|customer|order|payment|vault|image_2|meta_image|r2_key|image_key|brand|gtin|variant|video|status)(?:_|$)/i;
  const PROTOTYPE_KEYS=new Set(['__proto__','constructor','prototype']);
  const plainObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
  const sameKeys=(value,expected)=>plainObject(value)&&Object.keys(value).sort().join('\0')===[...expected].sort().join('\0');
  const finiteInteger=(value,min,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
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
        if(SENSITIVE_KEY.test(key))errors.push(makeError('private_field',next,'ไฟล์มีชื่อฟิลด์ที่ไม่อยู่ใน Thai Mart allowlist'));
        stack.push({value:entry,path:next,depth:current.depth+1});
      }
    }
    return errors;
  }

  function validateImage(image,index,productId,allowedOrigins,errors,seen){
    const path=`$.product.images[${index}]`;
    if(!sameKeys(image,['url','cover'])){errors.push(makeError('unexpected_shape',path,'โครงสร้างรูปไม่ตรงกับ Thai Mart handoff v1'));return}
    if(typeof image.cover!=='boolean')errors.push(makeError('wrong_type',`${path}.cover`,'cover ต้องเป็น boolean'));
    let parsed=null;try{parsed=new URL(image.url)}catch{}
    if(!parsed||parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash||parsed.port)errors.push(makeError('invalid_image_url',`${path}.url`,'URL รูปต้องเป็น HTTPS ที่ไม่มี credential หรือ fragment'));
    else if(!allowedOrigins.includes(parsed.origin))errors.push(makeError('untrusted_image_origin',`${path}.url`,'URL รูปไม่ได้มาจาก VisionD origin ที่อนุญาต',{origin:parsed.origin}));
    else{
      const route=parsed.pathname.match(/^\/api\/toys-center\/gallery\/(\d+)\/(\d+)$/),params=[...parsed.searchParams.entries()],position=route?Number(route[2]):-1;
      const validRoute=route&&route[1]===String(productId)&&route[2]===String(position)&&position>=0&&position<=9,validQuery=params.length===1&&params[0][0]==='v'&&/^[1-9]\d*$/.test(params[0][1]);
      if(!validRoute||!validQuery)errors.push(makeError('invalid_image_route',`${path}.url`,'URL รูปต้องผูกกับ product id, ตำแหน่ง 0–9 และ v ที่ถูกต้อง'));
      else{const identity=`${route[1]}:${route[2]}`;if(seen.identities.has(identity))errors.push(makeError('duplicate_image_identity',`${path}.url`,'ตำแหน่งรูป VisionD ซ้ำ'));seen.identities.add(identity)}
    }
    if(seen.urls.has(image.url))errors.push(makeError('duplicate_image',`${path}.url`,'URL รูปซ้ำ'));seen.urls.add(image.url);
  }

  function validateHandoff(input,options={}){
    const errors=scanSensitiveKeys(input),allowedOrigins=Array.isArray(options.allowedImageOrigins)&&options.allowedImageOrigins.length?options.allowedImageOrigins:DEFAULT_IMAGE_ORIGINS;
    if(!sameKeys(input,['schema','version','platform','product','validation'])){errors.push(makeError('unexpected_shape','$','ไฟล์ต้องมีเฉพาะ schema, version, platform, product และ validation'));return{ok:false,errors,value:null}}
    if(input.schema!==SCHEMA)errors.push(makeError('wrong_schema','$.schema',`ต้องเป็น ${SCHEMA}`));
    if(input.version!==VERSION)errors.push(makeError('wrong_version','$.version',`รองรับเฉพาะ version ${VERSION}`));
    if(input.platform!==PLATFORM)errors.push(makeError('wrong_platform','$.platform',`platform ต้องเป็น ${PLATFORM}`));
    if(!sameKeys(input.validation,['complete','missing']))errors.push(makeError('unexpected_shape','$.validation','validation ไม่ตรงกับ handoff v1'));
    else{
      if(input.validation.complete!==true)errors.push(makeError('incomplete','$.validation.complete','VisionD ระบุว่าข้อมูลยังไม่ครบ',{missing:Array.isArray(input.validation.missing)?input.validation.missing:[]}));
      if(!Array.isArray(input.validation.missing)||input.validation.missing.some(item=>typeof item!=='string'))errors.push(makeError('wrong_type','$.validation.missing','missing ต้องเป็นรายการข้อความ'));
      else if(input.validation.missing.length)errors.push(makeError('incomplete','$.validation.missing','ต้องแก้ missing fields ใน VisionD ก่อน'));
    }
    const product=input.product;
    if(!sameKeys(product,['visiond_product_id','category_path','images','name','description','sku','sales','shipping'])){errors.push(makeError('unexpected_shape','$.product','product ไม่ตรงกับ Thai Mart handoff v1'));return{ok:false,errors,value:null}}
    if(!finiteInteger(product.visiond_product_id,1))errors.push(makeError('invalid_value','$.product.visiond_product_id','VisionD product id ไม่ถูกต้อง'));
    if(!Array.isArray(product.category_path)||product.category_path.length!==CATEGORY_PATH.length||product.category_path.some((item,index)=>item!==CATEGORY_PATH[index]))errors.push(makeError('wrong_category','$.product.category_path','หมวดหมู่ไม่ตรงกับหมวด Thai Mart ที่ล็อกไว้'));
    if(typeof product.name!=='string'||product.name.trim().length<15||product.name.trim().length>255)errors.push(makeError('invalid_name','$.product.name','ชื่อสินค้าต้องยาว 15–255 ตัวอักษร'));
    if(typeof product.description!=='string'||!product.description.trim()||product.description.length>10000)errors.push(makeError('invalid_description','$.product.description','รายละเอียดต้องยาว 1–10,000 ตัวอักษร'));
    if(typeof product.sku!=='string'||product.sku.length>100)errors.push(makeError('invalid_sku','$.product.sku','SKU ต้องเป็น string ไม่เกิน 100 ตัวอักษร'));
    if(!Array.isArray(product.images)||product.images.length<1||product.images.length>9)errors.push(makeError('invalid_image_count','$.product.images','รูปต้องมี 1–9 รูป'));
    else{
      const seen={urls:new Set(),identities:new Set()};product.images.forEach((image,index)=>validateImage(image,index,product.visiond_product_id,allowedOrigins,errors,seen));
      const covers=product.images.filter(image=>image&&image.cover===true);if(covers.length!==1)errors.push(makeError('invalid_cover','$.product.images','ต้องมีรูปปกหนึ่งรูปพอดี'));if(product.images[0]?.cover!==true)errors.push(makeError('cover_order','$.product.images[0]','รูปปกต้องอยู่ลำดับแรก'));
    }
    if(!sameKeys(product.sales,['currency','price_thb','stock']))errors.push(makeError('unexpected_shape','$.product.sales','sales ไม่ตรงกับ handoff v1'));
    else{if(product.sales.currency!=='THB')errors.push(makeError('unsupported_currency','$.product.sales.currency','รองรับเฉพาะ THB'));if(!finiteInteger(product.sales.price_thb,1,100000))errors.push(makeError('invalid_price','$.product.sales.price_thb','ราคาต้องเป็นจำนวนเต็ม 1–100,000 บาท'));if(!finiteInteger(product.sales.stock,0,999999))errors.push(makeError('invalid_stock','$.product.sales.stock','สต็อกต้องเป็นจำนวนเต็ม 0–999,999'))}
    if(!sameKeys(product.shipping,['weight_g','dimensions_cm']))errors.push(makeError('unexpected_shape','$.product.shipping','shipping ไม่ตรงกับ handoff v1'));
    else{
      if(!finiteInteger(product.shipping.weight_g,1,50000))errors.push(makeError('invalid_weight','$.product.shipping.weight_g','น้ำหนักต้องเป็นจำนวนเต็ม 1–50,000 กรัม'));
      const dimensions=product.shipping.dimensions_cm;
      if(dimensions!==null){
        if(!sameKeys(dimensions,['width_cm','length_cm','height_cm']))errors.push(makeError('unexpected_shape','$.product.shipping.dimensions_cm','dimensions_cm ต้องเป็น null หรือ object ครบสามค่า'));
        else{
          const values=Object.values(dimensions);
          if(values.some(value=>!finiteInteger(value,1,150)))errors.push(makeError('invalid_dimensions','$.product.shipping.dimensions_cm','ขนาดแต่ละด้านต้องเป็นจำนวนเต็ม 1–150 ซม.'));
          else if(values.reduce((sum,value)=>sum+value,0)>280)errors.push(makeError('invalid_dimensions_sum','$.product.shipping.dimensions_cm','ผลรวมขนาดต้องไม่เกิน 280 ซม.'));
        }
      }
    }
    if(errors.length)return{ok:false,errors,value:null};
    return{ok:true,errors:[],value:structuredClone(input)};
  }

  function fieldValues(handoff){const product=handoff.product,dimensions=product.shipping.dimensions_cm;return{name:product.name,description:product.description,sku:product.sku,price:String(product.sales.price_thb),stock:String(product.sales.stock),weight:String(product.shipping.weight_g),width:dimensions?String(dimensions.width_cm):'',length:dimensions?String(dimensions.length_cm):'',height:dimensions?String(dimensions.height_cm):''}}
  function handoffFingerprint(handoff){const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:plainObject(value)?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value);return canonical(handoff)}

  scope.VisionDThaiMartCore=Object.freeze({SCHEMA,VERSION,PLATFORM,CATEGORY_PATH:Object.freeze([...CATEGORY_PATH]),DEFAULT_IMAGE_ORIGINS:Object.freeze([...DEFAULT_IMAGE_ORIGINS]),validateHandoff,fieldValues,handoffFingerprint,scanSensitiveKeys});
})(globalThis);
