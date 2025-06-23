import * as React from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useAuthStore } from '../stores/authStore'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { AppShell, Burger, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import SchemeToggleButton from '../components/SchemeToggleButton.tsx';
import DiscordButton from '../components/DiscordButton.tsx';
import Navbar from '../components/Navbar/Navbar.tsx';
import { useEffect } from 'react';
import { auth } from '../config/firebase.tsx';

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const [opened, { toggle }] = useDisclosure();
  const { setUser, setLoading } = useAuthStore();
  
  useEffect(() => {
    const auth = getAuth();
    setLoading(true);
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user || null);
    });

    return unsubscribe;
  }, [setUser, setLoading]);

  return (
    <React.Fragment>
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 150, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <p>Hello this is where logo go!!</p>
            <DiscordButton />
            <SchemeToggleButton />
            <div>
              {auth.currentUser === null ? 
              <Link to="/authentication">
                  <span>Login</span>
              </Link> :
              <a href="#" >
                  <span>Logout</span>
              </a>
              }
            </div>
          </Group>
        </AppShell.Header>

        <Navbar />

        <AppShell.Main>
          <Outlet />
        </AppShell.Main>

        <AppShell.Footer zIndex={opened ? 'auto' : 201}>
          This is the footer
        </AppShell.Footer>
      </AppShell>
    </React.Fragment>
  )
}
