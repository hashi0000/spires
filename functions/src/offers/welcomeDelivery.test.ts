import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deliverWelcomeEmail } from "../sendWelcomeEmail";

type Row = Record<string, unknown>;

function memoryDb(failSentWrite = false) {
  const docs = new Map<string, Row>();
  let lock: Promise<void> = Promise.resolve();
  const refFor = (id: string) => ({
    async get() {
      return { data: () => ({ ...(docs.get(id) || {}) }) };
    },
    async set(data: Row) {
      if (failSentWrite && data.welcomeEmailStatus === "sent") {
        throw new Error("status write failed");
      }
      docs.set(id, { ...(docs.get(id) || {}), ...data });
    },
  });
  return {
    docs,
    collection() {
      return { doc: (id: string) => refFor(id) };
    },
    async runTransaction<T>(fn: (tx: { get: (ref: ReturnType<typeof refFor>) => Promise<{ data: () => Row }>; set: (ref: ReturnType<typeof refFor>, data: Row) => Promise<void> }) => Promise<T>) {
      const run = lock.then(async () => {
        const tx = {
          get: (ref: ReturnType<typeof refFor>) => ref.get(),
          set: (ref: ReturnType<typeof refFor>, data: Row) => ref.set(data),
        };
        return fn(tx);
      });
      lock = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}

describe("welcome delivery", () => {
  it("sends once, and a concurrent trigger does not send a second copy", async () => {
    const db = memoryDb();
    const sent: string[] = [];
    const send = async (message: { to: string }) => {
      sent.push(message.to);
    };
    const input = { email: "review-welcome@example.com", firstName: "Review", lastName: "Only" };
    const [first, second] = await Promise.all([
      deliverWelcomeEmail(db as never, "cust-1", input, send),
      deliverWelcomeEmail(db as never, "cust-1", input, send),
    ]);
    assert.deepEqual([first, second].sort(), ["needs_review", "sent"]);
    assert.deepEqual(sent, ["review-welcome@example.com"]);
    assert.equal(db.docs.get("cust-1")?.welcomeEmailStatus, "sent");
  });

  it("leaves a review flag and does not send again when the sent status cannot be stored", async () => {
    const db = memoryDb(true);
    const sent: string[] = [];
    await assert.rejects(
      deliverWelcomeEmail(db as never, "cust-2", { email: "review-welcome@example.com", firstName: "Review" }, async (message) => {
        sent.push(message.to);
      })
    );
    assert.deepEqual(sent, ["review-welcome@example.com"]);
    assert.equal(db.docs.get("cust-2")?.welcomeEmailStatus, "sending");
    const retry = await deliverWelcomeEmail(db as never, "cust-2", { email: "review-welcome@example.com", firstName: "Review" }, async () => {
      sent.push("again");
    });
    assert.equal(retry, "needs_review");
    assert.equal(db.docs.get("cust-2")?.welcomeEmailStatus, "needs_review");
    assert.deepEqual(sent, ["review-welcome@example.com"]);
  });

  it("retries only when the mail provider rejects the message", async () => {
    const db = memoryDb();
    await assert.rejects(
      deliverWelcomeEmail(db as never, "cust-3", { email: "review-welcome@example.com", firstName: "Review" }, async () => {
        throw new Error("smtp rejected");
      })
    );
    assert.equal(db.docs.get("cust-3")?.welcomeEmailStatus, "failed");
    const sent: string[] = [];
    const retry = await deliverWelcomeEmail(db as never, "cust-3", { email: "review-welcome@example.com", firstName: "Review" }, async (message) => {
      sent.push(message.to);
    });
    assert.equal(retry, "sent");
    assert.deepEqual(sent, ["review-welcome@example.com"]);
  });
});
