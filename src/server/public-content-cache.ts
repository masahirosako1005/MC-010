import type { RequestHandler } from 'express';

interface CacheOptions {
  ttlMs: number;
  maxEntries: number;
  maxBytes: number;
  maxEntryBytes: number;
  now: () => number;
}
interface Entry { bytes: Buffer; expiresAt: number }

// Only already-authorized public response bytes belong here, never sessions or owner responses.
export class PublicContentCache {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Map<string, Promise<Buffer>>();
  private readonly options: CacheOptions;
  private byteSize = 0;
  private generation = 0;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = { ttlMs: 24 * 60 * 60 * 1000, maxEntries: 128, maxBytes: 32 * 1024 * 1024,
      maxEntryBytes: 4 * 1024 * 1024, now: Date.now, ...options };
  }

  clear(): void {
    this.generation++;
    this.entries.clear();
    this.pending.clear();
    this.byteSize = 0;
  }

  async getOrLoad(key: string, load: () => Promise<Buffer>): Promise<Buffer> {
    const now = this.options.now();
    for (const [entryKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.remove(entryKey);
    }
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached.bytes;
    }
    const existing = this.pending.get(key);
    if (existing) return existing;
    const generation = this.generation;
    // Start the read before registering its promise; loaders never receive the cache itself.
    const loaded = load();
    const pending = loaded.then(bytes => {
      if (generation === this.generation && bytes.length <= this.options.maxEntryBytes && bytes.length <= this.options.maxBytes) {
        while (this.entries.size >= this.options.maxEntries || this.byteSize + bytes.length > this.options.maxBytes) {
          const oldest = this.entries.keys().next().value;
          if (oldest === undefined) break;
          this.remove(oldest);
        }
        // Replacement can occur when the pending tracking limit was reached.
        this.remove(key);
        this.entries.set(key, { bytes, expiresAt: this.options.now() + this.options.ttlMs });
        this.byteSize += bytes.length;
      }
      return bytes;
    }).finally(() => {
      if (this.pending.get(key) === pending) this.pending.delete(key);
    });
    if (this.pending.size < this.options.maxEntries) this.pending.set(key, pending);
    return pending;
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (entry) { this.byteSize -= entry.bytes.length; this.entries.delete(key); }
  }
}

export function invalidatePublicContentOnWrite(cache: PublicContentCache): RequestHandler {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
      (req.method === 'POST' && /^\/shared\/[a-f0-9]{64}\/views\/?$/.test(req.path))) return next();
    const json = res.json;
    // Mutation handlers have committed before serializing their response. This also runs
    // if the client disconnected earlier, so a late commit cannot leave old bytes cached.
    res.json = body => { cache.clear(); return json.call(res, body); };
    res.once('close', () => cache.clear());
    next();
  };
}
