import assert from 'node:assert/strict';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { inspectVeditZip, makeVeditZip, VEDIT_ZIP_LIMITS } from '../public/vedit-zip.js';

const encoder = new TextEncoder();
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
function pngPixel(red, green, blue) {
  const chunk = (type, data) => {
    const name = encoder.encode(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, checksum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, red, green, blue]))), chunk('IEND', Buffer.alloc(0))
  ]));
}
function fixtureZip(entries) {
  const locals = [], directory = [];
  let offset = 0, directorySize = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name), plain = entry.bytes || new Uint8Array([1, 2, 3]);
    const compressed = entry.deflate ? deflateRawSync(plain) : plain;
    const size = entry.reportedSize ?? plain.length, crc = entry.badCrc ? 0 : crc32(plain), method = entry.deflate ? 8 : 0;
    const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, method, true); lv.setUint32(14, crc, true); lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, size, true); lv.setUint16(26, name.length, true); local.set(name, 30);
    locals.push(local, compressed);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, method, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed.length, true); cv.setUint32(24, size, true); cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); central.set(name, 46);
    directory.push(central); directorySize += central.length; offset += local.length + compressed.length;
  }
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directorySize, true); ev.setUint32(16, offset, true);
  return new File([...locals, ...directory, end], 'input.zip', { type: 'application/zip' });
}

const source = fixtureZip([
  { name: 'folder/สินค้า 01.jpg', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), deflate: true },
  { name: 'folder/second.webp', bytes: new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 87, 69, 66, 80]) },
  { name: 'notes.txt' }, { name: '../escape.png' }, { name: 'folder/สินค้า 01.JPG' }
]);
const inspected = await inspectVeditZip(source);
assert.deepEqual(inspected.entries.map(entry => entry.name), ['folder/สินค้า 01.jpg', 'folder/second.webp']);
assert.equal(inspected.rejected.length, 3);
assert.match(inspected.rejected[0].reason, /รองรับเฉพาะ/);
assert.match(inspected.rejected[1].reason, /ไม่ปลอดภัย/);
assert.match(inspected.rejected[2].reason, /ซ้ำ/);
assert.deepEqual([...new Uint8Array(await (await inspected.extract(inspected.entries[0])).arrayBuffer())], [0xff, 0xd8, 0xff, 0xd9]);
assert.equal((await inspected.extract(inspected.entries[1])).type, 'image/webp');
await assert.rejects(inspected.extract({ ...inspected.entries[0] }), /ไม่อยู่ใน ZIP/);
const aborted = new AbortController(); aborted.abort();
await assert.rejects(inspected.extract(inspected.entries[0], { signal: aborted.signal }), { name: 'AbortError' });

const pngA = pngPixel(255, 0, 0);
const pngB = pngPixel(0, 0, 255);
const generated = await makeVeditZip([
  { name: '001-สินค้า.png', bytes: pngA },
  { name: '002-product.png', bytes: pngB }
]);
const roundTrip = await inspectVeditZip(new File([generated], 'output.zip'));
assert.equal(roundTrip.entries.length, 2);
assert.deepEqual([...new Uint8Array(await (await roundTrip.extract(roundTrip.entries[0])).arrayBuffer())], [...pngA]);
await assert.rejects(makeVeditZip([{ name: '../bad.png', bytes: new Uint8Array([1]) }]), /ไม่ปลอดภัย/);
await assert.rejects(makeVeditZip([{ name: 'a.png', bytes: pngA }, { name: 'A.PNG', bytes: pngB }]), /ซ้ำ/);
await assert.rejects(makeVeditZip([{ name: 'a.png', bytes: new Uint8Array(VEDIT_ZIP_LIMITS.outputImageBytes + 1) }]), /เกินขอบเขต/);
await assert.rejects(makeVeditZip([{ name: 'a.png', bytes: new Uint8Array([1, 2, 3]) }]), /ต้องเป็น PNG/);
for (const name of ['CON.png', 'nul.png', 'COM1.png', 'LPT9.png', 'bad?.png', 'bad.png ']) {
  await assert.rejects(makeVeditZip([{ name, bytes: pngA }]), /ไม่ปลอดภัย/, name);
}

const corrupt = await inspectVeditZip(fixtureZip([{ name: 'bad.png', badCrc: true }]));
await assert.rejects(corrupt.extract(corrupt.entries[0]), /CRC/);
const spoof = await inspectVeditZip(fixtureZip([{ name: 'spoof.png' }]));
await assert.rejects(spoof.extract(spoof.entries[0]), /ชนิดไฟล์ไม่ตรง/);
await assert.rejects(inspectVeditZip(fixtureZip([
  { name: 'large.png', reportedSize: VEDIT_ZIP_LIMITS.imageBytes + 1 },
  { name: 'good.png' }
])), /ไม่เกิน 20 MB/);
await assert.rejects(inspectVeditZip(fixtureZip(Array.from({ length: 25 }, (_, index) => ({
  name: `image-${String(index + 1).padStart(2, '0')}.png`, bytes: pngA
})))), /เกิน 24 รูป/);
const maliciousInflate = await inspectVeditZip(fixtureZip([{ name: 'bomb.png', bytes: new Uint8Array(1024), reportedSize: 100, deflate: true }]));
await assert.rejects(maliciousInflate.extract(maliciousInflate.entries[0]), /เกิน 20 MB|ไม่สมบูรณ์/);
await assert.rejects(inspectVeditZip(new File([new Uint8Array([1, 2, 3])], 'bad.zip')), /ไม่สมบูรณ์/);
console.log('Vedit ZIP core PASS: bounded inspection, rejections, deflate, CRC, cancellation and output round trip');
