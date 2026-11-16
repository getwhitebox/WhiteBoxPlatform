-- =============================================================================
-- LINK SUPABASE LOGINS TO OUR USERS TABLE  (Phase 3)
-- =============================================================================
-- Supabase keeps login accounts (email, password, two-factor) in its own
-- "auth.users" table. Whenever a login account is created, or its email
-- changes, this copies the id and email into our public "users" table, so
-- memberships and history can refer to the person.
--
-- Roles and admin rights are NOT copied. They are granted separately, so
-- creating a login never gives anyone access by itself.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.sync_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, "updatedAt")
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        "updatedAt" = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.sync_auth_user() FROM PUBLIC, anon, authenticated, app_user;

-- Supabase's "auth" schema only exists in the real database, not in the
-- temporary database Prisma uses to check migrations, so this is conditional.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    -- Supabase's login service runs these triggers as supabase_auth_admin.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      GRANT USAGE ON SCHEMA app TO supabase_auth_admin;
      GRANT EXECUTE ON FUNCTION app.sync_auth_user() TO supabase_auth_admin;
    END IF;

    DROP TRIGGER IF EXISTS whitebox_sync_new_user ON auth.users;
    CREATE TRIGGER whitebox_sync_new_user
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION app.sync_auth_user();

    DROP TRIGGER IF EXISTS whitebox_sync_user_email ON auth.users;
    CREATE TRIGGER whitebox_sync_user_email
      AFTER UPDATE OF email ON auth.users
      FOR EACH ROW EXECUTE FUNCTION app.sync_auth_user();

    -- Copy any login accounts that already exist.
    INSERT INTO public.users (id, email, "updatedAt")
    SELECT u.id, u.email, now() FROM auth.users u WHERE u.email IS NOT NULL
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;
