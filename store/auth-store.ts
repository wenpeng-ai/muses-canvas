"use client";

import { create } from "zustand";
import { fetchLocalProfile } from "@/lib/profile/api";
import type { User } from "@/lib/supabase/types";

export type LoginModalReason = "default" | "guest_premium" | "guest_limit";

type LocalUser = {
  id: string;
  email: string;
};

interface AuthState {
  user: LocalUser | null;
  session: null;
  profile: User | null;
  isLoading: boolean;
  isLoginModalOpen: boolean;
  loginModalReason: LoginModalReason;
  setUser: (user: LocalUser | null) => void;
  setSession: (session: null) => void;
  setProfile: (profile: User | null) => void;
  setLoading: (loading: boolean) => void;
  openLoginModal: (reason?: LoginModalReason) => void;
  closeLoginModal: () => void;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
}

const defaultProfile: User = {
  id: "local-workspace-user",
  email: "",
  name: "Local Workspace",
  plan: "ultimate",
  credits: 0,
  monthly_quota: 0,
  credits_reset_at: new Date(0).toISOString(),
  creem_customer_id: null,
  creem_customer_email: null,
  creem_subscription_id: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: defaultProfile.id,
    email: defaultProfile.email,
  },
  session: null,
  profile: defaultProfile,
  isLoading: false,
  isLoginModalOpen: false,
  loginModalReason: "default",
  setUser: (user) => set({ user }),
  setSession: () => undefined,
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ isLoading: loading }),
  openLoginModal: (reason = "default") =>
    set({ isLoginModalOpen: true, loginModalReason: reason }),
  closeLoginModal: () =>
    set({ isLoginModalOpen: false, loginModalReason: "default" }),
  signOut: async () => undefined,
  fetchProfile: async () => {
    try {
      const profile = await fetchLocalProfile();

      if (profile) {
        set({
          user: {
            id: profile.id,
            email: profile.email,
          },
          profile,
        });
      }
    } catch {
      set({
        user: {
          id: defaultProfile.id,
          email: defaultProfile.email,
        },
        profile: defaultProfile,
      });
    }
  },
}));
