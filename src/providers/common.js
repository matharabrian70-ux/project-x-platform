const {normalizeCandle,MarketDataError}=require('../market-data');
class ProviderError extends Error{constructor(provider,message,code='PROVIDER_ERROR',status=null){super(message);this.name='ProviderError';this.provider=provider;this.code=code;this.status=status;}}
function requireKey(value,provider){if(typeof value!=='string'||!value.trim())throw new ProviderError(provider,provider+' provider is not configured','NOT_CONFIGURED',503);return value.trim();}
function safeSymbol(symbol,provider){if(typeof symbol!=='string'||!symbol.trim()||symbol.length>64||/[\\r\\n]/.test(symbol))throw new ProviderError(provider,'Invalid market symbol','INVALID_INPUT',400);return symbol.trim();}
function parseProviderTime(value,provider){if(typeof value==='number'&&Number.isFinite(value))return new Date(value);let text=String(value||'').trim();if(/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(text))text=text.replace(' ','T')+'Z';const date=new Date(text);if(!Number.isFinite(date.getTime()))throw new ProviderError(provider,'Provider returned an invalid timestamp','INVALID_RESPONSE');return date;}
async function requestJson(provider,url,{apiKey,authScheme='Bearer',fetchImpl=globalThis.fetch,timeoutMs=12_000}={}){
 const key=requireKey(apiKey,provider);if(typeof fetchImpl!=='function')throw new ProviderError(provider,'Fetch is unavailable','FETCH_UNAVAILABLE',503);
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/json',Authorization:authScheme==='apikey'?'apikey '+key:authScheme+' '+key},signal:controller.signal});
  if(!response.ok)throw new ProviderError(provider,'Provider request failed with HTTP '+response.status,'UPSTREAM_HTTP_ERROR',response.status);
  let body;try{body=await response.json();}catch{throw new ProviderError(provider,'Provider returned invalid JSON','INVALID_RESPONSE',502);}
  return body;
 }catch(error){if(error instanceof ProviderError)throw error;if(error&&error.name==='AbortError')throw new ProviderError(provider,'Provider request timed out','TIMEOUT',504);throw new ProviderError(provider,'Provider request could not be completed','NETWORK_ERROR',502);}finally{clearTimeout(timer);}
}
function canonical(input,options){try{return normalizeCandle(input,options);}catch(error){if(error instanceof MarketDataError)throw new ProviderError(input.provider,'Provider candle failed market-data validation: '+error.message,'INVALID_MARKET_DATA',502);throw error;}}
module.exports={ProviderError,requireKey,safeSymbol,parseProviderTime,requestJson,canonical};
