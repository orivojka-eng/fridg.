import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { env } from '../config/env';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export class GoogleCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'GoogleCancelled';
  }
}

/** Whether this build can offer Google sign-in. */
export const googleAvailable = () => Platform.OS === 'ios' && !!env.GOOGLE_IOS_CLIENT_ID;

/**
 * Google sign-in for iOS with Google's official OAuth flow:
 * authorization code + PKCE with the iOS client id (no client secret exists
 * or is needed), returning through the reversed-client-id URL scheme.
 * Only the resulting ID token goes to FRIDGR, where Better Auth verifies its
 * signature and audience against Google's keys.
 */
export async function getGoogleIdToken(): Promise<string> {
  if (Platform.OS !== 'ios') throw new Error('Google sign-in is available on iPhone. On this device use email or Apple.');
  const clientId = env.GOOGLE_IOS_CLIENT_ID;
  if (!clientId) throw new Error('Google sign-in is not set up in this build yet. Use email or Apple.');
  const redirectUri = `${clientId.split('.').reverse().join('.')}:/oauthredirect`;

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'email', 'profile'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { prompt: 'select_account' },
  });
  const result = await request.promptAsync(discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') throw new GoogleCancelled();
  if (result.type !== 'success' || !result.params.code) throw new Error('Google sign-in did not finish. Try again.');

  const tokens = await AuthSession.exchangeCodeAsync(
    { clientId, code: result.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier ?? '' } },
    discovery,
  );
  if (!tokens.idToken) throw new Error('Google did not return an ID token. Try again.');
  return tokens.idToken;
}
