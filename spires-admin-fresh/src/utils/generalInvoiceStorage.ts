import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { getCallableErrorMessage } from "./callableErrorMessage";
import { loadSchoolInvoiceVault } from "./schoolInvoiceStorage";
import {
  DEFAULT_GENERAL_SUPPLIER,
  GeneratedGeneralInvoice,
  InvoiceSupplierDetails,
  SavedInvoiceClient,
  sanitiseInvoicePrefix,
  suggestInvoicePrefix,
} from "./generalInvoiceTypes";

export type GeneralInvoiceVault = {
  supplier: InvoiceSupplierDetails;
  clients: SavedInvoiceClient[];
  invoices: GeneratedGeneralInvoice[];
  seq: Record<string, number>;
};

const VAULT_DOC = "general";
const getVault = httpsCallable(functions, "getSchoolInvoiceVault");
const saveVaultFn = httpsCallable(functions, "saveSchoolInvoiceVault");

function looksLikeSchoolVault(raw: unknown): boolean {
  const row = (raw || {}) as { routes?: unknown; invoices?: unknown };
  if (
    Array.isArray(row.routes) &&
    row.routes.some(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as { routeNumber?: unknown }).routeNumber === "string" &&
        (item as { routeNumber: string }).routeNumber.trim()
    )
  ) {
    return true;
  }
  return (
    Array.isArray(row.invoices) &&
    row.invoices.some((item) => item && typeof item === "object" && "serviceMonth" in item)
  );
}

function supplierFromUnknown(raw: unknown): InvoiceSupplierDetails {
  const row = (raw || {}) as { supplier?: unknown };
  if (row.supplier && typeof row.supplier === "object") {
    return {
      ...DEFAULT_GENERAL_SUPPLIER,
      ...(row.supplier as Partial<InvoiceSupplierDetails>),
      invoicePrefix: "ST-INV",
    };
  }
  return { ...DEFAULT_GENERAL_SUPPLIER };
}

function normaliseClients(raw: unknown): SavedInvoiceClient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<SavedInvoiceClient> & { routeNumber?: unknown };
      if (typeof row.routeNumber === "string" && row.routeNumber.trim()) return null;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) return null;
      return {
        id: typeof row.id === "string" && row.id.trim() ? row.id : `client-${name}`,
        name,
        address: typeof row.address === "string" ? row.address : "",
        email: typeof row.email === "string" ? row.email : "",
        phone: typeof row.phone === "string" ? row.phone : "",
        invoicePrefix: sanitiseInvoicePrefix(row.invoicePrefix || suggestInvoicePrefix(name)),
      };
    })
    .filter((row): row is SavedInvoiceClient => Boolean(row));
}

function normaliseVault(raw: unknown): GeneralInvoiceVault {
  const row = (raw || {}) as Partial<GeneralInvoiceVault> & {
    supplier?: unknown;
    routes?: unknown;
    clients?: unknown;
  };
  const supplier =
    row.supplier && typeof row.supplier === "object"
      ? { ...DEFAULT_GENERAL_SUPPLIER, ...(row.supplier as Partial<InvoiceSupplierDetails>) }
      : { ...DEFAULT_GENERAL_SUPPLIER };
  if (!supplier.invoicePrefix) supplier.invoicePrefix = "ST-INV";
  return {
    supplier,
    clients: normaliseClients(row.clients ?? row.routes),
    invoices: Array.isArray(row.invoices) ? (row.invoices as GeneratedGeneralInvoice[]) : [],
    seq: row.seq && typeof row.seq === "object" ? row.seq : {},
  };
}

export async function loadGeneralInvoiceVault(): Promise<GeneralInvoiceVault> {
  try {
    const res = await getVault({ docId: VAULT_DOC });
    const data = res.data as { empty?: boolean; payload?: unknown };
    if (!data?.empty && looksLikeSchoolVault(data?.payload)) {
      return { supplier: supplierFromUnknown(data?.payload), clients: [], invoices: [], seq: {} };
    }
    const vault = normaliseVault(data?.payload);
    if (data?.empty) {
      try {
        const school = await loadSchoolInvoiceVault();
        vault.supplier = {
          ...DEFAULT_GENERAL_SUPPLIER,
          ...school.supplier,
          invoicePrefix: "ST-INV",
        };
      } catch {
        /* headed paper from school vault is optional */
      }
    }
    return vault;
  } catch (err) {
    throw new Error(getCallableErrorMessage(err));
  }
}

export async function persistGeneralInvoiceVault(vault: GeneralInvoiceVault): Promise<void> {
  try {
    const current = await getVault({ docId: VAULT_DOC });
    const data = current.data as { empty?: boolean; payload?: unknown };
    if (!data?.empty && looksLikeSchoolVault(data?.payload)) {
      throw new Error(
        "General invoices need an updated Firebase function deploy. Saving now would mix them with school invoices."
      );
    }
    await saveVaultFn({
      docId: VAULT_DOC,
      payload: {
        version: 1,
        supplier: vault.supplier,
        routes: vault.clients,
        invoices: vault.invoices.slice(0, 100),
        seq: vault.seq,
      },
    });
  } catch (err) {
    throw new Error(getCallableErrorMessage(err));
  }
}

export function allocateGeneralInvoiceNumber(
  vault: GeneralInvoiceVault,
  prefix: string,
  invoiceDate: string
): { vault: GeneralInvoiceVault; invoiceNumber: string } {
  const month = (invoiceDate || "").slice(0, 7) || new Date().toISOString().slice(0, 7);
  const key = `${prefix}-${month}`;
  const next = (vault.seq[key] || 0) + 1;
  const seq = { ...vault.seq, [key]: next };
  const ym = month.replace("-", "");
  const invoiceNumber = `${prefix}-${ym}-${String(next).padStart(3, "0")}`;
  return { vault: { ...vault, seq }, invoiceNumber };
}

export function rebuildGeneralInvoiceSeq(
  invoices: GeneratedGeneralInvoice[]
): Record<string, number> {
  const seq: Record<string, number> = {};
  for (const inv of invoices) {
    const prefix = inv.invoiceNumber.replace(/-\d{6}-\d+$/, "");
    if (!prefix || prefix === inv.invoiceNumber) continue;
    const month = (inv.invoiceDate || "").slice(0, 7);
    if (!month) continue;
    const key = `${prefix}-${month}`;
    const match = inv.invoiceNumber.match(/-(\d+)$/);
    const n = match ? Number(match[1]) : 0;
    if (!Number.isFinite(n) || n <= 0) continue;
    seq[key] = Math.max(seq[key] || 0, n);
  }
  return seq;
}
