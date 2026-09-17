import { semanticFigureLabels, visibleFigureLabel } from './powerpoint-figure-labels.js?v=020121';

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
const isFigureCaption = value => /^รูป(?:ประกอบ|\s*\d+(?:\.\d+)*(?:\s*[–-]\s*\d+(?:\.\d+)*)?)\s*(?:·|:|-)/i.test(String(value || ''));

export async function parsePptxPreview(buffer) {
  const entries = zipEntries(buffer), names = [...entries.keys()].filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])), slides = [], semanticByNumber = new Map();
  for (const name of names) {
    const document = decoder.decode(await inflate(entries.get(name))), relName = name.replace('slides/', 'slides/_rels/') + '.rels', relationships = entries.get(relName) ? decoder.decode(await inflate(entries.get(relName))) : '', relationMap = new Map([...relationships.matchAll(/<Relationship\s[^>]*\/>/g)].map(match => [attribute(match[0], 'Id'), attribute(match[0], 'Target')])), tokens = [];
    for (const match of document.matchAll(/<p:pic(?:\s[^>]*)?>[\s\S]*?<\/p:pic>|<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>|<a:blip\s[^>]*r:embed="[^"]+"[^>]*>/g)) {
      if (match[0].startsWith('<p:pic') || match[0].startsWith('<a:blip')) tokens.push({ type: 'image', relationship: match[0].match(/r:embed="([^"]+)"/)?.[1] || '', attachment: Number(match[0].match(/descr="visiond-attachment:(\d+)"/)?.[1]) || 0 });
      else { const value = textRuns(match[0]).join('').trim(); if (value) tokens.push({ type: 'text', value }); }
    }
    const titleToken = tokens.find(token => token.type === 'text'), title = titleToken?.value || `สไลด์ ${slides.length + 1}`, titleImageNumber = Number(title.match(/^รูป\s*(\d+)$/i)?.[1]) || 0, imageTokens = tokens.filter(token => token.type === 'image'), images = {}, figureLabels = {}, usedNumbers = [];
    for (const [imageIndex, token] of imageTokens.entries()) {
      const tokenIndex = tokens.indexOf(token), previousImage = imageTokens[imageIndex - 1], previousImageIndex = previousImage ? tokens.indexOf(previousImage) : -1, nextImage = imageTokens[imageIndex + 1], nextImageIndex = nextImage ? tokens.indexOf(nextImage) : tokens.length, before = tokens.map((candidate, index) => ({ candidate, index })).slice(previousImageIndex + 1, tokenIndex).reverse().find(entry => entry.candidate.type === 'text' && isFigureCaption(entry.candidate.value)), after = tokens.map((candidate, index) => ({ candidate, index })).slice(tokenIndex + 1, nextImageIndex).find(entry => entry.candidate.type === 'text' && isFigureCaption(entry.candidate.value)), caption = before && (!after || tokenIndex - before.index <= after.index - tokenIndex) ? before.candidate : after?.candidate, target = relationMap.get(token.relationship);
      if (!target) continue;
      const path = resolved('ppt/slides', target), media = await inflate(entries.get(path)); if (!media) continue;
      let number = token.attachment || imageCaptionNumber(caption?.value) || (imageTokens.length === 1 ? titleImageNumber : 0) || imageIndex + 1;
      while (usedNumbers.includes(number)) number += 1;
      usedNumbers.push(number); token.number = number; images[number] = URL.createObjectURL(new Blob([media], { type: imageType(path) }));
    }
    const cover = slides.length === 0, bullets = [], pending = []; let current = null;
    for (const token of tokens) {
      if (token === titleToken) continue;
      if (token.type === 'text') {
        if (!isFigureCaption(token.value) && !/^\d+\s*\/\s*\d+$/.test(token.value)) pending.push(token.value);
        continue;
      }
      if (!token.number) continue;
      if (pending.length) { current = { text: pending.splice(0).join('\n'), attachment_numbers: [] }; bullets.push(current); }
      if (!current) { current = { text: title, attachment_numbers: [] }; bullets.push(current); }
      current.attachment_numbers.push(token.number);
    }
    if (pending.length) bullets.push({ text: pending.join('\n'), attachment_numbers: [] });
    for (const bullet of bullets) {
      const labels = semanticFigureLabels(bullet.text, bullet.attachment_numbers);
      for (const number of bullet.attachment_numbers) if (labels[number]) {
        figureLabels[number] = labels[number];
        if (!titleImageNumber && !semanticByNumber.has(number)) semanticByNumber.set(number, labels[number]);
      }
    }
    const body = bullets.map(bullet => bullet.text).join('\n');
    slides.push({ title, subtitle: cover ? body : '', cover, bullets: cover ? [] : bullets, images, figure_labels: figureLabels, detail_number: titleImageNumber });
  }
  for (const slide of slides) {
    for (const number of Object.keys(slide.images).map(Number)) if (semanticByNumber.has(number) && (slide.detail_number || !slide.figure_labels[number])) slide.figure_labels[number] = semanticByNumber.get(number);
    if (slide.detail_number) slide.title = visibleFigureLabel(slide.bullets[0]?.text || '', '', slide.detail_number, slide.figure_labels[slide.detail_number]);
    delete slide.detail_number;
  }
  if (!slides.length) throw new Error('ไม่พบสไลด์ในไฟล์ PowerPoint'); return slides;
}
