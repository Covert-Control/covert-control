import { create } from 'zustand';

type UiState = {
  readerMode: boolean;
  setReaderMode: (value: boolean) => void;
  toggleReaderMode: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  readerMode: false,
  setReaderMode: (value) => set({ readerMode: value }),
  toggleReaderMode: () => set((s) => ({ readerMode: !s.readerMode })),
}));
