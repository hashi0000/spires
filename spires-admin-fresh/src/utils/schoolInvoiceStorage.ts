import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { getCallableErrorMessage } from "./callableErrorMessage";
import {
  DEFAULT_SUPPLIER_DETAILS,
  GeneratedSchoolInvoice,
  SchoolContractRoute,
  SchoolSupplierDetails,
} from "./schoolInvoiceTypes";

export type SchoolInvoiceVault = {
  supplier: SchoolSupplierDetails;
  routes: SchoolContractRoute[];
  invoices: GeneratedSchoolInvoice[];
  seq: Record<string, number>;
  revision: number;
};

const LOCAL_SUPPLIER = "spires_school_invoice_supplier";
const LOCAL_ROUTES = "spires_school_invoice_routes";
const LOCAL_HISTORY = "spires_school_invoice_history";
const LOCAL_SEQ = "spires_school_invoice_seq";
const LOCAL_MIGRATED = "spires_school_invoice_migrated_to_firebase";

const getVault = httpsCallable(functions, "getSchoolInvoiceVault");
const saveVaultFn = httpsCallable(functions, "saveSchoolInvoiceVault");

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function localLegacyVault(): SchoolInvoiceVault | null {
  if (localStorage.getItem(LOCAL_MIGRATED) === "1") return null;
  const supplier = readLocalJson<Partial<SchoolSupplierDetails>>(LOCAL_SUPPLIER, {});
  const routes = readLocalJson<SchoolContractRoute[]>(LOCAL_ROUTES, []);
  const invoices = readLocalJson<GeneratedSchoolInvoice[]>(LOCAL_HISTORY, []);
  const seq = readLocalJson<Record<string, number>>(LOCAL_SEQ, {});
  const hasAnything =
    Object.keys(supplier).length > 0 ||
    (Array.isArray(routes) && routes.length > 0) ||
    (Array.isArray(invoices) && invoices.length > 0);
  if (!hasAnything) return null;
  return {
    supplier: { ...DEFAULT_SUPPLIER_DETAILS, ...supplier },
    routes: Array.isArray(routes) ? routes : [],
    invoices: Array.isArray(invoices) ? invoices : [],
    seq: seq && typeof seq === "object" ? seq : {},
    revision: 0,
  };
}

function normaliseVault(raw: unknown): SchoolInvoiceVault {
  const row = (raw || {}) as Partial<SchoolInvoiceVault> & { supplier?: unknown };
  const supplier =
    row.supplier && typeof row.supplier === "object"
      ? { ...DEFAULT_SUPPLIER_DETAILS, ...(row.supplier as Partial<SchoolSupplierDetails>) }
      : { ...DEFAULT_SUPPLIER_DETAILS };
  return {
    supplier,
    routes: Array.isArray(row.routes) ? row.routes : [],
    invoices: Array.isArray(row.invoices) ? row.invoices : [],
    seq: row.seq && typeof row.seq === "object" ? row.seq : {},
    revision: Number.isInteger(Number((row as { revision?: unknown }).revision))
      ? Number((row as { revision?: unknown }).revision)
      : 0,
  };
}

export async function loadSchoolInvoiceVault(): Promise<SchoolInvoiceVault> {
  try {
    const res = await getVault({});
    const data = res.data as { empty?: boolean; payload?: unknown };
    const vault = normaliseVault(data?.payload);
    if (!data?.empty) return vault;
    const legacy = localLegacyVault();
    if (!legacy) return vault;
    return {
      supplier: { ...vault.supplier, ...legacy.supplier },
      routes: legacy.routes.length ? legacy.routes : vault.routes,
      invoices: legacy.invoices.length ? legacy.invoices : vault.invoices,
      seq: { ...vault.seq, ...legacy.seq },
      revision: 0,
    };
  } catch (err) {
    throw new Error(getCallableErrorMessage(err));
  }
}

export async function persistSchoolInvoiceVault(vault: SchoolInvoiceVault): Promise<{ revision: number; assigned: { id: string; invoiceNumber: string }[] }> {
  try {
    const save = await saveVaultFn({
      payload: {
        version: 1,
        supplier: vault.supplier,
        routes: vault.routes,
        invoices: vault.invoices,
        seq: vault.seq,
        expectedRevision: Number.isInteger(vault.revision) ? vault.revision : 0,
      },
    });
    const saved = save.data as { revision?: number; assigned?: { id: string; invoiceNumber: string }[] };
    return {
      revision: Number.isInteger(saved?.revision) ? Number(saved.revision) : (vault.revision ?? 0) + 1,
      assigned: Array.isArray(saved?.assigned) ? saved.assigned : [],
    };
  } catch (err) {
    throw new Error(getCallableErrorMessage(err));
  }
}

export function applyAssignedInvoiceNumbers<T extends { id: string; invoiceNumber: string; needsServerNumber?: boolean; numberPrefix?: string; numberPeriod?: string }>(
  invoices: T[],
  assigned: { id: string; invoiceNumber: string }[]
): T[] {
  if (!assigned.length) return invoices;
  const byId = new Map(assigned.map((item) => [item.id, item.invoiceNumber]));
  return invoices.map((row) => {
    const invoiceNumber = byId.get(row.id);
    if (!invoiceNumber) return row;
    const copy = { ...row, invoiceNumber };
    delete copy.needsServerNumber;
    delete copy.numberPrefix;
    delete copy.numberPeriod;
    return copy;
  });
}

export function allocateInvoiceNumber(
  vault: SchoolInvoiceVault,
  prefix: string,
  serviceMonth: string
): { vault: SchoolInvoiceVault; invoiceNumber: string } {
  const key = `${prefix}-${serviceMonth}`;
  const next = (vault.seq[key] || 0) + 1;
  const seq = { ...vault.seq, [key]: next };
  const ym = serviceMonth.replace("-", "");
  const invoiceNumber = `${prefix}-${ym}-${String(next).padStart(3, "0")}`;
  return { vault: { ...vault, seq }, invoiceNumber };
}

/** Rebuild sequence counters from remaining invoices so numbers can be reused after deletes. */
export function rebuildInvoiceSeq(invoices: GeneratedSchoolInvoice[]): Record<string, number> {
  const seq: Record<string, number> = {};
  for (const inv of invoices) {
    const prefix = inv.invoiceNumber.replace(/-\d{6}-\d+$/, "");
    if (!prefix || prefix === inv.invoiceNumber) continue;
    const key = `${prefix}-${inv.serviceMonth}`;
    const match = inv.invoiceNumber.match(/-(\d+)$/);
    const n = match ? Number(match[1]) : 0;
    if (!Number.isFinite(n) || n <= 0) continue;
    seq[key] = Math.max(seq[key] || 0, n);
  }
  return seq;
}
