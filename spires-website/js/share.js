(function () {
  const fareLine = document.getElementById("share-fare-line");
  const listStatus = document.getElementById("share-list-status");
  const listEl = document.getElementById("share-departure-list");
  const interestStatus = document.getElementById("share-interest-status");
  const interestEl = document.getElementById("share-interest-list");
  const LIST_URL = "https://us-central1-spires-taxis.cloudfunctions.net/spiresSharePublicList";
  const ACCOUNT = "https://customer.spires-taxis.com/dashboard?share=1";
  const DEFAULT_FARE_PENCE = 3500;
  const DEFAULT_CAPACITY = 5;

  function gbp(pence) {
    return "£" + (Number(pence || 0) / 100).toFixed(2);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(isoDate) {
    const [y, m, d] = (isoDate || "").split("-").map(Number);
    if (!y) return isoDate;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  }

  function recommendedArrival(departureTime) {
    const parts = String(departureTime || "").split(":");
    const hours = Number(parts[0]);
    const mins = Number(parts[1]);
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return "";
    const total = hours * 60 + mins - 15;
    const wrapped = (total + 24 * 60) % (24 * 60);
    const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
    const mm = String(wrapped % 60).padStart(2, "0");
    return hh + ":" + mm;
  }

  function statusLabel(row) {
    if (row.guarantee === "CONFIRMED" || row.journeyStatus === "CONFIRMED") return "Journey confirmed";
    if (row.journeyStatus === "AWAITING_FINAL_PASSENGER") return "Awaiting final passenger";
    if (row.journeyStatus === "PAYMENT_WINDOW_OPEN") return "Payment open";
    if (row.journeyStatus === "FOUR_PASSENGER_OPTION") return "Four passenger option";
    if (row.journeyStatus === "SUPPLEMENT_PAYMENT") return "Supplement payment";
    return "Provisional place";
  }

  function occupancyBar(occupied, capacity) {
    const max = capacity || DEFAULT_CAPACITY;
    const taken = Number(occupied || 0);
    let dots = "";
    for (let i = 0; i < max; i += 1) {
      dots += `<span class="share-dot${i < taken ? " is-filled" : ""}"></span>`;
    }
    return `<div class="share-occupancy" aria-label="${taken} of ${max} places reserved">${dots}</div>`;
  }

  function cardHtml(row) {
    const remaining = row.remainingSeats;
    const arrival = row.recommendedArrivalTime || recommendedArrival(row.departureTime);
    const origin = row.meetingPointName || "Thornhill Park & Ride";
    const destination = row.destinationLabel || "Heathrow Airport Terminal 3";
    const params = new URLSearchParams({
      share: "1",
      publicNumber: row.publicNumber || "",
      travelDate: row.travelDate || "",
      preferredDepartureTime: row.departureTime || "",
    });
    const waitParams = new URLSearchParams({
      share: "1",
      waitlist: "1",
      publicNumber: row.publicNumber || "",
      travelDate: row.travelDate || "",
      preferredDepartureTime: row.departureTime || "",
    });
    return `<article class="card share-card">
      <p class="share-card__kicker">Oxford → Heathrow Terminal 3</p>
      <h3>${escapeHtml(formatDate(row.travelDate))}</h3>
      <p class="share-card__time">Departure: ${escapeHtml(row.departureTime)}</p>
      <p>Recommended arrival: ${escapeHtml(arrival)}</p>
      <p>${escapeHtml(origin)}<br>→ ${escapeHtml(destination)}</p>
      <p class="card__price" data-share-fare>${gbp(row.farePence)} per passenger</p>
      <p>${Number(row.occupiedSeats || 0)} of ${Number(row.capacity || DEFAULT_CAPACITY)} places reserved</p>
      ${occupancyBar(row.occupiedSeats, row.capacity)}
      <p>${remaining} ${remaining === 1 ? "place" : "places"} remaining</p>
      <p class="share-badge">${statusLabel(row)}</p>
      <p class="share-warning">Please arrive at least 15 minutes before departure. Registering interest does not confirm your journey and no payment is taken at this stage.</p>
      ${remaining > 0
        ? `<a class="btn btn--primary share-card__cta" href="${ACCOUNT}&${params.toString()}">Register interest</a>`
        : `<a class="btn btn--primary share-card__cta" href="${ACCOUNT}&${waitParams.toString()}">Join waitlist</a>`}
    </article>`;
  }

  function interestCardHtml(row) {
    const seats = Number(row.interestedSeatCount || 0);
    const params = new URLSearchParams({
      share: "1",
      interest: row.publicNumber || "",
      origin: row.origin || "",
      destination: row.destinationRegion || "",
      travelDate: row.travelDate || "",
    });
    return `<article class="card share-card">
      <p class="share-card__kicker">${escapeHtml(row.origin || "Oxford")} → ${escapeHtml(row.destinationRegion || "")}</p>
      <h3>${escapeHtml(formatDate(row.travelDate))}</h3>
      <p class="share-card__time">${escapeHtml(row.timeLabel || "")}</p>
      <p>${seats} ${seats === 1 ? "passenger interested" : "passengers interested"}</p>
      <p class="share-warning">This is aggregate interest only. Exact destinations and passenger details are not shown.</p>
      <a class="btn btn--primary share-card__cta" href="${ACCOUNT}&${params.toString()}">Join</a>
    </article>`;
  }

  function setList(rows, note) {
    fareLine.textContent = "From " + gbp(rows[0]?.farePence || DEFAULT_FARE_PENCE) + " per passenger. Direct shared airport transfer. Maximum five passengers.";
    listStatus.textContent = note;
    listEl.innerHTML = rows.length ? rows.map((row) => cardHtml(row)).join("") : "";
  }

  function setInterest(rows, note) {
    if (!interestStatus || !interestEl) return;
    interestStatus.textContent = note;
    interestEl.innerHTML = rows.length ? rows.map((row) => interestCardHtml(row)).join("") : "";
  }

  function layoutPreview() {
    return [
      {
        publicNumber: "LAYOUT-1",
        travelDate: "2026-10-06",
        departureTime: "14:00",
        recommendedArrivalTime: "13:45",
        originLabel: "Oxford",
        meetingPointName: "Thornhill Park & Ride",
        destinationLabel: "Heathrow Airport Terminal 3",
        farePence: DEFAULT_FARE_PENCE,
        occupiedSeats: 4,
        remainingSeats: 1,
        capacity: 5,
        publicStatus: "ALMOST_FULL",
        journeyStatus: "AWAITING_FINAL_PASSENGER",
        guarantee: "PROVISIONAL",
      },
    ];
  }

  function interestPreview() {
    return [
      {
        publicNumber: "IG-LAYOUT",
        origin: "Oxford",
        destinationRegion: "London",
        travelDate: "2026-10-10",
        timeLabel: "Morning",
        interestedSeatCount: 3,
      },
      {
        publicNumber: "IG-LAYOUT-2",
        origin: "Oxford",
        destinationRegion: "Heathrow",
        travelDate: "2026-10-12",
        timeLabel: "14:00",
        interestedSeatCount: 2,
      },
    ];
  }

  async function loadDepartures() {
    const preview = new URLSearchParams(window.location.search).get("previewLayout") === "1";
    if (preview) {
      setList(layoutPreview(), "Layout preview only. Live occupancy is not shown.");
      setInterest(interestPreview(), "Layout preview only. Live interest is not shown.");
      return;
    }
    try {
      const response = await fetch(LIST_URL, { method: "GET", headers: { Accept: "application/json" } });
      if (response.status === 404) {
        setList([], "No published pilot journeys are available at the moment.");
        setInterest([], "No public interest groups are listed at the moment.");
        return;
      }
      if (!response.ok) {
        setList([], "Live departures could not be loaded. You can still continue in your customer account.");
        setInterest([], "Live interest could not be loaded. Continue in your customer account to request a shared journey.");
        return;
      }
      const data = await response.json();
      const rows = Array.isArray(data.journeys) ? data.journeys : [];
      const interest = Array.isArray(data.interestGroups) ? data.interestGroups : [];
      if (!rows.length) {
        setList([], "No published pilot journeys are available at the moment. Spires Taxis will share this page when a departure is open.");
      } else {
        setList(rows, "Currently available pilot journeys. Sign in to register interest on a departure.");
      }
      if (!interest.length) {
        setInterest([], "Nobody has registered public interest for a shared journey yet. Sign in to request one.");
      } else {
        setInterest(interest, "You can view this board without signing in. Join or request requires a customer account.");
      }
    } catch (err) {
      setList([], "Live departures could not be loaded. Continue in your customer account to register interest.");
      setInterest([], "Live interest could not be loaded. Continue in your customer account to request a shared journey.");
    }
  }

  loadDepartures();
})();
