# WAPI Platform Broker OTP

Date: 2026-05-02

## Scope

- Updated WAPI OTP delivery so broker mode uses the GetTouch Platform Broker instead of the legacy direct gateway path.
- Kept the legacy gateway path available only when `USE_PLATFORM_BROKER=false`.

## OTP Routing

- When `USE_PLATFORM_BROKER=true`:
  - registration OTP uses `POST {GETOUCH_PLATFORM_API_URL}/whatsapp/send-otp`
  - password reset OTP uses `POST {GETOUCH_PLATFORM_API_URL}/whatsapp/send-message`
  - WAPI sends `X-Platform-App-Key`
- When broker env is missing and `REQUIRE_PLATFORM_APP_KEY=true`, WAPI returns `Platform broker is not configured.`
- No fallback to the old WhatsApp gateway occurs while broker mode is enabled.

## Registration Flow

- Registration now passes `businessName` into the OTP sender so broker OTP can use the business-aware template.
- `phoneVerifications.provider` now records `platform_broker` when broker mode is enabled.

## Validation

- `pnpm typecheck` passed.
- `pnpm build` passed.

## Dependency Note

- Runtime broker delivery depends on the portal broker routes being deployed and WAPI holding a valid Platform App Key.
- The portal-side `platform_app_keys` table is now present on live `getouch.co` and remains absent from `wapi`.