/**
 * Google Places reviews for the public site.
 *
 * Setup (Vercel environment variables, server side only):
 *   GOOGLE_PLACES_API_KEY  Places API (New) key. Restrict it to this API.
 *   GOOGLE_PLACE_ID        The Place ID for Spires Taxis Ltd.
 *
 * Place IDs may be stored. Review text, ratings and author details are not
 * written to disk or to the HTML. Responses use Cache-Control: no-store.
 * https://developers.google.com/maps/documentation/places/web-service/policies
 */

const FIELD_MASK = [
  "id",
  "displayName",
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "reviews",
].join(",");

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(body));
}

function reviewText(review) {
  if (!review || !review.text) return "";
  if (typeof review.text === "string") return review.text;
  return review.text.text || "";
}

function mapReview(review) {
  const author = review.authorAttribution || {};
  const text = reviewText(review).trim();
  if (!text || !author.displayName) return null;
  return {
    rating: typeof review.rating === "number" ? review.rating : null,
    text,
    relativeTime: review.relativePublishTimeDescription || "",
    published: review.publishTime || "",
    reviewUrl: review.googleMapsUri || "",
    authorName: author.displayName,
    authorUrl: author.uri || "",
    authorPhoto: author.photoUri || "",
  };
}

module.exports = async function googleReviews(req, res) {
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }
  if (req.method !== "GET") {
    send(res, 405, { configured: false, reviews: [] });
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) {
    send(res, 200, { configured: false, reviews: [] });
    return;
  }

  const url = "https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId);
  try {
    const response = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
    });
    if (!response.ok) {
      send(res, 200, { configured: true, reviews: [] });
      return;
    }
    const place = await response.json();
    const reviews = Array.isArray(place.reviews)
      ? place.reviews.map(mapReview).filter(Boolean).slice(0, 5)
      : [];
    send(res, 200, {
      configured: true,
      name: place.displayName && place.displayName.text ? place.displayName.text : "",
      rating: typeof place.rating === "number" ? place.rating : null,
      reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
      mapsUrl: place.googleMapsUri || "",
      order: "relevance",
      reviews,
    });
  } catch (error) {
    send(res, 200, { configured: true, reviews: [] });
  }
};
