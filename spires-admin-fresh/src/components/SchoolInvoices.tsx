import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Plus, Trash2 } from "lucide-react";
import {
  SCHOOL_INVOICE_TIMETABLE_2026_27,
  OCC_FINANCE_EMAIL,
  canSubmitOn,
  daysUntilSubmit,
  defaultServiceMonth,
  earliestSubmitForServiceMonth,
  formatUkDate,
  getTimetableRow,
  labelForServiceMonth,
} from "../utils/schoolInvoiceTimetable";
import {
  formatGbp,
  invoiceTotals,
  looksLikeItContainsChildNames,
  SchoolContractRoute,
  SchoolInvoiceKind,
  SchoolInvoiceLine,
  SchoolSupplierDetails,
  DEFAULT_SUPPLIER_DETAILS,
} from "../utils/schoolInvoiceTypes";
import {
  allocateInvoiceNumber,
  loadSchoolInvoiceVault,
  persistSchoolInvoiceVault,
  SchoolInvoiceVault,
} from "../utils/schoolInvoiceStorage";
import { downloadSchoolInvoicePdf } from "../utils/schoolInvoicePdf";

function emptyLine(): SchoolInvoiceLine {
  return {
    routeNumber: "",
    description: "Home to school transport",
    dailyPrice: 0,
    schoolDays: 0,
    vatRatePercent: 0,
    deductions: 0,
  };
}

const SchoolInvoices: React.FC = () => {
  const [vault, setVault] = useState<SchoolInvoiceVault | null>(null);
  const [supplier, setSupplier] = useState<SchoolSupplierDetails>(DEFAULT_SUPPLIER_DETAILS);
  const [routes, setRoutes] = useState<SchoolContractRoute[]>([]);
  const [history, setHistory] = useState<SchoolInvoiceVault["invoices"]>([]);
  const [kind, setKind] = useState<SchoolInvoiceKind>("monthly_contract");
  const [serviceMonth, setServiceMonth] = useState(() => defaultServiceMonth());
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<SchoolInvoiceLine[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [noChildNames, setNoChildNames] = useState(false);
  const [routeDraft, setRouteDraft] = useState({
    routeNumber: "",
    dailyPrice: "",
    vatRatePercent: "0",
    description: "Home to school transport",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadSchoolInvoiceVault();
        if (cancelled) return;
        setVault(loaded);
        setSupplier(loaded.supplier);
        setRoutes(loaded.routes);
        setHistory(loaded.invoices);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load encrypted invoices from Firebase.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (next: SchoolInvoiceVault) => {
    await persistSchoolInvoiceVault(next);
    setVault(next);
    setSupplier(next.supplier);
    setRoutes(next.routes);
    setHistory(next.invoices);
  };

  const timetableRow = getTimetableRow(serviceMonth);
  const earliest = earliestSubmitForServiceMonth(serviceMonth);
  const submitOk = canSubmitOn(serviceMonth);
  const waitDays = daysUntilSubmit(serviceMonth);
  const totals = useMemo(() => invoiceTotals(lines), [lines]);

  const saveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!vault) return;
    setError("");
    try {
      await persist({ ...vault, supplier });
      setStatus("Company details saved encrypted in Firebase.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save company details.");
    }
  };

  const addSavedRoute = async (e: FormEvent) => {
    e.preventDefault();
    if (!vault) return;
    const routeNumber = routeDraft.routeNumber.trim();
    const dailyPrice = Number(routeDraft.dailyPrice);
    if (!routeNumber || !Number.isFinite(dailyPrice) || dailyPrice <= 0) {
      setError("Enter a route number and daily contract price.");
      return;
    }
    if (looksLikeItContainsChildNames(routeDraft.description)) {
      setError("Route description must not include children’s names.");
      return;
    }
    const next: SchoolContractRoute = {
      id: `route-${Date.now()}`,
      routeNumber,
      dailyPrice,
      vatRatePercent: Number(routeDraft.vatRatePercent) || 0,
      description: routeDraft.description.trim() || "Home to school transport",
    };
    const updated = [...routes.filter((r) => r.routeNumber !== routeNumber), next];
    setError("");
    try {
      await persist({ ...vault, supplier, routes: updated });
      setRouteDraft({ routeNumber: "", dailyPrice: "", vatRatePercent: "0", description: "Home to school transport" });
      setStatus(`Saved route ${routeNumber} encrypted in Firebase.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save route.");
    }
  };

  const removeRoute = async (id: string) => {
    if (!vault) return;
    const updated = routes.filter((r) => r.id !== id);
    try {
      await persist({ ...vault, supplier, routes: updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove route.");
    }
  };

  const applyRoute = (route: SchoolContractRoute) => {
    setLines((current) => {
      const next = [...current];
      const blank = next.findIndex((l) => !l.routeNumber);
      const target = blank >= 0 ? blank : next.length;
      const line: SchoolInvoiceLine = {
        routeNumber: route.routeNumber,
        description: route.description,
        dailyPrice: route.dailyPrice,
        schoolDays: 0,
        vatRatePercent: route.vatRatePercent,
        deductions: 0,
      };
      if (target < next.length) next[target] = line;
      else next.push(line);
      return next;
    });
  };

  const updateLine = (index: number, patch: Partial<SchoolInvoiceLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const combinedText = () =>
    [notes, ...lines.map((l) => `${l.routeNumber} ${l.description}`)].join(" ");

  const validate = (): string | null => {
    if (!supplier.providerName.trim() || !supplier.address.trim() || !supplier.phone.trim() || !supplier.email.trim()) {
      return "Fill in headed-paper details: provider name, address, phone and email.";
    }
    if (!supplier.sortCode.trim() || !supplier.accountNumber.trim() || !supplier.accountName.trim()) {
      return "Bank account name, sort code and account number are required.";
    }
    if (!noChildNames) {
      return "Confirm that this invoice does not include children’s names.";
    }
    if (looksLikeItContainsChildNames(combinedText())) {
      return "Remove anything that looks like a child’s name. OCC invoices must not include children’s names.";
    }
    const usable = lines.filter((l) => l.routeNumber.trim() && l.schoolDays > 0 && l.dailyPrice > 0);
    if (!usable.length) {
      return "Add at least one line with route number, daily price and school days operated.";
    }
    if (totals.total <= 0) {
      return "Invoice total must be greater than zero.";
    }
    return null;
  };

  const handleDownload = async () => {
    setError("");
    setStatus("");
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const usable = lines.filter((l) => l.routeNumber.trim() && l.schoolDays > 0 && l.dailyPrice > 0);
    const draft = !submitOk;
    if (!vault) {
      setError("Invoice vault is not loaded yet.");
      return;
    }
    setBusy(true);
    try {
      const allocated = allocateInvoiceNumber(vault, supplier.invoicePrefix.trim() || "ST-OCC", serviceMonth);
      const invoiceNumber = allocated.invoiceNumber;
      const dated = submitOk && invoiceDate >= earliest ? invoiceDate : earliest;
      await downloadSchoolInvoicePdf({
        invoiceNumber,
        invoiceDate: dated,
        kind,
        serviceMonth,
        lines: usable,
        notes: notes.trim(),
        draft,
        supplier,
      });
      const record = {
        id: invoiceNumber,
        invoiceNumber,
        invoiceDate: dated,
        kind,
        serviceMonth,
        lines: usable,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        draft,
      };
      await persist({
        ...allocated.vault,
        supplier,
        routes,
        invoices: [record, ...history],
      });
      setStatus(
        draft
          ? `Draft PDF ${invoiceNumber} downloaded. Do not email it until ${formatUkDate(earliest)}.`
          : `PDF ${invoiceNumber} downloaded. Email it to ${OCC_FINANCE_EMAIL}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the PDF.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <p className="text-sm text-gray-600">Loading encrypted school invoices from Firebase…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">School invoices</h2>
        <p className="text-sm text-gray-600 mt-1">
          Oxfordshire County Council DPS invoices for academic year 2026/2027. Monthly in arrears.
          Never include children’s names. Bank details, VAT numbers and invoice history are stored in Firebase as AES-256-GCM ciphertext — they are not readable in the Firestore console.
        </p>
      </div>

      {!submitOk && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Earliest submission for {labelForServiceMonth(serviceMonth)} is {formatUkDate(earliest)}
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                Invoices sent before that date are rejected. You can still download a draft PDF
                {waitDays > 0 ? ` (${waitDays} day${waitDays === 1 ? "" : "s"} remaining)` : ""}.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Invoice timetable 2026/2027</h3>
        </div>
        <p className="text-sm text-gray-600" style={{ marginTop: "-0.75rem", marginBottom: "1rem" }}>
          Submit after all transport for the month has been delivered. Processing starts on the first working day shown.
          Payment is within 28 days of a valid invoice. Remittance may arrive from two payment systems after 14:00 on working days.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.5rem" }}>Month transport supplied</th>
                <th style={{ padding: "0.5rem" }}>Earliest submit</th>
                <th style={{ padding: "0.5rem" }}>Processed from</th>
              </tr>
            </thead>
            <tbody>
              {SCHOOL_INVOICE_TIMETABLE_2026_27.map((row) => {
                const active = row.serviceMonth === serviceMonth;
                return (
                  <tr
                    key={row.serviceMonth}
                    style={{
                      background: active ? "#f7f4ec" : undefined,
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <td style={{ padding: "0.5rem" }}>{row.label}</td>
                    <td style={{ padding: "0.5rem" }}>{formatUkDate(row.earliestSubmit)}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {formatUkDate(row.processedFrom)}
                      {row.note ? <div className="text-xs text-gray-500 mt-1">{row.note}</div> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <form className="card" onSubmit={saveSupplier}>
        <div className="card-header">
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Headed paper and supplier account</h3>
          <button type="submit" className="btn btn-primary btn-sm">Save details</button>
        </div>
        <p className="text-sm text-gray-600" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
          Bank details on the invoice must match the Council supplier account. Updating the portal without updating invoices can delay payment by more than a week.
          VAT number and company number are left blank until you enter the real values — do not guess them.
        </p>
        <div className="school-invoice-grid">
          <label className="form-group">
            <span className="form-label">Service provider name</span>
            <input className="form-input" value={supplier.providerName} onChange={(e) => setSupplier({ ...supplier, providerName: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Company registration number</span>
            <input className="form-input" value={supplier.companyNumber} onChange={(e) => setSupplier({ ...supplier, companyNumber: e.target.value })} placeholder="If registered" />
          </label>
          <label className="form-group" style={{ gridColumn: "1 / -1" }}>
            <span className="form-label">Company address</span>
            <textarea className="form-textarea" rows={3} value={supplier.address} onChange={(e) => setSupplier({ ...supplier, address: e.target.value })} placeholder="Required on headed paper" />
          </label>
          <label className="form-group">
            <span className="form-label">Phone</span>
            <input className="form-input" value={supplier.phone} onChange={(e) => setSupplier({ ...supplier, phone: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Email</span>
            <input className="form-input" value={supplier.email} onChange={(e) => setSupplier({ ...supplier, email: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">VAT number</span>
            <input className="form-input" value={supplier.vatNumber} onChange={(e) => setSupplier({ ...supplier, vatNumber: e.target.value })} placeholder="Leave blank if not VAT registered" />
          </label>
          <label className="form-group">
            <span className="form-label">Invoice number prefix</span>
            <input className="form-input" value={supplier.invoicePrefix} onChange={(e) => setSupplier({ ...supplier, invoicePrefix: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Account name</span>
            <input className="form-input" value={supplier.accountName} onChange={(e) => setSupplier({ ...supplier, accountName: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Sort code</span>
            <input className="form-input" value={supplier.sortCode} onChange={(e) => setSupplier({ ...supplier, sortCode: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Account number</span>
            <input className="form-input" value={supplier.accountNumber} onChange={(e) => setSupplier({ ...supplier, accountNumber: e.target.value })} />
          </label>
        </div>
      </form>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Saved routes</h3>
        </div>
        <form onSubmit={addSavedRoute} className="school-invoice-grid" style={{ marginBottom: "1rem" }}>
          <label className="form-group">
            <span className="form-label">Route number</span>
            <input className="form-input" value={routeDraft.routeNumber} onChange={(e) => setRouteDraft({ ...routeDraft, routeNumber: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Daily contract price (£)</span>
            <input className="form-input" type="number" min="0" step="0.01" value={routeDraft.dailyPrice} onChange={(e) => setRouteDraft({ ...routeDraft, dailyPrice: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">VAT rate (%)</span>
            <input className="form-input" type="number" min="0" step="0.1" value={routeDraft.vatRatePercent} onChange={(e) => setRouteDraft({ ...routeDraft, vatRatePercent: e.target.value })} />
          </label>
          <label className="form-group" style={{ gridColumn: "1 / -1" }}>
            <span className="form-label">Description (no children’s names)</span>
            <input className="form-input" value={routeDraft.description} onChange={(e) => setRouteDraft({ ...routeDraft, description: e.target.value })} />
          </label>
          <div>
            <button type="submit" className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4 mr-1" /> Save route
            </button>
          </div>
        </form>
        {routes.length === 0 ? (
          <p className="text-sm text-gray-500">No saved routes yet. Add the OCC route number and the daily contract price from the Statement of Work.</p>
        ) : (
          <ul className="space-y-2">
            {routes.map((route) => (
              <li key={route.id} className="flex items-center justify-between gap-3" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.65rem 0.85rem" }}>
                <div>
                  <strong>{route.routeNumber}</strong>
                  <span className="text-sm text-gray-600"> · {formatGbp(route.dailyPrice)} / day · VAT {route.vatRatePercent}%</span>
                  <div className="text-sm text-gray-500">{route.description}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-sm" onClick={() => applyRoute(route)}>Add to invoice</button>
                  <button type="button" className="btn btn-sm" onClick={() => removeRoute(route.id)} aria-label={`Remove route ${route.routeNumber}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Create invoice</h3>
        </div>
        <div className="school-invoice-grid">
          <label className="form-group">
            <span className="form-label">Invoice type</span>
            <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value as SchoolInvoiceKind)}>
              <option value="monthly_contract">Monthly school contract</option>
              <option value="social_care_one_off">Social care one-off</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Month transport supplied</span>
            <select className="form-select" value={serviceMonth} onChange={(e) => setServiceMonth(e.target.value)}>
              {SCHOOL_INVOICE_TIMETABLE_2026_27.map((row) => (
                <option key={row.serviceMonth} value={row.serviceMonth}>{row.label}</option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Invoice date</span>
            <input className="form-input" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </label>
        </div>
        {kind === "social_care_one_off" && (
          <p className="text-sm text-gray-600" style={{ marginBottom: "1rem" }}>
            One-off social care journeys can be invoiced after the journey. They are still processed from the timetable date for the month after transport was supplied. Use a journey or DCMS reference — not a child’s name.
          </p>
        )}
        {timetableRow?.note && <p className="text-sm text-amber-800" style={{ marginBottom: "1rem" }}>{timetableRow.note}</p>}

        {lines.map((line, index) => (
          <div key={index} className="school-invoice-line">
            <label className="form-group">
              <span className="form-label">Route number</span>
              <input className="form-input" value={line.routeNumber} onChange={(e) => updateLine(index, { routeNumber: e.target.value })} />
            </label>
            <label className="form-group">
              <span className="form-label">Daily contract price (£)</span>
              <input className="form-input" type="number" min="0" step="0.01" value={line.dailyPrice || ""} onChange={(e) => updateLine(index, { dailyPrice: Number(e.target.value) || 0 })} />
            </label>
            <label className="form-group">
              <span className="form-label">School days operated</span>
              <input className="form-input" type="number" min="0" step="1" value={line.schoolDays || ""} onChange={(e) => updateLine(index, { schoolDays: Number(e.target.value) || 0 })} />
            </label>
            <label className="form-group">
              <span className="form-label">Deductions (£)</span>
              <input className="form-input" type="number" min="0" step="0.01" value={line.deductions || ""} onChange={(e) => updateLine(index, { deductions: Number(e.target.value) || 0 })} />
            </label>
            <label className="form-group">
              <span className="form-label">VAT %</span>
              <input className="form-input" type="number" min="0" step="0.1" value={line.vatRatePercent} onChange={(e) => updateLine(index, { vatRatePercent: Number(e.target.value) || 0 })} />
            </label>
            <label className="form-group" style={{ gridColumn: "1 / -1" }}>
              <span className="form-label">Description (no children’s names)</span>
              <input className="form-input" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
            </label>
            {lines.length > 1 && (
              <button type="button" className="btn btn-sm" onClick={() => setLines(lines.filter((_, i) => i !== index))}>Remove line</button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => setLines([...lines, emptyLine()])}>
          <Plus className="h-4 w-4 mr-1" /> Add line
        </button>

        <label className="form-group" style={{ marginTop: "1.25rem" }}>
          <span className="form-label">Notes for the Council (optional, no names)</span>
          <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cancellations, closed days, extra journeys — without pupil names" />
        </label>

        <div className="school-invoice-totals">
          <div>Net total <strong>{formatGbp(totals.net)}</strong></div>
          <div>VAT total <strong>{formatGbp(totals.vat)}</strong></div>
          <div>Total payable <strong>{formatGbp(totals.total)}</strong></div>
        </div>

        <label className="flex items-start gap-2" style={{ margin: "1rem 0" }}>
          <input type="checkbox" checked={noChildNames} onChange={(e) => setNoChildNames(e.target.checked)} style={{ marginTop: 3 }} />
          <span className="text-sm">I confirm this invoice does not include children’s names, and the school days claimed match days operated after contractual deductions.</span>
        </label>

        {error && <p className="text-sm" style={{ color: "#b91c1c", marginBottom: "0.75rem" }}>{error}</p>}
        {status && <p className="text-sm" style={{ color: "#166534", marginBottom: "0.75rem" }}>{status}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={busy}>
            <Download className="h-4 w-4 mr-2" />
            {busy ? "Preparing PDF…" : submitOk ? "Download PDF invoice" : "Download draft PDF"}
          </button>
          <a className="btn btn-sm" href={`mailto:${OCC_FINANCE_EMAIL}?subject=${encodeURIComponent("School transport invoice — Spires Taxis")}`}>
            Email {OCC_FINANCE_EMAIL}
          </a>
        </div>
        <p className="text-xs text-gray-500" style={{ marginTop: "0.75rem" }}>
          Attach the PDF yourself. Late invoices may incur a £50 Council administration fee. Do not chase payment in the first two weeks of the processing month unless you have not received the receipt email.
        </p>
      </div>

      {history.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Recently generated</h3>
          </div>
          <ul className="text-sm space-y-2">
            {history.slice(0, 8).map((row) => (
              <li key={row.id}>
                <strong>{row.invoiceNumber}</strong>
                {row.draft ? " (draft)" : ""} · {labelForServiceMonth(row.serviceMonth)} · {formatGbp(invoiceTotals(row.lines).total)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SchoolInvoices;
