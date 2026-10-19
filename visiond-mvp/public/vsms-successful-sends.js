const rows = document.querySelector('#vsmsSuccessRows');
const state = document.querySelector('#vsmsSuccessState');
const more = document.querySelector('#vsmsSuccessMore');
const refresh = document.querySelector('#loadVsmsSuccess');
let cursor = null;
let flight = null;

const cell = (label, value, code = false) => {
  const td = document.createElement('td');
  td.dataset.label = label;
  if (code) {
    const element = document.createElement('code');
    element.textContent = value ?? '';
    td.append(element);
  } else td.textContent = value ?? '';
  return td;
};

function render(item) {
  const tr = document.createElement('tr');
  tr.append(
    cell('เบอร์ผู้รับ', item.recipient_phone),
    cell('ส่งสำเร็จเมื่อ', new Date(Number(item.sent_at)).toLocaleString('th-TH')),
    cell('เครื่อง', item.device_name || 'อุปกรณ์ VSMS'),
    cell('เจ้าของคีย์', item.user_name || item.user_email || ''),
    cell('คีย์', item.license_id, true),
  );
  rows.append(tr);
}

async function load(reset = false) {
  if (flight) return flight;
  const requestedCursor = reset ? null : cursor;
  state.textContent = 'กำลังโหลด…';
  refresh.disabled = true;
  more.disabled = true;
  flight = (async () => {
    try {
      const url = `/api/admin/vision7/smsmix-successful-sends${requestedCursor ? `?cursor=${encodeURIComponent(requestedCursor)}` : ''}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'ไม่มีสิทธิ์ดูรายการนี้' : `HTTP ${response.status}`);
      const data = await response.json();
      if (reset) rows.replaceChildren();
      for (const item of data.items || []) render(item);
      cursor = data.next_cursor;
      more.hidden = !cursor;
      state.textContent = rows.children.length ? 'ผลส่งสำเร็จที่รายงานจากแอป VSMS' : 'ยังไม่มีรายการส่งสำเร็จ';
    } catch (error) {
      state.textContent = `โหลดรายการไม่สำเร็จ: ${error.message}`;
    } finally {
      refresh.disabled = false;
      more.disabled = false;
      flight = null;
    }
  })();
  return flight;
}

refresh.addEventListener('click', () => load(true));
more.addEventListener('click', () => load(false));
load(true);
