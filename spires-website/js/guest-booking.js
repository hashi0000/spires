(function () {
  var form = document.getElementById("booking-form");
  if (!form || form.getAttribute("data-enquiry") === "business") return;

  var endpoint = (location.hostname === "127.0.0.1" || location.hostname === "localhost")
    ? "http://127.0.0.1:5001/demo-spires/us-central1/submitWebsiteQuote"
    : "https://us-central1-spires-taxis.cloudfunctions.net/submitWebsiteQuote";
  var officePhone = "07776 897772";
  var contactMessage = "Please provide a phone number or email address so we can respond to your request. You can also call us on " + officePhone + ".";
  var journey = document.getElementById("journey");
  var returnFields = document.getElementById("return-fields");
  var airport = document.getElementById("airport-collection");
  var flightFields = document.getElementById("flight-fields");
  var returnAirport = document.getElementById("return-airport");
  var returnFlight = document.getElementById("return-flight-field");
  var airportNote = document.getElementById("airport-note");
  var passengers = document.getElementById("passengers");
  var contactError = document.getElementById("contact-error");
  var status = document.getElementById("booking-status");
  var result = document.getElementById("booking-result");
  var termsError = document.getElementById("terms-agreement-error");
  var heardAbout = document.getElementById("heard-about");
  var heardAboutDetail = document.getElementById("heard-about-detail");

  function today() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function show(node, on) {
    if (node) node.hidden = !on;
  }

  function selectedVehicle() {
    var chosen = form.querySelector("input[name='vehicleType']:checked");
    return chosen ? chosen.value : "";
  }

  function syncPassengers() {
    if (!passengers) return;
    var type = selectedVehicle();
    var max = type === "8_seater" || type === "executive" ? 8 : 4;
    passengers.max = String(max);
    if (Number(passengers.value) > max) passengers.value = String(max);
    var note = document.getElementById("executive-note");
    if (note) note.hidden = type !== "executive";
  }

  function toggleJourney() {
    var isReturn = journey && journey.value === "return";
    show(returnFields, isReturn);
    if (isReturn) {
      var pickup = document.getElementById("pickup");
      var destination = document.getElementById("destination");
      var returnPickup = document.getElementById("return-pickup");
      var returnDestination = document.getElementById("return-destination");
      if (returnPickup && !returnPickup.value && destination) returnPickup.value = destination.value;
      if (returnDestination && !returnDestination.value && pickup) returnDestination.value = pickup.value;
    }
  }

  function collectionCheck(prefix) {
    var on = prefix ? returnAirport && returnAirport.checked && journey && journey.value === "return" : airport && airport.checked;
    if (!on) return "";
    var kindName = prefix ? "returnCollectionLocationKind" : "collectionLocationKind";
    var arrangementName = prefix ? "returnCollectionArrangement" : "collectionArrangement";
    var locationName = prefix ? "returnCollectionLocation" : "collectionLocation";
    var arrivalName = prefix ? "returnArrivalDate" : "arrivalDate";
    var ackName = prefix ? "returnFixedTimeAcknowledged" : "fixedTimeAcknowledged";
    var flightName = prefix ? "returnFlightNumber" : "flightNumber";
    var kind = String((form.elements[kindName] && form.elements[kindName].value) || "terminal");
    var arrangement = kind === "hotel" ? "fixed_time" : String((form.elements[arrangementName] && form.elements[arrangementName].value) || "flight_monitored");
    if (!String((form.elements[locationName] && form.elements[locationName].value) || "").trim()) return "Enter the exact collection location, including the terminal or hotel.";
    if (arrangement === "flight_monitored") {
      if (!String((form.elements[flightName] && form.elements[flightName].value) || "").trim()) return "Flight monitored collection needs the flight number.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String((form.elements[arrivalName] && form.elements[arrivalName].value) || ""))) return "Flight monitored collection needs the arrival date.";
    }
    if (arrangement === "fixed_time" && !(form.elements[ackName] && form.elements[ackName].checked)) {
      return "Tick the box to confirm this collection time will not be flight monitored.";
    }
    return "";
  }

  function toggleAirport() {
    var outbound = airport && airport.checked;
    var inbound = returnAirport && returnAirport.checked && journey && journey.value === "return";
    show(flightFields, outbound);
    show(returnFlight, inbound);
    show(airportNote, outbound || inbound);
    show(document.getElementById("collection-help"), outbound || inbound);
    var fixed = document.getElementById("fixed-time-note");
    var arrangement = form.elements.collectionArrangement;
    var kind = form.elements.collectionLocationKind;
    show(fixed, outbound && ((kind && kind.value === "hotel") || (arrangement && arrangement.value === "fixed_time")));
    var flightDate = document.getElementById("arrival-date-field");
    show(flightDate, outbound && !(kind && kind.value === "hotel") && !(arrangement && arrangement.value === "fixed_time"));
  }

  var dateField = document.getElementById("date");
  var returnDate = document.getElementById("return-date");
  if (dateField) dateField.min = today();
  if (returnDate) returnDate.min = today();
  if (journey) journey.addEventListener("change", function () { toggleJourney(); toggleAirport(); });
  if (airport) airport.addEventListener("change", toggleAirport);
  if (returnAirport) returnAirport.addEventListener("change", toggleAirport);
  ["collectionLocationKind", "collectionArrangement", "returnCollectionLocationKind", "returnCollectionArrangement"].forEach(function (name) {
    if (form.elements[name]) form.elements[name].addEventListener("change", toggleAirport);
  });
  function toggleHeardAbout() {
    show(heardAboutDetail, Boolean(heardAbout && heardAbout.value === "other"));
  }
  if (heardAbout) heardAbout.addEventListener("change", toggleHeardAbout);
  toggleHeardAbout();
  Array.prototype.forEach.call(form.querySelectorAll("input[name='vehicleType']"), function (input) {
    input.addEventListener("change", function () {
      syncPassengers();
      if (input.checked && input.value === "executive" && window.SpiresMeasurement && window.SpiresMeasurement.engagement) {
        window.SpiresMeasurement.engagement("executive_option_selected", { service_type: "executive", airport: "heathrow" });
      }
    });
  });
  var params = new URLSearchParams();
  try { params = new URLSearchParams(window.location.search); } catch (err) { params = new URLSearchParams(); }
  var requestedVehicle = params.get("vehicle") || "";
  var ROUTE_PRESETS = {
    "oxford-to-heathrow": { pickup: "Oxford", destination: "Heathrow Airport", airportCollection: false },
    "heathrow-to-oxford": { pickup: "Heathrow Airport", destination: "Oxford", airportCollection: true },
    "oxford-to-gatwick": { pickup: "Oxford", destination: "Gatwick Airport", airportCollection: false },
    "gatwick-to-oxford": { pickup: "Gatwick Airport", destination: "Oxford", airportCollection: true },
    "oxford-to-stansted": { pickup: "Oxford", destination: "Stansted Airport", airportCollection: false },
    "stansted-to-oxford": { pickup: "Stansted Airport", destination: "Oxford", airportCollection: true },
    "oxford-to-luton": { pickup: "Oxford", destination: "Luton Airport", airportCollection: false },
    "oxfordshire-to-heathrow": { pickup: "Oxfordshire", destination: "Heathrow Airport", airportCollection: false }
  };
  function applyRoutePrefill() {
    var preset = ROUTE_PRESETS[params.get("route") || ""] || null;
    var pickupValue = params.get("pickup") || (preset && preset.pickup) || "";
    var destinationValue = params.get("destination") || (preset && preset.destination) || "";
    var pickupField = document.getElementById("pickup");
    var destinationField = document.getElementById("destination");
    if (pickupField && pickupValue && !pickupField.value) pickupField.value = pickupValue;
    if (destinationField && destinationValue && !destinationField.value) destinationField.value = destinationValue;
    var wantAirport = params.get("airportCollection") === "1" || params.get("airportCollection") === "yes" || (preset && preset.airportCollection);
    if (wantAirport && airport && !airport.checked) {
      airport.checked = true;
    }
    var direction = params.get("direction") || "";
    if (direction === "from-airport" && airport && !airport.checked) airport.checked = true;
    if (params.get("terminal") && form.elements.terminal && !form.elements.terminal.value) {
      form.elements.terminal.value = params.get("terminal");
    }
  }
  function applyRequestedVehicle() {
    var allowed = { executive: true, "8_seater": true, standard: true };
    if (!allowed[requestedVehicle]) return;
    var input = form.querySelector("input[name='vehicleType'][value='" + requestedVehicle + "']");
    if (!input || input.closest("[hidden]") || input.checked) return;
    input.checked = true;
    syncPassengers();
    if (requestedVehicle === "executive" && window.SpiresMeasurement && window.SpiresMeasurement.engagement) {
      window.SpiresMeasurement.engagement("executive_option_selected", { service_type: "executive", airport: "heathrow" });
    }
  }
  applyRoutePrefill();
  applyRequestedVehicle();
  document.addEventListener("spires-prices-ready", applyRequestedVehicle);
  toggleJourney();
  toggleAirport();
  syncPassengers();
  if (window.location.hash === "#booking") {
    var bookingCard = document.getElementById("booking");
    if (bookingCard && bookingCard.scrollIntoView) {
      setTimeout(function () { bookingCard.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
    }
  }

  function submissionId() {
    var key = "spires-guest-submission";
    var existing = "";
    try { existing = sessionStorage.getItem(key) || ""; } catch (err) { existing = ""; }
    if (existing.length >= 16) return existing;
    var id = ("web" + Date.now().toString(36) + Math.random().toString(36).slice(2) + "guestrequest").slice(0, 40);
    try { sessionStorage.setItem(key, id); } catch (err) { /* the request can still be sent */ }
    return id;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
    });
  }

  function validEmail(value) {
    return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validPhone(value) {
    if (!value) return true;
    return /^\+?[0-9]{8,15}$/.test(value.replace(/[\s().-]/g, ""));
  }

  function setStatus(message) {
    if (!status) return;
    status.hidden = !message;
    status.textContent = message || "";
  }

  function successHtml(body) {
    body = body || {};
    var reference = escapeHtml(body.bookingNumber);
    var parts = [
      "<div class=\"guest-success\">",
      "<h2>Your booking request has been received.</h2>",
      "<p>Your reference is <strong>" + reference + "</strong>.</p>",
      body.vehicleType === "executive"
        ? "<p>This is an Executive Car request for a Heathrow transfer. It is not a confirmed booking. No vehicle is reserved, and we will not take payment until we confirm availability. We confirm the car is suitable for your passengers and luggage before we accept it.</p>"
        : "<p>This is not a confirmed booking yet. We will review the journey and send a quote. The journey is confirmed only after that quote is accepted.</p>"
    ];
    if (body.contactBy === "phone") {
      parts.push("<p>Our team will contact you on the phone number you gave us. We do not send a text message for this request.</p>");
      parts.push("<p>An account needs an email address. You do not need one for us to deal with this request.</p>");
    } else if (body.duplicate && !body.claimUrl) {
      parts.push("<p>This request was already received. You do not need to send it again. Use the email we sent if you want to create an account.</p>");
    } else if (!body.emailSent) {
      parts.push("<p>We have saved the request. If you do not see an email, you do not need to send the form again. Call " + officePhone + " and quote your reference.</p>");
    } else {
      parts.push("<p>We have emailed this reference to you.</p>");
    }
    if (body.claimUrl) {
      parts.push("<p>Create an account to track and manage your bookings. This is optional, and your request is already saved.</p>");
      parts.push("<p><a class=\"btn btn--primary\" href=\"" + escapeHtml(body.claimUrl) + "\">Create an account</a></p>");
    }
    parts.push("<p><button type=\"button\" class=\"btn btn--outline\" id=\"booking-another\">Send another request</button></p></div>");
    return parts.join("");
  }

  var sending = false;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (sending) return;
    setStatus("");
    if (contactError) contactError.hidden = true;
    if (termsError) termsError.hidden = true;

    var data = new FormData(form);
    var name = String(data.get("name") || "").trim();
    var email = String(data.get("email") || "").trim();
    var phone = String(data.get("phone") || "").trim();
    var agreed = form.querySelector("[name='termsAccepted']");
    if (!name) {
      setStatus("Please enter your full name.");
      return;
    }
    if (!validEmail(email)) {
      setStatus("Enter a valid email address, or leave it blank if you have given a phone number.");
      return;
    }
    if (!validPhone(phone)) {
      setStatus("Enter a phone number we can call, with country code if you are outside the UK (for example +1, +81, +86, +852 or +65). A UK number is not required.");
      return;
    }
    if (!email && !phone) {
      if (contactError) {
        contactError.hidden = false;
        contactError.textContent = contactMessage;
      }
      var phoneField = document.getElementById("phone");
      if (phoneField) phoneField.focus();
      return;
    }
    if (!selectedVehicle()) {
      setStatus("Please choose a Standard Car or an 8 Seater.");
      return;
    }
    if (selectedVehicle() === "executive") {
      var executiveCheck = window.SPIRES_classifyExecutive ? window.SPIRES_classifyExecutive({
        pickup: data.get("pickup"),
        destination: data.get("destination"),
        bookingType: data.get("bookingType"),
        journeyType: data.get("journeyType"),
        returnPickup: data.get("returnPickupLocation"),
        returnDestination: data.get("returnDestination"),
        stops: window.spiresReadJourney ? (window.spiresReadJourney(form).stops || []) : [],
        returnStops: data.get("bookingType") === "return" && window.spiresReadJourney ? (window.spiresReadJourney(form).returnStops || []) : []
      }) : { ok: true };
      if (executiveCheck && executiveCheck.ok === false) {
        setStatus(executiveCheck.error || "Executive Car is only available for Heathrow transfers.");
        return;
      }
    }
    if (!agreed || !agreed.checked) {
      if (termsError) termsError.hidden = false;
      if (agreed) agreed.focus();
      return;
    }
    var collectionProblem = collectionCheck("");
    if (collectionProblem) {
      setStatus(collectionProblem);
      return;
    }
    if (data.get("bookingType") === "return") {
      var returnProblem = collectionCheck("return");
      if (returnProblem) {
        setStatus(returnProblem);
        return;
      }
    }

    var journey = window.spiresReadJourney ? window.spiresReadJourney(form) : null;
    if (journey && journey.error) {
      setStatus(journey.error);
      return;
    }
    sending = true;
    var button = document.getElementById("booking-submit");
    if (button) {
      button.disabled = true;
      button.textContent = "Sending request...";
    }
    function placeFrom(name) {
      var field = form.querySelector("[name='" + name + "']");
      if (!field || !field.dataset.place) return null;
      try { return JSON.parse(field.dataset.place); } catch (err) { return null; }
    }
    var payload = {
      name: name,
      email: email,
      phone: phone,
      pickup: data.get("pickup"),
      destination: data.get("destination"),
      pickupPlace: placeFrom("pickup"),
      destinationPlace: placeFrom("destination"),
      date: data.get("date"),
      time: data.get("time"),
      bookingType: data.get("bookingType"),
      journeyType: data.get("journeyType"),
      hireHours: data.get("hireHours"),
      hireItinerary: data.get("hireItinerary"),
      timedHireAccepted: data.get("timedHireAccepted") === "yes",
      vehicleType: selectedVehicle(),
      passengers: data.get("passengers"),
      luggage: data.get("luggage"),
      paymentMethod: data.get("paymentMethod"),
      message: data.get("message"),
      heardAbout: data.get("heardAbout") || "",
      heardAboutDetail: heardAbout && heardAbout.value === "other" ? (data.get("heardAboutDetail") || "") : "",
      airportCollection: airport && airport.checked,
      flightNumber: data.get("flightNumber") || "",
      terminal: data.get("terminal") || "",
      waitingPolicyVersion: (airport && airport.checked) || (returnAirport && returnAirport.checked) ? (window.SpiresServicePolicy && window.SpiresServicePolicy.version) || "2026-11-19" : "",
      collectionLocationKind: data.get("collectionLocationKind") || "terminal",
      collectionArrangement: data.get("collectionArrangement") || "flight_monitored",
      collectionLocation: data.get("collectionLocation") || "",
      arrivalDate: data.get("arrivalDate") || "",
      precedingFlight: data.get("precedingFlight") === "yes",
      travellingIndependently: data.get("travellingIndependently") === "yes",
      assistanceRequested: data.get("assistanceRequested") === "yes",
      assistanceNote: data.get("assistanceNote") || "",
      walkingAid: data.get("walkingAid") === "yes",
      wheelchairCarriage: data.get("wheelchairCarriage") === "yes",
      fixedTimeAcknowledged: Boolean(form.querySelector("[name='fixedTimeAcknowledged']") && form.querySelector("[name='fixedTimeAcknowledged']").checked),
      returnDate: data.get("returnDate") || "",
      returnTime: journey && journey.openReturn ? "" : (data.get("returnTime") || ""),
      stops: journey ? journey.stops : [],
      returnStops: journey ? journey.returnStops : [],
      openReturn: journey ? journey.openReturn : false,
      returnNoticeNote: journey ? journey.returnNoticeNote : "",
      returnPickupLocation: data.get("returnPickupLocation") || "",
      returnDestination: data.get("returnDestination") || "",
      returnAirportCollection: returnAirport && returnAirport.checked,
      returnFlightNumber: data.get("returnFlightNumber") || "",
      returnCollectionLocationKind: data.get("returnCollectionLocationKind") || "terminal",
      returnCollectionArrangement: data.get("returnCollectionArrangement") || "flight_monitored",
      returnCollectionLocation: data.get("returnCollectionLocation") || "",
      returnArrivalDate: data.get("returnArrivalDate") || "",
      returnFixedTimeAcknowledged: Boolean(form.querySelector("[name='returnFixedTimeAcknowledged']") && form.querySelector("[name='returnFixedTimeAcknowledged']").checked),
      termsAccepted: true,
      termsVersion: "2026-11-19",
      submissionId: submissionId(),
      _gotcha: data.get("_gotcha") || ""
    };

    Promise.resolve(window.SpiresMeasurement ? window.SpiresMeasurement.attribution().catch(function () { return null; }) : null).then(function (attribution) {
      payload.marketingAttribution = attribution;
      try {
        payload.websiteLandingPath = String(window.location.pathname || "").slice(0, 200);
        payload.websitePageUrl = String(window.location.href || "").slice(0, 500);
      } catch (err) { /* attribution still sends without page path */ }
      return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
      });
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body || {} }; });
      })
      .then(function (response) {
        if (!response.ok || !response.body.ok || !response.body.bookingNumber) {
          throw new Error((response.body && response.body.error) || "We could not save your request.");
        }
        if (!response.body.duplicate && window.SpiresMeasurement) {
          try {
            window.SpiresMeasurement.lead(
              response.body.bookingNumber,
              "website",
              "quote",
              selectedVehicle() === "executive" ? { service_type: "executive", airport: "heathrow" } : null
            );
          } catch (_) { /* Saved requests must still show success. */ }
        }
        form.hidden = true;
        if (result) {
          result.hidden = false;
          result.innerHTML = successHtml(response.body);
          var another = document.getElementById("booking-another");
          if (another) {
            another.addEventListener("click", function () {
              try { sessionStorage.removeItem("spires-guest-submission"); } catch (err) { /* ignore */ }
              sending = false;
              form.hidden = false;
              result.hidden = true;
              result.innerHTML = "";
              if (button) {
                button.disabled = false;
                button.textContent = "Send booking request";
              }
            });
          }
        }
      })
      .catch(function (err) {
        sending = false;
        if (button) {
          button.disabled = false;
          button.textContent = "Send booking request";
        }
        setStatus((err && err.message) || ("We could not save your request. Your details are still on this page. Please try again, or call " + officePhone + "."));
      });
  }, true);
})();
