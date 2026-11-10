export type Attribution = {
  consent: 'granted'; consentAt: number; capturedAt: number; expiresAt: number;
  clientId?: string; sessionId?: string; sessionCapturedAt?: number;
  gclid?: string; gbraid?: string; wbraid?: string;
};

/** Allowlist only. Never store arbitrary form fields, URLs, names or contact details here. */
export function readAttribution(input: unknown, now = Date.now()): Attribution | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const capturedAt = Number(row.capturedAt), expiresAt = Number(row.expiresAt), consentAt = Number(row.consentAt);
  if (row.consent !== 'granted' || !Number.isFinite(capturedAt) || !Number.isFinite(expiresAt) || !Number.isFinite(consentAt)) return null;
  if (capturedAt <= 0 || capturedAt > now + 60000 || capturedAt < now - 30 * 86400000 || expiresAt <= now || expiresAt > capturedAt + 30 * 86400000 || consentAt > now + 60000 || consentAt < now - 86400000) return null;
  const clean: Attribution = { consent: 'granted', capturedAt, expiresAt, consentAt };
  if (/^\d{1,20}\.\d{1,20}$/.test(String(row.clientId || ''))) clean.clientId = String(row.clientId);
  if (/^\d{1,20}$/.test(String(row.sessionId || '')) && Number(row.sessionCapturedAt) > 0 && Number(row.sessionCapturedAt) <= now + 60000) {
    clean.sessionId = String(row.sessionId); clean.sessionCapturedAt = Number(row.sessionCapturedAt);
  }
  for (const k of ['gclid', 'gbraid', 'wbraid'] as const) {
    if (typeof row[k] === 'string' && /^[A-Za-z0-9_.~-]{1,256}$/.test(row[k] as string)) clean[k] = row[k] as string;
  }
  return clean.clientId || clean.gclid || clean.gbraid || clean.wbraid ? clean : null;
}

export function confirmationPayload(bookingId: string, attribution: Attribution, at: number) {
  if (!attribution.clientId || attribution.expiresAt <= at) return null;
  const params: Record<string, unknown> = { event_id: `booking_confirmed_${bookingId}`, engagement_time_msec: 1, booking_channel: 'online' };
  // Session attribution is only attempted inside Google's 24-hour join window.
  if (attribution.sessionId && attribution.sessionCapturedAt && at - attribution.sessionCapturedAt < 24 * 3600000) params.session_id = attribution.sessionId;
  return { client_id: attribution.clientId, timestamp_micros: at * 1000, consent: { ad_user_data: 'GRANTED', ad_personalization: 'DENIED' }, events: [{ name: 'booking_confirmed', params }] };
}
