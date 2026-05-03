# WAPI Settings Platform Access UI

Date: 2026-05-02

## Scope

- Reworked the WAPI System Admin Settings page around platform-managed access instead of raw downstream service env dumps.
- Preserved the existing admin shell and route structure.

## UI Changes

- Added card-based sections for:
  - Application
  - Platform Access
  - Service Routing
  - Feature Flags
  - Security and Secrets
- Masked the Platform App Key.
- Added platform-oriented wording so WAPI is presented as a consumer of the shared platform broker.
- Kept legacy compatibility notice when direct gateway env values still exist.

## Runtime Status

- The settings page now performs a server-side broker auth check when `USE_PLATFORM_BROKER=true` and platform env is present.
- `Connected` is shown only when the broker auth check passes.
- Otherwise the page falls back to `Configured` or `Not Configured`.

## Validation

- `pnpm typecheck` passed.
- `pnpm build` passed.

## Notes

- The page keeps secrets masked and does not expose raw service credentials.
- Broker connectivity depends on the portal broker routes staying deployed and WAPI holding a valid Platform App Key.
- The portal-side `platform_app_keys` table is now present on live `getouch.co` and remains absent from `wapi`.