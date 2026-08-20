# CampusFix Authentication Configuration

## Implemented login lifecycle

CampusFix now uses Supabase Auth for browser-based email/password registration, sign-in, session restoration, and sign-out. The login screen preserves its existing visual system and interaction pattern while sending authentication requests through `client/src/lib/supabase.ts` and `client/src/lib/supabase-auth.ts`.

An authenticated user who visits `/login` is redirected to the public CampusFix workspace. The homepage observes Supabase session state and shows **Log out** only when an active session exists. Logging out clears the browser session and returns the user to `/login`.

## Required browser environment values

The browser client requires the following public Supabase values. They must be configured through the project secrets interface rather than committed to source control.

| Environment variable | Required value | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Project URL from Supabase | Identifies the Supabase Auth project. |
| `VITE_SUPABASE_ANON_KEY` | Project publishable/anon key | Authorizes browser calls under Supabase row-level security. |

> Do not expose a Supabase service-role key in browser code. The login implementation only uses the public, browser-safe key.

## Supabase dashboard settings

In **Authentication → Sign In / Providers**, the **Email** provider must remain enabled. The **Confirm email** switch has been disabled for this project so a successful password registration can create an active session immediately, without a verification-link round trip.

This choice is appropriate for the requested immediate-access flow, but it should be paired with Supabase password-strength requirements, rate limiting, CAPTCHA where appropriate, and any campus-specific access policy before a public release.

## Optional campus SSO

The **Sign in to CampusFix** action sends a domain-based Supabase SSO request using the email domain supplied in the login field. It will work only after the relevant domain has been configured in Supabase with a supported SSO identity provider.

For each campus identity provider, configure the provider’s Supabase-issued callback/ACS details in the provider console and keep the application’s public base URL in Supabase **URL Configuration**. If deployment moves to a custom domain, add that domain before enabling SSO for end users.

## Verification record

The project passed TypeScript validation and the full Vitest suite after the integration. The browser session was verified to redirect an authenticated visit away from `/login`, expose the homepage logout control, return to `/login` after logout, and clear the local Supabase access-token state.
