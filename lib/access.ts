export function authReady() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.APP_URL
  );
}
export function appOrigin() {
  return new URL(process.env.APP_URL!).origin;
}
