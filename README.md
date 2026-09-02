# JobBot frontend

The static React/Vite frontend for JobBot. It is prepared for a normal GitHub Pages project URL such as `https://username.github.io/JobBotFrontend/` and talks to the separately deployed Railway API.

## Local development

Requirements: Node.js 22 or newer and a running JobBot backend.

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

The output is written to `dist/`. The included `.github/workflows/deploy-pages.yml` builds and deploys it automatically on every push to `main` or `master`.

## GitHub Actions variables

In the frontend repository, open **Settings → Secrets and variables → Actions → Variables**.

| Variable | Required | Value |
|---|---:|---|
| `VITE_API_URL` | Yes | Your Railway public URL, for example `https://applydesk-api-production.up.railway.app` |
| `VITE_BASE_PATH` | No | Leave unset for `github.io/repository-name`; set `/` only for a custom domain hosted at its root |

Then open **Settings → Pages** and choose **GitHub Actions** as the publishing source.

Do not choose **Deploy from a branch**. Vite source files such as `src/main.tsx` cannot run directly in a browser. If the deployed site reports a 404 for `src/main.tsx`, switch the Pages source to **GitHub Actions**, run the deployment workflow again, and hard refresh the site.

## Branch deployment fallback

The supplied ZIP also contains a precompiled `docs/` folder. If you prefer branch deployment, edit `docs/config.js` and put your Railway URL in `API_URL`. Then open **Settings → Pages**, choose **Deploy from a branch**, select your branch and the `/docs` folder. Never select the repository root because it contains Vite source code.

The complete setup order is in `DEPLOYMENT_GUIDE.md` supplied with the project.
