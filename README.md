# MemorialPrint

> "Add the pieces that made them who they were."

A blank-canvas memorial designer. A grieving family starts with a blank
canvas and builds a memorial piece: their loved one's photo, their name
in a font they choose, and the pieces that made them who they were — a
cross, doves, flowers, candles — all real photographs, never cartoons.

## What it makes

- **Poster / wall hanging** — print size, free
- **Funeral program pamphlet** — bifold PDF: cover, order of service, obituary & poem, thank-you note
- **Invitation** for the service
- **Celebration-of-life keepsakes** — prayer-card style
- **T-shirt design** — the same design as a print-ready file

One set of details (photo, name, dates, service info) feeds all of them.

## Privacy

Your loved one's photo is processed right in your browser and never
uploaded anywhere. Nothing you make is stored on a server.

## Pricing

Free: poster output, two photo elements, two fonts, 5 downloads a day.
Premium is a **$2.99 one-time** unlock for every element, every font
and every output, server-verified through Stripe + Supabase (same
pattern as Merry Paws). See `SETUP.md` — the real Stripe price ID is
not in the code yet; the placeholder is clearly marked there.

## Stack

React + Vite + Tailwind. `npm install && npm run build`.

## Status

- [x] App built (v1)
- [x] Domain bought: memorialprint.site (registered 2026-11-25, IONOS)
- [x] GitHub connected; repo created (README only so far — code push pending approval, timed out 2026-11-25 20:01 MST)
- [ ] Push code to GitHub (re-issue approval; upload the 8 element JPEGs separately if needed)
- [ ] Stripe product + price ID (see SETUP.md)
- [ ] Payment link + Bolt env vars
- [ ] Publish to Bolt + connect memorialprint.site + end-to-end checkout test
