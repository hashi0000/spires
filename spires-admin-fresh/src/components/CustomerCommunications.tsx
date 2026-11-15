import React, { useState } from "react";
import {
  COMMUNICATIONS_REVIEWED_ON,
  MESSAGE_ROWS,
  OFFER_ROWS,
  RELEASE_CHECKLIST,
} from "../data/customerCommunications";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  withdrawn: "Withdrawn",
  not_configured: "Not configured",
};

const CustomerCommunications: React.FC = () => {
  const [preview, setPreview] = useState(MESSAGE_ROWS[0].name);

  const selected = MESSAGE_ROWS.find((row) => row.name === preview) || MESSAGE_ROWS[0];

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Offers and customer communications</h2>
      </div>
      <p>
        Reviewed in this repository on {COMMUNICATIONS_REVIEWED_ON}. Return fare savings on the rate card are separate from these offers. A discount already stored on a booking is not changed here.
      </p>

      <h3>Offers</h3>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Offer</th>
              <th>Status</th>
              <th>Starts</th>
              <th>Ends</th>
              <th>Where it is used</th>
            </tr>
          </thead>
          <tbody>
            {OFFER_ROWS.map((offer) => (
              <tr key={offer.id}>
                <td>
                  <strong>{offer.name}</strong>
                  <div>{offer.eligibility}</div>
                  <div>{offer.note}</div>
                </td>
                <td>{STATUS_LABEL[offer.status] || offer.status}</td>
                <td>{offer.startsOn}</td>
                <td>{offer.endsOn}</td>
                <td>{offer.usedIn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Customer messages</h3>
      <div className="btn-group" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
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
      <div className="card" style={{ background: "#f7f9fc" }}>
        <p><strong>{selected.name}</strong></p>
        <p>Trigger: {selected.trigger}</p>
        <p>Source: {selected.source}</p>
        <p>Sending service: {selected.service}</p>
        <p>Status: {selected.active}</p>
        <p>Preview: {selected.preview}</p>
      </div>

      <h3>Before a release</h3>
      <ol>
        {RELEASE_CHECKLIST.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
};

export default CustomerCommunications;
