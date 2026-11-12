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
exports.internationalPreview = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const rules_1 = require("./rules");
/**
 * Disabled unless SPIRES_INTERNATIONAL_ENABLED=true.
 * Even then it only returns a quote decision. It does not create a Stripe charge.
 */
exports.internationalPreview = functions.https.onRequest((req, res) => {
    res.set("X-Robots-Tag", "noindex, nofollow");
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Use POST." });
        return;
    }
    if (!(0, rules_1.internationalEnabled)(process.env.SPIRES_INTERNATIONAL_ENABLED)) {
        res.status(403).json({ ok: false, enabled: false, charging: false, error: "Spires International is not enabled." });
        return;
    }
    const body = (req.body || {});
    const passengers = Number(body.passengers);
    const luggage = Number(body.luggage);
    const vehicle = body.vehicle === "vito_8" ? "vito_8" : "standard";
    const fit = (0, rules_1.vehicleDecision)(passengers, luggage, vehicle);
    const fare = (0, rules_1.chargeableFare)(body);
    res.status(200).json({
        ok: fit.ok,
        enabled: true,
        charging: false,
        error: fit.ok ? undefined : fit.error,
        fare,
    });
});
