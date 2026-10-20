# Traits

**Reusable preferences for your AI agent.**

[![npm](https://img.shields.io/npm/v/traits?style=flat-square&color=6D5BD0&label=traits)](https://www.npmjs.com/package/traits)
[![license](https://img.shields.io/badge/license-Apache%202.0-6D5BD0?style=flat-square)](https://github.com/crosshatch/traits/blob/main/LICENSE)
[![discord](https://img.shields.io/badge/discord-join-6D5BD0?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/CSXCRUKjh9)

Traits turns feedback into preferences your agent can use across tasks and
sessions. Each trait is a Markdown file in `.agents/traits/<name>.md`:

```markdown
---
name: direct-callbacks
subject: Callbacks passed to functions.
requirement: >
  Pass compatible functions directly instead of wrapping them in forwarding
  arrows.
purpose: Expose callback behavior without redundant wrappers.
---
```

Your agent proposes traits, asks you to approve changes, and checks its work
against them through MCP. The files live in your project, so you can edit,
review, and share them with your team.

## Get started

Paste this into your agent inside your project:

```text
Set up Traits using https://github.com/crosshatch/traits/blob/main/SETUP.md.
Follow this project's conventions, ask me to choose providers and models, and
preserve existing configuration.
```

## License

[Apache-2.0](https://github.com/crosshatch/traits/blob/main/LICENSE)
