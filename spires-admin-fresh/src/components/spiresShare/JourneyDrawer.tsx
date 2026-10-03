import React, { useState } from "react";
import { BoardingPanel } from "./BoardingPanel";
import { Drawer } from "./Drawer";
import { LiveCountdown } from "./LiveCountdown";
import { PassengerTable } from "./PassengerTable";
import { PaymentPanel } from "./PaymentPanel";
import { WaitlistPanel } from "./WaitlistPanel";
import { gbp, humanJourneyStage, localInputToIso, paidVerifiedSeats, PAYMENT_GUARANTEE, penceFromPounds, routeLabel } from "./shareLabels";
import { RunAction, ShareBooking, ShareDriver, ShareJourney, ShareState, ShareWaitlist } from "./types";

type AdminFn = (data: Record<string, unknown>) => Promise<unknown>;

export function JourneyDrawer({
  journey,
  bookings,
  waitlist,
  hubs,
  drivers,
  paymentDraft,
  deadlineDraft,
  noteDraft,
  refundDraft,
  selectedHubId,
  onPaymentDraft,
  onDeadlineDraft,
  onNoteDraft,
  onRefundDraft,
  onHubId,
  onClose,
  onOpenBoarding,
  run,
  busyKey,
  adminAction,
}: {
  journey: ShareJourney;
  bookings: ShareBooking[];
  waitlist: ShareWaitlist[];
  hubs: NonNullable<ShareState["hubs"]>;
  drivers: ShareDriver[];
  paymentDraft: string;
  deadlineDraft: string;
  noteDraft: string;
  refundDraft: { bookingId: string; refundStatus: string; amountRefundedPence: string; amountRetainedPence: string; adminNotes: string };
  selectedHubId: string;
  onPaymentDraft: (value: string) => void;
  onDeadlineDraft: (value: string) => void;
  onNoteDraft: (value: string) => void;
  onRefundDraft: (value: { bookingId: string; refundStatus: string; amountRefundedPence: string; amountRetainedPence: string; adminNotes: string }) => void;
  onHubId: (value: string) => void;
  onClose: () => void;
  onOpenBoarding: () => void;
  run: RunAction;
  busyKey: string;
  adminAction: AdminFn;
}) {
  const stage = humanJourneyStage(journey, bookings);
  const { paid, verified } = paidVerifiedSeats(bookings);
  const collected = bookings.reduce((sum, row) => sum + (row.paidAmountPence || 0) + (row.supplementPaidPence || 0), 0);
  const remaining = Math.max(0, journey.capacity - verified);
  const [open, setOpen] = useState({ passengers: true, payment: true, waitlist: false, notes: false });
  const holding = bookings.filter((row) => ["PROVISIONAL", "PAYMENT_PENDING", "PAID"].includes(row.reservationStatus || ""));
  const jid = journey.id;

  return (
    <Drawer title={journey.publicNumber} onClose={onClose} wide>
      <section className="share-ops-section">
        <h4>Summary</h4>
        <p>{routeLabel(journey)}</p>
        <p>{journey.travelDate} · {journey.departureTime}</p>
        <p className="share-ops-chip">{stage}</p>
        <p>Seats {journey.occupiedSeats} / {journey.capacity}</p>
        <p>Payments {verified} / {journey.capacity} verified · {paid} received</p>
        {journey.paymentDeadlineAt ? <LiveCountdown deadlineAt={journey.paymentDeadlineAt} prefix="Payment closes in" /> : null}
        <p>Collected {gbp(collected)} · Target {gbp(journey.targetRevenuePence)}</p>
        <p>{journey.customerVisible ? "Visible" : "Hidden"} · {journey.status === "CONFIRMED" || journey.locked ? "Confirmed" : "Not confirmed"}</p>
        <p className="share-ops-note">{PAYMENT_GUARANTEE}</p>
        <div className="share-ops-inline">
          <button type="button" className="btn btn-sm" disabled={busyKey === `pub-${jid}`} onClick={() => run(`pub-${jid}`, async () => { await adminAction({ action: journey.customerVisible ? "unpublish-journey" : "publish-journey", journeyId: jid }); })}>
            {journey.customerVisible ? "Hide from customers" : "Make available to customers"}
          </button>
          <button type="button" className="btn btn-danger btn-sm" disabled={busyKey === `cancel-${jid}`} onClick={() => run(`cancel-${jid}`, async () => { await adminAction({ action: "cancel", journeyId: jid }); })}>Cancel journey</button>
        </div>
      </section>
      <section className="share-ops-section">
        <h4>Next action</h4>
        {stage === "Ready to open payment" ? (
          <button type="button" className="btn btn-primary" disabled={busyKey === `openpay-${jid}`} onClick={() => run(`openpay-${jid}`, async () => { await adminAction({ action: "open-payment-window", journeyId: jid }); })}>Open payment window</button>
        ) : stage === "Ready to confirm" ? (
          <button type="button" className="btn btn-primary" disabled={busyKey === `confirm-${jid}`} onClick={() => run(`confirm-${jid}`, async () => { await adminAction({ action: "confirm", journeyId: jid }); })}>Confirm journey</button>
        ) : stage === "Add payment link" ? (
          <p>Paste a hosted payment URL below, then save it. Saving does not email passengers.</p>
        ) : stage === "Collecting payment" ? (
          <p>Mark payments as received as money lands.</p>
        ) : (
          <p>Nothing required</p>
        )}
      </section>
      <section className="share-ops-section">
        <button type="button" className="share-ops-fold" onClick={() => setOpen({ ...open, passengers: !open.passengers })}>Passengers</button>
        {open.passengers ? (
          <PassengerTable
            journey={journey}
            bookings={bookings}
            busyKey={busyKey}
            onMarkPaid={(id) => run(`paid-${id}`, async () => { await adminAction({ action: "mark-paid", journeyId: jid, bookingId: id }); })}
            onUndo={(id) => run(`undo-${id}`, async () => { await adminAction({ action: "undo-payment", journeyId: jid, bookingId: id }); })}
          />
        ) : null}
      </section>
      <PaymentPanel
        journey={journey}
        required={journey.capacity}
        verified={verified}
        collected={collected}
        remaining={remaining}
        paymentDraft={paymentDraft}
        deadlineDraft={deadlineDraft}
        onPaymentDraft={onPaymentDraft}
        onDeadlineDraft={onDeadlineDraft}
        onSaveLink={() => run(`link-${jid}`, async () => { await adminAction({ action: "set-payment-link", journeyId: jid, paymentLinkUrl: paymentDraft }); })}
        onOpenWindow={() => run(`openpay-${jid}`, async () => { await adminAction({ action: "open-payment-window", journeyId: jid }); })}
        onChangeDeadline={() => run(`pdead-${jid}`, async () => { await adminAction({ action: "set-payment-deadline", journeyId: jid, paymentDeadlineAt: localInputToIso(deadlineDraft) }); })}
        busyKey={busyKey}
      />
      <button type="button" className="share-ops-fold" onClick={() => setOpen({ ...open, waitlist: !open.waitlist })}>Waitlist</button>
      {open.waitlist || waitlist.length > 0 ? (
        <WaitlistPanel items={waitlist} onOffer={() => run(`wait-${jid}`, async () => { await adminAction({ action: "offer-waitlist", journeyId: jid }); })} busy={busyKey === `wait-${jid}`} />
      ) : null}
      <BoardingPanel
        journey={journey}
        bookings={bookings}
        drivers={drivers}
        onAssign={(driverId) => run(`assign-${jid}`, async () => { await adminAction({ action: "assign", journeyId: jid, driverId }); })}
        onOpenBoarding={onOpenBoarding}
        onResend={() => run(`manifest-${jid}`, async () => { await adminAction({ action: "resend-driver-manifest", journeyId: jid }); })}
        busyKey={busyKey}
      />
      {journey.destinationMatchingEnabled ? (
        <section className="share-ops-section">
          <h4>City drop off</h4>
          <p>{holding.length} passengers interested</p>
          <ul className="share-ops-plain">
            {holding.map((booking, index) => (
              <li key={booking.id}>Passenger {index + 1}: {booking.intendedDestinationText || "Not entered"}</li>
            ))}
          </ul>
          <p>Proposed shared drop off: {journey.proposedSharedDropoffDisplayName || "Not selected yet"}</p>
          <div className="share-ops-inline">
            <select className="form-select" value={selectedHubId} onChange={(e) => onHubId(e.target.value)}>
              <option value="">Select shared drop off</option>
              {hubs.filter((hub) => hub.enabled).map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.displayName || hub.name}</option>
              ))}
            </select>
            <button type="button" className="btn btn-sm" disabled={!selectedHubId || busyKey === `hub-${jid}`} onClick={() => run(`hub-${jid}`, async () => { await adminAction({ action: "set-proposed-dropoff", journeyId: jid, hubId: selectedHubId }); })}>Set as proposed drop off</button>
          </div>
        </section>
      ) : null}
      <button type="button" className="share-ops-fold" onClick={() => setOpen({ ...open, notes: !open.notes })}>Notes and refunds</button>
      {open.notes ? (
        <section className="share-ops-section">
          <div className="share-ops-inline">
            <input className="form-input" placeholder="Journey admin note" value={noteDraft} onChange={(e) => onNoteDraft(e.target.value)} />
            <button type="button" className="btn btn-sm" disabled={busyKey === `note-${jid}`} onClick={() => run(`note-${jid}`, async () => { await adminAction({ action: "add-admin-note", journeyId: jid, adminNotes: noteDraft }); })}>Add admin note</button>
          </div>
          <div className="share-ops-inline">
            <select className="form-select" value={refundDraft.bookingId} onChange={(e) => onRefundDraft({ ...refundDraft, bookingId: e.target.value })}>
              <option value="">Record refund for</option>
              {bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.name}</option>)}
            </select>
            <select className="form-select" value={refundDraft.refundStatus} onChange={(e) => onRefundDraft({ ...refundDraft, refundStatus: e.target.value })}>
              <option value="PENDING">Pending</option>
              <option value="REFUNDED">Refunded</option>
              <option value="RETAINED">Retained</option>
              <option value="PARTIAL">Partial</option>
            </select>
            <input className="form-input" placeholder="Refunded pounds" value={refundDraft.amountRefundedPence} onChange={(e) => onRefundDraft({ ...refundDraft, amountRefundedPence: e.target.value })} />
            <button type="button" className="btn btn-sm" disabled={!refundDraft.bookingId || busyKey === `refund-${jid}`} onClick={() => run(`refund-${jid}`, async () => { await adminAction({ action: "record-refund", journeyId: jid, bookingId: refundDraft.bookingId, refundStatus: refundDraft.refundStatus, amountRefundedPence: penceFromPounds(refundDraft.amountRefundedPence), amountRetainedPence: penceFromPounds(refundDraft.amountRetainedPence), adminNotes: refundDraft.adminNotes }); })}>Record refund</button>
          </div>
        </section>
      ) : null}
    </Drawer>
  );
}
