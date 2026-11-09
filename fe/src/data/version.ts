import { create } from "zustand";

type DataVersionState = {
	version: number;
	bump: () => void;
};

/** Dinaikkan setiap kali provider lokal menulis, supaya query memuat ulang. */
export const useDataVersion = create<DataVersionState>((set) => ({
	version: 0,
	bump: () => set((state) => ({ version: state.version + 1 })),
}));

export function bumpDataVersion(): void {
	useDataVersion.getState().bump();
}
