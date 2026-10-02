(function () {
  const list = document.getElementById("spires-share-interest-list");
  const status = document.getElementById("spires-share-interest-status");
  if (!list) return;
  const LIST_URL = "https://us-central1-spires-taxis.cloudfunctions.net/spiresSharePublicList";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(rows) {
    const items = (Array.isArray(rows) ? rows.slice(0, 3) : []).map((row) => {
      const seats = Number(row.interestedSeatCount || 0);
      const date = escapeHtml(row.travelDate || "");
      const time = escapeHtml(row.timeLabel || "");
      const extra = [date, time].filter(Boolean).join(" · ");
      return `<li>${escapeHtml(row.origin || "Oxford")} → ${escapeHtml(row.destinationRegion || "")}${extra ? ` · ${extra}` : ""} · ${seats} interested</li>`;
    });
    if (status) {
      status.textContent = items.length ? "" : "No public interest is listed yet. You can still request a shared journey.";
      status.hidden = items.length > 0;
    }
    list.innerHTML = items.join("");
  }

  function fallback() {
    render([]);
    if (status) {
      status.textContent = "View shared journeys to see current interest and register your own.";
      status.hidden = false;
    }
  }

  fetch(LIST_URL, { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) return null;
      return response.json();
    })
    .then((data) => {
      if (!data) {
        fallback();
        return;
      }
      render(data.interestGroups);
    })
    .catch(fallback);
})();
