import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg'
import * as schema from '../database/schema';

const { databaseUrl } = useRuntimeConfig()
const pool = new Pool({ connectionString: databaseUrl })

export const db = drizzle(pool, { schema });
