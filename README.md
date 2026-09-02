# ApplyDesk frontend

The static React/Vite frontend for ApplyDesk. It is prepared for a normal GitHub Pages project URL such as `https://username.github.io/applydesk-frontend/` and talks to the separately deployed Railway API.

## Local development

Requirements: Node.js 22 or newer and a running ApplyDesk backend.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `VITE_API_URL=http://localhost:4000` in `.env.local`. Do not put database passwords, encryption keys, Google secrets, or job API keys in this repository. Every value bundled by Vite is public.

## Production build

```bash
npm run build
```

The output is written to `dist/`. The included `.github/workflows/deploy-pages.yml` builds and deploys it automatically on every push to `main`.

## GitHub Actions variables

In the frontend repository, open **Settings → Secrets and variables → Actions → Variables**.

| Variable | Required | Value |
|---|---:|---|
| `VITE_API_URL` | Yes | Your Railway public URL, for example `https://applydesk-api-production.up.railway.app` |
| `VITE_BASE_PATH` | No | Leave unset for `github.io/repository-name`; set `/` only for a custom domain hosted at its root |

Then open **Settings → Pages** and choose **GitHub Actions** as the publishing source.

The complete setup order is in `DEPLOYMENT_GUIDE.md` supplied with the project.
