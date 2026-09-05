const decoder = new TextDecoder();
const u16 = (view, offset) => view.getUint16(offset, true), u32 = (view, offset) => view.getUint32(offset, true);

function zipEntries(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer); let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 65557); offset <= bytes.length - 22; offset++) if (u32(view, offset) === 0x06054b50) eocd = offset;
  if (eocd < 0) throw new Error('ไฟล์ PowerPoint ไม่สมบูรณ์');
  const count = u16(view, eocd + 10), entries = new Map(); let offset = u32(view, eocd + 16);
  for (let index = 0; index < count; index++) {
    if (u32(view, offset) !== 0x02014b50) throw new Error('อ่านรายการไฟล์ PowerPoint ไม่สำเร็จ');
    const method = u16(view, offset + 10), size = u32(view, offset + 20), nameLength = u16(view, offset + 28), extraLength = u16(view, offset + 30), commentLength = u16(view, offset + 32), localOffset = u32(view, offset + 42), name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    const localNameLength = u16(view, localOffset + 26), localExtraLength = u16(view, localOffset + 28), start = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, { method, bytes: bytes.slice(start, start + size) }); offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(entry) {
  if (!entry) return null; if (entry.method === 0) return entry.bytes;
  if (entry.method !== 8 || !globalThis.DecompressionStream) throw new Error('เบราว์เซอร์นี้ยังเปิด PowerPoint เก่าออนไลน์ไม่ได้');
  const stream = new Blob([entry.bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const unescapeXml = value => String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const textRuns = value => [...String(value || '').matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(match => unescapeXml(match[1]));
const attribute = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] || '';
const resolved = (base, target) => { const parts = `${base}/${target}`.split('/'), result = []; for (const part of parts) part === '..' ? result.pop() : part !== '.' && result.push(part); return result.join('/'); };
const imageType = name => ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[name.split('.').pop().toLowerCase()] || 'application/octet-stream');
const imageCaptionNumber = value => Number(String(value || '').match(/^รูป\s*(\d+)\s*(?:·|:|-).*?(?:ดูรูปใหญ่|ดูใหญ่)/i)?.[1]) || 0;

export async function parsePptxPreview(buffer) {
  const entries = zipEntries(buffer), names = [...entries.keys()].filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])), slides = [];
  for (const name of names) {
    const document = decoder.decode(await inflate(entries.get(name))), paragraphs = [...document.matchAll(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g)].map(match => textRuns(match[0]).join('').trim()).filter(Boolean), relName = name.replace('slides/', 'slides/_rels/') + '.rels', relationships = entries.get(relName) ? decoder.decode(await inflate(entries.get(relName))) : '', relationMap = new Map([...relationships.matchAll(/<Relationship\s[^>]*\/>/g)].map(match => [attribute(match[0], 'Id'), attribute(match[0], 'Target')])), images = {}, numbers = [], mediaUrls = [];
    const title = paragraphs.shift() || `สไลด์ ${slides.length + 1}`, captionNumbers = paragraphs.map(imageCaptionNumber).filter(Boolean), titleImageNumber = Number(title.match(/^รูป\s*(\d+)$/i)?.[1]) || 0;
    for (const blip of document.matchAll(/<a:blip\s[^>]*r:embed="([^"]+)"[^>]*>/g)) { const target = relationMap.get(blip[1]); if (!target) continue; const path = resolved('ppt/slides', target), media = await inflate(entries.get(path)); if (!media) continue; mediaUrls.push(URL.createObjectURL(new Blob([media], { type: imageType(path) }))); }
    mediaUrls.forEach((url, imageIndex) => { let number = captionNumbers[imageIndex] || (mediaUrls.length === 1 ? titleImageNumber : 0) || imageIndex + 1; while (numbers.includes(number)) number += 1; numbers.push(number); images[number] = url; });
    const body = paragraphs.filter(value => !imageCaptionNumber(value) && !/^\d+\s*\/\s*\d+$/.test(value)).join('\n'); slides.push({ title, subtitle: slides.length === 0 ? body : '', cover: slides.length === 0, bullets: slides.length === 0 ? [] : [{ text: body || title, attachment_numbers: numbers }], images });
  }
  if (!slides.length) throw new Error('ไม่พบสไลด์ในไฟล์ PowerPoint'); return slides;
}
