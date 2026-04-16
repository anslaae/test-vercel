type StoreRecord = {
  value: string;
  expiresAt: number | null;
};

const memoryStore = new Map<string, StoreRecord>();

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export function hasSharedStore() {
  return !!getRedisConfig();
}

async function executeRedisCommand(command: Array<string | number>) {
  const config = getRedisConfig();
  if (!config) {
    throw new Error('Redis session store is not configured');
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Redis command failed (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  return json.result;
}

export async function setJson<T>(key: string, value: T, ttlSeconds?: number) {
  const serialized = JSON.stringify(value);
  const config = getRedisConfig();

  if (!config) {
    memoryStore.set(key, {
      value: serialized,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    });
    return;
  }

  const command: Array<string | number> = ['SET', key, serialized];
  if (ttlSeconds && ttlSeconds > 0) {
    command.push('EX', ttlSeconds);
  }

  await executeRedisCommand(command);
}

export async function getJson<T>(key: string) {
  const config = getRedisConfig();

  if (!config) {
    const stored = memoryStore.get(key);
    if (!stored) {
      return null;
    }

    if (stored.expiresAt && stored.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return null;
    }

    return JSON.parse(stored.value) as T;
  }

  const result = await executeRedisCommand(['GET', key]);
  if (!result) {
    return null;
  }

  return JSON.parse(result as string) as T;
}

export async function deleteKey(key: string) {
  const config = getRedisConfig();

  if (!config) {
    memoryStore.delete(key);
    return;
  }

  await executeRedisCommand(['DEL', key]);
}

