// Temporary diagnostic endpoint — remove after production debugging.
import { createHandler } from '@/lib/server/handler';
import { optionalEnv } from '@/lib/server/env';

export default createHandler({
  GET: async () => {
    const env = {
      FIREBASE_PROJECT_ID: !!optionalEnv('FIREBASE_PROJECT_ID'),
      FIREBASE_CLIENT_EMAIL: !!optionalEnv('FIREBASE_CLIENT_EMAIL'),
      FIREBASE_PRIVATE_KEY: !!optionalEnv('FIREBASE_PRIVATE_KEY'),
      SUPABASE_URL: !!optionalEnv('SUPABASE_URL') || !!optionalEnv('NEXT_PUBLIC_SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: !!(optionalEnv('SUPABASE_SERVICE_ROLE_KEY') || optionalEnv('SUPABASE_SECRET_KEY')),
      CLOUDINARY_API_SECRET: !!optionalEnv('CLOUDINARY_API_SECRET'),
      node: process.version,
    };
    let admin: Record<string, unknown> = { loaded: false };
    try {
      const app = await import('firebase-admin/app');
      const auth = await import('firebase-admin/auth');
      admin = { loaded: true, appKeys: Object.keys(app).slice(0, 8), authKeys: Object.keys(auth).slice(0, 8) };
    } catch (e) {
      admin = { loaded: false, error: String(e), stack: (e as Error).stack };
    }
    return { env, admin };
  },
});
