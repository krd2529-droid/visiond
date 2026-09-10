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
    const launchHandoff=({id,slot_id,ticket,profile_kind='slot'})=>{
      if(!validUuid(id)||!validUuid(slot_id)||!['slot','channel'].includes(profile_kind)||!/^[0-9a-f]{64}$/.test(ticket||''))return false;
      const key=profile_kind+':'+slot_id;if(handoffLocks.has(key))return false;handoffLocks.add(key);
      try{invoke(`visiond-profile://open?mode=handoff&profile_kind=${profile_kind}&slot_id=${slot_id}&id=${id}&ticket=${ticket}`);return true}
      catch{setStatus('เปิด Chrome ไม่สำเร็จ กรุณาตรวจ VisionD Browser Launcher','error');return false}
      finally{setTimeout(()=>handoffLocks.delete(key),1200)}
    };
    const handoffLocks=new Set();
    return { launchNew, launchExisting, launchHandoff, reopenPending, readPending, clearPending, rememberPending, protocolNew, protocolExisting, validUuid };
  }

  window.createVisionDBrowserLauncher = createVisionDBrowserLauncher;
  window.createVisionDCommandLauncher = ({cryptoApi,openWindow}) => ({
    resumeCommand(command_id){
      if(!validUuid(command_id))throw new Error('คำขอโปรไฟล์ไม่ถูกต้อง');
      openWindow('/launcher-open.html#'+new URLSearchParams({command_id}).toString(),'_blank','noopener,noreferrer');
      return command_id;
    },
    openCommand({provider,intent,channel_id=''}){
      const command_id=cryptoApi.randomUUID();
      if(!validUuid(command_id)||!['new','reconnect','view'].includes(intent)||!['tiktok','shop'].includes(provider)||intent!=='new'&&!validUuid(channel_id))throw new Error('คำขอโปรไฟล์ไม่ถูกต้อง');
      const params=new URLSearchParams({command_id});
      // Synchronous genuine-click bootstrap. With noopener a null return is expected;
      // only authenticated server status can establish whether the helper started Chrome.
      openWindow('/launcher-open.html#'+params.toString(),'_blank','noopener,noreferrer');
      return command_id;
    }
  });
})();
