const {createTwelveDataProvider}=require('./twelve-data');const {createMassiveProvider}=require('./massive');const {createOandaProvider}=require('./oanda');
const REQUIRED={ 'twelve-data':'TWELVE_DATA_API_KEY',massive:'MASSIVE_API_KEY',oanda:'OANDA_API_TOKEN' };
function getProviderStatuses(env=process.env){return [
 {id:'twelve-data',name:'Twelve Data',status:env[REQUIRED['twelve-data']]?'configured':'not_configured',capabilities:['candles','stocks','forex','crypto'],keyVariable:REQUIRED['twelve-data']},
 {id:'massive',name:'Massive',status:env[REQUIRED.massive]?'configured':'not_configured',capabilities:['candles','stocks','etfs','forex','crypto','options','futures'],keyVariable:REQUIRED.massive},
 {id:'oanda',name:'OANDA',status:env[REQUIRED.oanda]?'configured':'not_configured',environment:env.OANDA_ENVIRONMENT==='live'?'live':'practice',capabilities:['candles','forex','cfds'],keyVariable:REQUIRED.oanda}
].map(item=>Object.freeze({...item}));}
function createProviderRegistry(options={}){const env=options.env||process.env;const overrides=options.providers||{};return Object.freeze({'twelve-data':overrides['twelve-data']||createTwelveDataProvider({apiKey:env.TWELVE_DATA_API_KEY,fetchImpl:options.fetchImpl}),'massive':overrides.massive||createMassiveProvider({apiKey:env.MASSIVE_API_KEY,fetchImpl:options.fetchImpl}),'oanda':overrides.oanda||createOandaProvider({apiToken:env.OANDA_API_TOKEN,environment:env.OANDA_ENVIRONMENT||'practice',fetchImpl:options.fetchImpl})});}
module.exports={getProviderStatuses,createProviderRegistry};
