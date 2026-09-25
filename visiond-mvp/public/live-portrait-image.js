export const LIVE_PORTRAIT_SOURCE_MAX_BYTES = 12 * 1024 * 1024;
export const LIVE_PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;
export const LIVE_PORTRAIT_MAX_PIXELS = 24_000_000;
export const LIVE_PORTRAIT_MIN_EDGE = 256;
export const LIVE_PORTRAIT_MAX_EDGE = 4096;
// The private sanitizer Worker scales the server-trusted derivative to the same
// edge, avoiding needless upload bytes before Cloudflare Images decodes it.
export const LIVE_PORTRAIT_OUTPUT_EDGE = 1024;
export const LIVE_PORTRAIT_DERIVATIVE_VERSION = 'visiond-canvas-jpeg-v1';

const SOURCE_TYPES = new Set(['image/jpeg', 'image/png']);
const JPEG_QUALITIES = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62];

const abortError = () => new DOMException('Portrait work was cancelled', 'AbortError');
const magicMatches = async (blob, type) => {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
};
const defaultDecode = async blob => {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
};
const defaultEncode = (decoded, width, height, quality) => new Promise(resolve => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) { resolve(null); return; }
  context.fillStyle = '#f4f7f6';
  context.fillRect(0, 0, width, height);
  context.drawImage(decoded.source, 0, 0, width, height);
  canvas.toBlob(resolve, 'image/jpeg', quality);
});
const defaultFileFactory = blob => new File([blob], 'visiond-presenter.jpg', { type: 'image/jpeg', lastModified: Date.now() });

export function createLivePortraitImagePipeline(options = {}) {
  const decodeImage = options.decodeImage || defaultDecode;
  const encodeImage = options.encodeImage || defaultEncode;
  const fileFactory = options.fileFactory || defaultFileFactory;
  let generation = 0;

  const cancel = () => { generation += 1; };
  const assertCurrent = ticket => { if (ticket !== generation) throw abortError(); };
  const prepare = async file => {
    const ticket = ++generation;
    if (!(file instanceof Blob)) throw new TypeError('กรุณาเลือกรูป JPG หรือ PNG');
    const sourceMime = String(file.type || '').toLowerCase();
    if (!SOURCE_TYPES.has(sourceMime) || !await magicMatches(file, sourceMime)) throw new TypeError('ไฟล์ต้องเป็น JPG หรือ PNG ที่เปิดได้จริง');
    assertCurrent(ticket);
    if (!file.size || file.size > LIVE_PORTRAIT_SOURCE_MAX_BYTES) throw new RangeError('รูปต้นฉบับต้องมีขนาดไม่เกิน 12 MB');

    let decoded;
    try {
      decoded = await decodeImage(file);
      assertCurrent(ticket);
      const sourceWidth = Number(decoded?.width) || 0;
      const sourceHeight = Number(decoded?.height) || 0;
      const pixels = sourceWidth * sourceHeight;
      if (!Number.isSafeInteger(sourceWidth) || !Number.isSafeInteger(sourceHeight)
        || Math.min(sourceWidth, sourceHeight) < LIVE_PORTRAIT_MIN_EDGE
        || Math.max(sourceWidth, sourceHeight) > LIVE_PORTRAIT_MAX_EDGE
        || !Number.isSafeInteger(pixels) || pixels > LIVE_PORTRAIT_MAX_PIXELS) {
        throw new RangeError('รูปต้องมีด้านละ 256–4096 พิกเซล และไม่เกิน 24 ล้านพิกเซล');
      }

      const scale = Math.min(1, LIVE_PORTRAIT_OUTPUT_EDGE / Math.max(sourceWidth, sourceHeight));
      let width = Math.round(sourceWidth * scale);
      let height = Math.round(sourceHeight * scale);
      if (Math.min(width, height) < LIVE_PORTRAIT_MIN_EDGE) {
        throw new RangeError('อัตราส่วนรูปกว้างหรือสูงเกินไป กรุณาเลือกรูปบุคคลที่ด้านสั้นอย่างน้อย 256 พิกเซลหลังย่อ');
      }
      for (let attempt = 0; attempt < JPEG_QUALITIES.length; attempt += 1) {
        const blob = await encodeImage(decoded, width, height, JPEG_QUALITIES[attempt]);
        assertCurrent(ticket);
        if (!(blob instanceof Blob) || !blob.size || blob.type !== 'image/jpeg' || !await magicMatches(blob, 'image/jpeg')) {
          throw new Error('เบราว์เซอร์สร้างรูปอนุพันธ์ที่ปลอดภัยไม่สำเร็จ');
        }
        assertCurrent(ticket);
        if (blob.size <= LIVE_PORTRAIT_MAX_BYTES) {
          return Object.freeze({
            file: fileFactory(blob, 'visiond-presenter.jpg'),
            sourceMime,
            sourceWidth,
            sourceHeight,
            width,
            height,
            derivative: LIVE_PORTRAIT_DERIVATIVE_VERSION,
          });
        }
        if (attempt >= 2) {
          const ratio = Math.min(0.9, Math.max(0.7, Math.sqrt(LIVE_PORTRAIT_MAX_BYTES / blob.size) * 0.94));
          const nextWidth = Math.floor(width * ratio);
          const nextHeight = Math.floor(height * ratio);
          if (Math.min(nextWidth, nextHeight) < LIVE_PORTRAIT_MIN_EDGE) break;
          width = nextWidth;
          height = nextHeight;
        }
      }
      throw new RangeError('รูปอนุพันธ์มีขนาดเกิน 5 MB กรุณาเลือกรูปที่มีรายละเอียดน้อยลง');
    } finally {
      decoded?.close?.();
    }
  };

  return Object.freeze({ cancel, prepare });
}
