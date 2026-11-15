"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const assignmentReview_1 = require("./assignmentReview");
(0, node_test_1.describe)("assignment review", () => {
    (0, node_test_1.it)("warns on a stored MOT date and does not treat that date as a live expiry", () => {
        const review = (0, assignmentReview_1.assignmentReview)({ available: true, registration: "AB12 CDE", motExpiry: "2020-01-01" }, new Date("2026-11-14T12:00:00Z"));
        strict_1.default.equal(review.block, false);
        strict_1.default.match(review.notes.join(" "), /Stored MOT date needs review/);
        strict_1.default.match(review.notes.join(" "), /date on file/);
    });
    (0, node_test_1.it)("blocks a vehicle that is off the fleet", () => {
        const review = (0, assignmentReview_1.assignmentReview)({ available: false, registration: "AB12 CDE" }, new Date("2026-11-14T12:00:00Z"));
        strict_1.default.equal(review.block, true);
        strict_1.default.match(review.notes.join(" "), /off the fleet/);
    });
});
