import React from 'react';

import { Box, Text, useInput } from 'ink';
import { LIMITS } from '../../constants';
import { CategorySection, type ShortcutCategory } from '../shared/ShortcutDisplay';

export interface HelpOverlayProps {
  /** Callback when user dismisses the help overlay */
  onClose: () => void;
  /** Whether history browser is available */
  historyAvailable?: boolean;
  /** Width of the terminal */
  terminalWidth?: number;
}

/**
 * Get all available shortcuts organized by category.
 */
function getShortcutCategories(historyAvailable: boolean): ShortcutCategory[] {
  const categories: ShortcutCategory[] = [
    {
      name: 'Navigation',
      shortcuts: [
        { keys: ['↑', 'k'], description: 'Move up' },
        { keys: ['↓', 'j'], description: 'Move down' },
        { keys: ['←', 'h'], description: 'Move left' },
        { keys: ['→', 'l'], description: 'Move right' },
        { keys: ['g'], description: 'Jump to top (Home/Fn←)' },
        { keys: ['G'], description: 'Jump to bottom (End/Fn→)' },
        { keys: ['0', 'Ctrl+a'], description: 'First column' },
        { keys: ['$', 'Ctrl+e'], description: 'Last column' },
        { keys: ['PgUp'], description: 'Page up' },
        { keys: ['PgDn'], description: 'Page down' },
        { keys: ['Ctrl+u'], description: 'Half page up' },
        { keys: ['Ctrl+d'], description: 'Half page down' },
      ],
    },
    {
      name: 'Actions',
      shortcuts: [
        { keys: ['Enter'], description: 'Open cell details' },
        { keys: ['x'], description: 'Export to file' },
        { keys: ['y'], description: 'Copy selected cell' },
      ],
    },
    {
      name: 'Filters',
      shortcuts: [
        { keys: ['a', 'p', 'f', 'e', 'd'], description: 'Quick filters' },
        { keys: ['/'], description: 'Search rows' },
        { keys: [':'], description: 'Command mode (:filter, :clear, :50)' },
      ],
    },
    {
      name: 'Views',
      shortcuts: [
        ...(historyAvailable ? [{ keys: ['H'], description: 'History browser' }] : []),
        { keys: ['?'], description: 'Show this help' },
      ],
    },
    {
      name: 'General',
      shortcuts: [
        { keys: ['Esc'], description: 'Close overlay' },
        { keys: ['q'], description: 'Exit table' },
      ],
    },
  ];

  return categories;
}

/**
 * Full-screen help overlay showing all keyboard shortcuts.
 *
 * Displays shortcuts organized by category in a two-column layout.
 * Press any key to dismiss.
 */
export function HelpOverlay({
  onClose,
  historyAvailable = false,
  terminalWidth = 80,
}: HelpOverlayProps): React.ReactElement {
  // Close on any key press
  useInput(() => {
    onClose();
  });

  const categories = getShortcutCategories(historyAvailable);

  // Split categories into two columns for wider display
  const useWideLayout = terminalWidth >= LIMITS.WIDE_LAYOUT_MIN_WIDTH;
  const midpoint = Math.ceil(categories.length / 2);
  const leftCategories = useWideLayout ? categories.slice(0, midpoint) : categories;
  const rightCategories = useWideLayout ? categories.slice(midpoint) : [];

  const boxWidth = Math.min(terminalWidth - 4, 72);
  const columnWidth = useWideLayout ? Math.floor((boxWidth - 6) / 2) : boxWidth - 4;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="blue"
      paddingX={2}
      paddingY={1}
      width={boxWidth}
    >
      {/* Header */}
      <Box justifyContent="center" marginBottom={1}>
        <Text color="blue" bold>
          Keyboard Shortcuts
        </Text>
      </Box>

      {/* Content */}
      {useWideLayout ? (
        <Box flexDirection="row">
          {/* Left column */}
          <Box flexDirection="column" width={columnWidth}>
            {leftCategories.map((category, index) => (
              <CategorySection key={index} category={category} />
            ))}
          </Box>

          {/* Spacer */}
          <Box width={4} />

          {/* Right column */}
          <Box flexDirection="column" width={columnWidth}>
            {rightCategories.map((category, index) => (
              <CategorySection key={index} category={category} />
            ))}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          {categories.map((category, index) => (
            <CategorySection key={index} category={category} />
          ))}
        </Box>
      )}

      {/* Footer */}
      <Box flexDirection="column" marginTop={1}>
        <Box justifyContent="center">
          <Text color="gray">Shortcuts apply after closing help.</Text>
        </Box>
        <Box
          justifyContent="center"
          marginTop={1}
          borderStyle="single"
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderColor="gray"
          paddingTop={1}
        >
          <Text color="gray">Press any key to close help</Text>
        </Box>
      </Box>
    </Box>
  );
}
