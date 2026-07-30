# Build-A-Politician

A fictional political simulation game. Students design a candidate, then an AI acting as a
nonpartisan polling analyst returns a simulated election report: approval rating, head-to-head
poll, voter breakdown by age / political lean / location, strengths, weaknesses, and campaign events.

Live site: **bap.tpvan.com**

---

## Quick start

```bash
npm install          # installs the Vercel CLI (dev only)
cp .env.example .env.local
# paste your OpenAI key into .env.local
npm run dev          # http://localhost:3000
```

Run the test suite (no API key or browser needed):

```bash
npm test
```

You can also just open `index.html` directly in a browser. The AI backend will not exist, so the
site falls back to its built-in offline model and says so on screen.

---

## Why a backend was necessary

**GitHub Pages cannot do this.** Pages serves static files only — it cannot run server code and it
cannot hold a secret. Anything the browser can read, a visitor can read. Putting an OpenAI key in
a `.js` file, in an HTML attribute, or in a "hidden" config file on Pages means publishing it: the
key is in the page source, in the network tab, and in the public GitHub repo. Keys found this way
get scraped and used within hours, and the charges land on your card.

The fix is a **server-side proxy**. The browser sends only the candidate profile. A small function
running on a server adds the secret key and talks to OpenAI. The key exists only in that function's
environment and is never sent to the browser.

```
Browser                     Vercel Function                 OpenAI
   |                              |                            |
   |-- POST /api/simulate ------->|                            |
   |   { candidate }              |-- adds OPENAI_API_KEY ---->|
   |                              |<-- JSON report ------------|
   |<-- validated report ---------|                            |
```

### Hosting: why Vercel

| Option | Verdict |
|---|---|
| **Vercel** | Chosen. Free tier, deploys from the same GitHub repo, any file in `/api` becomes a serverless function automatically, environment variables are stored server-side, custom domains are free. No build step needed for a static site like this one. |
| GitHub Pages alone | Impossible. No server, no secrets. |
| GitHub Pages + Cloudflare Worker | Works, but means two deploy targets, two dashboards, and CORS configuration. More to explain and more to break. |
| Netlify | Equivalent to Vercel. Functions live in `/netlify/functions` instead of `/api`. |

Everything in this repo still works as a plain static site — moving to Vercel adds a backend
without taking anything away.

### How the key is protected

1. It lives only in the `OPENAI_API_KEY` environment variable, set in the Vercel dashboard.
2. It is read only inside `api/simulate.js`, which runs on the server. No client file references it.
3. `.env`, `.env.local`, and `.env.*.local` are gitignored, so a real key cannot be committed.
4. `api/simulate.js` rate-limits to 12 requests per minute per IP, caps input field lengths, and
   rejects anything that is not a POST with a named candidate.
5. If you ever paste a key somewhere public, revoke it at
   <https://platform.openai.com/api-keys> — rotating is free, cleanup is not.

---

## Deploying

### First time

1. Push this repo to GitHub.
2. Go to <https://vercel.com/new>, sign in with GitHub, and import the repo.
3. Framework preset: **Other**. Leave build command and output directory empty — this is a static
   site with serverless functions.
4. Before clicking Deploy, open **Environment Variables** and add:
   - Name `OPENAI_API_KEY`, value your key from <https://platform.openai.com/api-keys>
   - Apply it to Production, Preview, and Development.
5. Deploy.

### Custom domain (bap.tpvan.com)

In the Vercel project: **Settings → Domains → Add** `bap.tpvan.com`, then update the CNAME record
at your DNS provider to point at Vercel instead of GitHub Pages. Keep the `CNAME` file in the repo
only if you also want the GitHub Pages copy to keep working; Vercel ignores it.

### After the first deploy

Every push to your default branch redeploys automatically.

### Accounts you need

- **GitHub** — hosts the code. Free.
- **Vercel** — hosts the site and the function. Free Hobby tier is plenty for a class.
- **OpenAI Platform** — provides the API key, and requires a payment method with credits.
  This is the only paid piece. At the default `gpt-4o-mini`, a simulation costs a fraction of a
  cent; a class of thirty students running ten simulations each costs well under a dollar.
  Set a **monthly budget limit** in the OpenAI billing settings so it can never surprise you.

---

## What changed in this version

### New files

| File | Purpose |
|---|---|
| `api/simulate.js` | Serverless function. Holds the key, calls OpenAI, validates and repairs the response, falls back to the offline model on any failure. |
| `api/_prompt.js` | The analyst system prompt and the strict JSON schema. Edit the prompt here. |
| `js/simulation-engine.js` | The offline model. Runs in both the browser and Node so the same code backs up both the front end and the server. |
| `js/report.js` | Renders a result object into HTML. Shared by the simulator and results pages so they cannot drift apart. |
| `scripts/test-simulation.js` | 81 assertions covering the engine, the handler, response repair, input sanitising, and political neutrality. |
| `vercel.json`, `package.json`, `.env.example`, `.gitignore` | Deployment and configuration. |
| `assets/**` | Eight SVGs that every page referenced but which were missing from the repo — every image on the site was a broken link. |

### Rewritten

- **`create.html` + `js/builder.js`** — rebuilt as a character creator. Eight fields
  (name, age, party, occupation before politics, home state, top issue, slogan, about), tile
  pickers instead of dropdowns, an age scrubber, a guided About box with clickable question
  prompts and a sentence counter, a live candidate card, and a completion meter.
- **`simulator.html` + `js/simulator.js`** — now the AI simulation page with a
  **Run Election Simulation** button, a thinking state, and the full report.
- **`results.html` + `js/results.js`** — **this page was broken.** `results.html` was a
  byte-for-byte duplicate of `simulator.html`, so none of the elements `results.js` looked for
  existed and the page never rendered. Rewritten properly.
- **`opponent.html` + `js/opponent.js`** — updated to the new schema. Choosing an opponent is now
  optional; skip it and the analyst invents one.
- **`js/data.js`** — new candidate schema, parties, 12 top issues, 23 occupations, and all 25
  pre-built politicians rewritten with real 3–5 sentence biographies.
- **`js/app.js`** — added `CandidateUI`, the shared card/tile/validation helpers.
- **`css/style.css`** — added the creator and report styles. Existing tokens and look untouched.

### Removed

The old trait-slider and policy-chip system, and the state-by-state electoral-college animation
that depended on them. Both were replaced by the AI analysis, as agreed.

---

## The candidate schema

Every candidate everywhere — student-built, custom opponent, or roster character — is this object:

```json
{
  "name": "John Carter",
  "age": 46,
  "party": "Independent",
  "occupation": "Small Business Owner",
  "state": "Texas",
  "topIssue": "Economy",
  "slogan": "Common Sense. Real Results.",
  "about": "John Carter is a blunt, confident leader who...",
  "logoColor": "#c8102e"
}
```

## The response shape

```json
{
  "source": "ai",
  "candidate_name": "John Carter",
  "opponent_name": "Marla Whitfield",
  "projection": "Narrow Win",
  "approval_rating": { "approve": 52, "disapprove": 38, "unsure": 10 },
  "poll_results":    { "candidate": 51, "opponent": 44, "undecided": 5 },
  "demographics": {
    "age":      [{ "group": "18-29", "support": 47, "note": "why" }],
    "lean":     [{ "group": "Moderate", "support": 58, "note": "why" }],
    "location": [{ "group": "Rural", "support": 61, "note": "why" }]
  },
  "strengths":  [{ "title": "...", "detail": "..." }],
  "weaknesses": [{ "title": "...", "detail": "..." }],
  "events":     [{ "headline": "...", "detail": "...", "impact": 3, "affected": "Undecided voters" }],
  "analyst_summary": "..."
}
```

The function guarantees this shape before it reaches the browser: percentages are forced to total
exactly 100, missing voter groups are filled in, out-of-range values are clamped, and an invalid
projection is recalculated from the margin. If the model returns something unusable, the offline
model answers instead.

---

## On neutrality

The analyst is told, in the system prompt, that no party, ideology, or issue position is inherently
more popular, more moral, or more electable than any other; that a party label may change *which
voter blocs start friendly* but must never change the overall score; and that it may not name real
politicians or comment on real political positions.

The offline model enforces the same rule structurally rather than by instruction: a candidate's
party is deliberately excluded from the random seed and from every score, so changing only the party
label produces an identical headline number with a different demographic breakdown. `npm test`
asserts this directly.

The one content-based bonus is whether the chosen issue fits the candidate's previous job — a nurse
running on healthcare starts with earned authority a nurse running on national security does not.
It is capped, symmetric, available to every candidate, and explained in the report text.

---

## Disclaimer

Every voter, poll, percentage, and campaign event this site produces is invented. Nothing here
describes, predicts, or comments on a real election, a real person, or a real political party.
It is a teaching tool for understanding what the parts of a campaign are, not a forecasting model.
