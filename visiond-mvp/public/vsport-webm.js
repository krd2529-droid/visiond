// Chrome MediaRecorder writes an unknown-size WebM Segment without Info/Duration.
// Patch only the bounded metadata header; Blob slices retain the video body.
const HEADER_LIMIT=65536;
const fail=()=>{throw new Error('WEBM_DURATION_HEADER_UNSUPPORTED: ไม่สามารถบันทึกวิดีโอที่เลื่อนเวลาได้ กรุณาลองเรนเดอร์ใหม่')};

function vint(bytes,offset,id=false){
  const first=bytes[offset];if(!first)return null;
  let width=1,marker=0x80;while(width<=8&&!(first&marker)){width++;marker>>=1}
  if(width>8||id&&width>4||offset+width>bytes.length)return null;
  if(!id&&(first&(marker-1))===marker-1&&Array.from(bytes.subarray(offset+1,offset+width)).every(byte=>byte===255))return{width,value:null,unknown:true};
  let value=id?first:first&(marker-1);for(let i=1;i<width;i++)value=value*256+bytes[offset+i];
  return Number.isSafeInteger(value)?{width,value,unknown:false}:null;
}

function element(bytes,offset){
  const id=vint(bytes,offset,true),size=id&&vint(bytes,offset+id.width);if(!id||!size)return null;
  const sizeOffset=offset+id.width,dataStart=sizeOffset+size.width;
  return{id:id.value,size:size.value,sizeWidth:size.width,sizeOffset,dataStart,end:size.unknown?null:dataStart+size.value,unknown:size.unknown};
}

function sizeBytes(value,width){
  if(!Number.isSafeInteger(value)||value<0||value>=2**(7*width)-1)fail();
  const bytes=new Uint8Array(width);let remaining=value;
  for(let i=width-1;i>=0;i--){bytes[i]=remaining&255;remaining=Math.floor(remaining/256)}
  bytes[0]|=1<<(8-width);return bytes;
}

function uint(bytes,row){
  if(!row||row.unknown||row.end>bytes.length||row.size<1||row.size>8)fail();
  let value=0;for(let i=row.dataStart;i<row.end;i++)value=value*256+bytes[i];
  if(!Number.isSafeInteger(value)||value<=0)fail();return value;
}

export async function withFiniteWebmDuration(blob,durationSeconds){
  if(!(blob instanceof Blob)||!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>2101||blob.size<512)fail();
  const head=new Uint8Array(await blob.slice(0,HEADER_LIMIT).arrayBuffer()),ebml=element(head,0);
  if(ebml?.id!==0x1a45dfa3||ebml.end>head.length)fail();
  const segment=element(head,ebml.end);if(segment?.id!==0x18538067||!segment.unknown)fail();
  let info=null,at=segment.dataStart;
  while(at<head.length){const row=element(head,at);if(!row)fail();if(row.id===0x1f43b675)break;if(row.id===0x114d9b74||row.id===0x1c53bb6b||row.unknown||row.end>head.length)fail();if(row.id===0x1549a966){if(info)fail();info=row}at=row.end}
  if(!info)fail();
  let scale=1000000,duration=null;at=info.dataStart;
  while(at<info.end){const row=element(head,at);if(!row||row.unknown||row.end>info.end||row.id===0xbf)fail();if(row.id===0x2ad7b1)scale=uint(head,row);if(row.id===0x4489){if(duration||row.size!==8)fail();duration=row}at=row.end}
  if(at!==info.end)fail();
  const ticks=durationSeconds*1e9/scale;if(!Number.isFinite(ticks)||ticks<=0)fail();
  const data=new Uint8Array(8);new DataView(data.buffer).setFloat64(0,ticks,false);
  if(duration)return new Blob([blob.slice(0,duration.dataStart),data,blob.slice(duration.end)],{type:blob.type});
  const added=new Uint8Array(11);added.set([0x44,0x89,0x88]);added.set(data,3);
  const resized=sizeBytes(info.size+added.length,info.sizeWidth);
  return new Blob([blob.slice(0,info.sizeOffset),resized,blob.slice(info.dataStart,info.end),added,blob.slice(info.end)],{type:blob.type});
}
