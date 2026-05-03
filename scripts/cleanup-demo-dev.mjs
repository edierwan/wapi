import pg from "pg";

const APPLY = process.argv.includes("--apply");
const DEMO_PHONE_FRAGMENT = "60192277233";

const USER_MATCH_SQL = `
  lower(coalesce(u.name, '')) like '%demo%'
  or lower(coalesce(u.email, '')) like '%demo%'
  or lower(coalesce(u.email, '')) like '%local.invalid%'
  or coalesce(u.phone, '') like '%${DEMO_PHONE_FRAGMENT}%'
`;

const TENANT_MATCH_SQL = `
  lower(coalesce(t.name, '')) like '%demo%'
  or lower(coalesce(t.slug, '')) like '%demo%'
  or lower(coalesce(t.name, '')) like '%phase 3%'
  or lower(coalesce(t.slug, '')) like 'phase3%'
`;

function listFromCsv(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printJson(title, value) {
  console.log(`\n${title}`);
  console.log(JSON.stringify(value, null, 2));
}

async function queryRows(client, text) {
  const result = await client.query(text);
  return result.rows;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const dbResult = await client.query("select current_database() as db");
    const dbName = dbResult.rows[0]?.db;
    if (dbName !== "wapi.dev") {
      throw new Error(`Refusing to run outside wapi.dev (found ${dbName ?? "unknown"}).`);
    }

    const users = (await queryRows(
      client,
      `
        select
          u.id,
          coalesce(u.name, '') as name,
          coalesce(u.email, '') as email,
          coalesce(u.phone, '') as phone,
          u.is_system_admin as "isSystemAdmin",
          u.status,
          coalesce((
            select string_agg(r.code, ',')
            from user_system_roles usr
            join roles r on r.id = usr.role_id
            where usr.user_id = u.id
              and usr.status = 'active'
              and r.scope_type = 'system'
          ), '') as "systemRoles",
          coalesce((
            select string_agg(t.slug, ',')
            from tenant_members tm
            join tenants t on t.id = tm.tenant_id
            where tm.user_id = u.id
              and tm.status = 'active'
          ), '') as "activeTenantSlugs"
        from users u
        where ${USER_MATCH_SQL}
        order by u.created_at
      `,
    )).map((row) => ({
      ...row,
      systemRoles: listFromCsv(row.systemRoles),
      activeTenantSlugs: listFromCsv(row.activeTenantSlugs),
    }));

    const tenants = (await queryRows(
      client,
      `
        with target_users as (
          select u.id
          from users u
          where ${USER_MATCH_SQL}
        ),
        target_tenants as (
          select t.id, t.slug, t.name, t.status
          from tenants t
          where ${TENANT_MATCH_SQL}
        ),
        active_members as (
          select
            tm.tenant_id,
            string_agg(coalesce(u.email, '[no-email]') || ':' || tm.role, ',') as members,
            count(*) filter (
              where tm.user_id not in (select id from target_users)
            )::int as non_target_member_count
          from tenant_members tm
          join users u on u.id = tm.user_id
          where tm.status = 'active'
            and tm.tenant_id in (select id from target_tenants)
          group by tm.tenant_id
        )
        select
          t.id,
          t.slug,
          t.name,
          t.status,
          coalesce(a.members, '') as active_members,
          coalesce(a.non_target_member_count, 0) as "nonTargetMemberCount",
          (coalesce(a.non_target_member_count, 0) = 0) as "safeToDelete"
        from target_tenants t
        left join active_members a on a.tenant_id = t.id
        order by t.name, t.slug
      `,
    )).map((row) => ({
      ...row,
      activeMembers: listFromCsv(row.active_members),
    }));

    const artifacts = await queryRows(
      client,
      `
        select
          'pending_registrations' as bucket,
          id::text as id,
          coalesce(email, '') as email,
          coalesce(phone, '') as phone,
          coalesce(business_name, '') as label
        from pending_registrations
        where lower(coalesce(email, '')) like '%demo%'
           or lower(coalesce(full_name, '')) like '%demo%'
           or lower(coalesce(business_name, '')) like '%demo%'
           or coalesce(phone, '') like '%${DEMO_PHONE_FRAGMENT}%'
        union all
        select
          'phone_verifications' as bucket,
          id::text as id,
          '' as email,
          coalesce(phone, '') as phone,
          purpose as label
        from phone_verifications
        where coalesce(phone, '') like '%${DEMO_PHONE_FRAGMENT}%'
        union all
        select
          'password_reset_sessions' as bucket,
          prs.id::text as id,
          coalesce(u.email, '') as email,
          coalesce(u.phone, '') as phone,
          prs.expires_at::text as label
        from password_reset_sessions prs
        join users u on u.id = prs.user_id
        where ${USER_MATCH_SQL}
        order by bucket, id
      `,
    );

    const storageObjects = await queryRows(
      client,
      `
        select so.tenant_id as "tenantId", count(*)::int as "objectCount"
        from storage_objects so
        where so.tenant_id in (
          select t.id
          from tenants t
          where ${TENANT_MATCH_SQL}
        )
        group by so.tenant_id
        order by so.tenant_id
      `,
    );

    const safeTenants = tenants.filter((tenant) => tenant.safeToDelete);
    const blockedTenants = tenants.filter((tenant) => !tenant.safeToDelete);
    const safeTenantIds = safeTenants.map((tenant) => tenant.id);
    const safeTenantSlugSet = new Set(safeTenants.map((tenant) => tenant.slug));

    const blockedUsers = users.filter(
      (user) =>
        user.systemRoles.length > 0 ||
        user.activeTenantSlugs.some((slug) => !safeTenantSlugSet.has(slug)),
    );
    const safeUsers = users.filter(
      (user) => !blockedUsers.some((blockedUser) => blockedUser.id === user.id),
    );
    const safeUserIds = safeUsers.map((user) => user.id);

    const report = {
      apply: APPLY,
      currentDatabase: dbName,
      users,
      tenants,
      artifacts,
      storageObjects,
      safeUserIds,
      safeTenantIds,
      blockedUsers,
      blockedTenants,
    };

    printJson("DEMO_CLEANUP_REPORT", report);

    if (!APPLY) {
      console.log("\nDry run only. Re-run with --apply to execute cleanup.");
      return;
    }

    if (blockedUsers.length > 0 || blockedTenants.length > 0) {
      throw new Error(
        "Refusing to delete demo data while blocked users or tenants still require review.",
      );
    }

    const pendingRegistrationIds = artifacts
      .filter((row) => row.bucket === "pending_registrations")
      .map((row) => row.id);
    const phoneVerificationIds = artifacts
      .filter((row) => row.bucket === "phone_verifications")
      .map((row) => row.id);
    const passwordResetSessionIds = artifacts
      .filter((row) => row.bucket === "password_reset_sessions")
      .map((row) => row.id);

    await client.query("begin");
    try {
      if (pendingRegistrationIds.length > 0) {
        await client.query(
          "delete from pending_registrations where id = any($1::uuid[])",
          [pendingRegistrationIds],
        );
      }

      if (phoneVerificationIds.length > 0) {
        await client.query(
          "delete from phone_verifications where id = any($1::uuid[])",
          [phoneVerificationIds],
        );
      }

      if (passwordResetSessionIds.length > 0) {
        await client.query(
          "delete from password_reset_sessions where id = any($1::uuid[])",
          [passwordResetSessionIds],
        );
      }

      if (safeTenantIds.length > 0) {
        await client.query("delete from tenants where id = any($1::uuid[])", [safeTenantIds]);
      }

      if (safeUserIds.length > 0) {
        await client.query("delete from user_system_roles where user_id = any($1::uuid[])", [
          safeUserIds,
        ]);
        await client.query("delete from users where id = any($1::uuid[])", [safeUserIds]);
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    printJson("DEMO_CLEANUP_APPLIED", {
      deletedUsers: safeUserIds.length,
      deletedTenants: safeTenantIds.length,
      deletedPendingRegistrations: pendingRegistrationIds.length,
      deletedPhoneVerifications: phoneVerificationIds.length,
      deletedPasswordResetSessions: passwordResetSessionIds.length,
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});