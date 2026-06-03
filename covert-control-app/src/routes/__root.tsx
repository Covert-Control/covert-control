// __root.tsx
import * as React from 'react';
import { AppShell, Burger, Group, Box, Loader, Center, Text, } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, createRootRoute, useMatchRoute, Link, useRouterState } from '@tanstack/react-router';
import SchemeToggleButton from '../components/SchemeToggleButton.tsx';
import DiscordButton from '../components/DiscordButton.tsx';
import SiteNavbar from '../components/Navbar/Navbar.tsx'; 
import { AccountDropDown } from '../components/AccountDropDown.tsx';
import { useAuthStore } from '../stores/authStore';
import { SetUsernamePage } from '../components/SetUsernamePage.tsx';
import { useAuthListener } from '../hooks/useAuthListener';
import SiteLogo from '../assets/logo.png';
import { AdminMailbox } from '../components/AdminMailbox';
import { useUiStore } from '../stores/uiStore';
import SiteFooter from '../components/SiteFooter';
import { useAgeGate } from '../hooks/useAgeGate';
import { AgeGateScreen } from '../components/AgeGateScreen';
import { EmailVerificationBanner } from '../components/VerifyEmailBanner.tsx';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useAuthListener();

  const [mobileOpened, mobileHandlers] = useDisclosure();
  const { toggle: toggleMobile, close: closeMobile } = mobileHandlers;

  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

  const user = useAuthStore((s) => s.user);
  const isProfileComplete = useAuthStore((s) => s.isProfileComplete);
  const loading = useAuthStore((s) => s.loading);

  // ✅ Age gate (Zustand-backed hook)
  const uid = user?.uid ?? null;
  const { isReady: ageReady, accepted: ageAccepted, accept: acceptAgeGate } = useAgeGate(uid);

  const matchRoute = useMatchRoute();
  const isStoryReaderRoute = !!matchRoute({ to: '/stories/$storyId', fuzzy: true });

  const readerMode = useUiStore((s) => s.readerMode);
  const effectiveReaderMode = isStoryReaderRoute && readerMode;

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  React.useEffect(() => {
    closeMobile();
    document.title = 'Covert Control';
  }, [pathname, closeMobile]);

  // 1) Auth boot/loading (don’t render site content yet)
  if (loading) {
    return (
      <>
        <Center h="100vh">
          <Loader />
        </Center>
      </>
    );
  }

  // 2) Force profile completion before anything else
  if (user && isProfileComplete === false) {
    return (
      <>
        <SetUsernamePage />
      </>
    );
  }

  // 3) Age gate (site-wide)
  if (!ageReady) {
    return (
      <>
        <Center h="100vh">
          <Loader />
        </Center>
      </>
    );
  }

  if (!ageAccepted) {
    return (
      <>
        <AgeGateScreen onAccept={acceptAgeGate} />
      </>
    );
  }

  // 4) ✅ Normal app shell
  return (
    <>
      
      <AppShell
        zIndex={100}
        header={{ height: 60, collapsed: effectiveReaderMode }}
        navbar={{
          width: 190,
          breakpoint: 'sm',
          collapsed: {
            mobile: effectiveReaderMode ? true : !mobileOpened,
            desktop: effectiveReaderMode ? true : !desktopOpened,
          },
        }}
        footer={{ height: 40, collapsed: effectiveReaderMode }}
        padding={effectiveReaderMode ? 0 : { base: 'xs', sm: 'md' }}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
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

              <Box
                component={Link}
                to="/"
                onClick={() => {
                  if (mobileOpened) closeMobile();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  lineHeight: 0,
                  textDecoration: 'none',
                }}
                aria-label="Go to home"
              >
                <img
                  src={SiteLogo}
                  alt="Covert Control"
                  style={{ height: 40, width: 'auto', display: 'block' }}
                />
              </Box>

              <Group gap={4} visibleFrom="sm">
                <Text
                  fw={800}
                  size="lg"
                  style={{
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                  }}
                >
                  COVERT CONTROL
                </Text>

                <Text
                  size="xs"
                  c="dimmed"
                  style={{
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                  }}
                >
                  EROTICA
                </Text>
              </Group>

            </Group>

            <Group>
              <AdminMailbox />
              <DiscordButton />
              <SchemeToggleButton />
              <AccountDropDown />
            </Group>
          </Group>
        </AppShell.Header>

        <SiteNavbar
          desktopOpened={desktopOpened}
          onToggleDesktop={toggleDesktop}
          onCloseMobile={closeMobile}
          mobileOpened={mobileOpened}
        />

        <AppShell.Main style={effectiveReaderMode ? { padding: 0 } : undefined}>
          {!effectiveReaderMode && <EmailVerificationBanner />}

          <Outlet />
        </AppShell.Main>

        <AppShell.Footer p={0} >
          {!effectiveReaderMode && <SiteFooter />}
        </AppShell.Footer>
      </AppShell>
    </>
  );
}
