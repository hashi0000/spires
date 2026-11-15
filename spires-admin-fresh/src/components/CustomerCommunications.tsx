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
          <h3>Active</h3>
          <OfferTable rows={activeOffers} empty="No active offers" />
          <h3>Archived</h3>
          <OfferTable rows={archivedOffers} empty="No archived offers" />
        </div>
      ) : (
        <div className="comms-layout">
          <div className="comms-list">
            {MESSAGE_ROWS.map((row) => (
              <button
                key={row.name}
                type="button"
                className={`btn btn-sm ${selected.name === row.name ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setPreview(row.name)}
              >
                {row.name}
              </button>
            ))}
          </div>
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
