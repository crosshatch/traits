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

OpenCode supplies the plugin's runtime dependencies. When installing alongside
Traits, keep the project's compatible Effect version: the plugin's Effect peer
range accepts `^4.1.0`, including versions satisfying Traits' `^4.1.4` requirement.
