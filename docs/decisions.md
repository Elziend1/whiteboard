# Decision log (ADR-lite)

## 0001 — Server-authoritative sequence numbers
Clients never assign `seq`. The server is the single writer of ordering.
Why: makes ordering trivial for non-text data, avoids clock-skew bugs.

## 0002 — Last-writer-wins for notes, append-only for strokes
Strokes only ever gain points, so concurrent drawing cannot conflict.
Notes use LWW on `updatedAt`.
Why: a full CRDT is overkill for this shape; LWW is explainable in an interview.

## 0003 — Snapshot + op log (not infinite replay)
The server keeps a compacted snapshot plus ops after it. Reconnecting clients
get whichever is cheaper.
Why: bounded memory and reconnect time.

## 0004 — Test-mode Stripe for billing
Portfolio project. No real cards. The signal is the design (server-side coupon
validation, webhooks, entitlements), not the charge.

## 0005 — Coupons are server-validated, single-use per user
Client sends the code; server returns `{ valid, discount }`. Redemptions table
enforces one-per-user. Stripe coupon objects handle the actual discount math.
