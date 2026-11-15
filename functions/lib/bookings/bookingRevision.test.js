"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingRevision_1 = require("./bookingRevision");
(0, node_test_1.describe)("booking revision", () => {
    (0, node_test_1.it)("accepts the revision that was loaded and rejects an older session", () => {
        const first = (0, bookingRevision_1.bookingRevisionDecision)({ revision: 0 }, 0);
        strict_1.default.equal(first.ok && first.revision, 1);
        const stale = (0, bookingRevision_1.bookingRevisionDecision)({ revision: 1 }, 0);
        strict_1.default.equal(stale.ok, false);
        const missing = (0, bookingRevision_1.bookingRevisionDecision)({}, 0);
        strict_1.default.equal(missing.ok && missing.revision, 1);
    });
});
