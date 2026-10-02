import { PaymentStatus } from "./types";

export type VerifyMethodInput = {
  succeed?: boolean;
};

export type AuthoriseInput = {
  paymentId: string;
  amountPence: number;
  paymentMethodRef?: string;
  succeed?: boolean;
};

export type PaymentResult = {
  id: string;
  status: PaymentStatus;
  paymentMethodRef?: string;
  provider: "mock" | "shift4_online";
  providerRef?: string;
};

/**
 * Online payment adapter retained for a future Shift4 ecommerce/API product.
 * The active MVP does not call this. Manual hosted payment links plus admin verification are used instead.
 * Physical Shift4 terminals must never be used here.
 */
export interface PaymentProvider {
  readonly provider: "mock" | "shift4_online";
  verifyPaymentMethod(input?: VerifyMethodInput): Promise<PaymentResult>;
  authorise(input: AuthoriseInput): Promise<PaymentResult>;
  capture(paymentId: string): Promise<PaymentResult>;
  release(paymentId: string): Promise<PaymentResult>;
  refund(paymentId: string): Promise<PaymentResult>;
}

type StoredPayment = {
  status: PaymentStatus;
  amountPence: number;
  paymentMethodRef?: string;
  providerRef?: string;
};

/** In-memory/dev provider. Behaves like the intended online flow: method first, authorise at confirmation, capture only if the whole group succeeds. */
export class MockPaymentProvider implements PaymentProvider {
  readonly provider = "mock" as const;

  constructor(private store: Map<string, StoredPayment> = new Map()) {}

  async verifyPaymentMethod(input: VerifyMethodInput = {}): Promise<PaymentResult> {
    if (input.succeed === false) {
      return { id: "", status: "FAILED", provider: "mock" };
    }
    const paymentMethodRef = `pm_mock_${randomId()}`;
    return {
      id: "",
      status: "PAYMENT_METHOD_VERIFIED",
      paymentMethodRef,
      provider: "mock",
      providerRef: paymentMethodRef,
    };
  }

  async authorise(input: AuthoriseInput): Promise<PaymentResult> {
    if (input.succeed === false) {
      this.store.set(input.paymentId, {
        status: "FAILED",
        amountPence: input.amountPence,
        paymentMethodRef: input.paymentMethodRef,
      });
      return { id: input.paymentId, status: "FAILED", provider: "mock" };
    }
    const row: StoredPayment = {
      status: "AUTHORISED",
      amountPence: input.amountPence,
      paymentMethodRef: input.paymentMethodRef,
      providerRef: `auth_mock_${input.paymentId}`,
    };
    this.store.set(input.paymentId, row);
    return {
      id: input.paymentId,
      status: "AUTHORISED",
      paymentMethodRef: input.paymentMethodRef,
      provider: "mock",
      providerRef: row.providerRef,
    };
  }

  async capture(paymentId: string): Promise<PaymentResult> {
    const row = this.store.get(paymentId);
    if (!row || row.status !== "AUTHORISED") {
      return { id: paymentId, status: row?.status || "FAILED", provider: "mock" };
    }
    const next = { ...row, status: "CAPTURED" as const };
    this.store.set(paymentId, next);
    return { id: paymentId, status: "CAPTURED", provider: "mock", providerRef: row.providerRef };
  }

  async release(paymentId: string): Promise<PaymentResult> {
    const row = this.store.get(paymentId);
    if (!row) return { id: paymentId, status: "AUTHORISATION_RELEASED", provider: "mock" };
    if (row.status === "CAPTURED") return { id: paymentId, status: "CAPTURED", provider: "mock" };
    if (row.status === "REFUNDED" || row.status === "REFUND_PENDING") {
      return { id: paymentId, status: row.status, provider: "mock" };
    }
    const next = { ...row, status: "AUTHORISATION_RELEASED" as const };
    this.store.set(paymentId, next);
    return { id: paymentId, status: "AUTHORISATION_RELEASED", provider: "mock" };
  }

  async refund(paymentId: string): Promise<PaymentResult> {
    const row = this.store.get(paymentId);
    if (!row) return { id: paymentId, status: "FAILED", provider: "mock" };
    if (row.status !== "CAPTURED" && row.status !== "REFUND_PENDING") {
      return { id: paymentId, status: row.status, provider: "mock" };
    }
    const next = { ...row, status: "REFUNDED" as const };
    this.store.set(paymentId, next);
    return { id: paymentId, status: "REFUNDED", provider: "mock" };
  }

  get(id: string): StoredPayment | null {
    return this.store.get(id) || null;
  }

  seed(id: string, row: StoredPayment): void {
    this.store.set(id, row);
  }
}

/**
 * Placeholder for a future Shift4 online/API product.
 * Do not construct this with invented credentials. Physical terminals are out of scope.
 */
export class Shift4OnlinePaymentProvider implements PaymentProvider {
  readonly provider = "shift4_online" as const;

  constructor(private credentials: { secretKey?: string } = {}) {
    if (!credentials.secretKey) {
      throw new Error(
        "Shift4 online payments are not configured. Do not invent API credentials. Keep using MockPaymentProvider until Shift4 issues an online/API product."
      );
    }
  }

  async verifyPaymentMethod(): Promise<PaymentResult> {
    throw new Error("Shift4 online verifyPaymentMethod is not implemented until the API specification is provided.");
  }
  async authorise(): Promise<PaymentResult> {
    throw new Error("Shift4 online authorise is not implemented until the API specification is provided.");
  }
  async capture(): Promise<PaymentResult> {
    throw new Error("Shift4 online capture is not implemented until the API specification is provided.");
  }
  async release(): Promise<PaymentResult> {
    throw new Error("Shift4 online release is not implemented until the API specification is provided.");
  }
  async refund(): Promise<PaymentResult> {
    throw new Error("Shift4 online refund is not implemented until the API specification is provided.");
  }
}

export function createSharePaymentProvider(): PaymentProvider {
  const secret = process.env.SHIFT4_ONLINE_SECRET || "";
  if (secret) {
    return new Shift4OnlinePaymentProvider({ secretKey: secret });
  }
  return new MockPaymentProvider();
}

/** Isolated. The live Share MVP does not construct this provider for customer reservations. */

export function paymentSecuresSeat(status: string): boolean {
  return (
    status === "HOSTED_UNPAID" ||
    status === "HOSTED_PENDING" ||
    status === "HOSTED_PAID" ||
    status === "PAYMENT_METHOD_VERIFIED" ||
    status === "PAYMENT_ACTION_REQUIRED" ||
    status === "AUTHORISATION_PENDING" ||
    status === "AUTHORISED" ||
    status === "CAPTURE_PENDING" ||
    status === "CAPTURED"
  );
}

export function paymentIsOpenAuth(status: string): boolean {
  return status === "AUTHORISED" || status === "AUTHORISATION_PENDING" || status === "CAPTURE_PENDING";
}

export function paymentCanRelease(status: string): boolean {
  return (
    status === "PAYMENT_METHOD_VERIFIED" ||
    status === "PAYMENT_ACTION_REQUIRED" ||
    status === "AUTHORISATION_PENDING" ||
    status === "AUTHORISED" ||
    status === "CAPTURE_PENDING" ||
    status === "PAYMENT_METHOD_REQUIRED"
  );
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
