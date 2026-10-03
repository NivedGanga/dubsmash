/** Read a required server env var, failing loudly (with the variable name) when missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const appUrl = () => optionalEnv('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';

export function allowedOrigins(): string[] {
  return (optionalEnv('ALLOWED_ORIGINS') ?? appUrl())
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
