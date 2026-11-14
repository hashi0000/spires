"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const consent_1 = require("./consent");
(0, node_test_1.test)('withdrawal tokens are opaque capabilities and account withdrawal covers older consent only', () => {
    const receipt = '12345678-1234-4234-8234-123456789012';
    node_assert_1.strict.equal((0, consent_1.receiptKey)(receipt)?.length, 64);
    node_assert_1.strict.notEqual((0, consent_1.receiptKey)(receipt), receipt);
    for (const value of ['', null, 'fixture@example.test', '12345678-1234-1234-1234-123456789012'])
        node_assert_1.strict.equal((0, consent_1.receiptKey)(value), null);
    node_assert_1.strict.equal((0, consent_1.accountConsentWithdrawn)({ consentAt: 100, consentGrantedAt: 50 }, 75), true);
    node_assert_1.strict.equal((0, consent_1.accountConsentWithdrawn)({ consentAt: 100, consentGrantedAt: 90 }, 75), false);
    node_assert_1.strict.equal((0, consent_1.accountConsentWithdrawn)({ consentAt: 50 }, 75), true);
});
