(() => {
  const section=document.querySelector('#homepageFacebookVideo'),frame=document.querySelector('#homepageFacebookVideoFrame'),link=document.querySelector('#homepageFacebookVideoLink');
  if(!section||!frame||!link)return;
  section.dataset.feature='HOMEPAGE-VIDEO-001';
  fetch('/api/site-settings',{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject()).then(data=>{
    const raw=String(data.homepage_facebook_video_url||'').trim();
    if(!raw)return;
    const url=new URL(raw),host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||!(host==='fb.watch'||host==='facebook.com'||host.endsWith('.facebook.com')))return;
    link.href=url.href;
    const iframe=document.createElement('iframe');
    iframe.title='วิดีโอจากเพจ VisionD';iframe.loading='lazy';iframe.allow='autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';
    const isPost=/\/share\/p\/|\/posts\//i.test(url.pathname),plugin=isPost?'post.php':'video.php';
    iframe.src='https://www.facebook.com/plugins/'+plugin+'?href='+encodeURIComponent(url.href)+(isPost?'&show_text=true':'&show_text=false')+'&width=760';
    frame.replaceChildren(iframe);section.hidden=false;
  }).catch(()=>{});
})();
