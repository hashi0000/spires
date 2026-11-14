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
exports.recordCustomerAcquisition = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const attribution_1 = require("./attribution");
const consent_1 = require("./consent");
/** Server-owned acquisition evidence. A recorded browser campaign is not proof of an ad-network attribution. */
exports.recordCustomerAcquisition = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    const attribution = (0, attribution_1.readAttribution)(data?.marketingAttribution);
    if (!attribution || await (0, consent_1.measurementWithdrawn)(attribution, context.auth.uid))
        return { recorded: false };
    const user = await admin.auth().getUser(context.auth.uid);
    const registeredAt = admin.firestore.Timestamp.fromDate(new Date(user.metadata.creationTime));
    const ref = admin.firestore().collection('customerAcquisitions').doc(context.auth.uid);
    const recorded = await admin.firestore().runTransaction(async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists || await (0, consent_1.measurementWithdrawn)(attribution, context.auth.uid, tx))
            return false;
        tx.create(ref, {
            uid: context.auth.uid, registeredAt, observedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(attribution.expiresAt),
            marketingAttribution: attribution, provenance: 'consented_browser_capture',
        });
        return true;
    });
    return { recorded };
});
