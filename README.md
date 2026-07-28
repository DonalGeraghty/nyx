# Nyx AI

Nyx AI is an authenticated nutrition-tracking web application. It turns a plain-language meal description into structured calorie and protein estimates, lets the user review the result, and stores only entries the user chooses to log.

The browser application is backed by [Janus Gate](https://github.com/DonalGeraghty/Janus-Gate), which provides authentication, encrypted per-user OpenAI credential storage, meal analysis, and nutrition-entry persistence.

## Features

- Account registration, sign-in, sign-out, and permanent account deletion
- Development-only demo account with local sample data
- Bring-your-own-key OpenAI integration
- AI-assisted meal analysis with structured, reviewable results
- Manual creation, editing, and deletion of nutrition entries
- CSV export of nutrition history
- Seven-day calorie and protein charts
- AI meal recommendations based on today's nutrition and personal targets
- Responsive navigation and installable-app metadata

## Architecture

```text
Browser
  └─ Nyx AI (React/Vite)
       └─ Janus Gate (Flask API)
            ├─ Firestore: users and nutrition entries
            ├─ Cloud KMS: OpenAI key encryption
            └─ OpenAI API: structured meal analysis
```

Nyx AI never sends meal data directly to OpenAI. It communicates with Janus Gate over HTTPS and uses a bearer JWT for authenticated requests.

## Tech stack

- React 18
- Vite 5
- React Router
- Recharts
- Motion, Three.js, and OGL
- Vitest and Testing Library tooling

## Local development

### Requirements

- Node.js 18 or newer
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

The Vitest tooling is configured, but this repository does not currently contain test files.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Meal analysis and reviewed logging |
| `/data` | Nutrition-entry management and CSV export |
| `/charts` | Seven-day calorie and protein trends |
| `/recommendations` | Protein-focused meal planning for the rest of today |
| `/account` | OpenAI key status, account details, and account deletion |

All application routes use the authenticated layout. Visitors without a valid session see the registration and sign-in screen.

## Janus Gate integration

Nyx AI uses these API groups:

- `/api/auth/*` for registration, login, session validation, and account deletion
- `/api/user/openai-key` for OpenAI key status, replacement, and removal
- `/api/nutrition/analyze` for structured meal estimates
- `/api/nutrition/recommend` for structured rest-of-day meal recommendations
- `/api/nutrition/entries` for nutrition-entry CRUD

The JWT is stored in browser local storage under `dg_auth_token` and attached as an `Authorization: Bearer ...` header. A supplied OpenAI key exists in component state only while it is being submitted. Janus Gate verifies and encrypts the key; Nyx AI can retrieve only safe status metadata.

Nutrition values are estimates. Analysis results are not persisted until the user selects **Log meal**.

## Installable app metadata

Static application assets live in `public/`. The web-app manifest is [`public/manifest.webmanifest`](public/manifest.webmanifest), with standard, Apple touch, and Android maskable icons under `public/icons/`.

The manifest enables standalone home-screen presentation on supported devices. The application does not currently include a service worker or offline mode.

## Production deployment

The GitHub Actions workflow in [`.github/workflows/deploy-gcp.yml`](.github/workflows/deploy-gcp.yml) performs the following:

1. Installs dependencies and builds the Vite application.
2. Packages `dist/` in an Nginx container.
3. Pushes the image to Google Artifact Registry.
4. Deploys the image to Google Cloud Run in `europe-west1`.

The workflow expects a `GCP_SA_KEY` GitHub Actions secret with permission to build, push, and deploy the service.

## Project structure

```text
.
├── public/                 # Manifest, favicon, and installable-app icons
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

- [Janus Gate](https://github.com/DonalGeraghty/Janus-Gate) — Flask API for authentication, encrypted OpenAI credentials, and nutrition data
