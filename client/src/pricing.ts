import type { CouponCheckResponse } from '../../protocol/src/index';

const BASE_PRICE = 1200;
let currentValidCoupon: string | null = null;

const form = document.getElementById('coupon-form') as HTMLFormElement;
const input = document.getElementById('coupon-input') as HTMLInputElement;
const msg = document.getElementById('coupon-message') as HTMLParagraphElement;
const priceEl = document.getElementById('pro-price') as HTMLDivElement;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = input.value.trim();
  if (!code) return;
  msg.textContent = 'Checking...';

  try {
    const res = await fetch('/api/coupons/check', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, plan: 'pro' }),
    });
    const data: CouponCheckResponse = await res.json();

    if (data.valid) {
      msg.textContent = `Coupon applied! ${data.percentOff}% off.`;
      msg.style.color = '#008a05';
      const finalDollars = (data.finalPriceCents! / 100).toFixed(2);
      priceEl.innerHTML = `<s style="color:#888;font-size:1rem;font-weight:normal;">$${(BASE_PRICE/100).toFixed(2)}</s> $${finalDollars}<span style="font-size:1rem; color:#888;">/mo</span>`;
      currentValidCoupon = code;
    } else {
      msg.textContent = `Invalid: ${data.reason}`;
      msg.style.color = '#e00';
      currentValidCoupon = null;
      priceEl.innerHTML = `$12<span style="font-size:1rem; color:#888;">/mo</span>`;
    }
  } catch (err) {
    msg.textContent = 'Error checking coupon.';
    msg.style.color = '#e00';
  }
});

document.getElementById('checkout-btn')?.addEventListener('click', () => {
  // SIMULATE STRIPE CHECKOUT
  const btn = document.getElementById('checkout-btn') as HTMLButtonElement;
  btn.textContent = 'Processing...';
  btn.disabled = true;

  setTimeout(() => {
    // 1. Set user to Pro in local storage
    localStorage.setItem('isPro', 'true');
    
    // 2. Alert and redirect back to dashboard
    alert(`🎉 Payment successful! (Coupon: ${currentValidCoupon || 'None'})\n\nWelcome to Pro. Premium features unlocked.`);
    window.location.href = '/';
  }, 1500);
});