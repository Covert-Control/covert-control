import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from "@tanstack/react-router";
import '@mantine/core/styles.css';
import { MantineProvider, createTheme, CSSVariablesResolver } from '@mantine/core';
import { routeTree } from './routeTree.gen';
import '@mantine/tiptap/styles.css';
import { NothingFoundPage } from './components/NothingFoundPage/NothingFoundPage';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { loadLocalReadingPreferences } from './utils/readingPreferences';

const queryClient = new QueryClient();
const router = createRouter({ routeTree, defaultNotFoundComponent: () => <NothingFoundPage /> });
const localPrefs = loadLocalReadingPreferences();

if (localPrefs) {
  useAuthStore.setState({
    readingPreferences: localPrefs,
  });
}

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}

const theme = createTheme({
  primaryColor: 'noir',
  primaryShade: { light: 7, dark: 4 },
  defaultRadius: 'md',
  fontFamily: `'Inter', system-ui, -apple-system, sans-serif`,
  colors: {
    noir: [
      '#f0ecff', // 0
      '#ddd4ff', // 1
      '#bcaaff', // 2
      '#977dff', // 3
      '#7a55ff', // 4  ← dark primary
      '#6840ff', // 5
      '#5a30f0', // 6
      '#4a22d6', // 7  ← light primary
      '#3918b0', // 8
      '#280f88', // 9
    ],
  },
});

const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': theme.colors.gray[6],
    '--mantine-color-default-border': theme.colors.gray[4],
  },
  dark: {
    '--mantine-color-dimmed': '#897fa8',
    '--mantine-color-default-border': '#2e2845',
    '--mantine-color-text': '#ede8ff',
    '--mantine-color-body': '#080807',
    '--mantine-color-dark-6': '#141210',   // card/paper fill
    '--mantine-color-dark-7': '#080807',   // page bg
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark" cssVariablesResolver={cssVariablesResolver}>
      <Notifications position="bottom-right" />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>
);