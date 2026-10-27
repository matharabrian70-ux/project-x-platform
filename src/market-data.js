const BLOCKING_QUALITY_FLAGS = new Set(['STALE','MISSING','MISSING_OHLC','MALFORMED','CONTRADICTORY','UNAUTHENTICATED','UNENTITLED','INCOMPLETE']);
class MarketDataError extends Error { constructor(message, code='INVALID_MARKET_DATA') { super(message); this.name='MarketDataError'; this.code=code; } }
function toDate(value,label){const date=value instanceof Date?new Date(value.getTime()):new Date(value);if(!Number.isFinite(date.getTime()))throw new MarketDataError(label+' must be a valid timestamp');return date;}
function number(value,label){const parsed=Number(value);if(!Number.isFinite(parsed))throw new MarketDataError(label+' must be a finite number');return parsed;}
function normalizeCandle(input,{now=new Date(),maxAgeMs=null}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new MarketDataError('Candle must be an object');
 const provider=String(input.provider||'').trim().toLowerCase(),symbol=String(input.symbol||'').trim(),interval=String(input.interval||'').trim();
 if(!provider||!symbol||!interval)throw new MarketDataError('Candle provider, symbol, and interval are required');
 const timestamp=toDate(input.timestamp,'timestamp'),ingestedAt=toDate(input.ingestedAt||now,'ingestedAt'),clock=toDate(now,'now');
 if(timestamp.getTime()>clock.getTime()+60_000)throw new MarketDataError('Future-dated candle is blocked','FUTURE_DATA');
 if(ingestedAt.getTime()<timestamp.getTime())throw new MarketDataError('ingestedAt cannot precede candle timestamp');
 const qualityFlags=[...new Set((Array.isArray(input.qualityFlags)?input.qualityFlags:[]).map(flag=>String(flag).trim().toUpperCase()).filter(Boolean))];
 const blocked=qualityFlags.find(flag=>BLOCKING_QUALITY_FLAGS.has(flag));
 if(blocked)throw new MarketDataError('Candle blocked by provider quality flag: '+blocked,'QUALITY_BLOCKED');
 if(maxAgeMs!==null&&clock.getTime()-timestamp.getTime()>maxAgeMs)throw new MarketDataError('Stale candle is blocked','STALE_DATA');
 const open=number(input.open,'open'),high=number(input.high,'high'),low=number(input.low,'low'),close=number(input.close,'close');
 const volume=input.volume===null||input.volume===undefined?null:number(input.volume,'volume');
 if(high<low||high<Math.max(open,close)||low>Math.min(open,close))throw new MarketDataError('Contradictory OHLC values','CONTRADICTORY_DATA');
 if(volume!==null&&volume<0)throw new MarketDataError('volume cannot be negative');
 return Object.freeze({provider,symbol,interval,timestamp:timestamp.toISOString(),ingestedAt:ingestedAt.toISOString(),open,high,low,close,volume,qualityFlags:Object.freeze(qualityFlags)});
}
function validateCandleSeries(candles,{minimum=1}={}){
 if(!Array.isArray(candles)||candles.length<minimum)throw new MarketDataError('At least '+minimum+' candles are required','INSUFFICIENT_DATA');
 let previous=-Infinity;const seen=new Set();let identity=null;
 for(const candle of candles){if(!candle||typeof candle!=='object')throw new MarketDataError('Candle series contains an invalid record');const time=Date.parse(candle.timestamp);if(!Number.isFinite(time))throw new MarketDataError('Candle timestamp is invalid');const key=String(candle.provider)+'|'+String(candle.symbol)+'|'+String(candle.interval);if(identity===null)identity=key;else if(key!==identity)throw new MarketDataError('Candle series must use one provider, symbol, and interval');if(seen.has(time))throw new MarketDataError('Duplicate candle timestamp');if(time<previous)throw new MarketDataError('Candle series must be ordered oldest to newest');seen.add(time);previous=time;}
 return candles;
}
module.exports={BLOCKING_QUALITY_FLAGS,MarketDataError,normalizeCandle,validateCandleSeries};
