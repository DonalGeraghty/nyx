# Nyx

Nyx is an authenticated nutrition-tracking web application. It turns a plain-language meal description into structured calorie and protein estimates, lets the user review the result, and stores only entries the user chooses to log.

The browser application is backed by [Janus Gate](https://github.com/DonalGeraghty/Janus-Gate), which provides authentication, encrypted per-user AI-provider credential storage, meal analysis, and nutrition-entry persistence.

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
       └─ Janus Gate (Flask API)
            ├─ Firestore: users and nutrition entries
            ├─ Cloud KMS: provider-key encryption
            └─ OpenAI, Mistral AI, or Anthropic: structured meal analysis
```

Nyx is a standard web application. It does not register a service worker, provide an installable PWA shell, or maintain an offline nutrition cache or sync queue.

Nyx never sends meal data or provider credentials directly from the browser to a model vendor. It communicates with Janus Gate over HTTPS and uses a bearer JWT for authenticated requests.

## Tech stack

- React 18
- Vite 5
- React Router
- Recharts
- Motion, Three.js, and OGL
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

Vite prints the local URL when it starts. Development builds also expose a demo sign-in that uses sample data and does not contact Janus Gate.

The API base URL is defined in [`src/config/api.js`](src/config/api.js). Change `API_BASE_URL` there if you need to run the frontend against another Janus Gate deployment.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run Vitest |
| `npm run test:ui` | Open the Vitest UI |
| `npm run test:coverage` | Run Vitest with coverage |

Vitest and Testing Library cover nutrition utilities, AI settings and credential requests, provider selection, model-backed error handling, and recommendation behavior.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Meal analysis and reviewed logging |
| `/data` | Week-paginated, day-grouped nutrition-entry management and full-history CSV export |
| `/charts` | Seven-day calorie and protein trends |
| `/recommendations` | Protein-focused meal planning for the rest of today |
| `/account` | AI provider/model profile, provider API keys, account details, and account deletion |

All application routes use the authenticated layout. Visitors without a valid session see the registration and sign-in screen.

## Janus Gate integration

Nyx uses these API groups:

- `/api/auth/*` for registration, login, session validation, and account deletion
- `/api/user/ai-settings` for the selected provider/model and available provider metadata
- `/api/user/ai-credentials/<provider>` for provider key status, replacement, and removal
- `/api/nutrition/analyze` for structured meal estimates
- `/api/nutrition/recommend` for structured rest-of-day meal recommendations
- `/api/nutrition/entries` for nutrition-entry CRUD

The Data page requests only its selected Monday-to-Sunday period. Local week boundaries are converted to timezone-aware UTC instants before being sent as the entry list's inclusive `start` and exclusive `end` parameters. CSV export uses a separate `all=true` request so the download contains the complete nutrition history without changing the selected weekly view.

The JWT is stored in browser local storage under `dg_auth_token` and attached as an `Authorization: Bearer ...` header. Supplied OpenAI, Mistral AI, and Anthropic keys exist only in their individual component state while being submitted. Janus Gate authenticates and encrypts each key without generating model output; Nyx can retrieve only safe status metadata such as whether a key is configured and its last four characters. Keys can be configured before provider credit is added, while billing and spend-limit errors are reported when an AI request is made.

All three keys can remain configured independently. Janus Gate resolves the saved provider and model when processing meal analysis and recommendation requests, so provider choice and credentials are never added to nutrition request bodies.

Nutrition values are estimates. Analysis results are not persisted until the user selects **Log meal**.

## Production deployment

The GitHub Actions workflow in [`.github/workflows/deploy-gcp.yml`](.github/workflows/deploy-gcp.yml) performs the following:

1. Installs dependencies and builds the Vite application.
2. Packages `dist/` in an Nginx container.
3. Pushes the image to Google Artifact Registry.
4. Deploys the image to Google Cloud Run in `europe-west1`.

The workflow expects a `GCP_SA_KEY` GitHub Actions secret with permission to build, push, and deploy the service.

Nginx serves `index.html` with no-cache headers while keeping fingerprinted static assets immutable.

## Project structure

```text
.
├── public/                 # Website branding assets
├── src/
│   ├── components/         # Shared UI and visual components
│   ├── config/             # Janus Gate API configuration
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

## Related project

- [Janus Gate](https://github.com/DonalGeraghty/Janus-Gate) — Flask API for authentication, encrypted AI-provider credentials, model routing, and nutrition data
