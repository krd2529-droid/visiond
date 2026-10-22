import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { hashLocalMedia } from './publishing.mjs';

const mediaTypes = new Map([['.mp4','video/mp4'],['.mov','video/quicktime'],['.webm','video/webm'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.png','image/png'],['.webp','image/webp']]);

export async function prepareSelectedMedia(paths, { statFile = stat, hashFile = hashLocalMedia } = {}) {
  if (!Array.isArray(paths) || paths.length > 10) throw new Error('เลือกได้ไม่เกิน 10 ไฟล์ต่อหนึ่งงาน');
  const files = [];
  for (const path of paths) {
    const mimeType = mediaTypes.get(extname(path).toLowerCase());
    if (!mimeType) throw new Error('รองรับเฉพาะ MP4, MOV, WebM, JPG, PNG และ WebP');
    let info, actual;
    try {
      info = await statFile(path);
      if (!info.isFile() || info.size <= 0 || !Number.isSafeInteger(info.size)) throw new Error('invalid file');
      actual = await hashFile(path);
    } catch {
      // OS errors include full local paths; never send those messages to the renderer.
      throw new Error('อ่านไฟล์สื่อที่เลือกไม่ได้ กรุณาตรวจไฟล์แล้วเลือกใหม่');
    }
    if (actual.bytes !== info.size) throw new Error('ไฟล์เปลี่ยนระหว่างตรวจ กรุณาเลือกใหม่');
    files.push({ localPath:path, name:basename(path), bytes:actual.bytes, sha256:actual.sha256, mimeType });
  }
  return files;
}
