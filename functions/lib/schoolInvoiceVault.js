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
exports.saveSchoolInvoiceVault = exports.getSchoolInvoiceVault = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const VAULT_COLLECTION = "schoolInvoiceVault";
const VAULT_DOC = "workspace";
const ALG = "aes-256-gcm";
const KEY_SALT = "spires-school-invoice-v1";
const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];
function assertAdmin(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }
    const email = (context.auth.token.email || "").toString().trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required.");
    }
}
/** Lazy: never call functions.config() at module load. */
function encryptionKey() {
    const fromSecret = (process.env.SCHOOL_INVOICE_ENCRYPTION_KEY || "").trim();
    const fromEnv = fromSecret;
    const fromConfig = (functions.config().schoolinvoice?.key || "").toString().trim();
    const secret = fromEnv || fromConfig;
    if (secret.length < 24) {
        throw new functions.https.HttpsError("failed-precondition", "School invoice encryption key is not set. Create the Firebase secret SCHOOL_INVOICE_ENCRYPTION_KEY and redeploy functions.");
    }
    return (0, crypto_1.scryptSync)(secret, KEY_SALT, 32);
}
function encryptJson(payload) {
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)(ALG, encryptionKey(), iv);
    const json = Buffer.from(JSON.stringify(payload), "utf8");
    const encrypted = Buffer.concat([cipher.update(json), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64"),
    };
}
function decryptJson(ivB64, tagB64, dataB64) {
    const decipher = (0, crypto_1.createDecipheriv)(ALG, encryptionKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plain = Buffer.concat([
        decipher.update(Buffer.from(dataB64, "base64")),
        decipher.final(),
    ]);
    const parsed = JSON.parse(plain.toString("utf8"));
    if (!parsed || parsed.version !== 1) {
        throw new functions.https.HttpsError("internal", "Vault payload is not recognised.");
    }
    return parsed;
}
function emptyPayload() {
    return { version: 1, supplier: null, routes: [], invoices: [], seq: {} };
}
exports.getSchoolInvoiceVault = functions
    .runWith({ secrets: ["SCHOOL_INVOICE_ENCRYPTION_KEY"] })
    .https.onCall(async (_data, context) => {
    assertAdmin(context);
    const snap = await admin.firestore().collection(VAULT_COLLECTION).doc(VAULT_DOC).get();
    if (!snap.exists) {
        return { empty: true, payload: emptyPayload() };
    }
    const row = snap.data() || {};
    if (!row.data || !row.iv || !row.tag) {
        throw new functions.https.HttpsError("internal", "Vault document is incomplete.");
    }
    try {
        const payload = decryptJson(String(row.iv), String(row.tag), String(row.data));
        return { empty: false, payload };
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        throw new functions.https.HttpsError("failed-precondition", "Could not decrypt the school invoice vault. The encryption key may have changed.");
    }
});
exports.saveSchoolInvoiceVault = functions
    .runWith({ secrets: ["SCHOOL_INVOICE_ENCRYPTION_KEY"] })
    .https.onCall(async (data, context) => {
    assertAdmin(context);
    const incoming = data?.payload;
    if (!incoming || typeof incoming !== "object") {
        throw new functions.https.HttpsError("invalid-argument", "payload is required.");
    }
    const payload = {
        version: 1,
        supplier: incoming.supplier ?? null,
        routes: Array.isArray(incoming.routes) ? incoming.routes : [],
        invoices: Array.isArray(incoming.invoices) ? incoming.invoices.slice(0, 100) : [],
        seq: incoming.seq && typeof incoming.seq === "object" ? incoming.seq : {},
    };
    const sealed = encryptJson(payload);
    await admin.firestore().collection(VAULT_COLLECTION).doc(VAULT_DOC).set({
        alg: ALG,
        v: 1,
        iv: sealed.iv,
        tag: sealed.tag,
        data: sealed.data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
        updatedByEmail: context.auth.token.email || "",
    });
    return { ok: true };
});
