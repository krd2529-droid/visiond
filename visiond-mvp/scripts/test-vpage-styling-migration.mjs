import assert from 'node:assert/strict';
import {applyMigration} from './apply-vpage-styling-migration.mjs';

const initial=[{name:'page_id'},{name:'background_image_url'}];
const migrated=[...initial,{name:'background_color'},{name:'text_font'},{name:'text_color'}];
function fake(initialRows,{apply=true}={}){
  let rows=initialRows,files=0,reads=0;
  return {run(args){if(args[0]==='--command'){reads++;return rows}if(args[0]==='--file'){files++;if(apply)rows=migrated;return []}throw new Error('unexpected command')},counts(){return {files,reads}}};
}

const absent=fake(initial);applyMigration(absent.run);assert.deepEqual(absent.counts(),{files:1,reads:2});
const present=fake(migrated);applyMigration(present.run);assert.deepEqual(present.counts(),{files:0,reads:2});
const partial=fake([...initial,{name:'background_color'}]);assert.throws(()=>applyMigration(partial.run),/Partial Vpage styling schema/);assert.deepEqual(partial.counts(),{files:0,reads:1});
const failed=fake(initial,{apply:false});assert.throws(()=>applyMigration(failed.run),/verification failed/);assert.deepEqual(failed.counts(),{files:1,reads:2});
console.log('PASS Vpage styling migration absent/present/partial/verification');
