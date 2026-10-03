import React, { FormEvent, useState } from "react";
import { ShareState } from "./types";

export function ShareConfig({
  config,
  notificationsLive,
  onSave,
  busy,
}: {
  config: ShareState["config"];
  notificationsLive: boolean;
  onSave: (config: ShareState["config"]) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(config);
  const set = (patch: Partial<ShareState["config"]>) => setDraft({ ...draft, ...patch });
  return (
    <form
      className="share-ops-form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <h4>Share settings</h4>
      <label className="form-group"><span className="form-label">Passenger capacity</span><input className="form-input" type="number" value={draft.passengerCapacity} onChange={(e) => set({ passengerCapacity: Number(e.target.value) || 5 })} /></label>
      <label className="form-group"><span className="form-label">Interest threshold</span><input className="form-input" type="number" value={draft.earlyDepartureThreshold} onChange={(e) => set({ earlyDepartureThreshold: Number(e.target.value) || 4 })} /></label>
      <label className="form-group"><span className="form-label">Confirmation hours before departure</span><input className="form-input" type="number" value={draft.confirmationDeadlineHoursBeforeDeparture} onChange={(e) => set({ confirmationDeadlineHoursBeforeDeparture: Number(e.target.value) || 24 })} /></label>
      <h4>Notifications</h4>
      <p>Email delivery: <strong>{notificationsLive ? "LIVE" : "DRY RUN"}</strong></p>
      <p className="share-ops-muted">Live sending also requires the SHARE_NOTIFICATIONS_SEND environment flag. Dry run records the email without delivering it.</p>
      <label className="form-group"><span className="form-label">Quiet hours start</span><input className="form-input" value={draft.paymentQuietHoursStart || ""} onChange={(e) => set({ paymentQuietHoursStart: e.target.value })} /></label>
      <label className="form-group"><span className="form-label">Quiet hours end</span><input className="form-input" value={draft.paymentQuietHoursEnd || ""} onChange={(e) => set({ paymentQuietHoursEnd: e.target.value })} /></label>
      <h4>Operation</h4>
      <p>Meeting point: {draft.meetingPoint.publicName}</p>
      <p>Luggage: {draft.luggage.largeSuitcasesPerPassenger} large suitcase and {draft.luggage.cabinBagsPerPassenger} cabin bag per passenger.</p>
      <button type="submit" className="btn btn-primary" disabled={busy}>Save configuration</button>
    </form>
  );
}
