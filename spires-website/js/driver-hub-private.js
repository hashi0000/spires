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
  function detail(booking, leg) {
    if (!booking) return;
    selected = { booking, leg };
    const pane = document.getElementById("sheet-card");
    const airport = field(booking, leg, "airportCollection");
    const fixed = field(booking, leg, "collectionArrangement") === "fixed_time" || field(booking, leg, "collectionLocationKind") === "hotel";
    const timed = airport || booking.timedHire;
    const proposed = timed ? proposal(booking, leg) : null;
    const balance = Math.max(0, Number(booking.finalFarePence || 0) - Number(booking.amountReceivedPence || 0));
    const legDue = booking[leg === 'return' ? 'dueOnReturn' : 'dueOnOutbound'];
    const due = Number.isFinite(booking[leg + 'AmountToCollectPence']) ? booking[leg + 'AmountToCollectPence'] : (legDue != null && legDue !== '' ? Math.min(balance, Math.max(0, Math.round(Number(legDue) * 100))) : balance);
    pane.innerHTML = '<h2>' + esc(booking.hirerName) + '</h2><p>' + esc(booking.bookingNumber) + ' · ' + leg + '</p><p>' + esc(field(booking, leg, "pickupLocation")) + ' → ' + esc(field(booking, leg, "destination")) + '</p><p>' + esc(date(legTime(booking, leg))) + '</p>' +
      '<p>' + esc(field(booking, leg, "assistanceNote")) + '</p><p>Final total: <strong>' + money(booking.finalFarePence) + '</strong><br>Received: ' + money(booking.amountReceivedPence) + '<br>Amount to collect: <strong>' + money(due) + '</strong></p>' +
      (proposed ? '<p id="driver-timing-preview"' + (proposed.warning ? ' class="warning"' : '') + '>' + esc(proposed.preview) + '</p>' : '') + eventInput() +
      (airport && !fixed ? '<label>Landing verification source<input id="driver-landing-source" placeholder="For example Flightradar24 actual landing" maxlength="160"></label><button class="btn" data-action="landing">Has the flight landed? Confirm actual time</button>' : '') +
      '<div class="actions"><button class="btn" data-action="driver_ready">Driver ready</button><button class="btn" data-action="passenger_ready">Customer ready for collection</button><button class="btn" data-action="onboard">Passenger onboard</button></div>' +
      (status(booking, leg) !== "completed" ? '<button class="btn btn-primary" data-action="complete">Confirm finish time and complete trip</button>' : '') +
      (timed ? '<label>Excluded delay minutes<input id="driver-excluded" type="number" min="0" step="1" value="0"></label><button class="btn" data-action="finalise">Review and save additional time charge</button>' : '') +
      '<h3>Record payment received</h3><label>Amount received (£)<input id="driver-payment" type="number" min="0.01" step="0.01" value="' + (due / 100).toFixed(2) + '"></label><label>Method<select id="driver-method"><option value="cash">Cash</option><option value="card">Card / Shift4</option><option value="bank transfer">Bank transfer</option></select></label><button class="btn" data-action="payment">Record this payment</button><p>Only record money actually received. This does not charge a card.</p><p id="driver-error" role="alert"></p><div id="driver-whatsapp"></div><button class="btn" id="driver-close">Close</button>';
    document.getElementById("sheet").hidden = false;
    document.getElementById("driver-close").onclick = () => { document.getElementById("sheet").hidden = true; selected = null; };
    pane.querySelectorAll("[data-action]").forEach(button => button.onclick = () => act(button.dataset.action));
    if (airport && !fixed && field(booking, leg, "verifiedLandingAt") && proposed?.includedUntil) {
      const message = "Welcome to Heathrow. Your flight is recorded as landing at " + date(field(booking, leg, "verifiedLandingAt")) + ". Your included waiting ends at " + date(proposed.includedUntil) + ". Additional waiting costs £" + (booking.waitingPolicyVersion === "2026-11-15" ? "5 per started 15 minutes" : "10 per started 30 minutes") + ". Call or message when your whole group has collected its luggage and is ready at the agreed collection point. Your waiting timer stops when you notify us you are ready.";
      let phone = String(booking.hirerPhone || "").replace(/\D/g, "");
      if (phone.startsWith("0")) phone = "44" + phone.slice(1);
      const preview = '<p class="message-preview"><strong>WhatsApp message preview</strong><br>' + esc(message) + '</p><p>Opening WhatsApp does not send the message.</p>';
      document.getElementById("driver-whatsapp").innerHTML = preview + (phone
        ? '<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + phone + '?text=' + encodeURIComponent(message) + '">Open WhatsApp</a>'
        : '<p>Add a customer phone number before opening WhatsApp.</p>');
    }
  }
  async function act(action) {
    if (busy || !selected) return;
    const { booking, leg } = selected;
    const event = document.getElementById("driver-event-time").value;
    const payload = { bookingId: booking.id, leg, expectedRevision: Number(booking.revision || 0), requestId: crypto.randomUUID(), action,
      at: event ? new Date(event).toISOString() : null, source: document.getElementById("driver-landing-source")?.value,
      reason: document.getElementById("driver-reason").value, excludedMinutes: Number(document.getElementById("driver-excluded")?.value || 0),
      amountPence: Math.round(Number(document.getElementById("driver-payment").value) * 100), method: document.getElementById("driver-method").value };
    if (["complete", "finalise", "payment"].includes(action) && !confirm(action === "payment" ? "Confirm this money has actually been received?" : action === "finalise" ? "Save the calculated additional time charge? This is separate from payment." : "Confirm the actual finish time? This will not send a booking update email.")) return;
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
