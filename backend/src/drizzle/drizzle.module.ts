import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import * as schema from '../db/schema.js';

export const DRIZZLE = 'DRIZZLE_CLIENT';

@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: () => {
        console.log(process.env.DATABASE_URL);
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });

        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
