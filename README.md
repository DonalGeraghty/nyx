# Nyx

Nyx is an authenticated nutrition-tracking web application. It turns a plain-language meal description into structured calorie and protein estimates, lets the user review the result, and stores only entries the user chooses to log.

The browser application is backed by [Janus API](https://github.com/DonalGeraghty/janus-api), which provides authentication, encrypted per-user AI-provider credential storage, meal analysis, and nutrition-entry persistence. The same Janus account, encrypted AI-provider credentials, and provider/model selection are shared with the sibling apps [Aether](https://github.com/DonalGeraghty/aether) (workouts) and [Minerva](https://github.com/DonalGeraghty/minerva) (flashcards). See [Overall architecture](#overall-architecture) below for how the four services fit together.

## Features

- Account registration, sign-in, sign-out, and permanent account deletion
- Development-only demo account with local sample data
- Bring-your-own-key OpenAI, Mistral AI, and Claude (Anthropic) integrations
- Per-user AI provider and model selection
- AI-assisted meal analysis with structured, reviewable results
- Manual creation, editing, and deletion of nutrition entries
- Monday-to-Sunday nutrition history grouped by local day
- Seven-day period navigation and full-history CSV export
- Seven-day calorie and protein charts
- AI meal recommendations based on today's nutrition and personal targets

## Architecture

```text
Browser
  └─ Nyx (React/Vite)
       └─ Janus API (Flask)
            ├─ Firestore: users and nutrition entries
            ├─ Cloud KMS: provider-key encryption
            └─ OpenAI, Mistral AI, or Anthropic: structured meal analysis
```

Nyx is a standard web application. It does not register a service worker, provide an installable PWA shell, or maintain an offline nutrition cache or sync queue. (The `idb` dependency and `public/manifest.webmanifest` are unused legacy artifacts from a removed PWA/offline-sync feature.)

Nyx never sends meal data or provider credentials directly from the browser to a model vendor. It communicates with Janus API over HTTPS and uses a bearer JWT for authenticated requests.

## Tech stack

- React 19
- Vite 8
- React Router
- Recharts
- Motion and OGL
- Vitest and Testing Library tooling

## Local development

### Requirements

- Node.js 22 or newer (Node.js 24 LTS recommended)
- npm

Install dependencies and start Vite:

```bash
npm install
npm run dev
```

Vite prints the local URL when it starts. Development builds also expose a demo sign-in that uses sample data and does not contact Janus API.

The API base URL is defined in [`src/config/api.js`](src/config/api.js) and defaults to the deployed Janus API. Copy `.env.example` to `.env` when running Janus API locally. Otherwise Nyx uses the deployed Janus API.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run check` | Run ESLint and Vitest once and exit (used by CI) |
| `npm run test:ui` | Open the Vitest UI |
| `npm run test:coverage` | Run Vitest with coverage |
| `npm run icons` | Regenerate the favicon, Apple touch icon, and UI icons from `artwork/Nyx-icon-source.png` |

Vitest and Testing Library cover nutrition utilities, AI settings and credential requests, provider selection, model-backed error handling, and recommendation behavior. The production build also verifies that development-only demo fixtures are absent and that public icon assets stay within their size budgets.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Meal analysis and reviewed logging |
| `/data` | Week-paginated, day-grouped nutrition-entry management and full-history CSV export |
| `/charts` | Seven-day calorie and protein trends |
| `/recommendations` | Protein-focused meal planning for the rest of today |
| `/account` | AI provider/model profile, provider API keys, account details, and account deletion |

All application routes use the authenticated layout. Visitors without a valid session see the registration and sign-in screen.

## Janus API integration

Nyx uses these API groups:

- `/api/auth/*` for registration, login, session validation, and account deletion
- `/api/user/ai-settings` for the selected provider/model and available provider metadata
- `/api/user/ai-credentials/<provider>` for provider key status, replacement, and removal
- `/api/nutrition/analyze` for structured meal estimates
- `/api/nutrition/recommend` for structured rest-of-day meal recommendations
- `/api/nutrition/entries` for nutrition-entry CRUD

The Data page requests only its selected Monday-to-Sunday period. Local week boundaries are converted to timezone-aware UTC instants before being sent as the entry list's inclusive `start` and exclusive `end` parameters. CSV export uses a separate `all=true` request so the download contains the complete nutrition history without changing the selected weekly view.

The JWT is stored in browser local storage under `dg_auth_token` and attached as an `Authorization: Bearer ...` header. Supplied OpenAI, Mistral AI, and Anthropic keys exist only in their individual component state while being submitted. Janus API authenticates and encrypts each key without generating model output; Nyx can retrieve only safe status metadata such as whether a key is configured and its last four characters. Keys can be configured before provider credit is added, while billing and spend-limit errors are reported when an AI request is made.

All three keys can remain configured independently. Janus API resolves the saved provider and model when processing meal analysis and recommendation requests, so provider choice and credentials are never added to nutrition request bodies.

Nutrition values are estimates. Analysis results are not persisted until the user selects **Log meal**.

## Production deployment

The production container builds the Vite application with Node 24 and serves it through nginx on port `8080`, including SPA fallback, immutable caching for hashed assets, and a `/health` endpoint.

```bash
docker build -t nyx .
docker run --rm -p 8080:8080 nyx
```

The GitHub Actions workflow at [`.github/workflows/deploy-gcp.yml`](.github/workflows/deploy-gcp.yml) checks every pull request (`npm run check`) and, on pushes to `main`/`master` or a manual run, builds the container with the `VITE_JANUS_API_URL` build argument, pushes SHA and `latest` tags to the `nyx` Artifact Registry repository, deploys it to Cloud Run with startup and liveness probes against `/health`, and smoke-tests the deployed URL.

Configure this repository before the first workflow run:

- Preferred repository variable `GCP_WORKLOAD_IDENTITY_PROVIDER`: the full Google Workload Identity Provider resource name. When set, the workflow uses keyless GitHub OIDC authentication.
- Optional repository variable `GCP_SERVICE_ACCOUNT`: the deployer service account used with Workload Identity Federation. It defaults to `nyx-github-deployer@donal-geraghty-home.iam.gserviceaccount.com`.
- Fallback repository secret `GCP_SA_KEY`: a service-account JSON key. The workflow uses this only while `GCP_WORKLOAD_IDENTITY_PROVIDER` is unset — this is how the existing deployment already authenticates.
- Optional repository variable `VITE_JANUS_API_URL`: defaults to the current deployed Janus API URL when omitted.
- Optional repository variable `CLOUD_RUN_SERVICE_ACCOUNT`: a dedicated runtime identity such as `nyx-runtime@donal-geraghty-home.iam.gserviceaccount.com`. Until set, Cloud Run retains its current runtime identity.

Nginx serves `index.html` with no-cache headers while keeping fingerprinted static assets immutable.

## Project structure

```text
.
├── public/                 # Website branding assets
├── src/
│   ├── components/         # Shared UI and visual components
│   ├── config/             # Janus API configuration
│   ├── context/            # Authentication state
│   ├── data/               # Development demo data
│   ├── pages/              # Route-level screens
│   ├── services/           # Credential and nutrition API clients
│   ├── utils/              # CSV and nutrition helpers
│   ├── App.jsx             # Routing and authenticated layout
│   ├── main.jsx            # React entry point
│   └── styles.css          # Global application styles
├── index.html
├── package.json
└── vite.config.js
```

## Related projects

- [Janus API](https://github.com/DonalGeraghty/janus-api) — Flask API for authentication, encrypted AI-provider credentials, model routing, and nutrition/workout/flashcard data
- [Aether](https://github.com/DonalGeraghty/aether) — sibling frontend for workout tracking
- [Minerva](https://github.com/DonalGeraghty/minerva) — sibling frontend for AI-assisted flashcards

## Overall architecture

Nyx is one of three independently deployed React/Vite frontends built around a single shared backend, [Janus API](https://github.com/DonalGeraghty/janus-api). All four services run as separate Cloud Run services in the same Google Cloud project (`donal-geraghty-home`, region `europe-west1`).

```text
Aether (React/Vite, Cloud Run)   ─┐
Minerva (React/Vite, Cloud Run)  ─┼─▶ Janus API (Flask, Cloud Run) ─┬─▶ Firestore
Nyx (React/Vite, Cloud Run)      ─┘                                 │     (users, credentials, nutrition,
                                                                     │      workouts, flashcards)
                                                                     ├─▶ Cloud KMS
                                                                     │     (encrypts each user's provider key)
                                                                     ├─▶ OpenAI / Mistral AI / Anthropic
                                                                     │     (called with the user's own key)
                                                                     └─▶ Cloud Scheduler
                                                                           (Web Push reminders, every 5 minutes)
```

- All three frontends build the same way: a Node build stage produces a Vite bundle, served by an `nginx:alpine` container on port `8080` with SPA fallback and immutable asset caching. Each commits its own `Dockerfile`/`nginx.conf` and has its own Artifact Registry repository and its own `deploy-gcp.yml` workflow that builds, pushes, and runs `gcloud run deploy`, preferring Workload Identity Federation with a `GCP_SA_KEY` secret as a fallback.
- Janus API deploys differently: it builds directly from source with `gcloud run deploy --source .`, so it has no Artifact Registry step and authenticates with a static `GCP_SA_KEY` secret rather than the Workload Identity Federation the three frontends prefer.
- Nyx points at Janus API via the `VITE_JANUS_API_URL` build argument (see "Local development" above). Because Aether and Minerva point at the same Janus API deployment and Firestore project, a single account's login session, encrypted AI-provider keys, and selected provider/model are shared across all three apps — only each app's own nutrition, workout, or flashcard data stays separate.
- Nyx calls Janus API's `/api/nutrition/*` endpoints plus the shared `/api/auth/*` and `/api/user/*` endpoints for account and AI-credential management. Aether and Minerva call their own equivalent endpoints on the same backend.
