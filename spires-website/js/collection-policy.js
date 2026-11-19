(function (root) {
  var shared = root.SpiresServicePolicy || {};
  var CURRENT = String(shared.version || "2026-11-19");
  var CURRENT_AIRPORT = shared.airport || {
    flightFreeMinutes: 50,
    fixedFreeMinutes: 15,
    blockMinutes: 15,
    chargePounds: 5,
  };

  /** Historic published stamps kept so older bookings keep their agreed numbers. */
  var PUBLISHED = {
    "2026-11-15": { flightFreeMinutes: 60, fixedFreeMinutes: 15, blockMinutes: 15, chargePounds: 5 },
  };
  PUBLISHED[CURRENT] = {
    flightFreeMinutes: Number(CURRENT_AIRPORT.flightFreeMinutes),
    fixedFreeMinutes: Number(CURRENT_AIRPORT.fixedFreeMinutes),
    blockMinutes: Number(CURRENT_AIRPORT.blockMinutes),
    chargePounds: Number(CURRENT_AIRPORT.chargePounds),
  };

  function instant(value) {
    if (value == null || value === "") return null;
    var parsed = new Date(String(value)).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  function londonWhen(ms) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(ms));
  }

  function publishedFor(version) {
    if (!version) return null;
    return PUBLISHED[String(version)] || null;
  }

  function policyFor(input) {
    var hotel = input && input.collectionLocationKind === "hotel";
    var fixed = hotel || (input && input.collectionArrangement === "fixed_time");
    var published = publishedFor(input && input.waitingPolicyVersion);
    if (!published) {
      return { version: "legacy-50-30", freeMinutes: 50, blockMinutes: 30, chargePounds: 10, basis: "actual_landing" };
    }
    return {
      version: String(input.waitingPolicyVersion),
      freeMinutes: fixed ? published.fixedFreeMinutes : published.flightFreeMinutes,
      blockMinutes: published.blockMinutes,
      chargePounds: published.chargePounds,
      basis: fixed ? "booked_time" : "actual_landing",
    };
  }

  function proposeWaitingCharge(input) {
    var policy = policyFor(input || {});
    var rate = "Additional waiting is charged at £" + policy.chargePounds + " per started " + policy.blockMinutes + " minutes after your included allowance.";
    if (policy.basis === "actual_landing" && !(input && input.landingStatus === "actual" && instant(input.verifiedLandingAt) != null)) {
      return { status: "needs_verification", includedUntil: null, chargeableMinutes: 0, blocks: 0, proposedPounds: 0, preview: "Needs verification. A scheduled, estimated or unclear arrival is not a verified landing, so no waiting charge is final." };
    }
    var anchor = policy.basis === "booked_time" ? instant(input && input.bookedCollectionAt) : instant(input && input.verifiedLandingAt);
    if (anchor == null) {
      return { status: "needs_verification", includedUntil: null, chargeableMinutes: 0, blocks: 0, proposedPounds: 0, preview: "Needs verification. The collection time is not recorded, so no waiting charge is final." };
    }
    var includedUntil = anchor + policy.freeMinutes * 60000;
    var driverReady = instant(input && input.driverReadyAt);
    var passengerReady = instant(input && input.passengerReadyAt);
    var deadline = londonWhen(includedUntil);
    if (driverReady == null || passengerReady == null) {
      return { status: "proposed", includedUntil: new Date(includedUntil).toISOString(), chargeableMinutes: 0, blocks: 0, proposedPounds: 0, preview: "Included waiting ends at " + deadline + " UK time. " + rate + " Record when the driver is ready at the collection point and when the passenger is ready before a charge is proposed." };
    }
    var chargeFrom = Math.max(includedUntil, driverReady);
    var chargeableMs = Math.max(0, passengerReady - chargeFrom);
    var blocks = chargeableMs === 0 ? 0 : Math.ceil(chargeableMs / (policy.blockMinutes * 60000));
    return {
      status: "proposed",
      includedUntil: new Date(includedUntil).toISOString(),
      chargeableMinutes: Math.ceil(chargeableMs / 60000),
      blocks: blocks,
      proposedPounds: blocks * policy.chargePounds,
      preview: "Included waiting ends at " + deadline + " UK time. Chargeable waiting is " + Math.ceil(chargeableMs / 60000) + " minutes, " + blocks + " started " + policy.blockMinutes + " minute blocks, proposed additional charge £" + (blocks * policy.chargePounds) + ". " + rate + " This is not a payment and it has not been sent to the customer.",
    };
  }

  function proposeTimedHireCharge(input) {
    var start = input && input.startAt ? new Date(input.startAt).getTime() : NaN;
    var included = Number(input && input.includedMinutes);
    var rate = Number(input && input.extraRatePounds);
    var interval = Number(input && input.extraIntervalMinutes);
    if (!Number.isFinite(start) || !Number.isFinite(included) || included <= 0) {
      return { warning: false, proposedPounds: 0, preview: "Timed hire needs an agreed start and included duration." };
    }
    var planned = start + included * 60000;
    var arrived = input.driverArrivedAt ? new Date(input.driverArrivedAt).getTime() : NaN;
    var late = Number.isFinite(arrived) ? Math.max(0, arrived - start) : 0;
    var customerFinish = planned + late;
    var end = input.completedAt ? new Date(input.completedAt).getTime() : NaN;
    var overrun = Number.isFinite(end) ? Math.max(0, end - customerFinish) : 0;
    var chargeable = input.delayCause === "driver" ? 0 : Math.max(0, overrun - Math.max(0, Number(input.excludedMinutes) || 0) * 60000);
    var blocks = !Number.isFinite(interval) || interval <= 0 || chargeable === 0 ? 0 : Math.ceil(chargeable / (interval * 60000));
    var proposed = Number.isFinite(rate) && rate > 0 ? blocks * rate : 0;
    var now = input.now || Date.now();
    var finish = londonWhen(customerFinish);
    return {
      warning: !Number.isFinite(end) && now >= customerFinish - 30 * 60000,
      proposedPounds: proposed,
      extraMinutes: Math.ceil(chargeable / 60000),
      blocks: blocks,
      preview: "Included time ends at " + finish + " UK time. " + (Number.isFinite(rate) && Number.isFinite(interval) ? "Additional time is charged at £" + rate + " per started " + interval + " minutes." : "The additional time rate is not agreed yet.") + " Proposed additional charge £" + proposed + ". This reminder is not a new request for permission.",
    };
  }

  function addAdditionalCharge(existing, charge) {
    var rows = Array.isArray(existing) ? existing.slice() : [];
    var id = String(charge && charge.id || "").trim();
    var amount = Math.round(Number(charge && charge.amountPence));
    var reason = String(charge && charge.reason || "").trim();
    if (!id) return { ok: false, error: "A charge needs an id so a retry cannot add it twice." };
    if (!reason) return { ok: false, error: "Record why this charge is being added." };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter the additional charge in pence." };
    if (rows.some(function (row) { return row && row.id === id; })) return { ok: false, error: "This charge was already added." };
    rows.push({ id: id, amountPence: amount, reason: reason });
    return { ok: true, charges: rows };
  }

  var api = {
    CURRENT_WAITING_VERSION: CURRENT,
    policyFor: policyFor,
    proposeWaitingCharge: proposeWaitingCharge,
    proposeTimedHireCharge: proposeTimedHireCharge,
    addAdditionalCharge: addAdditionalCharge,
  };
  root.SpiresCollection = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
