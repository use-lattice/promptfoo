import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApp, type AuthController, createAuthController } from '../../../src/ui/auth/AuthApp';

/** Helper: render AuthApp and capture the controller via onController callback */
function renderWithController(props: React.ComponentProps<typeof AuthApp> = {}) {
  let controller: AuthController | null = null;
  const result = render(
    <AuthApp
      {...props}
      onController={(c) => {
        controller = c;
        props.onController?.(c);
      }}
    />,
  );
  // Controller is delivered synchronously via useEffect on first render in Ink
  return { ...result, controller: controller! };
}

describe('AuthApp', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render initial idle state', () => {
      const { lastFrame } = render(<AuthApp initialPhase="idle" />);
      const output = lastFrame();
      expect(output).toContain('Promptfoo Authentication');
    });

    it('should render logging_in phase with spinner', () => {
      const { lastFrame } = render(<AuthApp initialPhase="logging_in" />);
      const output = lastFrame();
      expect(output).toContain('Promptfoo Authentication');
      expect(output).toContain('Logging in...');
    });
  });

  describe('createAuthController', () => {
    it('should create a controller with all methods', () => {
      const mockSetProgress = vi.fn();
      const controller = createAuthController(mockSetProgress);

      expect(typeof controller.setPhase).toBe('function');
      expect(typeof controller.setStatusMessage).toBe('function');
      expect(typeof controller.showTeamSelector).toBe('function');
      expect(typeof controller.complete).toBe('function');
      expect(typeof controller.error).toBe('function');
    });

    it('should update phase through controller when AuthApp is mounted', () => {
      const { lastFrame, controller } = renderWithController({ initialPhase: 'idle' });

      // Move to logging_in phase
      controller.setPhase('logging_in');

      // Give React time to re-render
      const output = lastFrame();
      expect(output).toContain('Promptfoo Authentication');
    });

    it('should show success state when complete is called', async () => {
      const { lastFrame, controller } = renderWithController({ initialPhase: 'logging_in' });

      controller.complete({
        email: 'test@example.com',
        organization: 'Test Org',
        team: 'Test Team',
        appUrl: 'https://app.promptfoo.dev',
      });

      // Wait for React to re-render
      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = lastFrame();
      expect(output).toContain('Successfully logged in');
      expect(output).toContain('test@example.com');
      expect(output).toContain('Test Org');
      expect(output).toContain('Test Team');
    });

    it('should show error state when error is called', async () => {
      const { lastFrame, controller } = renderWithController({ initialPhase: 'logging_in' });

      controller.error('Invalid API key');

      // Wait for React to re-render
      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = lastFrame();
      expect(output).toContain('Authentication failed');
      expect(output).toContain('Invalid API key');
    });

    it('should show team selector when showTeamSelector is called', async () => {
      const { lastFrame, controller } = renderWithController({ initialPhase: 'logging_in' });

      controller.showTeamSelector([
        { id: '1', name: 'Team One', slug: 'team-one' },
        { id: '2', name: 'Team Two', slug: 'team-two' },
      ]);

      // Wait for React to re-render
      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = lastFrame();
      expect(output).toContain('Select a team');
      expect(output).toContain('Team One');
      expect(output).toContain('Team Two');
    });
  });

  describe('callbacks', () => {
    it('should call onComplete when success state is acknowledged', async () => {
      const onComplete = vi.fn();
      const onExit = vi.fn();

      const { stdin, controller } = renderWithController({
        initialPhase: 'logging_in',
        onComplete,
        onExit,
      });

      // Set up success state
      controller.complete({
        email: 'test@example.com',
        organization: 'Test Org',
        appUrl: 'https://app.promptfoo.dev',
      });

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate pressing Enter to acknowledge
      stdin.write('\r');

      // Wait for callback
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onComplete).toHaveBeenCalledWith({
        email: 'test@example.com',
        organization: 'Test Org',
        appUrl: 'https://app.promptfoo.dev',
      });
    });

    it('should call onTeamSelect when team is selected', async () => {
      const onTeamSelect = vi.fn();

      const { stdin, lastFrame, controller } = renderWithController({
        initialPhase: 'logging_in',
        onTeamSelect,
      });

      // Show team selector
      controller.showTeamSelector([
        { id: '1', name: 'Team One', slug: 'team-one' },
        { id: '2', name: 'Team Two', slug: 'team-two' },
      ]);

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate pressing Enter to select first team
      stdin.write('\r');

      // Wait for callback
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onTeamSelect).toHaveBeenCalledWith({
        id: '1',
        name: 'Team One',
        slug: 'team-one',
      });
      expect(lastFrame()).toContain('Selecting Team One...');
    });

    it('should submit team selection only once', async () => {
      const onTeamSelect = vi.fn();

      const { stdin, controller } = renderWithController({
        initialPhase: 'logging_in',
        onTeamSelect,
      });

      controller.showTeamSelector([
        { id: '1', name: 'Team One', slug: 'team-one' },
        { id: '2', name: 'Team Two', slug: 'team-two' },
      ]);

      await new Promise((resolve) => setTimeout(resolve, 100));

      stdin.write('\r');
      stdin.write('\r');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onTeamSelect).toHaveBeenCalledTimes(1);
    });

    it('should support vim-style team navigation with j/k', async () => {
      const { stdin, lastFrame, controller } = renderWithController({
        initialPhase: 'logging_in',
      });

      controller.showTeamSelector([
        { id: '1', name: 'Team One', slug: 'team-one' },
        { id: '2', name: 'Team Two', slug: 'team-two' },
      ]);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('❯ Team One');

      stdin.write('j');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(lastFrame()).toContain('❯ Team Two');

      stdin.write('k');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(lastFrame()).toContain('❯ Team One');
    });
  });
});
