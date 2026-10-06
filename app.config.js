/**
 * Extends app.json at build time.
 *
 * Google sign-in on iOS returns to the app through the "reversed client id"
 * URL scheme (com.googleusercontent.apps.<id>). It is derived from the public
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID so nothing is hard-coded; without it the
 * app builds normally and the Google button explains it is unavailable.
 */
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  if (!iosClientId) return config;
  const reversed = iosClientId.split('.').reverse().join('.');
  const existing = config.ios?.infoPlist?.CFBundleURLTypes ?? [];
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        CFBundleURLTypes: [...existing, { CFBundleURLSchemes: [reversed] }],
      },
    },
  };
};
