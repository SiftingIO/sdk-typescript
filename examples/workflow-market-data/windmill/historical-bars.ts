import { readHistorical, toCsv, type AssetClass, type Interval } from '../core.js';

/** Configure api_key as a secret variable reference in Windmill; never paste it into source. */
export async function main(api_key:string,asset_class:AssetClass,symbol:string,start:string,end:string,interval:Interval='1h',limit:number=300,cursor?:string){
  const page=await readHistorical(api_key,{asset_class,symbol,start,end,interval,limit,cursor});
  return {...page,csv:toCsv(page)};
}
