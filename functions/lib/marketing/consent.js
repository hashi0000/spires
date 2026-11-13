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
exports.withdrawAccountMeasurement = exports.revokeMeasurementConsent = void 0;
exports.receiptKey = receiptKey;
exports.accountConsentWithdrawn = accountConsentWithdrawn;
exports.measurementWithdrawn = measurementWithdrawn;
const crypto_1 = require("crypto");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
function receiptKey(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? (0, crypto_1.createHash)('sha256').update(value).digest('hex') : null;
}
function accountConsentWithdrawn(attribution, withdrawnAt) {
    return withdrawnAt > 0 && withdrawnAt >= Number(attribution.consentGrantedAt || attribution.consentAt || 0);
}
async function measurementWithdrawn(attribution, uid, tx) {
    attribution = attribution || {};
    const db = admin.firestore(), key = receiptKey(attribution.consentReceiptId);
    const get = (ref) => tx ? tx.get(ref) : ref.get();
    const [receipt, account] = await Promise.all([
        key ? get(db.collection('measurementWithdrawals').doc(key)) : null,
        uid ? get(db.collection('customerMeasurementConsent').doc(uid)) : null,
    ]);
    return receipt?.exists === true || accountConsentWithdrawn(attribution, account?.data()?.withdrawnAt?.toMillis?.() || 0);
}
async function denyStored(field, value) {
    const db = admin.firestore();
    for (const name of ['bookings', 'customerAcquisitions']) {
        let last;
        for (;;) {
            let query = db.collection(name).where(field, '==', value).orderBy(admin.firestore.FieldPath.documentId()).limit(300);
            if (last)
                query = query.startAfter(last);
            const page = await query.get();
            if (page.empty)
                break;
            const batch = db.batch();
            for (const doc of page.docs)
                if (doc.data().marketingAttribution)
                    batch.update(doc.ref, { 'marketingAttribution.consent': 'denied', measurementWithdrawnAt: admin.firestore.FieldValue.serverTimestamp() });
            await batch.commit();
            last = page.docs[page.docs.length - 1];
            if (page.size < 300)
                break;
        }
    }
}
/** A random capability can only withdraw measurement, never disclose or change a booking. */
exports.revokeMeasurementConsent = functions.https.onRequest(async (req, res) => {
    const origin = String(req.get('origin') || '');
    if (!['https://www.spires-taxis.com', 'https://spires-taxis.com', 'https://customer.spires-taxis.com'].includes(origin)) {
        res.status(403).send('Forbidden');
        return;
    }
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Use POST');
        return;
    }
    const receipt = typeof req.body?.receipt === 'string' ? req.body.receipt : '';
    const key = receiptKey(receipt);
    if (!key) {
        res.status(400).send('Invalid receipt');
        return;
    }
    const db = admin.firestore(), now = Date.now();
    const ip = (0, crypto_1.createHash)('sha256').update(String(req.ip || '')).digest('hex');
    const rateRef = db.collection('measurementWithdrawalRate').doc(ip);
    const marker = db.collection('measurementWithdrawals').doc(key);
    try {
        const allowed = await db.runTransaction(async (tx) => {
            const rate = await tx.get(rateRef), previous = rate.data();
            const same = Number(previous?.windowStart) > now - 60000;
            const count = same ? Number(previous?.count || 0) : 0;
            if (count >= 20)
                return false;
            tx.set(rateRef, { windowStart: same ? previous.windowStart : now, count: count + 1, expiresAt: admin.firestore.Timestamp.fromMillis(now + 86400000) });
            tx.set(marker, { withdrawnAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: admin.firestore.Timestamp.fromMillis(now + 45 * 86400000) }, { merge: true });
            return true;
        });
        if (!allowed) {
            res.status(429).send('Please retry');
            return;
        }
        await denyStored('marketingAttribution.consentReceiptId', receipt);
        res.status(204).send('');
    }
    catch {
        res.status(503).send('Please retry');
    }
});
exports.withdrawAccountMeasurement = functions.https.onCall(async (_data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    const uid = context.auth.uid;
    await admin.firestore().collection('customerMeasurementConsent').doc(uid).set({ withdrawnAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await denyStored('uid', uid);
    // Acquisition document identity is the account UID, not a mutable customer profile.
    const acquisition = admin.firestore().collection('customerAcquisitions').doc(uid);
    const saved = await acquisition.get();
    if (saved.exists)
        await acquisition.update({ 'marketingAttribution.consent': 'denied', measurementWithdrawnAt: admin.firestore.FieldValue.serverTimestamp() });
    return { withdrawn: true };
});
