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
const journeyMap_1 = require("./journeyMap");
const STREET = "8 Breakspear Close, Grove, Wantage, OX12 7FS";
(0, node_test_1.describe)("journey map places", () => {
    (0, node_test_1.it)("opens on the latest finished month", () => {
        assert.equal((0, journeyMap_1.defaultMapMonth)(["2026-11", "2026-10", "2026-09"], new Date("2026-11-11T12:00:00Z")), "2026-10");
        assert.equal((0, journeyMap_1.defaultMapMonth)(["2026-11"], new Date("2026-11-11T12:00:00Z")), "2026-11");
    });
    (0, node_test_1.it)("keeps a postcode district and drops the street and house number", () => {
        const place = (0, journeyMap_1.approximatePlace)(STREET);
        assert.deepEqual(place, { label: "Wantage", outcode: "OX12", kind: "area" });
        assert.equal((0, journeyMap_1.outwardCode)("OX1 1EB"), "OX1");
        assert.equal((0, journeyMap_1.approximatePlace)("Terminal 5"), null);
    });
    (0, node_test_1.it)("names an airport without using the full terminal postcode as the label", () => {
        assert.deepEqual((0, journeyMap_1.approximatePlace)("Heathrow Terminal 5, TW6 2GA"), {
            label: "Heathrow",
            outcode: "TW6",
            kind: "airport",
        });
    });
    (0, node_test_1.it)("uses a town only when no exact postcode district is written", () => {
        assert.deepEqual((0, journeyMap_1.approximatePlace)("Oxford"), { label: "Oxford", outcode: "OX1", kind: "area" });
        assert.equal((0, journeyMap_1.approximatePlace)("Oxford, OX2 6NN")?.outcode, "OX2");
        assert.equal((0, journeyMap_1.approximatePlace)("Oxford, OX2 6NN")?.label, "Oxford");
    });
});
(0, node_test_1.describe)("journey map aggregation", () => {
    (0, node_test_1.it)("draws one record per completed journey and leaves the rest out", () => {
        const drafts = (0, journeyMap_1.draftJourneyMap)([
            {
                id: "done",
                status: "completed",
                pickupTime: "2026-10-10T09:00:00Z",
                pickupLocation: STREET,
                destination: "Heathrow Terminal 5",
                hirerName: "Secret Name",
            },
            {
                id: "same",
                status: "completed",
                pickupTime: "2026-10-11T09:00:00Z",
                pickupLocation: "Oxford",
                destination: "Heathrow Terminal 2",
            },
            {
                id: "same",
                status: "completed",
                pickupTime: "2026-10-11T09:00:00Z",
                pickupLocation: "Oxford",
                destination: "Heathrow Terminal 2",
            },
            {
                id: "pending",
                status: "pending",
                pickupTime: "2026-10-12T09:00:00Z",
                pickupLocation: "Oxford",
                destination: "Gatwick",
            },
            {
                id: "cancelled",
                status: "cancelled",
                pickupTime: "2026-10-12T09:00:00Z",
                pickupLocation: "Oxford",
                destination: "Gatwick",
            },
            {
                id: "confirmed",
                status: "confirmed",
                pickupTime: "2026-10-12T09:00:00Z",
                pickupLocation: "Oxford",
                destination: "Gatwick",
            },
            {
                id: "school",
                status: "completed",
                pickupTime: "2026-10-13T08:00:00Z",
                pickupLocation: "Home",
                destination: "St Mary's School, Oxford",
            },
            {
                id: "unknown",
                status: "completed",
                pickupTime: "2026-10-14T08:00:00Z",
                pickupLocation: "The house",
                destination: "The hotel",
            },
            {
                id: "nov",
                status: "completed",
                pickupTime: "2026-11-02T10:00:00Z",
                pickupLocation: "Didcot",
                destination: "Gatwick South",
            },
        ]);
        assert.equal(drafts[0].key, "2026-11");
        assert.equal(drafts[1].key, "2026-10");
        assert.equal(drafts[1].completedJourneys, 4);
        assert.equal(drafts[1].routes.length, 2);
        const pub = (0, journeyMap_1.materialiseJourneyMap)(drafts, new Map([
            ["OX12", { lat: 51.597, lng: -1.425 }],
            ["TW6", { lat: 51.47, lng: -0.454 }],
            ["OX1", { lat: 51.752, lng: -1.258 }],
            ["OX11", { lat: 51.608, lng: -1.245 }],
            ["RH6", { lat: 51.154, lng: -0.182 }],
        ]));
        const october = pub.months.find((month) => month.key === "2026-10");
        assert.ok(october);
        assert.equal(october.mappedJourneys, 2);
        assert.equal(october.routes[0].from, "Wantage");
        assert.equal(october.routes[0].to, "Heathrow");
        assert.deepEqual(october.airports, ["Heathrow"]);
        const serialised = JSON.stringify((0, journeyMap_1.publicJourneyMapView)({ latest: pub.latest, updatedAt: "2026-11-11T00:00:00Z", months: pub.months }, october, "2026-10"));
        assert.equal(serialised.includes("Breakspear"), false);
        assert.equal(serialised.includes("7FS"), false);
        assert.equal(serialised.includes("Secret"), false);
        assert.equal(serialised.includes("hirer"), false);
        assert.equal(pub.latest, "2026-11");
    });
    (0, node_test_1.it)("does not invent a point when the district lookup fails", async () => {
        const fetcher = (async () => new Response(JSON.stringify({ status: 404, result: null }), { status: 404 }));
        const points = await (0, journeyMap_1.lookupOutcodePoints)(["ZZ99"], fetcher);
        assert.equal(points.size, 0);
        const mapped = (0, journeyMap_1.materialiseJourneyMap)([
            {
                key: "2026-10",
                label: "October 2026",
                completedJourneys: 1,
                destinations: [],
                airports: [],
                routes: [{
                        date: "2026-10-10",
                        from: "Oxford",
                        to: "Heathrow",
                        fromKind: "area",
                        toKind: "airport",
                        fromOutcode: "OX1",
                        toOutcode: "TW6",
                    }],
            },
        ], points);
        assert.equal(mapped.months[0].mappedJourneys, 0);
        assert.equal(mapped.months[0].completedJourneys, 1);
    });
});
