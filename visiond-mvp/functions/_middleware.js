const securityHeaders={
  'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'strict-transport-security':'max-age=31536000; includeSubDomains',
  'content-security-policy':"default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' https://challenges.cloudflare.com https://connect.facebook.net; frame-src 'self' blob: https://challenges.cloudflare.com https://www.facebook.com; connect-src 'self' https://challenges.cloudflare.com https://connect.facebook.net https://www.facebook.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https://www.facebook.com"
};
export async function onRequest(ctx){
  const request=ctx.request,url=new URL(request.url),method=request.method.toUpperCase();
  if(url.pathname.startsWith('/api/')&&['POST','PUT','PATCH','DELETE'].includes(method)){
    const origin=request.headers.get('origin');
    if(origin&&new URL(origin).origin!==url.origin)return new Response(JSON.stringify({error:'คำขอจากเว็บไซต์อื่นถูกปฏิเสธ'}),{status:403,headers:{'content-type':'application/json'}});
  }
  const response=await ctx.next(),headers=new Headers(response.headers);
  for(const [key,value] of Object.entries(securityHeaders))headers.set(key,value);
  headers.set('x-frame-options','SAMEORIGIN');
  if(url.pathname.startsWith('/api/'))headers.set('cache-control','private, no-store');
  const country=String(request.cf?.country||request.headers.get('cf-ipcountry')||'').toUpperCase();
  const cookies=request.headers.get('cookie')||'';
  const isHtml=(request.headers.get('accept')||'').includes('text/html');
  if(isHtml&&/^[A-Z]{2}$/.test(country)&&!cookies.includes(`vd_country=${country}`)){
    headers.append('set-cookie',`vd_country=${country}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`);
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
