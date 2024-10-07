# buni

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

Set secrets at https://fly.io/apps/buni/secrets

## About this app

/src - Regular code, executed by our server
/app - Code that is dynamically parsed and run by Bun
/dist - Where Bun puts the code before running it
/codegen - Stores components that are generated by LLM. Syncs with Fly.io volume

compileReact takes in code as a string, and generates a single file HTML component for it.

## Principles

- Fast: Minimize latency, fast feedback loops rule the world
- Simple: Use clear primitives that are easy to understand, for humans and LLMs
- Open: Everything is visible, scrapeable, forkable, interoperable, exportable
- Debuggable: When something goes wrong, make it easy to see
- Interop: Leverage existing best-in-class tools (React, bun), libraries (npm), workflows (git, Cursor)

## TODO

### Next big milestones

- [x] Share components
- [x] Store component metadata (in sqlite?)
- [x] Versioning, history
- [x] Show chat history somewhere
- [x] Import other NPM modules?

### Farther out

- [x] Figure out streaming?
- [x] Get to bootstrapped
- [x] Browse through code?
- Auth for users
  - [x] Implement via AuthJS?
  - how does permissioning work...???
- Pass more context to Claude
  - Internal APIs
  - NPM packages
  - External APIs
  - Docs, sites, other context, ala Cursor
  - Other generated code
  - Image context for Claude?
  - Longterm planning, readme/knowledge.md?
- gitlike version control? and pinning versions?
  - Could literally back each app with git; each request is a new commit, behind the scenes
- API/LLM capabilities
- Figure out story for testing non-UI (eg prompts)
- Shared global database that Claude can introspect
  - Dashboard like https://libsqlstudio.com/?
  - Or get buni to build our own >.>
- Mobile view? (maybe the apps are mobile by default cuz screen)
- Social: really good database
- Testing: take being a platform seriously?

### Quick wins to try

- Suggest changes to the app (eg 1 whimsical, 1 layout, 1 fundamental)
- Export app to single HTML to self-host?
- Instead of having a UI toolbar, ask Claude to do stuff like "export"?
  - Kind of like "--help" in a CLI
  - E.g. delete app, publish, etc?
- Build out chat, comments
- Store this README directly inside Buni
- Add in a decent UI library (ShadCN?)
- Native Discord integration for game gen
  - https://discord.com/developers/docs/activities/overview#embedded-app-sdk
- Speed up long file diffs by not rewriting the whole thing?
- Generate a bunch of app prompts via Claude, then build them all
  - Or fill out the app ecosystem/Twitterlike with Claude...

### Medium term roadmap (?)

- Month 1: Platform, editor
- Month 2: Agent infra, integrations
- Month 3: Economics, community/governance?

### Test apps

- [x] "Twitter for apps"?
  - Make easy to fetch context from other files or examples (like cursor @)
  - Expand developer box
  - Refresh button to clear react state
  - app_name should be short by default
- [x] "Peek AI"
  - random things are hard (like iframe crossorigin stuff)
  - show logs somewhere in editor, without opening chrome inspector?
    - Or, just tell people about inspector for now.
    - Though would be good to pipe back into chat. Also esp server logs.
- Comments, chat <- tests DB, also realtime streaming?
- Dalle <- tests external API
- Bug tracker...

Prompts from people:

- "Can you build me a Slack-like interface, with a sidebar of different chats. One of the chats should be "investigations", which shows a graph data UI using react-flow"
- "App that let's people put their thumb in a screen, and then after 5 seconds selects one at random, like chwazi"

### Misc TODOs

- [x] Set up functional editor page
- [x] For resolving files, maybe overwrite with a plugin?
  - Seems like it would work: https://bun.sh/docs/runtime/plugins#loaders, also https://esbuild.github.io/plugins/#using-plugins
- [x] Try importing a standard React component eg monaco-editor for editor.tsx
- [x] Set up editor to dynamically load, eg /app/counter/editor (or maybe /app/editor/counter)
- [x] Generate code from Claude Sonnet
- [x] Store code in sqlite db
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
  - Importing NPM packages:
    - Sketch 1: Mark external imports, rewrite on the fly via plugin
    - Sketch 2: Use virtual modules? https://bun.sh/docs/runtime/plugins#virtual-modules
    - Sketch 3: Just throw in like 10 common deps into this project
    - Sketch 4: Try to hook into bun's default/happy import path for when an import isn't found locally
      - 4.1: Fork bun?
    - Sketch 5: Use https://esm.sh/
      - Though React is a bugbear >.>

## Dev notes

### 2024-07-20 Learnings on hosting

- Fly has Volumes for local persistent storage and LiteFS for distributing SQLite
  - To use the push/pull commands, sometimes need to bring up app by going to https://buni.fly.dev/; otherwise the app gets stopped for some reason?
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
