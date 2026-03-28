/**
 * InitApp - Main application component for the init wizard.
 *
 * Orchestrates the wizard flow by connecting the XState machine
 * to the step components.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useMachine } from '@xstate/react';
import { Box, Text, useApp, useInput } from 'ink';
import { initMachine } from '../machines/initMachine';
import {
  checkExistingFiles,
  downloadExample,
  fetchExampleList,
  generateFiles,
  resolveExampleTargetDirectory,
  writeFiles,
} from '../utils';
import { StepIndicator } from './shared/StepIndicator';
import {
  CompleteStep,
  DownloadComplete as DownloadCompleteComponent,
  DownloadProgress as DownloadProgressComponent,
  ExampleStep,
  LanguageStep,
  PathStep,
  PluginModeStep,
  PluginStep,
  PreviewStep,
  ProviderStep,
  PurposeStep,
  StrategyModeStep,
  StrategyStep,
  // Redteam step components
  TargetLabelStep,
  TargetTypeStep,
  UseCaseStep,
  WritingStep,
} from './steps';

import type {
  InitPath,
  Language,
  PluginSelection,
  RedteamTargetType,
  SelectedProvider,
  StepInfo,
  UseCase,
} from '../machines/initMachine.types';
import type { DownloadProgress } from '../utils';

export interface InitAppProps {
  /** Called when initialization is complete */
  onComplete?: (result: { directory: string; filesWritten: string[] }) => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

/**
 * Main InitApp component.
 */
export function InitApp({ onComplete, onCancel }: InitAppProps) {
  const { exit } = useApp();
  const [state, send] = useMachine(initMachine);

  // Helper: XState v5's setup() generates strict match types that don't accept
  // dotted strings for nested states. This helper checks dotted paths against
  // the state value object tree.
  const stateMatches = useCallback(
    (path: string): boolean => {
      const parts = path.split('.');
      let current: string | Record<string, unknown> = state.value as
        | string
        | Record<string, unknown>;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (typeof current === 'string') {
          return current === part && i === parts.length - 1;
        }
        if (typeof current === 'object' && current !== null && part in current) {
          current = current[part] as string | Record<string, unknown>;
        } else {
          return false;
        }
      }
      return true;
    },
    [state.value],
  );

  // Local state for async operations
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [exampleList, setExampleList] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadedExampleFiles, setDownloadedExampleFiles] = useState<string[]>([]);
  const [exampleTargetDirectory, setExampleTargetDirectory] = useState<string | null>(null);
  const [filesWritten, setFilesWritten] = useState<string[]>([]);
  const completionResolvedRef = useRef(false);

  const isCompleteState =
    stateMatches('project.complete') ||
    stateMatches('example.complete') ||
    stateMatches('redteam.complete');

  const resolveCompletion = useCallback(() => {
    if (completionResolvedRef.current) {
      return;
    }
    completionResolvedRef.current = true;
    const directory =
      stateMatches('example.complete') && exampleTargetDirectory
        ? exampleTargetDirectory
        : state.context.outputDirectory;
    onComplete?.({
      directory,
      filesWritten: state.context.filesWritten,
    });
  }, [
    exampleTargetDirectory,
    onComplete,
    state.context.filesWritten,
    state.context.outputDirectory,
    stateMatches,
  ]);

  // Handle global keyboard shortcuts
  useInput((input, key) => {
    if (isCompleteState) {
      if (input || Object.values(key).some(Boolean)) {
        resolveCompletion();
      }
      return;
    }

    // Ctrl+C to cancel
    if (input === 'c' && key.ctrl) {
      send({ type: 'CANCEL' });
      return;
    }
    // Handle error state: 'r' to retry, any other key to exit
    if (state.context.error) {
      if (input === 'r') {
        send({ type: 'RETRY' });
      } else {
        send({ type: 'CANCEL' });
      }
    }
  });

  // Handle machine state changes
  useEffect(() => {
    // Handle final states
    if (stateMatches('cancelled')) {
      onCancel?.();
      exit();
    }
  }, [exit, onCancel, stateMatches]);

  // Load examples when entering example selection
  useEffect(() => {
    if (stateMatches('example.selecting') && exampleList.length === 0 && !examplesLoading) {
      setExamplesLoading(true);
      setExamplesError(null);

      fetchExampleList()
        .then((examples) => {
          setExampleList(examples);
          setExamplesLoading(false);
        })
        .catch((error) => {
          setExamplesError(error instanceof Error ? error.message : String(error));
          setExamplesLoading(false);
        });
    }
  }, [exampleList.length, examplesLoading, stateMatches]);

  // Handle example download
  const handleDownloadExample = useCallback(
    async (exampleName: string) => {
      const targetDir = resolveExampleTargetDirectory(state.context.outputDirectory, exampleName);
      setExampleTargetDirectory(targetDir);
      setDownloadedExampleFiles([]);
      setDownloadProgress({
        currentFile: '',
        filesDownloaded: 0,
        totalFiles: 0,
        percentage: 0,
      });

      send({ type: 'SELECT_EXAMPLE', example: exampleName });

      const result = await downloadExample(exampleName, targetDir, (progress) => {
        setDownloadProgress(progress);
        if (progress.currentFile) {
          setDownloadedExampleFiles((prev) =>
            prev[prev.length - 1] === progress.currentFile ? prev : [...prev, progress.currentFile],
          );
        }
      });

      if (result.success) {
        send({ type: 'DOWNLOAD_COMPLETE', files: result.filesDownloaded });
      } else {
        send({
          type: 'DOWNLOAD_ERROR',
          error: result.errors.map((e) => e.error).join(', '),
        });
      }
    },
    [state.context.outputDirectory, send],
  );

  // Handle file preview generation
  const handleGeneratePreview = useCallback(async () => {
    const files = generateFiles(state.context);
    const checkedFiles = await checkExistingFiles(files);
    send({ type: 'PREVIEW_READY', files: checkedFiles });
  }, [state.context, send]);

  // Generate preview files when entering redteam preview state
  useEffect(() => {
    if (stateMatches('redteam.previewing') && state.context.filesToWrite.length === 0) {
      void handleGeneratePreview();
    }
  }, [state, handleGeneratePreview, stateMatches]);

  // Handle file writing
  const handleWriteFiles = useCallback(async () => {
    send({ type: 'CONFIRM' });

    const result = await writeFiles(state.context.filesToWrite, {
      onFileWritten: (path) => {
        setFilesWritten((prev) => [...prev, path]);
      },
    });

    if (result.success) {
      send({ type: 'WRITE_COMPLETE', files: result.filesWritten });
    } else {
      send({
        type: 'WRITE_ERROR',
        error: result.errors.map((e) => e.error).join(', '),
      });
    }
  }, [state.context.filesToWrite, send]);

  // Toggle file overwrite
  const handleToggleOverwrite = useCallback(
    (path: string) => {
      send({ type: 'TOGGLE_FILE_OVERWRITE', path });
    },
    [send],
  );

  // Get current step info for the step indicator
  const getStepInfo = (): { steps: StepInfo[]; currentIndex: number } => {
    if (stateMatches('example')) {
      const exampleSteps: StepInfo[] = [
        { id: 'example', label: 'Select example', shortLabel: 'Example' },
        { id: 'download', label: 'Download', shortLabel: 'Download' },
      ];
      return {
        steps: exampleSteps,
        currentIndex: stateMatches('example.selecting') ? 0 : 1,
      };
    }

    // Redteam flow steps
    if (state.context.useCase === 'redteam' || stateMatches('redteam')) {
      const redteamSteps: StepInfo[] = [
        { id: 'target', label: 'Target Name', shortLabel: 'Target' },
        { id: 'targetType', label: 'Target Type', shortLabel: 'Type' },
        { id: 'purpose', label: 'Purpose', shortLabel: 'Purpose' },
        { id: 'plugins', label: 'Plugins', shortLabel: 'Plugins' },
        { id: 'strategies', label: 'Strategies', shortLabel: 'Strategies' },
        { id: 'preview', label: 'Preview', shortLabel: 'Preview' },
      ];

      let currentIndex = 0;

      if (stateMatches('redteam.enteringLabel')) {
        currentIndex = 0;
      } else if (stateMatches('redteam.selectingTargetType')) {
        currentIndex = 1;
      } else if (stateMatches('redteam.enteringPurpose')) {
        currentIndex = 2;
      } else if (
        stateMatches('redteam.selectingPluginMode') ||
        stateMatches('redteam.selectingPlugins')
      ) {
        currentIndex = 3;
      } else if (
        stateMatches('redteam.selectingStrategyMode') ||
        stateMatches('redteam.selectingStrategies')
      ) {
        currentIndex = 4;
      } else if (
        stateMatches('redteam.previewing') ||
        stateMatches('redteam.writing') ||
        stateMatches('redteam.complete')
      ) {
        currentIndex = 5;
      }

      return {
        steps: redteamSteps,
        currentIndex,
      };
    }

    // Project flow steps
    const needsLanguage = state.context.useCase === 'rag' || state.context.useCase === 'agent';

    const projectSteps: StepInfo[] = [{ id: 'useCase', label: 'Use Case', shortLabel: 'Use Case' }];

    if (needsLanguage) {
      projectSteps.push({ id: 'language', label: 'Language', shortLabel: 'Language' });
    }

    projectSteps.push(
      { id: 'providers', label: 'Providers', shortLabel: 'Providers' },
      { id: 'preview', label: 'Preview', shortLabel: 'Preview' },
      { id: 'write', label: 'Write', shortLabel: 'Write' },
    );

    let currentIndex = 0;

    if (stateMatches('project.selectingUseCase')) {
      currentIndex = 0;
    } else if (stateMatches('project.selectingLanguage')) {
      currentIndex = 1;
    } else if (stateMatches('project.selectingProviders')) {
      currentIndex = needsLanguage ? 2 : 1;
    } else if (stateMatches('project.previewing')) {
      currentIndex = needsLanguage ? 3 : 2;
    } else if (stateMatches('project.writing') || stateMatches('project.complete')) {
      currentIndex = needsLanguage ? 4 : 3;
    }

    return {
      steps: projectSteps,
      currentIndex,
    };
  };

  // Render the appropriate step based on machine state
  const renderStep = () => {
    // Path selection
    if (stateMatches('selectingPath')) {
      return (
        <PathStep
          onSelect={(path: InitPath) => send({ type: 'SELECT_PATH', path })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Example flow
    if (stateMatches('example.selecting')) {
      return (
        <ExampleStep
          examples={exampleList}
          isLoading={examplesLoading}
          error={examplesError}
          onSelect={handleDownloadExample}
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          onRetry={() => {
            setExamplesLoading(true);
            setExamplesError(null);
            fetchExampleList()
              .then((examples) => {
                setExampleList(examples);
                setExamplesLoading(false);
              })
              .catch((error) => {
                setExamplesError(error instanceof Error ? error.message : String(error));
                setExamplesLoading(false);
              });
          }}
          isFocused={true}
        />
      );
    }

    if (stateMatches('example.downloading')) {
      return (
        <DownloadProgressComponent
          exampleName={state.context.exampleName || ''}
          progress={downloadProgress?.percentage ?? 0}
          downloadedFiles={downloadedExampleFiles}
        />
      );
    }

    if (stateMatches('example.complete')) {
      return (
        <DownloadCompleteComponent
          exampleName={state.context.exampleName || ''}
          directory={exampleTargetDirectory || state.context.outputDirectory}
          filesCount={state.context.filesWritten.length}
        />
      );
    }

    // Project flow - Use case selection
    if (stateMatches('project.selectingUseCase')) {
      return (
        <UseCaseStep
          onSelect={(useCase: UseCase) => send({ type: 'SELECT_USECASE', useCase })}
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Project flow - Language selection
    if (stateMatches('project.selectingLanguage')) {
      return (
        <LanguageStep
          onSelect={(language: Language) => send({ type: 'SELECT_LANGUAGE', language })}
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Project flow - Provider selection
    if (stateMatches('project.selectingProviders')) {
      return (
        <ProviderStep
          selected={state.context.providers}
          onSelect={(providers: SelectedProvider[]) => {
            // Update context with new provider selection
            send({ type: 'SELECT_PROVIDERS', providers });
          }}
          onConfirm={handleGeneratePreview}
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Project flow - Preview
    if (stateMatches('project.previewing')) {
      return (
        <PreviewStep
          files={state.context.filesToWrite}
          directory={state.context.outputDirectory}
          onToggleOverwrite={handleToggleOverwrite}
          onConfirm={handleWriteFiles}
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Project flow - Writing
    if (stateMatches('project.writing')) {
      return <WritingStep files={state.context.filesToWrite} filesWritten={filesWritten} />;
    }

    // Project flow - Complete
    if (stateMatches('project.complete')) {
      return (
        <CompleteStep
          directory={state.context.outputDirectory}
          filesWritten={state.context.filesWritten}
          configPath="promptfooconfig.yaml"
        />
      );
    }

    // Redteam flow - Target label entry
    if (stateMatches('redteam.enteringLabel')) {
      return (
        <TargetLabelStep
          value={state.context.redteam.targetLabel}
          onChange={() => {}}
          onSubmit={(label: string) => send({ type: 'SET_TARGET_LABEL', label })}
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Redteam flow - Target type selection
    if (stateMatches('redteam.selectingTargetType')) {
      return (
        <TargetTypeStep
          onSelect={(targetType: RedteamTargetType) =>
            send({ type: 'SELECT_TARGET_TYPE', targetType })
          }
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Redteam flow - Purpose entry
    if (stateMatches('redteam.enteringPurpose')) {
      return (
        <PurposeStep
          value={state.context.redteam.purpose}
          onChange={() => {}}
          onSubmit={(purpose: string) => send({ type: 'SET_PURPOSE', purpose })}
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Redteam flow - Plugin mode selection
    if (stateMatches('redteam.selectingPluginMode')) {
      return (
        <PluginModeStep
          onSelect={(mode: 'default' | 'manual') =>
            send({ type: 'SELECT_PLUGIN_CONFIG_MODE', mode })
          }
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Redteam flow - Plugin selection
    if (stateMatches('redteam.selectingPlugins')) {
      return (
        <PluginStep
          selected={state.context.redteam.plugins}
          onSelect={(plugins: PluginSelection[]) => {
            send({ type: 'UPDATE_PLUGINS', plugins });
          }}
          onConfirm={() => send({ type: 'SELECT_PLUGINS', plugins: state.context.redteam.plugins })}
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Redteam flow - Strategy mode selection
    if (stateMatches('redteam.selectingStrategyMode')) {
      return (
        <StrategyModeStep
          onSelect={(mode: 'default' | 'manual') =>
            send({ type: 'SELECT_STRATEGY_CONFIG_MODE', mode })
          }
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Redteam flow - Strategy selection
    if (stateMatches('redteam.selectingStrategies')) {
      return (
        <StrategyStep
          selected={state.context.redteam.strategies}
          onSelect={(strategies: string[]) => {
            send({ type: 'UPDATE_STRATEGIES', strategies });
          }}
          onConfirm={() =>
            send({ type: 'SELECT_STRATEGIES', strategies: state.context.redteam.strategies })
          }
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Redteam flow - Preview
    if (stateMatches('redteam.previewing')) {
      return (
        <PreviewStep
          files={state.context.filesToWrite}
          directory={state.context.outputDirectory}
          onToggleOverwrite={handleToggleOverwrite}
          onConfirm={handleWriteFiles}
          onBack={() => send({ type: 'BACK' })}
          onCancel={() => send({ type: 'CANCEL' })}
          isFocused={true}
        />
      );
    }

    // Redteam flow - Writing
    if (stateMatches('redteam.writing')) {
      return <WritingStep files={state.context.filesToWrite} filesWritten={filesWritten} />;
    }

    // Redteam flow - Complete
    if (stateMatches('redteam.complete')) {
      return (
        <CompleteStep
          directory={state.context.outputDirectory}
          filesWritten={state.context.filesWritten}
          configPath="promptfooconfig.yaml"
        />
      );
    }

    // Error state
    if (state.context.error) {
      return (
        <Box flexDirection="column">
          <Text color="red" bold>
            Error
          </Text>
          <Text color="red">{state.context.error}</Text>
          <Box marginTop={1}>
            <Text dimColor>Press 'r' to retry or any other key to exit</Text>
          </Box>
        </Box>
      );
    }

    // Initial/loading state
    return (
      <Box>
        <Text color="cyan">Initializing...</Text>
      </Box>
    );
  };

  // Auto-start the machine
  useEffect(() => {
    if (stateMatches('idle')) {
      send({ type: 'START' });
    }
  }, [send, stateMatches]);

  const stepInfo = getStepInfo();
  const showStepIndicator =
    !stateMatches('idle') &&
    !stateMatches('selectingPath') &&
    !stateMatches('cancelled') &&
    !stateMatches('project.complete') &&
    !stateMatches('example.complete') &&
    !stateMatches('redteam.complete');

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          promptfoo init
        </Text>
      </Box>

      {/* Step indicator */}
      {showStepIndicator && (
        <Box marginBottom={1}>
          <StepIndicator
            steps={stepInfo.steps}
            currentIndex={stepInfo.currentIndex}
            compact={true}
          />
        </Box>
      )}

      {/* Current step content */}
      {renderStep()}
    </Box>
  );
}
