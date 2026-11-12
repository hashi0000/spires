import * as functions from "firebase-functions/v1";
import { chargeableFare, internationalEnabled, vehicleDecision, type VehicleId } from "./rules";

/**
 * Disabled unless SPIRES_INTERNATIONAL_ENABLED=true.
 * Even then it only returns a quote decision. It does not create a Stripe charge.
 */
export const internationalPreview = functions.https.onRequest((req, res) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Use POST." });
    return;
  }
  if (!internationalEnabled(process.env.SPIRES_INTERNATIONAL_ENABLED)) {
    res.status(403).json({ ok: false, enabled: false, charging: false, error: "Spires International is not enabled." });
    return;
  }
  const body = (req.body || {}) as { passengers?: unknown; luggage?: unknown; vehicle?: unknown };
  const passengers = Number(body.passengers);
  const luggage = Number(body.luggage);
  const vehicle: VehicleId = body.vehicle === "vito_8" ? "vito_8" : "standard";
  const fit = vehicleDecision(passengers, luggage, vehicle);
  const fare = chargeableFare(body as { amountPence?: unknown; brand?: unknown });
  res.status(200).json({
    ok: fit.ok,
    enabled: true,
    charging: false,
    error: fit.ok ? undefined : fit.error,
    fare,
  });
});
