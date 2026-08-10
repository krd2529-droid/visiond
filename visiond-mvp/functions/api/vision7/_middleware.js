const ALLOWED_PATHS=[
  '/api/vision7/auth/veasy-activate',
  '/api/vision7/auth/context',
  '/api/vision7/auth/me',
  '/api/vision7/auth/logout',
  '/api/vision7/auth/veasy-device',
  '/api/vision7/mobile-health',
  '/api/vision7/mobile-events',
  '/api/vision7/shops/',
  '/api/vision7/runtime/'
];
const ALLOWED_ORIGINS=new Set(['null','https://visiondonline.com','https://www.visiondonline.com','capacitor://localhost','http://localhost']);
const corsHeaders=request=>{
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(!ALLOWED_PATHS.some(path=>url.pathname===path||url.pathname.startsWith(path))||!origin||!ALLOWED_ORIGINS.has(origin))return null;
  return {
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers':'accept,authorization,content-type,idempotency-key,x-veasy-app-version,x-vision7-device-id',
    'access-control-max-age':'600',
    'vary':'Origin'
  };
};

export async function onRequest(ctx){
  const headers=corsHeaders(ctx.request);
  if(ctx.request.method==='OPTIONS')return headers?new Response(null,{status:204,headers}):new Response(null,{status:403,headers:{'cache-control':'no-store'}});
  const response=await ctx.next();
  if(!headers)return response;
  const output=new Response(response.body,response);
  for(const [key,value] of Object.entries(headers))output.headers.set(key,value);
  return output;
}
