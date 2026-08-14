# Phase 1 — Authentication Repair Verification Report

> **Prepared by:** VP, AI Systems Engineering
> **Date:** 2026-08-14 | **Scope:** Login page not opening → root-cause + radical fix + live verification

---

## 1) Executive Summary

The login page was **non-functional**. The root cause was **two-layer**, not one. After a
precise static analysis of the entire auth stack (frontend `supabaseClient.ts`,
`AuthContext.tsx`, `auth.ts`; backend `core/auth.py`, `dependencies/auth.py`,
`routers/auth.py`), both defects were fixed at the root, and the full authentication
flow was verified live on both servers (frontend :12000, backend :12001) through the
external preview hosts.

**Verdict:** Login page now opens and the full auth flow (register → confirm → sign-in
→ backend `/auth/me` → navbar user state → sign-out) works end-to-end.

---

## 2) Root-Cause Analysis (precise)

### Defect A — Frontend: Supabase client was never configured (P0, blocks the page)

- `src/lib/supabaseClient.ts` reads `import.meta.env.VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. With **no frontend `.env` present**, `getSupabase()`
  returned `null`.
- `AuthContext.login()` then short-circuited with
  `{ ok: false, error: 'Supabase is not configured.' }` — so the login form rendered
  but **every login attempt failed instantly**. The same null path broke register,
  OAuth, and password reset.

### Defect B — Backend: Supabase access tokens were always rejected (P0, blocks auth)

- Supabase Auth now issues access tokens signed with **`alg: ES256`** (asymmetric
  ECDSA, P-256), verified via the project JWKS (`/auth/v1/.well-known/jwks.json`),
  selected by the token header `kid`.
- The old `core/auth.py::decode_supabase_access_token` only tried HS256 with the
  symmetric `SUPABASE_JWT_SECRET`. For an ES256 token this raises
  `JWTError: The specified alg value is not allowed` → `payload = None` →
  `/auth/me` returns **401** even with a valid Supabase session.
- This is why, even after fixing the env vars, a successful Supabase sign-in produced
  a 401 from the backend (the frontend `AuthContext` tolerated it and fell back to the
  Supabase user, but role enrichment and protected API access were broken).

---

## 3) Radical Fixes Applied

### Fix A — Frontend `.env` + Vite config (minimal, no logic change)

- Created `App/frontend/.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (the public anon key — safe to ship to browsers; RLS protects data), `VITE_PORT`,
  `VITE_API_TARGET`.
- `vite.config.ts`: parametrized `server.port` and the `/api` proxy `target` from env
  (`loadEnv`), so the dev server + proxy are no longer hard-coded to :3000/:8000 and
  adapt to the preview-host port mapping (:12000 → backend :12001).

### Fix B — Backend: JWKS-based Supabase token verification (`core/auth.py`)

- Added `_fetch_supabase_jwks()` (sync httpx, TTL-cached in-process at
  `_SUPABASE_JWKS_CACHE`, 600s) that fetches and converts the Supabase JWKS to
  cryptography public keys (`_jwk_to_public_key` supports EC P-256/384/521 and RSA).
- Added `_get_supabase_jwk(kid)` with cache-hit / TTL-expiry / forced-refresh-on-miss
  semantics to cover Supabase key rotation.
- Rewrote `decode_supabase_access_token` to **branch on `alg`**:
  - `ES256` → verify against the JWKS public key by `kid`.
  - `HS256` → verify with `SUPABASE_JWT_SECRET` (legacy/compat preserved).
- `verify_aud` disabled (Supabase tokens carry `aud: "authenticated"`); signature +
  expiry still fully verified. Error logging logs type only, never token contents.

### Fix C — Navbar reflects auth state (`components/Navbar.tsx`)

- Wired the navbar to `useAuth()`. Signed-in users see a user menu (name + email +
  Sign out); signed-out users see the Sign in link (desktop + mobile). This was a
  pre-existing UX gap that masked the working auth flow.

### Backend `.env`

- Created `App/backend/.env` (CTO-provided values), set `PORT=12001`, expanded the
  CORS allowlist to include the preview-host origins and `localhost:12000`, set
  `FRONTEND_URL=http://localhost:12000`.

---

## 4) Live Verification (both servers, external hosts)

| # | Test | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | Backend health (work-2) | 200 healthy | `{"status":"healthy"}` | ✅ |
| 2 | Frontend `/login` (work-1) | 200 + form | 200, Login + Register forms render | ✅ |
| 3 | `/api/v1/auth/me` no token (proxy) | 401 | 401 | ✅ |
| 4 | Login with bad credentials (browser) | error shown | "Invalid login credentials" from Supabase | ✅ |
| 5 | Sign up unconfirmed email (browser) | "Almost there!" screen | needsEmailConfirmation path renders | ✅ |
| 6 | Sign in confirmed user → access_token (Supabase ES256) | token issued | 803-char ES256 token, `kid` matches JWKS | ✅ |
| 7 | Backend `/auth/me` with Supabase ES256 token (proxy + direct) | 200 + user | `200 {id,email,name,role:"user"}` | ✅ |
| 8 | Browser sign-in (confirmed user) → redirect | `/` after auth | navigated to `/`, session in localStorage+sessionStorage | ✅ |
| 9 | Navbar shows user after sign-in | user menu "phase1.qa" | button "phase1.qa" + dropdown | ✅ |
| 10 | Sign out | session cleared, navbar → "Sign in" | storage empty, "Sign in" link restored | ✅ |
| 11 | App JWT (HS256) still valid | 200 | `200` with app-user data | ✅ |
| 12 | `pytest tests/` | all pass | 9 passed | ✅ |
| 13 | `eslint` on changed frontend files | 0 errors | exit 0 | ✅ |

---

## 5) Architectural Notes / Decisions

- **JWKS over API round-trip:** verifying Supabase tokens locally via JWKS (cached)
  avoids a network call per request and is the standard OIDC pattern. The blocking
  `httpx.get` is acceptable because the fetch is rare (TTL-cached + refresh-on-miss
  only) and runs outside the hot path.
- **Backward compat:** HS256 path retained so any Supabase project still configured
  with symmetric JWT signing, plus backend-issued app JWTs (OIDC flow), keep working.
- **No new dependencies:** uses already-installed `python-jose` + `cryptography`.

---

## 6) Remaining (out of scope — Phase 1+ backlog)

- OIDC issuer env vars (`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`)
  are still platform-injected; the full OIDC redirect flow can't be exercised locally,
  but Supabase Auth (the primary frontend path) is fully verified.
- Session refresh hardening, rate limiting, HTTP-client unification — Phase 1 items.

---

*Independent live verification performed on both servers via the external preview hosts.*
