const {validateCandleSeries,MarketDataError}=require('./market-data');
function timeText(value){return new Date(value).toISOString();}
function analyzeStructure(candles,{swingWindow=2}={}){
 if(!Number.isInteger(swingWindow)||swingWindow<1||swingWindow>10)throw new MarketDataError('swingWindow must be an integer from 1 to 10');
 validateCandleSeries(candles,{minimum:2*swingWindow+1});
 const pivots=[];const byIndex=new Map();
 for(let i=swingWindow;i<candles.length-swingWindow;i++){
  const current=candles[i];let swingHigh=true,swingLow=true;
  for(let j=i-swingWindow;j<=i+swingWindow;j++){if(j===i)continue;if(current.high<=candles[j].high)swingHigh=false;if(current.low>=candles[j].low)swingLow=false;}
  if(swingHigh){const p={type:'swing_high',index:i,confirmedAt:i+swingWindow,level:current.high,timestamp:timeText(current.timestamp)};pivots.push(p);byIndex.set(i+':high',p);}
  if(swingLow){const p={type:'swing_low',index:i,confirmedAt:i+swingWindow,level:current.low,timestamp:timeText(current.timestamp)};pivots.push(p);byIndex.set(i+':low',p);}
 }
 let trend='range';const consumed=new Set();const events=[];
 for(let i=0;i<candles.length;i++){
  const current=candles[i];
  for(const pivot of pivots){if(pivot.confirmedAt>i||consumed.has(pivot.type+':'+pivot.index))continue;
   const brokeHigh=pivot.type==='swing_high'&&current.close>pivot.level&&i>pivot.index;
   const brokeLow=pivot.type==='swing_low'&&current.close<pivot.level&&i>pivot.index;
   if(!brokeHigh&&!brokeLow)continue;
   const direction=brokeHigh?'bullish':'bearish';
   events.push({type:trend!=='range'&&trend!==direction?'CHOCH':'BOS',direction,index:i,timestamp:timeText(current.timestamp),level:pivot.level,pivotIndex:pivot.index,confirmedPivotAt:pivot.confirmedAt});
   trend=direction;consumed.add(pivot.type+':'+pivot.index);
  }
 }
 return {method:'confirmed-fractal-heuristic-v1',symbol:candles[0].symbol,interval:candles[0].interval,asOf:timeText(candles.at(-1).timestamp),trend,pivots,events,disclaimer:'OHLC-based structure heuristic; it does not reveal institutional order flow or hidden liquidity.'};
}
module.exports={analyzeStructure};
