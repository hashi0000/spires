(function () {
  var form = document.getElementById("booking-form");
  if (!form || form.getAttribute("data-enquiry") === "business") return;

  var endpoint = "https://us-central1-spires-taxis.cloudfunctions.net/submitWebsiteQuote";
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

  function toggleAirport() {
    var outbound = airport && airport.checked;
    var inbound = returnAirport && returnAirport.checked && journey && journey.value === "return";
    show(flightFields, outbound);
    show(returnFlight, inbound);
    show(airportNote, outbound || inbound);
  }

  var dateField = document.getElementById("date");
  var returnDate = document.getElementById("return-date");
  if (dateField) dateField.min = today();
  if (returnDate) returnDate.min = today();
  if (journey) journey.addEventListener("change", function () { toggleJourney(); toggleAirport(); });
  if (airport) airport.addEventListener("change", toggleAirport);
  if (returnAirport) returnAirport.addEventListener("change", toggleAirport);
  Array.prototype.forEach.call(form.querySelectorAll("input[name='vehicleType']"), function (input) {
    input.addEventListener("change", syncPassengers);
  });
  toggleJourney();
  toggleAirport();
  syncPassengers();

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
    var reference = escapeHtml(body.bookingNumber);
    var parts = [
      "<div class=\"guest-success\">",
      "<h2>Your booking request has been received.</h2>",
      "<p>Your reference is <strong>" + reference + "</strong>.</p>",
      "<p>This is not a confirmed booking yet. We will review the journey and send a quote. The journey is confirmed only after that quote is accepted.</p>"
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

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
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
      setStatus("Enter a phone number we can call, including the area code. Mobile numbers and landlines are both fine.");
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
    if (!agreed || !agreed.checked) {
      if (termsError) termsError.hidden = false;
      if (agreed) agreed.focus();
      return;
    }

    var button = document.getElementById("booking-submit");
    if (button) {
      button.disabled = true;
      button.textContent = "Sending request...";
    }
    var payload = {
      name: name,
      email: email,
      phone: phone,
      pickup: data.get("pickup"),
      destination: data.get("destination"),
      date: data.get("date"),
      time: data.get("time"),
      bookingType: data.get("bookingType"),
      vehicleType: selectedVehicle(),
      passengers: data.get("passengers"),
      luggage: data.get("luggage"),
      paymentMethod: data.get("paymentMethod"),
      message: data.get("message"),
      airportCollection: airport && airport.checked,
      flightNumber: data.get("flightNumber") || "",
      terminal: data.get("terminal") || "",
      returnDate: data.get("returnDate") || "",
      returnTime: data.get("returnTime") || "",
      returnPickupLocation: data.get("returnPickupLocation") || "",
      returnDestination: data.get("returnDestination") || "",
      returnAirportCollection: returnAirport && returnAirport.checked,
      returnFlightNumber: data.get("returnFlightNumber") || "",
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
          throw new Error((response.body && response.body.error) || "We could not save your request.");
        }
        form.hidden = true;
        if (result) {
          result.hidden = false;
          result.innerHTML = successHtml(response.body);
          var another = document.getElementById("booking-another");
          if (another) {
            another.addEventListener("click", function () {
              try { sessionStorage.removeItem("spires-guest-submission"); } catch (err) { /* ignore */ }
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
        if (button) {
          button.disabled = false;
          button.textContent = "Send booking request";
        }
        setStatus((err && err.message) || ("We could not save your request. Your details are still on this page. Please try again, or call " + officePhone + "."));
      });
  }, true);
})();
