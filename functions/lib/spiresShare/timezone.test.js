"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const timezone_1 = require("./timezone");
(0, node_test_1.describe)("Europe/London timezone", () => {
    (0, node_test_1.it)("maps winter GMT wall time to UTC", () => {
        const iso = (0, timezone_1.londonDateTimeToUtcIso)("2026-01-15", "10:30");
        strict_1.default.equal(iso, "2026-01-15T10:30:00.000Z");
    });
    (0, node_test_1.it)("maps BST wall time to UTC minus one hour", () => {
        const iso = (0, timezone_1.londonDateTimeToUtcIso)("2026-10-13", "10:30");
        strict_1.default.equal(iso, "2026-10-13T09:30:00.000Z");
    });
    (0, node_test_1.it)("handles the autumn clock-change morning after GMT resumes", () => {
        const iso = (0, timezone_1.londonDateTimeToUtcIso)("2026-10-25", "01:30");
        strict_1.default.equal(iso, "2026-10-25T01:30:00.000Z");
    });
    (0, node_test_1.it)("subtracts confirmation hours from a UTC instant", () => {
        strict_1.default.equal((0, timezone_1.subtractHoursIso)("2026-10-13T09:30:00.000Z", 24), "2026-10-12T09:30:00.000Z");
    });
    (0, node_test_1.it)("builds a unique slot key", () => {
        strict_1.default.equal((0, timezone_1.slotKey)("heathrow", "2026-10-13", "10:30"), "heathrow_2026-10-13_1030");
    });
});
