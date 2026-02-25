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

const queryClient = new QueryClient(); 
const router = createRouter({ routeTree,defaultNotFoundComponent: () => <NothingFoundPage /> });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const theme = createTheme({
  // You can add valid Mantine theme properties here
});

const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {},
  light: {
    // Darken "dimmed" text (Text c="dimmed") so it isn't washed out on white
    '--mantine-color-dimmed': theme.colors.gray[7],

    // Darken default borders/outlines (Card withBorder, ActionIcon outline, Inputs, etc.)
    '--mantine-color-default-border': theme.colors.gray[4],
  },
  dark: {
    // Optional: keep dark borders consistent with Mantine defaults (tweak if desired)
    '--mantine-color-default-border': theme.colors.dark[4],
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      defaultColorScheme="dark"
      cssVariablesResolver={cssVariablesResolver}
    >
        <Notifications position="bottom-right" />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
    </MantineProvider>
  </StrictMode>
)
