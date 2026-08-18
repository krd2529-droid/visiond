import fs from 'node:fs';import {metaAdsConfig,normalizeMetaInsight} from '../functions/_meta_ads.js';const read=p=>fs.readFileSync(p,'utf8'),engine=read('functions/_meta_ads.js'),api=read('functions/api/admin/meta-ads-sync.js'),center=read('functions/api/admin/ads-center.js'),html=read('public/ads-center.html'),ui=read('public/ads-center.js'),migration=read('migrations/0024_meta_ads_api_ingestion.sql'),ledger=JSON.parse(read('requirements-ledger.json')),historical=JSON.parse(read('requirements-history/v0.14.59.json'));const normalized=normalizeMetaInsight({date_start:'2026-08-10',account_id:'1',campaign_id:'2',campaign_name:'C',adset_id:'3',adset_name:'S',ad_id:'4',ad_name:'A',impressions:'1000',clicks:'25',spend:'123.45',actions:[{action_type:'purchase',value:'2'}]},{id:'5',name:'Creative'});let configBlocked=false;try{metaAdsConfig({})}catch{configBlocked=true}const checks=[
['version',(()=>{const m=read('VERSION.txt').trim().match(/^v0\.14\.(\d+)$/);return Boolean(m)&&Number(m[1])>=59})()],
['secret required',configBlocked&&engine.includes('META_ADS_ACCESS_TOKEN_NOT_CONFIGURED')],
['read only graph',engine.includes("act_${cfg.account}/insights")&&engine.includes("act_${cfg.account}/ads")&&!engine.includes("method:'POST'")],
['hierarchy fields',engine.includes('campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name')&&engine.includes("creative{id,name,effective_object_story_id}")],
['daily level',engine.includes("level:'ad'")&&engine.includes('time_increment:1')],
['pagination capped',engine.includes('page<20')&&engine.includes("searchParams.set('after',after)")],
['range capped',engine.includes('days>92')],
['normalization',normalized.spend===12345&&normalized.impressions===1000&&JSON.parse(normalized.actions).purchase===2&&normalized.creative_id==='5'],
['upsert idempotent',migration.includes('UNIQUE(insight_date,account_id,ad_id)')&&engine.includes('ON CONFLICT(insight_date,account_id,ad_id) DO UPDATE')],
['sync audit',migration.includes('meta_ads_sync_runs')&&engine.includes("status='failed'")],
['admin protected',api.includes('requireAdmin')],
['dashboard merged',center.includes('meta_ads_insights')&&center.includes('ad_campaign_costs')&&center.includes('NOT EXISTS')],
['separate ads UI',html.includes('ซิงก์ Meta Ads')&&ui.includes('/api/admin/meta-ads-sync')&&ui.includes('CTR')],
['requirement closed',ledger.requirements.find(x=>x.id==='EC-ADS-003')?.status==='DONE-VERIFIED'],
['event case all verified',historical.requirements.every(x=>x.status==='DONE-VERIFIED')]
];let failed=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)failed++}if(failed)process.exit(1);
