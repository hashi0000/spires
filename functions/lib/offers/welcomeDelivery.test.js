"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const sendWelcomeEmail_1 = require("../sendWelcomeEmail");
function memoryDb(failSentWrite = false) {
    const docs = new Map();
    let lock = Promise.resolve();
    const refFor = (id) => ({
        async get() {
            return { data: () => ({ ...(docs.get(id) || {}) }) };
        },
        async set(data) {
            if (failSentWrite && data.welcomeEmailStatus === "sent") {
                throw new Error("status write failed");
            }
            docs.set(id, { ...(docs.get(id) || {}), ...data });
        },
    });
    return {
        docs,
        collection() {
            return { doc: (id) => refFor(id) };
        },
        async runTransaction(fn) {
            const run = lock.then(async () => {
                const tx = {
                    get: (ref) => ref.get(),
                    set: (ref, data) => ref.set(data),
                };
                return fn(tx);
            });
            lock = run.then(() => undefined, () => undefined);
            return run;
        },
    };
}
(0, node_test_1.describe)("welcome delivery", () => {
    (0, node_test_1.it)("sends once, and a concurrent trigger does not send a second copy", async () => {
        const db = memoryDb();
        const sent = [];
        const send = async (message) => {
            sent.push(message.to);
        };
        const input = { email: "review-welcome@example.com", firstName: "Review", lastName: "Only" };
        const [first, second] = await Promise.all([
            (0, sendWelcomeEmail_1.deliverWelcomeEmail)(db, "cust-1", input, send),
            (0, sendWelcomeEmail_1.deliverWelcomeEmail)(db, "cust-1", input, send),
        ]);
        strict_1.default.deepEqual([first, second].sort(), ["needs_review", "sent"]);
        strict_1.default.deepEqual(sent, ["review-welcome@example.com"]);
        strict_1.default.equal(db.docs.get("cust-1")?.welcomeEmailStatus, "sent");
    });
    (0, node_test_1.it)("leaves a review flag and does not send again when the sent status cannot be stored", async () => {
        const db = memoryDb(true);
        const sent = [];
        await strict_1.default.rejects((0, sendWelcomeEmail_1.deliverWelcomeEmail)(db, "cust-2", { email: "review-welcome@example.com", firstName: "Review" }, async (message) => {
            sent.push(message.to);
        }));
        strict_1.default.deepEqual(sent, ["review-welcome@example.com"]);
        strict_1.default.equal(db.docs.get("cust-2")?.welcomeEmailStatus, "sending");
        const retry = await (0, sendWelcomeEmail_1.deliverWelcomeEmail)(db, "cust-2", { email: "review-welcome@example.com", firstName: "Review" }, async () => {
            sent.push("again");
        });
        strict_1.default.equal(retry, "needs_review");
        strict_1.default.equal(db.docs.get("cust-2")?.welcomeEmailStatus, "needs_review");
        strict_1.default.deepEqual(sent, ["review-welcome@example.com"]);
    });
    (0, node_test_1.it)("retries only when the mail provider rejects the message", async () => {
        const db = memoryDb();
        await strict_1.default.rejects((0, sendWelcomeEmail_1.deliverWelcomeEmail)(db, "cust-3", { email: "review-welcome@example.com", firstName: "Review" }, async () => {
            throw new Error("smtp rejected");
        }));
        strict_1.default.equal(db.docs.get("cust-3")?.welcomeEmailStatus, "failed");
        const sent = [];
        const retry = await (0, sendWelcomeEmail_1.deliverWelcomeEmail)(db, "cust-3", { email: "review-welcome@example.com", firstName: "Review" }, async (message) => {
            sent.push(message.to);
        });
        strict_1.default.equal(retry, "sent");
        strict_1.default.deepEqual(sent, ["review-welcome@example.com"]);
    });
});
