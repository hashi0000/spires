"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_test_1 = require("node:test");
const eventTime_1 = require("./eventTime");
(0, node_test_1.test)('a delayed confirmation preserves its persisted time; missing times use the write time', () => {
    node_assert_1.strict.equal((0, eventTime_1.measurementEventTime)({ toMillis: () => 1000 }, 2000), 1000);
    for (const value of [null, undefined, NaN, 0, 3000])
        node_assert_1.strict.equal((0, eventTime_1.measurementEventTime)(value, 2000), 2000);
});
