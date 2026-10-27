const test=require('node:test');
const assert=require('node:assert/strict');
const {MarketDataError,normalizeCandle,validateCandleSeries}=require('../src/market-data');
const now=new Date('2026-10-27T12:00:00.000Z');
const candle=(overrides={})=>({provider:'fixture',symbol:'EUR/USD',interval:'1h',timestamp:'2026-10-27T11:00:00.000Z',ingestedAt:'2026-10-27T11:59:00.000Z',open:1.08,high:1.10,low:1.07,close:1.09,volume:100,qualityFlags:[],...overrides});
test('normalizes a valid provider candle to a frozen canonical record',()=>{const c=normalizeCandle(candle(),{now});assert.equal(c.symbol,'EUR/USD');assert.equal(c.open,1.08);assert.equal(c.timestamp,'2026-10-27T11:00:00.000Z');assert.ok(Object.isFrozen(c));assert.ok(Object.isFrozen(c.qualityFlags));});
test('rejects impossible OHLC, non-finite values, and negative volume',()=>{for(const c of [candle({low:1.11}),candle({close:Number.NaN}),candle({volume:-1})])assert.throws(()=>normalizeCandle(c,{now}),MarketDataError);});
test('blocks stale, future, and provider-flagged observations',()=>{assert.throws(()=>normalizeCandle(candle({timestamp:'2026-10-27T10:00:00.000Z'}),{now,maxAgeMs:30*60_000}),/stale/i);assert.throws(()=>normalizeCandle(candle({timestamp:'2026-10-27T12:02:00.000Z'}),{now}),/future/i);assert.throws(()=>normalizeCandle(candle({qualityFlags:['unauthenticated']}),{now}),/unauthenticated/i);});
test('requires ordered, unique canonical candles for analysis',()=>{const a=normalizeCandle(candle(),{now});const b=normalizeCandle(candle({timestamp:'2026-10-27T11:30:00.000Z'}),{now});assert.throws(()=>validateCandleSeries([b,a]),/ordered/i);assert.throws(()=>validateCandleSeries([a,a]),/duplicate/i);assert.deepEqual(validateCandleSeries([a]),[a]);});
