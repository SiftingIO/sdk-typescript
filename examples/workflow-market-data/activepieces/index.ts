import { createPiece, createAction, PieceAuth, Property } from '@activepieces/pieces-framework';
import { readHistorical, toCsv, type AssetClass, type Interval } from '../core.js';

export const siftingioAuth = PieceAuth.SecretText({displayName:'SiftingIO API key',required:true,description:'Use your own key from https://sifting.io/dashboard. Requests consume your account allowance.'});
export const historicalBars = createAction({
  name:'historical_bars_page',displayName:'Read a page of historical bars',
  description:'Fetch one bounded page of Forex or commodity OHLC bars. Returns pagination metadata and CSV; never places the key in the output.',
  auth:siftingioAuth,
  props:{
    asset_class:Property.StaticDropdown({displayName:'Asset class',required:true,options:{options:[{label:'Forex',value:'forex'},{label:'Commodities',value:'commodities'}]}}),
    symbol:Property.ShortText({displayName:'Catalog symbol',required:true,description:'For example EURUSD for Forex or XAUUSD for commodities.'}),
    start:Property.ShortText({displayName:'Start (UTC, inclusive)',required:true}),
    end:Property.ShortText({displayName:'End (UTC, inclusive)',required:true}),
    interval:Property.StaticDropdown({displayName:'Bar interval',required:true,defaultValue:'1h',options:{options:['1m','5m','15m','30m','1h','1d','1w','1mo'].map(value=>({label:value,value}))}}),
    limit:Property.Number({displayName:'Maximum rows in this page',required:true,defaultValue:300}),
    cursor:Property.ShortText({displayName:'Next-page cursor',required:false,description:'Leave empty for the first page. Pagination is explicit; this action does not loop.'})
  },
  async run(context){
    const p=context.propsValue;
    const result=await readHistorical(context.auth.secret_text,{asset_class:p.asset_class as AssetClass,symbol:p.symbol,start:p.start,end:p.end,interval:p.interval as Interval,limit:p.limit,cursor:p.cursor});
    return {...result,csv:toCsv(result)};
  }
});
export const siftingio = createPiece({
  displayName:'SiftingIO',description:'Read historical Forex and commodity bars with explicit dates, UTC timestamps and pagination.',
  logoUrl:'https://sifting.io/logo.svg',authors:['aprsn'],auth:siftingioAuth,
  actions:[historicalBars],triggers:[]
});
