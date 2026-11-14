import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {historicalBars} from '../dist/activepieces/index.js';
import {main} from '../dist/windmill/historical-bars.js';
const req={asset_class:'commodities',symbol:'XAUUSD',start:'2026-11-01',end:'2026-11-02',interval:'1h',limit:300};
const fixture={data:[{t:1793491200000,o:2000,h:2010,l:1990,c:2005}],meta:{next_cursor:'page-two'}};
async function withFetch(fn){const saved=globalThis.fetch;globalThis.fetch=async(url,options)=>{assert.match(url,/https:\/\/api.sifting.io/);assert.equal(options.headers['X-API-Key'],'synthetic-adapter-key');return new Response(JSON.stringify(fixture));};try{await fn();}finally{globalThis.fetch=saved;}}
test('Activepieces framework action accepts secret_text auth and returns pagination',async()=>withFetch(async()=>{
  const out=await historicalBars.run({auth:{secret_text:'synthetic-adapter-key'},propsValue:req});assert.equal(out.has_more,true);assert.match(out.csv,/2000,2010,1990,2005/);assert.equal(JSON.stringify(out).includes('synthetic-adapter-key'),false);
}));
test('Windmill callable function',async()=>withFetch(async()=>{
  const out=await main('synthetic-adapter-key',req.asset_class,req.symbol,req.start,req.end,req.interval,req.limit);assert.equal(out.row_count,1);
}));
test('Pipedream action definition and run contract with a platform stub',async()=>withFetch(async()=>{
  globalThis.defineComponent=x=>x;
  try{const {default:action}=await import('../pipedream/historical-bars.mjs');let summary;
    const out=await action.run.call({apiKey:'synthetic-adapter-key',assetClass:req.asset_class,...req},{$:{export:(_k,v)=>summary=v}});
    assert.equal(action.props.apiKey.secret,true);assert.match(summary,/more pages: true/);assert.equal(out.next_cursor,'page-two');
  }finally{delete globalThis.defineComponent;}
}));
test('Node-RED node emits new messages without credential or incoming headers',async()=>withFetch(async()=>{
  let ctor;const require=createRequire(import.meta.url);const register=require('../node-red/siftingio.cjs');
  register({nodes:{registerType:(_name,c,opts)=>{ctor=c;assert.equal(opts.credentials.apiKey.type,'password');},createNode:node=>{node.credentials={apiKey:'synthetic-adapter-key'};node.on=(_event,cb)=>node.input=cb;}}});
  const node=new ctor({});let outputs;await new Promise((resolve,reject)=>{node.input({_msgid:'test',payload:req,headers:{private:'do-not-forward'}},value=>outputs=value,error=>error?reject(error):resolve());});
  assert.equal(outputs[0].payload.row_count,1);assert.equal(outputs[0].headers,undefined);assert.equal(JSON.stringify(outputs).includes('synthetic-adapter-key'),false);
}));
test('Grafana dashboard contains no credential header or automatic refresh',()=>{
  const d=JSON.parse(fs.readFileSync(new URL('../grafana/historical-bars.json',import.meta.url)));assert.equal(d.refresh,'');assert.equal(d.panels.filter(p=>p.targets).length,2);assert.equal(JSON.stringify(d).includes('"key":"X-API-Key"'),false);
});
