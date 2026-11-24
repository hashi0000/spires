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
const POINTS = new Map([
    ["OX12", { lat: 51.597, lng: -1.425 }],
    ["TW6", { lat: 51.47, lng: -0.454 }],
    ["OX1", { lat: 51.752, lng: -1.258 }],
    ["OX11", { lat: 51.608, lng: -1.245 }],
    ["RH6", { lat: 51.154, lng: -0.182 }],
    ["OX18", { lat: 51.808, lng: -1.637 }],
    ["GL54", { lat: 51.883, lng: -1.754 }],
    ["GL7", { lat: 51.76, lng: -1.968 }],
    ["GL56", { lat: 51.99, lng: -1.703 }],
]);
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
    (0, node_test_1.it)("recognises Cotswolds towns", () => {
        assert.deepEqual((0, journeyMap_1.approximatePlace)("Burford"), { label: "Burford", outcode: "OX18", kind: "area" });
        assert.deepEqual((0, journeyMap_1.approximatePlace)("Bourton-on-the-Water"), {
            label: "Bourton-on-the-Water",
            outcode: "GL54",
            kind: "area",
        });
        assert.deepEqual((0, journeyMap_1.approximatePlace)("Bibury"), { label: "Bibury", outcode: "GL7", kind: "area" });
        assert.deepEqual((0, journeyMap_1.approximatePlace)("Moreton-in-Marsh"), {
            label: "Moreton-in-Marsh",
            outcode: "GL56",
            kind: "area",
        });
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
        const pub = (0, journeyMap_1.materialiseJourneyMap)(drafts, POINTS);
        const october = pub.months.find((month) => month.key === "2026-10");
        assert.ok(october);
        assert.equal(october.mappedJourneys, 2);
        assert.equal(october.routes[0].from, "Wantage");
        assert.equal(october.routes[0].to, "Heathrow");
        assert.equal(october.routes[0].style, "direct");
        assert.equal(october.routes[0].closedLoop, false);
        assert.equal(october.routes[0].stops.length, 2);
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
                        style: "direct",
                    }],
            },
        ], points);
        assert.equal(mapped.months[0].mappedJourneys, 0);
        assert.equal(mapped.months[0].completedJourneys, 1);
    });
    (0, node_test_1.it)("maps a Cotswolds tour returning to Oxford as a closed itinerary", () => {
        const drafts = (0, journeyMap_1.draftJourneyMap)([
            {
                id: "cotswolds-loop",
                status: "completed",
                pickupTime: "2026-10-15T09:00:00Z",
                pickupLocation: "Oxford",
                destination: "Oxford",
                stops: [
                    { id: "1", type: "pickup", address: "Oxford" },
                    { id: "2", type: "pickup", address: "Burford" },
                    { id: "3", type: "pickup", address: "Bourton-on-the-Water" },
                    { id: "4", type: "pickup", address: "Bibury" },
                    { id: "5", type: "dropoff", address: "Oxford" },
                ],
                passengerName: "Private Person",
                bookingNumber: "ST-PRIVATE-1",
            },
        ]);
        assert.equal(drafts.length, 1);
        const draft = drafts[0].routes[0];
        assert.equal(draft.style, "itinerary");
        assert.equal(draft.closedLoop, true);
        assert.equal(draft.from, "Oxford");
        assert.equal(draft.to, "Oxford");
        assert.deepEqual((draft.via || []).map((stop) => stop.label), ["Burford", "Bourton-on-the-Water", "Bibury"]);
        const pub = (0, journeyMap_1.materialiseJourneyMap)(drafts, POINTS);
        const route = pub.months[0].routes[0];
        assert.equal(route.style, "itinerary");
        assert.equal(route.closedLoop, true);
        assert.deepEqual(route.stops.map((stop) => stop.label), ["Oxford", "Burford", "Bourton-on-the-Water", "Bibury", "Oxford"]);
    });
    (0, node_test_1.it)("maps a tour with a different drop off as an open itinerary", () => {
        const drafts = (0, journeyMap_1.draftJourneyMap)([
            {
                id: "cotswolds-open",
                status: "completed",
                pickupTime: "2026-10-16T09:00:00Z",
                pickupLocation: "Oxford",
                destination: "Cheltenham",
                stops: [
                    { id: "1", type: "pickup", address: "Oxford" },
                    { id: "2", type: "pickup", address: "Burford" },
                    { id: "3", type: "pickup", address: "Bibury" },
                    { id: "4", type: "dropoff", address: "Cirencester" },
                ],
            },
        ]);
        const draft = drafts[0].routes[0];
        assert.equal(draft.style, "itinerary");
        assert.equal(draft.closedLoop, false);
        assert.equal(draft.from, "Oxford");
        assert.equal(draft.to, "Cirencester");
        const pub = (0, journeyMap_1.materialiseJourneyMap)(drafts, POINTS);
        const route = pub.months[0].routes[0];
        assert.equal(route.style, "itinerary");
        assert.equal(route.closedLoop, false);
        assert.deepEqual(route.stops.map((stop) => stop.label), ["Oxford", "Burford", "Bibury", "Cirencester"]);
    });
    (0, node_test_1.it)("keeps ordinary direct journeys as style direct with no via", () => {
        const drafts = (0, journeyMap_1.draftJourneyMap)([
            {
                id: "direct",
                status: "completed",
                pickupTime: "2026-10-17T09:00:00Z",
                pickupLocation: "Oxford",
                destination: "Heathrow Terminal 5",
            },
        ]);
        const draft = drafts[0].routes[0];
        assert.equal(draft.style, "direct");
        assert.equal(draft.via, undefined);
        assert.equal(draft.closedLoop, false);
        const pub = (0, journeyMap_1.materialiseJourneyMap)(drafts, POINTS);
        const route = pub.months[0].routes[0];
        assert.equal(route.style, "direct");
        assert.equal(route.stops.length, 2);
        assert.equal(route.closedLoop, false);
    });
    (0, node_test_1.it)("skips an unmappable middle stop and keeps the rest in order", () => {
        const drafts = (0, journeyMap_1.draftJourneyMap)([
            {
                id: "skip-middle",
                status: "completed",
                pickupTime: "2026-10-18T09:00:00Z",
                pickupLocation: "Oxford",
                destination: "Bibury",
                stops: [
                    { id: "1", type: "pickup", address: "Oxford" },
                    { id: "2", type: "pickup", address: "Private cottage only" },
                    { id: "3", type: "pickup", address: "Burford" },
                    { id: "4", type: "dropoff", address: "Bibury" },
                ],
            },
        ]);
        const draft = drafts[0].routes[0];
        assert.equal(draft.style, "itinerary");
        assert.deepEqual((draft.via || []).map((stop) => stop.label), ["Burford"]);
        assert.equal(draft.from, "Oxford");
        assert.equal(draft.to, "Bibury");
        const pub = (0, journeyMap_1.materialiseJourneyMap)(drafts, POINTS);
        assert.deepEqual(pub.months[0].routes[0].stops.map((stop) => stop.label), ["Oxford", "Burford", "Bibury"]);
    });
    (0, node_test_1.it)("keeps street addresses and private booking fields out of the public JSON", () => {
        const drafts = (0, journeyMap_1.draftJourneyMap)([
            {
                id: "private-fields",
                status: "completed",
                pickupTime: "2026-10-19T09:00:00Z",
                pickupLocation: STREET,
                destination: "Heathrow Terminal 5, TW6 2GA",
                stops: [
                    { id: "1", type: "pickup", address: STREET },
                    { id: "2", type: "pickup", address: "12 High Street, Burford, OX18 4QF" },
                    { id: "3", type: "dropoff", address: "Heathrow Terminal 5, TW6 2GA" },
                ],
                hirerName: "Secret Name",
                passengerName: "Hidden Passenger",
                bookingNumber: "ST-SECRET-99",
                phone: "07700900000",
                email: "secret@example.com",
            },
        ]);
        const pub = (0, journeyMap_1.materialiseJourneyMap)(drafts, POINTS);
        const october = pub.months[0];
        const view = (0, journeyMap_1.publicJourneyMapView)({ latest: pub.latest, updatedAt: "2026-11-11T00:00:00Z", months: pub.months }, october, october.key);
        const serialised = JSON.stringify(view);
        assert.equal(serialised.includes("Breakspear"), false);
        assert.equal(serialised.includes("High Street"), false);
        assert.equal(serialised.includes("7FS"), false);
        assert.equal(serialised.includes("4QF"), false);
        assert.equal(serialised.includes("2GA"), false);
        assert.equal(serialised.includes("Secret"), false);
        assert.equal(serialised.includes("Hidden"), false);
        assert.equal(serialised.includes("ST-SECRET"), false);
        assert.equal(serialised.includes("07700"), false);
        assert.equal(serialised.includes("secret@"), false);
        assert.equal(serialised.includes("hirer"), false);
        assert.equal(serialised.includes("passenger"), false);
        assert.equal(serialised.includes("bookingNumber"), false);
        assert.equal(serialised.includes("pickupTime"), false);
        const route = view.routes[0];
        assert.ok(route);
        assert.equal(route.style, "itinerary");
        assert.deepEqual(route.stops.map((stop) => stop.label), ["Wantage", "Burford", "Heathrow"]);
    });
});
