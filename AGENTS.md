# BeautyFit — Agent Memory

## Architecture (essential)

- **Monorepo:** `App/frontend` (React 18 + TS + Vite 5 + Tailwind + shadcn/ui),
  `App/backend` (Python 3.13 + FastAPI + SQLAlchemy async + Alembic).
- **Auth model (IMPORTANT):** The frontend authenticates **directly against Supabase
  Auth** (`signInWithPassword` / `signUp` / `signInWithOAuth`) and forwards the
  resulting access token as `Authorization: Bearer <token>`. The backend must
  **verify Supabase tokens** — it does **not** issue the primary login tokens.
  - Supabase now signs access tokens with **`alg: ES256`** (asymmetric ECDSA P-256),
    verified via the project JWKS at
    `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` (keyed by `kid`).
  - `backend/core/auth.py::decode_supabase_access_token` branches on `alg`: ES256 →
    JWKS (cached in `_SUPABASE_JWKS_CACHE`, 600s TTL, refresh-on-miss); HS256 →
    `SUPABASE_JWT_SECRET` (legacy/compat). Do **not** revert to HS256-only — it
    rejects every real Supabase login.
  - Backend-issued **app JWTs** (HS256, `JWT_SECRET_KEY`) from the OIDC flow are a
    separate token family and still validated by `decode_access_token`.
- `backend/dependencies/auth.py::get_current_user` accepts either token family:
  tries app JWT first, falls back to Supabase token.

## Environment (local + preview)

- Backend env: `App/backend/.env` (PORT=12001 for preview). `PORT`, `CORS_ORIGINS`,
  `FRONTEND_URL`, `DATABASE_URL` (Supabase Postgres pooler), `SUPABASE_URL`,
  `SUPABASE_JWT_SECRET`, `STRIPE_*`, `JWT_SECRET_KEY`.
- Frontend env: `App/frontend/.env` — **required** for auth. Must contain
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (public anon key; RLS protects data).
  Without them `getSupabase()` returns null and **login/register silently fail** with
  "Supabase is not configured." Also `VITE_PORT` + `VITE_API_TARGET` (proxy target).
- `.env` is gitignored; recreate from CTO-provided values when absent.

## Running the servers

- Backend: `cd App/backend && .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 12001`
  (venv must be Python 3.13; `python3 -m venv .venv` then `pip install -r requirements.txt`).
- Frontend: `cd App/frontend && node_modules/.bin/vite --host 0.0.0.0 --port 12000`
  (Vite proxies `/api` → `VITE_API_TARGET`).
- Preview hosts: work-1 (port 12000) = frontend, work-2 (port 12001) = backend.
  Add the preview-host origins to `CORS_ORIGINS` when running behind them.
- Tests: `cd App/backend && .venv/bin/python -m pytest tests/ -q` (9 tests).
- Lint: `cd App/frontend && node_modules/.bin/eslint --quiet ./src`.

## Phase status

- **Phase 0:** done (payment gate, entitlement, CORS lockdown, JWT→cookie, lazy
  Supabase client). See `App/docs/PHASE0_FINAL_VERIFICATION_2026-08-14.md`.
- **Phase 1 (auth fix):** done — see `App/docs/PHASE1_AUTH_FIX_REPORT.md`. Login page
  opens; full Supabase Auth flow verified live (ES256 via JWKS).

## Conventions

- Do NOT introduce unapproved third-party deps. `python-jose` + `cryptography`
  already cover JWT/JWKS.
- Error logging logs exception **type only**, never token contents.
- Do not hard-code ports/hosts in `vite.config.ts`; read from `VITE_*` env.
