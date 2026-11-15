"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = require("node:test");
const node_vm_1 = __importDefault(require("node:vm"));
const executiveService_1 = require("./executiveService");
(0, node_test_1.describe)("executive Heathrow service", () => {
    (0, node_test_1.it)("stays disabled unless a caller or the local emulator turns it on", () => {
        const previous = process.env.EXECUTIVE_SERVICE_ENABLED;
        delete process.env.EXECUTIVE_SERVICE_ENABLED;
        strict_1.default.equal(executiveService_1.EXECUTIVE_SERVICE_ENABLED, false);
        strict_1.default.equal((0, executiveService_1.executiveServiceEnabled)(), false);
        strict_1.default.equal((0, executiveService_1.executiveServiceEnabled)(true), true);
        process.env.EXECUTIVE_SERVICE_ENABLED = "true";
        strict_1.default.equal((0, executiveService_1.executiveServiceEnabled)(), true);
        if (previous === undefined)
            delete process.env.EXECUTIVE_SERVICE_ENABLED;
        else
            process.env.EXECUTIVE_SERVICE_ENABLED = previous;
    });
    (0, node_test_1.it)("publishes the five Heathrow areas and leaves other areas unpriced", () => {
        const oxford = (0, executiveService_1.classifyExecutiveJourney)({ pickup: "Oxford", destination: "Heathrow" });
        strict_1.default.equal(oxford.ok, true);
        if (!oxford.ok)
            return;
        strict_1.default.equal(oxford.fareStatus, "published");
        strict_1.default.equal((0, executiveService_1.proposedExecutiveFare)(oxford, "one_way"), 150);
        strict_1.default.equal((0, executiveService_1.proposedExecutiveFare)(oxford, "return"), 290);
        strict_1.default.deepEqual(executiveService_1.EXECUTIVE_AREAS.abingdon, { oneWay: 165, return: 320 });
        strict_1.default.deepEqual(executiveService_1.EXECUTIVE_AREAS.didcot, { oneWay: 170, return: 330 });
        strict_1.default.deepEqual(executiveService_1.EXECUTIVE_AREAS.bicester, { oneWay: 170, return: 330 });
        strict_1.default.deepEqual(executiveService_1.EXECUTIVE_AREAS.witney, { oneWay: 170, return: 330 });
        const other = (0, executiveService_1.classifyExecutiveJourney)({ pickup: "Banbury", destination: "LHR" });
        strict_1.default.equal(other.ok, true);
        if (!other.ok)
            return;
        strict_1.default.equal(other.fareStatus, "quote_required");
        strict_1.default.equal((0, executiveService_1.proposedExecutiveFare)(other, "one_way"), null);
    });
    (0, node_test_1.it)("allows Heathrow only and blocks commerce until acceptance", () => {
        strict_1.default.equal((0, executiveService_1.classifyExecutiveJourney)({ pickup: "Oxford", destination: "Gatwick" }).ok, false);
        strict_1.default.equal((0, executiveService_1.classifyExecutiveJourney)({ pickup: "Oxford", destination: "Stansted Airport" }).ok, false);
        strict_1.default.equal((0, executiveService_1.classifyExecutiveJourney)({ pickup: "Oxford station", destination: "London" }).ok, false);
        const passengers = (0, executiveService_1.assessExecutiveBooking)({ pickup: "Oxford", destination: "Heathrow", passengers: 0, enabled: true });
        strict_1.default.equal(passengers.ok, false);
        const ready = (0, executiveService_1.assessExecutiveBooking)({ pickup: "Abingdon", destination: "Heathrow Terminal 5", passengers: 3, bookingType: "return", enabled: true });
        strict_1.default.equal(ready.ok, true);
        if (!ready.ok)
            return;
        strict_1.default.equal(ready.fields.proposedFarePounds, 320);
        strict_1.default.equal(ready.fields.executiveAvailability, "awaiting_confirmation");
        strict_1.default.equal((0, executiveService_1.executiveCommerceBlocked)({ vehicleType: "executive", executiveAvailability: "awaiting_confirmation" }), true);
        strict_1.default.equal((0, executiveService_1.executiveCommerceBlocked)({ vehicleType: "executive", executiveAvailability: "accepted" }), false);
        strict_1.default.equal((0, executiveService_1.executiveCommerceBlocked)({ vehicleType: "standard" }), false);
    });
    (0, node_test_1.it)("matches the website fare source", () => {
        const code = node_fs_1.default.readFileSync(node_path_1.default.join(__dirname, "../../../spires-website/js/airport-prices.js"), "utf8");
        const ctx = {
            window: {},
            document: {
                readyState: "complete",
                querySelectorAll: () => [],
                getElementById: () => null,
                addEventListener: () => { },
            },
        };
        node_vm_1.default.runInNewContext(code, ctx);
        const website = ctx.window.SPIRES_classifyExecutive;
        const pairs = [
            ["Oxford", "Heathrow"],
            ["Abingdon", "Heathrow"],
            ["Didcot", "Heathrow"],
            ["Bicester", "Heathrow"],
            ["Witney", "Heathrow"],
            ["Kidlington", "Heathrow"],
            ["Oxford", "Gatwick"],
        ];
        for (const [pickup, destination] of pairs) {
            strict_1.default.deepEqual(JSON.parse(JSON.stringify(website({ pickup, destination }))), JSON.parse(JSON.stringify((0, executiveService_1.classifyExecutiveJourney)({ pickup, destination }))));
        }
        strict_1.default.equal(ctx.window.SPIRES_EXECUTIVE_SERVICE_ENABLED, false);
    });
});
