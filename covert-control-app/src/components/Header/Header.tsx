import { Link } from '@tanstack/react-router'
import { auth } from '../../config/firebase';
import { useDisclosure } from '@mantine/hooks';
import SchemeToggleButton from '../SchemeToggleButton.tsx';
import DiscordButton from '../DiscordButton.tsx';
import { AppShell, Burger, Group } from '@mantine/core';
import { LogIn, LogOut } from 'lucide-react';

export default function Header() {
  const [opened, { toggle }] = useDisclosure();
  return (
    <AppShell.Header>
        <Group h="100%" px="md">
        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        <p>Hello this is where logo go!!</p>
        <DiscordButton />
        <SchemeToggleButton />
        <div>

        {auth.currentUser === null ? 
        <Link to="/authentication" className={classes.link} >
            <LogIn className={classes.linkIcon}  />
            <span>Login</span>
        </Link> :
        <a href="#" className={classes.link} onClick={logOut}>
            <LogOut className={classes.linkIcon}  />
            <span>Logout</span>
        </a>
        }
        </div>
        </Group>
    </AppShell.Header>
  );
}