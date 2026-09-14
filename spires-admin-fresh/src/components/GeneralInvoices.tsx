import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Mail, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_GENERAL_SUPPLIER,
  GeneratedGeneralInvoice,
  GeneralInvoiceCustomer,
  GeneralInvoiceLine,
  InvoicePaymentTerms,
  InvoiceSupplierDetails,
  SavedInvoiceClient,
  dueDateFor,
  formatGbp,
  formatUkDate,
  invoiceTotals,
  paymentTermsLabel,
  sanitiseInvoicePrefix,
  suggestInvoicePrefix,
} from "../utils/generalInvoiceTypes";
import {
  allocateGeneralInvoiceNumber,
  loadGeneralInvoiceVault,
  persistGeneralInvoiceVault,
  rebuildGeneralInvoiceSeq,
  GeneralInvoiceVault,
} from "../utils/generalInvoiceStorage";
import { downloadGeneralInvoicePdf } from "../utils/generalInvoicePdf";
import { askInvoiceRecipient, emailGeneralInvoicePdf, SPIRES_OFFICE_EMAIL } from "../utils/generalInvoiceEmail";

function emptyLine(): GeneralInvoiceLine {
  return {
    description: "Private hire journey",
    quantity: 1,
    unitPrice: 0,
    vatRatePercent: 0,
  };
}

function emptyCustomer(): GeneralInvoiceCustomer {
  return { name: "", address: "", email: "", phone: "" };
}

function emptyClientDraft() {
  return { name: "", invoicePrefix: "", email: "", phone: "", address: "" };
}

function newClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pdfInputFromRecord(
  row: GeneratedGeneralInvoice,
  supplier: InvoiceSupplierDetails
) {
  return {
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate,
    paymentTerms: row.paymentTerms,
    customer: row.customer,
    bookingNumber: row.bookingNumber,
    travelDate: row.travelDate,
    pickup: row.pickup,
    destination: row.destination,
    lines: row.lines,
    notes: row.notes,
    supplier,
  };
}

const GeneralInvoices: React.FC = () => {
  const [vault, setVault] = useState<GeneralInvoiceVault | null>(null);
  const [supplier, setSupplier] = useState<InvoiceSupplierDetails>(DEFAULT_GENERAL_SUPPLIER);
  const [clients, setClients] = useState<SavedInvoiceClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientDraft, setClientDraft] = useState(emptyClientDraft);
  const [history, setHistory] = useState<GeneratedGeneralInvoice[]>([]);
  const [customer, setCustomer] = useState<GeneralInvoiceCustomer>(emptyCustomer);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = useState<InvoicePaymentTerms>("due_on_receipt");
  const [bookingNumber, setBookingNumber] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [lines, setLines] = useState<GeneralInvoiceLine[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadGeneralInvoiceVault();
        if (cancelled) return;
        setVault(loaded);
        setSupplier(loaded.supplier);
        setClients(loaded.clients);
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

  const persist = async (next: GeneralInvoiceVault) => {
    const withClients = { ...next, clients: next.clients ?? clients };
    await persistGeneralInvoiceVault(withClients);
    setVault(withClients);
    setSupplier(withClients.supplier);
    setClients(withClients.clients);
    setHistory(withClients.invoices);
  };

  const totals = useMemo(() => invoiceTotals(lines), [lines]);
  const dueDate = dueDateFor(invoiceDate, paymentTerms);
  const selectedClient = clients.find((row) => row.id === selectedClientId) || null;
  const activePrefix = sanitiseInvoicePrefix(
    selectedClient?.invoicePrefix || supplier.invoicePrefix || "ST-INV"
  );

  const saveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!vault) return;
    setError("");
    try {
      await persist({ ...vault, supplier, clients });
      setStatus("Company details saved encrypted in Firebase.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save company details.");
    }
  };

  const applyClient = (client: SavedInvoiceClient) => {
    setSelectedClientId(client.id);
    setCustomer({
      name: client.name,
      address: client.address,
      email: client.email,
      phone: client.phone,
    });
    setStatus(`Using ${client.name}. Invoice numbers will use prefix ${client.invoicePrefix}.`);
  };

  const saveClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!vault) return;
    const name = clientDraft.name.trim();
    if (!name) {
      setError("Enter a client name to save.");
      return;
    }
    const invoicePrefix = sanitiseInvoicePrefix(clientDraft.invoicePrefix || suggestInvoicePrefix(name));
    const duplicate = clients.find((row) => sanitiseInvoicePrefix(row.invoicePrefix) === invoicePrefix);
    if (duplicate) {
      setError(`Prefix ${invoicePrefix} is already used by ${duplicate.name}.`);
      return;
    }
    setError("");
    const saved: SavedInvoiceClient = {
      id: newClientId(),
      name,
      address: clientDraft.address.trim(),
      email: clientDraft.email.trim(),
      phone: clientDraft.phone.trim(),
      invoicePrefix,
    };
    try {
      await persist({ ...vault, supplier, clients: [...clients, saved] });
      setClientDraft(emptyClientDraft());
      applyClient(saved);
      setStatus(`Saved ${saved.name}. Their invoices will be numbered ${saved.invoicePrefix}-YYYYMM-001.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save client.");
    }
  };

  const removeClient = async (id: string, name: string) => {
    if (!vault) return;
    const ok = window.confirm(`Remove saved client ${name}? Existing invoices are kept.`);
    if (!ok) return;
    try {
      const nextClients = clients.filter((row) => row.id !== id);
      await persist({ ...vault, supplier, clients: nextClients });
      if (selectedClientId === id) setSelectedClientId("");
      setStatus(`${name} removed from saved clients.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove client.");
    }
  };

  const updateLine = (index: number, patch: Partial<GeneralInvoiceLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const validate = (): string | null => {
    if (!supplier.providerName.trim() || !supplier.address.trim() || !supplier.phone.trim() || !supplier.email.trim()) {
      return "Fill in headed-paper details: provider name, address, phone and email.";
    }
    if (!supplier.sortCode.trim() || !supplier.accountNumber.trim() || !supplier.accountName.trim()) {
      return "Bank account name, sort code and account number are required.";
    }
    if (!customer.name.trim()) {
      return "Enter the customer name.";
    }
    const usable = lines.filter((l) => l.description.trim() && l.quantity > 0 && l.unitPrice > 0);
    if (!usable.length) {
      return "Add at least one line with a description, quantity and unit price.";
    }
    if (totals.total <= 0) {
      return "Invoice total must be greater than zero.";
    }
    return null;
  };

  const buildDraftRecord = (invoiceNumber: string): GeneratedGeneralInvoice => {
    const usable = lines.filter((l) => l.description.trim() && l.quantity > 0 && l.unitPrice > 0);
    return {
      id: invoiceNumber,
      invoiceNumber,
      invoiceDate,
      dueDate,
      paymentTerms,
      customer: {
        name: customer.name.trim(),
        address: customer.address.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim(),
      },
      clientId: selectedClientId || undefined,
      bookingNumber: bookingNumber.trim(),
      travelDate,
      pickup: pickup.trim(),
      destination: destination.trim(),
      lines: usable,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
  };

  const handleDownload = async () => {
    setError("");
    setStatus("");
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (!vault) {
      setError("Invoice vault is not loaded yet.");
      return;
    }
    setBusy(true);
    try {
      const allocated = allocateGeneralInvoiceNumber(
        vault,
        activePrefix,
        invoiceDate
      );
      const record = buildDraftRecord(allocated.invoiceNumber);
      await downloadGeneralInvoicePdf(pdfInputFromRecord(record, supplier));
      await persist({
        ...allocated.vault,
        supplier,
        clients,
        invoices: [record, ...history],
      });
      setStatus(`PDF ${record.invoiceNumber} downloaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the PDF.");
    } finally {
      setBusy(false);
    }
  };

  const markEmailed = async (
    invoices: GeneratedGeneralInvoice[],
    invoiceNumber: string,
    to: string,
    nextVault: GeneralInvoiceVault
  ) => {
    const stamped = invoices.map((row) =>
      row.invoiceNumber === invoiceNumber
        ? { ...row, emailedAt: new Date().toISOString(), emailedTo: to }
        : row
    );
    await persist({ ...nextVault, supplier, invoices: stamped });
  };

  const handleEmail = async () => {
    setError("");
    setStatus("");
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (!vault) {
      setError("Invoice vault is not loaded yet.");
      return;
    }
    const to = askInvoiceRecipient(customer.email);
    if (!to) return;
    setBusy(true);
    try {
      const allocated = allocateGeneralInvoiceNumber(
        vault,
        activePrefix,
        invoiceDate
      );
      const record = buildDraftRecord(allocated.invoiceNumber);
      record.customer = { ...record.customer, email: to };
      const nextVault = { ...allocated.vault, supplier, clients, invoices: [record, ...history] };
      await persist(nextVault);
      const sent = await emailGeneralInvoicePdf(record, supplier, to);
      await markEmailed(nextVault.invoices, record.invoiceNumber, sent.to, nextVault);
      setStatus(
        sent.cc
          ? `Invoice ${record.invoiceNumber} emailed to ${sent.to}, copy to ${sent.cc}.`
          : `Invoice ${record.invoiceNumber} emailed to ${sent.to}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not email the invoice.");
    } finally {
      setBusy(false);
    }
  };

  const emailSavedInvoice = async (row: GeneratedGeneralInvoice) => {
    if (!vault) return;
    const to = askInvoiceRecipient(row.customer.email);
    if (!to) return;
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const sent = await emailGeneralInvoicePdf(row, supplier, to);
      await markEmailed(history, row.invoiceNumber, sent.to, vault);
      setStatus(
        sent.cc
          ? `Invoice ${row.invoiceNumber} emailed to ${sent.to}, copy to ${sent.cc}.`
          : `Invoice ${row.invoiceNumber} emailed to ${sent.to}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not email the invoice.");
    } finally {
      setBusy(false);
    }
  };

  const removeGeneratedInvoice = async (id: string, invoiceNumber: string) => {
    if (!vault) return;
    const ok = window.confirm(
      `Delete ${invoiceNumber} from Firebase? Company details are kept. This cannot be undone.`
    );
    if (!ok) return;
    setError("");
    setBusy(true);
    try {
      const invoices = history.filter((row) => row.id !== id);
      await persist({ ...vault, supplier, clients, invoices, seq: rebuildGeneralInvoiceSeq(invoices) });
      setStatus(`${invoiceNumber} removed. The next PDF can reuse that number if it was the latest.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete invoice.");
    } finally {
      setBusy(false);
    }
  };

  const redownloadInvoice = async (row: GeneratedGeneralInvoice) => {
    setError("");
    setStatus("");
    setBusy(true);
    try {
      await downloadGeneralInvoicePdf(pdfInputFromRecord(row, supplier));
      setStatus(`PDF ${row.invoiceNumber} downloaded again.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the PDF.");
    } finally {
      setBusy(false);
    }
  };

  const clearGeneratedInvoices = async () => {
    if (!vault || history.length === 0) return;
    const ok = window.confirm(
      `Delete all ${history.length} recently generated invoice${history.length === 1 ? "" : "s"} from Firebase? Company details are kept. Invoice numbers will start again from 001.`
    );
    if (!ok) return;
    setError("");
    setBusy(true);
    try {
      await persist({ ...vault, supplier, clients, invoices: [], seq: {} });
      setStatus("Recently generated invoices cleared. The next PDF will be numbered 001.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear invoices.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <p className="text-sm text-gray-600">Loading encrypted invoices from Firebase…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
        <p className="text-sm text-gray-600 mt-1">
          General customer invoices on Spires headed paper. Bank details, VAT numbers and invoice history are stored in Firebase as AES-256-GCM ciphertext — they are not readable in the Firestore console.
          Use School invoices for Oxfordshire County Council DPS work.
        </p>
      </div>

      <form className="card" onSubmit={saveSupplier}>
        <div className="card-header">
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Headed paper and bank details</h3>
          <button type="submit" className="btn btn-primary btn-sm">Save details</button>
        </div>
        <p className="text-sm text-gray-600" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
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
            <span className="form-label">Default prefix for one-off customers</span>
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
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Saved clients</h3>
        </div>
        <p className="text-sm text-gray-600" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
          Each saved client has their own invoice prefix, so their numbers stay in a separate sequence.
        </p>
        <form onSubmit={saveClient} className="school-invoice-grid" style={{ marginBottom: "1rem" }}>
          <label className="form-group">
            <span className="form-label">Client name</span>
            <input
              className="form-input"
              value={clientDraft.name}
              onChange={(e) => {
                const name = e.target.value;
                setClientDraft((current) => ({
                  ...current,
                  name,
                  invoicePrefix:
                    !current.invoicePrefix || current.invoicePrefix === suggestInvoicePrefix(current.name)
                      ? suggestInvoicePrefix(name)
                      : current.invoicePrefix,
                }));
              }}
            />
          </label>
          <label className="form-group">
            <span className="form-label">Invoice prefix</span>
            <input
              className="form-input"
              value={clientDraft.invoicePrefix}
              onChange={(e) => setClientDraft({ ...clientDraft, invoicePrefix: e.target.value.toUpperCase() })}
              placeholder="ST-ACME"
            />
          </label>
          <label className="form-group">
            <span className="form-label">Email</span>
            <input className="form-input" type="email" value={clientDraft.email} onChange={(e) => setClientDraft({ ...clientDraft, email: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Phone</span>
            <input className="form-input" value={clientDraft.phone} onChange={(e) => setClientDraft({ ...clientDraft, phone: e.target.value })} />
          </label>
          <label className="form-group" style={{ gridColumn: "1 / -1" }}>
            <span className="form-label">Address</span>
            <textarea className="form-textarea" rows={2} value={clientDraft.address} onChange={(e) => setClientDraft({ ...clientDraft, address: e.target.value })} />
          </label>
          <div>
            <button type="submit" className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4 mr-1" /> Save client
            </button>
          </div>
        </form>
        {clients.length === 0 ? (
          <p className="text-sm text-gray-500">No saved clients yet. Add a name and prefix, then use them on invoices.</p>
        ) : (
          <ul className="space-y-2">
            {clients.map((client) => (
              <li key={client.id} className="flex items-center justify-between gap-3" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.65rem 0.85rem" }}>
                <div>
                  <strong>{client.name}</strong>
                  <span className="text-sm text-gray-600"> · {client.invoicePrefix}</span>
                  {client.email ? <div className="text-sm text-gray-500">{client.email}</div> : null}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-sm" onClick={() => applyClient(client)}>Use on invoice</button>
                  <button type="button" className="btn btn-sm" onClick={() => removeClient(client.id, client.name)} aria-label={`Remove client ${client.name}`}>
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
            <span className="form-label">Saved client</span>
            <select
              className="form-select"
              value={selectedClientId}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) {
                  setSelectedClientId("");
                  return;
                }
                const found = clients.find((row) => row.id === id);
                if (found) applyClient(found);
              }}
            >
              <option value="">One-off customer ({sanitiseInvoicePrefix(supplier.invoicePrefix || "ST-INV")})</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.invoicePrefix})
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Invoice prefix in use</span>
            <input className="form-input" value={activePrefix} readOnly />
          </label>
          <label className="form-group">
            <span className="form-label">Invoice date</span>
            <input className="form-input" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">Payment terms</span>
            <select className="form-select" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as InvoicePaymentTerms)}>
              <option value="due_on_receipt">Due on receipt</option>
              <option value="14_days">14 days</option>
              <option value="28_days">28 days</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Due date</span>
            <input className="form-input" value={dueDate ? formatUkDate(dueDate) : ""} readOnly />
          </label>
          <label className="form-group">
            <span className="form-label">Customer name</span>
            <input className="form-input" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Customer email</span>
            <input className="form-input" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Used when you email the invoice" />
          </label>
          <label className="form-group">
            <span className="form-label">Customer phone</span>
            <input className="form-input" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </label>
          <label className="form-group" style={{ gridColumn: "1 / -1" }}>
            <span className="form-label">Customer address</span>
            <textarea className="form-textarea" rows={3} value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Booking reference (optional)</span>
            <input className="form-input" value={bookingNumber} onChange={(e) => setBookingNumber(e.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">Travel date (optional)</span>
            <input className="form-input" type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">Pickup (optional)</span>
            <input className="form-input" value={pickup} onChange={(e) => setPickup(e.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">Destination (optional)</span>
            <input className="form-input" value={destination} onChange={(e) => setDestination(e.target.value)} />
          </label>
        </div>

        {lines.map((line, index) => (
          <div key={index} className="school-invoice-line">
            <label className="form-group" style={{ gridColumn: "1 / -1" }}>
              <span className="form-label">Description</span>
              <input className="form-input" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
            </label>
            <label className="form-group">
              <span className="form-label">Quantity</span>
              <input className="form-input" type="number" min="0" step="0.01" value={line.quantity || ""} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })} />
            </label>
            <label className="form-group">
              <span className="form-label">Unit price (£)</span>
              <input className="form-input" type="number" min="0" step="0.01" value={line.unitPrice || ""} onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })} />
            </label>
            <label className="form-group">
              <span className="form-label">VAT %</span>
              <input className="form-input" type="number" min="0" step="0.1" value={line.vatRatePercent} onChange={(e) => updateLine(index, { vatRatePercent: Number(e.target.value) || 0 })} />
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
          <span className="form-label">Notes (optional)</span>
          <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Waiting time, extras, or payment notes" />
        </label>

        <div className="school-invoice-totals">
          <div>Net total <strong>{formatGbp(totals.net)}</strong></div>
          <div>VAT total <strong>{formatGbp(totals.vat)}</strong></div>
          <div>Total payable <strong>{formatGbp(totals.total)}</strong></div>
        </div>

        {error && <p className="text-sm" style={{ color: "#b91c1c", marginBottom: "0.75rem" }}>{error}</p>}
        {status && <p className="text-sm" style={{ color: "#166534", marginBottom: "0.75rem" }}>{status}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={busy}>
            <Download className="h-4 w-4 mr-2" />
            {busy ? "Preparing PDF…" : "Download PDF invoice"}
          </button>
          <button type="button" className="btn btn-success" onClick={handleEmail} disabled={busy}>
            <Mail className="h-4 w-4 mr-2" />
            {busy ? "Sending…" : "Email PDF invoice"}
          </button>
        </div>
        <p className="text-xs text-gray-500" style={{ marginTop: "0.75rem" }}>
          Emails go to the customer address you confirm, with a copy to {SPIRES_OFFICE_EMAIL}.
        </p>
      </div>

      {history.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Recently generated</h3>
            <button type="button" className="btn btn-danger btn-sm" onClick={clearGeneratedInvoices} disabled={busy}>
              Clear all
            </button>
          </div>
          <p className="text-sm text-gray-600" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
            Download again with the current headed paper, or email the PDF to the customer (copy to {SPIRES_OFFICE_EMAIL}).
          </p>
          <ul className="text-sm space-y-2">
            {history.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.65rem 0.85rem" }}>
                <div>
                  <strong>{row.invoiceNumber}</strong>
                  {" · "}
                  {row.customer.name}
                  {" · "}
                  {formatUkDate(row.invoiceDate)}
                  {" · "}
                  {paymentTermsLabel(row.paymentTerms)}
                  {" · "}
                  {formatGbp(invoiceTotals(row.lines).total)}
                  {row.emailedTo ? (
                    <div className="text-xs text-gray-500">Emailed to {row.emailedTo}</div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => redownloadInvoice(row)}
                    disabled={busy}
                    title="Download this invoice PDF again"
                    aria-label={`Redownload invoice ${row.invoiceNumber}`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => emailSavedInvoice(row)}
                    disabled={busy}
                    title={`Email this invoice (copy to ${SPIRES_OFFICE_EMAIL})`}
                    aria-label={`Email invoice ${row.invoiceNumber}`}
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeGeneratedInvoice(row.id, row.invoiceNumber)}
                    disabled={busy}
                    aria-label={`Delete invoice ${row.invoiceNumber}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GeneralInvoices;
