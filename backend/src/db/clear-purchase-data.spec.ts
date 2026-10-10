import {
  resolveDatabaseUrl,
  validateCleanupRequest,
} from './clear-purchase-data.js';

describe('clear purchase data safeguards', () => {
  it('requires an explicit confirmation flag', () => {
    expect(() => validateCleanupRequest('development', [])).toThrow(
      'npm run db:clear-purchase-data -- --confirm',
    );
  });

  it('blocks production even when confirmed', () => {
    expect(() => validateCleanupRequest('production', ['--confirm'])).toThrow(
      'bị chặn trong production',
    );
  });

  it('allows a confirmed non-production cleanup', () => {
    expect(() =>
      validateCleanupRequest('development', ['--confirm']),
    ).not.toThrow();
  });

  it('uses an explicit DATABASE_URL when available', () => {
    expect(
      resolveDatabaseUrl({ DATABASE_URL: 'postgres://user:pass@db:5432/app' }),
    ).toBe('postgres://user:pass@db:5432/app');
  });

  it('builds the URL from the separate postgres variables', () => {
    expect(
      resolveDatabaseUrl({
        POSTGRES_USER: 'asset user',
        POSTGRES_PASSWORD: 'secret@value',
        POSTGRES_DB: 'assets',
        POSTGRES_HOST: 'database',
        POSTGRES_PORT: '5433',
      }),
    ).toBe('postgres://asset%20user:secret%40value@database:5433/assets');
  });
});
