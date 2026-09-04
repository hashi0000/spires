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
  };
}

function clearLocalLegacy(): void {
  localStorage.removeItem(LOCAL_SUPPLIER);
  localStorage.removeItem(LOCAL_ROUTES);
  localStorage.removeItem(LOCAL_HISTORY);
  localStorage.removeItem(LOCAL_SEQ);
  localStorage.setItem(LOCAL_MIGRATED, "1");
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
  };
}

export async function loadSchoolInvoiceVault(): Promise<SchoolInvoiceVault> {
  try {
    const res = await getVault({});
    const data = res.data as { empty?: boolean; payload?: unknown };
    let vault = normaliseVault(data?.payload);
    const legacy = localLegacyVault();
    if (data?.empty && legacy) {
      vault = {
        supplier: { ...vault.supplier, ...legacy.supplier },
        routes: legacy.routes.length ? legacy.routes : vault.routes,
        invoices: legacy.invoices.length ? legacy.invoices : vault.invoices,
        seq: { ...vault.seq, ...legacy.seq },
      };
      await persistSchoolInvoiceVault(vault);
      clearLocalLegacy();
    } else if (legacy) {
      clearLocalLegacy();
    }
    return vault;
  } catch (err) {
    throw new Error(getCallableErrorMessage(err));
  }
}

export async function persistSchoolInvoiceVault(vault: SchoolInvoiceVault): Promise<void> {
  try {
    await saveVaultFn({
      payload: {
        version: 1,
        supplier: vault.supplier,
        routes: vault.routes,
        invoices: vault.invoices.slice(0, 100),
        seq: vault.seq,
      },
    });
  } catch (err) {
    throw new Error(getCallableErrorMessage(err));
  }
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
