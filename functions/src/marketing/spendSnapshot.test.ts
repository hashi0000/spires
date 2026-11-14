import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spendSnapshotTotal,SpendSnapshot} from './spendSnapshot';
test('spend requires complete, fresh, single-account coverage; explicit zero is valid',()=>{
  const now=1800000000000;
  const row:SpendSnapshot={date:'2026-11-10',accountId:'7328566496',currency:'GBP',costMicros:10520000,retrievedAtMs:now,provenance:'supermetrics_google_ads',reportingTimezone:'Europe/London',completeDay:true};
  const zero={...row,date:'2026-11-11',costMicros:0};
  assert.equal(spendSnapshotTotal(row.date,zero.date,[row,zero],now).spendPence,1052);
  for (const rows of [[row],[row,{...zero,currency:'USD'}],[row,{...zero,retrievedAtMs:now-49*3600000}],[row,zero,zero],[row,{...zero,costMicros:NaN}]]) assert.equal(spendSnapshotTotal(row.date,zero.date,rows,now).available,false);
  assert.equal(spendSnapshotTotal('2026-02-30','2026-03-01',[],now).available,false);
});
