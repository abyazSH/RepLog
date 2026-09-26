export const tabRoutes = {
  Beranda: '/dashboard',
  Latihan: '/workouts',
  Progress: '/progress',
  Riwayat: '/history',
  Profil: '/profile',
} as const;
export type AppTab = keyof typeof tabRoutes;
export function tabForPath(path: string): AppTab {
  return (Object.keys(tabRoutes) as AppTab[]).find(tab => tabRoutes[tab] === path) ?? 'Beranda';
}
