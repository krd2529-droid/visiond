import {PHOTO_LIMITS,validatePhotoFiles,estimateAutoStrength,liftShadows,outputDimensions,outputName,withinOutputBudget} from './photo-exposure-core.js';
import {makeVeditZip} from './vedit-zip.js';

const $=selector=>document.querySelector(selector);
let entries=[],selected=0,previewVersion=0,runVersion=0,busy=false,zipBlob=null,selectionErrors=[];
const mode=()=>document.querySelector('input[name="mode"]:checked').value;
const status=(message,error=false)=>{const node=$('#status');node.textContent=message;node.style.color=error?'#ffbcad':'#a2e6c3'};
const clearCanvas=canvas=>{canvas.width=0;canvas.height=0};

function resetOutputs(){zipBlob=null;$('#downloadZip').disabled=true;for(const entry of entries)if(entry.state!=='ไม่รองรับ')entry.state='รอปรับ';renderList()}
function renderList(){const list=$('#fileList');list.replaceChildren();entries.forEach((entry,index)=>{const button=document.createElement('button'),name=document.createElement('span'),detail=document.createElement('small');button.type='button';button.className='file-row';button.disabled=busy;button.setAttribute('aria-pressed',String(index===selected));name.textContent=`${index+1}. ${entry.file.name}`;detail.textContent=`${entry.state} · ส่งออก ${entry.outputName}`;button.append(name,detail);button.onclick=()=>{selected=index;renderList();void preview()};list.append(button)})}
function showErrors(messages){$('#errors').replaceChildren(...messages.map(message=>{const item=document.createElement('li');item.textContent=message;return item}))}
function selectFiles(){if(busy)return;runVersion++;previewVersion++;const errors=[],accepted=[];let total=0;const incoming=Array.from($('#photos').files||[]);if(incoming.length>PHOTO_LIMITS.count){selectionErrors=['เลือกได้ไม่เกิน 24 รูปต่อรอบ กรุณาแบ่งชุด'];entries=[];zipBlob=null;$('#downloadZip').disabled=true;$('#process').disabled=true;clearCanvas($('#before'));clearCanvas($('#after'));showErrors(selectionErrors);renderList();status('จำนวนรูปเกินขอบเขต',true);return}
  for(const file of incoming){try{validatePhotoFiles([file]);if(total+file.size>PHOTO_LIMITS.totalBytes)throw new Error('ขนาดรวมเกิน 120 MB');total+=file.size;accepted.push(file)}catch(error){errors.push(`${file.name}: ${error.message}`)}}
  entries=accepted.map((file,index)=>({file,outputName:outputName(file.name,index),state:'รอปรับ'}));selectionErrors=errors;selected=0;zipBlob=null;$('#downloadZip').disabled=true;$('#process').disabled=!entries.length;clearCanvas($('#before'));clearCanvas($('#after'));showErrors(errors);renderList();status(entries.length?`พร้อมปรับ ${entries.length} รูป${errors.length?` · ข้าม ${errors.length} ไฟล์`:''}`:'ยังไม่มีรูปที่ใช้ได้',!entries.length);if(entries.length)void preview();
}
function setBusy(value){busy=value;for(const selector of ['#photos','#strength','#process','#downloadZip'])$(selector).disabled=value||selector==='#strength'&&mode()==='auto'||selector==='#process'&&!entries.length||selector==='#downloadZip'&&!zipBlob;for(const radio of document.querySelectorAll('input[name="mode"]'))radio.disabled=value;for(const button of $('#fileList').querySelectorAll('button'))button.disabled=value}
function drawPreview(target,source){const width=Math.min(840,source.width),scale=width/source.width;target.width=width;target.height=Math.max(1,Math.round(source.height*scale));target.getContext('2d').drawImage(source,0,0,target.width,target.height)}
async function correctedCanvas(file,{showPreview=false,ticket}={}){
  const bitmap=await createImageBitmap(file);
  try{
    if(ticket!==undefined&&ticket!==previewVersion)return null;
    const dimensions=outputDimensions(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=dimensions.width;canvas.height=dimensions.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    if(showPreview)drawPreview($('#before'),bitmap);
    const image=ctx.getImageData(0,0,canvas.width,canvas.height),strength=mode()==='auto'?estimateAutoStrength(image.data,canvas.width,canvas.height):Number($('#strength').value);
    liftShadows(image.data,strength);ctx.putImageData(image,0,0);
    if(showPreview){drawPreview($('#after'),canvas);$('#previewLabel').textContent=`${file.name} · ${mode()==='auto'?`อัตโนมัติ ${strength}%`:`กำหนดเอง ${strength}%`}`}
    return {canvas,strength};
  }finally{bitmap.close()}
}
async function preview(){const entry=entries[selected],ticket=++previewVersion;if(!entry)return;$('#previewLabel').textContent=`กำลังดูตัวอย่าง ${entry.file.name}…`;try{const result=await correctedCanvas(entry.file,{showPreview:true,ticket});if(ticket!==previewVersion)return;clearCanvas(result.canvas)}catch(error){if(ticket!==previewVersion)return;clearCanvas($('#before'));clearCanvas($('#after'));$('#previewLabel').textContent=`ดูตัวอย่าง ${entry.file.name} ไม่ได้: ${error.message}`}}
async function pngBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('แปลงภาพเป็น PNG ไม่สำเร็จ')),'image/png'))}
async function processAll(){if(busy||!entries.length)return;setBusy(true);const ticket=++runVersion,outputs=[],errors=[];let outputBytes=0;resetOutputs();
  try{for(let index=0;index<entries.length;index++){
    if(ticket!==runVersion)throw new Error('รายการรูปถูกเปลี่ยนระหว่างประมวลผล');
    const entry=entries[index];entry.state='กำลังปรับ';renderList();status(`กำลังปรับรูป ${index+1}/${entries.length}: ${entry.file.name}`);
    try{const result=await correctedCanvas(entry.file);if(ticket!==runVersion)throw new Error('รายการรูปถูกเปลี่ยน');let blob;try{blob=await pngBlob(result.canvas)}finally{clearCanvas(result.canvas)}if(blob.size>32*1024*1024)throw new Error('PNG ใหญ่เกิน 32 MB');if(!withinOutputBudget(outputBytes,blob.size)){for(let skipped=index;skipped<entries.length;skipped++){entries[skipped].state='ข้าม · ZIP รวมเกิน 160 MB';errors.push(`${entries[skipped].file.name}: ZIP รวมเกิน 160 MB กรุณาแบ่งชุด`)}renderList();break}outputBytes+=blob.size;outputs.push({name:entry.outputName,bytes:blob});entry.state=`เสร็จ · ${result.strength}%`}
    catch(error){entry.state='ผิดพลาด';errors.push(`${entry.file.name}: ${error.message}`)}
    renderList();
  }
  showErrors([...selectionErrors,...errors]);if(!outputs.length)throw new Error('ไม่มีรูปที่ปรับสำเร็จ');
  zipBlob=await makeVeditZip(outputs);$('#downloadZip').disabled=false;const size=zipBlob.size<1_000_000?`${Math.round(zipBlob.size/1024)} KB`:`${Math.round(zipBlob.size/1024/1024*10)/10} MB`;status(`ปรับสำเร็จ ${outputs.length}/${entries.length} รูป · ZIP ${size}${errors.length?` · ข้าม ${errors.length} รูป`:''}`);
  }catch(error){zipBlob=null;status(`สร้าง ZIP ไม่สำเร็จ: ${error.message}`,true)}finally{setBusy(false)}
}
function downloadZip(){if(!zipBlob)return;const url=URL.createObjectURL(zipBlob),link=document.createElement('a');link.href=url;link.download=`visiond-photo-exposure-${new Date().toISOString().slice(0,10)}.zip`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
async function init(){try{const response=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'}),data=await response.json().catch(()=>({}));if(!response.ok||!['boss','admin'].includes(data.user?.role)){$('#access').textContent='หน้านี้ใช้ได้เฉพาะ Boss และ Admin กรุณาเข้าสู่ระบบหลังบ้าน';return}$('#access').hidden=true;$('#workspace').hidden=false;$('#photos').onchange=selectFiles;for(const radio of document.querySelectorAll('input[name="mode"]'))radio.onchange=()=>{$('#strengthLabel').hidden=mode()==='auto';$('#strength').disabled=busy||mode()==='auto';resetOutputs();status('ระดับแสงเปลี่ยนแล้ว กรุณาปรับรูปทั้งหมดอีกครั้ง');void preview()};$('#strength').oninput=()=>{$('#strengthValue').value=`${$('#strength').value}%`;resetOutputs();status('ระดับแสงเปลี่ยนแล้ว กรุณาปรับรูปทั้งหมดอีกครั้ง');void preview()};$('#process').onclick=processAll;$('#downloadZip').onclick=downloadZip}catch{$('#access').textContent='ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาโหลดใหม่'}}
init();
