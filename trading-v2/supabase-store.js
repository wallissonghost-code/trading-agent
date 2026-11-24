// Server-only persistence adapter. No Supabase secrets go to the browser.
import { createAccount } from './paper.js';
export function createSupabaseStore({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,fetchFn=fetch,id='main'}={}){
 if(!url||!key)throw new Error('Supabase credentials not configured');
 const origin=new URL(url);
 if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co'))throw new Error('Invalid Supabase host');
 const base=new URL('/rest/v1/trading_paper_states',origin);
 const headers={'apikey':key,'Authorization':'Bearer '+key,'content-type':'application/json','accept':'application/json'};
 async function request(method,path,body,{ignoreDuplicates=false}={}){
   const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),8000);
   try{
    const response=await fetchFn(path,{method,headers:{...headers,...(method==='POST'?{'prefer':(ignoreDuplicates?'resolution=ignore-duplicates,return=representation':'resolution=merge-duplicates,return=representation')}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:ctrl.signal});
    const message=await response.text();
    if(!response.ok)throw new Error('Remote paper persistence HTTP '+response.status+': '+message.slice(0,120));
    return message?JSON.parse(message):null;
   }finally{clearTimeout(timeout);}
 }
 return {
  kind:'supabase',
  async recordMonitoringTransitions(symbols){
   if(!Array.isArray(symbols)||symbols.length!==3||
    symbols.some(x=>!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(x.symbol)||
    !['MONITORING','STALE_DATA','COLLECTION_ERROR','AWAITING_COLLECTION'].includes(x.status)))
    throw Error('Invalid monitoring status snapshot');
   const path=new URL('/rest/v1/rpc/trading_record_health_transitions',origin);
   const result=await request('POST',path,{p_portfolio:id,
    p_snapshot:symbols.map(x=>({symbol:x.symbol,status:x.status}))});
   if(result?.ok!==true||!Number.isInteger(result.transitions))
    throw Error('Monitoring event write not acknowledged');
   return result;
  },
  async listMonitoringEvents({limit=40}={}){
   const path=new URL('/rest/v1/trading_monitor_events',origin);
   path.searchParams.set('portfolio_id','eq.'+id);
   path.searchParams.set('select','symbol,previous_status,new_status,kind,recorded_at');
   path.searchParams.set('order','recorded_at.desc,id.desc');
   path.searchParams.set('limit',String(Math.max(1,Math.min(100,Number(limit)||40))));
   const rows=await request('GET',path);
   if(!Array.isArray(rows))throw Error('Invalid monitor event history');
   return rows;
  },
  async listMonitoringStates(){
   const path=new URL('/rest/v1/trading_monitor_state',origin);
   path.searchParams.set('portfolio_id','eq.'+id);
   path.searchParams.set('select','symbol,status,last_checked_at,status_changed_at');
   path.searchParams.set('order','symbol.asc');
   const rows=await request('GET',path);
   if(!Array.isArray(rows))throw Error('Invalid monitor state response');
   return rows;
  },
  async getFrozenShadowStudy(version='shadow-v1-20261124'){
   const path=new URL('/rest/v1/trading_shadow_studies',origin);
   path.searchParams.set('version','eq.'+version);
   path.searchParams.set('select','version,started_at,configs,fee_bps,slippage_bps,risk_budget_pct,max_exposure_pct,atr_multiplier,target_r_multiple,max_holding_bars,cooldown_bars');
   const rows=await request('GET',path);
   if(!Array.isArray(rows)||rows.length!==1)throw Error('Frozen shadow study unavailable');
   return rows[0];
  },
  async insertShadowObservation(record){
   if(!record||record.version!=='shadow-v1-20261124'||
    !['BTCUSDT','ETHUSDT','SOLUSDT'].includes(record.symbol)||
    ![record.candleOpenTime,record.candleCloseTime].every(Number.isSafeInteger)||
    ![record.candleOpen,record.candleClose,record.candleHigh,record.candleLow,record.atr14,record.stopDistance].every(Number.isFinite)||
    !record.signals||['reference','trend_confirmed','volatility_screen','combined'].some(key=>typeof record.signals[key]!=='boolean'))
     throw Error('Invalid frozen shadow observation');
   const path=new URL('/rest/v1/trading_shadow_candles',origin);
   const row={portfolio_id:id,version:record.version,symbol:record.symbol,
    candle_open_time:record.candleOpenTime,candle_close_time:record.candleCloseTime,
    candle_open:record.candleOpen,candle_high:record.candleHigh,candle_low:record.candleLow,
    candle_close:record.candleClose,atr14:record.atr14,
    stop_distance:record.stopDistance,signals:record.signals};
   const saved=await request('POST',path,row,{ignoreDuplicates:true});
   if(!Array.isArray(saved))throw Error('Frozen shadow archive did not acknowledge observation');
   return saved.length>0;
  },
  async listShadowObservations({limit=360}={}){
   const path=new URL('/rest/v1/trading_shadow_candles',origin);
   path.searchParams.set('portfolio_id','eq.'+id);
   path.searchParams.set('version','eq.shadow-v1-20261124');
   path.searchParams.set('select','symbol,candle_close_time,observed_at,signals');
   path.searchParams.set('order','candle_close_time.desc');
   path.searchParams.set('limit',String(Math.max(1,Math.min(360,Number(limit)||360))));
   const rows=await request('GET',path);
   if(!Array.isArray(rows))throw Error('Invalid prospective OHLC observations');
   return rows;
  },
  async listTimelineObservations({since,limit=1000}={}){
   if(!Number.isSafeInteger(since)||since<0)throw Error('Invalid observation cutoff');
   const path=new URL('/rest/v1/trading_shadow_candles',origin);
   path.searchParams.set('portfolio_id','eq.'+id);
   path.searchParams.set('version','eq.shadow-v1-20261124');
   path.searchParams.set('candle_close_time','gte.'+since);
   path.searchParams.set('select','symbol,candle_close_time,observed_at');
   path.searchParams.set('order','candle_close_time.desc');
   path.searchParams.set('limit',String(Math.max(1,Math.min(1000,Number(limit)||1000))));
   const rows=await request('GET',path);
   if(!Array.isArray(rows))throw Error('Invalid timeline observations');
   return rows;
  },
  async listStopReviewObservations({limit=600}={}){
   const path=new URL('/rest/v1/trading_shadow_candles',origin);
   path.searchParams.set('portfolio_id','eq.'+id);
   path.searchParams.set('version','eq.shadow-v1-20261124');
   path.searchParams.set('select','symbol,candle_close_time,candle_close,atr14');
   path.searchParams.set('order','candle_close_time.desc');
   path.searchParams.set('limit',String(Math.max(1,Math.min(1000,Number(limit)||600))));
   const rows=await request('GET',path);
   if(!Array.isArray(rows))throw Error('Invalid pre-signal observations');
   return rows;
  },
  async listShadowTrades({limit=500}={}){
   const path=new URL('/rest/v1/trading_shadow_trades',origin);
   path.searchParams.set('portfolio_id','eq.'+id);
   path.searchParams.set('version','eq.shadow-v1-20261124');
   path.searchParams.set('select','symbol,scenario,status,signal_candle_close_time,entry_fill,exit_fill,realized_pnl_usd,net_return_pct,entry_candle_open_time,exit_candle_close_time,exit_reason,stop_price,target_price');
   path.searchParams.set('order','created_at.desc');
   path.searchParams.set('limit',String(Math.max(1,Math.min(500,Number(limit)||500))));
   const rows=await request('GET',path);
   if(!Array.isArray(rows))throw Error('Invalid shadow trade report');
   return rows;
  },
  async getFrozenForwardStudy(version='filters-v1-20261124'){
   const path=new URL('/rest/v1/trading_forward_studies',origin);
   path.searchParams.set('version','eq.'+version);
   path.searchParams.set('select','version,started_at,configs,horizon_minutes,fees_bps,slippage_bps');
   const rows=await request('GET',path);
   if(!Array.isArray(rows)||rows.length!==1)throw Error('Frozen forward study unavailable');
   return rows[0];
  },
  async insertForwardObservation(record){
   if(!record||!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(record.symbol)||
     record.version!=='filters-v1-20261124'||!Number.isSafeInteger(record.candleCloseTime)||
     !Number.isSafeInteger(record.candleOpenTime))throw Error('Invalid prospective observation');
   const path=new URL('/rest/v1/trading_forward_candles',origin);
   const row={portfolio_id:id,version:record.version,symbol:record.symbol,
    candle_open_time:record.candleOpenTime,candle_close_time:record.candleCloseTime,
    candle_open:record.candleOpen,candle_close:record.candleClose,signals:record.signals};
   const saved=await request('POST',path,row,{ignoreDuplicates:true});
   if(!Array.isArray(saved))throw Error('Prospective observation not acknowledged');
   return saved.length>0;
  },
  async listForwardObservations({limit=180}={}){
   const path=new URL('/rest/v1/trading_forward_candles',origin);
   path.searchParams.set('portfolio_id','eq.'+id);
   path.searchParams.set('version','eq.filters-v1-20261124');
   path.searchParams.set('select','symbol,candle_close_time,observed_at,signals');
   path.searchParams.set('order','observed_at.desc');
   path.searchParams.set('limit',String(Math.max(1,Math.min(720,Number(limit)||180))));
   const rows=await request('GET',path);
   if(!Array.isArray(rows))throw Error('Invalid prospective observation list');
   return rows;
  },
  async listForwardOutcomes({limit=300}={}){
   const path=new URL('/rest/v1/trading_forward_outcomes',origin);
   path.searchParams.set('portfolio_id','eq.'+id);
   path.searchParams.set('version','eq.filters-v1-20261124');
   path.searchParams.set('select','symbol,scenario,signal_candle_close_time,observed_at,gross_return_pct,modeled_net_return_pct,evaluated_at');
   path.searchParams.set('order','evaluated_at.desc');
   path.searchParams.set('limit',String(Math.max(1,Math.min(1000,Number(limit)||300))));
   const rows=await request('GET',path);
   if(!Array.isArray(rows))throw Error('Invalid prospective outcomes');
   return rows;
  },
  async saveResearchReport(report){
   if(!report||!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(report.symbol)||!report.from||!report.to)throw Error('Invalid research report');
   const base=new URL('/rest/v1/trading_research_reports',origin);
   const rows=await request('POST',base,{portfolio_id:id,symbol:report.symbol,study_kind:'WALK_FORWARD_28D_V1',
    period_start:report.from,period_end:report.to,completed_at:new Date().toISOString(),report});
   if(!Array.isArray(rows)||rows.length!==1)throw Error('Research report save was not acknowledged');
   return rows[0];
  },
  async listResearchReports({limit=3}={}){
   const query=new URL('/rest/v1/trading_research_reports',origin);
   query.searchParams.set('portfolio_id','eq.'+id);
   query.searchParams.set('study_kind','eq.WALK_FORWARD_28D_V1');
   query.searchParams.set('select','report,completed_at');
   query.searchParams.set('order','completed_at.desc');
   query.searchParams.set('limit',String(Math.max(1,Math.min(15,Number(limit)||3))));
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw Error('Invalid research history response');
   return rows;
  },
  async saveNews(items){
   if(!Array.isArray(items)||items.length>45)throw Error('Invalid news batch');
   if(items.length===0)return [];
   const base=new URL('/rest/v1/trading_research_news',origin);
   const records=items.map(item=>({
    portfolio_id:id,source:item.source,url:item.url,title:item.title,published_at:item.publishedAt,
    fetched_at:item.fetchedAt,first_seen_at:item.fetchedAt,related_symbols:item.relatedSymbols,context_category:item.category
   }));
   const rows=await request('POST',base,records,{ignoreDuplicates:true});
   if(!Array.isArray(rows))throw Error('News archive write not acknowledged');
   return rows;
  },
  async listNews({limit=25}={}){
   const query=new URL('/rest/v1/trading_research_news',origin);
   query.searchParams.set('portfolio_id','eq.'+id);
   query.searchParams.set('select','source,url,title,published_at,fetched_at,first_seen_at,related_symbols,context_category');
   query.searchParams.set('order','published_at.desc');
   query.searchParams.set('limit',String(Math.max(1,Math.min(50,Number(limit)||25))));
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw Error('Invalid news archive response');
   return rows.map(row=>({
    source:row.source,url:row.url,title:row.title,publishedAt:row.published_at,
    fetchedAt:row.fetched_at,firstSeenAt:row.first_seen_at,relatedSymbols:row.related_symbols,category:row.context_category
   }));
  },
  async saveNewsOutcomes(outcomes){
   if(!Array.isArray(outcomes)||outcomes.length>90)throw Error('Invalid news outcome batch');
   if(!outcomes.length)return [];
   const path=new URL('/rest/v1/trading_news_price_outcomes',origin);
   const rows=outcomes.map(x=>({
    portfolio_id:id,source:x.source,url:x.url,symbol:x.symbol,
    observed_after:x.observedAfter,baseline_candle_open_time:x.baselineCandleOpenTime,
    baseline_price:x.baselinePrice,outcome_candle_close_time:x.outcomeCandleCloseTime,
    outcome_price:x.outcomePrice,horizon_minutes:60,return_pct:x.returnPct
   }));
   const saved=await request('POST',path,rows,{ignoreDuplicates:true});
   if(!Array.isArray(saved))throw Error('News outcomes not acknowledged');
   return saved;
  },
  async listNewsOutcomes({limit=100}={}){
   const query=new URL('/rest/v1/trading_news_price_outcomes',origin);
   query.searchParams.set('portfolio_id','eq.'+id);
   query.searchParams.set('select','source,url,symbol,observed_after,return_pct,baseline_price,outcome_price,evaluated_at');
   query.searchParams.set('order','evaluated_at.desc');
   query.searchParams.set('limit',String(Math.max(1,Math.min(150,Number(limit)||100))));
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw Error('Invalid news outcomes response');
   return rows.map(x=>({
    source:x.source,url:x.url,symbol:x.symbol,observedAfter:x.observed_after,
    returnPct:Number(x.return_pct),baselinePrice:Number(x.baseline_price),outcomePrice:Number(x.outcome_price),evaluatedAt:x.evaluated_at
   }));
  },
  async listSignalOutcomes({limit=100}={}){
   const query=new URL('/rest/v1/trading_paper_signal_outcomes',origin);
   query.searchParams.set('portfolio_id','eq.'+id);
   query.searchParams.set('select','symbol,signal,action,decision_candle_close_time,next_candle_return_pct,directional_correct,evaluated_at');
   query.searchParams.set('order','evaluated_at.desc');
   query.searchParams.set('limit',String(Math.max(1,Math.min(500,Number(limit)||100))));
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw new Error('Invalid signal evaluation response');
   return rows;
  },
  async listDecisions({limit=30}={}){
   const query=new URL('/rest/v1/trading_paper_decisions',origin);
   query.searchParams.set('portfolio_id','eq.'+id);
   query.searchParams.set('select','decision');
   query.searchParams.set('order','observed_at.desc');
   query.searchParams.set('limit',String(Math.max(1,Math.min(100,Number(limit)||30))));
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw new Error('Invalid decision journal response');
   return rows.map(row=>row.decision);
  },
  async listTrades({limit=50}={}){
   const query=new URL('/rest/v1/trading_paper_ledger',origin);
   query.searchParams.set('portfolio_id','eq.'+id);
   query.searchParams.set('select','trade');
   query.searchParams.set('order','executed_at.desc');
   query.searchParams.set('limit',String(Math.max(1,Math.min(100,Number(limit)||50))));
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw new Error('Invalid trade ledger response');
   return rows.map(row=>row.trade);
  },
  async load(){
   const query=new URL(base);query.searchParams.set('id','eq.'+id);query.searchParams.set('select','state');
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw new Error('Invalid remote state response');
   if(rows.length===0){
    const initial=createAccount();
    // Persist genesis immediately to prove remote storage is writable, even when market data is unavailable.
    const created=await request('POST',base,{id,state:initial,updated_at:new Date().toISOString()});
    if(!Array.isArray(created)||created.length!==1)throw new Error('Remote initialization not acknowledged');
    return created[0].state;
   }
   if(rows.length!==1)throw new Error('Duplicate remote paper state');
   const state=rows[0].state;
   if(state?.schema!==1||!Number.isFinite(state.cash)||state.cash<0||!state.positions||!state.lastCandle||!Array.isArray(state.trades))throw new Error('Invalid remote portfolio state');
   return state;
  },
  async save(state){
   const rows=await request('POST',base,{id,state,updated_at:new Date().toISOString()});
   if(!Array.isArray(rows)||rows.length!==1)throw new Error('Remote state not acknowledged');
  }
 };
}
