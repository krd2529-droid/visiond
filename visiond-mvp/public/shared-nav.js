import('/facebook-chat.js?v=01195');
document.addEventListener('DOMContentLoaded',()=>{
  const year=document.querySelector('[data-year]');
  if(year)year.textContent=new Date().getFullYear();
});
import('/nav-account.js?v=01408').then(module=>module.initAccountNav());
import('/i18n.js?v=01331');
