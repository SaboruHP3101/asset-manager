import { DrizzleQueryError } from 'drizzle-orm';

/** Recognizes duplicate keys and missing references; other database failures are server errors. */
export function isConstraintViolation(error: unknown): boolean {
  if (!(error instanceof DrizzleQueryError)) return false;

  const cause = error.cause;

  return (
    !!cause &&
    'code' in cause &&
    (cause.code === '23505' || cause.code === '23503')
  );
}
