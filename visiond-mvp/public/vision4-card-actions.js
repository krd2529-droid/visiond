(()=>{
  const root=document.querySelector('#v3ReviewQueue');if(!root)return;
  const decorate=()=>root.querySelectorAll('.v3-review-draft').forEach(card=>{
    const id=card.querySelector('[data-v4-detail]')?.dataset.v4Detail;if(!id||card.dataset.manageReady)return;
    card.dataset.manageReady='1';const actions=card.querySelector('.v3-review-actions');if(!actions)return;
    const edit=document.createElement('a');edit.className='v4-edit-draft';edit.dataset.feature='V4-REVIEW-001';edit.href=`/vision4-edit.html?id=${encodeURIComponent(id)}`;edit.textContent='แก้ไข';
    const remove=document.createElement('button');remove.type='button';remove.className='v4-delete-draft';remove.dataset.feature='V4-REVIEW-001';remove.textContent='ลบการ์ด';
    remove.onclick=async()=>{const title=card.querySelector('b')?.textContent||'ตะกร้าร่าง';if(!confirm(`ยืนยันลบ “${title}” ออกจาก Vision 4?\nรายการจะย้ายเข้าถังขยะและกู้คืนได้ภายใน 30 วัน`))return;remove.disabled=true;const response=await fetch(`/api/admin/products/${id}`,{method:'DELETE'}),data=await response.json().catch(()=>({}));if(!response.ok){alert(data.error||'ลบการ์ดไม่สำเร็จ');remove.disabled=false;return}card.remove();alert('ลบการ์ดแล้ว และย้ายไปถังขยะ 30 วัน')};
    actions.prepend(edit);actions.append(remove);
  });
  document.head.insertAdjacentHTML('beforeend','<style>.v4-edit-draft{display:inline-flex;align-items:center;justify-content:center;padding:9px 13px;border:1px solid #078e87;border-radius:9px;background:#fff;color:#08756f;text-decoration:none;font-weight:900}.v4-delete-draft{border-color:#d33!important;background:#fff1f1!important;color:#a20d0d!important}</style>');
  new MutationObserver(decorate).observe(root,{childList:true,subtree:true});decorate();
})();
