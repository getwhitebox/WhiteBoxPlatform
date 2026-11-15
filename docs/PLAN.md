# WhiteBoxPlatform – Foundation Plan

_Last revised: 2026-11-14_

A cloud-based business management platform for White Box Mobile Storage. It is designed from the start to serve several companies, brands and locations, and to be licensed to other mobile storage businesses later.

---

## 1. Guiding principles

1. **Build in small stages.** Each phase ends with something usable that you check before we move on.
2. **Company data is always separated.** Every business record belongs to exactly one company and is protected at two layers: the app and the database.
3. **History is never lost.** Records are archived, not deleted. Container history can be added to but never edited or erased.
4. **Run alongside Square, don't disrupt it.** Square stays in charge of billing and payments until we deliberately take that over.
5. **Development and production are kept apart from day one.** Experiments never touch real business data.

---

## 2. Technology stack

| Layer | Choice | Role |
|---|---|---|
| Language | TypeScript | One language for screens and server; catches mistakes early |
| App framework | Next.js (React) | Web app for desktop, tablet and phone; can be installed on a phone's home screen later |
| UI | Tailwind CSS + shadcn/ui | Professional components; per-brand logo and colors |
| Database | PostgreSQL on Supabase | Managed database, backups, row-level security |
| Login | Supabase Auth | Staff logins now; driver and customer logins later; two-factor for admins |
| Database toolkit | Prisma | Readable database design file plus safe, versioned changes (migrations) |
| Hosting | Vercel | Automatic deploys, HTTPS, separate preview and production sites |
| Code storage | GitHub (private) | Version history and off-site backup of the code |

---

## 3. Multi-company structure

```
Organization            parent group (your holding company, or a future licensee)
 └─ Company             an operating business with its own customers, inventory, employees, operations
     ├─ Brand           a customer-facing name and look (logo, colors, phone, website)
     └─ Location        a yard, depot or office
```

- **Centralized administration:** organization-level admins can see and manage every company in their organization and run combined reports.
- **Company-level users** see only the companies they are members of.
- **Acquisitions:** a new company is added under your organization and its data is imported. Containers can move between your companies, and each move is recorded in their history.
- **Licensing:** each licensee is its own Organization, completely walled off from yours. A licensee who needs full isolation can get its own separate deployment.
- **Unit numbers** are unique per company, using a company prefix (White Box = `WB001`…). An acquired company keeps its own numbering.

---

## 4. Database design

### Platform and tenancy
| Table | Purpose |
|---|---|
| `organizations` | Parent groups and licensees |
| `companies` | Operating companies: legal name, unit prefix, time zone, currency |
| `brands` | Customer-facing identities within a company |
| `locations` | Yards, depots and offices, with address and map coordinates |
| `users` | Login identities (managed by Supabase Auth) |
| `memberships` | Which user can access which organization or company, and in what **role** |
| `employees` | Staff and drivers. An employee may or may not have a login. |

**Roles (first version):** platform admin, organization owner, organization admin, company admin, office staff, driver, read-only. A *customer* role is added with the customer portal.

### Customers and projects
| Table | Purpose |
|---|---|
| `customers` | Residential or commercial customers, belonging to a company (and optionally a brand) |
| `customer_contacts` | Additional people for a customer (site contact, accounts payable…) |
| `projects` | A job or site for a customer: site address, access instructions, status, dates. A customer can have **many** projects. |

### Inventory and history
| Table | Purpose |
|---|---|
| `container_types` | Sizes and kinds, with default pricing |
| `containers` | Each physical unit: number, type, status, home yard, current yard or project, condition, acquisition details |
| `container_events` | **Permanent, add-only history:** added to fleet, delivered, picked up, relocated, swapped, transferred between yards or companies, status changed, inspected, damaged, maintenance started or completed, retired, notes. Each event records who, when, from/to, and the related project, rental or job. |
| `maintenance_records` | Repairs and servicing: description, vendor, cost, dates. Linked to history events. |

**Container statuses:** available · reserved · in transit · on rent · maintenance · retired.

### Rentals and operations
| Table | Purpose |
|---|---|
| `rentals` | **One row per container per project.** Each has its own on-rent and off-rent dates, rate and period (monthly/weekly/daily), and delivery and pickup fees. Adding a container to an existing project creates a new rental. Removing one ends that rental. |
| `jobs` | Deliveries, pickups, relocations, swaps and service visits: date, time window, addresses, status, assigned employee. **Completing a job automatically updates the container's status and location and writes a history event.** |

Relationship summary:
```
Customer ──< Project ──< Rental >── Container ──< ContainerEvent
                            │            └──< MaintenanceRecord
                            └──< Job
```

### Integration and audit
| Table | Purpose |
|---|---|
| `external_links` | Links our records to outside systems (e.g. a customer to its **Square customer ID**). Generic, so QuickBooks or others can be added later. |
| `integration_connections` | Each company's connection to Square, since each company may have its own Square account (later phase) |
| `activity_notes` | Timeline notes on customers, projects and containers |
| `audit_log` | Who changed what and when, with before and after values |

### Conventions
- Every operational table carries `company_id`.
- IDs are random UUIDs, so they can't be guessed and can be merged safely after acquisitions.
- Money is stored in whole cents. Times are stored in UTC and shown in local time.
- Records are archived (`archived_at`) instead of deleted.

---

## 5. Square: running alongside

| Area | Source of truth during coexistence |
|---|---|
| Invoices, recurring billing, payments | **Square** |
| Customer records | Imported from Square (CSV) and linked by Square ID; edited in both until sync exists |
| Containers, rentals, projects, history | **WhiteBoxPlatform** |
| Delivery and pickup schedule | Square Calendar until Phase 7, then WhiteBoxPlatform (one system at a time to avoid double-booking) |

Steps to independence (later stages): CSV import → read-only Square API sync → billing prepared in the platform and pushed to Square → optionally replace Square billing and scheduling.

---

## 6. Security

- **Company data separation.** Two layers. (1) All data access goes through one server-side layer that always filters by the user's current company. (2) PostgreSQL **row-level security** rules in the database block cross-company access even if app code has a bug. Automated tests check that one company cannot read another's data.
- **Permissions.** Each action (e.g. "edit customers", "complete jobs") is checked on the server against the user's role.
- **Accounts.** Two-factor authentication on GitHub, Supabase and Vercel, and required for platform admins.
- **Secrets.** Database passwords and API keys live only in `.env.local` (on your computer) and in Vercel's encrypted settings, never in the code repository.
- **Backups.** Before real data goes in: Supabase paid plan with daily backups, plus a practice restore to confirm they work. Point-in-time recovery can be added later.
- **Audit trail.** Every change is recorded in `audit_log`, and container history is add-only.

### Environments
| Environment | Where | Database |
|---|---|---|
| Development | Your computer + Vercel preview links | Supabase project **whitebox-dev** (sample data only) |
| Production | Vercel production site | Supabase project **whitebox-prod** (real data) |

**Region:** both Supabase projects are in **West US (Oregon), `us-west-2`**. Vercel server functions use the matching region, **Portland (`pdx1`)**, so the app runs next to its database.

Database changes are applied to development first, checked, then promoted to production.

---

## 7. Future expansion (designed for, built later)

- **More locations and acquisitions:** add Locations and Companies; transfer containers with full history.
- **Employee and driver mobile access:** phone-friendly job list, photos, and completing deliveries on site. Delivered as an installable web app (no app store needed).
- **Customer portal:** customers log in to see their rentals, invoices and payments, limited to their own records.
- **Billing and payments** inside the platform, route optimization, maps, GPS.
- **Licensing:** onboarding other storage companies as separate Organizations.

---

## 8. Development phases

| Phase | Goal | Done when |
|---|---|---|
| **0. Environment & accounts** | Install Git, Node.js, VS Code. Create GitHub, Supabase (dev + prod) and Vercel accounts with two-factor. | Tools verified; accounts secured |
| **1. Project skeleton** | Create the Next.js app, push it to private GitHub, deploy | A "Hello White Box" page opens on your phone |
| **2. Database foundation** | Tenancy tables, roles, row-level security, seed data (White Box org/company/brand/yard, container types, WB001–WB040) | Separation tests pass; containers visible in dev database |
| **3. Login & permissions** | Sign-in, admin two-factor, company switcher for central admins, branded app shell | You can log in from any device |
| **4. Customers & projects** | Create, edit and search; contacts; notes; Square customer CSV import with linked IDs | Customers usable day-to-day |
| **5. Container inventory & history** | Inventory list, status board, container detail with full history and maintenance | Every unit's status and history visible |
| **6. Rentals** | Assign containers to projects; add or remove containers on existing projects; per-container dates and pricing | Know what's out, where, and at what rate |
| **7. Jobs & scheduling** | Delivery/pickup calendar, today's jobs, completing jobs updates containers automatically | Schedule moves off Square Calendar |
| **8. Production readiness** | Paid backups and restore test, production database, audit review | Go live alongside Square |

Later stages: Square API sync → billing → driver mobile → customer portal → second company → licensing.
