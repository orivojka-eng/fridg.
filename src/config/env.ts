/**
 * Public app configuration. Only EXPO_PUBLIC_* variables exist here; they are
 * bundled into the binary, so nothing secret may ever be added.
 *
 * `USE_BACKEND=false` keeps every store on its local mock data (the prototype
 * behaviour). Flip it on once the FRIDGR API is reachable.
 */
const flag = (v: string | undefined) => v === 'true' || v === '1';

const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

/** Release builds must talk to the public https API, never a dev machine on the LAN. */
const isDevAddress = (url: string) => !url.startsWith('https://') || /\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url);
if (!__DEV__ && flag(process.env.EXPO_PUBLIC_USE_BACKEND) && isDevAddress(apiUrl)) {
  // eslint-disable-next-line no-console
  console.error(`EXPO_PUBLIC_API_URL must be the public https API in release builds (got a development address).`);
}

export const env = {
  USE_BACKEND: flag(process.env.EXPO_PUBLIC_USE_BACKEND),
  API_URL: apiUrl,
  /** iOS OAuth client id from Google Cloud (public, not a secret). Empty = Google button explains it is unavailable. */
  GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  REVENUECAT_IOS_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  REVENUECAT_ANDROID_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
};
