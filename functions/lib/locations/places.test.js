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
const places_1 = require("./places");
const placeRecord_1 = require("./placeRecord");
(0, node_test_1.describe)("location suggestions", () => {
    (0, node_test_1.it)("keeps London Oxford Airport distinct from Heathrow", () => {
        const heathrow = (0, places_1.curatedMatches)("heathrow").map((place) => place.label);
        assert.equal(heathrow.some((label) => /oxford/i.test(label)), false);
        assert.equal(heathrow.length, 4);
        const oxfordAirport = (0, places_1.curatedMatches)("kidlington");
        assert.equal(oxfordAirport[0].label, "London Oxford Airport, Kidlington");
    });
    (0, node_test_1.it)("offers the short popular list when the field is empty", () => {
        const popular = (0, places_1.curatedMatches)("");
        assert.equal(popular.some((place) => place.id === "oxford-station"), true);
        assert.equal(popular.some((place) => place.id === "heathrow-t5"), true);
    });
    (0, node_test_1.it)("uses a postcode result that still needs a property", async () => {
        const fetchImpl = (async () => ({
            ok: true,
            json: async () => ({ result: { latitude: 51.75, longitude: -1.25, postcode: "OX1 1HS" } }),
        }));
        const result = await (0, places_1.searchLocationSuggestions)({ query: "OX1 1HS", fetchImpl });
        const postcode = result.suggestions.find((row) => row.kind === "postcode");
        assert.equal(postcode?.needsProperty, true);
        assert.equal(postcode?.latitude, 51.75);
        assert.equal((0, places_1.isUkPostcode)("OX1 1HS"), true);
    });
    (0, node_test_1.it)("drops coordinates when the address text changes", () => {
        const selected = (0, placeRecord_1.placeRecord)({ label: "Oxford Station, OX1 1HS", latitude: 51.75, longitude: -1.27, postcode: "OX1 1HS" }, "Oxford Station, OX1 1HS");
        assert.equal(selected?.latitude, 51.75);
        assert.equal((0, placeRecord_1.placeRecord)({ label: "Oxford Station, OX1 1HS", latitude: 51.75, longitude: -1.27 }, "12 High Street, Oxford"), null);
    });
});
