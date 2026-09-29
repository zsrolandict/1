import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/** ESLint (flat config): a Next.js ajánlott szabályai + TypeScript. */
const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', 'node_modules/**', 'dist-preview/**', 'next-env.d.ts', 'public/**'],
  },
  {
    // Ismert adósság (docs/08, 2. szakasz): a munkaterületek mount után a
    // böngészős tárolóból töltenek (useEffect + setState), és a „legutóbbi
    // érték” ref-mintát használják. A közös useWorkspace hook ezeket kiváltja;
    // addig figyelmeztetés, hogy a CI ne álljon meg, de látszódjon.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
];

export default config;
