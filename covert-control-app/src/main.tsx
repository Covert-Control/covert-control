import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from "@tanstack/react-router";
import '@mantine/core/styles.css';
import { MantineProvider, createTheme } from '@mantine/core';
import { routeTree } from './routeTree.gen';
import '@mantine/tiptap/styles.css';
import { NothingFoundPage } from './components/NothingFoundPage/NothingFoundPage';
import { Notifications } from '@mantine/notifications'; 
import '@mantine/notifications/styles.css'; 
import '@mantine/core/styles.css';

const router = createRouter({ routeTree,defaultNotFoundComponent: () => <NothingFoundPage /> });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const theme = createTheme({
  // You can add valid Mantine theme properties here
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme='dark'>
        <Notifications position="bottom-right" />
        <RouterProvider router={router} />
    </MantineProvider>
  </StrictMode>
)
