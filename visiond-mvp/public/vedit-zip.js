// Browser-only ZIP handling for Vedit. Keep archive limits independent of the UI.
export const VEDIT_ZIP_LIMITS = Object.freeze({
  archiveBytes: 64 * 1024 * 1024,
  entries: 24,
  directoryEntries: 512,
  imageBytes: 20 * 1024 * 1024,
  totalImageBytes: 120 * 1024 * 1024,
  outputImageBytes: 32 * 1024 * 1024,
  outputBytes: 160 * 1024 * 1024
});

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
const mimeByExtension = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const signatures = {
  'image/jpeg': bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': bytes => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte),
  'image/webp': bytes => [82, 73, 70, 70].every((byte, index) => bytes[index] === byte) && [87, 69, 66, 80].every((byte, index) => bytes[index + 8] === byte)
};
const u16 = (view, offset) => view.getUint16(offset, true);
const u32 = (view, offset) => view.getUint32(offset, true);
const check = (condition, message) => { if (!condition) throw new Error(message) };
const cancelled = signal => { if (signal?.aborted) throw new DOMException('ยกเลิกการอ่าน ZIP แล้ว', 'AbortError') };

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function safePath(name) {
  if (!name || name.length > 240 || name.startsWith('/') || name.includes('\\') || /[<>:"|?*\u0000-\u001f\u007f]/.test(name)) return false;
  const parts = name.split('/');
  return parts.every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}

function decodeName(bytes, flags) {
  if (!(flags & 0x0800) && bytes.some(byte => byte > 0x7f)) throw new Error('ZIP มีชื่อไฟล์ที่ไม่ได้เข้ารหัส UTF-8');
  return decoder.decode(bytes).normalize('NFC');
}

async function inflateBounded(bytes, maximum, signal) {
  check(typeof DecompressionStream === 'function', 'เบราว์เซอร์นี้ยังไม่รองรับ ZIP แบบบีบอัด');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      cancelled(signal);
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      check(size <= maximum, 'รูปใน ZIP แตกแล้วมีขนาดเกิน 20 MB');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export async function inspectVeditZip(file, { signal } = {}) {
  cancelled(signal);
  check(file && typeof file.arrayBuffer === 'function' && file.size > 0 && file.size <= VEDIT_ZIP_LIMITS.archiveBytes, 'ZIP ต้องมีขนาดมากกว่า 0 และไม่เกิน 64 MB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  cancelled(signal);
  const view = new DataView(bytes.buffer), minimum = Math.max(0, bytes.length - 65557);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= minimum; offset--) {
    if (u32(view, offset) === 0x06054b50 && offset + 22 + u16(view, offset + 20) === bytes.length) { end = offset; break; }
  }
  check(end >= 0, 'ZIP ไม่สมบูรณ์หรือไม่มีสารบัญไฟล์');
  check(u16(view, end + 4) === 0 && u16(view, end + 6) === 0 && u16(view, end + 8) === u16(view, end + 10), 'ZIP หลายส่วนไม่รองรับ');
  const count = u16(view, end + 10), centralSize = u32(view, end + 12), centralOffset = u32(view, end + 16);
  check(count <= VEDIT_ZIP_LIMITS.directoryEntries && centralSize !== 0xffffffff && centralOffset !== 0xffffffff, 'ZIP มีไฟล์มากเกินไปหรือใช้ ZIP64');
  check(centralOffset + centralSize === end, 'สารบัญ ZIP ไม่ตรงกับข้อมูลไฟล์');
  const entries = [], rejected = [], seen = new Set(), localRanges = [];
  let cursor = centralOffset, totalSize = 0;
  for (let index = 0; index < count; index++) {
    cancelled(signal);
    check(cursor + 46 <= end && u32(view, cursor) === 0x02014b50, 'สารบัญ ZIP ไม่ถูกต้อง');
    const flags = u16(view, cursor + 8), method = u16(view, cursor + 10), expectedCrc = u32(view, cursor + 16);
    const compressedSize = u32(view, cursor + 20), size = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28), extraLength = u16(view, cursor + 30), commentLength = u16(view, cursor + 32);
    const disk = u16(view, cursor + 34), mode = u32(view, cursor + 38) >>> 16, localOffset = u32(view, cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    check(next <= end && compressedSize !== 0xffffffff && size !== 0xffffffff && localOffset !== 0xffffffff && disk === 0, 'ZIP มีรายการที่ไม่สมบูรณ์หรือใช้ ZIP64');
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength), name = decodeName(nameBytes, flags);
    cursor = next;
    if (name.endsWith('/')) continue;
    const reject = reason => { rejected.push({ name, reason }); };
    if (!safePath(name)) { reject('ชื่อหรือเส้นทางไฟล์ไม่ปลอดภัย'); continue; }
    const key = name.toLocaleLowerCase('und');
    if (seen.has(key)) { reject('ชื่อไฟล์ซ้ำ'); continue; }
    seen.add(key);
    const extension = name.split('.').pop().toLowerCase(), type = mimeByExtension[extension];
    if (!type) { reject('รองรับเฉพาะ JPG, PNG และ WebP'); continue; }
    check(entries.length < VEDIT_ZIP_LIMITS.entries, 'ZIP มีรูปเกิน 24 รูป กรุณาแบ่งเป็นหลาย ZIP');
    check(size > 0 && size <= VEDIT_ZIP_LIMITS.imageBytes, `รูป ${name} ต้องมีขนาดมากกว่า 0 และไม่เกิน 20 MB`);
    check(totalSize + size <= VEDIT_ZIP_LIMITS.totalImageBytes, 'รูปใน ZIP รวมกันเกิน 120 MB กรุณาแบ่งเป็นหลาย ZIP');
    if ((flags & 0x2041) || ![0, 8].includes(method) || (mode & 0xf000) === 0xa000) { reject('วิธีบีบอัดหรือชนิดไฟล์ไม่รองรับ'); continue; }
    check(localOffset + 30 <= centralOffset && u32(view, localOffset) === 0x04034b50, 'ส่วนหัวไฟล์ใน ZIP ไม่ถูกต้อง');
    const localFlags = u16(view, localOffset + 6), localMethod = u16(view, localOffset + 8);
    const localNameLength = u16(view, localOffset + 26), localExtraLength = u16(view, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength, finish = start + compressedSize;
    check(localFlags === flags && localMethod === method && localNameLength === nameBytes.length && finish <= centralOffset, 'ข้อมูลไฟล์ใน ZIP ไม่ตรงกับสารบัญ');
    check(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength).every((byte, i) => byte === nameBytes[i]), 'ชื่อไฟล์ใน ZIP ไม่ตรงกับสารบัญ');
    if (!(flags & 0x0008)) check(u32(view, localOffset + 14) === expectedCrc && u32(view, localOffset + 18) === compressedSize && u32(view, localOffset + 22) === size, 'ขนาดหรือ CRC ใน ZIP ไม่ตรงกับสารบัญ');
    localRanges.push([localOffset, finish]);
    entries.push({ name, type, size, compressedSize, method, start, expectedCrc });
    totalSize += size;
  }
  check(cursor === end && entries.length > 0, entries.length ? 'สารบัญ ZIP มีข้อมูลเกิน' : 'ไม่พบรูป JPG, PNG หรือ WebP ที่ใช้ได้ใน ZIP');
  localRanges.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < localRanges.length; i++) check(localRanges[i][0] >= localRanges[i - 1][1], 'รายการ ZIP ทับข้อมูลกัน');
  async function extract(entry, { signal: extractionSignal } = {}) {
    cancelled(extractionSignal);
    check(entries.includes(entry), 'รายการรูปไม่อยู่ใน ZIP นี้');
    const compressed = bytes.subarray(entry.start, entry.start + entry.compressedSize);
    const output = entry.method === 0 ? compressed.slice() : await inflateBounded(compressed, entry.size, extractionSignal);
    cancelled(extractionSignal);
    check(output.length === entry.size && crc32(output) === entry.expectedCrc, `รูป ${entry.name} แตก ZIP ไม่สมบูรณ์หรือ CRC ไม่ตรง`);
    check(signatures[entry.type](output), `รูป ${entry.name} มีชนิดไฟล์ไม่ตรงกับข้อมูลภาพ`);
    return new File([output], entry.name.split('/').pop(), { type: entry.type });
  }
  return { entries, rejected, extract };
}

export async function makeVeditZip(files, { signal } = {}) {
  check(Array.isArray(files) && files.length > 0 && files.length <= VEDIT_ZIP_LIMITS.entries, 'จำนวนภาพส่งออกต้องอยู่ระหว่าง 1 ถึง 24 รูป');
  const local = [], central = [], seen = new Set();
  let offset = 0, centralSize = 0, total = 0;
  for (const file of files) {
    cancelled(signal);
    const name = String(file.name || '').normalize('NFC'), nameBytes = encoder.encode(name);
    check(safePath(name) && !name.includes('/') && name.toLowerCase().endsWith('.png') && nameBytes.length <= 240, 'ชื่อภาพส่งออกไม่ปลอดภัย');
    const key = name.toLocaleLowerCase('und');
    check(!seen.has(key), 'ชื่อภาพส่งออกซ้ำ');
    seen.add(key);
    if (!(file.bytes instanceof Uint8Array)) check(file.bytes?.size > 0 && file.bytes.size <= VEDIT_ZIP_LIMITS.outputImageBytes, 'ภาพส่งออกมีขนาดเกินขอบเขต');
    const data = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(await file.bytes.arrayBuffer());
    check(data.length > 0 && data.length <= VEDIT_ZIP_LIMITS.outputImageBytes && total + data.length <= VEDIT_ZIP_LIMITS.outputBytes, 'ภาพส่งออกหรือ ZIP รวมมีขนาดเกินขอบเขต');
    check(signatures['image/png'](data), 'ภาพส่งออกต้องเป็น PNG ที่สมบูรณ์');
    total += data.length;
    const crc = crc32(data), header = new Uint8Array(30 + nameBytes.length), hv = new DataView(header.buffer);
    hv.setUint32(0, 0x04034b50, true); hv.setUint16(4, 20, true); hv.setUint16(6, 0x0800, true);
    hv.setUint32(14, crc, true); hv.setUint32(18, data.length, true); hv.setUint32(22, data.length, true);
    hv.setUint16(26, nameBytes.length, true); header.set(nameBytes, 30);
    local.push(header, data);
    const directory = new Uint8Array(46 + nameBytes.length), dv = new DataView(directory.buffer);
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true); dv.setUint16(8, 0x0800, true);
    dv.setUint32(16, crc, true); dv.setUint32(20, data.length, true); dv.setUint32(24, data.length, true);
    dv.setUint16(28, nameBytes.length, true); dv.setUint32(42, offset, true); directory.set(nameBytes, 46);
    central.push(directory); centralSize += directory.length; offset += header.length + data.length;
  }
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
}
