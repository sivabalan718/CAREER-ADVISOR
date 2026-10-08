import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { verifySupabaseToken, VerifiedUser } from './supabase-auth.js';

export interface AuthenticatedRequest extends Request {
  user?: VerifiedUser;
}

/**
 * Requires a valid Supabase session. When Supabase is not configured (local tests / offline dev)
 * the request passes through anonymously so the deterministic engine stays usable.
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please sign in to run M63 analyses.' } });
    return;
  }

  const user = await verifySupabaseToken(authHeader.slice('Bearer '.length));
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Your session has expired. Please sign in again.' } });
    return;
  }

  req.user = user;
  next();
}
