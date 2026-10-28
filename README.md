# Café Sonique

Responsive public website and secure staff workspace for Café Sonique.

## Architecture

The application is a deployment-neutral Next.js modular monolith:

- Next.js 16 App Router and React 19
- PostgreSQL 17 in Docker for local development
- Drizzle ORM and versioned SQL migrations
- Better Auth with database sessions and email/password staff login
- Owner and barista role enforcement in server-side data access
- Zod validation for public and staff mutations
- Stable local copies of approved Instagram imagery

Public content is cached and tagged. Staff mutations invalidate the relevant
menu, event or guest-thought tag. Guests can leave a short public thought.
New notes appear on the site and in the staff Thoughts workspace; either role
can hide a note from the public wall without deleting it. Operations run through atomic server-side transactions with
integer KES accounting and an append-only audit trail.

## Local setup

Requirements: Node.js 22+, npm and Docker Desktop.

```bash
cp .env.example .env.local
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open:

- Public site: http://localhost:3000
- Staff login: http://localhost:3000/login

The seed credentials are read from `.env.local`. The repository’s local
development file uses:

- Owner: `owner@cafesonique.local`
- Barista: `barista@cafesonique.local`

Change both passwords and `BETTER_AUTH_SECRET` before any shared deployment.

## Common commands

```bash
npm run lint
npm test
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
npm run db:down
```

After changing `src/lib/db/schema.ts`, run `npm run db:generate`, review the
generated SQL under `drizzle/`, then run `npm run db:migrate`.

## Instagram assets

The public site does not hotlink expiring Instagram CDN URLs. The approved
prototype images and their source post URLs are listed in
`scripts/instagram-assets.json`.

Run this only when those explicit source URLs are still valid:

```bash
npm run assets:import-instagram
```

It downloads the files to `public/images/sonique/` and writes provenance
metadata. Confirm Café Sonique has permission to use each photo before
production. For ongoing imports, use the official Instagram Graph API and
immediately copy returned media into controlled storage; do not use runtime
scraping or CDN hotlinks.

## Website editor

Open `/admin` to edit the public site: homepage photos, menu, events,
booking enquiries and guest thoughts. Photos are resized in the browser
before upload and appear on the homepage as soon as they are published.

Uploaded photos are stored in `.data/media` and served from `/media/…`.
That folder must persist between deployments; on hosting without a
persistent disk, replace `src/lib/media/storage.ts` with an S3-compatible
bucket (for example Cloudflare R2) and add its domain to
`images.remotePatterns`.

## Roles and security

- `barista`: records sales, expenses, loyalty visits and stock movements, and
  manages menu availability, events, booking enquiries and guest thoughts.
- `owner`: has all barista access plus financial reports, M-Pesa
  reconciliation, inventory/recipe configuration, operational settings and
  the audit log.
- Every protected action checks the session server-side. Navigation visibility
  is not treated as authorization.
- Passwords are handled by Better Auth, sessions use secure HTTP-only cookies,
  and booking submission is validated, honeypot-protected and rate-limited.
- Audit metadata must not contain secrets, passwords or unnecessary personal
  information.

## Backups and deployment

On the self-hosted server, `ops/backup/backup.sh` runs nightly at 03:00
(Nairobi) from a systemd timer. It dumps PostgreSQL and copies uploaded media
and expense receipts to a Cloudflare R2 bucket through an rclone `crypt`
remote, so files are encrypted before upload. Database dumps are kept for 30
days in R2 and 7 days in `/var/backups/sonique`.

- Set up once as root with `ops/backup/setup.sh`. It asks for the R2 key and
  prints the encryption password once; store that password offline, because
  backups cannot be opened without it.
- Run a backup now with `systemctl start sonique-backup`; read the log with
  `journalctl -u sonique-backup`.
- Prove a restore works with `ops/backup/restore-check.sh`, which restores the
  latest dump into a throwaway database and compares row counts with live.

Deployment requires:

1. A production `DATABASE_URL`.
2. A new random `BETTER_AUTH_SECRET` of at least 32 characters.
3. `BETTER_AUTH_URL` set to the canonical HTTPS domain.
4. `npm run db:migrate` during a controlled release step.
5. Rotated owner/barista passwords.

Do not commit `.env.local`, database dumps or provider credentials.

## Operations

Open `/dashboard/operations` for quick access to the operational workspace.

- Sales store immutable product/price snapshots and are completed
  idempotently with cash or manually entered M-Pesa Buy Goods references.
- Expenses can include receipt evidence. Development files are stored outside
  the public web root in `.data/receipts`; metadata and SHA-256 hashes live in
  PostgreSQL. Use private S3-compatible object storage in production.
- Reports use `Africa/Nairobi` calendar boundaries and support CSV exports.
- M-Pesa settlement rows are manually entered and reconciled against recorded
  references and amounts. This is not a live Daraja integration.
- Loyalty earns one visit per qualifying completed sale. At the configured
  threshold (five by default), the next visit can redeem one menu drink up to
  the configured KES cap.
- Inventory uses an append-only movement ledger. Sales deduct stock only when
  the owner has configured recipe quantities; no recipe amounts are assumed.

Operational money is stored as integer KES. Inventory quantities use fixed
three-decimal values. Voids create reversals or status changes rather than
deleting financial records.

For production receipt storage, implement the existing storage adapter with an
S3-compatible private bucket, server-side encryption, short-lived signed
downloads and retention rules. Keep bucket credentials only in deployment
secrets.
