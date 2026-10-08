import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdzunaJobProvider } from '../../backend/src/evidence/providers/adzuna.provider.js';

describe('AdzunaJobProvider — Live Adapter & Network Resilience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails gracefully with UNAUTHENTICATED error when credentials are not configured', async () => {
    // Instantiate provider with empty credentials
    const unconfiguredProvider = new AdzunaJobProvider('', '');
    expect(unconfiguredProvider.isConfigured()).toBe(false);

    const result = await unconfiguredProvider.searchJobs({
      keywords: 'Python Developer',
      country: 'in'
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNAUTHENTICATED');
    expect(result.error?.message).toContain('not configured in environment');
    expect(result.fallbackUrl).toBe('https://www.adzuna.com/in/search');
  });

  it('handles HTTP 429 rate limit responses gracefully', async () => {
    const provider = new AdzunaJobProvider('test_app_id', 'test_app_key');

    // Mock global fetch to return 429
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 429,
      ok: false
    } as Response);

    const result = await provider.searchJobs({
      keywords: 'Data Analyst',
      country: 'gb'
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('RATE_LIMIT');
    expect(result.error?.retryable).toBe(true);
  });

  it('handles provider timeout when network exceeds deadline', async () => {
    // 50ms ultra-short timeout for testing
    const provider = new AdzunaJobProvider('test_app_id', 'test_app_key', 50);

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error('AbortError');
          err.name = 'AbortError';
          reject(err);
        }, 100);
      });
    });

    const result = await provider.searchJobs({
      keywords: 'Software Engineer',
      country: 'in'
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TIMEOUT');
    expect(result.error?.message).toContain('timed out');
  });

  it('normalizes mock Adzuna API response fixture accurately', async () => {
    const provider = new AdzunaJobProvider('test_app_id', 'test_app_key');

    // Clearly labeled TEST FIXTURE simulating Adzuna v1 JSON response
    const mockAdzunaApiResponse = {
      count: 42,
      results: [
        {
          id: 50012,
          title: 'Full Stack Web Developer',
          description: 'Develop React and Node.js solutions for e-commerce platforms.',
          company: { display_name: 'TechnoSolutions' },
          location: { area: ['Tamil Nadu', 'Chennai'], display_name: 'Chennai, India' },
          salary_min: 600000,
          salary_max: 950000,
          salary_is_predicted: '0',
          contract_time: 'full_time',
          redirect_url: 'https://api.adzuna.com/v1/api/redirect/50012',
          created: '2026-03-02T08:00:00Z',
          category: { label: 'IT Jobs', tag: 'it-jobs' }
        }
      ]
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => mockAdzunaApiResponse
    } as Response);

    const result = await provider.searchJobs({
      keywords: 'Full Stack',
      country: 'in'
    });

    expect(result.success).toBe(true);
    expect(result.data?.totalCount).toBe(42);
    expect(result.data?.opportunities).toHaveLength(1);

    const opp = result.data!.opportunities[0];
    expect(opp.title).toBe('Full Stack Web Developer');
    expect(opp.company?.name).toBe('TechnoSolutions');
    expect(opp.location.city).toBe('Chennai');
    expect(opp.compensation.value?.min).toBe(600000);
  });
});
