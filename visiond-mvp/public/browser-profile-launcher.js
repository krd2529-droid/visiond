(() => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const intents = new Set(["view", "tiktok", "shop"]);
  const validUuid = (value) => uuidPattern.test(String(value || ""));

  function createVisionDBrowserLauncher({ cryptoApi, invoke, setStatus, storage, getOwnerId }) {
    let locked = false;
    const pendingKey=()=>{const owner=String(getOwnerId?.()||"");return /^\d+$/.test(owner)?`visiond_browser_launcher_pending:${owner}`:""};
    const readPending=()=>{try{const key=pendingKey(),value=key?storage?.getItem(key)||"":"";return validUuid(value)?value:""}catch{return""}};
    const rememberPending=(slotId)=>{try{const key=pendingKey();if(!key)return false;storage?.setItem(key,slotId);return true}catch{return false}};
    const clearPending=(slotId)=>{try{const key=pendingKey();if(key&&(!slotId||readPending()===slotId))storage?.removeItem(key)}catch{}};
    const run = (uri, success) => {
      if (locked) return false;
      locked = true;
      try {
        invoke(uri);
        setStatus(`${success} การเปิดโปรไฟล์ไม่ได้เชื่อม API เพิ่มโดยอัตโนมัติ หาก Chrome ไม่เปิด โปรดติดตั้ง VisionD Browser Launcher และอย่าเปิดต่อในโปรไฟล์หลัก`);
        return true;
      } catch {
        setStatus("เปิด VisionD Browser Launcher ไม่สำเร็จ ระบบไม่ได้เปิด OAuth ในโปรไฟล์ปัจจุบัน", "error");
        return false;
      } finally {
        setTimeout(() => { locked = false; }, 1200);
      }
    };
    const protocolNew = (slotId) => validUuid(slotId) ? `visiond-profile://open?mode=new&slot_id=${slotId}` : "";
    const protocolExisting = (channelId, slotId = "", intent = "view") => {
      if (!validUuid(channelId) || !intents.has(intent) || slotId && !validUuid(slotId)) return "";
      return slotId
        ? `visiond-profile://open?mode=existing&channel_id=${channelId}&slot_id=${slotId}&intent=${intent}`
        : `visiond-profile://open?mode=existing&channel_id=${channelId}&intent=${intent}`;
    };
    const launchNew = () => {
      if (locked) return false;
      let slotId = "";
      try { slotId = String(cryptoApi?.randomUUID?.() || "").toLowerCase(); } catch {}
      const uri = protocolNew(slotId);
      if (!uri) { setStatus("สร้างรหัสโปรไฟล์ใหม่ไม่ได้ จึงยังไม่ได้เปิด Chrome แยก", "error"); return false; }
      rememberPending(slotId);
      return run(uri, "ส่งคำขอเปิด TikTok Login ใน Chrome โปรไฟล์ใหม่แล้ว");
    };
    const reopenPending=()=>{const slotId=readPending(),uri=protocolNew(slotId);if(!uri){setStatus("ยังไม่มีโปรไฟล์ TikTok ใหม่ให้เปิดซ้ำ","error");return false}return run(uri,"ส่งคำขอเปิด TikTok Login ใน Chrome โปรไฟล์เดิมอีกครั้งแล้ว")};
    const launchExisting = (channelId, slotId = "", intent = "view") => {
      const uri = protocolExisting(String(channelId || "").toLowerCase(), String(slotId || "").toLowerCase(), intent);
      if (!uri) { setStatus("ข้อมูลช่องหรือโปรไฟล์ไม่ถูกต้อง จึงไม่ได้เปิด Chrome", "error"); return false; }
      return run(uri, intent === "view" ? "ส่งคำขอเปิด Chrome ประจำช่องแล้ว" : "ส่งคำขอเปิดขั้นตอนเชื่อมบัญชีใน Chrome ประจำช่องแล้ว");
    };
    const launchHandoff=({id,slot_id,ticket})=>{
      if(!validUuid(id)||!validUuid(slot_id)||!/^[0-9a-f]{64}$/.test(ticket||''))return false;
      return run(`visiond-profile://open?mode=handoff&slot_id=${slot_id}&id=${id}&ticket=${ticket}`,"ส่งขั้นตอนอนุญาตไปยัง Chrome โปรไฟล์ที่เลือกแล้ว");
    };
    return { launchNew, launchExisting, launchHandoff, reopenPending, readPending, clearPending, rememberPending, protocolNew, protocolExisting, validUuid };
  }

  window.createVisionDBrowserLauncher = createVisionDBrowserLauncher;
})();
