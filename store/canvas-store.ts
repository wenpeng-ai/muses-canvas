"use client";

import { create } from "zustand";

type CanvasStore = {
  selectedImageNodeIds: string[];
  importDialogOpen: boolean;
  croppingImageNodeId: string | null;
  setSelectedImageNodeIds: (ids: string[]) => void;
  setImportDialogOpen: (open: boolean) => void;
  setCroppingImageNodeId: (nodeId: string | null) => void;
};

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  selectedImageNodeIds: [],
  importDialogOpen: false,
  croppingImageNodeId: null,
  setSelectedImageNodeIds: (ids) =>
    set((state) =>
      areStringArraysEqual(state.selectedImageNodeIds, ids)
        ? state
        : { selectedImageNodeIds: ids },
    ),
  setImportDialogOpen: (open) =>
    set((state) => (state.importDialogOpen === open ? state : { importDialogOpen: open })),
  setCroppingImageNodeId: (nodeId) =>
    set((state) =>
      state.croppingImageNodeId === nodeId ? state : { croppingImageNodeId: nodeId },
    ),
}));
