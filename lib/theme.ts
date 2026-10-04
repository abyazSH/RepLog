export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
export function themePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}
// Runs before hydration so new visitors see their device theme on first paint.
export const themeBootstrap = `(function(){var p='system';try{var s=localStorage.getItem('replog-theme');if(s==='light'||s==='dark')p=s;}catch{}var dark=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=p==='system'?(dark?'dark':'light'):p;})();`;
