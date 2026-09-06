export async function loadSourceAdapter(name){
  if(!name)return null;
  // จุดเสียบตัวอ่าน Affiliate Center จริงหลังได้รับบัญชีทดสอบใหม่
  throw new Error(`SOURCE_ADAPTER_NOT_AVAILABLE_${name}`);
}
