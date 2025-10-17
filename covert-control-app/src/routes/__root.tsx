import * as React from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { AppShell, Burger, Group, Skeleton, Title, ActionIcon } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import SchemeToggleButton from '../components/SchemeToggleButton.tsx';
import DiscordButton from '../components/DiscordButton.tsx';
import Navbar from '../components/Navbar/Navbar.tsx';
import { AccountDropDown } from '../components/AccountDropDown.tsx';
import { useEffect } from 'react';
import { auth, db } from '../config/firebase.tsx';
import { SetUsernamePage } from '../components/SetUsernamePage.tsx';
import { useAuthListener } from '../hooks/useAuthListener';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  useAuthListener(); 

  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const { user, isProfileComplete, loading } = useAuthStore();

  const HEADER_HEIGHT = 60;   // you already use header={{ height: 60 }}
  const NAV_WIDTH = 190;   
  const isDesktop = useMediaQuery('(min-width: 48em)'); 
  const opened = isDesktop ? desktopOpened : mobileOpened;
  const handleClick = isDesktop ? toggleDesktop : toggleMobile;
  const buttonLeft = opened ? NAV_WIDTH : 0;
  
  // Conditional Rendering based on authentication and profile state
  if (loading) {
    // Show a full-screen loading indicator while checking auth and profile
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

  if (user && isProfileComplete === false) { // Use 'user' from store
    // Force them to the SetUsernamePage. This page will take over the entire content area.
    return <SetUsernamePage />;
  }


  return (
    <React.Fragment>
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 190, breakpoint: 'sm', collapsed: { mobile: !mobileOpened, desktop: !desktopOpened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            {/* Left-aligned items */}
            <Group>
              <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
              <Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="sm" size="sm" />
              <p>Hello this is where logo go!!</p>
            </Group>

            {/* Right-aligned items */}
            <Group>
              <DiscordButton />
              <SchemeToggleButton />
              <div>
                  <AccountDropDown />
              </div>
            </Group>
          </Group>
        </AppShell.Header>

        <Navbar desktopOpened={desktopOpened} onToggleDesktop={toggleDesktop} />
        <ActionIcon
          aria-label={opened ? 'Collapse sidebar' : 'Expand sidebar'}
          title={opened ? 'Collapse sidebar' : 'Expand sidebar'}
          onClick={handleClick}
          variant="default"
          radius="xl"
          size="lg"
          style={{
            position: 'fixed',
            top: HEADER_HEIGHT + 8,      // sit on the header-bottom line
            left: buttonLeft,            // slide with the navbar
            transform: 'translateX(-50%)', // center the circle on the edge/line
            transition: 'left 150ms ease',
            zIndex: 1000,                // above navbar overlay
          }}
        >
          {opened ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
        </ActionIcon>

        <AppShell.Main>
          <Outlet />
        </AppShell.Main>

        <AppShell.Footer zIndex={mobileOpened ? 'auto' : 201}>
          This is the footer
        </AppShell.Footer>
      </AppShell>
    </React.Fragment>
  )
}
