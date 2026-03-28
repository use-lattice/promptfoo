/**
 * AuthApp - Interactive UI for authentication.
 *
 * Shows login progress, team selection, and success/error states.
 */

import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';

import { Box, Text, useApp, useInput } from 'ink';
import { Spinner } from '../components/shared/Spinner';

export type AuthPhase = 'idle' | 'logging_in' | 'selecting_team' | 'success' | 'error';

export interface TeamInfo {
  id: string;
  name: string;
  slug: string;
}

export interface UserInfo {
  email: string;
  organization: string;
  team?: string;
  appUrl: string;
}

export interface AuthProgress {
  phase: AuthPhase;
  /** User info when logged in */
  userInfo?: UserInfo;
  /** Available teams for selection */
  teams?: TeamInfo[];
  /** Selected team index */
  selectedTeamIndex?: number;
  /** Error message if failed */
  error?: string;
  /** Status message */
  statusMessage?: string;
}

export interface AuthAppProps {
  /** Initial phase */
  initialPhase?: AuthPhase;
  /** Called when a team is selected */
  onTeamSelect?: (team: TeamInfo | undefined) => void;
  /** Called when auth completes successfully */
  onComplete?: (userInfo: UserInfo) => void;
  /** Called when auth fails */
  onError?: (error: string) => void;
  /** Called when user exits */
  onExit?: () => void;
  /** Called with the controller after mount */
  onController?: (controller: AuthController) => void;
}

type SetProgressFn = Dispatch<SetStateAction<AuthProgress>>;

function TeamSelector({ teams, selectedIndex }: { teams: TeamInfo[]; selectedIndex: number }) {
  return (
    <Box flexDirection="column">
      {teams.map((team, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={team.id}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '❯ ' : '  '}
              {team.name}
            </Text>
            <Text dimColor> ({team.slug})</Text>
          </Box>
        );
      })}
    </Box>
  );
}

export function AuthApp({
  initialPhase = 'idle',
  onTeamSelect,
  onComplete,
  onError: _onError,
  onExit,
  onController,
}: AuthAppProps) {
  const { exit } = useApp();
  const [progress, setProgress] = useState<AuthProgress>({
    phase: initialPhase,
    selectedTeamIndex: 0,
  });
  const teamSelectionSubmittedRef = useRef(false);

  useEffect(() => {
    if (progress.phase === 'selecting_team') {
      teamSelectionSubmittedRef.current = false;
    }
  }, [progress.phase]);

  // Handle keyboard input
  useInput((input, key) => {
    if (progress.phase === 'selecting_team' && progress.teams) {
      if (teamSelectionSubmittedRef.current) {
        return;
      }
      const teamCount = progress.teams.length;

      if (key.upArrow || input === 'k') {
        setProgress((prev) => ({
          ...prev,
          selectedTeamIndex:
            (prev.selectedTeamIndex || 0) > 0 ? (prev.selectedTeamIndex || 0) - 1 : teamCount - 1,
        }));
        return;
      }

      if (key.downArrow || input === 'j') {
        setProgress((prev) => ({
          ...prev,
          selectedTeamIndex:
            (prev.selectedTeamIndex || 0) < teamCount - 1 ? (prev.selectedTeamIndex || 0) + 1 : 0,
        }));
        return;
      }

      if (key.return) {
        teamSelectionSubmittedRef.current = true;
        const selectedTeam = progress.teams[progress.selectedTeamIndex || 0];
        setProgress((prev) => ({
          ...prev,
          phase: 'logging_in',
          statusMessage: `Selecting ${selectedTeam.name}...`,
        }));
        onTeamSelect?.(selectedTeam);
      } else if (key.escape) {
        teamSelectionSubmittedRef.current = true;
        // Signal cancellation — caller uses getDefaultTeam() for the canonical default
        setProgress((prev) => ({
          ...prev,
          phase: 'logging_in',
          statusMessage: 'Using default team...',
        }));
        onTeamSelect?.(undefined);
      }
      return;
    }

    if (progress.phase === 'success' || progress.phase === 'error') {
      if (key.return || key.escape || input === 'q') {
        if (progress.phase === 'success' && progress.userInfo) {
          onComplete?.(progress.userInfo);
        }
        onExit?.();
        exit();
      }
    }
  });

  // Expose controller via callback prop instead of global state
  useEffect(() => {
    if (onController) {
      onController(createAuthController(setProgress));
    }
  }, [onController]);

  const phaseMessages: Record<AuthPhase, string> = {
    idle: 'Ready to authenticate',
    logging_in: 'Logging in...',
    selecting_team: 'Select a team',
    success: 'Successfully logged in!',
    error: 'Authentication failed',
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Promptfoo Authentication
        </Text>
      </Box>

      {/* Logging in */}
      {progress.phase === 'logging_in' && (
        <Box marginBottom={1}>
          <Box marginRight={2}>
            <Spinner />
          </Box>
          <Text>{progress.statusMessage || phaseMessages.logging_in}</Text>
        </Box>
      )}

      {/* Team Selection */}
      {progress.phase === 'selecting_team' && progress.teams && (
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text>{phaseMessages.selecting_team}</Text>
          </Box>
          <TeamSelector teams={progress.teams} selectedIndex={progress.selectedTeamIndex || 0} />
        </Box>
      )}

      {/* Success */}
      {progress.phase === 'success' && progress.userInfo && (
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="green" bold>
              ✓ {phaseMessages.success}
            </Text>
          </Box>
          <Box flexDirection="column">
            <Box>
              <Text dimColor>User: </Text>
              <Text color="cyan">{progress.userInfo.email}</Text>
            </Box>
            <Box>
              <Text dimColor>Organization: </Text>
              <Text color="cyan">{progress.userInfo.organization}</Text>
            </Box>
            {progress.userInfo.team && (
              <Box>
                <Text dimColor>Team: </Text>
                <Text color="cyan">{progress.userInfo.team}</Text>
              </Box>
            )}
            <Box>
              <Text dimColor>App: </Text>
              <Text color="cyan">{progress.userInfo.appUrl}</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Error */}
      {progress.phase === 'error' && (
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="red" bold>
              ✗ {phaseMessages.error}
            </Text>
          </Box>
          {progress.error && <Text color="red">{progress.error}</Text>}
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        {progress.phase === 'logging_in' && <Text dimColor>Please wait...</Text>}
        {progress.phase === 'selecting_team' && (
          <Text dimColor>↑/↓ or j/k to navigate, Enter to select, Esc to use default</Text>
        )}
        {(progress.phase === 'success' || progress.phase === 'error') && (
          <Text dimColor>Press Enter, Esc, or q to exit</Text>
        )}
      </Box>
    </Box>
  );
}

export interface AuthController {
  setPhase(phase: AuthPhase): void;
  setStatusMessage(message: string): void;
  showTeamSelector(teams: TeamInfo[]): void;
  complete(userInfo: UserInfo): void;
  error(message: string): void;
}

export function createAuthController(setProgress: SetProgressFn): AuthController {
  return {
    setPhase(phase) {
      setProgress((prev: AuthProgress) => ({ ...prev, phase }));
    },

    setStatusMessage(message) {
      setProgress((prev: AuthProgress) => ({ ...prev, statusMessage: message }));
    },

    showTeamSelector(teams) {
      setProgress((prev: AuthProgress) => ({
        ...prev,
        phase: 'selecting_team',
        teams,
        selectedTeamIndex: 0,
      }));
    },

    complete(userInfo) {
      setProgress((prev: AuthProgress) => ({
        ...prev,
        phase: 'success',
        userInfo,
      }));
    },

    error(message) {
      setProgress((prev: AuthProgress) => ({
        ...prev,
        phase: 'error',
        error: message,
      }));
    },
  };
}
