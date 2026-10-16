/** datetime-local inputs use local time; ISO strings are UTC. These helpers avoid off-by-one-hour bugs. */

export function toDatetimeLocalValue(value: string | Date | undefined | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function toDateInputValue(value: string | Date | undefined | null): string {
  const local = toDatetimeLocalValue(value);
  return local.slice(0, 10);
}

export function toTimeInputValue(value: string | Date | undefined | null): string {
  const local = toDatetimeLocalValue(value);
  return local.slice(11, 16);
}

export function fromDateAndTime(date: string, time: string): string {
  if (!date || !time) return new Date().toISOString();
  return fromDatetimeLocalValue(`${date}T${time}`);
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addLocalDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}
