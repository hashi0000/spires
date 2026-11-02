(function () {
  var fixtures = window.SPIRES_TWICKENHAM_FIXTURES || [];
  var form = document.getElementById("twickenham-form");
  if (!form || !fixtures.length) return;

  var endpoint = "https://us-central1-spires-taxis.cloudfunctions.net/submitWebsiteQuote";
  var officePhone = "07776 897772";
  var contactMessage = "Please provide a phone number or email address so we can respond to your request. You can also call us on " + officePhone + ".";
  var destination = "Allianz Stadium, Twickenham";
  var fixtureField = document.getElementById("tw-fixture");
  var attendance = document.getElementById("tw-attendance");
  var status = document.getElementById("tw-status");
  var contactError = document.getElementById("tw-contact-error");
  var termsError = document.getElementById("tw-terms-error");
  var result = document.getElementById("tw-result");
  var whatsapp = document.getElementById("tw-whatsapp");
  var submitButton = document.getElementById("tw-submit");

  function byId(id) {
    for (var i = 0; i < fixtures.length; i += 1) {
      if (fixtures[i].id === id) return fixtures[i];
    }
    return null;
  }

  function sameDay(fixture) {
    return fixtures.filter(function (item) { return item.date === fixture.date; });
  }

  function selectedFixture() {
    return byId(fixtureField ? fixtureField.value : "");
  }

  function field(id) {
    var node = document.getElementById(id);
    return node ? String(node.value || "").trim() : "";
  }

  function selectedVehicle() {
    var chosen = form.querySelector("input[name='vehicleType']:checked");
    return chosen ? chosen.value : "";
  }

  function vehicleLabel(value) {
    return value === "8_seater" ? "8 Seater" : value === "standard" ? "Standard Car" : "";
  }

  function attendanceValue() {
    if (!attendance || attendance.hidden) return "one";
    var chosen = form.querySelector("input[name='attendance']:checked");
    return chosen ? chosen.value : "one";
  }

  function validEmail(value) {
    return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validPhone(value) {
    if (!value) return true;
    return /^\+?[0-9]{8,15}$/.test(value.replace(/[\s().-]/g, ""));
  }

  function validTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function setStatus(message) {
    if (!status) return;
    status.hidden = !message;
    status.textContent = message || "";
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
    });
  }

  function submissionId() {
    var key = "spires-twickenham-submission";
    var existing = "";
    try { existing = sessionStorage.getItem(key) || ""; } catch (err) { existing = ""; }
    if (/^[A-Za-z0-9_-]{16,80}$/.test(existing)) return existing;
    var id = ("tw" + Date.now().toString(36) + Math.random().toString(36).slice(2) + "rugbyrequest").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    try { sessionStorage.setItem(key, id); } catch (err) { /* the request can still be sent */ }
    return id;
  }

  function syncAttendance() {
    var fixture = selectedFixture();
    var show = fixture && sameDay(fixture).length > 1;
    if (attendance) attendance.hidden = !show;
  }

  function syncPassengers() {
    var passengers = document.getElementById("tw-passengers");
    if (!passengers) return;
    var max = selectedVehicle() === "8_seater" ? 8 : 4;
    passengers.max = String(max);
    if (Number(passengers.value) > max) passengers.value = String(max);
  }

  function whatsappText() {
    var fixture = selectedFixture();
    var lines = ["Hi, I would like an Oxford to Twickenham rugby taxi."];
    if (fixture) {
      lines.push(fixture.title + ", " + fixture.dayLabel + ", kick off " + fixture.kickoff + ".");
      if (attendanceValue() === "both") lines.push("I want to attend both matches that day.");
    }
    var vehicle = vehicleLabel(selectedVehicle());
    if (vehicle) lines.push("Vehicle: " + vehicle + ".");
    var passengers = field("tw-passengers");
    if (passengers) lines.push("Passengers: " + passengers + ".");
    var pickup = [field("tw-pickup"), field("tw-postcode")].filter(Boolean).join(", ");
    if (pickup) lines.push("Pickup: " + pickup + ".");
    if (field("tw-arrival")) lines.push("Preferred arrival: " + field("tw-arrival") + ".");
    if (field("tw-collect")) lines.push("Preferred collection: " + field("tw-collect") + ".");
    if (field("tw-return")) lines.push("Preferred return: " + field("tw-return") + ".");
    return lines.join(" ");
  }

  function syncWhatsapp() {
    if (!whatsapp) return;
    whatsapp.href = "https://wa.me/447776897772?text=" + encodeURIComponent(whatsappText());
  }

  function chooseFixture(id) {
    if (!fixtureField || !byId(id)) return;
    fixtureField.value = id;
    syncAttendance();
    syncWhatsapp();
    var target = document.getElementById("request");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    var pickup = document.getElementById("tw-pickup");
    if (pickup) pickup.focus();
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-request]"), function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      chooseFixture(link.getAttribute("data-request"));
    });
  });

  if (fixtureField) fixtureField.addEventListener("change", function () { syncAttendance(); syncWhatsapp(); });
  Array.prototype.forEach.call(form.querySelectorAll("input, select, textarea"), function (input) {
    input.addEventListener("input", function () { syncPassengers(); syncWhatsapp(); });
    input.addEventListener("change", function () { syncPassengers(); syncWhatsapp(); });
  });
  syncAttendance();
  syncPassengers();
  syncWhatsapp();

  function successHtml(body) {
    var parts = [
      "<div class=\"guest-success\">",
      "<h2>Your booking request has been received.</h2>",
      "<p>Your reference is <strong>" + escapeHtml(body.bookingNumber) + "</strong>.</p>",
      "<p>This is a request, not a confirmed booking. We will check availability and the itinerary, then send a quote. The journey is confirmed only after that quote is accepted.</p>"
    ];
    if (body.contactBy === "phone") {
      parts.push("<p>Our team will contact you on the phone number you gave us. We do not send a text message for this request.</p>");
    } else if (body.duplicate && !body.claimUrl) {
      parts.push("<p>This request was already received. You do not need to send it again.</p>");
    } else if (!body.emailSent) {
      parts.push("<p>We have saved the request. If you do not see an email, you do not need to send the form again. Call " + officePhone + " and quote your reference.</p>");
    } else {
      parts.push("<p>We have emailed this reference to you.</p>");
    }
    if (body.claimUrl) {
      parts.push("<p>Create an account to track and manage your bookings. This is optional, and your request is already saved.</p>");
      parts.push("<p><a class=\"btn btn--primary\" href=\"" + escapeHtml(body.claimUrl) + "\">Create an account</a></p>");
    }
    parts.push("</div>");
    return parts.join("");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus("");
    if (contactError) contactError.hidden = true;
    if (termsError) termsError.hidden = true;

    var fixture = selectedFixture();
    var name = field("tw-name");
    var email = field("tw-email");
    var phone = field("tw-phone");
    var pickup = field("tw-pickup");
    var postcode = field("tw-postcode");
    var collect = field("tw-collect");
    var arrival = field("tw-arrival");
    var back = field("tw-return");
    var vehicle = selectedVehicle();
    var passengers = field("tw-passengers");
    var luggage = field("tw-luggage") || "0";
    var agreed = form.querySelector("[name='termsAccepted']");

    if (!fixture) {
      setStatus("Choose the match you are going to.");
      if (fixtureField) fixtureField.focus();
      return;
    }
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
      if (contactError) {
        contactError.hidden = false;
        contactError.textContent = contactMessage;
      }
      var phoneField = document.getElementById("tw-phone");
      if (phoneField) phoneField.focus();
      return;
    }
    if (pickup.length < 3 || postcode.length < 3) {
      setStatus("Enter the pickup address and postcode.");
      return;
    }
    if (!vehicle) {
      setStatus("Please choose a Standard Car or an 8 Seater.");
      return;
    }
    var max = vehicle === "8_seater" ? 8 : 4;
    var count = Number(passengers);
    if (!Number.isInteger(count) || count < 1 || count > max) {
      setStatus(vehicle === "8_seater" ? "An 8 Seater can take up to 8 passengers." : "A Standard Car can take up to 4 passengers. Please choose the 8 Seater for larger groups.");
      return;
    }
    if (!validTime(collect) || !validTime(arrival) || !validTime(back)) {
      setStatus("Enter the collection time, the arrival time and the return time.");
      return;
    }
    if (arrival <= collect) {
      setStatus("The arrival time needs to be later than the collection time.");
      return;
    }
    if (back < collect) {
      setStatus("The return needs to be at the same time as the collection, or later.");
      return;
    }
    var bags = Number(luggage);
    if (!Number.isInteger(bags) || bags < 0 || bags > 10) {
      setStatus("Enter the number of luggage pieces, from 0 to 10.");
      return;
    }
    if (!agreed || !agreed.checked) {
      if (termsError) termsError.hidden = false;
      agreed.focus();
      return;
    }

    var both = attendanceValue() === "both";
    var dayList = sameDay(fixture).map(function (item) {
      return item.title + " at " + item.kickoff;
    }).join("; ");
    var notes = [
      "Oxford to Twickenham rugby request.",
      "Fixture: " + fixture.title + (fixture.grandFinal ? " (Grand Final)." : "."),
      "Date: " + fixture.dayLabel + ". Kick off: " + fixture.kickoff + " London time.",
      both ? "Attending both matches that day: " + dayList + "." : "Attending this match only.",
      "Preferred arrival at the stadium: " + arrival + ".",
      "Preferred collection from Oxford: " + collect + ".",
      "Preferred return collection: " + back + ".",
      "Published return fare requested: " + vehicleLabel(vehicle) + " (" + (vehicle === "8_seater" ? "£295" : "£230") + "), subject to availability and an agreed itinerary.",
      "The vehicle is not reserved between the journeys unless that is arranged separately.",
      field("tw-notes")
    ].filter(Boolean).join(" ");

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending request...";
    }

    var payload = {
      name: name,
      email: email,
      phone: phone,
      pickup: pickup + ", " + postcode,
      destination: destination,
      date: fixture.date,
      time: collect,
      bookingType: "return",
      vehicleType: vehicle,
      passengers: String(count),
      luggage: String(bags),
      paymentMethod: "undecided",
      message: notes,
      returnDate: fixture.date,
      returnTime: back,
      returnPickupLocation: destination,
      returnDestination: pickup + ", " + postcode,
      termsAccepted: true,
      termsVersion: "2026-10-25",
      submissionId: submissionId(),
      _gotcha: field("tw-gotcha")
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
        }
      })
      .catch(function (err) {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Send booking request";
        }
        setStatus((err && err.message) || ("We could not save your request. Your details are still on this page. Please try again, or call " + officePhone + "."));
      });
  }, true);
})();
