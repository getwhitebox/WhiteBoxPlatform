-- =============================================================================
-- SECURITY RULES  (Phase 2)
-- =============================================================================
-- What this does, in plain terms:
--
--  1. CLOSES THE BACK DOOR. Supabase's public web roles ("anon" and
--     "authenticated") lose all access to our tables. Every request must go
--     through the app's server.
--
--  2. CREATES "app_user", the restricted role the app uses for every request.
--     It can read, add and change records, but it can never DELETE anything
--     (we archive instead). It also can't bypass the company walls.
--
--  3. BUILDS COMPANY WALLS (row-level security). Before each request, the app
--     says who the user is (app.user_id). The database then shows and accepts
--     only rows from companies that user belongs to:
--       - platform admin         → every company
--       - org-wide membership    → every company in that organization
--       - company membership     → only that company
--     With no user set, nothing is visible ("fail closed").
--
--  4. LOCKS HISTORY. container_events and audit_log can only be added to.
--     The database refuses any edit or delete, for every role (including the
--     database owner), so history can't be changed by mistake or on purpose.
--
-- The app switches into app_user at the start of each request:
--     BEGIN;
--     SET LOCAL ROLE app_user;
--     SELECT set_config('app.user_id', '<logged-in user id>', true);
--     ... queries ...
--     COMMIT;
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The restricted application role
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

-- Allow the connection user (postgres) to switch into app_user per request.
GRANT app_user TO postgres;

GRANT USAGE ON SCHEMA public TO app_user;


-- -----------------------------------------------------------------------------
-- 2. Close the back door: remove public web access to our tables
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- ...and for every table created in the future by our migrations.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Future tables: app_user may read, add and change, but never delete.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO app_user;


-- -----------------------------------------------------------------------------
-- 3. Helper functions that work out what the current user may access
-- -----------------------------------------------------------------------------
-- They live in a private "app" schema that Supabase's web API does not expose.
-- SECURITY DEFINER lets them read memberships without being blocked by the
-- very rules they help enforce.
CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO app_user;

-- The logged-in user's id, or NULL if the app didn't set one.
CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

-- Is the current user a platform admin (full access)?
CREATE OR REPLACE FUNCTION app.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT u."isPlatformAdmin"
       FROM public.users u
      WHERE u.id = app.current_user_id()
        AND u."archivedAt" IS NULL),
    false);
$$;

-- Every company the current user may access.
CREATE OR REPLACE FUNCTION app.accessible_company_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN app.current_user_id() IS NULL THEN ARRAY[]::uuid[]
    WHEN app.is_platform_admin() THEN
      COALESCE((SELECT array_agg(c.id) FROM public.companies c), ARRAY[]::uuid[])
    ELSE COALESCE((
      SELECT array_agg(DISTINCT c.id)
        FROM public.memberships m
        JOIN public.users u ON u.id = m."userId" AND u."archivedAt" IS NULL
        JOIN public.companies c
          ON (m."companyId" IS NOT NULL AND c.id = m."companyId")
          OR (m."companyId" IS NULL AND c."organizationId" = m."organizationId")
       WHERE m."userId" = app.current_user_id()
         AND m."archivedAt" IS NULL
    ), ARRAY[]::uuid[])
  END;
$$;

-- Every organization the current user may access (directly or via a company).
CREATE OR REPLACE FUNCTION app.accessible_org_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN app.current_user_id() IS NULL THEN ARRAY[]::uuid[]
    WHEN app.is_platform_admin() THEN
      COALESCE((SELECT array_agg(o.id) FROM public.organizations o), ARRAY[]::uuid[])
    ELSE COALESCE((
      SELECT array_agg(DISTINCT m."organizationId")
        FROM public.memberships m
        JOIN public.users u ON u.id = m."userId" AND u."archivedAt" IS NULL
       WHERE m."userId" = app.current_user_id()
         AND m."archivedAt" IS NULL
    ), ARRAY[]::uuid[])
  END;
$$;

-- May the current user manage memberships (grant roles) for this
-- organization / company?
--   - platform admin: anywhere
--   - ORG_OWNER / ORG_ADMIN (org-wide): anything in their organization
--   - COMPANY_ADMIN: only company-level memberships in their own company
CREATE OR REPLACE FUNCTION app.can_manage_memberships(org_id uuid, company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.is_platform_admin() OR EXISTS (
    SELECT 1
      FROM public.memberships m
      JOIN public.users u ON u.id = m."userId" AND u."archivedAt" IS NULL
     WHERE m."userId" = app.current_user_id()
       AND m."archivedAt" IS NULL
       AND m."organizationId" = org_id
       AND (
             (m."companyId" IS NULL AND m.role IN ('ORG_OWNER', 'ORG_ADMIN'))
          OR (m.role = 'COMPANY_ADMIN'
              AND company_id IS NOT NULL
              AND m."companyId" = company_id)
       )
  );
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_user;


-- -----------------------------------------------------------------------------
-- 4. Switch on row-level security for EVERY table
-- -----------------------------------------------------------------------------
-- (Prisma's own bookkeeping table; absent in Prisma's temporary check database)
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;
ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.containers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            ENABLE ROW LEVEL SECURITY;

-- _prisma_migrations: no access for app_user at all (no grants, no policies).


-- -----------------------------------------------------------------------------
-- 5. Company walls for all business tables (they all have "companyId")
-- -----------------------------------------------------------------------------
-- USING      = which existing rows the user can see / change
-- WITH CHECK = which rows the user is allowed to write (prevents moving a
--              record into, or creating one in, someone else's company)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brands', 'locations', 'employees',
    'customers', 'customer_contacts', 'projects',
    'container_types', 'containers', 'maintenance_records',
    'rentals', 'jobs', 'external_links', 'activity_notes'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO app_user', t);
    EXECUTE format($p$
      CREATE POLICY company_isolation ON public.%I
        FOR ALL TO app_user
        USING      ("companyId" = ANY ((SELECT app.accessible_company_ids())::uuid[]))
        WITH CHECK ("companyId" = ANY ((SELECT app.accessible_company_ids())::uuid[]))
    $p$, t);
  END LOOP;
END
$$;

-- container_events: add and read only (no UPDATE grant at all).
GRANT SELECT, INSERT ON public.container_events TO app_user;
CREATE POLICY company_isolation_read ON public.container_events
  FOR SELECT TO app_user
  USING ("companyId" = ANY ((SELECT app.accessible_company_ids())::uuid[]));
CREATE POLICY company_isolation_insert ON public.container_events
  FOR INSERT TO app_user
  WITH CHECK ("companyId" = ANY ((SELECT app.accessible_company_ids())::uuid[]));


-- -----------------------------------------------------------------------------
-- 6. Organizations and companies
-- -----------------------------------------------------------------------------
-- Visible if the user can access them. Creating new organizations/companies
-- (acquisitions, licensees) is a platform-admin task for now.
GRANT SELECT, INSERT, UPDATE ON public.organizations TO app_user;
CREATE POLICY org_read ON public.organizations
  FOR SELECT TO app_user
  USING (id = ANY ((SELECT app.accessible_org_ids())::uuid[]));
CREATE POLICY org_admin_write ON public.organizations
  FOR INSERT TO app_user
  WITH CHECK ((SELECT app.is_platform_admin()));
CREATE POLICY org_admin_update ON public.organizations
  FOR UPDATE TO app_user
  USING      (app.can_manage_memberships(id, NULL))
  WITH CHECK (app.can_manage_memberships(id, NULL));

GRANT SELECT, INSERT, UPDATE ON public.companies TO app_user;
CREATE POLICY company_read ON public.companies
  FOR SELECT TO app_user
  USING (id = ANY ((SELECT app.accessible_company_ids())::uuid[]));
CREATE POLICY company_create ON public.companies
  FOR INSERT TO app_user
  WITH CHECK ((SELECT app.is_platform_admin()));
CREATE POLICY company_update ON public.companies
  FOR UPDATE TO app_user
  USING      (app.can_manage_memberships("organizationId", id))
  WITH CHECK (app.can_manage_memberships("organizationId", id));


-- -----------------------------------------------------------------------------
-- 7. Users
-- -----------------------------------------------------------------------------
-- New users are created by the login system (Phase 3), not by app_user.
-- A user may update only their own name. Nobody can make themselves a
-- platform admin through the app.
GRANT SELECT ON public.users TO app_user;
GRANT UPDATE ("fullName", "updatedAt") ON public.users TO app_user;

CREATE POLICY users_read ON public.users
  FOR SELECT TO app_user
  USING (
        id = (SELECT app.current_user_id())
     OR (SELECT app.is_platform_admin())
     OR EXISTS (
          SELECT 1 FROM public.memberships m
           WHERE m."userId" = users.id
             AND m."organizationId" = ANY ((SELECT app.accessible_org_ids())::uuid[])
        )
  );
CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO app_user
  USING      (id = (SELECT app.current_user_id()))
  WITH CHECK (id = (SELECT app.current_user_id()));


-- -----------------------------------------------------------------------------
-- 8. Memberships (who has which role)
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.memberships TO app_user;

CREATE POLICY memberships_read ON public.memberships
  FOR SELECT TO app_user
  USING (
        "userId" = (SELECT app.current_user_id())
     OR "organizationId" = ANY ((SELECT app.accessible_org_ids())::uuid[])
  );
CREATE POLICY memberships_insert ON public.memberships
  FOR INSERT TO app_user
  WITH CHECK (
        app.can_manage_memberships("organizationId", "companyId")
    -- org-wide roles can only be granted by org owners/admins or platform admins
    AND ("companyId" IS NOT NULL OR app.can_manage_memberships("organizationId", NULL))
    -- company admins can't hand out org-level roles
    AND (role NOT IN ('ORG_OWNER', 'ORG_ADMIN') OR app.can_manage_memberships("organizationId", NULL))
  );
CREATE POLICY memberships_update ON public.memberships
  FOR UPDATE TO app_user
  USING (app.can_manage_memberships("organizationId", "companyId"))
  WITH CHECK (
        app.can_manage_memberships("organizationId", "companyId")
    AND ("companyId" IS NOT NULL OR app.can_manage_memberships("organizationId", NULL))
    AND (role NOT IN ('ORG_OWNER', 'ORG_ADMIN') OR app.can_manage_memberships("organizationId", NULL))
  );


-- -----------------------------------------------------------------------------
-- 9. Audit log: add and read only
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.audit_log TO app_user;
CREATE POLICY audit_read ON public.audit_log
  FOR SELECT TO app_user
  USING (
        (SELECT app.is_platform_admin())
     OR "companyId" = ANY ((SELECT app.accessible_company_ids())::uuid[])
     OR ("companyId" IS NULL AND "organizationId" = ANY ((SELECT app.accessible_org_ids())::uuid[]))
  );
CREATE POLICY audit_insert ON public.audit_log
  FOR INSERT TO app_user
  WITH CHECK (
        "userId" = (SELECT app.current_user_id())
    AND (
          "companyId" IS NULL
       OR "companyId" = ANY ((SELECT app.accessible_company_ids())::uuid[])
    )
  );


-- -----------------------------------------------------------------------------
-- 10. Lock history: container_events and audit_log can never be changed
-- -----------------------------------------------------------------------------
-- Triggers apply to EVERY role, including the database owner.
CREATE OR REPLACE FUNCTION app.prevent_history_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% is permanent history: rows can be added but never changed or deleted', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER container_events_add_only
  BEFORE UPDATE OR DELETE ON public.container_events
  FOR EACH ROW EXECUTE FUNCTION app.prevent_history_change();
CREATE TRIGGER container_events_no_truncate
  BEFORE TRUNCATE ON public.container_events
  FOR EACH STATEMENT EXECUTE FUNCTION app.prevent_history_change();

CREATE TRIGGER audit_log_add_only
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION app.prevent_history_change();
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION app.prevent_history_change();

REVOKE ALL ON FUNCTION app.prevent_history_change() FROM PUBLIC, anon, authenticated;
