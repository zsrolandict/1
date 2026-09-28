import { z } from 'zod';

/** Zod → tiszta JSON-séma (meta-mezők és a JS egész-határok nélkül) az AI-szolgáltatóknak. */
export function toJsonSchema(schema: z.ZodType): unknown {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '$schema') continue;
      if ((k === 'minimum' || k === 'maximum') && Math.abs(v as number) >= Number.MAX_SAFE_INTEGER) continue;
      out[k] = strip(v);
    }
    return out;
  };
  return strip(z.toJSONSchema(schema));
}
