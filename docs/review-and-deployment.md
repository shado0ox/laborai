# LaborAI review and deployment

## Implemented

- User creation is insert-only with server-generated IDs; public registration cannot update an existing account or choose tenant/status. New passwords are always hashed on the server.
- User management requires an authenticated company administrator. Authentication reads the current account on every request; deletion, rejection, role or tenant changes invalidate existing tokens.
- Employees, payments and ledger records use `(tenant_id, record_id)` primary keys. A transactional migration preserves existing rows, normalizes NULL tenants to the default space, and replaces the previous primary keys.
- Branch accounts read and write only their assigned branch. Payment names/branches come from the employee record, and payments must refer to an employee in the same company. Ledger writes are administrator-only; other users may read the company ledger when its administrator allows it.
- Payment deletion is persisted. Employee/payment deletion and space creation use transactions. Default-space reset affects only that space.
- Expired subscriptions are enforced on the API. Production refuses to start without PostgreSQL and never accepts temporary in-memory writes. In-memory fallback requires an explicit non-production opt-in.
- Print documents escape names, descriptions and notes. Uploaded print logos accept only raster data URLs. Employee balances match by iqama number, never by name.
- Arabic login redesign, clearer dashboard metrics, expired iqama counts, responsive spacing, labelled login controls, keyboard focus and reduced-motion support. Developer UI uses a server-returned capability instead of a hardcoded email.
- Excel parsing is loaded only on import. SheetJS uses the official 0.20.3 tarball. Unused Gemini/MySQL/motion dependencies were removed and compatible dependency patches applied.
- Automated security tests, GitHub CI, local-only disposable sandbox, non-root Docker app, loopback ports, database readiness and app health checks.

## Validation

`npm run check` runs TypeScript, production build and the integration/print tests. The integration test uses a disposable PGlite PostgreSQL engine through the same `pg` wire client used in production; it verifies legacy schema migration and preservation, tenant collisions, role escalation, branch boundaries, subscription expiry, payment persistence and session revocation. It is not a substitute for a staging smoke test on your deployed PostgreSQL version.

`npm audit` was clear after dependency patches and the SheetJS update. This is a registry advisory check, not a guarantee that no vulnerabilities exist.

Browser smoke checks covered login, registration, navigation, employee files and settings at desktop/mobile sizes. Chromium screenshots were visually reviewed; there were no JavaScript errors or unwanted horizontal overflow on the dashboard. Docker configuration was inspected, but a Docker engine was not available to build or run the image here.

## Before production deployment

1. Back up the current PostgreSQL database and verify that the backup can be restored. The migration changes keys and creates a normalized-email unique index; duplicate emails that differ only by case/whitespace must be resolved first. Unknown custom foreign keys may block the migration; initialization then fails rather than serving requests on an inconsistent schema.
2. Test on a separate PostgreSQL instance. Keep `ALLOW_DESTRUCTIVE_SCHEMA_MIGRATION=false`. No production database was accessed during this review.
3. Configure `.env` using `.env.example`; retain the current `DEV_EMAIL`, `JWT_SECRET` and database identifiers unless intentionally rotating them. The example contains no real credentials.
4. Ports 3150, 5432 and 8085 now bind to `127.0.0.1`. A same-host reverse proxy or tunnel can reach them; remote direct access needs an explicit binding change or SSH tunnel.
5. pgAdmin is optional: `docker compose --profile tools up -d pgadmin`; set `PGADMIN_DEFAULT_PASSWORD` first.
6. Update and rebuild with `docker compose up -d --build`. Check `docker compose ps`, application logs and `/api/health` through the configured site. Existing data volumes are preserved.

## Published backup still needs remediation

`backup_20260706.sql` was removed from the branch and backup files are ignored/excluded from Docker builds. It contained workforce/payment data and password hashes in a public repository. This change does **not** erase the existing Git history or already downloaded copies. Repository history cleanup and credential rotation are separate operations that have not been performed. Restrict repository visibility if appropriate and rotate affected credentials; review whether other real data was published.

## Disposable local development

```bash
npm ci
npm run sandbox
```

The sandbox runs at `http://127.0.0.1:3151`, uses disposable PGlite storage, binds locally, and never connects to the production database. Login is `admin@laborai.test` / `Sandbox-only-2026`; these credentials exist only in the sandbox. All records disappear when it exits. `SANDBOX_PORT` changes its port.

## Skills applied

- Sentry security-review: traced input and authorization paths and verified concrete attacks.
- Anthropic frontend-design: product-specific Arabic interface direction and visual review.
- Vercel web-design-guidelines: focus, labels, reduced motion and responsive checks.
- Anthropic webapp-testing: Playwright reconnaissance and browser smoke workflow.

Skills are development instructions; they are not dependencies bundled into LaborAI.

## UI smoke test

With the disposable sandbox running, install Python Playwright once (`python -m pip install playwright` and `python -m playwright install chromium`), then run `python tests/browser_smoke.py`. Screenshots go to the ignored `test-results/browser` directory.

## Interface previews

![Arabic login](screenshots/login-desktop.png)

![Dashboard with synthetic sandbox data](screenshots/dashboard-desktop.png)
