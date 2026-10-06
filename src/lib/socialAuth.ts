import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useUserStore } from '../store/useUserStore';
import { env } from '../config/env';
import { GoogleCancelled, getGoogleIdToken } from './googleAuth';

export class SocialCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SocialCancelled';
  }
}

export const isCancelled = (e: unknown) => e instanceof SocialCancelled || (e as { code?: string })?.code === 'ERR_REQUEST_CANCELED';

/**
 * Sign in with Apple: the native sheet returns an identity token that only the
 * server verifies (Apple JWKS). Google uses Google's own OAuth sheet
 * (lib/googleAuth.ts) and sends only the ID token, which the server verifies.
 * Without EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID it says so instead of pretending.
 */
export async function socialSignIn(provider: 'Apple' | 'Google') {
  const store = useUserStore.getState();
  if (!env.USE_BACKEND) {
    // Prototype mode: a demo account keeps the flow testable.
    if (provider === 'Apple') return store.signInWithApple({ identityToken: 'demo', fullName: { givenName: 'Alex', familyName: 'Demo' } });
    return store.signInWithGoogle('demo');
  }
  if (provider === 'Apple') {
    if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) throw new Error('Sign in with Apple needs an iPhone or iPad.');
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error('Apple did not return a token. Try again.');
    return store.signInWithApple({ identityToken: credential.identityToken, authorizationCode: credential.authorizationCode, fullName: credential.fullName });
  }
  try {
    const idToken = await getGoogleIdToken();
    return store.signInWithGoogle(idToken);
  } catch (e) {
    if (e instanceof GoogleCancelled) throw new SocialCancelled();
    throw e;
  }
}
