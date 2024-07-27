# buni

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

### TODO

- [x] Set up functional editor page
- [x] For resolving files, maybe overwrite with a plugin?
  - Seems like it would work: https://bun.sh/docs/runtime/plugins#loaders, also https://esbuild.github.io/plugins/#using-plugins
- [x] Try importing a standard React component eg monaco-editor for editor.tsx
- [ ] Set up editor to dynamically load, eg /app/counter/editor (or maybe /app/editor/counter)
- [ ] Generate code from Claude Sonnet
- [ ] Store code in sqlite db
- [ ] Support async components
- [ ] How should components reference external code?
  - Helper functions defined elsewhere? (Where?)
  - Other libraries? E.g. shadcn/ui
    - How to resolve imports?
    - Bundle via Bun.build()?
      - Bun.build looks set up to bundle from filesystem, but: skipping outdir might work to generate in-memory
      - Essentially: I want to replace Bun's filesystem access with SQL as a synthetic DB
        - Hm, can I actually just virtualize a filesystem for Bun to use...?
        - Or like: just actually use a real filesystem somewhere, /path/to/custom.tsx + imports
          - pros: debuggable, plugs into existing infra
          - Filesystem cons: more complex, syncing seems like a pain? code resolution annoying?
    - Or something like Bun.resolveSync
    - Or I want something like [feeding bun sourcefiles in-memory](https://github.com/oven-sh/bun/issues/5145)
    - Or: Conceptualize each Claude output as mini NPM packages?
      - See https://github.com/wobsoriano/bun-lib-starter for the format of an actual NPM package
  - External API calls?

### 2024-07-20 Learnings on hosting

- Fly has Volumes for local persistent storage and LiteFS for distributing SQLite
- Render also has [persistent disks](https://docs.render.com/disks#magic-wormhole)

### 2024-07-22 Devlog

- Build only works the first time through for some reason... https://github.com/oven-sh/bun/issues/11123

### 2024-02-27

Hard won snippets for transpilation:

```
  const transpiler = new Bun.Transpiler({
    loader: 'tsx',
    target: 'browser',
    tsconfig: {
      compilerOptions: {
        // This uses createElement instead of jsxDEV
        jsx: 'react',
      },
    },
  })
  const transpiledCode = transpiler.transformSync(componentCode)
  // Assumes that the first export is the root component
  const { exports } = transpiler.scan(componentCode)
  const rootComponent = exports[0]
```

And building with a custom plugin `buni`:

```
  // Works on first access, but not on reload??
  // Is there some kind of caching thing going on?
  const built = await Bun.build({
    entrypoints: [path],
    outdir: './dist',
    // Reroute eg @/manifold.buni to the url from getRedirect('manifold.buni')
    plugins: [buniPlugin],
  })
```
