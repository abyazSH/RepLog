# RepLog
React/Next.js gym tracker, Supabase PostgreSQL + email/password Auth, deploy to Vercel.

## Local
Run npm install, then npm run dev. Open http://127.0.0.1:3000/login or /demo.
Demo localStorage and existing workout history are preserved; demo records are not uploaded automatically.

## Database setup
- Existing project with 001 already applied: run ONLY supabase/migrations/002_email_password.sql.
- New project: run 001_replog.sql followed by 002_email_password.sql.
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
