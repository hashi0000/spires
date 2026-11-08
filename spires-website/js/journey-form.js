(function () {
  var NOTICE = "For a return pickup in Oxford, please give your driver at least 30 minutes' notice. For pickups outside Oxford, contact us to confirm the notice needed.";

  function field(form, name) {
    return form.querySelector("[name='" + name + "']");
  }

  function stopRow(stop, onChange) {
    var row = document.createElement("div");
    row.className = "form-field";
    var kind = document.createElement("select");
    kind.innerHTML = "<option value='pickup'>Pickup</option><option value='dropoff'>Drop off</option>";
    kind.value = stop.type === "pickup" ? "pickup" : "dropoff";
    var address = document.createElement("input");
    address.type = "text";
    address.name = "stopAddress";
    address.placeholder = "Stop address";
    address.value = stop.address || "";
    var notes = document.createElement("input");
    notes.type = "text";
    notes.placeholder = "Note, optional";
    notes.value = stop.notes || "";
    var up = document.createElement("button");
    up.type = "button";
    up.textContent = "Move up";
    var down = document.createElement("button");
    down.type = "button";
    down.textContent = "Move down";
    var remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    function current() {
      return { id: stop.id, type: kind.value, address: address.value, notes: notes.value };
    }
    kind.addEventListener("change", function () { onChange("edit", current()); });
    address.addEventListener("input", function () { onChange("edit", current()); });
    notes.addEventListener("input", function () { onChange("edit", current()); });
    up.addEventListener("click", function () { onChange("up", current()); });
    down.addEventListener("click", function () { onChange("down", current()); });
    remove.addEventListener("click", function () { onChange("remove", current()); });
    row.appendChild(kind);
    row.appendChild(address);
    row.appendChild(notes);
    row.appendChild(up);
    row.appendChild(down);
    row.appendChild(remove);
    if (window.spiresAttachLocation) window.spiresAttachLocation(address);
    return row;
  }

  function mountStops(form, anchorName, key) {
    var anchor = field(form, anchorName);
    if (!anchor || !anchor.parentNode || !anchor.parentNode.parentNode) return;
    var box = document.createElement("div");
    box.className = "extra-stops";
    var list = document.createElement("div");
    var add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn--outline";
    add.textContent = "Add a stop";
    var summary = document.createElement("p");
    summary.className = "form-help";
    form[key] = form[key] || [];
    function paint() {
      list.innerHTML = "";
      form[key].forEach(function (stop, index) {
        list.appendChild(stopRow(stop, function (action, value) {
          var rows = form[key].slice();
          if (action === "edit") rows[index] = value;
          if (action === "remove") rows.splice(index, 1);
          if (action === "up" && index > 0) rows.splice(index - 1, 0, rows.splice(index, 1)[0]);
          if (action === "down" && index < rows.length - 1) rows.splice(index + 1, 0, rows.splice(index, 1)[0]);
          form[key] = rows;
          paint();
        }));
      });
      var start = field(form, anchorName === "destination" ? "pickup" : "returnPickupLocation");
      var end = field(form, anchorName);
      var all = [{ type: "pickup", address: start ? start.value : "" }].concat(form[key]).concat([{ type: "dropoff", address: end ? end.value : "" }]);
      summary.textContent = all.filter(function (stop) { return String(stop.address || "").trim(); }).map(function (stop, index) {
        return (index + 1) + ". " + (stop.type === "pickup" ? "Pickup" : "Drop off") + ": " + stop.address + (stop.notes ? " (" + stop.notes + ")" : "");
      }).join("; ");
    }
    add.addEventListener("click", function () {
      form[key].push({ id: "stop-" + Date.now(), type: "dropoff", address: "", notes: "" });
      paint();
    });
    ["pickup", "destination", "returnPickupLocation", "returnDestination"].forEach(function (name) {
      var input = field(form, name);
      if (input) input.addEventListener("input", paint);
    });
    box.appendChild(list);
    box.appendChild(add);
    box.appendChild(summary);
    anchor.parentNode.parentNode.insertBefore(box, anchor.parentNode.nextSibling);
    paint();
  }

  function mountOpenReturn(form) {
    var time = field(form, "returnTime");
    if (!time || !time.parentNode || !time.parentNode.parentNode) return;
    var choice = document.createElement("div");
    choice.className = "form-field";
    choice.innerHTML = "<label><input type='radio' name='returnTimeChoice' value='set' checked> Set return pickup time</label> <label><input type='radio' name='returnTimeChoice' value='open'> Return time to be confirmed</label>";
    var notice = document.createElement("p");
    notice.className = "form-help";
    notice.hidden = true;
    notice.textContent = NOTICE;
    var note = document.createElement("input");
    note.type = "text";
    note.name = "returnNoticeNote";
    note.placeholder = "Customer will contact the driver when ready";
    note.hidden = true;
    time.parentNode.parentNode.parentNode.insertBefore(choice, time.parentNode.parentNode);
    time.parentNode.parentNode.parentNode.insertBefore(notice, time.parentNode.parentNode.nextSibling);
    time.parentNode.parentNode.parentNode.insertBefore(note, notice.nextSibling);
    choice.addEventListener("change", function () {
      var open = choice.querySelector("input[value='open']").checked;
      form._openReturn = open;
      time.disabled = open;
      if (open) time.value = "";
      notice.hidden = !open;
      note.hidden = !open;
    });
  }

  function read(form) {
    function full(startName, endName, middle) {
      var start = field(form, startName);
      var end = field(form, endName);
      var stops = [{ id: "start", type: "pickup", address: start ? start.value.trim() : "", notes: "", place: null }]
        .concat((middle || []).map(function (stop) {
          return { id: stop.id, type: stop.type === "pickup" ? "pickup" : "dropoff", address: String(stop.address || "").trim(), notes: String(stop.notes || "").trim(), place: null };
        }))
        .concat([{ id: "end", type: "dropoff", address: end ? end.value.trim() : "", notes: "", place: null }]);
      if (stops.some(function (stop) { return !stop.address; })) return { error: "Every stop needs a full address." };
      if (stops[0].type !== "pickup" || stops[stops.length - 1].type !== "dropoff") return { error: "The journey needs to start with a pickup and end with a drop off." };
      return { stops: stops };
    }
    var outbound = full("pickup", "destination", form._stops || []);
    if (outbound.error) return outbound;
    var bookingType = field(form, "bookingType");
    var isReturn = bookingType && bookingType.value === "return";
    var returning = isReturn ? full("returnPickupLocation", "returnDestination", form._returnStops || []) : { stops: [] };
    if (returning.error) return { error: "Return: " + returning.error };
    var open = isReturn && form._openReturn === true;
    var returnTime = field(form, "returnTime");
    var returnDate = field(form, "returnDate");
    if (isReturn && !open && returnTime && !returnTime.value) return { error: "Enter the return pickup time, or choose return time to be confirmed." };
    if (isReturn && open && returnDate && !returnDate.value) return { error: "Return bookings need a return date." };
    var note = field(form, "returnNoticeNote");
    return {
      stops: outbound.stops,
      returnStops: returning.stops,
      openReturn: open,
      returnNoticeNote: note ? note.value.trim() : "",
    };
  }

  function start() {
    document.querySelectorAll("form").forEach(function (form) {
      if (!field(form, "pickup") || !field(form, "destination") || form.dataset.stopsReady) return;
      form.dataset.stopsReady = "1";
      form._stops = [];
      form._returnStops = [];
      mountStops(form, "destination", "_stops");
      if (field(form, "returnDestination")) mountStops(form, "returnDestination", "_returnStops");
      if (field(form, "returnTime")) mountOpenReturn(form);
    });
  }

  window.spiresReadJourney = read;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
