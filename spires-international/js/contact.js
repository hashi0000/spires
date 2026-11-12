(function () {
  var form = document.querySelector("#contact-form");
  if (!form || !window.SpiresInternational) return;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (form.elements._gotcha.value) return;
    var errors = [];
    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    var message = form.elements.message.value.trim();
    if (name.length < 2) errors.push("Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter an email address.");
    if (message.length < 10) errors.push("Enter a message.");
    var node = document.querySelector("#contact-errors");
    var done = document.querySelector("#contact-done");
    if (errors.length) {
      node.hidden = false;
      node.innerHTML = errors.map(function (item) { return "<p>" + item + "</p>"; }).join("");
      done.hidden = true;
      return;
    }
    node.hidden = true;
    var reference = "SI-CONTACT-" + Date.now().toString().slice(-8);
    var sent = [];
    var consent = "denied";
    try { sent = JSON.parse(sessionStorage.getItem("spires_international_events") || "[]"); } catch (e) { sent = []; }
    try { consent = localStorage.getItem("spires_international_consent") || "denied"; } catch (e) { consent = "denied"; }
    var outcome = window.SpiresInternational.measurementEvent({
      consent: consent,
      measurementId: (document.querySelector('meta[name="spires-ga4"]') || {}).content || "",
      name: "generate_lead",
      dedupeKey: reference,
      alreadySent: sent,
      params: { lead_type: "contact" },
    });
    if (outcome.sent) {
      sent.push("generate_lead:" + reference);
      try { sessionStorage.setItem("spires_international_events", JSON.stringify(sent)); } catch (e) {}
    }
    done.hidden = false;
    done.innerHTML = "<h2>Message noted</h2><p>Reference <strong>" + reference + "</strong>. This preview keeps it in this browser and does not email the office. Call 07776 897772 or WhatsApp us if you need a reply now.</p>";
    form.reset();
  });
})();
