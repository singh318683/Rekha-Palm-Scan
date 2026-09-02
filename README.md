# Rekha — Palm Scan (real line reading, AI vision)

Live camera palm scan → the actual photo is sent to Claude's vision API, which reads
the real creases in your hand — life line (health), heart line, head line
(intelligence), fate/money line — and generates a grounded reading from what it
actually sees, not just hand shape.

## Cost
Each scan = one Claude API vision call (~1400 max output tokens). At current published
rates this is a small fraction of a cent per scan — see console.anthropic.com or
docs.claude.com for exact current pricing, since rates can change. The thing to watch
isn't per-scan cost, it's total traffic before a paywall is live (see TESTING_MODE
below).

## Testing mode — everything unlocked right now
Near the top of the inline `<script>` in `index.html`:
```js
const TESTING_MODE = true;
```
While `true`, every reading section shows in full with no paywall — good for testing
the whole flow end to end. Flip it to `false` to bring back the free-preview (first 2
sections) + "$3.99 to unlock" paywall on the rest.

## What's here
- `index.html` — camera capture, hand-guide overlay, onboarding, a quick local hand-shape
  preview, the AI reading, and a second-hand comparison flow.
- `api/reading.js` — Vercel serverless function that sends one captured photo to Claude's
  vision API and returns a structured reading (life line, heart line, head line, fate line).
- `api/compare.js` — sends both hands' photos in one call and returns a "born with vs.
  self-made" comparison, line by line.
- `package.json` — minimal, no dependencies required.

## The flow
1. Pick your writing hand.
2. Scan starts with your non-dominant hand (auto-captures after a steady ~2.6s hold).
3. Instant local preview (hand shape, finger length) — no API call yet.
4. Tap "Start your analysis" → real AI reading of that hand's actual lines.
5. Prompted to scan the other hand too, or stop there.
6. Once both hands are scanned, a "Compare: God-Gifted vs. Self-Made" button appears,
   which sends both photos in a single call and returns a line-by-line comparison.

## Deploy to Vercel

1. Push this folder to a GitHub repo, or deploy directly via the CLI (below).
2. vercel.com → **Add New Project** → import the repo. Framework preset: **Other**.
   Leave build command / output directory blank.
3. Before deploying: **Project Settings → Environment Variables** →
   add `ANTHROPIC_API_KEY` = your key from console.anthropic.com.
   Apply to Production, Preview, and Development.
4. Deploy.

### Or via CLI
```bash
npm i -g vercel
cd rekha-palm-scan
vercel
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

## Testing on your phone
- Open your `https://...vercel.app` URL on your phone — HTTPS is automatic on Vercel,
  which camera access requires.
- Allow camera access when prompted.
- Pick your writing hand; scan starts with your non-dominant hand first (the "born
  with" hand in most palmistry traditions).
- Auto-capture fires once a steady, centered hand is tracked for ~12 frames; there's
  also a manual shutter button.

## What's still a placeholder
- **Paywall button** (once `TESTING_MODE` is off) shows an alert instead of real
  checkout — wire it to Stripe Checkout or native IAP when ready.
- Nothing is stored anywhere — no accounts, no history between scans.
- The model is honest when a line (especially the fate/Sun line, which many hands
  don't have a strong version of) isn't clearly visible, rather than inventing detail
  — worth knowing so a "faint fate line" result doesn't look like a bug.
