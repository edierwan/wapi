-- ----------------------------------------------------------------------------
-- Phase 4 · System RBAC bootstrap (idempotent)
--
-- Seeds:
--   * 4 system roles (SYSTEM_SUPER_ADMIN / ADMIN / SUPPORT / BILLING) with
--     scope_type='system' and tenant_id IS NULL.
--   * Standard system permissions used by /admin and the platform console.
--   * role_permissions mappings.
--
-- Does NOT create any user — admin user is bootstrapped via
-- `pnpm db:bootstrap:admin` (reads BOOTSTRAP_SUPER_ADMIN_* env vars only).
--
-- Re-runnable. Safe on both wapi (prod) and wapi.dev (dev).
-- ----------------------------------------------------------------------------

BEGIN;

-- ── permissions ─────────────────────────────────────────────────────────────
INSERT INTO permissions (code, module, action, description) VALUES
  ('system.admin.access',         'system',           'access',       'Access /admin.'),
  ('system.tenants.read',         'system.tenants',   'read',         'View any tenant.'),
  ('system.tenants.write',        'system.tenants',   'write',        'Create/update/suspend tenants.'),
  ('system.tenants.impersonate',  'system.tenants',   'impersonate',  'Impersonate a tenant member.'),
  ('system.users.read',           'system.users',     'read',         'View global users.'),
  ('system.users.write',          'system.users',     'write',        'Update global users.'),
  ('system.users.assign_role',    'system.users',     'assign_role',  'Assign system roles.'),
  ('system.whatsapp.read',        'system.whatsapp',  'read',         'View WhatsApp sessions across tenants.'),
  ('system.whatsapp.write',       'system.whatsapp',  'write',        'Reset/disconnect any WhatsApp session.'),
  ('system.jobs.read',            'system.jobs',      'read',         'View global queues/jobs.'),
  ('system.jobs.write',           'system.jobs',      'write',        'Retry/cancel jobs.'),
  ('system.ai.read',              'system.ai',        'read',         'View AI providers.'),
  ('system.ai.write',             'system.ai',        'write',        'Configure shared AI providers.'),
  ('system.billing.read',         'system.billing',   'read',         'View plans/invoices.'),
  ('system.billing.write',        'system.billing',   'write',        'Manage plans/invoices.'),
  ('system.audit.read',           'system.audit',     'read',         'Read system audit log.'),
  ('system.health.read',          'system.health',    'read',         'View system health metrics.'),
  ('system.flags.read',           'system.flags',     'read',         'Read feature flags.'),
  ('system.flags.write',          'system.flags',     'write',        'Toggle feature flags.')
ON CONFLICT (code) DO UPDATE
  SET module      = EXCLUDED.module,
      action      = EXCLUDED.action,
      description = EXCLUDED.description;

-- ── roles ──────────────────────────────────────────────────────────────────
-- We don't have a unique index on (code, scope_type, tenant_id IS NULL) so
-- we upsert via INSERT ... WHERE NOT EXISTS, then UPDATE for description sync.
WITH r(code, name, description) AS (
  VALUES
    ('SYSTEM_SUPER_ADMIN', 'System Super Admin', 'Full access to every system module and every tenant.'),
    ('SYSTEM_ADMIN',       'System Admin',       'Operate the platform, but cannot grant SYSTEM_SUPER_ADMIN.'),
    ('SYSTEM_SUPPORT',     'System Support',     'Read-only access to tenants for support.'),
    ('SYSTEM_BILLING',     'System Billing',     'Manage plans, subscriptions, invoices.')
)
INSERT INTO roles (tenant_id, code, name, description, scope_type, is_system_role)
SELECT NULL, r.code, r.name, r.description, 'system', true
FROM r
WHERE NOT EXISTS (
  SELECT 1 FROM roles ex
  WHERE ex.code = r.code AND ex.scope_type = 'system' AND ex.tenant_id IS NULL
);

UPDATE roles ro
SET name = r.name,
    description = r.description,
    is_system_role = true,
    updated_at = now()
FROM (VALUES
  ('SYSTEM_SUPER_ADMIN', 'System Super Admin', 'Full access to every system module and every tenant.'),
  ('SYSTEM_ADMIN',       'System Admin',       'Operate the platform, but cannot grant SYSTEM_SUPER_ADMIN.'),
  ('SYSTEM_SUPPORT',     'System Support',     'Read-only access to tenants for support.'),
  ('SYSTEM_BILLING',     'System Billing',     'Manage plans, subscriptions, invoices.')
) AS r(code, name, description)
WHERE ro.code = r.code AND ro.scope_type = 'system' AND ro.tenant_id IS NULL;

-- ── role_permissions mappings ──────────────────────────────────────────────
-- SYSTEM_SUPER_ADMIN gets every system.* permission.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SYSTEM_SUPER_ADMIN'
  AND r.scope_type = 'system' AND r.tenant_id IS NULL
  AND p.code LIKE 'system.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SYSTEM_ADMIN gets all except billing-only (kept for SYSTEM_BILLING / SUPER).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
  'system.admin.access',
  'system.tenants.read', 'system.tenants.write',
  'system.users.read',   'system.users.write',
  'system.whatsapp.read','system.whatsapp.write',
  'system.jobs.read',    'system.jobs.write',
  'system.ai.read',      'system.ai.write',
  'system.audit.read',   'system.health.read',
  'system.flags.read'
])
WHERE r.code = 'SYSTEM_ADMIN' AND r.scope_type = 'system' AND r.tenant_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SYSTEM_SUPPORT: read-only.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
  'system.admin.access',
  'system.tenants.read',
  'system.users.read',
  'system.whatsapp.read',
  'system.jobs.read',
  'system.audit.read',
  'system.health.read'
])
WHERE r.code = 'SYSTEM_SUPPORT' AND r.scope_type = 'system' AND r.tenant_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SYSTEM_BILLING.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
  'system.admin.access',
  'system.billing.read',
  'system.billing.write'
])
WHERE r.code = 'SYSTEM_BILLING' AND r.scope_type = 'system' AND r.tenant_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;

-- Sanity:
--   SELECT code, scope_type, tenant_id FROM roles WHERE scope_type='system';
--   SELECT count(*) FROM role_permissions
--     WHERE role_id = (SELECT id FROM roles WHERE code='SYSTEM_SUPER_ADMIN' AND scope_type='system' AND tenant_id IS NULL);
