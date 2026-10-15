(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyAJIrqyzPbl72e_4aGyCe2cXX1lX949T-4",
    authDomain: "spires-taxis.firebaseapp.com",
    projectId: "spires-taxis",
    storageBucket: "spires-taxis.firebasestorage.app",
    messagingSenderId: "12158743704",
    appId: "1:12158743704:web:402ace8b3430906bf28ced",
  };
  const DRAFT_KEY = "spires_office_jobs_draft";
  const VEHICLES = [
    { value: "standard", label: "Standard car" },
    { value: "8_seater", label: "Mercedes Vito" },
    { value: "multiple", label: "Multiple vehicles" },
  ];

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const unlock = firebase.app().functions("us-central1").httpsCallable("unlockFamilyJobs");

  const pinScreen = document.getElementById("pin-screen");
  const appScreen = document.getElementById("app-screen");
  const pinForm = document.getElementById("pin-form");
  const pinInput = document.getElementById("pin-input");
  const pinError = document.getElementById("pin-error");
  const pinSubmit = document.getElementById("pin-submit");
  const jobList = document.getElementById("job-list");
  const emptyEl = document.getElementById("app-empty");
  const errorEl = document.getElementById("app-error");
  const statusEl = document.getElementById("app-status");
  const sheet = document.getElementById("sheet");
  const sheetCard = document.getElementById("sheet-card");

  let bookings = [];
  let view = "today";
  let unsub = null;
  let editingId = null;

  function show(el, on) {
    el.hidden = !on;
  }

  function setError(target, message) {
    target.textContent = message || "";
    show(target, Boolean(message));
  }

  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function pickupDate(booking) {
    return toDate(booking.pickupTime || booking.dateTime);
  }

  function textOf(booking, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const value = booking[keys[i]];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function isCancelled(booking) {
    return booking.status === "cancelled" || booking.customerStatus === "cancelled";
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function inView(booking, now) {
    const pickup = pickupDate(booking);
    if (!pickup) return view === "all";
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    if (view === "today") return pickup >= today && pickup < tomorrow;
    if (view === "tomorrow") return pickup >= tomorrow && pickup < addDays(tomorrow, 1);
    return true;
  }

  function vehicleLabel(type) {
    const match = VEHICLES.find((row) => row.value === type || (type === "8-seater" && row.value === "8_seater"));
    return match ? match.label : "Standard car";
  }

  function formatWhen(booking) {
    const pickup = pickupDate(booking);
    if (!pickup) return "Time TBC";
    return pickup.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function digits(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  function telHref(phone) {
    const value = String(phone || "").replace(/[^\d+]/g, "");
    return value ? "tel:" + value : "";
  }

  function whatsappHref(phone, message) {
    const raw = digits(phone);
    if (!raw) return "";
    const intl = raw.startsWith("0") ? "44" + raw.slice(1) : raw;
    return "https://wa.me/" + intl + (message ? "?text=" + encodeURIComponent(message) : "");
  }

  function ymd(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function hm(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function fromDateAndTime(date, time) {
    const parsed = new Date(date + "T" + time);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  function bookingNumber() {
    return "SP" + String(Date.now()).slice(-6);
  }

  function visibleJobs() {
    const now = new Date();
    return bookings
      .filter((row) => !isCancelled(row) && inView(row, now))
      .sort((a, b) => {
        const aTime = pickupDate(a)?.getTime() || 0;
        const bTime = pickupDate(b)?.getTime() || 0;
        return aTime - bTime;
      });
  }

  function renderList() {
    const rows = visibleJobs();
    jobList.innerHTML = "";
    show(emptyEl, rows.length === 0);
    rows.forEach((booking) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "job-card";
      button.innerHTML =
        '<div class="job-when">' +
        formatWhen(booking) +
        "</div>" +
        '<div class="job-route">' +
        escapeHtml(textOf(booking, ["pickupLocation", "pickup"])) +
        " to " +
        escapeHtml(textOf(booking, ["destination"])) +
        "</div>" +
        '<div class="job-meta">' +
        escapeHtml(textOf(booking, ["hirerName", "name"])) +
        " · " +
        escapeHtml(vehicleLabel(booking.vehicleType)) +
        "</div>";
      button.addEventListener("click", () => openDetail(booking));
      item.appendChild(button);
      jobList.appendChild(item);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadDraft() {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null") || {};
    } catch {
      return {};
    }
  }

  function saveDraft(draft) {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function emptyDraft() {
    const now = new Date();
    return {
      pickupDate: ymd(now),
      pickupTime: hm(now),
      pickupLocation: "",
      destination: "",
      hirerName: "",
      hirerPhone: "",
      vehicleType: "standard",
    };
  }

  function draftFromBooking(booking) {
    const pickup = pickupDate(booking) || new Date();
    const type = booking.vehicleType === "8-seater" || booking.vehicleType === "8_seater"
      ? "8_seater"
      : booking.vehicleType === "multiple"
        ? "multiple"
        : "standard";
    return {
      pickupDate: ymd(pickup),
      pickupTime: hm(pickup),
      pickupLocation: textOf(booking, ["pickupLocation", "pickup"]),
      destination: textOf(booking, ["destination"]),
      hirerName: textOf(booking, ["hirerName", "name"]),
      hirerPhone: textOf(booking, ["hirerPhone", "phone"]),
      vehicleType: type,
    };
  }

  function closeSheet() {
    show(sheet, false);
    sheetCard.innerHTML = "";
    editingId = null;
  }

  function openDetail(booking) {
    const phone = textOf(booking, ["hirerPhone", "phone"]);
    const call = telHref(phone);
    const wa = whatsappHref(phone, "Spires Taxis job " + (booking.bookingNumber || ""));
    sheetCard.innerHTML =
      "<h2>" +
      escapeHtml(formatWhen(booking)) +
      "</h2>" +
      '<p class="job-route">' +
      escapeHtml(textOf(booking, ["pickupLocation", "pickup"])) +
      " to " +
      escapeHtml(textOf(booking, ["destination"])) +
      "</p>" +
      "<p>" +
      escapeHtml(textOf(booking, ["hirerName", "name"])) +
      "</p>" +
      "<p>" +
      escapeHtml(vehicleLabel(booking.vehicleType)) +
      "</p>" +
      '<div class="actions">' +
      (call ? '<a class="btn btn-primary" href="' + call + '">Call</a>' : "") +
      (wa ? '<a class="btn" href="' + wa + '" target="_blank" rel="noreferrer">WhatsApp</a>' : "") +
      '<button type="button" class="btn" id="edit-job">Edit</button>' +
      '<button type="button" class="btn btn-danger" id="cancel-job">Cancel job</button>' +
      '<button type="button" class="btn" id="close-detail">Close</button>' +
      "</div>" +
      '<p id="detail-error" class="error" hidden></p>';
    show(sheet, true);
    document.getElementById("close-detail").onclick = closeSheet;
    document.getElementById("edit-job").onclick = () => openForm(booking);
    document.getElementById("cancel-job").onclick = () => confirmCancel(booking);
  }

  function confirmCancel(booking) {
    sheetCard.innerHTML =
      "<h2>Cancel this job?</h2>" +
      "<p>It stays on the record and disappears from the live list for everyone.</p>" +
      '<div class="actions">' +
      '<button type="button" class="btn btn-danger" id="confirm-cancel">Confirm cancel</button>' +
      '<button type="button" class="btn" id="keep-job">Keep job</button>' +
      "</div>" +
      '<p id="detail-error" class="error" hidden></p>';
    document.getElementById("keep-job").onclick = () => openDetail(booking);
    document.getElementById("confirm-cancel").onclick = async () => {
      try {
        const payload = {
          status: "cancelled",
          cancelledAt: new Date().toISOString(),
          cancelledByUid: auth.currentUser && auth.currentUser.uid,
          updatedByUid: auth.currentUser && auth.currentUser.uid,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        if (booking.uid) payload.customerStatus = "cancelled";
        await db.collection("bookings").doc(booking.id).update(payload);
        setError(statusEl, "");
        statusEl.textContent = "Job cancelled.";
        show(statusEl, true);
        closeSheet();
      } catch (err) {
        setError(document.getElementById("detail-error"), err.message || "Could not cancel.");
      }
    };
  }

  function openForm(booking) {
    const draft = booking ? draftFromBooking(booking) : Object.assign(emptyDraft(), loadDraft());
    editingId = booking ? booking.id : null;
    const places = Array.from(
      new Set(
        bookings
          .flatMap((row) => [textOf(row, ["pickupLocation", "pickup"]), textOf(row, ["destination"])])
          .filter(Boolean)
      )
    ).slice(0, 40);
    sheetCard.innerHTML =
      "<h2>" +
      (booking ? "Edit job" : "Add job") +
      "</h2>" +
      '<form id="job-form">' +
      '<div class="row"><label>Pickup date<input type="date" name="pickupDate" required value="' +
      draft.pickupDate +
      '"></label>' +
      '<label>Pickup time<input type="time" name="pickupTime" required value="' +
      draft.pickupTime +
      '"></label></div>' +
      '<label>Pickup location<input name="pickupLocation" list="job-places" required value="' +
      escapeHtml(draft.pickupLocation) +
      '" autocomplete="street-address"></label>' +
      '<label>Drop off location<input name="destination" list="job-places" required value="' +
      escapeHtml(draft.destination) +
      '" autocomplete="street-address"></label>' +
      '<label>Customer name<input name="hirerName" required value="' +
      escapeHtml(draft.hirerName) +
      '" autocomplete="name"></label>' +
      '<label>Contact number<input name="hirerPhone" type="tel" inputmode="tel" required value="' +
      escapeHtml(draft.hirerPhone) +
      '" autocomplete="tel"></label>' +
      '<fieldset class="vehicle"><legend>Vehicle</legend>' +
      VEHICLES.map(
        (row) =>
          '<label><input type="radio" name="vehicleType" value="' +
          row.value +
          '"' +
          (draft.vehicleType === row.value ? " checked" : "") +
          "> " +
          row.label +
          "</label>"
      ).join("") +
      "</fieldset>" +
      '<p id="form-error" class="error" hidden></p>' +
      '<button type="submit" class="btn btn-primary">' +
      (booking ? "Save changes" : "Add job") +
      "</button>" +
      '<button type="button" class="btn" id="close-form" style="width:100%;margin-top:0.5rem">Close</button>' +
      '<p class="muted">If you close this, the details stay until you add the job.</p>' +
      '<datalist id="job-places">' +
      places.map((place) => '<option value="' + escapeHtml(place) + '"></option>').join("") +
      "</datalist></form>";
    show(sheet, true);
    const form = document.getElementById("job-form");
    document.getElementById("close-form").onclick = () => {
      if (!booking) saveDraft(readForm(form));
      closeSheet();
    };
    form.addEventListener("input", () => {
      if (!booking) saveDraft(readForm(form));
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveJob(readForm(form), booking);
    });
  }

  function readForm(form) {
    const data = new FormData(form);
    return {
      pickupDate: String(data.get("pickupDate") || ""),
      pickupTime: String(data.get("pickupTime") || ""),
      pickupLocation: String(data.get("pickupLocation") || "").trim(),
      destination: String(data.get("destination") || "").trim(),
      hirerName: String(data.get("hirerName") || "").trim(),
      hirerPhone: String(data.get("hirerPhone") || "").trim(),
      vehicleType: String(data.get("vehicleType") || "standard"),
    };
  }

  async function saveJob(draft, existing) {
    const err = document.getElementById("form-error");
    if (!draft.pickupDate || !draft.pickupTime || !draft.pickupLocation || !draft.destination || !draft.hirerName || !draft.hirerPhone) {
      setError(err, "Fill in every field.");
      return;
    }
    const pickupIso = fromDateAndTime(draft.pickupDate, draft.pickupTime);
    const actor = auth.currentUser && auth.currentUser.uid;
    try {
      if (existing && existing.id) {
        const nextStatus =
          existing.status === "cancelled"
            ? "cancelled"
            : existing.status === "completed"
              ? "completed"
              : existing.status === "pending"
                ? "pending"
                : "confirmed";
        await db.collection("bookings").doc(existing.id).update({
          pickupTime: pickupIso,
          dateTime: pickupIso,
          pickupLocation: draft.pickupLocation,
          destination: draft.destination,
          hirerName: draft.hirerName,
          hirerPhone: draft.hirerPhone,
          vehicleType: draft.vehicleType,
          status: nextStatus,
          updatedByUid: actor,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await db.collection("bookings").add({
          bookingNumber: bookingNumber(),
          dateTime: pickupIso,
          pickupTime: pickupIso,
          pickupLocation: draft.pickupLocation,
          destination: draft.destination,
          hirerName: draft.hirerName,
          hirerPhone: draft.hirerPhone,
          hirerAddress: "",
          bookingMethod: "telephone",
          bookingType: "one_way",
          vehicleType: draft.vehicleType,
          status: "confirmed",
          paymentStatus: "pending",
          source: "family",
          createdByUid: actor,
          updatedByUid: actor,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        sessionStorage.removeItem(DRAFT_KEY);
      }
      statusEl.textContent = existing ? "Job updated." : "Job added.";
      show(statusEl, true);
      closeSheet();
    } catch (error) {
      setError(err, error.message || "Could not save.");
    }
  }

  function listenBookings() {
    if (unsub) unsub();
    unsub = db.collection("bookings").orderBy("createdAt", "desc").onSnapshot(
      (snap) => {
        bookings = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
        setError(errorEl, "");
        renderList();
      },
      async (error) => {
        setError(errorEl, "Could not load jobs. Sign in again with the PIN.");
        await auth.signOut();
        showApp(false);
      }
    );
  }

  async function deviceStillValid(user) {
    const token = await user.getIdTokenResult();
    if (!token.claims.familyJobs) return false;
    const snap = await db.collection("familyDevices").doc(user.uid).get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    if (data.enabled === false) return false;
    const expires = toDate(data.expiresAt);
    return !expires || expires.getTime() > Date.now();
  }

  function showApp(on) {
    show(pinScreen, !on);
    show(appScreen, on);
  }

  pinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError(pinError, "");
    pinSubmit.disabled = true;
    try {
      const result = await unlock({
        pin: pinInput.value,
        userAgent: navigator.userAgent,
      });
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await auth.signInWithCustomToken(result.data.token);
      pinInput.value = "";
    } catch (error) {
      setError(pinError, error.message || "Could not unlock.");
    } finally {
      pinSubmit.disabled = false;
    }
  });

  document.querySelectorAll(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      view = button.getAttribute("data-view");
      document.querySelectorAll(".tabs button").forEach((row) => row.classList.toggle("is-active", row === button));
      renderList();
    });
  });

  document.getElementById("add-job").addEventListener("click", () => openForm(null));

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      if (unsub) unsub();
      showApp(false);
      return;
    }
    try {
      const ok = await deviceStillValid(user);
      if (!ok) {
        await auth.signOut();
        return;
      }
      showApp(true);
      listenBookings();
    } catch {
      await auth.signOut();
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/office-jobs-sw.js", { scope: "/office-jobs" }).catch(() => undefined);
  }
})();
