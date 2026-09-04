import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const VAULT_COLLECTION = "schoolInvoiceVault";
const VAULT_DOC = "workspace";
const ALG = "aes-256-gcm";
const KEY_SALT = "spires-school-invoice-v1";
const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];

type VaultPayload = {
  version: 1;
  supplier: unknown;
  routes: unknown[];
  invoices: unknown[];
  seq: Record<string, number>;
};

function assertAdmin(context: functions.https.CallableContext): void {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }
  const email = (context.auth.token.email || "").toString().trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
}

/** Lazy: never call functions.config() at module load. */
function encryptionKey(): Buffer {
  const fromSecret = (process.env.SCHOOL_INVOICE_ENCRYPTION_KEY || "").trim();
  const fromEnv = fromSecret;
  const fromConfig = (functions.config().schoolinvoice?.key || "").toString().trim();
  const secret = fromEnv || fromConfig;
  if (secret.length < 24) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "School invoice encryption key is not set. Create the Firebase secret SCHOOL_INVOICE_ENCRYPTION_KEY and redeploy functions."
    );
  }
  return scryptSync(secret, KEY_SALT, 32);
}

function encryptJson(payload: VaultPayload): { iv: string; tag: string; data: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, encryptionKey(), iv);
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function decryptJson(ivB64: string, tagB64: string, dataB64: string): VaultPayload {
  const decipher = createDecipheriv(ALG, encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(plain.toString("utf8")) as VaultPayload;
  if (!parsed || parsed.version !== 1) {
    throw new functions.https.HttpsError("internal", "Vault payload is not recognised.");
  }
  return parsed;
}

function emptyPayload(): VaultPayload {
  return { version: 1, supplier: null, routes: [], invoices: [], seq: {} };
}

export const getSchoolInvoiceVault = functions
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
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Could not decrypt the school invoice vault. The encryption key may have changed."
    );
  }
});

export const saveSchoolInvoiceVault = functions
  .runWith({ secrets: ["SCHOOL_INVOICE_ENCRYPTION_KEY"] })
  .https.onCall(async (data, context) => {
  assertAdmin(context);
  const incoming = data?.payload;
  if (!incoming || typeof incoming !== "object") {
    throw new functions.https.HttpsError("invalid-argument", "payload is required.");
  }
  const payload: VaultPayload = {
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
    updatedBy: context.auth!.uid,
    updatedByEmail: context.auth!.token.email || "",
  });
  return { ok: true as const };
});
