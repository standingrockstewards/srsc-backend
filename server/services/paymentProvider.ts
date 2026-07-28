/**
 * server/services/paymentProvider.ts  (Brick 5)
 *
 * Payment provider interface — Stripe stub.
 * Real Stripe keys are NOT required or used. This interface defines the contract
 * that the Stripe integration will implement in a future brick.
 *
 * To wire real Stripe:
 *   1. Set STRIPE_SECRET_KEY in Render env vars.
 *   2. Replace StripeStubProvider with a real StripeProvider implementing IPaymentProvider.
 *   3. Swap the export at the bottom — no other files change.
 */

export interface TopUpRequest {
  propertyId:   number;
  customerId:   number;
  amountCents:  number;        // always in cents to avoid float issues
  description?: string;
}

export interface TopUpResult {
  success:         boolean;
  providerRef:     string;     // Stripe PaymentIntent id (stub: mock value)
  amountCents:     number;
  errorMessage?:   string;
}

export interface IPaymentProvider {
  initiateTopUp(req: TopUpRequest): Promise<TopUpResult>;
}

// ── Stub (development / pre-Stripe) ──────────────────────────────────────────
class StripeStubProvider implements IPaymentProvider {
  async initiateTopUp(req: TopUpRequest): Promise<TopUpResult> {
    // Stub always succeeds. Replace this with real Stripe PaymentIntent creation.
    console.info(`[paymentProvider:stub] topup ${req.amountCents}¢ for property ${req.propertyId}`);
    return {
      success:     true,
      providerRef: `stub_pi_${Date.now()}_${req.propertyId}`,
      amountCents: req.amountCents,
    };
  }
}

export const paymentProvider: IPaymentProvider = new StripeStubProvider();
