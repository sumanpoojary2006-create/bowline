import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDateKey, calendarNightRate } from './hostCalendar.js';
const room={_id:'penthouse',type:'room',price:2000};
const rule = patch => ({active:true,name:'Seasonal',listing:null,listingType:'all',startDate:'2026-11-01',endDate:'2026-11-30',adjustmentType:'flat',adjustmentValue:100,priority:1,createdAt:'2026-01-01',...patch});
test('calendar dates preserve local calendar days including month boundaries', () => {
  assert.equal(calendarDateKey(new Date(2026,10,1)), '2026-11-01');
  assert.equal(calendarDateKey(new Date(2026,10,31)), '2026-12-01');
});
test('calendar rate uses manual override and rounds and clamps like checkout', () => {
  assert.equal(calendarNightRate({...room,manualPriceOverride:0},'2026-11-14',[]),0);
  assert.equal(calendarNightRate(room,'2026-11-14',[rule({adjustmentValue:-3000})]),0);
});
test('calendar filters inactive, unrelated and out of range rules', () => {
  const rules=[rule({active:false}),rule({listing:'another-room'}),rule({listingType:'camp'}),rule({endDate:'2026-11-13'}),rule({startDate:'2026-11-15'})];
  assert.equal(calendarNightRate(room,'2026-11-14',rules),2000);
});
test('weekend tariffs apply only on Saturday and Sunday, including populated listing ids', () => {
  const rules=[rule({name:'Weekend surcharge',listing:{_id:'penthouse'},adjustmentValue:200})];
  assert.equal(calendarNightRate(room,'2026-11-13',rules),2000);
  assert.equal(calendarNightRate(room,'2026-11-14',rules),2200);
  assert.equal(calendarNightRate(room,'2026-11-15',rules),2200);
});
test('priority and creation order match server when flat and percentage adjustments stack', () => {
  assert.equal(calendarNightRate(room,'2026-11-14',[rule({priority:1,adjustmentType:'percentage',adjustmentValue:10}),rule({priority:2,adjustmentValue:100})]),2310);
  assert.equal(calendarNightRate(room,'2026-11-30',[rule({createdAt:'2026-02-01',adjustmentValue:100}),rule({adjustmentType:'percentage',adjustmentValue:10})]),2310);
});
