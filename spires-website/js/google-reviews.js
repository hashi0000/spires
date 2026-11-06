/**
 * Inactive unless a page explicitly opts in with data-google-reviews-api.
 * The public pages use the manual testimonials in reviews-data.js.
 */
(function () {
  var root = document.querySelector("[data-google-reviews-api]");
  if (!root) return;

  var limit = Number(root.getAttribute("data-review-limit")) || 3;
  var list = root.querySelector("[data-google-reviews-list]");
  var summary = root.querySelector("[data-google-reviews-summary]");

  function stars(rating) {
    var value = Math.round(Number(rating) || 0);
    var label = (Number(rating) || 0) + " out of 5";
    var marks = "";
    for (var i = 1; i <= 5; i++) marks += i <= value ? "★" : "☆";
    return '<p class="google-review__stars" aria-label="' + label + '"><span aria-hidden="true">' + marks + "</span></p>";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function reviewCard(review) {
    var text = review.text || "";
    var long = text.length > 280;
    var shown = long ? text.slice(0, 280).replace(/\s+\S*$/, "") : text;
    var author = review.authorUrl
      ? '<a href="' + escapeHtml(review.authorUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(review.authorName) + "</a>"
      : escapeHtml(review.authorName);
    var photo = review.authorPhoto
      ? '<img class="google-review__photo" src="' + escapeHtml(review.authorPhoto) + '" alt="" width="40" height="40" loading="lazy">'
      : "";
    var when = review.relativeTime || "";
    var more = long
      ? '<button type="button" class="google-review__more" aria-expanded="false">Read more</button>'
      : "";
    var source = review.reviewUrl
      ? '<a href="' + escapeHtml(review.reviewUrl) + '" target="_blank" rel="noopener noreferrer">View on Google</a>'
      : "";
    return (
      '<article class="card google-review">' +
      '<header class="google-review__who">' +
      photo +
      "<div><p class=\"google-review__name\">" + author + "</p>" +
      (when ? '<p class="google-review__when">' + escapeHtml(when) + "</p>" : "") +
      "</div></header>" +
      stars(review.rating) +
      '<p class="google-review__text" data-full="' + escapeHtml(text) + '" data-short="' + escapeHtml(shown) + '">' +
      escapeHtml(shown) + (long ? "…" : "") +
      "</p>" +
      more +
      (source ? '<p class="google-review__source">' + source + "</p>" : "") +
      "</article>"
    );
  }

  function summaryText(data, shown) {
    var parts = [];
    if (typeof data.rating === "number" && typeof data.reviewCount === "number") {
      parts.push("Google rating " + data.rating + " from " + data.reviewCount + " reviews.");
    }
    parts.push("Showing " + shown + " review" + (shown === 1 ? "" : "s") + " from the selection Google returned, ordered by relevance. This is not the full set.");
    if (data.mapsUrl) {
      parts.push('<a href="' + escapeHtml(data.mapsUrl) + '" target="_blank" rel="noopener noreferrer">Reviews from Google</a>');
    } else {
      parts.push("Reviews from Google");
    }
    return parts.join(" ");
  }

  fetch("/api/google-reviews")
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (!data || !data.configured || !data.reviews || !data.reviews.length || !list) return;
      var reviews = data.reviews.slice(0, limit);
      list.innerHTML = reviews.map(reviewCard).join("");
      if (summary) summary.innerHTML = summaryText(data, reviews.length);
      root.hidden = false;
      list.addEventListener("click", function (event) {
        var button = event.target.closest(".google-review__more");
        if (!button) return;
        var card = button.closest(".google-review");
        var paragraph = card && card.querySelector(".google-review__text");
        if (!paragraph) return;
        var open = button.getAttribute("aria-expanded") === "true";
        paragraph.textContent = open ? paragraph.getAttribute("data-short") + "…" : paragraph.getAttribute("data-full");
        button.textContent = open ? "Read more" : "Show less";
        button.setAttribute("aria-expanded", open ? "false" : "true");
      });
    })
    .catch(function () {});
})();
