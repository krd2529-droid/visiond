(function installThaiMartSelectorConfig(scope){
  'use strict';
  scope.VisionDThaiMartSelectors=Object.freeze({
    evidence:{frozenAt:'2026-09-16',source:'.agents/reports/jarvis-thaimart-live-form-evidence-20260916.md',page:'authenticated-read-only'},
    target:{origin:'https://seller.thaimart.com',host:'seller.thaimart.com',path:'/products/create'},
    category:{labels:['หมวดหมู่สินค้า','หมวดหมู่'],path:['งานอดิเรกและของสะสม','โมเดลและของสะสม','โมเดล / บอร์ดเกม / การ์ดเกม']},
    gallery:{sectionLabels:['รูปสินค้า'],excludedSectionText:['รายละเอียดสินค้า','วิดีโอสินค้า','คลังสื่อ'],capacity:9,allowedAccept:/image\/(?:jpeg|png)|\.jpe?g|\.png/i},
    description:{labels:['รายละเอียดสินค้า'],selector:'div[contenteditable="true"]'},
    fields:{name:'input[name="name"]',price:'input[name="price"]',stock:'input[name="quantity"]',sku:'input[name="sku"]',weight:'input[name="weight"]',width:'input[name="dimensions.width"]',length:'input[name="dimensions.length"]',height:'input[name="dimensions.height"]'},
    forbidden:{testIds:['product-form-save-button','product-form-cancel-button'],text:['บันทึก','ยกเลิก','นำเข้าสินค้า','เผยแพร่สินค้า','ยืนยัน','ถัดไป','save','cancel','submit','publish','confirm','next'],fieldNames:['variants','status','published','video']}
  });
})(globalThis);
