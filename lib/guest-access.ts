export type GuestAuthClient = {
  auth: {getUser: () => Promise<{data: {user: unknown | null}; error: unknown}>};
  rpc: (name: 'replog_is_allowed') => PromiseLike<{data: unknown; error: unknown}>;
};
// Match dashboard eligibility to avoid a guest/dashboard redirect loop for denied accounts.
export async function canOpenDashboard(client: GuestAuthClient): Promise<boolean> {
  const identity = await client.auth.getUser();
  if (identity.error || !identity.data.user) return false;
  const permission = await client.rpc('replog_is_allowed');
  return !permission.error && permission.data === true;
}
export function isGuestRoute(path: string): boolean {
  return path === '/' || path === '/login' || path === '/register';
}
