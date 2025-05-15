import * as React from 'react';
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { AppShell, Burger, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import SchemeToggleButton from '../components/SchemeToggleButton.tsx';
import DiscordButton from '../components/DiscordButton.tsx';
import Navbar from '../components/Navbar/Navbar.tsx';


export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const [opened, { toggle }] = useDisclosure();

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
