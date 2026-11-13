import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {receiptKey,accountConsentWithdrawn} from './consent';
test('withdrawal tokens are opaque capabilities and account withdrawal covers older consent only',()=>{
  const receipt='12345678-1234-4234-8234-123456789012';
  assert.equal(receiptKey(receipt)?.length,64);
  assert.notEqual(receiptKey(receipt),receipt);
  for(const value of ['',null,'fixture@example.test','12345678-1234-1234-1234-123456789012'])assert.equal(receiptKey(value),null);
  assert.equal(accountConsentWithdrawn({consentAt:100,consentGrantedAt:50},75),true);
  assert.equal(accountConsentWithdrawn({consentAt:100,consentGrantedAt:90},75),false);
  assert.equal(accountConsentWithdrawn({consentAt:50},75),true);
});
