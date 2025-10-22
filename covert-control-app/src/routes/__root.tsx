// __root.tsx
import * as React from 'react';
import { AppShell, Burger, Group, Skeleton, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import SchemeToggleButton from '../components/SchemeToggleButton.tsx';
import DiscordButton from '../components/DiscordButton.tsx';
import SiteNavbar from '../components/Navbar/Navbar.tsx'; // ⬅️ renamed import
import { AccountDropDown } from '../components/AccountDropDown.tsx';
import { useAuthStore } from '../stores/authStore';
import { SetUsernamePage } from '../components/SetUsernamePage.tsx';
import { useAuthListener } from '../hooks/useAuthListener';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useAuthListener();

  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const { user, isProfileComplete, loading } = useAuthStore();

  if (loading) {
    return (
      <AppShell header={{ height: 60 }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <Title order={1}>Loading App...</Title>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          <Skeleton height={200} mb="xl" />
          <Skeleton height={100} mb="xl" />
          <Skeleton height={300} />
        </AppShell.Main>
      </AppShell>
    );
  }

  if (user && isProfileComplete === false) {
    return <SetUsernamePage />;
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 190,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            {/* Mobile burger (only shows < sm) */}

              <Burger
                opened={mobileOpened}
                onClick={toggleMobile}
                hiddenFrom="sm"
                size="sm"
                aria-label={mobileOpened ? 'Close sidebar' : 'Open sidebar'}
                title={mobileOpened ? 'Close sidebar' : 'Open sidebar'}
              />


              <Burger
                opened={desktopOpened}
                onClick={toggleDesktop}
                visibleFrom="sm"
                size="sm"
                aria-label={desktopOpened ? 'Collapse sidebar' : 'Expand sidebar'}
                title={desktopOpened ? 'Collapse sidebar' : 'Expand sidebar'}
              />

            <p>Hello this is where logo go!!</p>
          </Group>
          <Group>
            <DiscordButton />
            <SchemeToggleButton />
            <AccountDropDown />
          </Group>
        </Group>
      </AppShell.Header>

      {/* IMPORTANT: Only AppShell slot children go here */}
      <SiteNavbar desktopOpened={desktopOpened} onToggleDesktop={toggleDesktop} />

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer zIndex={mobileOpened ? 'auto' : 201}>
        This is the footer
      </AppShell.Footer>
    </AppShell>
  );
}
