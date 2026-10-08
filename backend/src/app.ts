import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { MinorConsentService } from './auth/minor-consent.js';
import { authenticate } from './auth/auth.middleware.js';
import {
  PrismDecisionEngine,
  WhatIfEngine,
  computeRocWeights,
  AdaptiveDecisionIntelligenceEngine,
  DreamPathwayService,
  AdaptiveAptitudeAssessment,
  estimateEducationYearsRequired,
  compareCountries,
  detectDecisionChanges
} from '@m63/engine';
import { INTEREST_AREAS, Opportunity, StudentProfile, ParentProfile } from '@m63/shared';
import { EvidenceManager, EvidenceCacheService } from './evidence/index.js';
import { AdzunaJobProvider } from './evidence/providers/adzuna.provider.js';
import { FallbackOpportunityProvider } from './evidence/providers/fallback.provider.js';
import { HyperLocalIntelligenceService } from './hyperlocal/hyperlocal-intelligence.js';
import { EducationIntelligenceService } from './education/education-intelligence.js';
import { GroundedAssistant } from './ai/assistant.js';
import { M63Agent, translateTexts } from './ai/agent.js';
import { LiveLookupService } from './education/live-lookup.js';
import { GoalService } from './goal/goal-service.js';
import { UpdatesWatch } from './evidence/updates-watch.js';
import { AuthenticatedRequest } from './auth/auth.middleware.js';

export interface EducationCostInput {
  programName: string;
  annualFee: number;
  years: number;
  sourceUrl?: string;
}

/** Attaches user-supplied program costs (from an official fee page) as PARTIAL tuition evidence. */
export function applyEducationCosts(candidates: Opportunity[], costs?: Record<string, EducationCostInput>): Opportunity[] {
  if (!costs || Object.keys(costs).length === 0) return candidates;
  return candidates.map(o => {
    const key = (o.roleCluster ?? o.title).toLowerCase();
    const cost = costs[key] ?? costs['*'];
    if (!cost || !(cost.annualFee >= 0) || !(cost.years > 0)) return o;
    const total = Math.round(cost.annualFee * cost.years);
    return {
      ...o,
      educationRequirements: {
        ...o.educationRequirements,
        estimatedTuitionRange: { min: total, max: total, currency: 'INR' },
        tuitionEvidence: {
          value: { min: total, max: total },
          isAvailable: true,
          evidenceStatus: 'PARTIAL',
          evidenceLevel: 'SELF_DECLARED',
          confidence: 0.6,
          sourceName: `${cost.programName} — entered by the family from the official fee page`,
          sourceUrl: cost.sourceUrl
        }
      }
    };
  });
}

const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map(s => s.trim()), credentials: true }));
  app.use(express.json({ limit: '8mb' }));

  const cache = new EvidenceCacheService(env.NODE_ENV === 'test' ? undefined : env.EVIDENCE_CACHE_FILE);
  const adzuna = new AdzunaJobProvider();
  const evidenceManager = new EvidenceManager(adzuna, new FallbackOpportunityProvider(), cache);
  const hyperlocal = new HyperLocalIntelligenceService(cache, adzuna);
  const education = new EducationIntelligenceService();
  const assistant = new GroundedAssistant();
  const minorConsentService = new MinorConsentService();
  const prismEngine = new PrismDecisionEngine();
  const whatIfEngine = new WhatIfEngine();
  const adie = new AdaptiveDecisionIntelligenceEngine();
  const dreamPathwayService = new DreamPathwayService();
  const assessment = new AdaptiveAptitudeAssessment();
  const agent = new M63Agent(evidenceManager, cache);
  const lookup = new LiveLookupService(cache);
  const goals = new GoalService(evidenceManager, lookup);
  const watch = new UpdatesWatch(evidenceManager, lookup);

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', product: 'M63', engine: 'PRISM / ADIE v2', timestamp: new Date().toISOString() });
  });

  app.get('/api/v1/meta/status', (_req, res) => {
    res.json({
      success: true,
      data: {
        sources: evidenceManager.getSourcesStatus(),
        ai: { llmConfigured: assistant.isLlmConfigured(), model: assistant.providerLabel },
        authRequired: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
      }
    });
  });

  app.get('/api/v1/taxonomy/interest-areas', (_req, res) => {
    res.json({ success: true, data: INTEREST_AREAS.map(a => ({ id: a.id, label: a.label, icon: a.icon, steamAngle: a.steamAngle })) });
  });

  // Instant registration (no confirmation email): creates an already-confirmed Supabase user via the
  // admin API. Disable by setting REQUIRE_EMAIL_VERIFICATION=true (the client then uses normal sign-up).
  app.post('/api/v1/auth/register', asyncRoute(async (req, res) => {
    const { name, email, password } = req.body ?? {};
    if (env.REQUIRE_EMAIL_VERIFICATION) {
      res.status(409).json({ success: false, error: 'EMAIL_VERIFICATION_REQUIRED' });
      return;
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      res.status(503).json({ success: false, error: 'Supabase is not configured on the server.' });
      return;
    }
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, error: 'Enter a valid email and a password of at least 6 characters.' });
      return;
    }
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, email_confirm: true, user_metadata: { full_name: String(name ?? '').slice(0, 80) } })
    });
    const body = (await r.json().catch(() => ({}))) as { msg?: string; message?: string; error_description?: string };
    if (!r.ok) {
      const msg = body.msg ?? body.message ?? body.error_description ?? `Registration failed (${r.status})`;
      res.status(r.status === 422 ? 409 : 400).json({ success: false, error: /already|registered|exists/i.test(msg) ? 'An account with this email already exists. Please sign in.' : msg });
      return;
    }
    res.json({ success: true, data: { created: true } });
  }));

  app.post('/api/v1/auth/minor-check', (req, res) => {
    const { dateOfBirth } = req.body ?? {};
    if (!dateOfBirth) {
      res.status(400).json({ success: false, error: 'dateOfBirth is required' });
      return;
    }
    res.json({ success: true, data: minorConsentService.evaluateAge(dateOfBirth) });
  });

  // Adaptive aptitude assessment (stateless CAT step; answer keys stay on the server)
  app.post('/api/v1/assessment/step', (req, res) => {
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const { seed, excludeFixedIds, academics } = req.body ?? {};
    res.json({ success: true, data: assessment.step(answers, { seed: typeof seed === 'number' ? seed : undefined, excludeFixedIds: Array.isArray(excludeFixedIds) ? excludeFixedIds : [], academics }) });
  });

  // Full M63 pipeline: evidence discovery → market intelligence → ADIE → education routes
  app.post('/api/v1/analysis/run', authenticate, asyncRoute(async (req, res) => {
    const { student, parent, options } = req.body as { student: StudentProfile; parent: ParentProfile | null; options?: { countries?: string[]; maxResults?: number; educationCosts?: Record<string, EducationCostInput> } };
    if (!student) {
      res.status(400).json({ success: false, error: 'student profile is required' });
      return;
    }
    const started = Date.now();
    const discovery = await evidenceManager.discoverForStudent(student, { countries: options?.countries, maxResults: options?.maxResults ?? 30 });
    const candidates = applyEducationCosts(discovery.opportunities, options?.educationCosts);
    const decision = adie.analyzeOpportunities(student, parent ?? null, candidates);
    const educationPathways = decision.candidates.slice(0, 6).map(c =>
      education.pathwayFor(c.opportunity, student, parent ?? null, estimateEducationYearsRequired(student, c.opportunity))
    );
    res.json({
      success: true,
      data: {
        decision,
        candidates,
        discovery: { ...discovery, opportunities: undefined },
        educationPathways,
        countries: compareCountries(decision, student.location.country || 'India'),
        timingMs: Date.now() - started
      }
    });
  }));

  // What-If on the canonical ADIE engine
  app.post('/api/v1/analysis/what-if', (req, res, next) => {
    try {
      const { student, parent, scenario, candidates } = req.body ?? {};
      if (!student || !scenario || !Array.isArray(candidates)) {
        res.status(400).json({ success: false, error: 'student, scenario and candidates are required' });
        return;
      }
      res.json({ success: true, data: whatIfEngine.simulateWithAdie(student, parent ?? null, scenario, candidates) });
    } catch (err) {
      next(err);
    }
  });

  // Quick What-If across every journey input (same evidence, two profiles)
  app.post('/api/v1/analysis/compare', (req, res, next) => {
    try {
      const { student, parent, altStudent, altParent, candidates, appliedChanges, educationCosts } = req.body ?? {};
      if (!student || !altStudent || !Array.isArray(candidates)) {
        res.status(400).json({ success: false, error: 'student, altStudent and candidates are required' });
        return;
      }
      res.json({ success: true, data: whatIfEngine.compareProfiles(student, parent ?? null, altStudent, altParent ?? null, applyEducationCosts(candidates, educationCosts), Array.isArray(appliedChanges) ? appliedChanges : []) });
    } catch (err) {
      next(err);
    }
  });

  // Re-rank existing evidence with new inputs (e.g. after adding a program fee) — no new provider calls
  app.post('/api/v1/analysis/rerank', (req, res, next) => {
    try {
      const { student, parent, candidates, educationCosts } = req.body ?? {};
      if (!student || !Array.isArray(candidates)) {
        res.status(400).json({ success: false, error: 'student and candidates are required' });
        return;
      }
      const updated = applyEducationCosts(candidates, educationCosts);
      res.json({ success: true, data: { decision: adie.analyzeOpportunities(student, parent ?? null, updated), candidates: updated } });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/market/role', authenticate, asyncRoute(async (req, res) => {
    const { role, country, city } = req.body ?? {};
    if (!role) {
      res.status(400).json({ success: false, error: 'role is required' });
      return;
    }
    res.json({ success: true, data: await evidenceManager.market.getRoleMarket(String(role), String(country ?? 'in'), city ? String(city) : undefined) });
  }));

  app.post('/api/v1/hyperlocal/investigate', authenticate, asyncRoute(async (req, res) => {
    const { interest, city, region, country, student, radiusKm } = req.body ?? {};
    if (!interest || !city) {
      res.status(400).json({ success: false, error: 'interest and city are required' });
      return;
    }
    res.json({ success: true, data: await hyperlocal.investigate({ interest, city, region, country, student, radiusKm: typeof radiusKm === 'number' ? radiusKm : undefined }) });
  }));

  app.post('/api/v1/education/pathway', (req, res) => {
    const { opportunity, student, parent } = req.body ?? {};
    if (!opportunity || !student) {
      res.status(400).json({ success: false, error: 'opportunity and student are required' });
      return;
    }
    res.json({ success: true, data: education.pathwayFor(opportunity, student, parent ?? null, estimateEducationYearsRequired(student, opportunity)) });
  });

  app.post('/api/v1/ai/ask', authenticate, asyncRoute(async (req, res) => {
    const { question, context, history } = req.body ?? {};
    if (!question) {
      res.status(400).json({ success: false, error: 'question is required' });
      return;
    }
    res.json({ success: true, data: await assistant.ask({ question: String(question), context, history }) });
  }));

  // Agent: intent → tool (live search / What-If / web-grounded lookup) → grounded explanation
  app.post('/api/v1/ai/agent', authenticate, asyncRoute(async (req, res) => {
    const { message, student, parent, candidates, context, history, language } = req.body ?? {};
    if (!message || !student) {
      res.status(400).json({ success: false, error: 'message and student are required' });
      return;
    }
    res.json({ success: true, data: await agent.handle({ message: String(message), student, parent: parent ?? null, candidates: Array.isArray(candidates) ? candidates : [], context, history, language }) });
  }));

  // GoalPath: goal → required information → adaptive interview → mission map → progress adaptation
  app.post('/api/v1/goal/start', authenticate, asyncRoute(async (req, res) => {
    const { goal, student, parent, language } = req.body ?? {};
    if (!goal || String(goal).trim().length < 3) { res.status(400).json({ success: false, error: 'Describe your goal' }); return; }
    res.json({ success: true, data: await goals.start(String(goal).slice(0, 200), student ?? null, parent ?? null, language ?? 'en') });
  }));
  app.post('/api/v1/goal/answer', authenticate, asyncRoute(async (req, res) => {
    const { session, answer, language } = req.body ?? {};
    if (!session?.fields || typeof answer !== 'string') { res.status(400).json({ success: false, error: 'session and answer are required' }); return; }
    res.json({ success: true, data: await goals.answer(session, answer.slice(0, 1000), language ?? 'en') });
  }));
  app.post('/api/v1/goal/finish', (req, res) => {
    const { session } = req.body ?? {};
    if (!session?.fields) { res.status(400).json({ success: false, error: 'session is required' }); return; }
    res.json({ success: true, data: goals.finish(session) });
  });
  app.post('/api/v1/goal/progress', (req, res) => {
    const { session, updates } = req.body ?? {};
    if (!session?.fields || !updates) { res.status(400).json({ success: false, error: 'session and updates are required' }); return; }
    res.json({ success: true, data: goals.progress(session, updates) });
  });

  app.post('/api/v1/translate', asyncRoute(async (req, res) => {
    const { texts, lang } = req.body ?? {};
    if (!Array.isArray(texts) || !lang) {
      res.status(400).json({ success: false, error: 'texts[] and lang are required' });
      return;
    }
    res.json({ success: true, data: await translateTexts(cache, texts.slice(0, 600).map(String), String(lang)) });
  }));

  app.post('/api/v1/lookup/institutions', authenticate, asyncRoute(async (req, res) => {
    const { city } = req.body ?? {};
    if (!city) {
      res.status(400).json({ success: false, error: 'city is required' });
      return;
    }
    res.json({ success: true, data: await lookup.institutionsNear(String(city)) });
  }));

  app.post('/api/v1/lookup/web', authenticate, asyncRoute(async (req, res) => {
    const { topic, query, context, pageUrl } = req.body ?? {};
    if (!topic || !query) {
      res.status(400).json({ success: false, error: 'topic and query are required' });
      return;
    }
    res.json({ success: true, data: await lookup.webGrounded(topic, String(query), String(context ?? ''), pageUrl ? String(pageUrl) : undefined) });
  }));

  app.post('/api/v1/updates/watch', authenticate, asyncRoute(async (req, res) => {
    const { student, previous, lastAnalysisAt } = req.body ?? {};
    if (!student || !previous?.candidates) { res.status(400).json({ success: false, error: 'student and previous analysis are required' }); return; }
    res.json({ success: true, data: await watch.check(student, previous, lastAnalysisAt ?? new Date(Date.now() - 86400_000).toISOString()) });
  }));

  app.post('/api/v1/updates/diff', (req, res) => {
    const { previous, current } = req.body ?? {};
    if (!previous?.candidates || !current?.candidates) {
      res.json({ success: true, data: [] });
      return;
    }
    res.json({ success: true, data: detectDecisionChanges(previous, current) });
  });

  // Right to erasure: removes the Supabase auth user (rows cascade via foreign keys)
  app.delete('/api/v1/account', authenticate, asyncRoute(async (req: AuthenticatedRequest, res) => {
    if (!req.user || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      res.status(400).json({ success: false, error: 'Account deletion requires a signed-in Supabase session.' });
      return;
    }
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${req.user.userId}`, {
      method: 'DELETE',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
    });
    res.status(r.ok ? 200 : 502).json({ success: r.ok, message: r.ok ? 'Account and all M63 data deleted.' : 'Deletion failed; please retry.' });
  }));

  // ---- Phase 0–2 compatible routes ----
  app.post('/api/v1/engine/evaluate', (req, res, next) => {
    try {
      const { student, parent, candidates } = req.body ?? {};
      if (!student || !candidates) {
        res.status(400).json({ success: false, error: 'student and candidates are required' });
        return;
      }
      const rocWeights = computeRocWeights(student.aspirations?.priorityRanking ?? ['INTEREST', 'SKILL', 'SALARY']);
      res.json({ success: true, data: { weightsApplied: rocWeights, recommendations: prismEngine.rankOpportunities(student, parent ?? null, candidates, rocWeights) } });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/adie/analyze', (req, res, next) => {
    try {
      const { student, parent, candidates, options } = req.body ?? {};
      if (!student || !candidates) {
        res.status(400).json({ success: false, error: 'student and candidates are required' });
        return;
      }
      res.json({ success: true, data: adie.analyzeOpportunities(student, parent ?? null, candidates, options) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/adie/dream-pathway', (req, res, next) => {
    try {
      const { targetOpportunity, student, parent } = req.body ?? {};
      if (!targetOpportunity || !student) {
        res.status(400).json({ success: false, error: 'targetOpportunity and student are required' });
        return;
      }
      res.json({ success: true, data: dreamPathwayService.evaluateTarget(targetOpportunity, student, parent ?? null) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/engine/what-if', (req, res, next) => {
    try {
      const { baselineStudent, baselineParent, scenario, candidates } = req.body ?? {};
      if (!baselineStudent || !scenario || !candidates) {
        res.status(400).json({ success: false, error: 'baselineStudent, scenario, and candidates required' });
        return;
      }
      res.json({ success: true, data: whatIfEngine.simulateScenario(baselineStudent, baselineParent ?? null, scenario, candidates) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/v1/evidence/opportunities/search', authenticate, asyncRoute(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const result = await evidenceManager.searchOpportunities({
      keywords: q.keywords,
      skills: q.skills ? q.skills.split(',') : undefined,
      country: q.country || 'in',
      location: q.location,
      page: q.page ? parseInt(q.page, 10) : 1,
      resultsPerPage: q.resultsPerPage ? parseInt(q.resultsPerPage, 10) : 20
    }, { forceRefresh: q.forceRefresh === 'true' });
    res.json(result);
  }));

  app.get('/api/v1/evidence/opportunities/:id', (req, res) => {
    const opp = evidenceManager.getOpportunityById(String(req.params.id));
    if (!opp) {
      res.status(404).json({ success: false, error: 'Opportunity not found in active evidence registry.' });
      return;
    }
    res.json({ success: true, data: opp });
  });

  app.get('/api/v1/evidence/sources/status', (_req, res) => {
    res.json({ success: true, data: evidenceManager.getSourcesStatus() });
  });

  app.post('/api/v1/evidence/refresh', authenticate, (req, res) => {
    evidenceManager.refreshCache((req.body ?? {}).pattern);
    res.json({ success: true, message: 'Evidence cache invalidated successfully.' });
  });

  app.use(errorHandler);
  return app;
}
