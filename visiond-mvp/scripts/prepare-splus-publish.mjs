// Generate guarded D1 release SQL from the exact signed customer Setup bytes.
// Apply migration 0148 first. Upload the same bytes to R2 and verify size/SHA-256
// at the object key printed here before executing the SQL. No signing seed is used.
import {createReadStream} from 'node:fs';
import {stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';

const [setupPath,outputPath]=process.argv.slice(2);
if(!setupPath||!outputPath)throw new Error('usage: node scripts/prepare-splus-publish.mjs <SPlus-Setup-1.0.0.exe> <output.sql>');
const fileName=basename(setupPath);
if(fileName!=='SPlus-Setup-1.0.0.exe')throw new Error('unexpected installer name');
const size=(await stat(setupPath)).size;
if(!Number.isSafeInteger(size)||size<1000000)throw new Error('installer size invalid');
const hash=createHash('sha256');for await(const chunk of createReadStream(setupPath))hash.update(chunk);
const sha=hash.digest('hex').toUpperCase();
const objectKey=`vision7/splus/1.0.0/${sha}.exe`;
const ready=`EXISTS(SELECT 1 FROM vision7_plans q JOIN products x ON x.id=q.product_id
  WHERE q.program_id=p.id AND q.active=1 AND x.status IN ('draft','published') AND x.product_kind='vision7-key'
  AND ((q.plan_code='accounts30' AND q.offer_price=99000 AND x.price=99000 AND x.slug='vbot-key-splus-accounts30')
    OR (q.plan_code='accounts50' AND q.offer_price=149000 AND x.price=149000 AND x.slug='vbot-key-splus-accounts50')
    OR (q.plan_code='accounts100' AND q.offer_price=249000 AND x.price=249000 AND x.slug='vbot-key-splus-accounts100'))
  GROUP BY q.program_id HAVING COUNT(DISTINCT q.plan_code)=3)`;
const release=`EXISTS(SELECT 1 FROM vision7_releases r WHERE r.program_id=p.id AND r.version='1.0.0'
  AND r.object_key='${objectKey}' AND r.file_size=${size} AND r.sha256='${sha}' AND r.status='published')`;
const sql=`-- S+ customer Setup must already exist in R2 at ${objectKey}\n-- Verified bytes: ${size}; SHA256: ${sha}\n-- Apply 0148_splus_draft.sql before this guarded publish script.\n
INSERT OR IGNORE INTO vision7_releases(program_id,version,minimum_version,mandatory,object_key,file_name,mime_type,file_size,sha256,release_notes,status)
SELECT p.id,'1.0.0','1.0.0',0,'${objectKey}','${fileName}','application/vnd.microsoft.portable-executable',${size},'${sha}',
  'S+ Windows · ทดลอง 3 วัน 10 บัญชี · คีย์ตลอดชีพ 30/50/100 บัญชี','published'
FROM vision7_programs p WHERE p.code='splus' AND p.active=0 AND ${ready};

UPDATE products SET status='published',updated_at=CURRENT_TIMESTAMP
WHERE id IN (SELECT q.product_id FROM vision7_plans q JOIN vision7_programs p ON p.id=q.program_id
  WHERE p.code='splus' AND p.active=0 AND q.plan_code IN ('accounts30','accounts50','accounts100') AND ${release})
  AND source='vision7' AND product_kind='vision7-key';

UPDATE vision7_programs AS p SET active=1,current_version='1.0.0',minimum_version='1.0.0',updated_at=CURRENT_TIMESTAMP
WHERE p.code='splus' AND p.active=0 AND ${release}
  AND (SELECT COUNT(DISTINCT q.plan_code) FROM vision7_plans q JOIN products x ON x.id=q.product_id
    WHERE q.program_id=p.id AND q.active=1 AND x.status='published' AND x.product_kind='vision7-key'
    AND ((q.plan_code='accounts30' AND q.offer_price=99000 AND x.price=99000 AND x.slug='vbot-key-splus-accounts30')
      OR (q.plan_code='accounts50' AND q.offer_price=149000 AND x.price=149000 AND x.slug='vbot-key-splus-accounts50')
      OR (q.plan_code='accounts100' AND q.offer_price=249000 AND x.price=249000 AND x.slug='vbot-key-splus-accounts100')))=3;

SELECT p.id,p.code,p.active,p.current_version,r.id release_id,r.object_key,r.file_size,r.sha256,r.status
FROM vision7_programs p LEFT JOIN vision7_releases r ON r.program_id=p.id AND r.version='1.0.0' WHERE p.code='splus';
SELECT q.plan_code,q.offer_price,x.slug,x.price,x.status FROM vision7_plans q JOIN vision7_programs p ON p.id=q.program_id
  JOIN products x ON x.id=q.product_id WHERE p.code='splus' ORDER BY q.plan_code;
`;
await writeFile(outputPath,sql,{flag:'wx'});
console.log(JSON.stringify({file:setupPath,size,sha256:sha,object_key:objectKey,sql:outputPath}));
