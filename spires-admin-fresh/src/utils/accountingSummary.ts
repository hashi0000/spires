export type AccountingJob = {
  status?: string;
  actualFare?: number | string | null;
  amountReceivedPence?: number | string | null;
  expenses?: { amount?: number | string | null }[] | null;
  driverId?: string;
};

export type AccountingDriver = { id: string; name: string };

export type DriverRevenue = {
  driver: string;
  bookings: number;
  knownFares: number;
  revenue: number | null;
};

export type AccountingSummary = {
  totalBookings: number;
  totalRevenue: number | null;
  faresMissing: number;
  totalExpenses: number | null;
  expensesMissing: number;
  paidAmount: number | null;
  recordedCount: number;
  unrecordedCount: number;
  driverRevenue: DriverRevenue[];
};

/** A blank or unreadable amount stays missing. Zero is a recorded amount. */
export function recordedPounds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function buildAccountingSummary(jobs: AccountingJob[], drivers: AccountingDriver[]): AccountingSummary {
  const completed = jobs.filter((job) => job.status === "completed");
  let fareTotal = 0;
  let fareCount = 0;
  let expenseTotal = 0;
  let expenseJobs = 0;
  let receivedTotal = 0;
  let receivedJobs = 0;

  for (const job of completed) {
    const fare = recordedPounds(job.actualFare);
    if (fare !== null) {
      fareTotal += fare;
      fareCount += 1;
    }
    const lines = Array.isArray(job.expenses) ? job.expenses : [];
    const knownLines = lines.map((line) => recordedPounds(line?.amount)).filter((amount): amount is number => amount !== null);
    if (knownLines.length > 0) {
      expenseTotal += knownLines.reduce((sum, amount) => sum + amount, 0);
      expenseJobs += 1;
    }
    const pence = recordedPounds(job.amountReceivedPence);
    if (pence !== null) {
      receivedTotal += Math.max(0, pence / 100);
      receivedJobs += 1;
    }
  }

  const driverRevenue = drivers
    .map((driver) => {
      const rows = completed.filter((job) => job.driverId === driver.id);
      const known = rows.map((job) => recordedPounds(job.actualFare)).filter((fare): fare is number => fare !== null);
      return {
        driver: driver.name,
        bookings: rows.length,
        knownFares: known.length,
        revenue: known.length > 0 ? known.reduce((sum, fare) => sum + fare, 0) : null,
      };
    })
    .filter((row) => row.bookings > 0);

  return {
    totalBookings: completed.length,
    totalRevenue: fareCount > 0 ? fareTotal : null,
    faresMissing: completed.length - fareCount,
    totalExpenses: expenseJobs > 0 ? expenseTotal : null,
    expensesMissing: completed.length - expenseJobs,
    paidAmount: receivedJobs > 0 ? receivedTotal : null,
    recordedCount: receivedJobs,
    unrecordedCount: completed.length - receivedJobs,
    driverRevenue,
  };
}
