import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type AgeGateState = {
  // Persisted if the user checked "Remember this device"
  remembered: boolean;

  // Only lasts until the tab is closed
  sessionAccepted: boolean;

  // Prevents a flash while localStorage hydrates
  hasHydrated: boolean;

  accept: (remember: boolean) => void;
  clear: () => void;

  _setHydrated: (v: boolean) => void;
};

export const useAgeGateStore = create<AgeGateState>()(
  persist(
    (set) => ({
      remembered: false,
      sessionAccepted: false,
      hasHydrated: false,

      accept: (remember) => {
        set({
          sessionAccepted: true,
          remembered: remember,
        });
      },

      clear: () =>
        set({
          remembered: false,
          sessionAccepted: false,
        }),

      _setHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'cc-age-gate',
      storage: createJSONStorage(() => localStorage),

      partialize: (s) => ({
        remembered: s.remembered,
      }),

      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    }
  )
);