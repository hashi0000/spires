(function () {
  var HOME_ORDER = window.SPIRES_TESTIMONIAL_HOME_ORDER || [];

  function isShown(review) {
    if (!review) return false;
    if (review.permission === "confirmed") return true;
    return review.preview === true;
  }

  function reviewsFor(page) {
    var all = window.SPIRES_TESTIMONIALS || [];
    var shown = all.filter(function (review) {
      return isShown(review) && review.pages && review.pages.indexOf(page) !== -1;
    });
    if (page !== "home") return shown;
    return HOME_ORDER.map(function (id) {
      for (var i = 0; i < shown.length; i++) {
        if (shown[i].id === id) return shown[i];
      }
      return null;
    }).filter(Boolean);
  }

  function stars(rating) {
    var value = Number(rating) || 0;
    var p = document.createElement("p");
    p.className = "review-card__stars";
    p.setAttribute("role", "img");
    p.setAttribute("aria-label", value + " out of 5 stars");
    var marks = document.createElement("span");
    marks.setAttribute("aria-hidden", "true");
    marks.textContent = "★★★★★".slice(0, value) + "☆☆☆☆☆".slice(value);
    p.appendChild(marks);
    return p;
  }

  function card(review) {
    var article = document.createElement("article");
    article.className = "card review-card";
    article.setAttribute("data-review-id", review.id);

    var name = document.createElement("p");
    name.className = "review-card__name";
    name.textContent = review.name;

    var source = document.createElement("p");
    source.className = "review-card__source";
    source.textContent = "Originally posted on Google";

    var text = document.createElement("p");
    text.className = "review-card__text";
    text.id = "review-text-" + review.id;
    text.textContent = review.text;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "review-card__more";
    button.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", text.id);
    button.textContent = "Read more";

    article.appendChild(name);
    article.appendChild(stars(review.rating));
    article.appendChild(source);
    article.appendChild(text);
    article.appendChild(button);
    return article;
  }

  function bindReadMore(list) {
    var cards = list.querySelectorAll(".review-card");
    for (var i = 0; i < cards.length; i++) {
      var text = cards[i].querySelector(".review-card__text");
      var button = cards[i].querySelector(".review-card__more");
      if (!text || !button) continue;
      text.classList.remove("is-clamped");
      var fullHeight = text.scrollHeight;
      text.classList.add("is-clamped");
      if (fullHeight > text.clientHeight + 1) {
        button.hidden = false;
      } else {
        text.classList.remove("is-clamped");
      }
    }
    list.addEventListener("click", function (event) {
      var button = event.target.closest(".review-card__more");
      if (!button) return;
      var card = button.closest(".review-card");
      var text = card && card.querySelector(".review-card__text");
      if (!text) return;
      var open = button.getAttribute("aria-expanded") === "true";
      text.classList.toggle("is-clamped", open);
      button.setAttribute("aria-expanded", open ? "false" : "true");
      button.textContent = open ? "Read more" : "Show less";
      if (open) button.focus();
    });
  }

  function mount(list) {
    var page = list.getAttribute("data-review-list");
    var reviews = reviewsFor(page);
    list.textContent = "";
    for (var i = 0; i < reviews.length; i++) list.appendChild(card(reviews[i]));
    bindReadMore(list);
  }

  function start() {
    var lists = document.querySelectorAll("[data-review-list]");
    for (var i = 0; i < lists.length; i++) mount(lists[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
