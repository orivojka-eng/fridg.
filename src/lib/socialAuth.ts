import { useUserStore } from '../store/useUserStore';

export class SocialCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SocialCancelled';
  }
}

export const isCancelled = (e: unknown) => e instanceof SocialCancelled || (e as { code?: string })?.code === 'ERR_REQUEST_CANCELED';

/** Demo mode: Apple and Google sign-in create a demo account. */
export async function socialSignIn(provider: 'Apple' | 'Google') {
  const store = useUserStore.getState();
  if (provider === 'Apple') return store.signInWithApple({ identityToken: 'demo', fullName: { givenName: 'Alex', familyName: 'Demo' } });
  return store.signInWithGoogle('demo');
}
