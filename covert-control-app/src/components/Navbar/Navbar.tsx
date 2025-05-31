import { AppShell } from '@mantine/core';
import { Link } from '@tanstack/react-router'
import classes from './Navbar.module.css';
import { LogOut, LogIn } from 'lucide-react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';

export default function Navbar() {

    const logOut = async () => {
        try {
            await signOut(auth) 
        } catch (err) {
            console.error(err);
        }
    }


  return (
    <AppShell.Navbar p="md">
        Navbar
        <Link to="/">Home!</Link>
        <Link to="/about">About</Link>
        <Link to="/submit">Submit Story</Link>
        <Link to="/authentication">Login</Link>
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
    </AppShell.Navbar>
  );
}


