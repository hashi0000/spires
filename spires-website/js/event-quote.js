(function () {
  var form = document.querySelector("form.event-quote");
  if (!form) return;

  var endpoint = "https://us-central1-spires-taxis.cloudfunctions.net/submitWebsiteQuote";
  var officePhone = "07776 897772";
  var journey = form.querySelector("[name='bookingType']");
  var returnFields = form.querySelector("[data-return-fields]");
  var passengers = form.querySelector("[name='passengers']");
  var status = form.querySelector("[data-quote-status]");
  var result = document.getElementById("event-quote-result");
  var termsError = form.querySelector("[data-terms-error]");
  var contactError = form.querySelector("[data-contact-error]");

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
    var max = selectedVehicle() === "8_seater" ? 8 : 4;
    passengers.max = String(max);
    if (Number(passengers.value) > max) passengers.value = String(max);
  }

  function field(name) {
    return form.querySelector("[name='" + name + "']");
  }

  function toggleJourney() {
    var isReturn = journey && journey.value === "return";
    show(returnFields, isReturn);
    if (!isReturn) return;
    var pickup = field("pickup");
    var destination = field("destination");
    var returnPickup = field("returnPickupLocation");
    var returnDestination = field("returnDestination");
    if (returnPickup && !returnPickup.value && destination) returnPickup.value = destination.value;
    if (returnDestination && !returnDestination.value && pickup) returnDestination.value = pickup.value;
  }

  Array.prototype.forEach.call(form.querySelectorAll("input[type='date']"), function (input) {
    input.min = today();
  });
  if (journey) journey.addEventListener("change", toggleJourney);
  Array.prototype.forEach.call(form.querySelectorAll("input[name='vehicleType']"), function (input) {
    input.addEventListener("change", syncPassengers);
  });
  toggleJourney();
  syncPassengers();

  function submissionId() {
    var key = "spires-event-submission:" + window.location.pathname;
    var existing = "";
    try { existing = sessionStorage.getItem(key) || ""; } catch (err) { existing = ""; }
    if (/^[A-Za-z0-9_-]{16,80}$/.test(existing)) return existing;
    var id = ("web" + Date.now().toString(36) + Math.random().toString(36).slice(2) + "eventquote").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
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

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus("");
    if (contactError) contactError.hidden = true;
    if (termsError) termsError.hidden = true;

    if (journey && journey.value === "return") {
      var returnPickup = field("returnPickupLocation");
      var returnDestination = field("returnDestination");
      var pickupField = field("pickup");
      var destinationField = field("destination");
      if (returnPickup && !returnPickup.value.trim() && destinationField) returnPickup.value = destinationField.value;
      if (returnDestination && !returnDestination.value.trim() && pickupField) returnDestination.value = pickupField.value;
    }
    var data = new FormData(form);
    var name = String(data.get("name") || "").trim();
    var email = String(data.get("email") || "").trim();
    var phone = String(data.get("phone") || "").trim();
    var agreed = form.querySelector("[name='termsAccepted']");
    if (name.length < 2) {
      setStatus("Please enter your full name.");
      return;
    }
    if (!validEmail(email)) {
      setStatus("Enter a valid email address, or leave it blank if you have given a phone number.");
      return;
    }
    if (!validPhone(phone)) {
      setStatus("Enter a phone number we can call, including the area code. Mobile numbers and landlines are both fine.");
      return;
    }
    if (!email && !phone) {
      if (contactError) contactError.hidden = false;
      var phoneField = field("phone");
      if (phoneField) phoneField.focus();
      return;
    }
    if (!selectedVehicle()) {
      setStatus("Please choose a Standard Car or an 8 Seater.");
      return;
    }
    var journeyDetails = window.spiresReadJourney ? window.spiresReadJourney(form) : null;
    if (journeyDetails && journeyDetails.error) {
      setStatus(journeyDetails.error);
      return;
    }
    if (journey && journey.value === "return") {
      var openReturn = journeyDetails && journeyDetails.openReturn;
      if (!data.get("returnDate") || (!openReturn && !data.get("returnTime")) || !String(data.get("returnPickupLocation") || "").trim() || !String(data.get("returnDestination") || "").trim()) {
        setStatus(openReturn ? "An open return needs the return date, pickup and destination." : "A return needs the date, the expected collection time, the return pickup and where you are going back to.");
        return;
      }
    }
    if (!agreed || !agreed.checked) {
      if (termsError) termsError.hidden = false;
      if (agreed) agreed.focus();
      return;
    }

    var button = form.querySelector("[type='submit']");
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
      vehicleType: selectedVehicle(),
      passengers: data.get("passengers"),
      luggage: data.get("luggage") || "0",
      paymentMethod: "undecided",
      message: data.get("message"),
      airportCollection: false,
      flightNumber: "",
      terminal: "",
      returnDate: data.get("returnDate") || "",
      returnTime: journeyDetails && journeyDetails.openReturn ? "" : (data.get("returnTime") || ""),
      stops: journeyDetails ? journeyDetails.stops : [],
      returnStops: journeyDetails ? journeyDetails.returnStops : [],
      openReturn: journeyDetails ? journeyDetails.openReturn : false,
      returnNoticeNote: journeyDetails ? journeyDetails.returnNoticeNote : "",
      returnPickupLocation: data.get("returnPickupLocation") || "",
      returnDestination: data.get("returnDestination") || "",
      returnAirportCollection: false,
      returnFlightNumber: "",
      termsAccepted: true,
      termsVersion: "2026-10-25",
      submissionId: submissionId(),
      _gotcha: data.get("_gotcha") || ""
    };

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body || {} }; });
      })
      .then(function (response) {
        if (!response.ok || !response.body.ok || !response.body.bookingNumber) {
          throw new Error(response.body.error || "We could not send the request. Please call " + officePhone + ".");
        }
        if (result) {
          result.hidden = false;
          result.innerHTML =
            "<div class=\"guest-success\"><h2>Your quote request has been received.</h2>" +
            "<p>Your reference is <strong>" + escapeHtml(response.body.bookingNumber) + "</strong>.</p>" +
            "<p>This is a request, not a confirmed booking. We will quote the journey, including the return collection if you asked for one. The vehicle is not held at the venue unless that is part of the accepted quote.</p></div>";
        }
        form.hidden = true;
      })
      .catch(function (err) {
        setStatus(err.message || "We could not send the request. Please call " + officePhone + ".");
        if (button) {
          button.disabled = false;
          button.textContent = "Request a quote";
        }
      });
  });
})();
