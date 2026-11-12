(function () {
  var rules = window.SpiresInternational;
  var form = document.querySelector("#journey-form");
  if (!form || !rules) return;
  var result = document.querySelector("#journey-result");
  var review = document.querySelector("#payment-review");
  var sentKeys = [];
  var quote = null;

  function field(name) { return form.elements[name]; }
  function text(name) { return String(field(name).value || "").trim(); }
  function show(node, html) { node.hidden = false; node.innerHTML = html; }
  function consent() {
    try { return localStorage.getItem("spires_international_consent") || "denied"; } catch (e) { return "denied"; }
  }
  function streamId() {
    var meta = document.querySelector('meta[name="spires-ga4"]');
    return meta ? String(meta.getAttribute("content") || "").trim() : "";
  }
  function record(name, key, params) {
    var outcome = rules.measurementEvent({
      consent: consent(),
      measurementId: streamId(),
      name: name,
      dedupeKey: key,
      alreadySent: sentKeys,
      params: params,
    });
    if (outcome.sent) sentKeys.push(name + ":" + key);
    return outcome;
  }

  var params = new URLSearchParams(location.search);
  ["pickup", "destination", "date"].forEach(function (name) {
    if (params.get(name) && field(name)) field(name).value = params.get(name);
  });
  if (params.get("trip") === "return" && field("trip")) field("trip").value = "return";

  function airport(value) {
    return /heathrow|gatwick|stansted|luton|birmingham|\b(lhr|lgw|stn|ltn|bhx)\b/i.test(value);
  }

  function syncReturn() {
    document.querySelector("#return-fields").hidden = field("trip").value !== "return";
  }
  Array.prototype.forEach.call(form.querySelectorAll("[name=trip]"), function (input) {
    input.addEventListener("change", syncReturn);
  });
  syncReturn();

  document.querySelector("#add-stop").addEventListener("click", function () {
    var list = document.querySelector("#stops");
    if (list.children.length >= 2) return;
    var row = document.createElement("input");
    row.name = "stop";
    row.type = "text";
    row.maxLength = 160;
    row.placeholder = "Stop on the way";
    row.setAttribute("aria-label", "Extra stop");
    list.appendChild(row);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (form.elements._gotcha.value) return;
    var errors = [];
    var pickup = text("pickup");
    var destination = text("destination");
    var date = text("date");
    var time = text("time");
    var passengers = Number(text("passengers"));
    var luggage = Number(text("luggage"));
    var vehicle = field("vehicle").value;
    var name = text("name");
    var email = text("email");
    var phone = text("phone");
    var trip = field("trip").value;
    var stops = Array.prototype.map.call(form.querySelectorAll("[name=stop]"), function (input) { return input.value.trim(); }).filter(Boolean);
    if (pickup.length < 3) errors.push("Enter a pick up.");
    if (destination.length < 3) errors.push("Enter a destination.");
    if (!date || !time) errors.push("Enter the date and time.");
    var when = new Date(date + "T" + time);
    if (date && time && (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 5 * 60 * 1000)) errors.push("Choose a time that has not already passed.");
    if (trip === "return") {
      var returnDate = text("returnDate");
      var returnTime = text("returnTime");
      if (!returnDate || !returnTime) errors.push("Enter the return date and time, or choose one way.");
      var back = new Date(returnDate + "T" + returnTime);
      if (returnDate && returnTime && back <= when) errors.push("The return needs to be after the first pick up.");
    }
    if (!field("oxford").checked) errors.push("This service is for journeys into or out of Oxford.");
    var fit = rules.vehicleDecision(passengers, luggage, vehicle);
    if (!fit.ok) errors.push(fit.error);
    if (airport(pickup) && text("flight").length < 3) errors.push("Enter the flight number for an airport pick up.");
    if (name.length < 2) errors.push("Enter the passenger name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter an email address.");
    if (phone.replace(/\D/g, "").length < 8) errors.push("Enter a phone number.");
    if (!field("terms").checked) errors.push("Please read the terms shown on this page before you send the quote request.");
    var errorNode = document.querySelector("#form-errors");
    if (errors.length) {
      errorNode.hidden = false;
      errorNode.innerHTML = errors.map(function (item) { return "<p>" + item + "</p>"; }).join("");
      result.hidden = true;
      return;
    }
    errorNode.hidden = true;
    var fare = rules.chargeableFare();
    quote = rules.newQuote();
    var reference = "SI-PREVIEW-" + Date.now().toString().slice(-8);
    record("generate_lead", reference, { lead_type: "quote" });
    var vehicleName = vehicle === "vito_8" ? "8 seater" : "Standard Car";
    var stopLine = stops.length ? stops.join(", ") : "None";
    show(result,
      "<h2>Quote requested</h2>" +
      "<p>Your reference is <strong>" + reference + "</strong>. This preview keeps the request in this browser. It has not been sent to the office and no payment has been taken.</p>" +
      "<div class=\"status\"><dl>" +
      "<dt>Journey</dt><dd>" + pickup + " to " + destination + "</dd>" +
      "<dt>Extra stops</dt><dd>" + stopLine + "</dd>" +
      "<dt>When</dt><dd>" + date + " at " + time + (trip === "return" ? ". Return " + text("returnDate") + " at " + text("returnTime") : ". One way") + "</dd>" +
      "<dt>Vehicle</dt><dd>" + vehicleName + ". " + passengers + " passengers, " + luggage + " bags.</dd>" +
      "<dt>Fare</dt><dd>" + fare.reason + "</dd>" +
      "<dt>Booking</dt><dd>" + rules.statusLabel(quote.status) + "</dd>" +
      "<dt>Payment</dt><dd>" + rules.paymentLabel(quote.paymentStatus) + "</dd>" +
      "<dt>Driver</dt><dd>Not allocated</dd>" +
      "</dl></div>"
    );
    review.hidden = false;
  });

  var fixture = null;
  function paintReview(message) {
    var node = document.querySelector("#review-state");
    if (!fixture) {
      node.textContent = message;
      return;
    }
    node.innerHTML = message + " Booking: " + rules.statusLabel(fixture.status) + ". Payment: " + rules.paymentLabel(fixture.paymentStatus) + ". Driver allocated: no.";
  }
  document.querySelector("#start-review").addEventListener("click", function () {
    fixture = rules.approveFare(rules.newQuote(), 100, true);
    fixture.farePence = 100;
    paintReview("Test fixture of 100 pence. This is not a customer price and no card is charged.");
  });
  document.querySelectorAll("[data-notice]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (!fixture || !fixture.fareApproved) {
        paintReview("Start the test fixture first. A real quote cannot be charged.");
        return;
      }
      var type = button.getAttribute("data-notice");
      var id = button.getAttribute("data-id");
      var outcome = rules.applyPaymentNotice(fixture, { id: id, type: type, amountPence: 100 });
      fixture = outcome.state;
      var message = outcome.accepted ? (outcome.duplicate ? "Duplicate notice ignored." : "Notice applied.") : (outcome.reason || "Not applied.");
      if (outcome.accepted && !outcome.duplicate && type === "payment_intent.succeeded") {
        record("purchase", id, { value: 1, transaction_id: id, payment_kind: "full" });
      }
      if (outcome.accepted && !outcome.duplicate && type === "charge.refunded") {
        record("refund", id, { value: 1, transaction_id: id, payment_kind: "full" });
      }
      paintReview(message);
    });
  });
  document.querySelector("#confirm-review").addEventListener("click", function () {
    if (!fixture) {
      paintReview("Start the test fixture first.");
      return;
    }
    var outcome = rules.confirmAfterPayment(fixture);
    fixture = outcome.state;
    if (!outcome.error) record("booking_confirmed", "fixture", {});
    paintReview(outcome.error || "Staff confirmation recorded in this browser only. A driver is still not allocated.");
  });
})();
