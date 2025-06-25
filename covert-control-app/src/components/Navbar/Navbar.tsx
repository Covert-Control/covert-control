import { AppShell, Code, Group, ScrollArea } from '@mantine/core';
// Update the import path if the file is named or located differently, for example:
import { LinksGroup } from '../NavbarLinksGroup/NavbarLinksGroup'; // <-- Update this path if needed
import { UserButton } from '../UserButton/UserButton';
import { Link } from '@tanstack/react-router'
import classes from './Navbar.module.css';
import { LogOut, LogIn } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { PencilLine, Library, House } from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.FC<any>;
  link?: string;             // ← for single-link entries
  initiallyOpened?: boolean; // ← for groups
  links?: { label: string; link: string }[];
}

const linkdata: NavItem[] = [
  { label: 'Home', icon: House, link: '/' },
  {
    label: 'Stories',
    icon: Library,
    initiallyOpened: false,
    links: [
      { label: 'Most Recent', link: '/stories' },
      { label: 'Advanced Search', link: '/advanced-search' },
      { label: 'Authors', link: '/authors' },
    ],
  },
  { label: 'Submit Story', icon: PencilLine, link: '/submit' },
];

export default function Navbar() {

    const logOut = async () => {
        try {
            await signOut(auth) 
        } catch (err) {
            console.error(err);
        }
    }

  const links = linkdata.map((item) => <LinksGroup {...item} key={item.label} />);

  return (
    <AppShell.Navbar >

        <nav className={classes.navbar}>
        <ScrollArea className={classes.links}>
            <div className={classes.linksInner}>{links}</div>
        </ScrollArea>

        {/* Navbar
        <Link to="/">Home!</Link>
        <Link to="/about">About</Link>
        <Link to="/stories">Stories</Link>
        <Link to="/submit">Submit Story</Link>
        <Link to="/authentication">Login</Link> */}
        
        {/* {Array(15)
        .fill(0)
        .map((_, index) => (
            <Skeleton key={index} h={28} mt="sm" animate={false} />
        ))} */}
        
        <div className={classes.footer}>

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
        </nav>
    </AppShell.Navbar>
  );
}


