// e.g. src/components/AdminStatusDebug.tsx

import { useEffect, useState } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { auth } from '../config/firebase'; // adjust path if needed

export function AdminStatusDebug() {
  const [loading, setLoading] = useState(true);
  const [emailOrUid, setEmailOrUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setEmailOrUid(null);
        setIsAdmin(null);
        setLoading(false);
        return;
      }

      // Refresh token to make sure we get the latest claims
      const tokenResult = await getIdTokenResult(user, true);
      const adminFlag = !!tokenResult.claims.isAdmin;

      setEmailOrUid(user.email ?? user.uid);
      setIsAdmin(adminFlag);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Checking admin status…</div>;
  }

  if (!emailOrUid) {
    return <div>You are not logged in.</div>;
  }

  return (
    <div>
      Hello {emailOrUid}. Your admin status is: <strong>{String(isAdmin)}</strong>
    </div>
  );
}
