// Inspect the bounded WebM header before accepting a multipart upload. MediaRecorder
// writes the EBML/Segment/Tracks header ahead of its first Cluster.
const readVint=(bytes,offset,id=false)=>{
  if(offset>=bytes.length)return null;
  const first=bytes[offset];if(!first)return null;
  let width=1,mask=0x80;while(width<=8&&!(first&mask)){width++;mask>>=1}
  if(width>8||id&&width>4||offset+width>bytes.length)return null;
  if(!id&&(first&(mask-1))===mask-1&&Array.from(bytes.subarray(offset+1,offset+width)).every(value=>value===255))return{value:null,width,unknown:true};
  let value=id?first:first&(mask-1);for(let i=1;i<width;i++)value=value*256+bytes[offset+i];
  if(!Number.isSafeInteger(value))return null;
  return{value,width,unknown:false};
};
const elements=(bytes,start,end,{segmentWindow=false}={})=>{
  const out=[];let at=start;
  while(at<end){const id=readVint(bytes,at,true);if(!id)return null;if(segmentWindow&&id.value===0x1f43b675)break;const size=readVint(bytes,at+id.width);if(!size)return null;const data=at+id.width+size.width,rawEnd=size.unknown?end:data+size.value,to=id.value===0x18538067?Math.min(rawEnd,end):rawEnd;if(to>end||to<data)return null;out.push({id:id.value,start:data,end:to,unknown:size.unknown});at=to;if(size.unknown)break}
  return out;
};
const find=(rows,id)=>rows?.find(row=>row.id===id);
const text=(bytes,row)=>row?new TextDecoder().decode(bytes.subarray(row.start,row.end)):'';
const uint=(bytes,row)=>{if(!row||row.end-row.start<1||row.end-row.start>4)return null;let value=0;for(let at=row.start;at<row.end;at++)value=value*256+bytes[at];return value};

export function isSilentVideoWebm(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length<64)return false;
  // Only inspect the leading header. A Cluster may be much larger than this window.
  const window=bytes.subarray(0,Math.min(bytes.length,65536)),root=elements(window,0,window.length);
  if(!root)return false;
  const ebml=find(root,0x1a45dfa3),segment=find(root,0x18538067);if(!ebml||!segment)return false;
  const ebmlRows=elements(window,ebml.start,ebml.end);if(text(window,find(ebmlRows,0x4282))!=='webm')return false;
  const segmentRows=elements(window,segment.start,segment.end,{segmentWindow:true});if(!segmentRows)return false;
  const tracks=find(segmentRows,0x1654ae6b);if(!tracks)return false;
  const entries=elements(window,tracks.start,tracks.end);if(!entries||entries.length!==1||entries[0].id!==0xae)return false;
  const fields=elements(window,entries[0].start,entries[0].end);if(!fields||uint(window,find(fields,0x83))!==1)return false;
  return /^V_(?:VP8|VP9|AV1)$/u.test(text(window,find(fields,0x86)));
}
