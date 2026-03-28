import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EvalApp } from '../../../../src/ui/EvalApp';

import type { EvaluateTable } from '../../../../src/types';
import type { EvalUIController } from '../../../../src/ui/evalBridge';

vi.mock('../../../../src/ui/hooks/useTerminalTitle', () => ({
  useTerminalTitle: () => {},
}));

vi.mock('../../../../src/ui/hooks/useTokenMetrics', () => ({
  useTokenMetrics: () => {},
}));

vi.mock('../../../../src/ui/components/table/ResultsTable', async () => {
  const { Box, Text } = await import('ink');

  return {
    ResultsTable: function MockResultsTable() {
      return (
        <Box>
          <Text>Results table</Text>
        </Box>
      );
    },
  };
});

const waitForRender = async () => new Promise((resolve) => setTimeout(resolve, 50));

describe('EvalScreen component', () => {
  let originalIsTTY: boolean | undefined;
  let originalSetRawMode: typeof process.stdin.setRawMode | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY;
    originalSetRawMode = process.stdin.setRawMode;
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'setRawMode', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'setRawMode', {
      value: originalSetRawMode,
      configurable: true,
      writable: true,
    });
    vi.clearAllMocks();
  });

  it('closes the help overlay when switching to the results phase', async () => {
    let controller: EvalUIController | null = null;

    const { lastFrame, stdin } = render(
      <EvalApp
        showHelp={true}
        onController={(value) => {
          controller = value;
        }}
      />,
    );

    await waitForRender();
    if (!controller) {
      throw new Error('Eval controller was not initialized');
    }
    const evalController = controller as EvalUIController;

    evalController.init(1, [{ id: 'openai:gpt-4.1-mini', label: 'OpenAI' }]);
    evalController.start();

    await waitForRender();

    stdin.write('?');
    await waitForRender();
    expect(lastFrame()).toContain('Keyboard Shortcuts');

    evalController.complete({ passed: 1, failed: 0, errors: 0 });
    await waitForRender();

    evalController.showResults({
      head: { prompts: [], vars: [] },
      body: [],
    } as EvaluateTable);

    await waitForRender();
    expect(lastFrame()).not.toContain('Keyboard Shortcuts');
    expect(lastFrame()).toContain('Results table');
  });
});
