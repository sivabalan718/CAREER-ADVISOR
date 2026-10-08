import { env } from '../config/env.js';

export interface VerifiedUser {
  userId: string;
  email: string;
}

const tokenCache = new Map<string, { user: VerifiedUser; expiresAt: number }>();

/**
 * Verifies a Supabase access token by asking Supabase Auth who the token belongs to.
 * Returns null when the token is invalid/expired or Supabase is not configured.
 */
export async function verifySupabaseToken(token: string): Promise<VerifiedUser | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY }
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string; email?: string };
    if (!body.id) return null;
    const user = { userId: body.id, email: body.email ?? '' };
    tokenCache.set(token, { user, expiresAt: Date.now() + 5 * 60 * 1000 });
    return user;
  } catch {
    return null;
  }
}
