(function () {
  var form = document.getElementById("business-account-form");
  if (!form) return;
  var status = document.getElementById("business-enquiry-status");
  var success = document.getElementById("business-enquiry-success");
  var button = form.querySelector("button[type='submit']");
  var label = button ? button.textContent : "Send enquiry";

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (status) status.hidden = true;
    if (!form.reportValidity()) return;

    var data = new FormData(form);
    var payload = {
      organisation: data.get("organisation"),
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone"),
      organisationType: data.get("organisationType") || "",
      travelNeeds: data.get("travelNeeds"),
      message: data.get("message") || "",
      _gotcha: data.get("_gotcha") || "",
    };
    if (button) {
      button.disabled = true;
      button.textContent = "Sending";
    }

    fetch("https://us-central1-spires-taxis.cloudfunctions.net/submitBusinessAccountEnquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(
          function (body) { return { ok: res.ok, body: body }; },
          function () { return { ok: false, body: {} }; }
        );
      })
      .then(function (result) {
        if (!result.ok || !result.body || result.body.ok !== true) {
          throw new Error((result.body && result.body.error) || "We could not send your enquiry. Please call or WhatsApp us.");
        }
        form.hidden = true;
        if (success) success.hidden = false;
      })
      .catch(function (err) {
        if (button) {
          button.disabled = false;
          button.textContent = label;
        }
        if (status) {
          status.hidden = false;
          status.textContent = err.message || "We could not send your enquiry. Please call or WhatsApp us.";
        }
      });
  });
})();
