import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { optionalEnv } from './env';

function serviceAccount(): ServiceAccount {
  const json = optionalEnv('FIREBASE_CONFIG');
  if (json) {
    const parsed = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  }
  const projectId = optionalEnv('FIREBASE_PROJECT_ID') ?? optionalEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  const clientEmail = optionalEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = optionalEnv('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_CONFIG or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY.');
  }
  return { projectId, clientEmail, privateKey };
}

function app(): App {
  return getApps()[0] ?? initializeApp({ credential: cert(serviceAccount()) });
}

let authOverride: Pick<Auth, 'verifyIdToken' | 'revokeRefreshTokens'> | null = null;

export function firebaseAuth(): Pick<Auth, 'verifyIdToken' | 'revokeRefreshTokens'> {
  return authOverride ?? getAuth(app());
}

/** Verify a Firebase ID token. checkRevoked ensures logged-out sessions cannot be reused. */
export function verifyIdToken(token: string): Promise<DecodedIdToken> {
  return firebaseAuth().verifyIdToken(token, true);
}

/** For tests. */
export function __setFirebaseAuth(auth: typeof authOverride): void {
  authOverride = auth;
}
