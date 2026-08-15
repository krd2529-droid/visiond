(async()=>{
  try{
    const response=await fetch('/api/auth/me',{cache:'no-store'});
    if(!response.ok)return;
    const {user}=await response.json();
    if(!user?.is_course_owner)return;
    const sidebar=document.querySelector('#dashIdentity');
    if(sidebar&&!sidebar.parentElement.querySelector('.member-course-owner-badge')){
      const badge=document.createElement('a');
      badge.className='course-owner-badge member-course-owner-badge';
      badge.href='/course-center';
      badge.textContent='เจ้าของคอร์ส';
      sidebar.insertAdjacentElement('afterend',badge);
    }
    const homeMember=document.querySelector('#navMember');
    if(homeMember&&!homeMember.querySelector('.course-owner-badge')){
      const badge=document.createElement('span');
      badge.className='course-owner-badge';
      badge.textContent='เจ้าของคอร์ส';
      homeMember.append(' ',badge);
    }
  }catch(error){console.warn('course owner badge unavailable',error)}
})();
