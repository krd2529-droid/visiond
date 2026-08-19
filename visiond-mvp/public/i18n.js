/* VisionD bilingual layer (TH/EN). Keeps one site, one cart and one account. */
(()=>{
  if(window.VisionDI18n)return;
  const KEY='visiond_language';
  const params=new URLSearchParams(location.search);
  const requested=params.get('lang');
  let saved='';try{saved=localStorage.getItem(KEY)||''}catch{}
  const country=(document.cookie.match(/(?:^|;\s*)vd_country=([A-Z]{2})(?:;|$)/)?.[1]||'').toUpperCase();
  const automatic=country?(country==='TH'?'th':'en'):(/^th\b/i.test(navigator.language||'')?'th':'en');
  let lang=requested==='en'||requested==='th'?requested:(saved||automatic);

  const exact={
    'หน้าแรก':'Home','สินค้าดิจิทัล':'Digital Products','เลือกซื้อสินค้า':'Shop Products','สินค้า':'Products',
    'คอร์สออนไลน์':'Online Courses','คอร์สเรียนออนไลน์':'Online Courses','โปรแกรมบอท':'AI Tools',
    'บทความ':'Articles','เกี่ยวกับเรา':'About Us','ติดต่อ':'Contact','ติดต่อ LINE':'Contact on LINE',
    'เข้าสู่ระบบ':'Log In','ออกจากระบบ':'Log Out','สมัครสมาชิก':'Create Account','บัญชีของฉัน':'My Account',
    'สินค้าของฉัน':'My Products','คอร์สของฉัน':'My Courses','รถเข็น':'Cart','ตะกร้า':'Cart',
    'แบบรอยสัก':'Tattoo Designs','ลายสัก':'Tattoo Designs','แบบระบายสี':'Coloring Pages',
    'แบบฝึกหัด':'Worksheets','เกมเสริมพัฒนาการ':'Learning Games','ทั้งหมด':'All',
    'พร้อมดาวน์โหลด':'Ready to Download','ใส่รถเข็น':'Add to Cart','อยู่ในรถเข็นแล้ว':'Already in Cart',
    'ดูรายละเอียด':'View Details','ซื้อสินค้า':'Buy Now','ดาวน์โหลด':'Download','ค้นหา':'Search',
    'ไม่พบสินค้า':'No products found','กำลังโหลด…':'Loading…','กำลังโหลดคอร์ส…':'Loading courses…',
    'กำลังเปิดแคตตาล็อก…':'Opening catalog…','กำลังโหลดรายการสินค้า กรุณารอสักครู่':'Loading products. Please wait.',
    'ชื่อ':'First name','นามสกุล':'Last name','ชื่อสมาชิก':'Member name','ชื่อผู้ใช้':'Username',
    'อีเมล':'Email','เบอร์โทรศัพท์':'Phone number','รหัสผ่าน':'Password','ยืนยันรหัสผ่าน':'Confirm password',
    'จำฉันไว้':'Remember me','ลืมรหัสผ่าน':'Forgot password?','สถานะ':'Status','กำลังใช้งาน':'Active',
    'เปิดบัญชีของฉัน':'Open My Account','สมาชิกทั่วไป':'Member','เจ้าของระบบ':'Owner','ผู้ดูแลระบบ':'Administrator',
    'ตะกร้าของฉัน':'My Cart','สรุปคำสั่งซื้อ':'Order Summary','ยอดรวม':'Total','ยอดสุทธิ':'Net Total',
    'ส่วนลด':'Discount','ชำระเงิน':'Checkout','ชำระเงินด้วยการโอน':'Pay by Bank Transfer',
    'อัปโหลดสลิป':'Upload Payment Slip','ยืนยันการชำระเงิน':'Confirm Payment','รออนุมัติ':'Pending Approval',
    'อนุมัติแล้ว':'Approved','ถูกปฏิเสธ':'Rejected','ลบ':'Remove','นำออก':'Remove','ย้อนกลับ':'Back',
    'หน้าก่อนหน้า':'Previous','หน้าถัดไป':'Next','รูปก่อนหน้า':'Previous image','รูปถัดไป':'Next image',
    'จำนวนรูปในชุด':'Images in this set','รูป':'images','ภาพ':'images','แผ่น':'pages','หน้า':'pages','ครั้ง':'views',
    'ราคา':'Price','บาท':'THB','ฟรี':'Free','หมวดหมู่':'Category','รายละเอียดสินค้า':'Product Details',
    'คำอธิบายสินค้า':'Product Description','ไฟล์ที่ได้รับ':'Files Included','ดูภาพตัวอย่าง':'View Previews',
    'สร้างบัญชีใหม่':'Create a New Account','มีบัญชีอยู่แล้ว':'Already have an account?',
    'ยังไม่มีบัญชี':'Don\'t have an account?','กำลังเข้าสู่ระบบ…':'Logging in…','กำลังสมัครสมาชิก…':'Creating account…',
    'ส่งคำขอตั้งรหัสผ่านใหม่':'Request Password Reset','กลับไปหน้าเข้าสู่ระบบ':'Back to Log In',
    'คอร์สทั้งหมด':'All Courses','ไปที่คอร์สของฉัน':'Go to My Courses','เลือกซื้อคอร์ส':'Browse Courses',
    'เริ่มเรียน':'Start Learning','เรียนต่อ':'Continue Learning','บทเรียน':'Lessons','กำลังเปิดห้องเรียน…':'Opening classroom…',
    'บทความที่เกี่ยวข้อง':'Related Articles','อ่านต่อ':'Read More','ดูทั้งหมด':'View All',
    'เกี่ยวกับ VisionD Online':'About VisionD Online','ติดต่อ VisionD Online':'Contact VisionD Online',
    'แคตตาล็อกสินค้าดิจิทัล':'Digital Product Catalog','จัดชุดส่วนลด':'Bundle Discount',
    'ยังไม่ได้เลือกสินค้า':'No products selected','ดูตะกร้าและชำระเงิน':'View Cart & Checkout',
    'เข้าชมวันนี้':'Views Today','7 วันล่าสุด':'Last 7 Days','30 วันล่าสุด':'Last 30 Days',
    'สถิติการเข้าชมเว็บไซต์':'Website visit statistics','ช่องทางติดต่อ VisionD':'Contact VisionD',
    'แชทเพจ':'Page Chat','เปิดแชท Facebook':'Open Facebook Chat','ปิด':'Close','ย่อ':'Minimize',
    'สวัสดีครับ 👋':'Hello 👋','ระบบจะเปิด Messenger หรือ Facebook ในแท็บใหม่':'Messenger or Facebook will open in a new tab.',
    'จัดการคอร์สออนไลน์':'Manage Online Courses','สร้างคอร์สใหม่':'Create New Course','คอร์สที่มีอยู่':'Existing Courses',
    'สร้างคอร์ส':'Create Course','เพิ่มบทเรียน':'Add Lesson','เปิดขายทันที':'Publish Immediately',
    'Control Center':'Control Center','ค้นหาสินค้า สมาชิก หรือคำสั่งซื้อ':'Search products, members, or orders',
    'บันทึก':'Save','แก้ไข':'Edit','ยกเลิก':'Cancel','เพิ่ม':'Add','สร้าง':'Create','รีเฟรช':'Refresh','สร้างชุดรวมตะกร้า':'Create Basket Bundle',
    'คำสั่งซื้อ':'Orders','สมาชิก':'Members','ยอดขาย':'Sales','ตั้งค่า':'Settings','เครื่องมือ':'Tools',
    'สินค้าดิจิทัลแนะนำ':'Recommended Digital Products','ดูสินค้าดิจิทัลทั้งหมด →':'View All Digital Products →'
  };
  const phrases=[
    ['คลังสินค้าดิจิทัลพร้อมใช้และดาวน์โหลด','Ready-to-Use Digital Product Library'],
    ['รวมไฟล์ดิจิทัลหลากหลายประเภท ทั้งแบบฝึกหัด เกมเสริมพัฒนาการ ภาพระบายสี แบบรอยสัก เอกสารและแบบฟอร์มพร้อมใช้ ดูตัวอย่างก่อนซื้อ แล้วดาวน์โหลดจากบัญชีสมาชิกได้หลังอนุมัติ','Discover worksheets, learning games, coloring pages, tattoo designs, documents, and ready-to-use templates. Preview before buying and download from your account after approval.'],
    ['แบบฝึกหัด','Worksheets'],['เกมเสริมพัฒนาการ','Learning Games'],['ภาพระบายสี','Coloring Pages'],['แบบรอยสัก','Tattoo Designs'],['เอกสารพร้อมใช้','Ready-to-Use Documents'],
    ['เลือกดูสินค้าดิจิทัล','Browse Digital Products'],['เลือกดูตามหมวดหมู่','Browse by Category'],
    ['รวมแบบรอยสักและลายสักหลายสไตล์ ทั้งมินิมอล ญี่ปุ่น ดุดัน วินเทจ สตรีท สัตว์ และลายยอดนิยม ดูภาพตัวอย่างก่อนซื้อ แล้วดาวน์โหลดไฟล์ PDF พร้อมใช้จากบัญชีสมาชิก','Explore tattoo designs in minimal, Japanese, bold, vintage, street, animal, and popular styles. Preview each collection before buying, then download the ready-to-use PDF from your account.'],
    ['ซื้อแล้วดาวน์โหลดจากหน้าสินค้า','Purchase and download from the product page'],
    ['สมัคร → สั่งซื้อ → ส่งสลิป → รออนุมัติ','Register → Order → Submit payment → Await approval'],
    ['แบบรอยสัก · ระบายสี · แบบฝึกหัด · เกมเสริมพัฒนาการ','Tattoo designs · Coloring pages · Worksheets · Learning games'],
    ['เรียน AI การตลาด และการสร้างรายได้','Learn AI, marketing, and monetization'],
    ['เครื่องมือช่วยทำงานและระบบอัตโนมัติ','Productivity tools and automation'],
    ['พื้นที่สำหรับเจ้าของคอร์สโดยเฉพาะ','A dedicated space for course owners'],
    ['สิทธิ์ลงขายคอร์สออนไลน์','Online Course Selling Right'],
    ['รับยอดขายเต็ม ไม่หัก %','Keep 100% of Your Sales'],
    ['เปิดพื้นที่ขายคอร์สของคุณบน VisionD จัดการเนื้อหา ตั้งราคา และรับเงินผ่านช่องทางของเจ้าของคอร์สเอง โดยไม่ปะปนกับคอร์สสำหรับผู้เรียน','Open your own course storefront on VisionD, manage content and pricing, and receive payments directly without mixing it with the learner course catalog.'],
    ['1 สิทธิ์ = 1 ตะกร้าคอร์ส','1 right = 1 course storefront'],
    ['แก้ไขเนื้อหาได้ 30 วัน','Edit content for 30 days'],
    ['เพิ่มวิดีโอและเอกสารราย EP','Add videos and files to each episode'],
    ['เงินเข้าช่องทางของเจ้าของคอร์ส','Payments go directly to the course owner'],
    ['VisionD ไม่หักเปอร์เซ็นต์ยอดขาย','VisionD takes no sales commission'],
    ['ดูรายละเอียดและซื้อสิทธิ์ →','View details and buy →'],
    ['ใส่รถเข็น','Add to Cart'],
    ['ดูสินค้า','View Product'],
    ['หมายเหตุ: ตะกร้านี้ไม่ร่วมโปรส่วนลดกับตะกร้าใด ๆ','Note: This product is excluded from all cart bundle discounts.'],
    ['พื้นที่สำหรับผู้เรียนโดยเฉพาะ รวมบทเรียนด้าน AI การสร้างคอนเทนต์ การตลาดออนไลน์ และการพัฒนาระบบดิจิทัล','A learner-only space for AI, content creation, online marketing, and digital systems courses.'],
    ['เลือกดูคอร์สเรียน','Browse Courses'],
    ['บทเรียน วิดีโอ เอกสาร และไฟล์ประกอบการเรียนจะรวมอยู่ในบัญชีของลูกค้า โดยไม่แสดงตะกร้าสิทธิ์ขายคอร์สในรายการนี้','Lessons, videos, documents, and course files stay in the learner account. Course-selling rights are not listed here.'],
    ['สอบถามก่อนสั่งซื้อได้ทุกหมวด','Ask us before purchasing'],
    ['สอบถามสินค้าดิจิทัล คอร์สเรียน สิทธิ์ลงขายคอร์สออนไลน์ หรือการใช้งานเว็บไซต์ ทีมงาน VisionD พร้อมช่วยตรวจสอบให้','Ask about digital products, online courses, course-selling rights, or using the website. VisionD is ready to help.'],
    ['ดูช่องทางติดต่อทั้งหมด','View all contact options'],
    ['คลังแบบรอยสักสำหรับค้นหาไอเดียและเตรียมงานลูกค้า','A tattoo design library for inspiration and client preparation'],
    ['VisionD รวบรวมไฟล์แบบรอยสักเป็นชุด แยกแนวและหัวข้อชัดเจน ช่างสักสามารถดูภาพตัวอย่างเพื่อเลือกชุดที่เหมาะกับงาน ก่อนซื้อไฟล์ PDF ฉบับเต็มไปใช้เป็นแนวทางร่างแบบ พูดคุยกับลูกค้า หรือพัฒนาลายต่อในสไตล์ของตนเอง','VisionD organizes tattoo designs into clearly labeled collections. Artists can preview each set before purchasing the full PDF to support sketching, client discussions, and original design development.'],
    ['เลือกประเภทสินค้าดิจิทัล','Browse Digital Product Categories'],
    ['ค้นหาไฟล์พร้อมใช้ตามงานที่ต้องการ ระบบรองรับการเพิ่ม แก้ไข และจัดเรียงหมวดในหลังบ้านภายหลัง','Find ready-to-use files for your project. Categories can be expanded and organized as the catalog grows.'],
    ['รวมบทเรียนด้าน AI การสร้างคอนเทนต์ การตลาดออนไลน์ และการพัฒนาระบบดิจิทัล เรียนตามเวลาได้จากบัญชีสมาชิก','Learn AI, content creation, online marketing, and digital systems at your own pace from your member account.'],
    ['บทเรียน วิดีโอ เอกสาร และไฟล์ประกอบการเรียนจะรวมอยู่ในบัญชีของลูกค้า','Lessons, videos, documents, and course files are stored in your account.'],
    ['โปรแกรมและเครื่องมือช่วยทำงาน เช่น ระบบสร้างไฟล์ดิจิทัล ระบบจัดคิวงาน และบอทอัตโนมัติสำหรับธุรกิจออนไลน์','Tools for digital-file creation, task scheduling, and online-business automation.'],
    ['ลูกค้าจะดูสิทธิ์ใช้งาน ดาวน์โหลดโปรแกรม และรับเวอร์ชันอัปเดตผ่านบัญชีของตนเอง','View licenses, download software, and receive updates from your account.'],
    ['แพลตฟอร์มสำหรับผู้ประกอบการ ครีเอเตอร์ และธุรกิจที่ต้องการสร้าง เรียนรู้ และทำงานด้วย AI','A platform for entrepreneurs, creators, and businesses building and working with AI.'],
    ['สร้างสินทรัพย์ดิจิทัล สื่อการตลาด และคอนเทนต์พร้อมใช้','Create digital assets, marketing materials, and ready-to-use content.'],
    ['เรียนรู้ AI การตลาด เว็บไซต์ และระบบอัตโนมัติ','Learn AI, marketing, websites, and automation.'],
    ['ใช้โปรแกรมบอทและ Workflow เพื่อลดงานซ้ำ','Use bots and workflows to reduce repetitive work.'],
    ['ซื้อและขายไฟล์ดิจิทัลผ่านระบบสมาชิก','Buy and sell digital files through a member system.'],
    ['ออกแบบเนื้อหาให้ Search Engine เข้าใจ','Structure content for search engines.'],
    ['จัดโครงสร้างข้อมูลให้ AI Search อ้างอิงได้ง่าย','Make content easier for AI search tools to understand and cite.'],
    ['สอบถามสินค้า คอร์ส โปรแกรมบอท หรือการใช้งานเว็บไซต์','Ask about products, courses, AI tools, or website use.'],
    ['ช่องทางหลักสำหรับสอบถามและรับการช่วยเหลือ','Our main support channel.'],
    ['ใช้สำหรับเอกสารทางธุรกิจและการติดต่ออย่างเป็นทางการ','For business documents and official correspondence.'],
    ['ติดตามคำสั่งซื้อ การดาวน์โหลด และปัญหาบัญชีสมาชิก','Get help with orders, downloads, and member accounts.'],
    ['เครื่องมือช่วยทำงาน ระบบอัตโนมัติ และโปรแกรมสำหรับธุรกิจดิจิทัล','Productivity tools, automation, and software for digital businesses.'],
    ['ผู้ช่วยจัดการคอนเทนต์ สินค้า และ Workflow ภายใน VisionD','Manage content, products, and VisionD workflows.'],
    ['รวมรูป จัดหน้า ทำปก และสร้างไฟล์ PDF พร้อมขาย','Combine images, create layouts and covers, and export sale-ready PDFs.'],
    ['สร้าง Prompt ตามประเภทงานและจัดเก็บเป็นคลัง','Create and organize prompts by project type.'],
    ['ช่วยเตรียมแคปชั่น คิวโพสต์ และเนื้อหาโซเชียล','Prepare captions, publishing queues, and social content.'],
    ['ช่วยจัดข้อมูลสินค้า คำอธิบาย และ SEO','Organize product data, descriptions, and SEO.'],
    ['ผู้ช่วย AI ประจำระบบสำหรับงานหลังบ้าน','An AI assistant for back-office operations.'],
    ['ใช้ไอดีสมาชิกหรืออีเมลที่สมัครกับ VisionD','Use your VisionD member ID or registered email.'],
    ['บัญชีของคุณใช้เก็บประวัติการซื้อ สินค้าที่ปลดล็อก คอร์สเรียน และสิทธิ์ใช้งานโปรแกรมบอทในที่เดียว','Your account keeps purchases, unlocked products, courses, and software licenses in one place.'],
    ['บัญชีใหม่จะเป็นระดับ User โดยอัตโนมัติ','New accounts are assigned the User role automatically.'],
    ['ยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว','I accept the Terms of Use and Privacy Policy.'],
    ['เลือกครบ 5/10/20/30 ตะกร้า รับส่วนลดเพิ่มอัตโนมัติ','Bundle 5, 10, 20, or 30 products to receive an automatic discount.'],
    ['สินค้าทั้งหมดเป็นไฟล์ดิจิทัล ไม่มีค่าจัดส่ง','All products are digital downloads. No shipping fees.'],
    ['โอนเงินตามยอดด้านบน แล้วแนบสลิปเพื่อให้แอดมินตรวจสอบ','Transfer the amount shown above, then upload your receipt for verification.'],
    ['หลังตรวจสอบสลิปแล้ว สินค้าจะปรากฏใน','After your payment is verified, the product will appear in'],
    ['และปุ่มซื้อจะเปลี่ยนเป็นเปิดใช้งานหรือดาวน์โหลด','and the purchase button will change to Open or Download.'],
    ['สิทธิ์เริ่มนับจากวันที่ Boss หรือ Admin อนุมัติสลิป','Membership starts when your payment is approved by the owner or an administrator.'],
    ['ขั้นตอนซื้อและรับไฟล์','How to Purchase and Receive Files'],
    ['เลือกสินค้าและสร้างคำสั่งซื้อ','Choose products and place an order.'],
    ['โอนเข้าบัญชีที่ร้านแจ้งและอัปโหลดสลิป','Transfer payment to the listed account and upload your receipt.'],
    ['รอ Admin ตรวจสอบและอนุมัติ','Wait for payment verification and approval.'],
    ['กลับไปหน้าสินค้าที่ซื้อเพื่อดาวน์โหลด','Return to the purchased product page to download.'],
    ['สินค้าที่ได้รับสิทธิ์จะแสดงที่นี่หลังออเดอร์ได้รับอนุมัติ','Unlocked products appear here after an order is approved.'],
    ['สอบถามสินค้า การชำระเงิน หรือแจ้งปัญหาการดาวน์โหลดกับเพจ VisionD ได้ที่นี่','Ask about products, payments, or download issues here.'],
    ['เลือกเรียนต่อจากคอร์สที่ซื้อและได้รับอนุมัติแล้ว','Continue any purchased and approved course.'],
    ['เรียนจากคลิปและสไลด์ PDF ระบบจำบทและเวลาเรียนล่าสุดให้โดยอัตโนมัติ','Learn with videos and PDF slides. Your latest lesson and progress are saved automatically.'],
    ['กรอกอีเมลที่ใช้สมัคร ระบบจะส่งขั้นตอนตั้งรหัสผ่านใหม่','Enter your registered email to receive password reset instructions.'],
    ['สิทธิ์ Member ดาวน์โหลดสินค้าทั้งหมวด รวมสินค้าใหม่ในอนาคต เลือกแพ็กเกจรายเดือนหรือรายปี','Membership includes downloads across a category, including future products. Choose a monthly or annual plan.'],
    ['เลือกได้สูงสุด 30 ตะกร้า','Select up to 30 products'],
    ['ครบ 30 ตะกร้า · รับส่วนลดสูงสุด 30% แล้ว','30 products selected · Maximum 30% discount applied'],
    ['โปรจัดชุดสินค้า เลือก 5 ถึง 30 ตะกร้า รับส่วนลดสูงสุด 30 เปอร์เซ็นต์','Bundle 5–30 products and save up to 30 percent'],
    ['กำลังไปหน้าเข้าสู่ระบบ…','Redirecting to login…'],
    ['กดที่นี่','Click here']
  ];
  const wordPairs=[
    ['ชุดรวม','Collection'],['ชุดที่','Set'],['ชุด','Set'],['แบบสัก','Tattoo Designs'],['รอยสัก','Tattoo'],
    ['ระบายสี','Coloring'],['ไดโนเสาร์','Dinosaurs'],['สัตว์','Animals'],['ดอกไม้','Flowers'],['มังกร','Dragon'],
    ['เสือ','Tiger'],['สิงโต','Lion'],['หมาป่า','Wolf'],['กะโหลก','Skull'],['ญี่ปุ่น','Japanese'],
    ['มินิมอล','Minimal'],['วินเทจ','Vintage'],['สำหรับเด็ก','for Kids'],['พร้อมใช้','Ready to Use'],
    ['กำลังโหลด','Loading'],['กรุณารอสักครู่','Please wait'],['กรุณา','Please'],['ไม่สำเร็จ','failed'],
    ['เรียบร้อยแล้ว','completed'],['ของฉัน','My'],['รายเดือน','Monthly'],['รายปี','Annual'],['ตลอดชีพ','Lifetime']
  ];
  const hasThai=s=>/[ก-๙]/.test(s);
  function translateString(value){
    if(lang!=='en'||!value||!hasThai(value))return value;
    const lead=value.match(/^\s*/)?.[0]||'',tail=value.match(/\s*$/)?.[0]||'';
    let s=value.trim();
    if(exact[s])return lead+exact[s]+tail;
    for(const [th,en] of phrases)s=s.split(th).join(en);
    for(const [th,en] of wordPairs)s=s.split(th).join(en);
    s=s.replace(/เลือกอีก\s*(\d+)\s*ตะกร้า\s*เพื่อรับส่วนลด\s*(\d+)%/g,'Add $1 more products to get $2% off');
    s=s.replace(/(\d+)\s*ตะกร้า/g,'$1 products').replace(/(\d+)\s*รูป/g,'$1 images').replace(/(\d+)\s*แผ่น/g,'$1 pages');
    s=s.replace(/ลด\s*(\d+)%/g,'Save $1%').replace(/ราคา\s*/g,'Price ').replace(/\s*บาท/g,' THB');
    return lead+(exact[s]||s)+tail;
  }
  function translateElement(root=document){
    if(lang!=='en')return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{
      const p=n.parentElement;
      return p&&!/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p.tagName)&&hasThai(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{n.nodeValue=translateString(n.nodeValue)});
    (root.querySelectorAll?root.querySelectorAll('[placeholder],[title],[aria-label],[alt],meta[content]'):[]).forEach(el=>{
      for(const a of ['placeholder','title','aria-label','alt','content'])if(el.hasAttribute(a))el.setAttribute(a,translateString(el.getAttribute(a)));
    });
    if(root.nodeType===1)for(const a of ['placeholder','title','aria-label','alt'])if(root.hasAttribute?.(a))root.setAttribute(a,translateString(root.getAttribute(a)));
  }
  function languageButton(){
    if(document.querySelector('[data-language-switcher]'))return;
    const host=document.querySelector('.topbar nav .nav-utility-group,.topbar nav,.learning-header,.topbar')||document.body;
    const wrap=document.createElement('span');wrap.className='vd-language-switcher';wrap.dataset.languageSwitcher='';wrap.dataset.feature='I18N-LANGUAGE-001';
    wrap.innerHTML=`<button type="button" data-lang="th" class="${lang==='th'?'active':''}" aria-label="ภาษาไทย">TH</button><i>|</i><button type="button" data-lang="en" class="${lang==='en'?'active':''}" aria-label="English">EN</button>`;
    host.append(wrap);
    window.VisionDSyncNavGroups?.();
    wrap.querySelectorAll('button').forEach(b=>b.onclick=()=>{
      localStorage.setItem(KEY,b.dataset.lang);
      const url=new URL(location.href);url.searchParams.set('lang',b.dataset.lang);location.href=url;
    });
  }
  const style=document.createElement('style');style.textContent='.vd-language-switcher{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border:1px solid rgba(7,125,119,.35);border-radius:999px;background:#fff;color:#476a67;white-space:nowrap}.vd-language-switcher button{appearance:none;border:0;background:transparent;color:inherit;padding:3px 5px;font:800 11px Arial;cursor:pointer}.vd-language-switcher button.active{border-radius:999px;background:#087d77;color:#fff}.vd-language-switcher i{font-style:normal;opacity:.35}';document.head.append(style);
  document.documentElement.lang=lang;
  document.documentElement.dataset.lang=lang;
  if(lang==='en'){
    const nativeAlert=window.alert.bind(window),nativeConfirm=window.confirm.bind(window);
    window.alert=message=>nativeAlert(translateString(String(message??'')));
    window.confirm=message=>nativeConfirm(translateString(String(message??'')));
  }
  const observer=new MutationObserver(records=>{if(lang!=='en')return;observer.disconnect();for(const r of records)for(const n of r.addedNodes){if(n.nodeType===1||n.nodeType===3)translateElement(n.nodeType===3?n.parentElement:n)}observer.observe(document.documentElement,{childList:true,subtree:true})});
  const start=()=>{translateElement();languageButton();observer.observe(document.documentElement,{childList:true,subtree:true});document.dispatchEvent(new CustomEvent('visiond:language',{detail:{lang}}))};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.VisionDI18n={get lang(){return lang},t:translateString,translate:translateElement};
})();
