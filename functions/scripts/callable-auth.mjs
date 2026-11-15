/**
 * Calls the functions emulator without a signed-in user.
 * Helper tests do not prove these handlers reject that call.
 */
const project = process.env.GCLOUD_PROJECT || "spires-taxis";
const base = "http://127.0.0.1:5001";
const names = ["createPaymentIntent", "confirmPayment", "saveSchoolInvoiceVault", "recordManualPayment", "issueQuote"];
const results = [];
for (const name of names) {
  const response = await fetch(`${base}/${project}/us-central1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { bookingId: "not-a-real-booking", amount: 10 } }),
  });
  const body = await response.json();
  const status = body?.error?.status || body?.error?.message || response.status;
  results.push({ name, http: response.status, status });
  if (body?.error?.status !== "UNAUTHENTICATED" && body?.error?.status !== "PERMISSION_DENIED") {
    throw new Error(`${name} did not reject a signed-out call: ${JSON.stringify(body).slice(0, 400)}`);
  }
}
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!authHost) {
  throw new Error("FIREBASE_AUTH_EMULATOR_HOST is not set, so a signed-in non admin was not tested.");
}
const signup = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "other@example.com", password: "local-test-pass", returnSecureToken: true }),
});
const account = await signup.json();
if (!account.idToken) {
  throw new Error(`Auth emulator did not return a token: ${JSON.stringify(account).slice(0, 300)}`);
}
for (const name of ["recordManualPayment", "saveSchoolInvoiceVault", "issueQuote"]) {
  const response = await fetch(`${base}/${project}/us-central1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.idToken}` },
    body: JSON.stringify({ data: { bookingId: "not-a-real-booking", amountPounds: "10", mode: "add" } }),
  });
  const body = await response.json();
  results.push({ name, caller: "signed-in-non-admin", http: response.status, status: body?.error?.status || response.status });
  if (body?.error?.status !== "PERMISSION_DENIED") {
    throw new Error(`${name} allowed a non admin: ${JSON.stringify(body).slice(0, 400)}`);
  }
}
console.log(JSON.stringify(results, null, 2));
