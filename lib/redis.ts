import { Redis } from "@upstash/redis";

export interface IdempotencyCacheRecord {
  fingerprint: string;
  status: number;
  body: unknown;
  createdAt: string;
}

export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

function storageKey(idempotencyKey: string) {
  return `reservation:idempotency:${idempotencyKey}`;
}

export async function readIdempotencyRecord(idempotencyKey: string, fingerprint: string) {
  if (!redis) {
    return null;
  }

  const record = await redis.get<IdempotencyCacheRecord>(storageKey(idempotencyKey));
  return record && record.fingerprint === fingerprint ? record : null;
}

export async function writeIdempotencyRecord(
  idempotencyKey: string,
  record: IdempotencyCacheRecord,
  ttlSeconds = 600,
) {
  if (!redis) {
    return;
  }

  await redis.set(storageKey(idempotencyKey), record, { ex: ttlSeconds });
}
