---
"@traits/opencode": patch
---

Accept compatible Effect versions in the published plugin peer dependency while
keeping its development runtime pinned to the OpenCode SDK's version. This lets
the plugin install alongside Traits without conflicting Effect peer
requirements.
