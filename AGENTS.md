# Rules for agents

## Stack

- Vite 8, React 19, TypeScript 6, Zustand, 7.css.
- Package manager: `corepack pnpm@11.5.0`. Bare `pnpm` does not work on this Mac.
- Import from `src` with the `@/` alias.

## Rules

- Keep the bundle small. Do not add a dependency without a clear need.
- Read asset paths only from `src/assets.ts`. Do not write asset paths in components.
- Put Windows 7 chrome inside an element with the class `win7`. The 7.css styles apply only there.
- Load each app with `React.lazy`, so the first load stays small.
- Do not add code comments unless the code cannot explain itself.
- Do not commit test files.
- Do not push. The orchestrator merges and pushes.

## Writing

All prose in this repo uses ASD-STE100 Simplified Technical English:

- Short sentences. Active voice. Simple present.
- No em dashes, no semicolons, no contractions.
- Use "can", "must" and "will" only. Do not use "should", "may" or "might".

## Check

```sh
corepack pnpm@11.5.0 build
```
