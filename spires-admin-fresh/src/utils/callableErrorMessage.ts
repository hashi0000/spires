/** Readable text from Firebase Callable / Storage / Auth errors. */
export function getCallableErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const code = typeof o.code === 'string' ? o.code : '';
    const message = typeof o.message === 'string' ? o.message : '';
    if (code && message && message !== 'internal') {
      return `${message} (${code})`;
    }
    if (message) return message;
    if (code) return String(code);
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
