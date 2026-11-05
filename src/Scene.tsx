// Scene.tsx — Handpan: a steel handpan in a recording studio, played with
// your hands. The scene's code loads on its own, after the home page shows.
import { lazy, Suspense } from "react";

const HandpanScene = lazy(async () => ({
  default: (await import("./handpan/HandpanScene")).HandpanScene,
}));

// Dev-only helpers. Lazy and behind a constant esbuild folds to false in
// production. Two rules: `process.env.NODE_ENV`, not `import.meta.env.DEV`;
// and write the check INSIDE the ternary — hoisted into a `const`, esbuild
// keeps the dead branch.
const DevDebug =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./handpan/DevDebug"))
    : null;

export const Scene = () => (
  <>
    <Suspense fallback={null}>
      <HandpanScene />
    </Suspense>
    {DevDebug ? (
      <Suspense fallback={null}>
        <DevDebug />
      </Suspense>
    ) : null}
  </>
);
