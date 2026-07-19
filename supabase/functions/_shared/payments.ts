export interface CheckoutInput { registrationId: string; amount: number; description: string }
export interface CheckoutResult { checkoutUrl: string; providerRef: string }
export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
}

/** Dev/local provider — no real PayMongo. Serves a hosted sandbox checkout page. */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";
  constructor(private functionsUrl: string) {}
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    return {
      checkoutUrl: `${this.functionsUrl}/fake-checkout?rid=${input.registrationId}`,
      providerRef: `fake_${input.registrationId}`,
    };
  }
}

// Swap point when PayMongo is ready: return a PayMongoProvider when PAYMONGO_SECRET is set.
export function getPaymentProvider(): PaymentProvider {
  const base = Deno.env.get("PUBLIC_FUNCTIONS_URL") ?? "http://127.0.0.1:54521/functions/v1";
  return new FakePaymentProvider(base);
}
