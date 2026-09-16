(function installSelectorConfig(scope){
  'use strict';

  const config={
    evidence:{
      frozenAt:'2026-09-16',
      source:'.agents/reports/jarvis-shopee-extension-dom-evidence-20260916.md',
      page1:'authenticated-read-only',
      page2:'user-supplied-labels-only'
    },
    target:{
      host:'seller.shopee.co.th',
      path:'/portal/product/new'
    },
    page1:{
      imageInput:'input[type="file"][name="file"][multiple][accept="image/*"][aspect="1"]',
      imageSectionText:'เพิ่มรูปภาพ',
      imageCapacityPattern:/เพิ่มรูปภาพ\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/,
      titleContainer:'.product-edit-form-item[data-product-edit-field-unique-id="name"]',
      titlePlaceholder:'ชื่อแบรนด์ + ประเภทสินค้า + คุณสมบัติหลัก (วัสดุ สี ขนาด รุ่น)',
      skuLabels:['รหัสสินค้า'],
      gtinLabels:['GTIN'],
      gtinPlaceholder:'โปรดกรอกรหัสผลิตภัณฑ์สากลเพื่อระบุ Shopee Standard Product',
      excludedSectionText:['Shopee Standard Product']
    },
    page2:{
      categoryLabels:['หมวดหมู่'],
      sellerSkuLabels:['รหัส SKU','SKU ผู้ขาย','รหัสสินค้า (SKU)'],
      brandLabels:['แบรนด์'],
      descriptionLabels:['รายละเอียดสินค้า','คำอธิบายสินค้า'],
      priceLabels:['ราคา'],
      stockLabels:['คลังสินค้า','จำนวนสินค้า','สต็อก'],
      weightLabels:['น้ำหนักสินค้า','น้ำหนัก'],
      widthLabels:['ความกว้าง'],
      lengthLabels:['ความยาว'],
      heightLabels:['ความสูง']
    },
    forbiddenActions:['ยกเลิก','ขั้นตอนต่อไป','บันทึก','เผยแพร่','ยืนยัน','submit','publish','save']
  };

  scope.VisionDShopeeSelectors=Object.freeze(config);
})(globalThis);
