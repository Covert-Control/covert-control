import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AGE_GATE_VERSION } from '../constants/ageGate';
import { useAgeGateStore, isAgeGateAccepted } from '../stores/ageGateStore';

export function useAgeGate(uid: string | null) {
  const hasHydrated = useAgeGateStore((s) => s.hasHydrated);
  const rememberedVersion = useAgeGateStore((s) => s.rememberedVersion);
  const sessionVersion = useAgeGateStore((s) => s.sessionVersion);
  const acceptLocal = useAgeGateStore((s) => s.accept);
  const acceptSessionOnly = useAgeGateStore((s) => s.acceptSessionOnly);

  const localAccepted = useMemo(
    () => isAgeGateAccepted(rememberedVersion, sessionVersion),
    [rememberedVersion, sessionVersion]
  );

  // If not locally accepted and logged in, check user doc for ack version
  const serverAck = useQuery({
    queryKey: ['adultAck', uid, AGE_GATE_VERSION],
    enabled: !!uid && hasHydrated && !localAccepted,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', uid!));
      if (!snap.exists()) return false;
      const d = snap.data() as any;
      return d.adultAcknowledgedVersion === AGE_GATE_VERSION;
    },
  });

  // If server says accepted, set session accepted to stop future reads this session
  useEffect(() => {
    if (serverAck.data === true) acceptSessionOnly();
  }, [serverAck.data, acceptSessionOnly]);

  const accepted = localAccepted || serverAck.data === true;

  const isReady = useMemo(() => {
    if (!hasHydrated) return false;
    if (localAccepted) return true;
    if (!uid) return true; // anonymous + no local accept => show gate immediately
    return !serverAck.isLoading; // logged-in: wait for server check if needed
  }, [hasHydrated, localAccepted, uid, serverAck.isLoading]);

  async function accept(opts: { remember: boolean }) {
    // Always allow immediately
    acceptLocal(opts.remember);

    // If logged in, persist to Firestore so other devices skip the gate
    if (uid) {
      await setDoc(
        doc(db, 'users', uid),
        {
          adultAcknowledgedAt: serverTimestamp(),
          adultAcknowledgedVersion: AGE_GATE_VERSION,
        },
        { merge: true }
      );
    }
  }

  return { isReady, accepted, accept, error: serverAck.error };
}
