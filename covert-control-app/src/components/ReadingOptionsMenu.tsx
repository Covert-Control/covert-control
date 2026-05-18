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
  wide: '85ch',
};

export interface ReadingStyleValues {
  activePreset: ReadingPreset;
  readingPresetKey: ReadingPresetKey;
  fontFamilyCss: string;
  fontSizeCss: string;
  lineHeight: number;
  textAlign: 'justify' | 'left';
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
    activePreset: READING_PRESETS[preset],
    readingPresetKey: preset,
    fontFamilyCss: FONT_FAMILY_MAP[fontFamily],
    fontSizeCss: FONT_SIZE_MAP[fontSize],
    lineHeight: LINE_HEIGHT_MAP[fontSize],
    textAlign,
    readingWidthCss: READING_WIDTH_MAP[readingWidth],
  };
}

interface ReadingOptionsMenuProps {
  onChange: (values: ReadingStyleValues) => void;
}

export function ReadingOptionsMenu({ onChange }: ReadingOptionsMenuProps) {
  const user = useAuthStore((s) => s.user);
  const storedPrefs = useAuthStore((s) => s.readingPreferences);
  const setStoredPrefs = useAuthStore((s) => s.setReadingPreferences);

  // Hierarchy for initial state: Firestore → localStorage → defaults
  const localPrefs = loadLocalReadingPreferences();
  const effectivePrefs = storedPrefs ?? localPrefs;

  const [fontSize, setFontSizeState] = useState<'sm' | 'md' | 'lg' | 'xl'>(
    (effectivePrefs?.fontSize ?? DEFAULT_READING_PREFERENCES.fontSize) as 'sm' | 'md' | 'lg' | 'xl'
  );
  const [fontFamily, setFontFamilyState] = useState<'sans' | 'serif' | 'mono'>(
    (effectivePrefs?.fontFamily ?? DEFAULT_READING_PREFERENCES.fontFamily) as 'sans' | 'serif' | 'mono'
  );
  const [readingPreset, setReadingPresetState] = useState<ReadingPresetKey>(
    (effectivePrefs?.preset ?? DEFAULT_READING_PREFERENCES.preset) as ReadingPresetKey
  );
  const [textAlign, setTextAlignState] = useState<'justify' | 'left'>(
    (effectivePrefs?.textAlign ?? DEFAULT_READING_PREFERENCES.textAlign) as 'justify' | 'left'
  );
  const [readingWidth, setReadingWidthState] = useState<'narrow' | 'md' | 'wide'>(
    (effectivePrefs?.readingWidth ?? DEFAULT_READING_PREFERENCES.readingWidth) as 'narrow' | 'md' | 'wide'
  );
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Single place where all current values are assembled and broadcast.
  // Persists to localStorage here so every change is automatically cached,
  // regardless of whether the user clicks "Save Preferences".
  function emit(overrides: Partial<{
    preset: ReadingPresetKey;
    fontFamily: string;
    fontSize: string;
    textAlign: 'justify' | 'left';
    readingWidth: string;
  }> = {}) {
    const p = overrides.preset ?? readingPreset;
    const ff = overrides.fontFamily ?? fontFamily;
    const fs = overrides.fontSize ?? fontSize;
    const ta = overrides.textAlign ?? textAlign;
    const rw = overrides.readingWidth ?? readingWidth;

    onChange({
      activePreset: READING_PRESETS[p],
      readingPresetKey: p,
      fontFamilyCss: FONT_FAMILY_MAP[ff],
      fontSizeCss: FONT_SIZE_MAP[fs],
      lineHeight: LINE_HEIGHT_MAP[fs],
      textAlign: ta,
      readingWidthCss: READING_WIDTH_MAP[rw],
    });

    // Always persist locally — works for both guests and logged-in users
    saveLocalReadingPreferences({
      preset: p,
      fontSize: fs as ReadingPreferences['fontSize'],
      fontFamily: ff as ReadingPreferences['fontFamily'],
      textAlign: ta,
      readingWidth: rw as ReadingPreferences['readingWidth'],
    });
  }

  function setFontSize(v: 'sm' | 'md' | 'lg' | 'xl') {
    setFontSizeState(v);
    emit({ fontSize: v });
  }

  function setFontFamily(v: 'sans' | 'serif' | 'mono') {
    setFontFamilyState(v);
    emit({ fontFamily: v });
  }

  function setTextAlign(v: 'justify' | 'left') {
    setTextAlignState(v);
    emit({ textAlign: v });
  }

  function setReadingWidth(v: 'narrow' | 'md' | 'wide') {
    setReadingWidthState(v);
    emit({ readingWidth: v });
  }

  function applyPreset(key: ReadingPresetKey) {
    setReadingPresetState(key);
    const suggested = READING_PRESETS[key].suggestedFont;
    const newFontFamily = suggested ?? fontFamily;
    if (suggested) setFontFamilyState(suggested);
    emit({ preset: key, fontFamily: newFontFamily });
  }

  // "Save Preferences" only does the Firestore write + store update.
  // localStorage is already up to date from emit().
  async function handleSavePreferences() {
    if (!user) return;
    setSavingPrefs(true);
    try {
      const prefs: ReadingPreferences = {
        preset: readingPreset,
        fontSize,
        fontFamily,
        textAlign,
        readingWidth,
      };
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
          <Button
            variant="subtle"
            size="xs"
            radius="md"
            leftSection={<SlidersHorizontal size={14} />}
          >
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
                  variant={readingPreset === key ? 'filled' : 'light'}
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
              fullWidth
              size="xs"
              value={fontSize}
              onChange={(v) => setFontSize(v as 'sm' | 'md' | 'lg' | 'xl')}
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
              fullWidth
              size="xs"
              value={fontFamily}
              onChange={(v) => setFontFamily(v as 'sans' | 'serif' | 'mono')}
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
              fullWidth
              size="xs"
              value={textAlign}
              onChange={(v) => setTextAlign(v as 'justify' | 'left')}
              data={[
                { label: 'Justify', value: 'justify' },
                { label: 'Left', value: 'left' },
              ]}
            />
          </div>

          <div>
            <Text size="xs" fw={700} mb={4}>Width</Text>
            <SegmentedControl
              fullWidth
              size="xs"
              value={readingWidth}
              onChange={(v) => setReadingWidth(v as 'narrow' | 'md' | 'wide')}
              data={[
                { label: 'Narrow', value: 'narrow' },
                { label: 'Medium', value: 'md' },
                { label: 'Wide', value: 'wide' },
              ]}
            />
          </div>

          {user && (
            <Button
              fullWidth
              size="xs"
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