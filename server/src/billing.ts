// TODO(M5): Stripe test mode.
//   POST /api/checkout   { plan, couponCode } -> creates a Checkout Session
//   POST /api/stripe/webhook -> checkout.session.completed / subscription.deleted
//   Handle webhook idempotency (Stripe retries).
export {};
