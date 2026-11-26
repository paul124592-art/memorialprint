# MemorialPrint — Premium setup (do this once, before publishing)

## Build status (2026-11-25)

- ✅ App fully built: `src/App.jsx` (editor + canvas renderer + all 5 outputs + Premium gating)
- ✅ `npm install` + `vite build` pass clean; smoke-tested over HTTP (index 200, sitemap 200, element photos 200)
- ✅ Committed locally: git repo on branch `main`, commit `a33e359` (26 files)
- ✅ GitHub connected under `paul124592-art` (evening of 2026-11-25) and repo created: https://github.com/paul124592-art/memorialprint — verified 2026-11-26 03:04 UTC it holds only a README (1 commit). The code push is still pending: the approval card timed out at 2026-11-25 20:01 MST, so nothing has been pushed yet. Local code is committed (`a33e359`, 26 files incl. the 8 element JPEGs in `public/elements/`), but no git remote is configured locally — re-issue the push approval, then upload the 8 JPEGs to `public/elements/` separately if the snapshot push carries text files only.
- ✅ Domain bought: memorialprint.site, registered 2026-11-25 17:52 MST, expires 2027-11-26 (IONOS).
- ❌ No Stripe product created, no Bolt publish (after the push, per the build brief)

Premium is a **$2.99 one-time** unlock, server-verified through Stripe +
Supabase exactly like Merry Paws / SantaList. Nothing here is live yet:
the app ships with a clearly marked placeholder and Premium stays locked
until these three steps are done.

## Step 1 — Create the Stripe product (Stripe Dashboard)

1. Open the **TimePawz** Stripe account (acct_1UZv8ZAOAE9UAaZp).
2. Products → Add product → name **"MemorialPrint Premium"**, price
   **$2.99 one-time** (not a subscription).
3. Copy the price ID. It looks like `price_1...`.

> **PLACEHOLDER:** the code currently contains the string
> `price_REPLACE_WITH_REAL_MEMORIALPRINT_PRICE_ID` in
> `stripe-webhook-supabase/functions/premium/index.ts` (see Step 2).
> Replace that exact string with the real price ID from this step.
> Do NOT invent a price ID — the verify call will reject anything
> that is not a real paid price on the account.

## Step 2 — Teach the Supabase edge function the new price

In `~/workspace/stripe-webhook-supabase/functions/premium/index.ts`,
in the `PRICE_TO_PRODUCT` map, replace the placeholder line:

```ts
// PLACEHOLDER — replace with the real MemorialPrint price ID (Step 1):
price_REPLACE_WITH_REAL_MEMORIALPRINT_PRICE_ID: { product: 'memorialprint', kind: 'one_time' }, // $2.99 once
```

with the real price ID, e.g.:

```ts
price_1AbC...: { product: 'memorialprint', kind: 'one_time' }, // $2.99 once
```

Then redeploy the `premium` edge function in the `pauls-apps`
Supabase project (ref `twjxtucotxgduzkxarjz`).

## Step 3 — Create the Stripe payment link and wire it into the app

1. In Stripe, create a **payment link** for the $2.99 price from Step 1.
2. Set its success redirect to the live app URL with the session id:
   `https://memorialprint.site/?session_id={CHECKOUT_SESSION_ID}`
   (use the bolt.host URL until the custom domain is connected).
3. In Bolt (Domains & Hosting → Environment variables) set:
   - `VITE_SUPABASE_URL=https://twjxtucotxgduzkxarjz.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=` (the pauls-apps anon key)
   - `VITE_STRIPE_PAYMENT_LINK=` (the link from this step)
4. Rebuild/republish. After a test payment the app verifies the
   session server-side and unlocks Premium in that browser.

## How Premium is checked (for reference)

- `src/lib/premium.js` mirrors Merry Paws: after payment the app
  calls the `premium` edge function with `action: 'verify'` and the
  Stripe session id; the server asks Stripe whether that session
  really paid for the memorialprint price, records an entitlement row,
  and returns `{ premium: true, product: 'memorialprint' }`.
- On every load the app calls `action: 'check'` with the stored
  session token. The server is the only authority — no localStorage
  flag is ever trusted on its own.

## What is NOT done yet

- [ ] Stripe product + real price ID (Step 1)
- [ ] Edge-function mapping + redeploy (Step 2)
- [ ] Payment link + Bolt env vars (Step 3)
- [ ] Custom domain (memorialprint.site — not bought yet)
- [ ] End-to-end live checkout test ($2.99 → unlock → reload still unlocked)
