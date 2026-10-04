"use client";

import { useCallback, useSyncExternalStore } from "react";

interface StoredProfile {
  profileId: string;
  codeforcesUsername?: string;
  leetcodeUsername?: string;
  lastAnalyzed: string;
}

const STORAGE_KEY = "algograph-profile";

let cache: { raw: string | null; parsed: StoredProfile | null } = {
  raw: null,
  parsed: null,
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): StoredProfile | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cache.raw) return cache.parsed;
  try {
    cache = { raw, parsed: raw ? JSON.parse(raw) : null };
  } catch {
    cache = { raw, parsed: null };
  }
  return cache.parsed;
}

function getServerSnapshot(): StoredProfile | null {
  return null;
}

export function useProfile() {
  const profile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const saveProfile = useCallback((data: StoredProfile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    cache = { raw: JSON.stringify(data), parsed: data };
    window.dispatchEvent(new Event("storage"));
  }, []);

  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    cache = { raw: null, parsed: null };
    window.dispatchEvent(new Event("storage"));
  }, []);

  return { profile, saveProfile, clearProfile };
}

export function getStoredProfile(): StoredProfile | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}