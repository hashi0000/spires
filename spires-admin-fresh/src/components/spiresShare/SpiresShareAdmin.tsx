import React, { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../utils/firebase";
import { getCallableErrorMessage } from "../../utils/callableErrorMessage";
import { AdvancedPanel } from "./AdvancedPanel";
import { DriverBoard } from "./DriverBoard";
import { InterestList } from "./InterestList";
import { InterestProposeDrawer } from "./InterestProposeDrawer";
import { InterestReviewDrawer } from "./InterestReviewDrawer";
import { JourneyDrawer } from "./JourneyDrawer";
import { JourneyList } from "./JourneyList";
import { NeedsActionQueue } from "./NeedsActionQueue";
import { buildNeedsAction, isoToLocalInput, localInputToIso } from "./shareLabels";
import { ShareState, ShareView } from "./types";

const getState = httpsCallable(functions, "spiresShareGetState");
const saveConfigFn = httpsCallable(functions, "spiresShareSaveConfig");
const adminActionFn = httpsCallable(functions, "spiresShareAdminAction");
const runTickFn = httpsCallable(functions, "spiresShareRunTick");

const SpiresShareAdmin: React.FC = () => {
  const [state, setState] = useState<ShareState | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [view, setView] = useState<ShareView>("needs");
  const [journeyFilter, setJourneyFilter] = useState("all");
  const [interestId, setInterestId] = useState("");
  const [proposeId, setProposeId] = useState("");
  const [journeyId, setJourneyId] = useState("");
  const [boardingId, setBoardingId] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>({});
  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<string, string>>({});
  const [interestDeadlines, setInterestDeadlines] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hubIds, setHubIds] = useState<Record<string, string>>({});
  const [refunds, setRefunds] = useState<Record<string, { bookingId: string; refundStatus: string; amountRefundedPence: string; amountRetainedPence: string; adminNotes: string }>>({});

  const reload = async () => {
    const result = await getState({});
    setState(result.data as ShareState);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getState({});
        if (!cancelled) setState(result.data as ShareState);
      } catch (err) {
        if (!cancelled) setError(getCallableErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    setError("");
    setStatus("");
    try {
      await fn();
      await reload();
    } catch (err) {
      const message = getCallableErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setBusyKey("");
    }
  };

  const adminAction = async (data: Record<string, unknown>) => {
    const result = await adminActionFn(data);
    return result.data;
  };

  const needs = useMemo(
    () => state ? buildNeedsAction({
      journeys: state.journeys,
      bookings: state.bookings,
      interestGroups: state.interestGroups || [],
      waitlist: state.waitlist,
    }) : [],
    [state]
  );

  if (error && !state) {
    return <div className="card"><h3 className="card-title">Spires Share</h3><p className="share-ops-error">{error}</p></div>;
  }
  if (!state) {
    return <div className="card"><p className="text-sm text-gray-600">Loading Spires Share…</p></div>;
  }

  const interestGroup = (state.interestGroups || []).find((row) => row.id === interestId) || null;
  const proposeGroup = (state.interestGroups || []).find((row) => row.id === proposeId) || null;
  const selectedJourney = state.journeys.find((row) => row.id === journeyId) || null;
  const boardingJourney = state.journeys.find((row) => row.id === boardingId) || null;
  const defaultRefund = { bookingId: "", refundStatus: "PENDING", amountRefundedPence: "", amountRetainedPence: "", adminNotes: "" };
  const heathrowFare = state.config.airports.find((row) => row.id === "heathrow")?.farePence || 3500;
  const activeJourneys = state.journeys.filter((row) => !["COMPLETED", "CANCELLED", "EXPIRED"].includes(row.status)).length;
  const confirmed = state.journeys.filter((row) => row.status === "CONFIRMED").length;
  const liveInterest = (state.interestGroups || []).filter((row) => !["CONVERTED_TO_JOURNEY", "CANCELLED", "EXPIRED"].includes(row.status)).length;

  const openInterest = (id: string, propose?: boolean) => {
    setView("interest");
    setInterestId(id);
    if (propose) setProposeId(id);
  };

  return (
    <div className="share-ops">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Spires Share</h2>
        <p className="text-sm text-gray-600 mt-1">Demand led shared private hire. A journey is confirmed only after required places, acceptances, and verified payments.</p>
      </div>
      <nav className="share-ops-nav">
        <button type="button" className={`btn btn-sm${view === "needs" ? " btn-primary" : ""}`} onClick={() => setView("needs")}>Needs action{needs.length ? ` (${needs.length})` : ""}</button>
        <button type="button" className={`btn btn-sm${view === "interest" ? " btn-primary" : ""}`} onClick={() => setView("interest")}>Interest</button>
        <button type="button" className={`btn btn-sm${view === "journeys" ? " btn-primary" : ""}`} onClick={() => setView("journeys")}>Journeys</button>
        <button type="button" className={`btn btn-sm${view === "advanced" ? " btn-primary" : ""}`} onClick={() => setView("advanced")}>Advanced</button>
      </nav>
      {error ? <p className="share-ops-error">{error}</p> : null}
      {status ? <p className="share-ops-ok">{status}</p> : null}

      {view === "needs" ? (
        <NeedsActionQueue
          items={needs}
          summary={{ needs: needs.length, interest: liveInterest, active: activeJourneys, confirmed }}
          onOpenInterest={openInterest}
          onOpenJourney={(id) => { setView("journeys"); setJourneyId(id); }}
        />
      ) : null}

      {view === "interest" ? (
        <InterestList
          groups={state.interestGroups || []}
          onReview={(id, propose) => { setInterestId(id); if (propose) setProposeId(id); }}
        />
      ) : null}

      {view === "journeys" ? (
        <JourneyList
          journeys={state.journeys}
          bookings={state.bookings}
          filter={journeyFilter}
          onFilter={setJourneyFilter}
          onOpen={setJourneyId}
        />
      ) : null}

      {view === "advanced" ? (
        <AdvancedPanel
          state={state}
          run={run}
          busyKey={busyKey}
          adminAction={adminAction}
          saveConfig={async (config) => { await saveConfigFn({ config }); setStatus("Configuration saved."); }}
          runTick={async () => { await runTickFn({}); setStatus("Deadline tick ran."); }}
        />
      ) : null}

      {interestGroup ? (
        <InterestReviewDrawer
          group={interestGroup}
          deadlineDraft={interestDeadlines[interestGroup.id] || isoToLocalInput(interestGroup.interestDeadlineAt)}
          onDeadlineDraft={(value) => setInterestDeadlines({ ...interestDeadlines, [interestGroup.id]: value })}
          onSaveDeadline={() => run(`deadline-${interestGroup.id}`, async () => {
            await adminAction({ action: "set-interest-deadline", interestGroupId: interestGroup.id, interestDeadlineAt: localInputToIso(interestDeadlines[interestGroup.id] || isoToLocalInput(interestGroup.interestDeadlineAt)) });
            setStatus("Interest deadline updated.");
          })}
          onCloseGroup={() => run(`close-${interestGroup.id}`, async () => {
            await adminAction({ action: "close-interest", interestGroupId: interestGroup.id });
            setInterestId("");
            setStatus("Interest group closed.");
          })}
          onClose={() => setInterestId("")}
          onPropose={() => setProposeId(interestGroup.id)}
          busyKey={busyKey}
        />
      ) : null}

      {proposeGroup ? (
        <InterestProposeDrawer
          group={proposeGroup}
          hubs={state.hubs || []}
          defaults={{ departureLocation: "Thornhill Park and Ride", destinationLabel: "Heathrow Terminal 3", farePence: heathrowFare }}
          busy={busyKey === `propose-${proposeGroup.id}`}
          onClose={() => setProposeId("")}
          onPropose={async (payload) => {
            await run(`propose-${proposeGroup.id}`, async () => {
              await adminAction({ action: "propose-from-interest", interestGroupId: proposeGroup.id, ...payload });
              setProposeId("");
              setInterestId("");
              setStatus("Journey proposed from interest. Passengers must accept the exact departure. No payment has been taken.");
            });
          }}
        />
      ) : null}

      {selectedJourney ? (
        <JourneyDrawer
          journey={selectedJourney}
          bookings={state.bookings.filter((row) => row.journeyId === selectedJourney.id)}
          waitlist={state.waitlist.filter((row) => row.journeyId === selectedJourney.id)}
          hubs={state.hubs || []}
          drivers={state.drivers || []}
          paymentDraft={paymentDrafts[selectedJourney.id] || ""}
          deadlineDraft={deadlineDrafts[selectedJourney.id] || ""}
          noteDraft={notes[selectedJourney.id] || ""}
          refundDraft={refunds[selectedJourney.id] || defaultRefund}
          selectedHubId={hubIds[selectedJourney.id] || ""}
          onPaymentDraft={(value) => setPaymentDrafts({ ...paymentDrafts, [selectedJourney.id]: value })}
          onDeadlineDraft={(value) => setDeadlineDrafts({ ...deadlineDrafts, [selectedJourney.id]: value })}
          onNoteDraft={(value) => setNotes({ ...notes, [selectedJourney.id]: value })}
          onRefundDraft={(value) => setRefunds({ ...refunds, [selectedJourney.id]: value })}
          onHubId={(value) => setHubIds({ ...hubIds, [selectedJourney.id]: value })}
          onClose={() => setJourneyId("")}
          onOpenBoarding={() => { setBoardingId(selectedJourney.id); }}
          run={async (key, fn) => {
            await run(key, async () => {
              await fn();
              setStatus("Updated.");
            });
          }}
          busyKey={busyKey}
          adminAction={adminAction}
        />
      ) : null}

      {boardingJourney ? (
        <div className="share-ops-drawer-backdrop" onClick={() => setBoardingId("")} role="presentation">
          <aside className="share-ops-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="share-ops-drawer-head">
              <h3>Driver boarding</h3>
              <button type="button" className="btn btn-sm" onClick={() => setBoardingId("")}>Close</button>
            </div>
            <DriverBoard
              journey={boardingJourney}
              bookings={state.bookings.filter((row) => row.journeyId === boardingJourney.id)}
              busyKey={busyKey}
              onVerify={(bookingId, code, eventLeg) => run(`verify-${bookingId}`, async () => {
                await adminAction({ action: "driver", journeyId: boardingJourney.id, bookingId, boardAction: "VERIFY", boardingCode: code, eventLeg: eventLeg || "OUTBOUND" });
              })}
              onNoShow={(bookingId) => run(`noshow-${bookingId}`, async () => {
                await adminAction({ action: "driver", journeyId: boardingJourney.id, bookingId, boardAction: "NO_SHOW" });
              })}
              onDepart={() => run(`depart-${boardingJourney.id}`, async () => {
                await adminAction({ action: "driver", journeyId: boardingJourney.id, boardAction: "DEPARTED" });
              })}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
};

export default SpiresShareAdmin;
