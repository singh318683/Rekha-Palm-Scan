# Rekha — Palm Scan (free version, $0 to run)

Live camera palm scan → hand-shape and finger-ratio measurement via MediaPipe → a
palmistry-style reading generated **entirely in the browser**, no AI API, no server,
no API key, no per-scan cost. Deploys as a pure static site.

## Why this version costs nothing
The reading isn't AI-generated text anymore — it's a template engine. MediaPipe Hands
(free, runs on-device) gives you 21 hand landmark points from the camera feed. The app
turns those into a handful of real, measurable ratios — hand length-to-width, finger
length vs. palm, index/ring finger ratio, finger spread, thumb angle — and maps each
ratio to hand-written palmistry-style copy, with the actual measured numbers woven in
so it still feels personal to that scan. No network request happens after the camera
opens. There is nothing to bill, at any volume.

Trade-off to know about: this reads hand *shape and proportion* (a real branch of
palmistry called chirognomy), not the creases on your skin (life line, heart line,
etc.) — a phone camera and landmark model can't reliably see those. If you later want
true line-based readings, that needs a vision-capable AI model looking at the actual
photo, which is the paid version from before (kept in git history / can bring back on
request).

## What's here
- `index.html` — the entire app. No build step, no dependencies, no backend.

## Deploy to Vercel

1. Push this folder to a GitHub repo, or deploy directly with the CLI (below).
2. vercel.com → **Add New Project** → import the repo. Framework preset: **Other**.
   Leave build command / output directory blank — it's a static file.
3. Deploy. That's it — no environment variables needed.

### Or via CLI
```bash
npm i -g vercel
cd rekha-palm-scan
vercel
vercel --prod
```

Vercel's free tier comfortably covers this — it's one static HTML file with no
serverless functions, so there's no usage-based cost even at high traffic.

## Testing on your phone
- Open your `https://...vercel.app` URL on your phone (HTTPS is automatic on Vercel,
  which camera access requires).
- Allow camera access when prompted.
- Pick your writing hand, then scan starts with your non-dominant hand first (the
  "born with" hand in most palmistry traditions).
- Auto-capture fires once a steady, centered hand is tracked for ~12 frames; there's
  also a manual shutter button.

## What's a placeholder right now
- **Paywall button** shows an alert — no payment processor wired up yet. Since this
  version has no server, you'd add a client-side Stripe Checkout redirect (or move to
  native iOS/Android IAP) when ready — there's no backend cost pushing you to gate it
  early anymore, so you could also just make it fully free with a tip jar instead.
- **Hand-tracking heuristic** (in `onResults`) is a simple centered/sized check — good
  enough to demo, worth tightening once you've tested real capture conditions.
- Nothing is stored anywhere — no accounts, no history between scans.

## Upgrading later
If growth justifies it, you can layer the paid AI-vision version back in as a premium
tier — e.g. free tier gets this shape-based reading, a paid unlock sends the actual
photo to Claude's vision API for a deeper, line-based reading. That version (with the
`api/reading.js` serverless function) is the one from our earlier pass — ask if you
want both bundled together.
