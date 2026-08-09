import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';

const publicRoot=new URL('../public/',import.meta.url);
const widget=readFileSync(new URL('../public/elon-chat.js',import.meta.url),'utf8');
assert.match(widget,/const FRONTEND_SURFACES = new Set/,'widget must use an explicit frontend allowlist');
assert.match(widget,/if \(!frontendSurface\(location\.pathname\)\) return/,'unknown routes must fail closed before authentication or mount');
assert.match(widget,/authenticated = Boolean\(user/,'widget must distinguish an authenticated member from a guest');
assert.match(widget,/const PUBLIC_API = '\/api\/elon\/public-chat'/,'guest must use the database-free public endpoint');
assert.match(widget,/const chatApi = \(\) => authenticated \? API : PUBLIC_API/,'widget must route member and guest requests separately');
assert.match(widget,/Authentication lookup failure fails closed to the registration gate/,'auth lookup failure must fail closed');
assert.match(widget,/if \(authenticated && previousId\)/,'guest reset must not call conversation-history APIs');
assert.match(widget,/input\.disabled = true/,'guest input must be disabled');
assert.match(widget,/registerLink\.href = '\/register\.html'/,'guest widget must link directly to registration');

const html=[];
function walk(directory){
  for(const name of readdirSync(directory)){
    const file=join(directory,name);
    if(statSync(file).isDirectory())walk(file);
    else if(name.endsWith('.html')&&readFileSync(file,'utf8').includes('elon-chat.js'))html.push(relative(publicRoot.pathname,file));
  }
}
walk(publicRoot.pathname);

const forbidden=html.filter(file=>/(^|\/)(?:admin|vision4|system-health)(?:[/.]|$)/i.test(file));
assert.deepEqual(forbidden,[],'internal/admin HTML must not load the ELON widget asset');
assert.equal(html.length>0,true,'expected reviewed frontend pages to load the widget');

console.log(`ELON widget surface audit passed (${html.length} frontend HTML files, 0 internal HTML files)`);
