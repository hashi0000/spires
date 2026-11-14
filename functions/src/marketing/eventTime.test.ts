import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { measurementEventTime } from './eventTime';
test('a delayed confirmation preserves its persisted time; missing times use the write time', () => {
  assert.equal(measurementEventTime({toMillis:()=>1000}, 2000),1000);
  for (const value of [null, undefined, NaN, 0, 3000]) assert.equal(measurementEventTime(value,2000),2000);
});
