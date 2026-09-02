# ApplyDesk deployment guide

This guide deploys the frontend to GitHub Pages and the API to Railway with Railway PostgreSQL. Deploy the two ZIP files as two separate GitHub repositories unless you are already comfortable configuring monorepo root directories.

## What this release includes

- Responsive dashboard, registration/login, encrypted profile, CV and cover-letter library, job tracks, review queue, applications table, saved answers, Gmail inbox, and integrations screen.
- Express/TypeScript API, Prisma migrations, PostgreSQL data model, CORS allow-listing, Helmet security headers, request and login rate limits, upload limits, and graceful shutdown.
- Official Reed and Adzuna discovery connectors.
- Manual vacancy entry for jobs found elsewhere.
- Direct Gmail applications and replies, plus inbox synchronisation and basic reply/interview/rejection classification.
- Railway Cron entry point for repeated discovery and eligible auto-applications.

## Deliberate limits

ApplyDesk does **not** automate LinkedIn, Indeed, Totaljobs, CV-Library, Google Jobs, Workday, or arbitrary employer forms. Those services do not provide a general candidate auto-apply API, and browser automation would be fragile, risk account suspension, and often require defeating CAPTCHAs or terms of service. Their vacancies can still be added manually, scored, tracked, and opened from the dashboard.

Travel filtering is a source-level approximation, not live route planning. Reed receives a radius derived from the track's maximum travel time, while Adzuna receives the town or postcode. ApplyDesk does not currently calculate public-transport or driving journey times; verify the location before applying.

Auto-submission is limited to direct-email vacancies. A job must have an application email, score at least 90, belong to a track explicitly set to **Auto**, have an assigned CV, and have Gmail connected. Everything else goes through review or opens the employer's form for you.

This is a deployable private beta, not a finished public SaaS. It does not yet include email verification, password reset, administrator tools, billing, legal policy pages, data export/deletion workflows, object storage for large-scale document volume, or Google OAuth verification. Add those before inviting the public.

## 1. Create the backend repository

1. Extract `applydesk-backend.zip`.
2. Create an empty GitHub repository, for example `applydesk-backend`.
3. Upload the extracted files so `package.json`, `Dockerfile`, `src/`, and `prisma/` are at the repository root.
4. Commit and push to the `main` branch.

Do not commit `.env`. The repository contains only `.env.example`.

## 2. Create Railway PostgreSQL and the API

1. In Railway, create a new project.
2. Add a **PostgreSQL** database service. Keep its default service name `Postgres`, or substitute your chosen name in the variable reference below.
3. Add a new service from your backend GitHub repository.
4. Railway should detect the root `Dockerfile`. Leave custom build and start commands empty; the image starts with `npm start`, which applies committed Prisma migrations before opening the API.
5. In the API service's **Settings → Networking**, generate a public Railway domain. Copy the HTTPS URL.
6. In **Settings → Healthcheck**, set the path to `/health`. Do not set a fixed port: Railway injects `PORT`, and the API listens on it.

There is intentionally no `railway.json`. Railway deprecated its old per-service Config as Code format for new services, so this release uses the Dockerfile plus the exact dashboard settings above.

If you put both projects in one monorepo, set the Railway service root directory to `/backend`. With the supplied standalone backend ZIP, leave the root directory as `/`.

## 3. Set Railway environment variables

Open the API service's **Variables** tab. Railway's raw editor can accept these lines after you replace the placeholders:

```dotenv
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
ENCRYPTION_KEY=PASTE_32_BYTE_BASE64_KEY
BACKEND_URL=https://YOUR-API.up.railway.app
FRONTEND_URL=https://YOUR-GITHUB-USERNAME.github.io/YOUR-FRONTEND-REPOSITORY/
FRONTEND_ORIGINS=https://YOUR-GITHUB-USERNAME.github.io
SESSION_DAYS=30
```

Generate `ENCRYPTION_KEY` locally:

```bash
openssl rand -base64 32
```

Keep that value in a password manager and seal it in Railway. **Never change or lose it after saving user data**: profiles, documents, saved answers, and connector tokens are encrypted with it. A different key cannot decrypt existing rows.

Variable details:

| Variable | Required | Notes |
|---|---:|---|
| `NODE_ENV` | Yes | Use `production` |
| `DATABASE_URL` | Yes | Use Railway's reference `${{Postgres.DATABASE_URL}}`, not a copied public connection string |
| `ENCRYPTION_KEY` | Yes | Exactly 32 random bytes encoded as Base64 |
| `BACKEND_URL` | Yes | Exact public API origin, HTTPS, with no path |
| `FRONTEND_URL` | Yes | Full Pages URL including repository path and trailing slash; used after Google OAuth |
| `FRONTEND_ORIGINS` | Yes | Browser origin only, normally `https://USERNAME.github.io` with no repository path; comma-separate extra exact origins |
| `SESSION_DAYS` | No | Defaults to 30; valid range 1–365 |
| `PORT` | No | Railway supplies it automatically |

Review and deploy the staged Railway changes. The first start creates the database schema through `prisma migrate deploy`. Check `https://YOUR-API.up.railway.app/health`; it should return `{"ok":true}`.

## 4. Create and deploy the frontend repository

1. Extract `applydesk-frontend.zip`.
2. Create a GitHub repository, for example `applydesk-frontend`.
3. Upload the extracted contents so `package.json`, `vite.config.ts`, `src/`, and `.github/` are at the repository root.
4. In the repository, open **Settings → Secrets and variables → Actions → Variables**.
5. Add `VITE_API_URL` with the Railway origin, for example `https://YOUR-API.up.railway.app`. This is a public URL, so use an Actions variable rather than a secret.
6. Leave `VITE_BASE_PATH` unset for the normal `https://USERNAME.github.io/REPOSITORY/` address. If you later use a custom domain at its root, set `VITE_BASE_PATH=/` and redeploy.
7. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
8. Push to `main`, or run **Actions → Deploy frontend to GitHub Pages → Run workflow**.

The included workflow installs with `npm ci`, compiles the app, automatically derives the GitHub repository base path, uploads `dist/`, and deploys it to Pages.

After GitHub shows the live Pages URL, make sure Railway's `FRONTEND_URL` is that exact full URL and `FRONTEND_ORIGINS` is its origin. Changing a Railway variable creates staged changes; deploy them.

## 5. Add job discovery sources

The dashboard works without a job API: use **Add job** to paste any vacancy. For automatic discovery, configure either or both official sources in Railway and redeploy.

| Variable | Source |
|---|---|
| `REED_API_KEY` | Register through [Reed's developer portal](https://www.reed.co.uk/developers) |
| `ADZUNA_APP_ID` | Register through the [Adzuna developer portal](https://developer.adzuna.com/) |
| `ADZUNA_APP_KEY` | Supplied with the Adzuna app ID |

The scanner reads listings only. These search APIs do not grant permission to submit candidate applications into Reed or Adzuna-hosted forms.

## 6. Optional Gmail connection

Gmail enables three features: sending direct-email applications, synchronising relevant employer messages, and replying from ApplyDesk.

1. Create or select a project in Google Cloud.
2. Enable the **Gmail API**.
3. Configure the OAuth consent screen. For your own private test, add your Google account as a test user.
4. Create an OAuth client of type **Web application**.
5. Add this exact authorised redirect URI:

   `https://YOUR-API.up.railway.app/api/connectors/gmail/callback`

6. Add the client values to the Railway API service and deploy:

```dotenv
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
```

7. In ApplyDesk, open **Integrations → Gmail → Connect account**.

The redirect URI must match exactly, including HTTPS, hostname, path, case, and trailing slash behavior. The backend asks for `gmail.send` and `gmail.readonly`. Google classifies `gmail.readonly` as a restricted scope; a public multi-user launch needs Google's OAuth verification and can require a security assessment. Keep Gmail disabled if you do not want to take that on.

## 7. Optional scheduled scanning on Railway

Manual **Scan now** works immediately. To scan automatically:

1. Add a second Railway service from the same backend repository.
2. Name it `ApplyDesk Scanner`.
3. Reuse the API service variables, including the same `DATABASE_URL` and `ENCRYPTION_KEY`. Shared variables are convenient for everything except values you intentionally want isolated.
4. Override its start command to `npm run scan:once`.
5. Add a cron schedule such as `*/30 * * * *` for every 30 minutes.
6. Do not give the scanner a public domain or a healthcheck.

Railway cron schedules use UTC. The scanner exits after each run and uses a PostgreSQL advisory lock, so overlapping invocations do not duplicate a scan. Auto-submission still obeys every safety gate described above.

## 8. First-use checklist

1. Register with a password of at least 12 characters.
2. Complete name, postcode, travel, availability, right-to-work, links, and skills.
3. Upload one or more PDF, DOCX, or text CVs; the per-file maximum is 8 MB.
4. Review the three starter tracks and edit their include/exclude titles, job types, travel, salary, and mode.
5. Assign the correct CV and optional cover letter to each track.
6. Connect Reed and/or Adzuna by setting credentials, or add jobs manually.
7. Keep tracks in **Review** until the matching results look right.
8. If wanted, connect Gmail and test one direct-email application manually before changing a track to **Auto**.

## Security and operations notes

- Passwords use salted scrypt hashes. The server never stores the plaintext password.
- Session tokens are random, stored only as SHA-256 hashes in PostgreSQL, expire, and are deleted at logout. The static cross-origin frontend stores the opaque token in browser local storage; protect the site from untrusted scripts and keep dependencies updated.
- Profiles, saved answers, CVs, cover letters, access tokens, and refresh tokens use AES-256-GCM application-level encryption. Email addresses and job/application metadata remain queryable plaintext.
- Restrict `FRONTEND_ORIGINS` to exact sites you control. Never use `*` with authenticated APIs.
- Enable Railway PostgreSQL backups before relying on the service. Test a restore and preserve the encryption key separately from the database backup.
- CV files are encrypted inside PostgreSQL for this private beta. At larger scale, move documents to private object storage with per-object encryption and signed downloads.
- Rotate job API and Google client secrets when exposed. Rotating `ENCRYPTION_KEY` requires a deliberate data re-encryption migration; do not simply replace it.
- Review job-board and employer terms, anti-spam rules, and applicable privacy/employment law before enabling unattended applications.

## Troubleshooting

| Symptom | Likely fix |
|---|---|
| Pages loads but API calls fail | Check the browser console, `VITE_API_URL`, Railway public domain, and exact `FRONTEND_ORIGINS` |
| Pages assets return 404 | Remove `VITE_BASE_PATH` for a normal project site, or set it to the exact `/repository-name/` path |
| Railway healthcheck fails | Confirm PostgreSQL is running, `DATABASE_URL` references the database service, all required variables exist, and the path is `/health` |
| `ENCRYPTION_KEY must decode...` | Generate it with `openssl rand -base64 32`; do not type a human password |
| Google says `redirect_uri_mismatch` | Copy the backend callback URI exactly into the OAuth web client |
| Gmail connects then stops working | Reconnect it; test-mode/verification rules or a revoked refresh token may be responsible |
| Scan says credentials are missing | Add Reed or both Adzuna variables to the API and scanner services, then deploy staged changes |
| Job opens an external form instead of sending | Expected: only vacancies with an application email support direct submission |

## Official setup references

- [GitHub: publish Pages with a custom Actions workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Railway: service and reference variables](https://docs.railway.com/variables)
- [Railway: deployment healthchecks](https://docs.railway.com/deployments/healthchecks)
- [Railway: cron jobs](https://docs.railway.com/cron-jobs)
- [Google: OAuth for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google: Gmail API scopes and verification classes](https://developers.google.com/workspace/gmail/api/auth/scopes)
