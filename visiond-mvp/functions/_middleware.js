const securityHeaders={
  'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'strict-transport-security':'max-age=31536000; includeSubDomains',
  'content-security-policy':"default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' https://challenges.cloudflare.com https://connect.facebook.net; frame-src 'self' blob: https://challenges.cloudflare.com https://www.facebook.com; connect-src 'self' https://challenges.cloudflare.com https://connect.facebook.net https://www.facebook.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https://www.facebook.com"
};
export const VISION7_ADMIN_ENTRY='<a class="admin-tab-link vision7-key-link" href="/vision7-admin.html" data-vision7-admin-entry><span class="admin-tab-icon" aria-hidden="true">🔑</span><span>Vision 7<br>ออกคีย์</span></a>';
export const ADS_CENTER_ADMIN_ENTRY='<a class="admin-tab-link ads-center-link" href="/ads-center.html" data-ads-center-admin-entry><span class="admin-tab-icon" aria-hidden="true">📣</span><span>ศูนย์<br>โฆษณา</span></a>';
export const isAdminHtmlPath=pathname=>pathname==='/admin'||pathname==='/admin.html';
export const isVision7AdminHtmlPath=pathname=>pathname==='/vision7-admin'||pathname==='/vision7-admin.html';
const trustedMobileOrigins=new Set(['null','capacitor://localhost','http://localhost']);
const mobileMutationPaths=['/api/vision7/auth/veasy-activate','/api/vision7/auth/logout','/api/vision7/auth/veasy-device','/api/vision7/shops/','/api/vision7/runtime/'];
const isScopedMobileMutation=(pathname,origin)=>trustedMobileOrigins.has(origin||'')&&mobileMutationPaths.some(path=>pathname===path||pathname.startsWith(path));
export async function onRequest(ctx){
  const request=ctx.request,url=new URL(request.url),method=request.method.toUpperCase();
  if(url.pathname.startsWith('/api/')&&['POST','PUT','PATCH','DELETE'].includes(method)){
    const origin=request.headers.get('origin');
    if(origin&&!isScopedMobileMutation(url.pathname,origin)){
      let originUrl=null;try{originUrl=new URL(origin).origin}catch{}
      if(originUrl!==url.origin)return new Response(JSON.stringify({error:'คำขอจากเว็บไซต์อื่นถูกปฏิเสธ'}),{status:403,headers:{'content-type':'application/json'}});
    }
  }
  let response=await ctx.next();
  const responseType=String(response.headers.get('content-type')||'').toLowerCase();
  if(method==='GET'&&isAdminHtmlPath(url.pathname)&&responseType.includes('text/html')){
    response=new HTMLRewriter().on('.admin-tabs',{element(element){element.append(VISION7_ADMIN_ENTRY+ADS_CENTER_ADMIN_ENTRY,{html:true})}}).transform(response);
  }
  if(method==='GET'&&isVision7AdminHtmlPath(url.pathname)&&responseType.includes('text/html')){
    response=new HTMLRewriter().on('a[href="/ads-center.html"]',{element(element){element.remove()}}).transform(response);
  }
  const headers=new Headers(response.headers);
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
