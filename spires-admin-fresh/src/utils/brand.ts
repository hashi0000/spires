export type BrandId = 'spires_taxis' | 'spires_international';

/** Bookings with no brand stay on Spires Taxis. */
export function brandOf(record: unknown): BrandId {
  if (!record || typeof record !== "object" || !("brand" in record)) return "spires_taxis";
  return (record as { brand?: unknown }).brand === "spires_international" ? "spires_international" : "spires_taxis";
}

export function brandLabel(brand: BrandId): string {
  return brand === 'spires_international' ? 'Spires International' : 'Spires Taxis';
}
