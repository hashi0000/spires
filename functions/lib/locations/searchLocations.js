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
exports.searchLocations = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const places_1 = require("./places");
function apiKey() {
    const fromEnv = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
    if (fromEnv)
        return fromEnv;
    try {
        const configured = functions.config().google?.places_key || functions.config().places?.key;
        return configured ? String(configured) : "";
    }
    catch {
        return "";
    }
}
function cors(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
}
/** Public location search. The API key stays on the server. */
exports.searchLocations = functions.https.onRequest(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "GET") {
        res.status(405).json({ ok: false, error: "Use GET." });
        return;
    }
    const placeId = String(req.query.placeId || "").trim();
    const query = String(req.query.q || "").trim().slice(0, 120);
    try {
        if (placeId) {
            const details = await (0, places_1.googlePlaceDetails)(placeId, apiKey());
            res.json({ ok: true, suggestion: details });
            return;
        }
        const result = await (0, places_1.searchLocationSuggestions)({ query, apiKey: apiKey() });
        res.json({ ok: true, provider: result.provider, suggestions: result.suggestions });
    }
    catch {
        res.json({ ok: true, provider: "curated", suggestions: [] });
    }
});
