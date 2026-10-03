/**
 * Browser-side Firebase Auth wrapper. Firebase owns passwords (hashed + salted), tokens and SSO.
 * The API verifies the resulting ID tokens with firebase-admin (lib/server/firebaseAdmin.ts).
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  EmailAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onIdTokenChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  type Auth,
  type AuthProvider,
  type User,
} from 'firebase/auth';

export type SsoProvider = 'google' | 'github' | 'discord';

let app: FirebaseApp | null = null;

export function isFirebaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

function auth(): Auth {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* variables.');
  if (!app) {
    app =
      getApps()[0] ??
      initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
  }
  return getAuth(app);
}

export function enabledSsoProviders(): SsoProvider[] {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_SSO_PROVIDERS ?? '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean) as SsoProvider[];
  return list.filter((p) => p !== 'discord' || !!process.env.NEXT_PUBLIC_FIREBASE_DISCORD_PROVIDER_ID);
}

function provider(name: SsoProvider): AuthProvider {
  if (name === 'google') return new GoogleAuthProvider();
  if (name === 'github') return new GithubAuthProvider();
  // Discord is not built into Firebase; configure it as an OIDC provider (Identity Platform).
  return new OAuthProvider(process.env.NEXT_PUBLIC_FIREBASE_DISCORD_PROVIDER_ID || 'oidc.discord');
}

export async function signup(email: string, password: string): Promise<User> {
  return (await createUserWithEmailAndPassword(auth(), email, password)).user;
}

export async function login(email: string, password: string): Promise<User> {
  return (await signInWithEmailAndPassword(auth(), email, password)).user;
}

export async function loginWithProvider(name: SsoProvider): Promise<User> {
  return (await signInWithPopup(auth(), provider(name))).user;
}

export async function logout(): Promise<void> {
  if (isFirebaseConfigured()) await signOut(auth());
}

export function getCurrentUser(): User | null {
  return isFirebaseConfigured() ? auth().currentUser : null;
}

/** Wait for Firebase to restore the persisted session on page load. */
export function authReady(): Promise<User | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  const a = auth();
  return a.authStateReady().then(() => a.currentUser);
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = getCurrentUser() ?? (await authReady());
  return user ? user.getIdToken(forceRefresh) : null;
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured()) {
    cb(null);
    return () => {};
  }
  return onIdTokenChanged(auth(), cb);
}

export function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth(), email);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = getCurrentUser();
  if (!user?.email) throw new Error('Not signed in with email/password.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
}

/** Map Firebase error codes to friendly messages. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/weak-password': 'Password is too weak — use at least 8 characters.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/user-not-found': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed before finishing.',
    'auth/account-exists-with-different-credential': 'This email is already linked to another sign-in method.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/requires-recent-login': 'Please log in again to change your password.',
  };
  return map[code] ?? (err instanceof Error ? err.message : 'Authentication failed.');
}
