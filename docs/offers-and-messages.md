# Offers and messages

Operational pre-release checklist for emails and offers.  
**Not** the policy source of truth — use [`policies/README.md`](policies/README.md).

The admin screen shows configured templates. It does not prove a live inbox received them.

Before a release:

1. Create a test customer with a test email address you control. Do not use a customer address.
2. Confirm the welcome email has no £5 signup offer and the account link opens the customer portal.
3. Request a Heathrow quote as a test and confirm the acknowledgement calls it a request.
4. Issue a test quote with no discount and confirm it says it is not a confirmed booking.
5. Open a booking that already has an agreed fare and confirm that fare is unchanged.
6. Check Firebase Authentication password reset and verification templates in the Firebase console.
7. Do not take a real payment. Use the admin payment request preview only.

## Policy dependency (do not hard-code here)

Executive Car and airport waiting rules belong in the [policy register](policies/README.md):

- Flight-monitored allowance: **50 minutes** from actual landing (approved).
- Overage and fixed-time: separate register entries. This checklist previously said **£10 per 30 minutes** while current published stamps use **£5 per started 15 minutes** — **Needs Hashim’s approval** before treating either line as permanent ops gate text.

Keep Executive launch gated on partner confirmation for vehicle supply and the **register** waiting rules, not on a one-off sentence in this file.
