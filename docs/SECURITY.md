# Security Model

How WhiteBoxPlatform keeps each company's data separate and its history permanent. The rules live in the database itself, in `prisma/migrations/20261116005659_security_rules/migration.sql`, and are proven by `tests/security.test.ts`.

Run the tests any time with:
```
npm run test:security
```

## Layers of protection

| Layer | What it does |
|---|---|
| **No public database access** | Supabase's public web roles (`anon`, `authenticated`) have no access to any table. All access goes through the app's server. |
| **Restricted app role (`app_user`)** | Every request from the app runs as `app_user`. It can read, add and change records, but **cannot delete** anything (records are archived) and cannot bypass the company walls. |
| **Company walls (row-level security)** | Every table has row-level security switched on. The database shows and accepts only rows from companies the logged-in user belongs to. |
| **Permanent history** | `container_events` and `audit_log` can only be added to. A database trigger refuses edits and deletes from **every** role, including the owner. |
| **Role rules** | Only admins can grant roles. Company admins can't grant organization-wide roles. Nobody can make themselves a platform admin through the app. |

## Who sees what

| User | Can access |
|---|---|
| Platform admin (`users.isPlatformAdmin`) | Every organization and company |
| Org-wide membership (`companyId` empty) | Every company in that organization |
| Company membership | Only that company |
| No membership / not logged in | Nothing |

## How the app must query (Phase 3 onward)

Every request runs inside a transaction that first switches to the restricted role and states the user:

```sql
BEGIN;
SET LOCAL ROLE app_user;
SELECT set_config('app.user_id', '<logged-in user id>', true);
-- ...queries...
COMMIT;
```

If the user id isn't set, the database returns nothing ("fail closed").

The **database owner connection** (`postgres`, used by migrations and the seed script) bypasses the company walls. It must never be used to serve a user's request.

## Rules for future changes

1. **Every new table** must switch on row-level security and get a policy. The test *"every table has row-level security switched on"* fails if one is forgotten.
2. Business tables must have a `companyId` column and a company-wall policy.
3. Grant `app_user` only `SELECT, INSERT, UPDATE` (new tables get this automatically). Never grant `DELETE`.
4. Keep the Supabase **service role key** and the **database password** secret: server-side settings only, never in the browser or in GitHub.

## Known gaps (to handle in the app layer)

- **Links between records of different companies.** The database checks a record's own `companyId`, but not that every record it points to (e.g. a rental's container) belongs to the same company. The app's server code will check this when creating rentals, jobs and so on, and tests will be added with those screens.
- **Fine-grained permissions** (e.g. drivers can't edit customers) are enforced in the app's server code, on top of the company walls.
