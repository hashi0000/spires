(function () {
  var form = document.getElementById("booking-form");
  if (!form) return;
  var journey = document.getElementById("journey");
  var returnFields = document.getElementById("return-fields");
  function toggleReturn() {
    if (!returnFields) return;
    var isReturn = journey && journey.value === "return";
    returnFields.hidden = !isReturn;
  }
  if (journey) journey.addEventListener("change", toggleReturn);
  toggleReturn();

  var agreedBox = form.querySelector("[name='termsAccepted']");
  var termsError = document.getElementById("terms-agreement-error");
  if (agreedBox) {
    agreedBox.addEventListener("invalid", function (event) {
      event.preventDefault();
      if (termsError) termsError.hidden = false;
    });
    agreedBox.addEventListener("change", function () {
      if (agreedBox.checked && termsError) termsError.hidden = true;
    });
  }

  form.addEventListener("submit", function (event) {
    var agreed = form.querySelector("[name='termsAccepted']");
    var termsError = document.getElementById("terms-agreement-error");
    if (!agreed || !agreed.checked) {
      event.preventDefault();
      if (termsError) termsError.hidden = false;
      if (agreed) agreed.focus();
      return;
    }
    if (termsError) termsError.hidden = true;
    event.preventDefault();
    var data = new FormData(form);
    var payload = {
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone"),
      service: data.get("service"),
      pickup: data.get("pickup"),
      destination: data.get("destination"),
      date: data.get("date"),
      time: data.get("time"),
      bookingType: data.get("bookingType"),
      vehicleType: data.get("vehicleType"),
      passengers: data.get("passengers"),
      message: data.get("message"),
      termsAccepted: true,
      termsVersion: "2026-10-25",
      returnDateTime: data.get("bookingType") === "return" && data.get("returnDate")
        ? String(data.get("returnDate")) + "T" + String(data.get("returnTime") || "00:00")
        : "",
      returnPickupLocation: data.get("returnPickupLocation") || "",
      returnDestination: data.get("returnDestination") || "",
      _gotcha: data.get("_gotcha") || "",
    };
    var button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    fetch("https://us-central1-spires-taxis.cloudfunctions.net/submitWebsiteQuote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.body.ok) {
          throw new Error((result.body && result.body.error) || "We could not save your quote request.");
        }
        window.location.href = "/thank-you";
      })
      .catch(function (err) {
        if (button) button.disabled = false;
        window.alert(err.message || "We could not save your quote request. Please call or WhatsApp us.");
      });
  });
})();
