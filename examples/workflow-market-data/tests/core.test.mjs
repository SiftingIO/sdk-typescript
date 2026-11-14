import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {gzipSync} from 'node:zlib';
import {once} from 'node:events';
import {readHistorical,normalizePage,requestUrl,toCsv,validateRequest} from '../dist/core.js';
const req={asset_class:'forex',symbol:'EURUSD',start:'2026-11-01',end:'2026-11-02',interval:'1h',limit:300};
const payload={data:[{t:1793491200000,o:1.1,h:1.2,l:1,c:1.15,v:17},{t:1793494800000,o:1.15,h:1.3,l:1.1,c:1.2}],meta:{next_cursor:'opaque-page-2',symbol:'EURUSD',as_of:'2026-11-03T00:00:00Z'}};
test('UTC inputs, symbol and size boundaries',()=>{
  assert.equal(validateRequest({...req,symbol:' eurusd '}).symbol,'EURUSD');
  for(const change of [{start:'2026-02-30'},{start:'2026-11-03'},{limit:2001},{symbol:'../../evil'},{interval:'1s'},{start:'2026-11-01T25:00:00Z'}])assert.throws(()=>validateRequest({...req,...change}));
  assert.match(requestUrl(req),/^https:\/\/api\.sifting\.io\/v1\/hist\/forex\/EURUSD\/bars\?/);
});
test('bounded page preserves missing v and pagination',()=>{
  const page=normalizePage(payload,req);
  assert.equal(page.has_more,true);assert.equal(page.row_count,2);assert.equal(page.next_cursor,'opaque-page-2');
  assert.equal('v' in page.rows[1],false);
  const csv=toCsv(page);assert.ok(csv.includes('2026-11-01T00:00:00.000Z'));assert.ok(csv.endsWith(',1.15,1.3,1.1,1.2,\n'));
  assert.match(page.interpretation,/not exchange-traded volume/);
});
test('empty pages are not made into prices or invented volume',()=>{
  const page=normalizePage({data:[]},req);assert.equal(page.has_more,false);assert.equal(page.rows.length,0);assert.equal(toCsv(page).split('\n').length,2);
});
test('bad payloads and OHLC fail explicitly',()=>{
  for(const bad of [{error:'bad'},{data:[{...payload.data[0],l:1.25}]},{data:[{...payload.data[0],c:NaN}]},{data:[{...payload.data[0],t:1e30}]},{data:[],meta:{next_cursor:42}}])assert.throws(()=>normalizePage(bad,req));
});
test('secret only in header; fixed origin, gzip and redirect error',async()=>{
  let count=0;const secret='synthetic-test-key';
  const result=await readHistorical(secret,req,async(url,options)=>{
    count++;assert.equal(options.headers['X-API-Key'],secret);assert.equal(options.headers['Accept-Encoding'],'gzip');assert.equal(options.redirect,'error');
    assert.equal(url.includes(secret),false);return new Response(JSON.stringify(payload));
  });
  assert.equal(count,1);assert.equal(JSON.stringify(result).includes(secret),false);
});
test('HTTP and transport failures expose no upstream body or key, do not retry',async()=>{
  for(const status of [401,403,406,422,429,500]){
    let count=0;await assert.rejects(readHistorical('synthetic-secret',req,async()=>{count++;return new Response('synthetic-secret private response',{status});}),error=>!error.message.includes('synthetic-secret')&&error.message.includes(String(status)));
    assert.equal(count,1);
  }
  await assert.rejects(readHistorical('synthetic-secret',req,async()=>{throw new Error('synthetic-secret');}),/No automatic retry/);
});
test('Node fetch transparently decodes an actual gzip response from a local mock',async()=>{
  const server=createServer((request,response)=>{assert.equal(request.headers['accept-encoding'],'gzip');response.writeHead(200,{'Content-Type':'application/json','Content-Encoding':'gzip'});response.end(gzipSync(JSON.stringify(payload)));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{const port=server.address().port;const result=await readHistorical('synthetic-key',req,async(_url,options)=>fetch(`http://127.0.0.1:${port}/fixture`,options));assert.equal(result.row_count,2);}
  finally{server.close();await once(server,'close');}
});
