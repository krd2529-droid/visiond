const zoneLabels={visiond:'VisionD / Shopee',meta:'Meta Catalog',group:'ลูกค้ากลุ่ม'};
const roots={visiond:'#zoneVisiond',meta:'#zoneMeta',group:'#zoneGroup'};
const limit={visiond:10,meta:10,group:10};

export function createStockZoneEditor({form,pipeline,selectLegacyCover,onState}){
  const zones={visiond:[],meta:[],group:[]},saved={visiond:[],meta:[],group:[]},ownedUrls={visiond:[],meta:[],group:[]},revisions={visiond:0,meta:0,group:0},uploadQueues={visiond:Promise.resolve(),meta:Promise.resolve(),group:Promise.resolve()};
  const pending=new Set();
  let coverRef='',mode='create';
  const node=selector=>document.querySelector(selector);
  const releaseUrls=zone=>{for(const key of zone?[zone]:Object.keys(ownedUrls)){for(const url of ownedUrls[key])URL.revokeObjectURL(url);ownedUrls[key]=[]}};
  const clone=item=>({...item});
  const reset=()=>{for(const zone of Object.keys(zones)){revisions[zone]++;zones[zone]=[];saved[zone]=[]}releaseUrls();coverRef='';mode='create';render()};
  const currentCover=()=>zones.visiond.find(item=>item.uid===coverRef)||zones.visiond[0]||null;
  const selectCover=(index,notifyLegacy=true)=>{const item=zones.visiond[index];if(!item)return;coverRef=item.uid;if(notifyLegacy)selectLegacyCover(index);render()};
  const ensureCover=()=>{if(!zones.visiond.some(item=>item.uid===coverRef))coverRef=zones.visiond[0]?.uid||'';if(mode==='create'&&zones.meta.length===0&&currentCover())zones.meta=[{...currentCover(),uid:crypto.randomUUID(),auto:true}];else if(mode==='create'&&zones.meta.length===1&&zones.meta[0].auto)zones.meta[0]={...currentCover(),uid:zones.meta[0].uid,auto:true}};
  const state=()=>{const issue=pending.size?'กำลังเตรียมรูป กรุณารอสักครู่':zones.visiond.length<1?'ต้องมีรูป VisionD อย่างน้อย 1 รูป':zones.meta.length!==1?'รูป Meta ต้องเหลือ 1 รูปก่อนบันทึก':Object.keys(zones).find(zone=>zones[zone].length>limit[zone])?'รูปในโซนเกิน 10 รูป':'';onState(issue);return issue};
  const render=()=>{
    ensureCover();
    for(const [zone,selector] of Object.entries(roots)){
      const root=node(selector);root.replaceChildren();
      for(const [index,item] of zones[zone].entries()){
        const card=document.createElement('article'),image=document.createElement('img'),label=document.createElement('span'),controls=document.createElement('div'),destination=document.createElement('select');card.className='stock-zone-card';image.src=item.url;image.alt=`รูป ${zoneLabels[zone]} ${index+1}`;label.className='stock-zone-active';label.textContent=zone==='visiond'&&item.uid===coverRef?'✓ รูปปก VisionD':zone==='meta'&&item.active?'รูป Meta ที่ใช้อยู่ (จนกดบันทึก)':'รูป '+(index+1);controls.className='stock-zone-card-controls';destination.setAttribute('aria-label','โซนปลายทาง');for(const target of Object.keys(zones)){if(target===zone)continue;const option=document.createElement('option');option.value=target;option.textContent=zoneLabels[target];destination.append(option)}
        const action=(text,callback,cls='vds-btn--tonal')=>{const button=document.createElement('button');button.type='button';button.className=`vds-btn ${cls} vds-btn--small`;button.textContent=text;button.onclick=callback;return button};
        if(zone==='visiond')controls.append(action(item.uid===coverRef?'รูปปกอยู่แล้ว':'ใช้เป็นรูปปก',()=>selectCover(index),'vds-btn--secondary'));
        controls.append(destination,action('ย้าย',()=>transfer(zone,index,destination.value,false)),action('คัดลอก',()=>transfer(zone,index,destination.value,true)),action('ลบ',()=>remove(zone,index),'vds-btn--danger'));
        card.append(image,label,controls);root.append(card);
      }
    }
    state();
  };
  const transfer=(source,index,target,copy)=>{if(!zones[target]||source===target)return;if(zones[target].length>=limit[target]){onState(`โซน ${zoneLabels[target]} เต็ม 10 รูป`);return}if(!copy&&source==='visiond'&&zones.visiond.length===1){onState('ย้ายรูป VisionD รูปสุดท้ายไม่ได้');return}const item=zones[source][index];if(!item)return;zones[target].push({...item,uid:copy?crypto.randomUUID():item.uid,auto:false,active:false});if(!copy)zones[source].splice(index,1);render()};
  const remove=(zone,index)=>{if(zone==='visiond'&&zones.visiond.length===1){onState('ลบรูป VisionD รูปสุดท้ายไม่ได้');return}zones[zone].splice(index,1);render()};
  const loadProduct=data=>{reset();mode='edit';for(const zone of Object.keys(zones)){zones[zone]=(data.zones?.[zone]||[]).map(item=>({uid:crypto.randomUUID(),ref:`${zone}:${item.id}`,url:item.url,active:item.active}));saved[zone]=zones[zone].map(clone)}coverRef=zones.visiond.find(item=>item.active)?.uid||zones.visiond[0]?.uid||'';render()};
  const loadDraft=data=>{reset();mode='draft';zones.visiond=Array.from({length:data.gallery_count},(_,index)=>({uid:crypto.randomUUID(),ref:`draft:visiond:${index}`,url:data.image_url(index)}));zones.meta=data.has_meta_upload?[{uid:crypto.randomUUID(),ref:'draft:meta:0',url:data.image_url('meta')}]:zones.visiond[data.cover_index]?[{...zones.visiond[data.cover_index],uid:crypto.randomUUID()}]:[];zones.group=Array.from({length:data.group_count||0},(_,index)=>({uid:crypto.randomUUID(),ref:`draft:group:${index}`,url:data.image_url(`group-${index}`)}));for(const zone of Object.keys(zones))saved[zone]=zones[zone].map(clone);coverRef=zones.visiond[data.cover_index]?.uid||zones.visiond[0]?.uid||'';render()};
  const syncUpload=async(zone,files,{replace=false}={})=>{const ticket=replace?++revisions[zone]:revisions[zone],job=Symbol(zone);pending.add(job);state();const apply=async()=>{const prepared=await Promise.all(files.map(file=>pipeline.resolveFile(file,zone==='visiond'?'image_1':zone==='meta'?'image_2':'image_3')));if(ticket!==revisions[zone])return;const existing=replace?[]:zones[zone];if(existing.length+prepared.length>limit[zone])throw new Error(`โซน ${zoneLabels[zone]} มีได้ไม่เกิน 10 รูป`);const uploaded=prepared.map(file=>{const url=URL.createObjectURL(file);ownedUrls[zone].push(url);return{uid:crypto.randomUUID(),ref:'upload',uploadZone:zone,uploadToken:crypto.randomUUID(),file,url,active:false}});zones[zone]=replace?files.length?uploaded:saved[zone].map(clone):[...existing,...uploaded];if(zone==='visiond'&&replace)coverRef=zones.visiond[0]?.uid||'';render()};const task=replace?apply():uploadQueues[zone].then(apply);if(!replace)uploadQueues[zone]=task.catch(()=>{});try{await task}finally{pending.delete(job);state()}};
  const useCoverForMeta=()=>{const cover=currentCover();if(!cover)return;const previous=zones.meta.find(item=>item.auto);if(previous)zones.meta.splice(zones.meta.indexOf(previous),1);zones.meta.push({...cover,uid:crypto.randomUUID(),auto:true,active:false});render()};
  const plan=({allowIncomplete=false}={})=>{const issue=state();if(issue&&(!allowIncomplete||zones.meta.length>1||pending.size))throw new Error(issue);return{visiond:zones.visiond.map(item=>item.ref),meta:zones.meta.map(item=>item.ref),group:zones.group.map(item=>item.ref),cover:Math.max(0,zones.visiond.findIndex(item=>item.uid===coverRef))}};
  const attachPlan=(payload,{allowIncomplete=false}={})=>{const draft=plan({allowIncomplete}),uploads=new Map(),names={visiond:'image_1',meta:'image_2',group:'image_3'},counters={visiond:0,meta:0,group:0};for(const name of Object.values(names))payload.delete(name);for(const zone of Object.keys(zones))draft[zone]=zones[zone].map(item=>{if(!item.file)return item.ref;let ref=uploads.get(item.uploadToken);if(!ref){const index=counters[item.uploadZone]++;ref=`upload:${item.uploadZone}:${index}`;uploads.set(item.uploadToken,ref);payload.append(names[item.uploadZone],item.file,item.file.name)}return ref});payload.set('zone_plan',JSON.stringify(draft));return draft};
  reset();return{reset,loadProduct,loadDraft,syncUpload,selectCover,useCoverForMeta,plan,attachPlan,get mode(){return mode},get zones(){return zones}};
}
