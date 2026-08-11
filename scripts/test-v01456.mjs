import fs from 'node:fs';const read=p=>fs.readFileSync(p,'utf8'),migration=read('migrations/0022_vision7_release_delivery.sql'),admin=read('functions/api/admin/vision7/releases.js'),download=read('functions/api/vision7/releases/[id]/download.js'),mine=read('functions/api/vision7/my-programs.js'),ui=read('public/my-programs.js');const checks=[
['version',Number(read('VERSION.txt').trim().split('.').pop())>=56],
['release schema',migration.includes('UNIQUE(program_id,version)')&&migration.includes('sha256 TEXT NOT NULL')],
['admin protected',admin.includes('requireAdmin')&&admin.includes('95*1024*1024')],
['server hash',admin.includes("crypto.subtle.digest('SHA-256',bytes)")],
['r2 rollback',admin.includes('FILES.delete(objectKey)')],
['updates program version',admin.includes('UPDATE vision7_programs SET current_version=')],
['owner access',download.includes('l.user_id=?')&&download.includes("['active','trial'].includes")],
['private secure download',download.includes("cache-control','private, no-store")&&download.includes('x-vision7-sha256')],
['member manifest',mine.includes('download_url')&&ui.includes('ดาวน์โหลดตัวติดตั้ง')&&ui.includes('SHA-256')]
];let failed=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)failed++}if(failed)process.exit(1);
