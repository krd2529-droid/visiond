import { ensureDatabase } from '../_schema.js';
import { ensureVision7Schema } from '../_vision7_schema.js';
import { vRecordActivation } from '../_vrecord_activation.js';

export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  return vRecordActivation(ctx, false);
}
