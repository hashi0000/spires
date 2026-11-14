import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {ADS_ACCOUNT,finishedAdsDates,normalizeAdsReport,streamRows} from './googleAdsReport';
const metadata=[{customer:{id:ADS_ACCOUNT,currencyCode:'GBP',timeZone:'Europe/London'}}];
test('automatic reports cover finished London days, including summer clock changes',()=>{
  const dates=finishedAdsDates(Date.parse('2026-03-30T00:30:00Z'));
  assert.equal(dates.length,90);assert.equal(dates[dates.length-1],'2026-03-29');
  const summer=finishedAdsDates(Date.parse('2026-07-01T23:30:00Z'));
  assert.equal(summer[summer.length-1],'2026-07-01');
});
test('only successful account reports can establish zero-activity days',()=>{
  const dates=['2026-11-10','2026-11-11'];
  const rows=normalizeAdsReport(metadata,streamRows([{results:[{segments:{date:dates[0]},metrics:{costMicros:'10520000'}}]}]),dates);
  assert.equal(rows[0].costMicros,10520000);assert.equal(rows[1].costMicros,0);assert.equal(rows[1].completeDay,true);
  assert.throws(()=>streamRows({error:{}}));
  assert.throws(()=>streamRows([{error:{}}]));
  assert.throws(()=>normalizeAdsReport([{customer:{id:ADS_ACCOUNT,currencyCode:'USD',timeZone:'Europe/London'}}],[],dates));
  assert.throws(()=>normalizeAdsReport(metadata,[{segments:{date:dates[0]},metrics:{costMicros:'bad'}}],dates));
});
