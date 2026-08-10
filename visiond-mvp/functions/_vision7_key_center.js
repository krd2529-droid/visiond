import {ensureVision7Schema} from './_vision7_schema.js';

export async function ensureVision7KeyCenterSchema(env){
  await ensureVision7Schema(env);
  const columns=(await env.DB.prepare('PRAGMA table_info(vision7_licenses)').all()).results||[];
  if(!columns.some(column=>column.name==='binding_state')){
    await env.DB.prepare("ALTER TABLE vision7_licenses ADD COLUMN binding_state TEXT NOT NULL DEFAULT 'not_required'").run();
  }
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v7_license_binding ON vision7_licenses(binding_state,status,created_at DESC)').run();
}

export const bindingStateForProgram=platformType=>String(platformType||'').toLowerCase()==='veasy'?'unbound':'not_required';
