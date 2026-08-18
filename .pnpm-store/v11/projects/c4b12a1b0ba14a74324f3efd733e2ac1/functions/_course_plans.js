export const COURSE_PLANS={
  partner:{code:'partner',number:1,label:'พาร์ตเนอร์ 50/50',maxCourses:null,maxEpisodes:200,requiresCredit:false,paymentOwner:'visiond',teacherPercent:50,visiondPercent:50,apiFee:100},
};
const LEGACY_RIGHTS={code:'rights',number:0,label:'แผนซื้อสิทธิ์เดิม (ปิดรับใหม่)',maxCourses:null,maxEpisodes:200,requiresCredit:true,paymentOwner:'seller',teacherPercent:100,visiondPercent:0,apiFee:0};
// อ่านคอร์ส rights/free เดิมได้เพื่อไม่ทำลายสิทธิ์และประวัติ แต่สร้างใหม่ได้เฉพาะ partner
export const coursePlan=value=>{
  const code=String(value||'');
  if(['rights','free'].includes(code)) return LEGACY_RIGHTS;
  return COURSE_PLANS[code]||null;
};
export function courseRevenue(planCode,total){const plan=coursePlan(planCode)||LEGACY_RIGHTS,amount=Math.max(0,Math.round(Number(total)||0));if(plan.code!=='partner')return{teacher:amount,visiond:0,apiFee:0};const half=Math.floor(amount/2),fee=Math.min(plan.apiFee,half);return{teacher:half-fee,visiond:amount-half,apiFee:fee}}
