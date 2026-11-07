"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const node_test_1 = require("node:test");
const journeyStats_1 = require("./journeyStats");
const NOW = new Date("2026-11-07T08:00:00Z");
(0, node_test_1.describe)("completed journey statistics", () => {
    (0, node_test_1.it)("uses the previous London calendar month", () => {
        const period = (0, journeyStats_1.previousCalendarMonth)(NOW);
        assert.equal(period.key, "2026-10");
        assert.equal(period.label, "October 2026");
    });
    (0, node_test_1.it)("counts completed legs in that month and keeps airports separate from the total", () => {
        const stats = (0, journeyStats_1.summariseJourneys)([
            {
                id: "a",
                status: "completed",
                bookingType: "return",
                returnTrip: true,
                pickupTime: "2026-10-10T09:00:00Z",
                returnPickupTime: "2026-10-20T16:00:00Z",
                pickupLocation: "Oxford",
                destination: "Heathrow Terminal 5",
                returnPickupLocation: "Heathrow Terminal 5",
                returnDestination: "Oxford",
            },
            {
                id: "b",
                status: "completed",
                pickupTime: "2026-10-02T10:00:00Z",
                pickupLocation: "Abingdon",
                destination: "Heathrow Terminal 2",
            },
            {
                id: "c",
                status: "pending",
                pickupTime: "2026-10-02T10:00:00Z",
                pickupLocation: "Oxford",
                destination: "Gatwick",
            },
            {
                id: "d",
                status: "cancelled",
                pickupTime: "2026-10-02T10:00:00Z",
                pickupLocation: "Oxford",
                destination: "Heathrow",
            },
            {
                id: "e",
                status: "completed",
                source: "test",
                pickupTime: "2026-10-02T10:00:00Z",
                pickupLocation: "Oxford",
                destination: "Heathrow",
            },
            {
                id: "f",
                status: "completed",
                pickupTime: "2026-11-02T10:00:00Z",
                pickupLocation: "Oxford",
                destination: "Heathrow",
            },
            {
                id: "g",
                status: "completed",
                pickupTime: "2026-10-04T08:00:00Z",
                pickupLocation: "Home",
                destination: "St Mary's School, Oxford",
            },
        ], NOW, "2026-11-07T08:00:00Z");
        assert.equal(stats.completedJourneys, 4);
        assert.equal(stats.airports.heathrow, 3);
        assert.equal(stats.areas.oxford, 2);
        assert.equal(stats.withheld, 1);
        assert.equal((0, journeyStats_1.isCompletedJourneyBooking)({ status: "allocated" }), false);
        const pub = (0, journeyStats_1.publicJourneyView)(stats);
        assert.equal(pub.completedJourneys, 4);
        assert.deepEqual(pub.airports, {});
        assert.equal("unclassified" in pub, false);
    });
    (0, node_test_1.it)("does not publish a category below five journeys", () => {
        const stats = (0, journeyStats_1.summariseJourneys)([
            {
                id: "one",
                status: "completed",
                pickupTime: "2026-10-02T10:00:00Z",
                pickupLocation: "Didcot",
                destination: "Gatwick South",
            },
        ], NOW, "2026-11-07T08:00:00Z");
        assert.equal(stats.completedJourneys, 1);
        assert.equal(stats.airports.gatwick, 1);
        assert.equal(stats.highlights.length, 0);
        const pub = (0, journeyStats_1.publicJourneyView)(stats);
        assert.deepEqual(pub.airports, {});
    });
    (0, node_test_1.it)("does not count the same stored leg twice", () => {
        const row = {
            id: "same",
            status: "completed",
            pickupTime: "2026-10-02T10:00:00Z",
            pickupLocation: "Oxford",
            destination: "Birmingham Airport",
        };
        const stats = (0, journeyStats_1.summariseJourneys)([row, { ...row }], NOW, "2026-11-07T08:00:00Z");
        assert.equal(stats.completedJourneys, 1);
    });
});
