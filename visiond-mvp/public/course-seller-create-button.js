let sellerCreateButton;

function syncSellerCreateButton(){
  if(typeof state==='undefined'||!state?.licenses)return;
  const hero=document.querySelector('.seller-hero');if(!hero)return;
  const available=state.licenses.find(item=>item.available&&item.editable),balance=Number(state.credit_balance)||0;
  if(!sellerCreateButton){
    sellerCreateButton=document.createElement('button');
    sellerCreateButton.type='button';
    sellerCreateButton.className='primary seller-create-credit-button';
    hero.append(sellerCreateButton);
  }
  sellerCreateButton.textContent=available?'+ สร้างตะกร้าคอร์ส (ใช้ 1 เครดิต)':'ซื้อเครดิตเพิ่ม';
  sellerCreateButton.onclick=()=>{
    if(!available){location.href='/product.html?slug=course-selling-rights-30-days';return}
    sellerCourseForm.elements.license_entitlement_id.value=available.entitlement_id;
    createPanel.hidden=false;
    createPanel.scrollIntoView({behavior:'smooth',block:'start'});
  };
  if(new URLSearchParams(location.search).get('create')==='1'&&available&&!createPanel.dataset.autoOpened){
    createPanel.dataset.autoOpened='1';sellerCreateButton.click();
  }
  sellerCreateButton.dataset.balance=String(balance);
}

sellerCourseForm.addEventListener('submit',event=>{
  const accepted=confirm('ยืนยันสร้างตะกร้าคอร์ส?\n\nเมื่อสร้างและอัปโหลดสำเร็จ ระบบจะหักเครดิตสิทธิ์ 1 แต้ม และเริ่มนับระยะเวลาแก้ไข 30 วัน\n\nหากสร้างไม่สำเร็จ ระบบจะไม่หักเครดิต ส่วนเครดิตที่ใช้สำเร็จแล้วจะไม่คืน');
  if(!accepted){event.preventDefault();event.stopImmediatePropagation()}
},true);

new MutationObserver(syncSellerCreateButton).observe(licenseList,{childList:true});
syncSellerCreateButton();
