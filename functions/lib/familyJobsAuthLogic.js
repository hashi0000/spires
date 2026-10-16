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
exports.FAMILY_UNLOCK_MAX_ATTEMPTS = exports.FAMILY_UNLOCK_WINDOW_MS = exports.FAMILY_DEVICE_TTL_MS = exports.FAMILY_UNLOCK_ATTEMPTS = exports.FAMILY_DEVICES = void 0;
exports.normalizeFamilyPin = normalizeFamilyPin;
exports.isPlausibleFamilyPin = isPlausibleFamilyPin;
exports.familyPinsMatch = familyPinsMatch;
exports.newFamilyDeviceId = newFamilyDeviceId;
exports.clientIpFromRequest = clientIpFromRequest;
exports.attemptDocId = attemptDocId;
const crypto = __importStar(require("crypto"));
exports.FAMILY_DEVICES = "familyDevices";
exports.FAMILY_UNLOCK_ATTEMPTS = "familyJobsUnlockAttempts";
exports.FAMILY_DEVICE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
exports.FAMILY_UNLOCK_WINDOW_MS = 15 * 60 * 1000;
exports.FAMILY_UNLOCK_MAX_ATTEMPTS = 8;
function normalizeFamilyPin(input) {
    return String(input || "").replace(/\s+/g, "");
}
function isPlausibleFamilyPin(pin) {
    return /^\d{4,8}$/.test(pin);
}
function familyPinsMatch(provided, configured) {
    if (!provided || !configured)
        return false;
    const left = crypto.createHash("sha256").update(provided).digest();
    const right = crypto.createHash("sha256").update(configured).digest();
    return crypto.timingSafeEqual(left, right);
}
function newFamilyDeviceId() {
    return `fam_${crypto.randomBytes(16).toString("hex")}`;
}
function clientIpFromRequest(rawRequest) {
    const forwarded = rawRequest?.headers?.["x-forwarded-for"];
    const headerValue = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || "");
    const first = headerValue.split(",")[0].trim();
    return first || rawRequest?.ip || "unknown";
}
function attemptDocId(ip) {
    return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
