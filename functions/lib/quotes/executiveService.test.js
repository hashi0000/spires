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
const emails_1 = require("./emails");
(0, node_test_1.describe)("executive Heathrow service", () => {
    (0, node_test_1.it)("is open and can still be switched off for a check", () => {
        const previous = process.env.EXECUTIVE_SERVICE_ENABLED;
        delete process.env.EXECUTIVE_SERVICE_ENABLED;
        strict_1.default.equal(executiveService_1.EXECUTIVE_SERVICE_ENABLED, true);
        strict_1.default.equal((0, executiveService_1.executiveServiceEnabled)(), true);
        strict_1.default.equal((0, executiveService_1.executiveServiceEnabled)(false), false);
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
        const mixed = (0, executiveService_1.classifyExecutiveJourney)({
            pickup: "Oxford",
            destination: "Heathrow",
            returnPickup: "Gatwick",
            returnDestination: "Oxford",
            bookingType: "return",
        });
        strict_1.default.equal(mixed.ok, true);
        if (mixed.ok) {
            strict_1.default.equal(mixed.fareStatus, "quote_required");
            strict_1.default.equal((0, executiveService_1.proposedExecutiveFare)(mixed, "return"), null);
        }
        const townToHeathrow = (0, executiveService_1.classifyExecutiveJourney)({ pickup: "Heathrow Terminal 5", destination: "Oxford" });
        strict_1.default.equal(townToHeathrow.ok, true);
        if (townToHeathrow.ok)
            strict_1.default.equal((0, executiveService_1.proposedExecutiveFare)(townToHeathrow, "one_way"), 150);
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
            Event: function Event() { },
            document: {
                readyState: "complete",
                querySelectorAll: () => [],
                getElementById: () => null,
                addEventListener: () => { },
                dispatchEvent: () => { },
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
        strict_1.default.equal(ctx.window.SPIRES_EXECUTIVE_SERVICE_ENABLED, true);
        strict_1.default.equal(code.includes("standardCar: { oneWay: 92, return: 180 }"), true);
        const servicePage = node_fs_1.default.readFileSync(node_path_1.default.join(__dirname, '../../../spires-website/executive-travel.html'), 'utf8');
        strict_1.default.match(servicePage, /Mercedes E Class or equivalent/);
        strict_1.default.match(servicePage, /Cotswolds/);
        strict_1.default.equal(code.includes("vito: { oneWay: 120, return: 235 }"), true);
    });
    (0, node_test_1.it)("walks a synthetic Executive request through confirmation", () => {
        strict_1.default.equal(executiveService_1.EXECUTIVE_SERVICE_ENABLED, true);
        const closed = (0, executiveService_1.assessExecutiveBooking)({
            pickup: "Oxford",
            destination: "Heathrow Terminal 5",
            passengers: 2,
            bookingType: "one_way",
            enabled: false,
        });
        strict_1.default.equal(closed.ok, false);
        const request = (0, executiveService_1.assessExecutiveBooking)({
            pickup: "Oxford",
            destination: "Heathrow Terminal 5",
            passengers: 2,
            bookingType: "one_way",
            enabled: true,
        });
        strict_1.default.equal(request.ok, true);
        if (!request.ok)
            return;
        strict_1.default.equal(request.fields.executiveAvailability, "awaiting_confirmation");
        strict_1.default.equal(request.fields.proposedFarePounds, 150);
        strict_1.default.equal((0, executiveService_1.executiveCommerceBlocked)({ vehicleType: "executive", executiveAvailability: "awaiting_confirmation" }), true);
        const requestEmail = (0, emails_1.guestRequestEmailHtml)({
            name: "Alex Example",
            bookingNumber: "SYN-EXEC-HEATHROW",
            claimUrl: "",
            hasPhone: true,
            executive: true,
            proposedFare: "£150.00",
        });
        strict_1.default.equal(requestEmail.includes(executiveService_1.EXECUTIVE_CUSTOMER_WORDING), true);
        strict_1.default.equal(requestEmail.includes(executiveService_1.EXECUTIVE_PARTNER_NOTE), true);
        strict_1.default.equal(requestEmail.includes("not a confirmed booking"), true);
        const quote = (0, emails_1.quoteEmailHtml)({
            bookingNumber: "SYN-EXEC-HEATHROW",
            customerName: "Alex Example",
            vehicleLabel: "Executive Car",
            outbound: "Oxford to Heathrow Terminal 5",
            returnLeg: "",
            normalFare: "£150.00",
            discount: "£0.00",
            finalFare: "£150.00",
            validUntil: "",
            paymentRequirement: "later",
            paymentDescription: "",
            amountRequested: "£150.00",
            quoteUrl: "https://www.spires-taxis.com/quote?t=synthetic",
            paymentUrl: "",
            terms: "This quote is not a confirmed booking. The journeys are subject to availability.",
        });
        strict_1.default.equal(quote.includes("Vehicle category: Executive Car"), true);
        strict_1.default.equal(quote.includes("£92"), false);
        const confirmed = (0, emails_1.acceptanceCustomerHtml)({
            bookingNumber: "SYN-EXEC-HEATHROW",
            customerName: "Alex Example",
            confirmed: true,
            finalFare: "£150.00",
            vehicleNote: `${executiveService_1.EXECUTIVE_CUSTOMER_WORDING} ${executiveService_1.EXECUTIVE_PARTNER_NOTE}`,
        });
        strict_1.default.equal(confirmed.includes("is confirmed"), true);
        strict_1.default.equal(confirmed.includes(executiveService_1.EXECUTIVE_PARTNER_NOTE), true);
        strict_1.default.equal((0, executiveService_1.executiveCommerceBlocked)({ vehicleType: "executive", executiveAvailability: "accepted" }), false);
        strict_1.default.equal((0, executiveService_1.executiveCommerceBlocked)({ vehicleType: "standard" }), false);
    });
});
