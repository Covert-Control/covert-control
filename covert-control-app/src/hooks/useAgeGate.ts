import { useAgeGateStore } from '../stores/ageGateStore';

export function useAgeGate(uid: string | null) {
  const hasHydrated = useAgeGateStore((s) => s.hasHydrated);
  const remembered = useAgeGateStore((s) => s.remembered);
  const sessionAccepted = useAgeGateStore((s) => s.sessionAccepted);
  const acceptAgeGate = useAgeGateStore((s) => s.accept);

  const localAccepted = remembered || sessionAccepted;

  // console.log('[AGE GATE] Query state', {
  //   uid,
  //   hasHydrated,
  //   localAccepted,
  //   enabled: !!uid && hasHydrated && !localAccepted,
  // });

  const accepted = !!uid || localAccepted;
  
  const isReady = hasHydrated;

  function accept(opts: { remember: boolean }) {
      acceptAgeGate(opts.remember);
  }

  return {
    isReady,
    accepted,
    accept,
  };
}
