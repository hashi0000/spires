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

  function track(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }

  function londonKickoff(date, hm) {
    var utc = Date.parse(date + "T" + hm + ":00Z");
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).formatToParts(new Date(utc));
    var map = {};
    parts.forEach(function (part) { if (part.type !== "literal") map[part.type] = part.value; });
    var shown = map.year + "-" + map.month + "-" + map.day + "T" + map.hour + ":" + map.minute;
    return shown === date + "T" + hm ? utc : utc - 60 * 60 * 1000;
  }

  function isPast(fixture) {
    return londonKickoff(fixture.date, fixture.kickoff) <= Date.now();
  }

  function whatsappText() {
    var fixture = selectedFixture();
    var lines = ["Hello Spires Taxis, I would like to enquire about an Oxford to Twickenham rugby return transfer.", ""];
    if (fixture && !isPast(fixture)) {
      lines.push("Match: " + fixture.title);
      lines.push("Date: " + fixture.dayLabel + " 2026, kick off " + fixture.kickoff);
      if (attendanceValue() === "both") lines.push("Attending both matches that day.");
    }
    var postcode = field("tw-postcode");
    if (postcode) lines.push("Pickup postcode: " + postcode);
    var passengers = field("tw-passengers");
    if (passengers) lines.push("Passengers: " + passengers);
    var vehicle = vehicleLabel(selectedVehicle());
    if (vehicle) lines.push("Vehicle preference: " + vehicle);
    lines.push("", "Please confirm availability.");
    return lines.join("\n");
  }

  function syncWhatsapp() {
    var href = "https://wa.me/447776897772?text=" + encodeURIComponent(whatsappText());
    if (whatsapp) whatsapp.href = href;
    var barLink = document.getElementById("tw-whatsapp-bar");
    if (barLink) barLink.href = href;
  }

  function syncDateLine() {
    var line = document.getElementById("tw-journey-date");
    var fixture = selectedFixture();
    if (!line) return;
    line.textContent = fixture ? "Journey date: " + fixture.dayLabel + " 2026." : "Choose a match to fill the journey date.";
  }

  function markSelected(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".tw-fixture"), function (card) {
      var link = card.querySelector("[data-request]");
      var on = link && link.getAttribute("data-request") === id && !card.classList.contains("tw-fixture--past");
      card.classList.toggle("is-selected", on);
      if (link && !card.classList.contains("tw-fixture--past")) link.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function chooseFixture(id) {
    var fixture = byId(id);
    if (!fixtureField || !fixture || isPast(fixture)) return;
    fixtureField.value = id;
    markSelected(id);
    syncAttendance();
    syncDateLine();
    syncWhatsapp();
    track("twickenham_match_select", { fixture_id: id });
    var target = document.getElementById("request");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    var pickup = document.getElementById("tw-pickup");
    if (pickup) pickup.focus();
  }

  function markPastCards() {
    Array.prototype.forEach.call(document.querySelectorAll(".tw-fixture"), function (card) {
      if (card.classList.contains("tw-fixture--past")) return;
      var link = card.querySelector("[data-request]");
      if (!link) return;
      var fixture = byId(link.getAttribute("data-request"));
      if (!fixture || !isPast(fixture)) return;
      card.classList.add("tw-fixture--past");
      card.classList.remove("is-selected");
      card.removeAttribute("tabindex");
      var done = document.createElement("p");
      done.className = "tw-fixture__done";
      done.textContent = "This match has kicked off.";
      link.replaceWith(done);
      var option = fixtureField && fixtureField.querySelector('option[value="' + fixture.id + '"]');
      if (option) option.disabled = true;
      if (fixtureField && fixtureField.value === fixture.id) fixtureField.value = "";
    });
  }

  function paintCountdown() {
    markPastCards();
    var upcoming = null;
    for (var i = 0; i < fixtures.length; i += 1) {
      if (!isPast(fixtures[i])) { upcoming = fixtures[i]; break; }
    }
    var title = document.getElementById("tw-next-title");
    var detail = document.getElementById("tw-next-detail");
    var book = document.getElementById("tw-next-book");
    var days = document.getElementById("tw-count-days");
    var hours = document.getElementById("tw-count-hours");
    var minutes = document.getElementById("tw-count-minutes");
    if (!upcoming) {
      if (title) title.textContent = "November fixtures have kicked off";
      if (detail) detail.textContent = "The listed November 2026 matches are no longer open for a new request on this page.";
      if (book) book.hidden = true;
      return;
    }
    if (title) title.textContent = "Next England match at Twickenham";
    if (detail) detail.textContent = upcoming.title + ", " + upcoming.dayLabel + ", kick off " + upcoming.kickoff + ", London time.";
    if (book) {
      book.hidden = false;
      book.setAttribute("data-request", upcoming.id);
    }
    var remain = Math.max(0, londonKickoff(upcoming.date, upcoming.kickoff) - Date.now());
    var totalMinutes = Math.floor(remain / 60000);
    if (days) days.textContent = String(Math.floor(totalMinutes / 1440));
    if (hours) hours.textContent = String(Math.floor((totalMinutes % 1440) / 60));
    if (minutes) minutes.textContent = String(totalMinutes % 60);
  }

  Array.prototype.forEach.call(document.querySelectorAll(".tw-fixture"), function (card) {
    var link = card.querySelector("[data-request]");
    if (!link) return;
    card.tabIndex = 0;
    function open(event) {
      if (card.classList.contains("tw-fixture--past")) return;
      event.preventDefault();
      chooseFixture(link.getAttribute("data-request"));
    }
    card.addEventListener("click", open);
    card.addEventListener("keydown", function (event) {
      if (event.target !== card) return;
      if (event.key === "Enter" || event.key === " ") open(event);
    });
  });

  var nextBook = document.getElementById("tw-next-book");
  if (nextBook) {
    nextBook.addEventListener("click", function (event) {
      var id = nextBook.getAttribute("data-request");
      if (!id) return;
      event.preventDefault();
      chooseFixture(id);
    });
  }
  paintCountdown();
  setInterval(paintCountdown, 30000);
  document.addEventListener("visibilitychange", paintCountdown);

  document.addEventListener("click", function (event) {
    var tracked = event.target.closest ? event.target.closest("[data-track]") : null;
    if (!tracked) return;
    track("twickenham_" + tracked.getAttribute("data-track"), { link_text: (tracked.textContent || "").trim() });
  });

  var formStarted = false;
  form.addEventListener("focusin", function () {
    if (formStarted) return;
    formStarted = true;
    track("twickenham_form_start");
  });

  var requestSection = document.getElementById("request");
  var mobileBar = document.querySelector(".tw-mobile-cta");
  if (requestSection && mobileBar && "IntersectionObserver" in window) {
    var watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { mobileBar.hidden = entry.isIntersecting; });
    }, { threshold: 0 });
    watcher.observe(requestSection);
  }

  if (fixtureField) fixtureField.addEventListener("change", function () {
    var fixture = selectedFixture();
    if (fixture && isPast(fixture)) {
      fixtureField.value = "";
      setStatus("That match has already kicked off. Choose a later fixture.");
      return;
    }
    markSelected(fixtureField.value);
    syncAttendance();
    syncDateLine();
    syncWhatsapp();
    if (fixture) track("twickenham_match_select", { fixture_id: fixture.id });
  });
  Array.prototype.forEach.call(form.querySelectorAll("input, select, textarea"), function (input) {
    input.addEventListener("input", function () { syncPassengers(); syncWhatsapp(); });
    input.addEventListener("change", function () { syncPassengers(); syncWhatsapp(); });
  });
  syncAttendance();
  syncPassengers();
  syncDateLine();
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

    if (!fixture || isPast(fixture)) {
      setStatus("Choose a match that has not kicked off yet.");
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
        track("twickenham_quote_success", { contact_by: response.body.contactBy || "" });
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
