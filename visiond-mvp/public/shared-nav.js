import('/facebook-chat.js?v=01144');
document.addEventListener('DOMContentLoaded',()=>{
  const year=document.querySelector('[data-year]');
  if(year)year.textContent=new Date().getFullYear();
});
import('/nav-account.js?v=0819').then(module=>module.initAccountNav());
