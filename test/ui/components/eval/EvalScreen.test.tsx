import { describe, expect, it } from 'vitest';
import { getDisplayPhase, getSummaryCounts } from '../../../../src/ui/components/eval/EvalScreen';

describe('getDisplayPhase', () => {
  it('returns grading once provider work is done but comparison work remains', () => {
    expect(
      getDisplayPhase({
        phase: 'evaluating',
        completedTests: 2,
        totalTests: 3,
        providers: {
          'openai:gpt-4.1-mini#0': {
            testCases: {
              completed: 2,
              total: 2,
            },
          },
        },
      }),
    ).toBe('grading');
  });

  it('keeps evaluating while provider work is still in flight', () => {
    expect(
      getDisplayPhase({
        phase: 'evaluating',
        completedTests: 1,
        totalTests: 3,
        providers: {
          'openai:gpt-4.1-mini#0': {
            testCases: {
              completed: 1,
              total: 2,
            },
          },
        },
      }),
    ).toBe('evaluating');
  });

  it('preserves non-evaluating phases', () => {
    expect(
      getDisplayPhase({
        phase: 'completed',
        completedTests: 3,
        totalTests: 3,
        providers: {},
      }),
    ).toBe('completed');
  });
});

describe('getSummaryCounts', () => {
  it('excludes comparison work from the pass denominator', () => {
    expect(
      getSummaryCounts({
        passedTests: 2,
        failedTests: 0,
        errorCount: 0,
        completedTests: 2,
        totalTests: 3,
        providers: {
          'openai:gpt-4.1-mini#0': {
            testCases: {
              completed: 2,
              total: 2,
            },
          },
        },
      }),
    ).toEqual({
      evaluationTotal: 2,
      comparisonCompleted: 0,
      comparisonTotal: 1,
    });
  });
});
