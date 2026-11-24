(function (root) {
  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function textOf(booking, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const value = text(booking[keys[i]]);
      if (value) return value;
    }
    return "";
  }

  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isCancelled(booking) {
    return booking.status === "cancelled" || booking.customerStatus === "cancelled";
  }

  function isCompleted(booking) {
    return [booking.status, booking.adminStatus, booking.customerStatus].some(function (value) {
      return value === "completed";
    });
  }

  function legStatus(booking, leg) {
    if (leg === "return" && booking.returnStatus) return String(booking.returnStatus);
    if (leg === "outbound" && booking.outboundStatus) return String(booking.outboundStatus);
    return String(booking.status || "");
  }

  function legCompleted(booking, leg) {
    return legStatus(booking, leg) === "completed";
  }

  function readableStatus(status) {
    const labels = {
      completed: "Completed",
      confirmed: "Confirmed",
      allocated: "Allocated",
      pending: "Pending",
      cancelled: "Cancelled",
      awaiting_customer_confirmation: "Awaiting confirmation",
      needs_review: "Needs review",
      awaiting_availability: "Awaiting availability",
    };
    const value = String(status || "");
    return labels[value] || (value ? value.charAt(0).toUpperCase() + value.slice(1) : "Confirmed");
  }

  function explicitLegStatus(booking, leg) {
    const raw = leg === "return" ? booking.returnStatus : booking.outboundStatus;
    if (raw) return String(raw);
    if (isCancelled(booking)) return "cancelled";
    return String(booking.status || "confirmed");
  }

  function canMarkCompleted(booking, leg) {
    if (!booking || isCancelled(booking)) return false;
    if (booking.vehicleType === "executive" && booking.executiveAvailability !== "accepted") return false;
    const status = explicitLegStatus(booking, leg);
    if (status !== "confirmed" && status !== "allocated") return false;
    return Boolean(driverIdFor(booking, leg));
  }

  function overallFromLegs(booking, outbound, returnStatus) {
    if (!hasReturn(booking)) return outbound === "completed" ? "completed" : outbound;
    const outboundDone = outbound === "completed" || outbound === "cancelled";
    const returnDone = returnStatus === "completed" || returnStatus === "cancelled";
    if (outboundDone && returnDone) {
      return outbound === "cancelled" && returnStatus === "cancelled" ? "cancelled" : "completed";
    }
    const openLeg = outboundDone ? "return" : "outbound";
    const openStatus = outboundDone ? returnStatus : outbound;
    if (openStatus === "allocated" || driverIdFor(booking, openLeg)) return "allocated";
    return "confirmed";
  }

  function completionUpdate(booking, leg, actorUid) {
    if (!canMarkCompleted(booking, leg)) {
      return { ok: false, error: "This trip cannot be marked completed." };
    }
    const outbound = leg === "outbound" ? "completed" : explicitLegStatus(booking, "outbound");
    const returnStatus = hasReturn(booking)
      ? (leg === "return" ? "completed" : explicitLegStatus(booking, "return"))
      : "";
    const status = overallFromLegs(booking, outbound, returnStatus);
    const update = {
      status: status,
      adminStatus: status,
      outboundStatus: outbound,
      revision: Number(booking.revision || 0) + 1,
      updatedByUid: actorUid || "",
    };
    if (hasReturn(booking)) update.returnStatus = returnStatus;
    if (booking.customerStatus) update.customerStatus = status;
    if (leg === "outbound") update.outboundCompletedByUid = actorUid || "";
    else update.returnCompletedByUid = actorUid || "";
    return {
      ok: true,
      update: update,
      completedAtField: leg === "outbound" ? "outboundCompletedAt" : "returnCompletedAt",
      previousLabel: readableStatus(explicitLegStatus(booking, leg)),
      unchanged: [
        "actualFare", "paymentStatus", "amountReceivedPence", "outstandingPence",
        "pickupLocation", "destination", "returnPickupLocation", "returnDestination",
        "driverId", "vehicleId", "returnDriverId", "returnVehicleId", "stops", "returnStops",
      ],
    };
  }

  function reopenUpdate(booking, leg, actorUid) {
    const current = explicitLegStatus(booking, leg);
    if (current !== "completed" || isCancelled(booking)) {
      return { ok: false, error: "This trip is not completed." };
    }
    const nextLeg = driverIdFor(booking, leg) ? "allocated" : "confirmed";
    const outbound = leg === "outbound" ? nextLeg : explicitLegStatus(booking, "outbound");
    const returnStatus = hasReturn(booking)
      ? (leg === "return" ? nextLeg : explicitLegStatus(booking, "return"))
      : "";
    const status = overallFromLegs(booking, outbound, returnStatus);
    const update = {
      status: status,
      adminStatus: status,
      outboundStatus: outbound,
      revision: Number(booking.revision || 0) + 1,
      updatedByUid: actorUid || "",
    };
    if (hasReturn(booking)) update.returnStatus = returnStatus;
    if (booking.customerStatus) update.customerStatus = status;
    if (leg === "outbound") update.outboundCompletionUndoneByUid = actorUid || "";
    else update.returnCompletionUndoneByUid = actorUid || "";
    return {
      ok: true,
      update: update,
      previousStatus: current,
      nextStatus: status,
      previousLabel: readableStatus(current),
    };
  }

  function applyStatusUpdate(booking, update) {
    return Object.assign({}, booking, update);
  }

  function hasReturn(booking) {
    if (booking.bookingType === "return" || booking.returnTrip === true) return true;
    if (booking.openReturn === true) return true;
    if (textOf(booking, ["returnPickupLocation"]) && textOf(booking, ["returnDestination"])) return true;
    return Boolean(booking.returnPickupTime || booking.returnDateTime);
  }

  function driverIdFor(booking, leg) {
    return leg === "return" ? text(booking.returnDriverId) : text(booking.driverId);
  }

  function vehicleIdFor(booking, leg) {
    return leg === "return" ? text(booking.returnVehicleId) : text(booking.vehicleId);
  }

  function lookup(rows, id, field) {
    if (!id) return "";
    const row = (rows || []).find(function (item) { return item.id === id; });
    return row ? text(row[field]) : "";
  }

  function category(type) {
    if (type === "executive") return "Executive Car";
    if (type === "8_seater" || type === "8-seater") return "8 seater";
    if (type === "multiple") return "Multiple vehicles";
    if (!type) return "Vehicle category not recorded";
    return "Standard car";
  }

  function knownCount(value) {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  function party(booking) {
    const people = knownCount(booking.passengers);
    const bags = knownCount(booking.luggage != null && booking.luggage !== "" ? booking.luggage : booking.luggagePieces);
    return {
      passengers: people == null ? "Passengers unknown" : people === 1 ? "1 passenger" : people + " passengers",
      luggage: bags == null ? "Luggage unknown" : bags === 1 ? "1 bag" : bags + " bags",
    };
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function pickupOf(booking, leg) {
    if (leg === "return") return toDate(booking.returnPickupTime || booking.returnDateTime);
    return toDate(booking.pickupTime || booking.dateTime);
  }

  function expandJobs(booking) {
    const from = textOf(booking, ["pickupLocation", "pickup"]);
    const to = textOf(booking, ["destination"]);
    const jobs = [{
      booking: booking,
      leg: "outbound",
      pickup: pickupOf(booking, "outbound"),
      pickupLocation: from,
      destination: to,
      pickupRecorded: Boolean(from),
      destinationRecorded: Boolean(to),
    }];
    if (!hasReturn(booking)) return jobs;
    const returnFrom = textOf(booking, ["returnPickupLocation"]);
    const returnTo = textOf(booking, ["returnDestination"]);
    jobs.push({
      booking: booking,
      leg: "return",
      pickup: pickupOf(booking, "return"),
      pickupLocation: returnFrom || to,
      destination: returnTo || from,
      pickupRecorded: Boolean(returnFrom),
      destinationRecorded: Boolean(returnTo),
    });
    return jobs;
  }

  function inView(job, view, now) {
    const done = legCompleted(job.booking, job.leg);
    if (view === "completed") return done;
    if (done) return false;
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    if (!job.pickup) return view === "upcoming";
    if (job.pickup < today) return false;
    if (view === "today") return job.pickup >= today && job.pickup < tomorrow;
    if (view === "tomorrow") return job.pickup >= tomorrow && job.pickup < addDays(tomorrow, 1);
    return job.pickup >= today;
  }

  function matchesDriver(job, driverFilter) {
    const id = driverIdFor(job.booking, job.leg);
    if (!driverFilter || driverFilter === "all") return true;
    if (driverFilter === "unassigned") return !id;
    return id === driverFilter;
  }

  function timePhrase(pickup, now) {
    if (!pickup) return "Pickup time not recorded";
    const mins = Math.round((pickup.getTime() - now.getTime()) / 60000);
    if (mins < -360) return "Pickup time has passed";
    if (mins < -1) return "Overdue";
    if (mins <= 0) return "Due now";
    if (mins < 60) return "In " + mins + " minutes";
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    if (!rest) return hours === 1 ? "In 1 hour" : "In " + hours + " hours";
    return "In " + hours + (hours === 1 ? " hour " : " hours ") + rest + " minutes";
  }

  function clockLabel(date) {
    if (!date) return "Time not recorded";
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function dateLabel(date) {
    if (!date) return "Date not recorded";
    return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }

  function dayHeading(date, now) {
    if (!date) return "Time not recorded";
    const day = startOfDay(date).getTime();
    const today = startOfDay(now).getTime();
    const label = dateLabel(date);
    if (day < today) return "Still to finish · " + label;
    if (day === today) return "Today · " + label;
    if (day === today + 86400000) return "Tomorrow · " + label;
    return label;
  }

  function pounds(n) {
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function moneyLabel(pence) {
    return pounds(Number(pence || 0) / 100);
  }

  function agreedFarePence(booking) {
    const extras = Array.isArray(booking.additionalCharges)
      ? booking.additionalCharges.reduce(function (sum, row) {
        return sum + Math.max(0, Math.round(Number(row && row.amountPence) || 0));
      }, 0)
      : 0;
    const quote = booking.issuedQuote && typeof booking.issuedQuote === "object" ? booking.issuedQuote : null;
    const base = quote && Number.isFinite(Number(quote.finalFarePence))
      ? Math.max(0, Math.round(Number(quote.finalFarePence)))
      : (Number.isFinite(Number(booking.actualFare)) ? Math.max(0, Math.round(Number(booking.actualFare) * 100)) : 0);
    return base + extras;
  }

  function effectiveReceivedPence(booking) {
    const recorded = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
    if (String(booking.depositStatus || "") !== "paid") return recorded;
    const depositPence = booking.depositRequired === true
      ? Math.max(0, Math.round((Number(booking.depositAmount) || 0) * 100))
      : 0;
    if (!(depositPence > 0)) return recorded;
    const entries = Array.isArray(booking.paymentEntries) ? booking.paymentEntries : [];
    const depositRecorded = entries.some(function (entry) {
      return entry && (entry.kind === "deposit" || String(entry.clientRequestId || "").indexOf("deposit-") === 0);
    }) || recorded >= depositPence;
    return depositRecorded ? recorded : recorded + depositPence;
  }

  /** Same meanings as functions driverPaymentSummary for Driver Hub / Family Jobs. */
  function paymentSummary(booking, leg) {
    booking = Object.assign({}, booking, booking.acceptedServiceTerms || {});
    const method = String(booking.paymentMethod || "").trim();
    const methodKey = method.toLowerCase();
    const outstandingPence = Math.max(0, agreedFarePence(booking) - effectiveReceivedPence(booking));
    const paid = outstandingPence <= 0 || String(booking.paymentStatus || "").toLowerCase() === "paid";

    if (methodKey === "account" || methodKey === "on account" || methodKey === "invoice") {
      return {
        kind: "account",
        amountToCollectPence: 0,
        outstandingPence: outstandingPence,
        paymentMethod: method || "account",
        title: "On account — no payment to collect",
        detail: "This is an invoiced job. Complete the journey without collecting payment.",
        text: "On account — no payment to collect",
      };
    }
    if (paid) {
      return {
        kind: "paid",
        amountToCollectPence: 0,
        outstandingPence: 0,
        paymentMethod: method,
        title: "Already paid",
        detail: "Nothing remains due on this booking.",
        text: "Already paid. Nothing remains due on this booking.",
      };
    }

    const raw = leg === "return" ? booking.dueOnReturn : booking.dueOnOutbound;
    const schedule = (raw === undefined || raw === null || String(raw).trim() === "")
      ? null
      : (Number.isFinite(Number(raw)) ? Number(raw) : null);
    const legExtras = (Array.isArray(booking.additionalCharges) ? booking.additionalCharges : [])
      .filter(function (row) { return row && (row.leg === leg || row.id === "trip-time-" + leg); })
      .reduce(function (sum, row) { return sum + Math.max(0, Math.round(Number(row.amountPence) || 0)); }, 0);
    const legReceived = (Array.isArray(booking.paymentEntries) ? booking.paymentEntries : [])
      .filter(function (row) { return row && row.leg === leg && row.mode === "add"; })
      .reduce(function (sum, row) { return sum + Math.max(0, Math.round(Number(row.amountPence) || 0)); }, 0);

    if (schedule != null) {
      const amount = Math.min(outstandingPence, Math.max(0, Math.round(schedule * 100) + legExtras - legReceived));
      return {
        kind: amount > 0 ? "collect" : "paid",
        amountToCollectPence: amount,
        outstandingPence: outstandingPence,
        paymentMethod: method,
        title: amount > 0 ? ("Amount to collect on this leg: " + moneyLabel(amount)) : "Already paid",
        detail: [
          method ? ("Agreed payment method: " + method) : "Payment method not recorded.",
          outstandingPence > amount ? ("Booking balance due overall: " + moneyLabel(outstandingPence) + ".") : "",
        ].filter(Boolean).join(" "),
        text: amount > 0
          ? ("Collect " + pounds(amount / 100) + " on this leg.")
          : "Already paid. Nothing remains due on this booking.",
      };
    }

    if (!hasReturn(booking)) {
      return {
        kind: "collect",
        amountToCollectPence: outstandingPence,
        outstandingPence: outstandingPence,
        paymentMethod: method,
        title: "Amount to collect on this leg: " + moneyLabel(outstandingPence),
        detail: method ? ("Agreed payment method: " + method) : "Payment method not recorded.",
        text: "Collect " + pounds(outstandingPence / 100) + " on this leg.",
      };
    }

    return {
      kind: "office",
      amountToCollectPence: null,
      outstandingPence: outstandingPence,
      paymentMethod: method,
      title: "Check with the office",
      detail: "This return booking has no agreed amount for this leg. Booking balance due overall: " +
        moneyLabel(outstandingPence) + ". You can still complete the journey.",
      text: "Check with the office",
    };
  }

  function collectInstruction(booking, leg) {
    return paymentSummary(booking, leg);
  }

  function collecting(booking, leg) {
    return leg === "return" ? booking.returnAirportCollection === true : booking.airportCollection === true;
  }

  function flightForLeg(booking, leg) {
    if (!collecting(booking, leg)) return null;
    const flight = leg === "return" ? text(booking.returnFlightNumber) : text(booking.flightNumber);
    const terminal = leg === "return" ? text(booking.returnTerminal) : text(booking.terminal);
    const landing = text(leg === "return"
      ? (booking.returnLandingTime || booking.returnScheduledLanding || "")
      : (booking.landingTime || booking.scheduledLanding || ""));
    return {
      flight: flight || "Flight not recorded",
      terminal: terminal || "Terminal not recorded",
      landing: landing,
    };
  }

  function notePieces(booking) {
    const special = text(booking.specialRequirements);
    const notes = text(booking.notes);
    const pieces = [];
    if (special) pieces.push({ label: "Original requirements", text: special });
    if (notes && notes.toLowerCase() !== special.toLowerCase()) pieces.push({ label: "Original notes", text: notes });
    else if (notes && !special) pieces.push({ label: "Original notes", text: notes });
    else if (special && notes && notes.toLowerCase() === special.toLowerCase()) {
      return [{ label: "Original notes", text: notes }];
    }
    return pieces;
  }

  function terminalDigits(value) {
    const match = String(value || "").match(/\b([1-5])\b/);
    return match ? match[1] : "";
  }

  function mentionedTerminals(notes) {
    const found = [];
    const pattern = /terminal\s*([1-5])|\bT([1-5])\b/gi;
    let match = pattern.exec(notes);
    while (match) {
      const digit = match[1] || match[2];
      if (digit && found.indexOf(digit) === -1) found.push(digit);
      match = pattern.exec(notes);
    }
    return found;
  }

  function terminalConflict(booking, leg) {
    if (!collecting(booking, leg)) return "";
    const stored = terminalDigits(leg === "return" ? booking.returnTerminal : booking.terminal);
    if (!stored) return "";
    const other = mentionedTerminals(notePieces(booking).map(function (row) { return row.text; }).join(" ")).filter(function (digit) {
      return digit !== stored;
    });
    if (!other.length) return "";
    return "The notes mention terminal " + other.join(" and ") + " and the stored terminal is " + stored + ". Review this before you travel.";
  }

  function routeConflict(job) {
    const stops = job.leg === "return" ? job.booking.returnStops : job.booking.stops;
    const pickup = text(job.pickupLocation).toLowerCase();
    const destination = text(job.destination).toLowerCase();
    if (Array.isArray(stops) && stops.length) {
      const first = text(stops[0] && stops[0].address).toLowerCase();
      if (first && pickup && first !== pickup) return "The first stop does not match the pickup. Review the route.";
    } else if (pickup && destination && pickup === destination) {
      return "Pickup and destination are the same. Review the route.";
    }
    return "";
  }

  function vagueCollection(booking, leg) {
    if (!collecting(booking, leg)) return false;
    const terminal = leg === "return" ? text(booking.returnTerminal) : text(booking.terminal);
    if (terminal) return false;
    const notes = notePieces(booking).map(function (row) { return row.text; }).join(" ");
    if (!notes) return true;
    return /^(ok|okay|thanks|thank you|as discussed|collect|please collect|airport|collect from the airport)\.?$/i.test(notes);
  }

  function pickupUnresolved(address) {
    const value = text(address);
    if (value.length < 4) return true;
    return /^(tbc|tba|unknown|as discussed|pickup|address)$/i.test(value);
  }

  function landingMention(notes) {
    const match = String(notes).match(/\b(?:lands?|landing|scheduled to land)\s+(?:at\s+)?\d{1,2}[:.]\d{2}\b/i);
    return match ? match[0].replace(/\s+/g, " ").trim() : "";
  }

  function summary(booking) {
    const body = notePieces(booking).map(function (row) { return row.text; }).join(" ");
    if (!body) return "";
    const bits = [];
    if (/child seat/i.test(body)) bits.push("Child seat requested");
    if (/meet at arrivals/i.test(body)) bits.push("Meet at arrivals");
    if (/big cases|large cases|suitcases/i.test(body)) bits.push("Large cases mentioned");
    return bits.join(". ");
  }

  function allocation(booking, leg, driverName) {
    if (booking.vehicleType === "executive" && booking.executiveAvailability !== "accepted" && booking.status !== "cancelled" && booking.status !== "completed") {
      return { code: "awaiting", label: "Awaiting availability. No car is allocated." };
    }
    if (!driverIdFor(booking, leg)) return { code: "unassigned", label: "Unassigned" };
    const status = legStatus(booking, leg);
    const name = driverName || "the named driver";
    if (status === "completed") return { code: "completed", label: "Completed" };
    if (status === "allocated") return { code: "allocated", label: "Allocated to " + name };
    if (status === "pending" || status === "awaiting_customer_confirmation") {
      return { code: "named", label: driverName + " is named. The job is not accepted." };
    }
    return { code: "named", label: "Office confirmed. Not marked allocated." };
  }

  function stopsFor(job) {
    const stored = job.leg === "return" ? job.booking.returnStops : job.booking.stops;
    if (Array.isArray(stored) && stored.length) {
      return stored.map(function (stop, index) {
        return {
          role: stop && stop.type === "dropoff" ? "Drop off" : index === 0 ? "Pickup" : "Stop",
          address: text(stop && stop.address) || "Address not recorded",
          note: text(stop && stop.notes),
        };
      });
    }
    return [
      { role: "Pickup", address: job.pickupRecorded ? job.pickupLocation : "Pickup not recorded", note: "" },
      { role: "Drop off", address: job.destinationRecorded ? job.destination : "Destination not recorded", note: "" },
    ];
  }

  function mapLinkForJob(job) {
    const booking = job.booking || {};
    const place = job.leg === "return" ? booking.returnPickupPlace : booking.pickupPlace;
    const stops = job.leg === "return" ? booking.returnStops : booking.stops;
    const firstPlace = Array.isArray(stops) && stops[0] && stops[0].place ? stops[0].place : null;
    const candidates = [place, firstPlace];
    for (let i = 0; i < candidates.length; i += 1) {
      const row = candidates[i];
      if (!row || typeof row !== "object") continue;
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return "https://www.google.com/maps?q=" + encodeURIComponent(lat + "," + lng);
      }
    }
    const address = job.pickupRecorded ? job.pickupLocation : "";
    if (address) return "https://www.google.com/maps?q=" + encodeURIComponent(address);
    return "";
  }

  function presentJob(job, lists, now) {
    const booking = job.booking;
    const driverId = driverIdFor(booking, job.leg);
    const vehicleId = vehicleIdFor(booking, job.leg);
    const named = lookup(lists.drivers, driverId, "name");
    const driverName = driverId ? (named || "Driver not listed") : "Unassigned";
    const registration = lookup(lists.vehicles, vehicleId, "registration");
    const counts = party(booking);
    const flight = flightForLeg(booking, job.leg);
    const notes = notePieces(booking);
    const conflict = terminalConflict(booking, job.leg) || routeConflict(job);
    const vague = vagueCollection(booking, job.leg);
    const unresolved = pickupUnresolved(job.pickupLocation) || !job.pickupRecorded;
    const done = legCompleted(booking, job.leg);
    const lateMinutes = job.pickup ? Math.round((now.getTime() - job.pickup.getTime()) / 60000) : 0;
    const overdue = !done && lateMinutes > 1 && lateMinutes <= 360 && job.pickup >= startOfDay(now);
    const badges = [];
    if (!driverId) badges.push({ code: "info", text: "Unassigned" });
    if (!registration) badges.push({ code: "attention", text: "No vehicle recorded" });
    if (unresolved) badges.push({ code: "attention", text: "Pickup details missing" });
    let warning = "";
    if (overdue) warning = "Overdue. This job is not completed.";
    else if (allocation(booking, job.leg, named).code === "awaiting") warning = "Awaiting availability confirmation. No car is allocated.";
    else if (conflict) warning = conflict;
    else if (vague) warning = "Collection point is not specific. Confirm it with the office.";
    else if (unresolved) warning = "Pickup details are not specific.";
    const landingNote = flight
      ? (flight.landing
        ? "Scheduled landing " + flight.landing + ". Driver pickup is " + clockLabel(job.pickup) + "."
        : (landingMention(notes.map(function (row) { return row.text; }).join(" "))
          ? "Notes mention landing (" + landingMention(notes.map(function (row) { return row.text; }).join(" ")) + "). Driver pickup is " + clockLabel(job.pickup) + "."
          : "Scheduled landing is not recorded."))
      : "";
    const extra = (function () {
      const stops = job.leg === "return" ? booking.returnStops : booking.stops;
      if (!Array.isArray(stops) || stops.length < 3) return "";
      const extraCount = stops.length - 2;
      return extraCount === 1 ? "1 extra stop" : extraCount + " extra stops";
    })();
    const stopRows = stopsFor(job);
    const meetingInstructions = text(stopRows[0] && stopRows[0].note);
    const passenger = textOf(booking, ["passengerName"]) || textOf(booking, ["hirerName", "name"]) || "Name not recorded";
    const billingAccount = textOf(booking, ["billingAccountName"]);
    return {
      time: clockLabel(job.pickup),
      date: dateLabel(job.pickup),
      remaining: done ? "Completed" : timePhrase(job.pickup, now),
      overdue: overdue,
      pickup: job.pickupRecorded ? job.pickupLocation : "Pickup not recorded",
      destination: job.destinationRecorded ? job.destination : (job.destination || "Drop off not recorded"),
      pickupLabel: "Pickup",
      dropOffLabel: "Drop off",
      driverName: driverName,
      registration: registration || "No vehicle recorded",
      category: category(booking.vehicleType),
      passengers: counts.passengers,
      luggage: counts.luggage,
      allocation: allocation(booking, job.leg, named || driverName),
      statusLabel: readableStatus(explicitLegStatus(booking, job.leg)),
      canComplete: canMarkCompleted(booking, job.leg),
      badges: badges,
      warning: warning,
      summary: summary(booking),
      legLabel: hasReturn(booking) ? (job.leg === "return" ? "Return" : "Outbound") : "",
      extraStops: extra,
      flight: flight,
      landingNote: landingNote,
      collect: collectInstruction(booking, job.leg),
      stops: stopRows,
      meetingInstructions: meetingInstructions,
      mapLink: mapLinkForJob(job),
      customer: passenger,
      billingAccount: billingAccount,
      phone: textOf(booking, ["hirerPhone", "phone"]),
      notes: notes,
      nextAction: warning || "Open navigation and go to the pickup.",
    };
  }

  function selectJobs(bookings, view, now, driverFilter) {
    return bookings
      .filter(function (row) { return !isCancelled(row); })
      .flatMap(expandJobs)
      .filter(function (job) { return matchesDriver(job, driverFilter) && inView(job, view, now); })
      .sort(function (a, b) {
        const diff = (a.pickup ? a.pickup.getTime() : 0) - (b.pickup ? b.pickup.getTime() : 0);
        return view === "completed" ? -diff : diff;
      });
  }

  function nextJourney(bookings, now, driverFilter) {
    return bookings
      .filter(function (row) { return !isCancelled(row); })
      .flatMap(expandJobs)
      .filter(function (job) {
        return matchesDriver(job, driverFilter)
          && !legCompleted(job.booking, job.leg)
          && job.pickup
          && job.pickup >= startOfDay(now)
          && job.pickup.getTime() >= now.getTime() - 6 * 60 * 60 * 1000
          && !(job.booking.vehicleType === "executive" && job.booking.executiveAvailability !== "accepted");
      })
      .sort(function (a, b) { return (a.pickup ? a.pickup.getTime() : 0) - (b.pickup ? b.pickup.getTime() : 0); })[0] || null;
  }

  function nextTitle(driverFilter) {
    if (driverFilter && driverFilter !== "all" && driverFilter !== "unassigned") return "Next assigned journey";
    if (driverFilter === "unassigned") return "Next unassigned journey";
    return "Next shared journey";
  }

  function groupJobs(jobs, now) {
    const groups = [];
    jobs.forEach(function (job) {
      const key = job.pickup ? startOfDay(job.pickup).toISOString() : "none";
      let group = groups.find(function (row) { return row.key === key; });
      if (!group) {
        group = { key: key, label: dayHeading(job.pickup, now), jobs: [] };
        groups.push(group);
      }
      group.jobs.push(job);
    });
    return groups;
  }

  function previewBundle() {
    const now = new Date("2026-11-15T15:10:00");
    const copied = "Hi can you collect us from Heathrow terminal 3 flight BA249 lands at 18:40 we have 2 big cases and a child seat please meet at arrivals thanks so much see you then";
    return {
      now: now,
      drivers: [
        { id: "sam", name: "Sam Test" },
        { id: "alex", name: "Alex Test" },
      ],
      vehicles: [
        { id: "car-out", registration: "TE57 OUT" },
        { id: "car-ret", registration: "TE57 RET" },
      ],
      bookings: [
        {
          id: "overdue",
          bookingNumber: "SYN-LATE",
          status: "confirmed",
          pickupTime: "2026-11-15T14:00:00",
          dateTime: "2026-11-15T14:00:00",
          pickupLocation: "TBC",
          destination: "Oxford Station",
          driverId: "sam",
          vehicleType: "standard",
          passengers: 0,
          luggage: null,
          hirerName: "Late Example",
          hirerPhone: "07700900001",
          notes: "as discussed",
          paymentStatus: "pending",
          actualFare: 30,
        },
        {
          id: "archive",
          bookingNumber: "SYN-OLD",
          status: "confirmed",
          pickupTime: "2026-11-01T09:00:00",
          dateTime: "2026-11-01T09:00:00",
          pickupLocation: "Oxford",
          destination: "Didcot",
          driverId: "sam",
          vehicleType: "standard",
          passengers: 1,
          luggage: 1,
          hirerName: "Old Example",
          hirerPhone: "07700900002",
          paymentStatus: "pending",
        },
        {
          id: "standard",
          bookingNumber: "SYN-STD",
          status: "allocated",
          pickupTime: "2026-11-15T16:40:00",
          dateTime: "2026-11-15T16:40:00",
          pickupLocation: "12 Park End Street, Oxford OX1 1HH",
          destination: "Oxford Station",
          driverId: "sam",
          vehicleId: "car-out",
          vehicleType: "standard",
          passengers: 2,
          luggage: 2,
          hirerName: "Sam Customer",
          hirerPhone: "07700900789",
          paymentStatus: "pending",
          actualFare: 18,
        },
        {
          id: "air",
          bookingNumber: "SYN-AIR",
          status: "allocated",
          airportCollection: true,
          flightNumber: "BA249",
          terminal: "5",
          pickupTime: "2026-11-15T17:20:00",
          dateTime: "2026-11-15T17:20:00",
          pickupLocation: "Heathrow Terminal 5, TW6 2GA",
          destination: "12 Park End Street, Oxford OX1 1HH",
          driverId: "sam",
          vehicleId: "car-out",
          vehicleType: "standard",
          passengers: 3,
          luggage: 2,
          hirerName: "Air Example",
          hirerPhone: "07700900222",
          specialRequirements: copied,
          notes: copied,
          paymentStatus: "pending",
        },
        {
          id: "exec",
          bookingNumber: "SYN-EXEC",
          status: "pending",
          vehicleType: "executive",
          executiveAvailability: "awaiting_confirmation",
          serviceType: "executive",
          pickupTime: "2026-11-15T18:30:00",
          dateTime: "2026-11-15T18:30:00",
          pickupLocation: "Oxford",
          destination: "Heathrow Terminal 5",
          passengers: "",
          luggage: 0,
          hirerName: "Guest Example",
          hirerPhone: "07700900456",
          paymentStatus: "pending",
          actualFare: 150,
        },
        {
          id: "return-job",
          bookingNumber: "SYN-RET",
          status: "allocated",
          bookingType: "return",
          returnTrip: true,
          outboundStatus: "completed",
          returnStatus: "allocated",
          pickupTime: "2026-11-15T10:00:00",
          dateTime: "2026-11-15T10:00:00",
          pickupLocation: "12 Park End Street, Oxford OX1 1HH",
          destination: "Heathrow Terminal 5",
          returnPickupTime: "2026-11-15T20:15:00",
          returnPickupLocation: "Heathrow Terminal 5, TW6 2GA",
          returnDestination: "12 Park End Street, Oxford OX1 1HH",
          driverId: "sam",
          returnDriverId: "alex",
          vehicleId: "car-out",
          returnVehicleId: "car-ret",
          vehicleType: "standard",
          passengers: 1,
          luggage: 1,
          airportCollection: false,
          returnAirportCollection: true,
          flightNumber: "BA249",
          terminal: "2",
          returnFlightNumber: "BA460",
          returnTerminal: "5",
          hirerName: "Alex Example",
          hirerPhone: "07700900123",
          paymentStatus: "pending",
          dueOnReturn: 40,
          actualFare: 290,
        },
        {
          id: "stops",
          bookingNumber: "SYN-STOPS",
          status: "allocated",
          pickupTime: "2026-11-16T11:30:00",
          dateTime: "2026-11-16T11:30:00",
          pickupLocation: "12 Park End Street, Oxford OX1 1HH",
          destination: "Didcot Parkway",
          driverId: "alex",
          vehicleId: "car-ret",
          vehicleType: "8_seater",
          passengers: 4,
          luggage: 3,
          hirerName: "Stop Example",
          hirerPhone: "07700900333",
          stops: [
            { type: "pickup", address: "12 Park End Street, Oxford OX1 1HH" },
            { type: "pickup", address: "Oxford Station" },
            { type: "dropoff", address: "Didcot Parkway" },
          ],
          paymentStatus: "pending",
        },
        {
          id: "paid",
          bookingNumber: "SYN-PAID",
          status: "allocated",
          pickupTime: "2026-11-16T09:00:00",
          dateTime: "2026-11-16T09:00:00",
          pickupLocation: "Abingdon",
          destination: "Oxford Station",
          driverId: "sam",
          vehicleId: "car-out",
          vehicleType: "standard",
          passengers: 1,
          luggage: 1,
          hirerName: "Paid Example",
          hirerPhone: "07700900555",
          paymentStatus: "paid",
          actualFare: 92,
          outstandingPence: 0,
        },
        {
          id: "collect",
          bookingNumber: "SYN-DUE",
          status: "allocated",
          pickupTime: "2026-11-16T13:00:00",
          dateTime: "2026-11-16T13:00:00",
          pickupLocation: "Didcot",
          destination: "Heathrow Terminal 5",
          driverId: "alex",
          vehicleId: "car-ret",
          vehicleType: "standard",
          passengers: 2,
          luggage: 2,
          hirerName: "Due Example",
          hirerPhone: "07700900666",
          paymentStatus: "pending",
          dueOnOutbound: 45,
          actualFare: 180,
          outstandingPence: 18000,
        },
        {
          id: "done",
          bookingNumber: "SYN-DONE",
          status: "completed",
          pickupTime: "2026-11-14T12:00:00",
          dateTime: "2026-11-14T12:00:00",
          pickupLocation: "Witney",
          destination: "Oxford",
          driverId: "sam",
          vehicleId: "car-out",
          vehicleType: "standard",
          passengers: 1,
          luggage: 0,
          hirerName: "Done Example",
          hirerPhone: "07700900777",
          paymentStatus: "paid",
        },
      ],
    };
  }

  root.SpiresDriverHub = {
    textOf: textOf,
    toDate: toDate,
    isCancelled: isCancelled,
    isCompleted: isCompleted,
    legCompleted: legCompleted,
    readableStatus: readableStatus,
    canMarkCompleted: canMarkCompleted,
    completionUpdate: completionUpdate,
    reopenUpdate: reopenUpdate,
    applyStatusUpdate: applyStatusUpdate,
    hasReturn: hasReturn,
    expandJobs: expandJobs,
    selectJobs: selectJobs,
    nextJourney: nextJourney,
    nextTitle: nextTitle,
    presentJob: presentJob,
    groupJobs: groupJobs,
    collectInstruction: collectInstruction,
    paymentSummary: paymentSummary,
    flightForLeg: flightForLeg,
    previewBundle: previewBundle,
    category: category,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
