import { describe, it, expect } from 'vitest';
import { AdaptiveAptitudeAssessment, eapEstimate, irtProbability } from '../../packages/engine/src/adaptive-assessment.js';

describe('Adaptive aptitude assessment (2PL IRT + EAP)', () => {
  const cat = new AdaptiveAptitudeAssessment();

  function run(strategy: (id: string, options: string[]) => number) {
    const answers: Array<{ itemId: string; choice: number }> = [];
    let step = cat.step(answers);
    let guard = 0;
    while (!step.done && guard++ < 50) {
      const item = step.nextItem!;
      answers.push({ itemId: item.id, choice: strategy(item.id, item.options) });
      step = cat.step(answers);
    }
    return step;
  }

  it('probability increases with ability', () => {
    expect(irtProbability(1, 1.2, 0)).toBeGreaterThan(irtProbability(-1, 1.2, 0));
  });

  it('EAP with no responses returns the prior mean', () => {
    const e = eapEstimate([]);
    expect(Math.abs(e.theta)).toBeLessThan(0.01);
    expect(e.se).toBeGreaterThan(0.9);
  });

  it('never asks more than the item budget and finishes with aptitude scores', () => {
    const result = run(() => 0);
    expect(result.done).toBe(true);
    expect(result.answeredCount).toBeLessThanOrEqual(cat.maxQuestions);
    expect(result.aptitude?.isAssessed).toBe(true);
  });

  it('adapts: consistently wrong answers produce lower scores than consistently right answers', () => {
    const low = run(() => 3); // option index 3 is never the key in this bank's first items for most
    const answersKey: Record<string, number> = {};
    // Discover keys by probing feedback: answer each option until marked correct.
    const high = (() => {
      const answers: Array<{ itemId: string; choice: number }> = [];
      let step = cat.step(answers);
      while (!step.done) {
        const item = step.nextItem!;
        let chosen = 0;
        for (let c = 0; c < item.options.length; c++) {
          const probe = cat.step([...answers, { itemId: item.id, choice: c }]);
          if (probe.lastAnswerCorrect) { chosen = c; break; }
        }
        answersKey[item.id] = chosen;
        answers.push({ itemId: item.id, choice: chosen });
        step = cat.step(answers);
      }
      return step;
    })();
    expect(high.aptitude!.numericalReasoning).toBeGreaterThan(low.aptitude!.numericalReasoning);
    expect(high.aptitude!.logicalReasoning).toBeGreaterThan(60);
  });
});
