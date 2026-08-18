(() => {
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const courseCard = x => `<article class="audit-card ${x.healthy ? '' : 'bad'}"><b>${esc(x.title)}</b><small> · ${esc(x.owner_username || '-')}</small><div class="audit-grid"><span>ออเดอร์ paid: <b>${x.paid_orders}</b></span><span>มีหลักฐานสลิป: <b>${x.approved_slips}</b></span><span>สิทธิ์เรียน: <b>${x.learning_rights}</b></span><span>สิทธิ์ผิดปกติ: <b>${x.invalid_rights}</b></span></div><p>${x.event_case_ready ? '✓ Event Case ผ่านจริง' : x.healthy && Number(x.paid_orders) === 0 ? 'รอทดสอบซื้อจริง — 0=0=0 ยังไม่นับว่าผ่าน' : x.healthy ? 'ข้อมูลตรงกัน แต่คอร์สยังไม่ approved/published' : `⚠ ส่วนต่างสิทธิ์กับสลิป ${x.difference}`}</p></article>`;
  async function load() {
    auditSummary.textContent = 'กำลังตรวจ…';
    eventCaseSummary.textContent = 'กำลังตรวจตะกร้าตัวอย่าง…';
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    let response, data;
    try {
      response = await fetch('/api/admin/course-integrity?event_case=1', { cache: 'no-store', signal: controller.signal });
      data = await response.json().catch(() => ({}));
    } catch (error) {
      auditSummary.className = 'audit-bad';
      auditSummary.textContent = error?.name === 'AbortError' ? 'ตรวจไม่สำเร็จภายใน 8 วินาที — API ยังตอบช้า' : 'เชื่อมต่อระบบตรวจไม่สำเร็จ';
      eventCaseSummary.className = 'audit-card bad';
      eventCaseSummary.textContent = 'Event Case ยังไม่ผ่าน กรุณากดตรวจใหม่หรือตรวจฐานข้อมูล';
      return;
    } finally { clearTimeout(timeout); }
    if (!response.ok) {
      auditSummary.className = 'audit-bad';
      auditSummary.textContent = data.warning === 'EVENT_CASE_QUERY_TIMEOUT' ? 'ฐานข้อมูลตอบช้าเกิน 5 วินาที' : (data.error || 'ตรวจไม่สำเร็จ');
      eventCaseSummary.className = 'audit-card bad';
      eventCaseSummary.textContent = 'Event Case ยังไม่ผ่าน — ระบบหยุดรอแล้วและไม่ค้างหน้าจอ';
      return;
    }
    auditSummary.className = data.healthy ? 'audit-ok' : 'audit-bad';
    auditSummary.textContent = data.healthy ? 'ข้อมูลทุกตะกร้าตรงกัน' : `พบความผิดปกติ ${Number(data.issues) || 0} รายการ`;
    const eventCase = data.event_case || {};
    eventCaseSummary.className = `audit-card ${eventCase.complete ? '' : 'bad'}`;
    eventCaseSummary.innerHTML = `<h2>Event Case · user1 / บัญชีทดสอบ V5</h2><p>${eventCase.complete ? '✓ ผ่านครบ: มีออเดอร์ paid + หลักฐานสลิป + สิทธิ์เรียน และคอร์สเปิดขาย' : `ยังไม่ผ่านครบ · ตะกร้า ${Number(eventCase.total)||0} · ผ่าน ${Number(eventCase.ready)||0} · ค้าง ${Number(eventCase.pending)||0}`}</p>${(eventCase.items || []).map(courseCard).join('') || '<p>ยังไม่พบตะกร้าของ user1 หรือบัญชีทดสอบ Vision 5</p>'}`;
    const checks = data.checks || {}, system = [['เครดิตไม่ตรงจำนวนซื้อ',checks.credit_mismatches],['ประวัติปลดล็อกไม่ตรง',checks.unlock_log_mismatches],['มีสิทธิ์จากออเดอร์ที่ยังไม่ paid',checks.nonpaid_entitlements],['ออเดอร์ไม่มีสินค้า',checks.orphan_orders]].filter(([,rows]) => rows?.length);
    const systemMarkup = system.length ? `<section class="audit-system"><h2>ความผิดปกติระดับระบบ</h2>${system.map(([label,rows]) => `<article class="audit-card bad"><b>${esc(label)} · ${rows.length} รายการ</b><p>${rows.slice(0,10).map(x => esc(x.order_no || `ออเดอร์ ${x.order_id}`)).join(', ')}</p></article>`).join('')}</section>` : '';
    auditList.innerHTML = systemMarkup + (data.items?.length ? data.items.map(courseCard).join('') : '<p>ยังไม่มีตะกร้าคอร์สจากสิทธิ์</p>');
  }
  auditRefresh.onclick = load;
  load();
})();
