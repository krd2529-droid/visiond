const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = value => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format((Number(value) || 0) / 100);
let data = { items: [], payouts: [], adjustments: [] };
$('#commissions').insertAdjacentHTML('afterend','<section id="adjustments" class="explain"></section>');
async function api(options = {}) {
  const response = await fetch('/api/admin/vx-referrals' + (options.query || ''), options), body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'ทำรายการไม่สำเร็จ');
  return body;
}
async function load() {
  try { data = await api({ query: $('#status').value ? `?status=${encodeURIComponent($('#status').value)}` : '' }); render(); }
  catch (error) { $('#error').textContent = error.message; }
}
function actions(item) {
  if (item.status === 'pending') return `<button data-status="approved" data-id="${esc(item.id)}">อนุมัติ</button><button data-status="void" data-id="${esc(item.id)}">ยกเลิก</button>`;
  if (item.status === 'approved') return `<button data-status="payable" data-id="${esc(item.id)}">พร้อมจ่าย</button><button data-status="void" data-id="${esc(item.id)}">ยกเลิก</button>`;
  if (item.status === 'payable') return `<button data-status="void" data-id="${esc(item.id)}">ยกเลิก</button>`;
  return '';
}
function render() {
  $('#commissions').innerHTML = `<h2>รายการค่าคอม</h2>${data.items.map(item => `<article class="admin-row"><label><input type="checkbox" data-pay-id="${esc(item.id)}" ${item.status === 'payable' ? '' : 'disabled'}> ${esc(item.referrer)}</label><b>${money(item.amount)}</b><span>${esc(item.status)} · พักถึง ${esc(item.hold_until)}</span><div>${actions(item)}</div></article>`).join('') || '<p>ไม่มีรายการ</p>'}`;
  $('#adjustments').innerHTML = `<h2>ยอดเรียกคืนจากการคืนเงิน</h2>${data.adjustments.map(item => `<article class="admin-row"><b>${esc(item.referrer)}</b><strong>${money(item.amount)}</strong><span>${esc(item.status)} · ${esc(item.reason)}</span>${item.status==='open'?`<button data-settle-adjustment="${esc(item.id)}">บันทึกว่าเรียกคืนแล้ว</button>`:''}</article>`).join('')||'<p>ไม่มียอดเรียกคืน</p>'}`;
  $('#payouts').innerHTML = `<h2>รอบจ่าย</h2>${data.payouts.map(payout => `<article class="admin-row"><b>${esc(payout.payout_no)} · ${money(payout.amount)}</b><span>${esc(payout.referrer)} · ${esc(payout.status)}</span>${payout.status === 'processing' ? `<button data-paid="${esc(payout.id)}">บันทึกว่าจ่ายแล้ว</button>` : ''}</article>`).join('') || '<p>ยังไม่มีรอบจ่าย</p>'}`;
}
$('#status').onchange = load;
$('#createPayout').onclick = async () => {
  const ids = [...document.querySelectorAll('[data-pay-id]:checked')].map(input => input.dataset.payId);
  try { await api({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ commission_ids: ids }) }); await load(); }
  catch (error) { alert(error.message); }
};
document.body.onclick = async event => {
  const statusButton = event.target.closest('[data-status]'), paidButton = event.target.closest('[data-paid]'), settleButton = event.target.closest('[data-settle-adjustment]');
  try {
    if (statusButton) { await api({ method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: statusButton.dataset.id, status: statusButton.dataset.status, reason: statusButton.dataset.status === 'void' ? 'ยกเลิกโดยผู้ดูแล' : '' }) }); await load(); }
    if (paidButton) { const proof = prompt('ใส่เลขอ้างอิงหรือที่อยู่หลักฐานการจ่ายเงิน'); if (!proof) return; await api({ method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: paidButton.dataset.paid, action: 'payout_paid', proof_key: proof }) }); await load(); }
    if (settleButton) { const proof = prompt('ใส่หลักฐานหรือเลขอ้างอิงการเรียกคืนยอด'); if (!proof) return; await api({ method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: settleButton.dataset.settleAdjustment, action: 'adjustment_settled', proof_key: proof }) }); await load(); }
  } catch (error) { alert(error.message); }
};
load();
