# @traits/opencode

An OpenCode plugin that reminds the agent to turn reusable user feedback into
Traits proposals and obtain approval through the client's own prompting UI.

Configure it in `opencode.json`:

```json
{
  "plugins": ["@traits/opencode"]
}
```

Configure the Traits MCP server separately using the
[setup guide](https://github.com/crosshatch/traits/blob/main/SETUP.md). The
plugin adds a reminder before primary model requests; it does not force tool
calls or save traits itself.

This repository loads `./packages/@traits/opencode` from its OpenCode config for
local development. Workspace exports use the TypeScript source; published
exports use the compiled `dist/index.js` entry point. OpenCode supplies the
plugin runtime dependencies. The named `opencode` catalog pins the SDK and its
matching Effect version together: mixing versions can break Effect's runtime
identity and TypeScript types. These pins are independent of the core Traits
package's Effect version.
