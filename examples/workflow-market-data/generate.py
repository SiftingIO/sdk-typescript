"""Build self-contained platform examples from the reviewed read-only client.
No network calls, credentials or market-data downloads occur here.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
core_js = (ROOT / 'dist/core.js').read_text().replace('export ', '')
core_ts = (ROOT / 'core.ts').read_text().replace('export ', '')

def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)

write('windmill/standalone.ts', core_ts + '''
// Windmill Hub script. Bind api_key to a Windmill secret variable, not a literal.
export async function main(api_key: string, asset_class: AssetClass, symbol: string, start: string, end: string, interval: Interval = '1h', limit: number = 300, cursor?: string) {
  const page = await readHistorical(api_key, {asset_class,symbol,start,end,interval,limit,cursor});
  return {...page,csv:toCsv(page)};
}
''')
props = {
    'apiKey': {'type':'string','label':'SiftingIO API key','secret':True},
    'assetClass': {'type':'string','label':'Asset class','options':['forex','commodities']},
    'symbol': {'type':'string','label':'Catalog symbol','description':'EURUSD for forex; XAUUSD for commodities.'},
    'start': {'type':'string','label':'Start (UTC, inclusive)'},
    'end': {'type':'string','label':'End (UTC, inclusive)'},
    'interval': {'type':'string','label':'Interval','options':['1m','5m','15m','30m','1h','1d','1w','1mo'],'default':'1h'},
    'limit': {'type':'integer','label':'Maximum rows in this page','default':300,'min':1,'max':2000},
    'cursor': {'type':'string','label':'Next-page cursor','optional':True},
}
write('pipedream/historical-bars.mjs',core_js+'\nexport default defineComponent({\n'+
      '  name: "SiftingIO: historical Forex or commodity bars",\n'+
      '  description: "Read one bounded page with UTC timestamps and pagination metadata. Uses your own key and request allowance.",\n'+
      '  version: "0.0.1", type: "action", key: "siftingio-historical-bars-page",\n'+
      '  props: '+json.dumps(props,indent=2)+',\n'+
      '''  async run({$}) {
    const page = await readHistorical(this.apiKey, {asset_class:this.assetClass,symbol:this.symbol,start:this.start,end:this.end,interval:this.interval,limit:this.limit,cursor:this.cursor});
    $.export('$summary',`Read ${page.row_count} historical bars; more pages: ${page.has_more}.`);
    return {...page,csv:toCsv(page)};
  }
});
''')

# Flow uses only built-in Node-RED nodes. HTTP request headers never enter output/debug.
validation_js = core_js[:core_js.index('async function readHistorical')]
prepare = validation_js + '''
try {
  const request = validateRequest(msg.payload);
  const apiKey = env.get('SIFTINGIO_API_KEY');
  if (!apiKey) throw new Error('Configure the SIFTINGIO_API_KEY environment variable.');
  const query = ['start','end','interval','limit','cursor'].filter(k=>request[k]!==undefined).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(String(request[k]))).join('&');
  return {_msgid:msg._msgid,method:'GET',url:'https://api.sifting.io/v1/hist/'+request.asset_class+'/'+request.symbol+'/bars?'+query,headers:{'X-API-Key':apiKey,'Accept':'application/json','Accept-Encoding':'gzip'},followRedirects:false,requestTimeout:15000,siftingio_request:request};
} catch(e) {node.error(e.message);return null;}
'''
normalizer = validation_js + '\n' + core_js[core_js.index('function toCsv'):]+'''
try {
  if (msg.statusCode < 200 || msg.statusCode >= 300) {node.error('SiftingIO HTTP '+msg.statusCode+'. Inspect the account and documentation before retrying.');return null;}
  const page=normalizePage(msg.payload,msg.siftingio_request);
  return [{payload:page},{payload:toCsv(page),filename:'siftingio-historical-bars.csv'}];
} catch(e) {node.error(e.message);return null;}
'''
flow=[
 {'id':'siftingio-tab','type':'tab','label':'SiftingIO historical bars','disabled':False,'info':'Manual, read-only page fetch. https://sifting.io/docs . Set SIFTINGIO_API_KEY in the runtime environment; do not paste a key into this flow. Dates below are examples, not market-data observations.'},
 {'id':'siftingio-notes','type':'comment','z':'siftingio-tab','name':'Own key in runtime environment; one page; manual execution only','info':'Edit symbol and UTC dates in Inject. Forex v means reported tick count. has_more and next_cursor describe remaining pages. No key should be wired to Debug.','x':400,'y':60,'wires':[]},
 {'id':'siftingio-inject','type':'inject','z':'siftingio-tab','name':'Choose dates and instrument','props':[{'p':'payload'}],'repeat':'','crontab':'','once':False,'onceDelay':0.1,'topic':'','payload':json.dumps({'asset_class':'forex','symbol':'EURUSD','start':'2026-11-01','end':'2026-11-02','interval':'1h','limit':300}),'payloadType':'json','x':190,'y':140,'wires':[['siftingio-prepare']]},
 {'id':'siftingio-prepare','type':'function','z':'siftingio-tab','name':'Validate and add secret header','func':prepare,'outputs':1,'timeout':0,'noerr':0,'initialize':'','finalize':'','libs':[],'x':470,'y':140,'wires':[['siftingio-http']]},
 {'id':'siftingio-http','type':'http request','z':'siftingio-tab','name':'Read historical page','method':'use','ret':'obj','paytoqs':'ignore','url':'','tls':'','persist':False,'proxy':'','insecureHTTPParser':False,'authType':'','senderr':False,'headers':[],'x':740,'y':140,'wires':[['siftingio-normalize']]},
 {'id':'siftingio-normalize','type':'function','z':'siftingio-tab','name':'Return bars and CSV; discard transport headers','func':normalizer,'outputs':2,'timeout':0,'noerr':0,'initialize':'','finalize':'','libs':[],'x':460,'y':240,'wires':[['siftingio-json'],['siftingio-csv']]},
 {'id':'siftingio-json','type':'debug','z':'siftingio-tab','name':'Page and next_cursor','active':True,'tosidebar':True,'console':False,'tostatus':False,'complete':'payload','targetType':'msg','x':800,'y':220,'wires':[]},
 {'id':'siftingio-csv','type':'debug','z':'siftingio-tab','name':'CSV text (not written to disk)','active':True,'tosidebar':True,'console':False,'tostatus':False,'complete':'payload','targetType':'msg','x':810,'y':280,'wires':[]},
 {'id':'siftingio-catch','type':'catch','z':'siftingio-tab','name':'Redact transport failures','scope':['siftingio-http'],'uncaught':False,'x':190,'y':340,'wires':[['siftingio-redact']]},
 {'id':'siftingio-redact','type':'function','z':'siftingio-tab','name':'Generic failure only','func':"return {payload:{error:'Market-data request failed. No automatic retry was made; inspect runtime connectivity and account status.'}};",'outputs':1,'timeout':0,'noerr':0,'initialize':'','finalize':'','libs':[],'x':480,'y':340,'wires':[['siftingio-json']]}
]
# The native HTTP Request node deliberately disables decompression. Use an own
# small node backed by Node fetch instead of publishing a broken gzip flow.
flow=[flow[0],flow[1],flow[2],
 {'id':'siftingio-native','type':'siftingio historical','z':'siftingio-tab','name':'SiftingIO historical page','x':480,'y':140,'wires':[['siftingio-json'],['siftingio-csv']]},flow[6],flow[7]]
flow[2]['wires']=[['siftingio-native']]
write('node-red/historical-bars.json',json.dumps(flow,indent=2)+'\n')
write('node-red/core.mjs',(ROOT/'dist/core.js').read_text())
write('node-red/package.json',json.dumps({'name':'node-red-contrib-siftingio','version':'0.1.0','description':'Read a bounded page of SiftingIO historical Forex or commodity bars.','main':'siftingio.cjs','license':'MIT','engines':{'node':'>=20'},'keywords':['node-red','forex','commodities','market-data'],'node-red':{'nodes':{'siftingio':'siftingio.cjs'}},'files':['siftingio.cjs','siftingio.html','core.mjs','README.md','LICENSE']},indent=2)+'\n')

ds={'type':'yesoreyeram-infinity-datasource','uid':'${DS_SIFTINGIO}'}
panels=[]
for idx,(asset,symbol) in enumerate([('forex','EURUSD'),('commodities','XAUUSD')],1):
    target={'refId':'A','type':'json','source':'url','parser':'backend','format':'table','url':f'https://api.sifting.io/v1/hist/{asset}/{symbol}/bars',
            'url_options':{'method':'GET','headers':[{'key':'Accept-Encoding','value':'gzip'}],'params':[{'key':'start','value':'${__from:date:iso}'},{'key':'end','value':'${__to:date:iso}'},{'key':'interval','value':'1h'},{'key':'limit','value':'300'}]},
            'root_selector':'data','columns':[{'selector':'t','text':'Time (UTC)','type':'timestamp_epoch'}]+[{'selector':f,'text':label,'type':'number'} for f,label in [('o','Open'),('h','High'),('l','Low'),('c','Close')]],'pagination_mode':'none','datasource':ds}
    panels.append({'id':idx,'type':'table','title':symbol+' historical bars (first 300 rows)','description':'One page of hourly historical bars, not a live quote. A limit of 300 can truncate the period. Check meta.next_cursor through the API before treating this as a complete history.','datasource':ds,'gridPos':{'h':9,'w':12,'x':(idx-1)*12,'y':4},'targets':[target],'fieldConfig':{'defaults':{},'overrides':[]},'options':{'showHeader':True}})
panels.insert(0,{'id':3,'type':'text','title':'Read before using','gridPos':{'h':4,'w':24,'x':0,'y':0},'options':{'mode':'markdown','content':'Historical Forex and commodity bars from [SiftingIO](https://sifting.io/docs). Configure X-API-Key in the Infinity datasource’s secure HTTP header settings. Never add it to dashboard JSON or a URL. This dashboard makes two bounded, read-only requests per refresh; automatic refresh is off. Dates are UTC. Each table shows only the first 300 rows and can be incomplete; use the API’s meta.next_cursor for further pages. Account allowances and data licensing apply. No market-data records are bundled.'}})
dashboard={'__inputs':[{'name':'DS_SIFTINGIO','label':'SiftingIO (Infinity datasource)','type':'datasource','pluginId':'yesoreyeram-infinity-datasource','pluginName':'Infinity'}],'title':'SiftingIO historical Forex and commodity bars','uid':None,'id':None,'schemaVersion':39,'version':1,'tags':['forex','commodities','siftingio'],'timezone':'utc','refresh':'','time':{'from':'now-2d','to':'now'},'templating':{'list':[]},'panels':panels,'editable':True,'description':'Two explicitly bounded historical tables with a separately configured secret; no live quotes, auto-refresh or included market data.'}
write('grafana/historical-bars.json',json.dumps(dashboard,indent=2)+'\n')
print('Generated standalone Windmill and Pipedream code, Node-RED flow and Grafana dashboard. Native publication/import validation is separate.')
