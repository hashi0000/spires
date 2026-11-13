import { createHash } from 'crypto';

export function customerSubmission(uid: string, data: Record<string, unknown>) {
  const id = typeof data.submissionId === 'string' ? data.submissionId.trim() : '';
  if (id && !/^[A-Za-z0-9_-]{16,80}$/.test(id)) throw new Error('Invalid submission identifier.');
  const payload = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'marketingAttribution').sort(([a], [b]) => a.localeCompare(b)));
  return {
    bookingId: id ? createHash('sha256').update(`${uid}:${id}`).digest('hex') : undefined,
    fingerprint: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
  };
}
