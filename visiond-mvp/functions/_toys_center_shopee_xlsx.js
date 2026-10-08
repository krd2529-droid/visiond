// The seller supplies the Shopee workbook at export time. Never bundle or store its shop-bound metadata.
const decoder=new TextDecoder('utf-8',{fatal:true});
const encoder=new TextEncoder();
const TARGET='xl/worksheets/sheet2.xml';
const MAX_TEMPLATE_BYTES=2*1024*1024;
const MAX_SHEET_BYTES=1024*1024;
const ALLOWED_PARTS=new Set(['[Content_Types].xml','_rels/.rels','docProps/app.xml','docProps/core.xml','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/sharedStrings.xml','xl/theme/theme1.xml',...Array.from({length:7},(_,index)=>`xl/worksheets/sheet${index+1}.xml`)]);
const EXPECTED_HEADERS=['ps_category|0|0','ps_product_name|1|0','ps_product_description|1|0','ps_maximum_purchase_quantity|0|0','ps_maximum_purchase_quantity_start_date|0|0','ps_maximum_purchase_quantity_time_period|0|0','ps_maximum_purchase_quantity_end_date|0|0','ps_minimum_purchase_quantity|0|0','ps_sku_parent_short|0|0','et_title_variation_integration_no|0|0','et_title_variation_1|0|0','et_title_option_for_variation_1|0|0','et_title_image_per_variation|0|3','et_title_variation_2|0|0','et_title_option_for_variation_2|0|0','ps_price|1|1','ps_stock|0|1','ps_sku_short|0|0','ps_new_size_chart|0|1','et_title_size_chart|0|3','ps_gtin_code|0|0','ps_item_cover_image|0|3','ps_item_image_1|0|3','ps_item_image_2|0|3','ps_item_image_3|0|3','ps_item_image_4|0|3','ps_item_image_5|0|3','ps_item_image_6|0|3','ps_item_image_7|0|3','ps_item_image_8|0|3','ps_weight|0|1','ps_length|0|1','ps_width|0|1','ps_height|0|1','channel_id.7000|0|0','ps_product_pre_order_dts|0|1','et_title_reason|0|0'];

const xmlText=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ');
const textCell=(column,value)=>`<c r="${column}7" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
const numberCell=(column,value)=>`<c r="${column}7"><v>${value}</v></c>`;

function productRow(values){
  const cells=[];
  const text=(column,value)=>{if(value!==''&&value!==null&&value!==undefined)cells.push(textCell(column,value))};
  const number=(column,value)=>{if(value!==null&&value!==undefined)cells.push(numberCell(column,value))};
  number('A',values.categoryId);
  text('B',values.name);
  text('C',values.description);
  text('I',values.sku);
  number('P',values.price);
  number('Q',values.stock);
  text('R',values.sku);
  text('U',values.gtin);
  values.images.slice(0,9).forEach((url,index)=>text(['V','W','X','Y','Z','AA','AB','AC','AD'][index],url));
  number('AE',values.weightKg);
  number('AF',values.lengthCm);
  number('AG',values.widthCm);
  number('AH',values.heightCm);
  text('AI',values.standardDelivery);
  return `<row r="7" spans="1:37">${cells.join('')}</row>`;
}

function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return(crc^0xffffffff)>>>0}
function concat(...parts){const size=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length}return out}

function locateEntries(template){
  if(template.length<22||template.length>MAX_TEMPLATE_BYTES)throw new Error('ไฟล์เทมเพลต Shopee ต้องเป็น .xlsx ขนาดไม่เกิน 2 MB');
  const view=new DataView(template.buffer,template.byteOffset,template.byteLength);
  let end=-1;
  for(let i=template.length-22;i>=Math.max(0,template.length-65557);i--){if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===template.length){end=i;break}}
  if(end<0||view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0)throw new Error('โครงสร้างไฟล์ Excel ไม่ถูกต้อง');
  const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
  if(!count||count>100||offset+size!==end)throw new Error('โครงสร้างไฟล์ Excel ไม่ถูกต้อง');
  let cursor=offset;const entries=new Map();
  for(let i=0;i<count;i++){
    if(cursor+46>end||view.getUint32(cursor,true)!==0x02014b50)throw new Error('สารบัญไฟล์ Excel ไม่ถูกต้อง');
    const nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),recordLength=46+nameLength+extraLength+commentLength;
    if(cursor+recordLength>end)throw new Error('สารบัญไฟล์ Excel ไม่ถูกต้อง');
    const name=decoder.decode(template.subarray(cursor+46,cursor+46+nameLength));
    if(entries.has(name)||!ALLOWED_PARTS.has(name))throw new Error('เทมเพลต Excel มีไฟล์ที่ไม่รองรับ');
    entries.set(name,{name,centralOffset:cursor,compressedSize:view.getUint32(cursor+20,true),size:view.getUint32(cursor+24,true),method:view.getUint16(cursor+10,true),flags:view.getUint16(cursor+8,true),localOffset:view.getUint32(cursor+42,true)});
    cursor+=recordLength;
  }
  if(cursor!==end||!entries.has(TARGET)||!entries.has('xl/sharedStrings.xml')||!entries.has('xl/workbook.xml')||!entries.has('xl/_rels/workbook.xml.rels'))throw new Error('เทมเพลต Shopee ไม่ตรงรูปแบบที่รองรับ');
  return{view,end,count,size,offset,entries};
}

async function inflateEntry(template,archive,name){
  const entry=archive.entries.get(name);if(!entry||entry.size>MAX_SHEET_BYTES||![0,8].includes(entry.method)||entry.flags&1)throw new Error('เทมเพลต Shopee มีชีตที่ไม่รองรับ');
  const {view,offset}=archive,local=entry.localOffset;
  if(local+30>offset||view.getUint32(local,true)!==0x04034b50)throw new Error('ข้อมูลชีตสินค้าไม่ถูกต้อง');
  const dataStart=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
  if(dataStart+entry.compressedSize>offset)throw new Error('ข้อมูลชีตสินค้าไม่ครบ');
  const compressed=template.subarray(dataStart,dataStart+entry.compressedSize);
  if(entry.method===0){if(compressed.length!==entry.size)throw new Error('ขนาดชีตสินค้าไม่ถูกต้อง');return compressed}
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader=stream.getReader(),chunks=[];let length=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_SHEET_BYTES)throw new Error('ชีตสินค้าใน Excel ใหญ่เกินกำหนด');chunks.push(value)}}catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
  const bytes=concat(...chunks);
  if(bytes.length!==entry.size||bytes.length>MAX_SHEET_BYTES)throw new Error('ขนาดชีตสินค้าใน Excel ไม่ถูกต้อง');
  return bytes;
}

const unescapeXml=value=>value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,entity=>{const key=entity.slice(1,-1);return key==='amp'?'&':key==='lt'?'<':key==='gt'?'>':key==='quot'?'"':key==='apos'?"'":key.startsWith('#x')?String.fromCodePoint(parseInt(key.slice(2),16)):key.startsWith('#')?String.fromCodePoint(parseInt(key.slice(1),10)):entity});
function columnName(index){let name='';for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name}
async function assertTemplate(template,archive,xml){
  const workbook=decoder.decode(await inflateEntry(template,archive,'xl/workbook.xml'));
  const sheet=workbook.match(/<sheet\b[^>]*name="แบบฟอร์มการลงสินค้า"[^>]*r:id="([^"]+)"[^>]*>/);
  const relationships=decoder.decode(await inflateEntry(template,archive,'xl/_rels/workbook.xml.rels'));
  if(!sheet||!relationships.includes(`Id="${sheet[1]}" Target="worksheets/sheet2.xml"`))throw new Error('เลือกเทมเพลต Shopee ที่มีชีตแบบฟอร์มการลงสินค้าถูกต้อง');
  const sst=decoder.decode(await inflateEntry(template,archive,'xl/sharedStrings.xml'));
  const strings=[...sst.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(match=>[...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(part=>unescapeXml(part[1])).join(''));
  const first=xml.match(/<row\b[^>]*\br="1"[^>]*>([\s\S]*?)<\/row>/)?.[1];
  if(!first)throw new Error('หัวตาราง Shopee ไม่ครบ');
  const headers=new Map([...first.matchAll(/<c\b[^>]*\br="([A-Z]+)1"[^>]*>([\s\S]*?)<\/c>/g)].map(match=>[match[1],strings[Number(match[2].match(/<v>(\d+)<\/v>/)?.[1])]]));
  if(EXPECTED_HEADERS.some((expected,index)=>headers.get(columnName(index))!==expected))throw new Error('หัวคอลัมน์เทมเพลต Shopee ไม่ตรงกับไฟล์ตัวอย่าง');
  const second=xml.match(/<row\b[^>]*\br="2"[^>]*>([\s\S]*?)<\/row>/)?.[1];
  if(!second||!['A2','B2','C2','D2'].every(address=>second.includes(`r="${address}"`))||strings[Number(second.match(/<c\b[^>]*r="A2"[^>]*>[\s\S]*?<v>(\d+)<\/v>/)?.[1])]!=='basic')throw new Error('ข้อมูลกำกับเทมเพลต Shopee ไม่ครบ');
}

function normalizePane(xml){return xml.replace(/activePane="(top_left|top_right|bottom_left|bottom_right)"/g,(_,pane)=>`activePane="${pane.replace(/_([a-z])/g,(_,char)=>char.toUpperCase())}"`)}

async function assertNoExternalRelationships(template,archive){
  for(const name of archive.entries.keys())if(name.endsWith('.rels')){
    const xml=decoder.decode(await inflateEntry(template,archive,name));
    if(/\bTargetMode\s*=|&#(?:x[0-9a-f]+|\d+);|\bTarget\s*=\s*["'](?:[a-z][\w+.-]*:|\/\/)/i.test(xml))throw new Error('เทมเพลต Excel มีลิงก์ภายนอกหรือความสัมพันธ์ที่ไม่รองรับ');
  }
}
async function assertNoActiveFormulas(template,archive){
  const workbook=decoder.decode(await inflateEntry(template,archive,'xl/workbook.xml'));
  if(/<(?:[a-z_][\w.-]*:)?definedName(?:\s|>)/i.test(workbook))throw new Error('เทมเพลต Excel มีสูตรที่ไม่รองรับ');
  for(const name of archive.entries.keys())if(/^xl\/worksheets\/sheet\d+\.xml$/.test(name)){
    const xml=decoder.decode(await inflateEntry(template,archive,name));
    if(/<(?:[a-z_][\w.-]*:)?f(?:\s|>)/i.test(xml))throw new Error('เทมเพลต Excel มีสูตรที่ไม่รองรับ');
  }
}

function replaceEntry(archive,directory,name,bytes,localOffset){
  const entry=archive.entries.get(name),nameBytes=encoder.encode(name),crc=crc32(bytes),local=new Uint8Array(30+nameBytes.length),localView=new DataView(local.buffer);
  localView.setUint32(0,0x04034b50,true);localView.setUint16(4,20,true);localView.setUint16(26,nameBytes.length,true);localView.setUint32(14,crc,true);localView.setUint32(18,bytes.length,true);localView.setUint32(22,bytes.length,true);local.set(nameBytes,30);
  const central=new DataView(directory.buffer,directory.byteOffset,directory.byteLength),relative=entry.centralOffset-archive.offset;
  central.setUint16(relative+8,entry.flags&~8,true);central.setUint16(relative+10,0,true);central.setUint32(relative+16,crc,true);central.setUint32(relative+20,bytes.length,true);central.setUint32(relative+24,bytes.length,true);central.setUint32(relative+42,localOffset,true);
  return[local,bytes];
}

export async function makeShopeeWorkbook(source,values){
  const template=Uint8Array.from(source instanceof Uint8Array?source:new Uint8Array(source)),archive=locateEntries(template);
  await assertNoExternalRelationships(template,archive);
  await assertNoActiveFormulas(template,archive);
  let xml=decoder.decode(await inflateEntry(template,archive,TARGET));
  if(!xml.includes('</sheetData>')||!xml.includes('r="AK1"')||!xml.includes('r="D2"')||!xml.includes('r="AK6"')||/<row\b[^>]*\br="7"/.test(xml))throw new Error('เทมเพลต Shopee ไม่มีตำแหน่งแถว 7 ที่คาดไว้');
  await assertTemplate(template,archive,xml);
  xml=normalizePane(xml).replace(/<dimension\s+ref="[^"]*"/, '<dimension ref="A1:AK7"').replace('</sheetData>',`${productRow(values)}</sheetData>`);
  const replacements=new Map([[TARGET,encoder.encode(xml)]]);
  for(const name of archive.entries.keys())if(name!==TARGET&&/^xl\/worksheets\/sheet\d+\.xml$/.test(name)){
    const original=decoder.decode(await inflateEntry(template,archive,name)),normalized=normalizePane(original);
    if(normalized!==original)replacements.set(name,encoder.encode(normalized));
  }
  const directory=template.slice(archive.offset,archive.end),parts=[template.subarray(0,archive.offset)];let localOffset=archive.offset;
  for(const [name,bytes] of replacements){const [local,payload]=replaceEntry(archive,directory,name,bytes,localOffset);parts.push(local,payload);localOffset+=local.length+payload.length}
  const footer=template.slice(archive.end),footerView=new DataView(footer.buffer,footer.byteOffset,footer.byteLength);footerView.setUint32(12,directory.length,true);footerView.setUint32(16,localOffset,true);
  return concat(...parts,directory,footer);
}
