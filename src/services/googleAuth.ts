import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let isManualToken = false;
// Access token is cached strictly in memory (never localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn && !isManualToken) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else if (!isManualToken) {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    isManualToken = false;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Drive access token. Please try signing in again.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (
      error?.code === 'auth/unauthorized-domain' ||
      error?.message?.includes('auth/unauthorized-domain')
    ) {
      throw new Error(
        'UNAUTHORIZED_DOMAIN: Firebase Google Sign-In is restricted to the cloud domain and blocks "localhost". Please use the "Upload File" or "Google Sheet Link" tabs to load your entries instantly!'
      );
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const setManualAccessToken = (
  token: string,
  email?: string
): { user: User; accessToken: string } => {
  isManualToken = true;
  cachedAccessToken = token.trim();
  const mockUser = {
    email: email || 'user@workspace.com',
    displayName: email ? email.split('@')[0] : 'Workspace User',
    uid: `token-user-${Date.now()}`,
  } as unknown as User;
  return { user: mockUser, accessToken: cachedAccessToken };
};

export const getAccessToken = (): string | null => cachedAccessToken;

export const logout = async (): Promise<void> => {
  isManualToken = false;
  cachedAccessToken = null;
  await auth.signOut();
};
