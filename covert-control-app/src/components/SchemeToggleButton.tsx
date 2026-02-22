import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { Moon, Sun } from 'lucide-react';

export default function SchemeToggleButton() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('dark');
  const dark = computed === 'dark';

  return (
    <ActionIcon
      variant="outline"
      color={dark ? 'yellow' : 'blue'}
      onClick={() => setColorScheme(dark ? 'light' : 'dark')}
      title="Toggle color scheme"
      aria-label="Toggle color scheme"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </ActionIcon>
  );
}
