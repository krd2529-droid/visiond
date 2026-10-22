import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

// Main-process boundary for future authorized platform connectors. No connector ships with the app.
export async function hashLocalMedia(path) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(path)) { hash.update(chunk); bytes += chunk.length; }
  return { sha256:hash.digest('hex'), bytes };
}

export class PublishingService {
  constructor(store, connectors = new Map()) {
    this.store = store;
    this.connectors = connectors;
  }

  async publish(jobId) {
    const { workspace, manifest } = this.store.publicationCandidate(jobId);
    const connector = this.connectors.get(workspace.platform);
    if (!connector || typeof connector.authorize !== 'function' || typeof connector.publish !== 'function' || typeof connector.verify !== 'function') {
      throw new Error('ยังไม่เชื่อมต่อบัญชีและสิทธิ์เผยแพร่ของแพลตฟอร์มนี้');
    }
    const grant = await connector.authorize(workspace);
    if (grant?.connected !== true || grant.workspaceId !== workspace.id || grant.platform !== workspace.platform || grant.accountId !== manifest.accountId) {
      throw new Error('ยังไม่มีสิทธิ์เผยแพร่สำหรับพื้นที่ช่องนี้');
    }
    for (const media of manifest.media) {
      const actual = await hashLocalMedia(media.localPath);
      if (actual.sha256 !== media.sha256 || actual.bytes !== media.bytes) throw new Error('ไฟล์สื่อเปลี่ยนจากฉบับที่อนุมัติ กรุณาตรวจและอนุมัติใหม่');
    }
    const attempt = this.store.reservePublication(jobId);
    try {
      const response = await connector.publish({
        workspace, manifest: JSON.parse(attempt.approved_manifest_json),
        idempotencyKey: attempt.idempotency_key
      });
      const remoteId = String(response?.remoteId || '').trim();
      if (!remoteId) throw new Error('แพลตฟอร์มไม่ส่งรหัสโพสต์กลับมา');
      const verification = await connector.verify({ workspace, remoteId, idempotencyKey: attempt.idempotency_key });
      if (verification?.confirmed !== true || verification.remoteId !== remoteId) throw new Error('ยังยืนยันผลจากแพลตฟอร์มไม่ได้');
      return this.store.confirmPublication(jobId,remoteId);
    } catch {
      // A network error may occur after the platform accepted the request. Never auto-retry.
      this.store.markPublicationUncertain(jobId);
      throw new Error('ผลการเผยแพร่ยังไม่แน่ชัด กรุณาตรวจบนแพลตฟอร์มก่อน ห้ามส่งซ้ำ');
    }
  }
}
