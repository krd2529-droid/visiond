export const COURSE_PLANS={
  rights:{code:'rights',number:1,label:'ซื้อสิทธิ์ 499 บาท',maxCourses:null,maxEpisodes:200,requiresCredit:true,paymentOwner:'seller',teacherPercent:100,visiondPercent:0,apiFee:0},
  partner:{code:'partner',number:2,label:'พาร์ตเนอร์ 50/50',maxCourses:null,maxEpisodes:200,requiresCredit:false,paymentOwner:'visiond',teacherPercent:50,visiondPercent:50,apiFee:100},
};
// คอร์ส free เดิมอ่านด้วยกติกาผู้สอนรับ 100% ต่อไป แต่ห้ามใช้สร้างคอร์สใหม่
export const coursePlan=value=>String(value||'rights')==='free'?COURSE_PLANS.rights:COURSE_PLANS[String(value||'rights')]||null;
export function courseRevenue(planCode,total){const plan=coursePlan(planCode)||COURSE_PLANS.rights,amount=Math.max(0,Math.round(Number(total)||0));if(plan.code!=='partner')return{teacher:amount,visiond:0,apiFee:0};const half=Math.floor(amount/2),fee=Math.min(plan.apiFee,half);return{teacher:half-fee,visiond:amount-half,apiFee:fee}}
