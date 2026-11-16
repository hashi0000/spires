import React, { useState } from "react";
import {
  MESSAGE_ROWS,
  OFFER_ROWS,
  OfferRow,
} from "../data/customerCommunications";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  withdrawn: "Withdrawn",
  not_configured: "Not offered",
};

function OfferTable({ rows, empty }: { rows: OfferRow[]; empty: string }) {
  if (!rows.length) return <p>{empty}</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Offer</th>
            <th>Status</th>
            <th>Starts</th>
            <th>Ends</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((offer) => (
            <tr key={offer.id}>
              <td>
                <strong>{offer.name}</strong>
                <p>{offer.benefit}</p>
                <details>
                  <summary>Details</summary>
                  <p>{offer.eligibility}</p>
                  <p>{offer.note}</p>
                </details>
              </td>
              <td>{STATUS_LABEL[offer.status] || offer.status}</td>
              <td>{offer.startsOn}</td>
              <td>{offer.endsOn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CustomerCommunications: React.FC = () => {
  const [tab, setTab] = useState<"offers" | "messages">("offers");
  const [preview, setPreview] = useState(MESSAGE_ROWS[0].name);
  const [showArchive, setShowArchive] = useState(false);
  const selected = MESSAGE_ROWS.find((row) => row.name === preview) || MESSAGE_ROWS[0];
  const activeOffers = OFFER_ROWS.filter((offer) => offer.status === "active" || offer.status === "scheduled");
  const archivedOffers = OFFER_ROWS.filter((offer) => offer.status !== "active" && offer.status !== "scheduled");

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Offers and Messages</h2>
      </div>
      <div className="btn-group" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button type="button" className={`btn btn-sm ${tab === "offers" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("offers")}>Offers</button>
        <button type="button" className={`btn btn-sm ${tab === "messages" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("messages")}>Messages</button>
      </div>

      {tab === "offers" ? (
        <div>
          <div className="comms-offer-tabs" role="group" aria-label="Offer history">
            <button type="button" className={`btn btn-sm ${!showArchive ? "btn-primary" : "btn-secondary"}`} aria-pressed={!showArchive} onClick={() => setShowArchive(false)}>Current offers ({activeOffers.length})</button>
            <button type="button" className={`btn btn-sm ${showArchive ? "btn-primary" : "btn-secondary"}`} aria-pressed={showArchive} onClick={() => setShowArchive(true)}>Past offers ({archivedOffers.length})</button>
          </div>
          <OfferTable rows={showArchive ? archivedOffers : activeOffers} empty={showArchive ? "No past offers." : "No promotions are currently running. Standard fares and agreed booking discounts still apply."} />
        </div>
      ) : (
        <div className="comms-layout">
          <div className="comms-list"><label htmlFor="message-template">Message template</label><select id="message-template" value={preview} onChange={event => setPreview(event.target.value)}>{MESSAGE_ROWS.map(row => <option key={row.name} value={row.name}>{row.name}</option>)}</select></div>
          <div>
            <p><strong>Subject:</strong> {selected.subject}</p>
            <p><strong>Sending trigger:</strong> {selected.trigger}</p>
            {selected.previewHtml ? (
              <iframe title={`${selected.name} preview`} sandbox="" srcDoc={selected.previewHtml} className="comms-preview" />
            ) : (
              <p>No rendered preview is available. Open the Firebase Authentication templates to read the live copy.</p>
            )}
            <details>
              <summary>Technical details</summary>
              <p>Source: {selected.source}</p>
              <p>Provider: {selected.service}</p>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerCommunications;
