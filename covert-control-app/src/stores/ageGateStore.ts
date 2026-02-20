import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AGE_GATE_VERSION } from '../constants/ageGate';

type AgeGateState = {
  // Persisted (Remember me)
  rememberedVersion: string | null;

  // Not persisted (this tab/session)
  sessionVersion: string | null;

  // Persist hydration flag (prevents flicker)
  hasHydrated: boolean;

  accept: (remember: boolean) => void;
  acceptSessionOnly: () => void;
  clear: () => void;

  _setHydrated: (v: boolean) => void;
};

export const useAgeGateStore = create<AgeGateState>()(
  persist(
    (set) => ({
      rememberedVersion: null,
      sessionVersion: null,
      hasHydrated: false,

      accept: (remember) => {
        set({ sessionVersion: AGE_GATE_VERSION });
        if (remember) set({ rememberedVersion: AGE_GATE_VERSION });
      },

      acceptSessionOnly: () => set({ sessionVersion: AGE_GATE_VERSION }),

      clear: () => set({ rememberedVersion: null, sessionVersion: null }),

      _setHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'cc-age-gate',
      storage: createJSONStorage(() => localStorage),
      // Only persist the remembered version
      partialize: (s) => ({ rememberedVersion: s.rememberedVersion }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    }
  )
);

// helper (optional)
export function isAgeGateAccepted(rememberedVersion: string | null, sessionVersion: string | null) {
  return rememberedVersion === AGE_GATE_VERSION || sessionVersion === AGE_GATE_VERSION;
}
