import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/**
 * Neon over HTTP fungerer både i Vercel-functions og lokalt (seed/scripts).
 * DATABASE_URL må peke på Neon i EU-region (GDPR — brief del 15).
 */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL mangler');
  return drizzle(neon(url), { schema });
}

export type Db = ReturnType<typeof getDb>;
