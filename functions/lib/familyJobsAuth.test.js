"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const familyJobsAuthLogic_1 = require("./familyJobsAuthLogic");
(0, node_test_1.describe)("family jobs PIN helpers", () => {
    (0, node_test_1.it)("accepts 4 to 8 digit pins and strips spaces", () => {
        strict_1.default.equal((0, familyJobsAuthLogic_1.normalizeFamilyPin)(" 12 34 "), "1234");
        strict_1.default.equal((0, familyJobsAuthLogic_1.isPlausibleFamilyPin)("1234"), true);
        strict_1.default.equal((0, familyJobsAuthLogic_1.isPlausibleFamilyPin)("12345678"), true);
        strict_1.default.equal((0, familyJobsAuthLogic_1.isPlausibleFamilyPin)("123"), false);
        strict_1.default.equal((0, familyJobsAuthLogic_1.isPlausibleFamilyPin)("abcdef"), false);
    });
    (0, node_test_1.it)("matches pins without leaking length via a cheap string compare", () => {
        strict_1.default.equal((0, familyJobsAuthLogic_1.familyPinsMatch)("2468", "2468"), true);
        strict_1.default.equal((0, familyJobsAuthLogic_1.familyPinsMatch)("2468", "2469"), false);
        strict_1.default.equal((0, familyJobsAuthLogic_1.familyPinsMatch)("", "2468"), false);
    });
    (0, node_test_1.it)("reads the first forwarded IP", () => {
        strict_1.default.equal((0, familyJobsAuthLogic_1.clientIpFromRequest)({
            ip: "10.0.0.1",
            headers: { "x-forwarded-for": "8.8.8.8, 1.1.1.1" },
        }), "8.8.8.8");
    });
});
