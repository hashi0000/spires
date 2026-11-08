"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const journeyStops_1 = require("./journeyStops");
(0, node_test_1.describe)("journey stops", () => {
    (0, node_test_1.it)("keeps an older pickup and destination as two stops", () => {
        const stops = (0, journeyStops_1.normaliseStops)(undefined, "Oxford", "Heathrow");
        strict_1.default.equal(stops.length, 2);
        strict_1.default.equal((0, journeyStops_1.validateStops)(stops), null);
        strict_1.default.match((0, journeyStops_1.describeStops)(stops), /1\. Pickup: Oxford/);
    });
    (0, node_test_1.it)("rejects a journey that does not start and end correctly", () => {
        const stops = (0, journeyStops_1.normaliseStops)([
            { type: "dropoff", address: "Oxford" },
            { type: "pickup", address: "Heathrow" },
        ]);
        strict_1.default.equal((0, journeyStops_1.validateStops)(stops), "The journey needs to start with a pickup.");
    });
    (0, node_test_1.it)("describes an open return without inventing a pickup time", () => {
        const text = (0, journeyStops_1.openReturnSummary)({ openReturn: true, returnDate: "2026-11-20", returnPickupTime: "", returnNoticeNote: "Customer will contact the driver when ready" });
        strict_1.default.match(text, /Open return on 2026-11-20/);
        strict_1.default.match(text, /Return time to be confirmed/);
        strict_1.default.match(text, /at least 30 minutes/);
        strict_1.default.match(text, /outside Oxford/);
        strict_1.default.doesNotMatch(text, /00:00/);
    });
    (0, node_test_1.it)("lists every extra pickup and drop off for an email", () => {
        const text = (0, journeyStops_1.emailJourneyText)({
            pickupLocation: "1 High Street, Oxford",
            destination: "Heathrow Terminal 5",
            bookingType: "return",
            openReturn: true,
            returnDate: "2026-11-21",
            returnPickupTime: "",
            stops: [
                { type: "pickup", address: "1 High Street, Oxford", notes: "Wait at the door" },
                { type: "pickup", address: "Headington, Oxford" },
                { type: "dropoff", address: "Heathrow Terminal 5" },
            ],
            returnStops: [
                { type: "pickup", address: "Heathrow Terminal 5" },
                { type: "dropoff", address: "Summertown, Oxford" },
                { type: "dropoff", address: "1 High Street, Oxford" },
            ],
        });
        strict_1.default.match(text, /Wait at the door/);
        strict_1.default.match(text, /Headington, Oxford/);
        strict_1.default.match(text, /Summertown, Oxford/);
        strict_1.default.match(text, /Return time to be confirmed/);
        strict_1.default.match(text, /Extra stops. Agree the fare/);
    });
});
