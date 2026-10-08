import { describe, it, expect } from 'vitest';
import { EvidenceCacheService } from '../../backend/server/src/evidence/cache.service.js';

describe('EvidenceCacheService — Freshness Policies & Invalidation', () => {
  it('stores and retrieves fresh evidence within TTL', () => {
    const cache = new EvidenceCacheService();
    const mockData = { id: 'opp_123', title: 'Data Scientist' };

    cache.set('job:in:datascience', mockData, 300, 'JOBS'); // 300s TTL

    const lookup = cache.get<typeof mockData>('job:in:datascience');
    expect(lookup).not.toBeNull();
    expect(lookup?.isFresh).toBe(true);
    expect(lookup?.data.title).toBe('Data Scientist');
    expect(lookup?.ageSeconds).toBeLessThanOrEqual(2);
  });

  it('detects stale evidence when TTL has elapsed', () => {
    const cache = new EvidenceCacheService();
    const mockData = { id: 'opp_old', title: 'Old Role' };

    // Set with negative/0 TTL to simulate expiration
    cache.set('job:expired', mockData, -10, 'JOBS');

    const lookup = cache.get<typeof mockData>('job:expired');
    expect(lookup).not.toBeNull();
    expect(lookup?.isFresh).toBe(false);
  });

  it('correctly reports misses and tracks hit rate statistics', () => {
    const cache = new EvidenceCacheService();

    cache.get('nonexistent_key'); // Miss 1
    cache.get('another_missing_key'); // Miss 2

    cache.set('found_key', { ok: true }, 60);
    cache.get('found_key'); // Hit 1

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
    expect(stats.hitRate).toBeCloseTo(0.333, 2);
  });

  it('clears specific matching key patterns on demand', () => {
    const cache = new EvidenceCacheService();

    cache.set('jobs:in:chennai', { a: 1 }, 100);
    cache.set('jobs:gb:london', { b: 2 }, 100);
    cache.set('market:tax:15', { c: 3 }, 100);

    cache.clear('jobs:in');

    expect(cache.get('jobs:in:chennai')).toBeNull();
    expect(cache.get('jobs:gb:london')).not.toBeNull();
    expect(cache.get('market:tax:15')).not.toBeNull();
  });
});
