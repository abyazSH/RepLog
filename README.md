# RepLog
React/Next.js gym tracker, Supabase PostgreSQL + email/password Auth, deploy to Vercel.

## Local
Run npm install, then npm run dev. Open http://127.0.0.1:3000 for the public introduction page.
Existing account workout history is preserved. Demo routes have been removed.

## Pages
Active workouts include an automatic rest timer (30 seconds to 5 minutes) with pause/resume and skip. Duration is stored on the device; the current timer is restored in the same tab after navigation or refresh using its deadline. Completion is a visual notification, without background system notifications. Previous-session references use the last completed session of the same program before the active workout and match exercise variants by name.
- `/`: public RepLog introduction, features, register/login links, and a clearly labelled illustrative workout.
- `/login` and `/register`: separate authentication pages. Successful login goes to `/dashboard`.
- `/dashboard`, `/workouts`, `/progress`, `/history`, `/profile`: authenticated application routes.
Training pages share a persistent layout so in-memory drafts and pending autosaves survive menu navigation. Refresh and browser Back/Forward select the page from its URL. Signed-in accounts with dashboard access are redirected from `/`, `/login`, and `/register` to `/dashboard`. Server redirects preserve refreshed cookies; the client guard also checks sessions on cached navigation and restored browser pages. Accounts denied dashboard access remain on the guest/auth pages to avoid redirect loops.
Authentication and online workout storage use the browser Supabase client; database RLS and storage RPC enforce ownership. Do not remove those database protections.

## Database setup
- Existing project with 001 already applied: run 002_email_password.sql (if not yet applied), then 003_custom_programs.sql.
- New project: run 001_replog.sql followed by 002_email_password.sql and 003_custom_programs.sql.
- 002 is safe to rerun and preserves workout data. The old private email list remains stored but no longer grants or limits access.
- Registration is open to confirmed email/password accounts. Each account can read only its own records through RLS, and save through the revision-checked RPC.
- Passwords are handled by Supabase Auth, never stored in workout_state.

## Supabase dashboard
1. Authentication: enable Email provider and allow new users to sign up. Disable Google provider if previously enabled.
2. Keep Confirm email enabled. Set minimum password length to at least 8.
3. URL Configuration Site URL: http://127.0.0.1:3000
4. Redirect URLs: http://127.0.0.1:3000/auth/callback
5. Configure custom SMTP for confirmations to friends: the default mail sender is restricted and rate limited. See https://supabase.com/docs/guides/auth/auth-smtp.
6. Copy .env.example to .env.local; fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, set APP_URL=http://127.0.0.1:3000. Restart dev server.
7. Register, open the confirmation link in the same browser, then login. Logout is in Profil. If the link expires, register again or request a resend through the Supabase dashboard.
No Google Cloud project, client ID or secret is needed.

## Vercel
Import this folder as Next.js; add the three environment variables above using the final HTTPS deployment origin for APP_URL. Set Supabase Site URL and callback redirect URL to match the deployment. Never expose a service_role key. Do not commit .env.local.

## Validation
npm test
npm run build
Test real registration, confirmation, incorrect password, logout, and two-account isolation after configuring Supabase. Database tests use PGlite with a simulated Auth schema and execute both migrations.

## Latest interface updates
- Rest timer stays inside the active workout on `/workouts`.
- Change Indonesian/English only in Profile > Preferences. The language applies throughout the site and is saved per device.
- Completed sessions offer a PNG share card from History or immediately after finishing. Story and square formats are supported. Sharing uses the device share menu when available, otherwise download. No private notes, email, or body weight are included.
- Run `npm run verify` before deploying. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the existing Vercel project settings.

## Appearance
Profile > Color theme offers System, Light, and Dark. New visitors follow their device theme, including changes while the page is open. Explicit choices override the system theme and are restored before the page renders. Theme controls appear only in Profile. The exported share card retains its designed dark background, independently of the website appearance.

Custom programs: apply `supabase/migrations/003_custom_programs.sql` to existing databases before deploying. Programs are private per user; deleting programs preserves session snapshots, history, and body weight records. Profile names are stored in Supabase Auth metadata.

Cardio tracking: add Treadmill or Stationary bike in Profile > program customization. Treadmill records minutes, km/h and incline percent; stationary bikes record minutes plus optional resistance level, console distance, cadence RPM and power watts. Cardio is excluded from strength volume/set counts and has its own metric charts, history, previous-session reference and share-card minutes. Existing strength records remain valid. No additional SQL migration is required beyond 003_custom_programs.sql.

Dashboard overview: weekly sessions vs the current schedule goal, completed strength sets and volume vs the same local weekday/time last week, and distinct improved strength exercises. Improvement compares the latest weekly heaviest completed set with the previous comparable session in the same program/variant: more load with at least equal reps, or more reps at equal load. More sets alone does not qualify. Missing baselines show no comparison; zero prior volume uses a kg difference instead of a percentage. Cardio contributes to session consistency only.

Light mode uses Orchid Rose & Carbon Warm: warm rose page (#FDF8F7), white cards, berry text (#2A161A), rose muted text (#7A5E65), crimson accents (#D11A5B), and a rose/lavender session hero (#FFE3EA to #E8D5FD). Cards use softer corners and warm shadows. Buttons, navigation, charts, inputs, timer states and authentication screens use scoped light-theme overrides; dark styling is preserved.
