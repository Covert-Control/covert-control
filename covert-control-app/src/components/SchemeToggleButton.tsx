import { ActionIcon } from '@mantine/core';
import { Moon, Sun } from 'lucide-react';
import {
    useMantineColorScheme, useComputedColorScheme
  } from '@mantine/core';

export default function SchemeToggleButton() {

    const { colorScheme, setColorScheme } = useMantineColorScheme();
    const computedColorScheme = useComputedColorScheme('light');
    const dark = colorScheme === 'dark';

    const toggleColorScheme = () => {
      setColorScheme(computedColorScheme === "dark" ? 'light' : 'dark')
    }

  return (
    <ActionIcon
      variant="outline"
      color={dark ? 'yellow' : 'blue'}
      onClick={toggleColorScheme}
      title="Toggle color scheme"
    >
      {computedColorScheme === "dark" ? <Sun color='yellow' size={18} />: <Moon color='blue' size={18} />}
    </ActionIcon>
  );
}
