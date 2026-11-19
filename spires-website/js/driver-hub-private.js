/* Individual driver sessions use callables only: no browser read of all bookings. */
(function (root) {
  let timer, api, sessionAuth, rows = [], version = null, view = "today", selected = null, busy = false, active = false;
  const hiddenState = new Map();
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = pence => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence || 0) / 100);
  const date = value => value ? new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "Not recorded";
  const field = (booking, leg, name) => booking[leg === "return" ? "return" + name[0].toUpperCase() + name.slice(1) : name];
  const legTime = (booking, leg) => field(booking, leg, "pickupTime") || field(booking, leg, "dateTime");
  const londonDay = value => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const eventNow = () => {
    const value = new Date();
    value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
    return value.toISOString().slice(0, 16);
  };
  const eventInput = () => '<label>Actual event time (your device local time)<input id="driver-event-time" type="datetime-local" value="' + eventNow() + '" required></label><p>For a call or message, enter when the customer contacted you, not when you record it.</p><label>Correction or excluded delay reason<input id="driver-reason" maxlength="300"></label>';

  function status(booking, leg) { return booking[leg + "Status"] || booking.status; }

  function paymentSummary(booking, leg) {
    return booking[leg + "PaymentSummary"] || {
      kind: booking[leg + "CollectUnknown"] ? "office" : "collect",
      title: booking[leg + "CollectUnknown"] ? "Check with the office" : ("Amount to collect on this leg: " + money(booking[leg + "AmountToCollectPence"])),
      detail: "",
      amountToCollectPence: booking[leg + "AmountToCollectPence"],
      paymentMethod: booking.paymentMethod || "",
    };
  }

  function paymentSummaryMarkup(booking, leg) {
    const summary = paymentSummary(booking, leg);
    return '<section class="detail-block payment-summary" aria-live="polite">' +
      "<h3>Payment on this leg</h3>" +
      "<p><strong>" + esc(summary.title) + "</strong></p>" +
      (summary.detail ? "<p>" + esc(summary.detail) + "</p>" : "") +
      "</section>";
  }

  function render() {
    const today = londonDay(Date.now());
    const tomorrow = londonDay(Date.now() + 86400000);
    const jobs = rows.flatMap(booking => (booking.assignedLegs || []).map(leg => ({ booking, leg })));
    const filtered = jobs.filter(({ booking, leg }) => {
      const state = status(booking, leg);
      if (view === "completed") return state === "completed";
      if (["completed", "cancelled"].includes(state)) return false;
      const at = legTime(booking, leg);
      if (!at) return view === "upcoming";
      const day = londonDay(at);
      return view === "today" ? day === today : view === "tomorrow" ? day === tomorrow : day >= today;
    }).sort((a, b) => new Date(legTime(a.booking, a.leg) || 0) - new Date(legTime(b.booking, b.leg) || 0));
    document.getElementById("job-list").innerHTML = filtered.map(({ booking, leg }) => '<button type="button" class="job-card" data-driver-booking="' + esc(booking.id) + '" data-driver-leg="' + leg + '"><strong>' + esc(booking.hirerName) + '</strong><p>' + esc(date(legTime(booking, leg))) + ' · ' + leg + '</p><p>' + esc(field(booking, leg, "pickupLocation")) + ' → ' + esc(field(booking, leg, "destination")) + '</p><p>' + esc(status(booking, leg)) + '</p></button>').join("");
    document.querySelectorAll("[data-driver-booking]").forEach(button => button.onclick = () => detail(rows.find(row => row.id === button.dataset.driverBooking), button.dataset.driverLeg));
    document.getElementById("app-empty").hidden = filtered.length > 0;
    document.getElementById("app-empty").textContent = "No assigned trips in this view.";
  }

  function refreshTimingPreview() {
    const el = document.getElementById("driver-timing-preview");
    if (!selected || !el) return;
    const result = proposal(selected.booking, selected.leg);
    el.textContent = result.preview; el.classList.toggle("warning", result.warning === true);
  }

  async function refresh() {
    if (busy) return;
    refreshTimingPreview();
    try {
      const result = (await api.httpsCallable("listDriverTrips")({ version })).data;
      if (result.unchanged) return;
      version = result.version;
      rows = result.bookings;
      render();
      const warning = document.getElementById("app-error");
      warning.hidden = !result.truncated;
      warning.textContent = result.truncated ? "Some older trips are not loaded. Contact the office if a trip is missing." : "";
    } catch (err) {
      const warning = document.getElementById("app-error");
      warning.hidden = false;
      warning.textContent = err.message || "Could not refresh trips.";
      if (/permission-denied|unauthenticated/.test(err.code || "")) { stop(); await sessionAuth.signOut(); }
    }
  }

  function proposal(booking, leg) {
    if (booking.timedHire) return root.SpiresCollection.proposeTimedHireCharge({ ...booking.timedHire,
      driverArrivedAt: booking[leg + "DriverReadyAt"], completedAt: booking[leg + "CompletedAt"], excludedMinutes: booking[leg + "ExcludedMinutes"], now: Date.now() });
    return root.SpiresCollection.proposeWaitingCharge({ waitingPolicyVersion: booking.waitingPolicyVersion,
      collectionArrangement: field(booking, leg, "collectionArrangement"), collectionLocationKind: field(booking, leg, "collectionLocationKind"),
      landingStatus: field(booking, leg, "landingStatus"), verifiedLandingAt: field(booking, leg, "verifiedLandingAt"),
      bookedCollectionAt: legTime(booking, leg), driverReadyAt: booking[leg + "DriverReadyAt"], passengerReadyAt: booking[leg + "PassengerReadyAt"] });
  }

  function closeoutForm(booking, leg) {
    const summary = paymentSummary(booking, leg);
    const suggested = summary.amountToCollectPence != null ? (summary.amountToCollectPence / 100).toFixed(2) : "";
    const method = String(summary.paymentMethod || "").toLowerCase();
    const methodOptions = ["cash", "card", "bank transfer"].map(value => {
      const label = value === "card" ? "Card / Shift4" : value === "bank transfer" ? "Bank transfer" : "Cash";
      const selected = method === value || (value === "card" && method.indexOf("card") !== -1) ? " selected" : "";
      return '<option value="' + value + '"' + selected + ">" + label + "</option>";
    }).join("");
    const defaultOutcome = summary.kind === "account" || summary.kind === "paid"
      ? "not_required"
      : summary.kind === "office"
        ? "still_due"
        : "collected";
    return '<section class="detail-block" id="driver-closeout">' +
      "<h3>Mark job completed</h3>" +
      "<fieldset><legend>Payment outcome</legend>" +
      '<label><input type="radio" name="driver-outcome" value="collected"' + (defaultOutcome === "collected" ? " checked" : "") + '> Collected</label>' +
      '<label><input type="radio" name="driver-outcome" value="partly_collected"> Partly collected</label>' +
      '<label><input type="radio" name="driver-outcome" value="still_due"' + (defaultOutcome === "still_due" ? " checked" : "") + "> Still due</label>" +
      '<label><input type="radio" name="driver-outcome" value="not_required"' + (defaultOutcome === "not_required" ? " checked" : "") + "> No collection required</label>" +
      "</fieldset>" +
      '<div id="driver-collect-fields">' +
      '<label>Amount collected (£)<input id="driver-payment" type="number" min="0.01" step="0.01" value="' + esc(suggested) + '"></label>' +
      "<label>Method<select id=\"driver-method\">" + methodOptions + "</select></label>" +
      "</div>" +
      '<button class="btn btn-primary" data-action="complete_closeout">Mark job completed</button>' +
      "<p>Journey completion and payment stay separate. You can complete with a balance still due. Ask the office to correct an accidental save.</p>" +
      "</section>";
  }

  function syncCollectFields() {
    const outcome = document.querySelector('input[name="driver-outcome"]:checked');
    const fields = document.getElementById("driver-collect-fields");
    if (!fields || !outcome) return;
    fields.hidden = !["collected", "partly_collected"].includes(outcome.value);
  }

  function detail(booking, leg) {
    if (!booking) return;
    selected = { booking, leg };
    const pane = document.getElementById("sheet-card");
    const airport = field(booking, leg, "airportCollection");
    const fixed = field(booking, leg, "collectionArrangement") === "fixed_time" || field(booking, leg, "collectionLocationKind") === "hotel";
    const timed = airport || booking.timedHire;
    const proposed = timed ? proposal(booking, leg) : null;
    const summary = paymentSummary(booking, leg);
    const due = summary.amountToCollectPence != null
      ? summary.amountToCollectPence
      : Math.max(0, Number(booking.outstandingPence != null ? booking.outstandingPence : (Number(booking.finalFarePence || 0) - Number(booking.receivedPence || booking.amountReceivedPence || 0))));
    const legStatus = status(booking, leg);
    const outcome = booking[leg + "PaymentOutcome"];
    pane.innerHTML = "<h2>" + esc(booking.hirerName) + "</h2><p>" + esc(booking.bookingNumber) + " · " + leg + "</p><p>" + esc(field(booking, leg, "pickupLocation")) + " → " + esc(field(booking, leg, "destination")) + "</p><p>" + esc(date(legTime(booking, leg))) + "</p>" +
      "<p>" + esc(field(booking, leg, "assistanceNote")) + "</p><p>Final total: <strong>" + money(booking.finalFarePence) + "</strong><br>Booking balance due: <strong>" + money(booking.outstandingPence) + "</strong></p>" +
      paymentSummaryMarkup(booking, leg) +
      (outcome ? "<p>Payment outcome recorded: <strong>" + esc(String(outcome).replace(/_/g, " ")) + "</strong></p>" : "") +
      (proposed ? '<p id="driver-timing-preview"' + (proposed.warning ? ' class="warning"' : "") + ">" + esc(proposed.preview) + "</p>" : "") +
      (legStatus === "completed" ? "" : eventInput()) +
      (airport && !fixed && legStatus !== "completed" ? '<label>Landing verification source<input id="driver-landing-source" placeholder="For example Flightradar24 actual landing" maxlength="160"></label><button class="btn" data-action="landing">Has the flight landed? Confirm actual time</button>' : "") +
      '<div class="actions">' +
      (["confirmed", "allocated"].includes(legStatus) || (legStatus !== "completed" && legStatus !== "in_progress" && !booking[leg + "JobStartedAt"]) ? '<button class="btn btn-primary" data-action="job_started">Job Started</button>' : "") +
      (legStatus !== "completed" ? '<button class="btn" data-action="driver_ready">Driver ready</button><button class="btn" data-action="passenger_ready">Customer ready for collection</button><button class="btn" data-action="onboard">Passenger onboard</button>' : "") +
      "</div>" +
      (timed && legStatus !== "completed" ? '<label>Excluded delay minutes<input id="driver-excluded" type="number" min="0" step="1" value="0"></label><button class="btn" data-action="finalise">Review and save additional time charge</button>' : "") +
      (legStatus !== "completed" ? closeoutForm(booking, leg) : "") +
      (legStatus === "completed" && due > 0 && summary.kind === "collect"
        ? '<h3>Record payment received</h3><label>Amount received (£)<input id="driver-payment" type="number" min="0.01" step="0.01" value="' + (due / 100).toFixed(2) + '"></label><label>Method<select id="driver-method"><option value="cash">Cash</option><option value="card">Card / Shift4</option><option value="bank transfer">Bank transfer</option></select></label><button class="btn" data-action="payment">Record this payment</button><p>Only record money actually received. This does not charge a card.</p>'
        : "") +
      '<p id="driver-error" role="alert"></p><div id="driver-whatsapp"></div><button class="btn" id="driver-close">Close</button>';
    document.getElementById("sheet").hidden = false;
    document.getElementById("driver-close").onclick = () => { document.getElementById("sheet").hidden = true; selected = null; };
    pane.querySelectorAll("[data-action]").forEach(button => button.onclick = () => act(button.dataset.action));
    pane.querySelectorAll('input[name="driver-outcome"]').forEach(input => input.onchange = syncCollectFields);
    syncCollectFields();
    const wa = document.getElementById("driver-whatsapp");
    let phone = String(booking.hirerPhone || "").replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "44" + phone.slice(1);
    const messages = [];
    if (booking[leg + "JobStartedAt"] || legStatus === "in_progress") {
      messages.push("Spires Taxis update: your driver has started the journey for booking " + (booking.bookingNumber || "") + " (" + leg + "). Pickup: " + (field(booking, leg, "pickupLocation") || "") + ".");
    }
    if (airport && !fixed && field(booking, leg, "verifiedLandingAt") && proposed?.includedUntil) {
      const waitingPolicy = root.SpiresCollection && root.SpiresCollection.policyFor
        ? root.SpiresCollection.policyFor({
            waitingPolicyVersion: booking.waitingPolicyVersion,
            collectionArrangement: leg === "return" ? booking.returnCollectionArrangement : booking.collectionArrangement,
            collectionLocationKind: leg === "return" ? booking.returnCollectionLocationKind : booking.collectionLocationKind,
          })
        : { chargePounds: 5, blockMinutes: 15 };
      messages.push("Welcome to Heathrow. Your flight is recorded as landing at " + date(field(booking, leg, "verifiedLandingAt")) + ". Your included waiting ends at " + date(proposed.includedUntil) + ". Additional waiting costs £" + waitingPolicy.chargePounds + " per started " + waitingPolicy.blockMinutes + " minutes. Call or message when your whole group has collected its luggage and is ready at the agreed collection point. Your waiting timer stops when you notify us you are ready.");
    }
    if (messages.length) {
      wa.innerHTML = messages.map(function (message, index) {
        const label = index === 0 && (booking[leg + "JobStartedAt"] || legStatus === "in_progress") ? "Job Started WhatsApp preview" : "WhatsApp message preview";
        return '<p class="message-preview"><strong>' + label + "</strong><br>" + esc(message) + "</p><p>Opening WhatsApp does not send the message.</p>" +
          (phone
            ? '<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + phone + "?text=" + encodeURIComponent(message) + '">Open WhatsApp</a>'
            : "<p>Add a customer phone number before opening WhatsApp.</p>");
      }).join("");
    }
  }

  async function act(action) {
    if (busy || !selected) return;
    const { booking, leg } = selected;
    const event = document.getElementById("driver-event-time")?.value;
    const outcomeEl = document.querySelector('input[name="driver-outcome"]:checked');
    const paymentOutcome = outcomeEl ? outcomeEl.value : "";
    const payload = {
      bookingId: booking.id,
      leg,
      expectedRevision: Number(booking.revision || 0),
      requestId: crypto.randomUUID(),
      action,
      at: event ? new Date(event).toISOString() : new Date().toISOString(),
      source: document.getElementById("driver-landing-source")?.value,
      reason: document.getElementById("driver-reason")?.value || "",
      excludedMinutes: Number(document.getElementById("driver-excluded")?.value || 0),
      amountPence: Math.round(Number(document.getElementById("driver-payment")?.value || 0) * 100),
      method: document.getElementById("driver-method")?.value || "",
      paymentOutcome,
    };
    if (action === "complete_closeout") {
      if (!paymentOutcome) {
        document.getElementById("driver-error").textContent = "Confirm the payment outcome before completing this job.";
        return;
      }
      if (["collected", "partly_collected"].includes(paymentOutcome) && !(payload.amountPence > 0)) {
        document.getElementById("driver-error").textContent = "Enter the amount collected.";
        return;
      }
      const confirmText = paymentOutcome === "collected" || paymentOutcome === "partly_collected"
        ? "Mark this job completed and record " + money(payload.amountPence) + " as collected?"
        : "Mark this job completed with payment outcome: " + paymentOutcome.replace(/_/g, " ") + "?";
      if (!confirm(confirmText)) return;
    } else if (["job_started", "complete", "finalise", "payment"].includes(action) && !confirm(action === "payment" ? "Confirm this money has actually been received?" : action === "finalise" ? "Save the calculated additional time charge? This is separate from payment." : action === "job_started" ? "Mark this job as started? You can open the Job Started WhatsApp preview next. Nothing is sent automatically." : "Confirm the actual finish time? This will not send a booking update email.")) {
      return;
    }
    busy = true;
    document.querySelectorAll("#sheet-card button").forEach(button => button.disabled = true);
    try {
      const result = (await api.httpsCallable("driverTripAction")(payload)).data;
      rows = rows.map(row => row.id === booking.id ? result.booking : row);
      detail(result.booking, leg);
      render();
    } catch (err) {
      document.getElementById("driver-error").textContent = err.message || "Could not save. Your entries remain here.";
      document.querySelectorAll("#sheet-card button").forEach(button => button.disabled = false);
    } finally { busy = false; }
  }

  function stop() { clearInterval(timer); active = false; rows = []; version = null; selected = null; for (const [id, value] of hiddenState) { const el = document.getElementById(id); if (el) el.hidden = value; } hiddenState.clear(); const sheet = document.getElementById("sheet"); if (sheet) sheet.hidden = true; document.getElementById("sheet-card")?.replaceChildren(); document.getElementById("job-list")?.replaceChildren(); }
  function start(auth, functions) {
    stop(); sessionAuth = auth; api = functions; active = true;
    ["add-job", "driver-filter", "next-job", "push-allow", "push-note", "app-loading"].forEach(id => { const el = document.getElementById(id); if (el) { hiddenState.set(id, el.hidden); el.hidden = true; } });
    document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", event => {
      if (!active || !sessionAuth.currentUser) return;
      event.stopImmediatePropagation(); view = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach(item => { item.classList.toggle("is-active", item === button); item.setAttribute("aria-current", item === button ? "page" : "false"); });
      render();
    }, true));
    refresh(); timer = setInterval(refresh, 30000);
  }
  root.SpiresPrivateDriver = { start, stop };
})(window);
