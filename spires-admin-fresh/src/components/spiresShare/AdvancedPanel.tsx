import React, { FormEvent, useState } from "react";
import { EventTools } from "./EventTools";
import { DriverBoard } from "./DriverBoard";
import { gbp } from "./shareLabels";
import { RunAction, ShareState } from "./types";
import { AuditAndEmails } from "./AuditAndEmails";
import { ShareConfig } from "./ShareConfig";

type AdminFn = (data: Record<string, unknown>) => Promise<unknown>;

export function AdvancedPanel({
  state,
  run,
  busyKey,
  adminAction,
  saveConfig,
  runTick,
}: {
  state: ShareState;
  run: RunAction;
  busyKey: string;
  adminAction: AdminFn;
  saveConfig: (config: ShareState["config"]) => Promise<unknown>;
  runTick: () => Promise<unknown>;
}) {
  const [section, setSection] = useState("waitlists");
  const [driverId, setDriverId] = useState("");
  const [sandboxWarn, setSandboxWarn] = useState(false);
  const [createForm, setCreateForm] = useState({
    originLabel: "Oxford",
    departureLocation: "Thornhill Park and Ride",
    destinationLabel: "Heathrow Airport Terminal 3",
    travelDate: "",
    departureTime: "14:00",
    capacity: 5,
    farePence: 3500,
    minPassengerThreshold: 4,
    notes: "",
  });
  const [cityForm, setCityForm] = useState({
    originCity: "Oxford",
    destinationCity: "London",
    departureLocation: "Thornhill Park and Ride",
    travelDate: "",
    departureTime: "10:00",
    capacity: 5,
    farePounds: "",
    minPassengerThreshold: 4,
    notes: "",
  });
  const [hubForm, setHubForm] = useState({ name: "", city: "London", displayName: "", address: "", postcode: "", enabled: false });
  const [merge, setMerge] = useState({ source: "", target: "" });
  const selected = state.journeys.find((row) => row.id === driverId) || null;
  const selectedBookings = state.bookings.filter((row) => row.journeyId === driverId);

  return (
    <div className="share-ops-stack">
      <div className="share-ops-filters">
        {[
          ["waitlists", "Waitlists"],
          ["driver", "Driver boarding"],
          ["hubs", "Hubs"],
          ["city", "City matching"],
          ["create", "Create unpublished journey"],
          ["event", "Event opportunities"],
          ["config", "Configuration"],
          ["audit", "Audit and emails"],
          ["sandbox", "Developer sandbox"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={`btn btn-sm${section === id ? " btn-primary" : ""}`} onClick={() => setSection(id)}>{label}</button>
        ))}
        <button type="button" className="btn btn-sm" disabled={busyKey === "tick"} onClick={() => run("tick", async () => { await runTick(); })}>Run deadline tick</button>
      </div>

      {section === "waitlists" ? (
        state.waitlist.length === 0 ? <div className="share-ops-empty">No passengers are currently waiting.</div> : (
          <ul className="share-ops-card-list">
            {state.waitlist.map((item) => {
              const journey = state.journeys.find((row) => row.id === item.journeyId);
              return (
                <li key={item.id} className="share-ops-card">
                  <p>{journey ? `${journey.originLabel || "Oxford"} → ${journey.destinationLabel || ""}` : item.journeyId}</p>
                  <p className="share-ops-muted">{item.name} · {item.passengers} seats · {item.status.replace(/_/g, " ").toLowerCase()}</p>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {section === "driver" ? (
        <div>
          <label className="form-group">
            <span className="form-label">Journey</span>
            <select className="form-select" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">Select a confirmed journey</option>
              {state.journeys.filter((row) => row.status === "CONFIRMED").map((row) => (
                <option key={row.id} value={row.id}>{row.publicNumber} · {row.departureTime}</option>
              ))}
            </select>
          </label>
          {selected ? (
            <DriverBoard
              journey={selected}
              bookings={selectedBookings}
              busyKey={busyKey}
              onVerify={(bookingId, code, eventLeg) => run(`verify-${bookingId}`, async () => {
                await adminAction({ action: "driver", journeyId: selected.id, bookingId, boardAction: "VERIFY", boardingCode: code, eventLeg: eventLeg || "OUTBOUND" });
              })}
              onNoShow={(bookingId) => run(`noshow-${bookingId}`, async () => { await adminAction({ action: "driver", journeyId: selected.id, bookingId, boardAction: "NO_SHOW" }); })}
              onDepart={() => run(`depart-${selected.id}`, async () => { await adminAction({ action: "driver", journeyId: selected.id, boardAction: "DEPARTED" }); })}
            />
          ) : <p className="share-ops-muted">Choose a confirmed journey.</p>}
        </div>
      ) : null}

      {section === "hubs" ? (
        <form
          className="share-ops-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            run("hub-create", async () => {
              await adminAction({ action: "create-dropoff-hub", ...hubForm, displayName: hubForm.displayName || hubForm.name });
            });
          }}
        >
          <h4>Shared drop off hubs</h4>
          <p className="share-ops-muted">City matching stays unpublished. Enable a hub before it can be selected.</p>
          <label className="form-group"><span className="form-label">Name</span><input className="form-input" required value={hubForm.name} onChange={(e) => setHubForm({ ...hubForm, name: e.target.value })} /></label>
          <label className="form-group"><span className="form-label">City</span><input className="form-input" required value={hubForm.city} onChange={(e) => setHubForm({ ...hubForm, city: e.target.value })} /></label>
          <button type="submit" className="btn btn-primary" disabled={busyKey === "hub-create"}>Create hub</button>
          <ul className="share-ops-plain">
            {(state.hubs || []).map((hub) => (
              <li key={hub.id}>
                {hub.displayName || hub.name} · {hub.enabled ? "enabled" : "disabled"}
                <button type="button" className="btn btn-sm" onClick={() => run(`hub-${hub.id}`, async () => { await adminAction({ action: "update-dropoff-hub", hubId: hub.id, enabled: !hub.enabled, name: hub.name, displayName: hub.displayName }); })}>{hub.enabled ? "Disable" : "Enable"}</button>
              </li>
            ))}
          </ul>
        </form>
      ) : null}

      {section === "city" ? (
        <div className="share-ops-stack">
          <p className="share-ops-muted">City matching is unpublished. London does not inherit Heathrow pricing. Enter a fare for each city journey.</p>
          <form
            className="share-ops-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const farePence = Math.round(Number(cityForm.farePounds || 0) * 100);
              if (!farePence) return;
              run("city-create", async () => {
                await adminAction({
                  action: "create-city-journey",
                  originCity: cityForm.originCity,
                  destinationCity: cityForm.destinationCity,
                  departureLocation: cityForm.departureLocation,
                  travelDate: cityForm.travelDate,
                  departureTime: cityForm.departureTime,
                  capacity: cityForm.capacity,
                  farePence,
                  targetRevenuePence: farePence * cityForm.capacity,
                  minPassengerThreshold: cityForm.minPassengerThreshold,
                  notes: cityForm.notes,
                });
              });
            }}
          >
            <label className="form-group"><span className="form-label">Origin city</span><input className="form-input" value={cityForm.originCity} onChange={(e) => setCityForm({ ...cityForm, originCity: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Destination city</span><input className="form-input" value={cityForm.destinationCity} onChange={(e) => setCityForm({ ...cityForm, destinationCity: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Date</span><input className="form-input" type="date" required value={cityForm.travelDate} onChange={(e) => setCityForm({ ...cityForm, travelDate: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Fare per passenger in pounds</span><input className="form-input" required value={cityForm.farePounds} onChange={(e) => setCityForm({ ...cityForm, farePounds: e.target.value })} /></label>
            <button type="submit" className="btn btn-primary" disabled={busyKey === "city-create"}>Create city journey</button>
          </form>
          <form
            className="share-ops-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run("merge", async () => { await adminAction({ action: "merge-interest", interestGroupId: merge.source, targetInterestGroupId: merge.target }); });
            }}
          >
            <h4>Merge compatible groups</h4>
            <select className="form-select" value={merge.source} onChange={(e) => setMerge({ ...merge, source: e.target.value })}>
              <option value="">Source group</option>
              {(state.interestGroups || []).map((row) => <option key={row.id} value={row.id}>{row.origin} → {row.destinationRegion} · {row.travelDate}</option>)}
            </select>
            <select className="form-select" value={merge.target} onChange={(e) => setMerge({ ...merge, target: e.target.value })}>
              <option value="">Merge into</option>
              {(state.interestGroups || []).filter((row) => row.id !== merge.source).map((row) => <option key={row.id} value={row.id}>{row.origin} → {row.destinationRegion} · {row.travelDate}</option>)}
            </select>
            <button type="submit" className="btn btn-primary" disabled={busyKey === "merge"}>Merge groups</button>
          </form>
        </div>
      ) : null}

      {section === "create" ? (
        <form
          className="share-ops-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            run("create-pilot", async () => {
              await adminAction({
                action: "create-journey",
                airportId: "heathrow",
                ...createForm,
                destinationTerminal: "T3",
                vehicleLabel: "Mercedes Vito",
                targetRevenuePence: createForm.farePence * createForm.capacity,
                confirmationDeadlineHoursBeforeDeparture: 24,
                customerVisible: false,
              });
            });
          }}
        >
          <h4>Create unpublished journey</h4>
          <p className="share-ops-muted">Customers only see this after you publish it. For events use Event opportunities.</p>
          <label className="form-group"><span className="form-label">Date</span><input className="form-input" type="date" required value={createForm.travelDate} onChange={(e) => setCreateForm({ ...createForm, travelDate: e.target.value })} /></label>
          <label className="form-group"><span className="form-label">Departure time</span><input className="form-input" type="time" required value={createForm.departureTime} onChange={(e) => setCreateForm({ ...createForm, departureTime: e.target.value })} /></label>
          <p>Fare {gbp(createForm.farePence)} per passenger.</p>
          <button type="submit" className="btn btn-primary" disabled={busyKey === "create-pilot"}>Create journey</button>
        </form>
      ) : null}

      {section === "event" ? (
        <EventTools state={state} run={run} busyKey={busyKey} adminAction={adminAction} />
      ) : null}

      {section === "config" ? (
        <ShareConfig
          config={state.config}
          notificationsLive={Boolean(state.notificationsLive)}
          busy={busyKey === "config"}
          onSave={(config) => { run("config", async () => { await saveConfig(config); }); }}
        />
      ) : null}

      {section === "audit" ? <AuditAndEmails audit={state.audit} notifications={state.notifications} /> : null}

      {section === "sandbox" ? (
        <div className="share-ops-card is-now">
          <h4>Developer sandbox</h4>
          <p>This tool creates live Share records. It is not a customer booking page.</p>
          {!sandboxWarn ? (
            <button type="button" className="btn btn-danger" onClick={() => setSandboxWarn(true)}>I understand, show sandbox</button>
          ) : (
            <p className="share-ops-muted">Customer booking now lives in the customer app. Do not use admin impersonation for daily operations.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
