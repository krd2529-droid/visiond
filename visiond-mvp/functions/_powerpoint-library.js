export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const PPTX_MAX_BYTES = 50 * 1024 * 1024;

export async function ensurePowerpointLibrary(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS powerpoint_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by INTEGER NOT NULL,
    source_note_id INTEGER,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_powerpoint_library_owner ON powerpoint_library(created_by,created_at DESC,id DESC)').run();
}

const containsAscii = (bytes, value) => {
  const needle = new TextEncoder().encode(value);
  outer: for (let index = 0; index <= bytes.length - needle.length; index++) {
    for (let part = 0; part < needle.length; part++) if (bytes[index + part] !== needle[part]) continue outer;
    return true;
  }
  return false;
};

export async function validatedPptx(file) {
  if (!(file instanceof File) || !file.size || file.size > PPTX_MAX_BYTES) throw new Error('PPTX_SIZE');
  if (file.type !== PPTX_MIME || !String(file.name || '').toLowerCase().endsWith('.pptx')) throw new Error('PPTX_TYPE');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw new Error('PPTX_ZIP');
  if (!containsAscii(bytes, '[Content_Types].xml') || !containsAscii(bytes, 'ppt/presentation.xml')) throw new Error('PPTX_STRUCTURE');
  return bytes;
}

export const safePptxName = value => `${String(value || 'VisionD-PowerPoint').replace(/[\\/:*?"<>|\r\n]+/g, '-').trim().replace(/\.pptx$/i, '').slice(0, 180) || 'VisionD-PowerPoint'}.pptx`;

export function powerpointHeaders(fileName, size, disposition = 'attachment') {
  const mode = disposition === 'inline' ? 'inline' : 'attachment';
  return {
    'content-type': PPTX_MIME,
    'content-length': String(size),
    'content-disposition': `${mode}; filename="presentation.pptx"; filename*=UTF-8''${encodeURIComponent(safePptxName(fileName))}`,
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "sandbox; default-src 'none'",
  };
}
