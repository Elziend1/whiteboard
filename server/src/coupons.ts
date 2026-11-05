import type { CouponCheckResponse, PlanId } from '../../protocol/src/index';

// In a real app, this would be in SQLite.
// We seed one coupon here for testing.
const COUPONS = [
  { code: 'LAUNCH20', percentOff: 20, maxUses: 100, uses: 0, expiresAt: null },
  { code: 'VIP50', percentOff: 50, maxUses: 10, uses: 0, expiresAt: null },
];

export function validateCoupon(code: string, plan: PlanId, basePriceCents: number): CouponCheckResponse {
  const normalized = code.trim().toUpperCase();
  const coupon = COUPONS.find(c => c.code === normalized);

  if (!coupon) {
    return { valid: false, reason: 'unknown' };
  }

  if (coupon.uses >= coupon.maxUses) {
    return { valid: false, reason: 'exhausted' };
  }

  // Calculate discount
  const discount = Math.floor(basePriceCents * (coupon.percentOff / 100));
  const finalPriceCents = basePriceCents - discount;

  return {
    valid: true,
    percentOff: coupon.percentOff,
    finalPriceCents,
  };
}