const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});

// Maximum-security guest gate: unauthenticated visitors never reach an AI
// provider, database, session store, conversation history, or account context.
// The only permitted response is a fixed invitation to authenticate.
export async function onRequestPost(){
  return json({
    message:{
      role:'assistant',
      content:'กรุณาสมัครสมาชิกหรือเข้าสู่ระบบก่อนครับ จึงจะสามารถใช้งาน ELON AI ได้'
    },
    guest:true,
    login_required:true
  });
}
