'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Ki használja a programot (az órarögzítéshez). Bejelentkezéssel a
 * Supabase-profil neve jön automatikusan (lásd SupabaseIdentity); anélkül
 * (fejlesztői gép, előnézet) a felhasználó egyszer megadja a nevét, és ez
 * ebben a böngészőben megmarad.
 */

export type WorkRole = 'PARTNER' | 'SENIOR' | 'JUNIOR';

export interface Identity {
  name: string | null;
  role: WorkRole | null;
  /** 'login': bejelentkezett felhasználó (nem írható át); 'local': a böngészőben megadott név. */
  source: 'login' | 'local';
  loading: boolean;
  setLocalName?: (name: string) => void;
}

const LOCAL_KEY = 'ict-hc:me:v1';

function readLocal(): string | null {
  try {
    const v = localStorage.getItem(LOCAL_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

const Ctx = createContext<Identity | null>(null);

export const IdentityProvider = Ctx.Provider;

/** Bejelentkezés nélküli azonosítás: a böngészőben tárolt név. */
function useLocalIdentity(): Identity {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setName(readLocal());
    setLoading(false);
  }, []);
  const setLocalName = useCallback((n: string) => {
    const v = n.trim();
    try {
      localStorage.setItem(LOCAL_KEY, v);
    } catch {
      /* ignore */
    }
    setName(v || null);
  }, []);
  return { name, role: null, source: 'local', loading, setLocalName };
}

export function useIdentity(): Identity {
  const provided = useContext(Ctx);
  const local = useLocalIdentity();
  return provided ?? local;
}
