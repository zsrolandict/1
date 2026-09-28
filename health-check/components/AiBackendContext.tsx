'use client';

import { createContext, useContext } from 'react';
import { serverBackend, type AiBackend } from '@/lib/ai/backend';

const Ctx = createContext<AiBackend>(serverBackend);

export const AiBackendProvider = Ctx.Provider;

export function useAiBackend(): AiBackend {
  return useContext(Ctx);
}
