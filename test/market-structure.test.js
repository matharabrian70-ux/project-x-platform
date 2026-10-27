const test=require('node:test');
const assert=require('node:assert/strict');
const {analyzeStructure}=require('../src/market-structure');
function series(closes,highs,lows){const base=Date.parse('2026-10-27T00:00:00.000Z');return closes.map((close,index)=>Object.freeze({provider:'TEST FIXTURE',symbol:'TEST',interval:'1h',timestamp:new Date(base+index*3_600_000),ingestedAt:new Date(base+index*3_600_000+1000),open:close,high:highs[index],low:lows[index],close,volume:1,qualityFlags:Object.freeze([])}));}
test('returns no pivots until the right-side confirmation window is complete',()=>{const r=analyzeStructure(series([1,2,3,4],[2,4,3,5],[0,1,2,3]),{swingWindow:1});assert.equal(r.pivots.some(p=>p.index===3),false);});
test('emits a confirmed swing and a BOS when price closes through it',()=>{const r=analyzeStructure(series([10,12,11,13,15],[11,14,12,14,16],[9,10,9.5,12,14]),{swingWindow:1});assert.ok(r.pivots.some(p=>p.type==='swing_high'&&p.index===1));assert.ok(r.events.some(e=>e.type==='BOS'&&e.direction==='bullish'));});
test('rejects insufficient input and labels output heuristic',()=>{assert.throws(()=>analyzeStructure([],{swingWindow:1}),/at least/i);const r=analyzeStructure(series([1,2,1],[2,3,2],[0,1,0]),{swingWindow:1});assert.equal(r.method,'confirmed-fractal-heuristic-v1');});
