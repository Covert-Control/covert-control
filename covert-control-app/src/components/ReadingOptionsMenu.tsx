//ReadingOptionsMenu.tsx
import { Menu, Button, Tooltip, Text, SimpleGrid, Stack, SegmentedControl } from '@mantine/core';
import { BookmarkCheck, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import {
  saveReadingPreferencesCallable,
  DEFAULT_READING_PREFERENCES,
  type ReadingPreferences,
} from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';
import {
  loadLocalReadingPreferences,
  saveLocalReadingPreferences,
} from '../utils/readingPreferences';

export type ReadingPresetKey = 'default' | 'paper' | 'sepia' | 'night' | 'sage' | 'contrast';

export interface ReadingPreset {
  label: string;
  background: string;
  color: string;
  dividerColor: string;
  suggestedFont?: 'sans' | 'serif' | 'mono';
}

export const READING_PRESETS: Record<ReadingPresetKey, ReadingPreset> = {
  default: {
    label: 'Default',
    background: 'var(--mantine-color-body)',
    color: 'var(--mantine-color-text)',
    dividerColor: 'var(--mantine-color-gray-3)',
  },
  paper: {
    label: 'Paper',
    background: '#f5f0e8',
    color: '#2c2825',
    dividerColor: '#c8bfb0',
    suggestedFont: 'serif',
  },
  sepia: {
    label: 'Sepia',
    background: '#fbf0d9',
    color: '#3b2f1e',
    dividerColor: '#c9ae88',
    suggestedFont: 'serif',
  },
  night: {
    label: 'Night',
    background: '#1c1c1e',
    color: '#e8e6e0',
    dividerColor: 'rgba(255,255,255,0.2)',
    suggestedFont: 'serif',
  },
  sage: {
    label: 'Sage',
    background: '#eef2ec',
    color: '#253020',
    dividerColor: '#b0c4aa',
    suggestedFont: 'sans',
  },
  contrast: {
    label: 'High Contrast',
    background: '#ffffff',
    color: '#000000',
    dividerColor: '#999999',
    suggestedFont: 'sans',
  },
};

const FONT_SIZE_MAP: Record<string, string> = {
  sm: '0.95rem',
  md: '1.05rem',
  lg: '1.2rem',
  xl: '1.4rem',
};

const LINE_HEIGHT_MAP: Record<string, number> = {
  sm: 1.5,
  md: 1.6,
  lg: 1.7,
  xl: 1.75,
};

const FONT_FAMILY_MAP: Record<string, string> = {
  sans: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
  serif: `Georgia, Cambria, "Times New Roman", Times, serif`,
  mono: `"JetBrains Mono", "Fira Code", "Courier New", monospace`,
};

const READING_WIDTH_MAP: Record<string, string> = {
  narrow: '55ch',
  md: '70ch',
  wide: '100%',
};

export interface ReadingStyleValues {
  // Raw selection keys — used by the menu to show current selections
  readingPresetKey: ReadingPresetKey;
  fontSizeKey: 'sm' | 'md' | 'lg' | 'xl';
  fontFamilyKey: 'sans' | 'serif' | 'mono';
  readingWidthKey: 'narrow' | 'md' | 'wide';
  textAlign: 'justify' | 'left';
  // Computed CSS values — used by the reader for rendering
  activePreset: ReadingPreset;
  fontFamilyCss: string;
  fontSizeCss: string;
  lineHeight: number;
  readingWidthCss: string;
}

// Resolves the full hierarchy: Firestore → localStorage → defaults.
// Called by the parent page to initialize readingStyle state.
export function getDefaultReadingStyle(
  firestorePrefs?: ReadingPreferences | null
): ReadingStyleValues {
  const localPrefs = loadLocalReadingPreferences();

  // Firestore wins over local, local wins over defaults
  const prefs = firestorePrefs ?? localPrefs;

  const preset = (prefs?.preset ?? DEFAULT_READING_PREFERENCES.preset) as ReadingPresetKey;
  const fontSize = prefs?.fontSize ?? DEFAULT_READING_PREFERENCES.fontSize;
  const fontFamily = prefs?.fontFamily ?? DEFAULT_READING_PREFERENCES.fontFamily;
  const textAlign = (prefs?.textAlign ?? DEFAULT_READING_PREFERENCES.textAlign) as 'justify' | 'left';
  const readingWidth = prefs?.readingWidth ?? DEFAULT_READING_PREFERENCES.readingWidth;

  return {
    readingPresetKey: preset,
    fontSizeKey: fontSize as 'sm' | 'md' | 'lg' | 'xl',
    fontFamilyKey: fontFamily as 'sans' | 'serif' | 'mono',
    readingWidthKey: readingWidth as 'narrow' | 'md' | 'wide',
    textAlign,
    activePreset: READING_PRESETS[preset],
    fontFamilyCss: FONT_FAMILY_MAP[fontFamily],
    fontSizeCss: FONT_SIZE_MAP[fontSize],
    lineHeight: LINE_HEIGHT_MAP[fontSize],
    readingWidthCss: READING_WIDTH_MAP[readingWidth],
  };
}

interface ReadingOptionsMenuProps {
  onChange: (values: ReadingStyleValues) => void;
  currentValues: ReadingStyleValues; // 👈 parent is now the source of truth
}

export function ReadingOptionsMenu({ onChange, currentValues }: ReadingOptionsMenuProps) {
  const user = useAuthStore((s) => s.user);
  const setStoredPrefs = useAuthStore((s) => s.setReadingPreferences);
  const [savingPrefs, setSavingPrefs] = useState(false);

  function emit(overrides: Partial<{
    preset: ReadingPresetKey;
    fontFamily: string;
    fontSize: string;
    textAlign: 'justify' | 'left';
    readingWidth: string;
  }> = {}) {
    const p = (overrides.preset ?? currentValues.readingPresetKey) as ReadingPresetKey;
    const ff = overrides.fontFamily ?? currentValues.fontFamilyKey;
    const fs = overrides.fontSize ?? currentValues.fontSizeKey;
    const ta = overrides.textAlign ?? currentValues.textAlign;
    const rw = overrides.readingWidth ?? currentValues.readingWidthKey;

    onChange({
      readingPresetKey: p,
      fontSizeKey: fs as 'sm' | 'md' | 'lg' | 'xl',
      fontFamilyKey: ff as 'sans' | 'serif' | 'mono',
      readingWidthKey: rw as 'narrow' | 'md' | 'wide',
      textAlign: ta,
      activePreset: READING_PRESETS[p],
      fontFamilyCss: FONT_FAMILY_MAP[ff],
      fontSizeCss: FONT_SIZE_MAP[fs],
      lineHeight: LINE_HEIGHT_MAP[fs],
      readingWidthCss: READING_WIDTH_MAP[rw],
    });

    saveLocalReadingPreferences({
      preset: p,
      fontSize: fs as ReadingPreferences['fontSize'],
      fontFamily: ff as ReadingPreferences['fontFamily'],
      textAlign: ta,
      readingWidth: rw as ReadingPreferences['readingWidth'],
    });
  }

  function applyPreset(key: ReadingPresetKey) {
    const suggested = READING_PRESETS[key].suggestedFont;
    const newFontFamily = suggested ?? currentValues.fontFamilyKey;
    emit({ preset: key, fontFamily: newFontFamily });
  }

  async function handleSavePreferences() {
    if (!user) return;
    setSavingPrefs(true);
    try {
      const prefs: ReadingPreferences = {
        preset: currentValues.readingPresetKey,
        fontSize: currentValues.fontSizeKey,
        fontFamily: currentValues.fontFamilyKey,
        textAlign: currentValues.textAlign,
        readingWidth: currentValues.readingWidthKey,
      };
      console.log('[READING PREFS] calling saveReadingPreferencesCallable');
      await saveReadingPreferencesCallable(prefs);
      setStoredPrefs(prefs);
      notifications.show({
        title: 'Preferences saved',
        message: 'Your reading settings will apply automatically next time.',
        color: 'green',
        position: 'bottom-center',
      });
    } catch (e) {
      console.error(e);
      notifications.show({
        title: 'Could not save preferences',
        message: 'Please try again.',
        color: 'red',
        position: 'bottom-center',
      });
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <Menu withArrow shadow="md" position="bottom-end">
      <Menu.Target>
        <Tooltip label="Reading options" withArrow position="bottom">
          <Button variant="subtle" size="xs" radius="md" leftSection={<SlidersHorizontal size={14} />}>
            Display
          </Button>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown p="sm" w={260}>
        <Stack gap="sm">

          <div>
            <Text size="xs" fw={700} mb={4}>Theme</Text>
            <SimpleGrid cols={2} spacing={6}>
              {Object.entries(READING_PRESETS).map(([key, preset]) => (
                <Button
                  key={key}
                  size="xs"
                  variant={currentValues.readingPresetKey === key ? 'filled' : 'light'}
                  onClick={() => applyPreset(key as ReadingPresetKey)}
                >
                  {preset.label}
                </Button>
              ))}
            </SimpleGrid>
          </div>

          <div>
            <Text size="xs" fw={700} mb={4}>Text Size</Text>
            <SegmentedControl
              fullWidth size="xs"
              value={currentValues.fontSizeKey}
              onChange={(v) => emit({ fontSize: v })}
              data={[
                { label: 'S', value: 'sm' },
                { label: 'M', value: 'md' },
                { label: 'L', value: 'lg' },
                { label: 'XL', value: 'xl' },
              ]}
            />
          </div>

          <div>
            <Text size="xs" fw={700} mb={4}>Font</Text>
            <SegmentedControl
              fullWidth size="xs"
              value={currentValues.fontFamilyKey}
              onChange={(v) => emit({ fontFamily: v })}
              data={[
                { label: 'Sans', value: 'sans' },
                { label: 'Serif', value: 'serif' },
                { label: 'Mono', value: 'mono' },
              ]}
            />
          </div>

          <div>
            <Text size="xs" fw={700} mb={4}>Align</Text>
            <SegmentedControl
              fullWidth size="xs"
              value={currentValues.textAlign}
              onChange={(v) => emit({ textAlign: v as 'justify' | 'left' })}
              data={[
                { label: 'Justify', value: 'justify' },
                { label: 'Left', value: 'left' },
              ]}
            />
          </div>

          <div>
            <Text size="xs" fw={700} mb={4}>Width</Text>
            <SegmentedControl
              fullWidth size="xs"
              value={currentValues.readingWidthKey}
              onChange={(v) => emit({ readingWidth: v })}
              data={[
                { label: 'Narrow', value: 'narrow' },
                { label: 'Medium', value: 'md' },
                { label: 'Wide', value: 'wide' },
              ]}
            />
          </div>

          {user && (
            <Button
              fullWidth size="xs"
              onClick={handleSavePreferences}
              loading={savingPrefs}
              leftSection={<BookmarkCheck size={14} />}
            >
              Save Preferences
            </Button>
          )}

        </Stack>
      </Menu.Dropdown>
    </Menu>
  );
}
