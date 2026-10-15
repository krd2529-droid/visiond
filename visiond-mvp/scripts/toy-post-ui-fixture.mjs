import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,extname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../public');
const payload=(data,status=200)=>({status,type:'application/json; charset=utf-8',body:JSON.stringify(data)});
const lines=[{id:1,name:'กันดั้ม',destinations:[{type:'page',name:'เพจของเล่น',url:'https://www.facebook.com/example'}]}];
const products=[{id:1,line_id:1,detail:'สินค้า1 รายละเอียด1',photo_url:'/api/admin/toy-post-products/1/photo'},{id:2,line_id:1,detail:'สินค้า2 รายละเอียด2',photo_url:'/api/admin/toy-post-products/2/photo'}];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');let answer;
  if(url.pathname==='/api/auth/me')answer=payload({user:{id:1,name:'Fixture Admin',role:'admin'}});
  else if(url.pathname==='/api/admin/toy-post-lines')answer=payload({items:lines,next_cursor:null});
  else if(url.pathname==='/api/admin/toy-post-products')answer=payload({items:products,next_cursor:null});
  else if(url.pathname==='/api/admin/toy-post-compose')answer=payload({line:lines[0],text:'มือ1 รวมส่ง\n\nสินค้า1 รายละเอียด1\n\nสินค้า2 รายละเอียด2',photos:products.map(x=>({product_id:x.id,url:x.photo_url})),count:2,published:false});
  else if(/\/api\/admin\/toy-post-products\/\d+\/photo/.test(url.pathname))answer={status:200,type:'image/png',body:png};
  else if(['/toy-post-library.html','/toy-post-library.css','/toy-post-library.js'].includes(url.pathname)){
    const file=resolve(root,`.${url.pathname}`);answer={status:200,type:{'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}[extname(file)],body:await readFile(file)};
  }else answer={status:404,type:'text/plain',body:'Not found'};
  res.writeHead(answer.status,{'content-type':answer.type,'cache-control':'no-store'});res.end(answer.body);
});
server.listen(4178,'127.0.0.1',()=>console.log('Toy post UI fixture: http://127.0.0.1:4178/toy-post-library.html'));
