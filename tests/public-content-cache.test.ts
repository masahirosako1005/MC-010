import { describe, expect, it } from 'vitest';
import { PublicContentCache } from '../src/server/public-content-cache.js';

describe('public content cache', () => {
  it('reuses bytes until the fixed expiry, including after a recent hit', async () => {
    let now = 0, reads = 0;
    const cache = new PublicContentCache({ ttlMs: 30, now: () => now });
    const read = async () => Buffer.from(String(++reads));
    expect((await cache.getOrLoad('page:a', read)).toString()).toBe('1');
    now = 29;
    expect((await cache.getOrLoad('page:a', read)).toString()).toBe('1');
    now = 30;
    expect((await cache.getOrLoad('page:a', read)).toString()).toBe('2');
  });

  it('evicts the least recently used entry at the entry limit', async () => {
    const cache = new PublicContentCache({ maxEntries: 2 });
    await cache.getOrLoad('a', async () => Buffer.from('A'));
    await cache.getOrLoad('b', async () => Buffer.from('B'));
    await cache.getOrLoad('a', async () => Buffer.from('wrong'));
    await cache.getOrLoad('c', async () => Buffer.from('C'));
    expect((await cache.getOrLoad('b', async () => Buffer.from('new B'))).toString()).toBe('new B');
  });

  it('evicts to stay within the total byte limit', async () => {
    const cache = new PublicContentCache({ maxBytes: 5 });
    await cache.getOrLoad('a', async () => Buffer.from('aaa'));
    await cache.getOrLoad('b', async () => Buffer.from('bbb'));
    expect((await cache.getOrLoad('a', async () => Buffer.from('new'))).toString()).toBe('new');
  });

  it('serves oversized bytes without retaining them', async () => {
    const cache = new PublicContentCache({ maxEntryBytes: 2, maxBytes: 3 });
    expect((await cache.getOrLoad('a', async () => Buffer.from('large'))).toString()).toBe('large');
    expect((await cache.getOrLoad('a', async () => Buffer.from('next'))).toString()).toBe('next');
  });

  it('shares simultaneous reads of one key and keeps different keys separate', async () => {
    const cache = new PublicContentCache();
    let finish!: (value: Buffer) => void;
    const first = cache.getOrLoad('page:a', () => new Promise(resolve => { finish = resolve; }));
    const second = cache.getOrLoad('page:a', async () => Buffer.from('wrong'));
    expect((await cache.getOrLoad('page:b', async () => Buffer.from('B'))).toString()).toBe('B');
    finish(Buffer.from('A'));
    expect((await first).toString()).toBe('A');
    expect((await second).toString()).toBe('A');
  });

  it('does not cache a failed read', async () => {
    const cache = new PublicContentCache();
    await expect(cache.getOrLoad('a', async () => { throw new Error('unavailable'); })).rejects.toThrow('unavailable');
    expect((await cache.getOrLoad('a', async () => Buffer.from('recovered'))).toString()).toBe('recovered');
  });

  it('does not repopulate or remove a new read when an invalidated read completes', async () => {
    const cache = new PublicContentCache();
    let finishOld!: (value: Buffer) => void, finishNew!: (value: Buffer) => void;
    const old = cache.getOrLoad('a', () => new Promise(resolve => { finishOld = resolve; }));
    cache.clear();
    const fresh = cache.getOrLoad('a', () => new Promise(resolve => { finishNew = resolve; }));
    finishOld(Buffer.from('old'));
    await old;
    const joined = cache.getOrLoad('a', async () => Buffer.from('wrong'));
    finishNew(Buffer.from('new'));
    expect((await fresh).toString()).toBe('new');
    expect((await joined).toString()).toBe('new');
    expect((await cache.getOrLoad('a', async () => Buffer.from('wrong'))).toString()).toBe('new');
  });

  it('clears ready bytes as well as pending reads', async () => {
    const cache = new PublicContentCache();
    await cache.getOrLoad('a', async () => Buffer.from('old'));
    cache.clear();
    expect((await cache.getOrLoad('a', async () => Buffer.from('new'))).toString()).toBe('new');
  });
});
