import fs from 'node:fs';
const capture=JSON.parse(fs.readFileSync('source-captures/elon-page-vision7-v1.json','utf8'));
const ledger=JSON.parse(fs.readFileSync('requirements-ledger.json','utf8'));
const errors=[],sourceIds=new Set(),requirementIds=new Set((ledger.requirements||[]).map(x=>x.id)),mapped=new Set();
if(capture.intake_complete!==true)errors.push('Source capture ยังไม่ยืนยัน intake_complete');
for(const item of capture.items||[]){
  if(!item.source_id||sourceIds.has(item.source_id))errors.push(`source_id ซ้ำหรือว่าง: ${item.source_id}`);sourceIds.add(item.source_id);
  if(item.atomic!==true||!item.text?.trim()||!item.acceptance?.trim())errors.push(`คำสั่งต้นทางไม่เป็น atomic/รายละเอียดไม่ครบ: ${item.source_id}`);
  if(!requirementIds.has(item.requirement_id))errors.push(`คำสั่งไม่มีปลายทางใน Ledger: ${item.source_id} -> ${item.requirement_id}`);
  if(mapped.has(item.requirement_id))errors.push(`หลายคำสั่งถูกรวมใน Requirement เดียว: ${item.requirement_id}`);mapped.add(item.requirement_id);
}
for(const id of requirementIds)if(!mapped.has(id))errors.push(`Requirement ไม่มีคำสั่งต้นทาง: ${id}`);
console.log(`SOURCE-TO-LEDGER: source=${sourceIds.size} ledger=${requirementIds.size} mapped=${mapped.size} missing=${errors.length}`);
for(const error of errors)console.error('SOURCE RECHECK FAIL',error);
if(errors.length)process.exit(1);
