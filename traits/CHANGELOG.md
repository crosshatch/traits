# traits

## 0.5.1

### Patch Changes

- [#22](https://github.com/crosshatch/traits/pull/22)
  [`efd68c2`](https://github.com/crosshatch/traits/commit/efd68c29c9b67a5a7f331980f5fcc66f5c54f1d7) -
  Install checkout dependencies before starting the CLI and support targeted
  `traits-ignore-file` exceptions during file reviews.

- [#17](https://github.com/crosshatch/traits/pull/17)
  [`e331b3a`](https://github.com/crosshatch/traits/commit/e331b3abe41eb3bf6077f6f3d0b7cace2dc34290) -
  Remove the init command in favor of agent-guided setup. The setup prompt
  points to a canonical guide covering consumer-specific package-manager
  configuration, provider selection, agent-specific skill placement, and MCP
  connection.

## 0.5.0

### Minor Changes

- [#11](https://github.com/crosshatch/traits/pull/11)
  [`3af6084`](https://github.com/crosshatch/traits/commit/3af60845210600bc9ea31c7d9a40b6305c4c84f7) -
  Initial release of the Traits MCP server, SDK, and init CLI.

### Patch Changes

- [#13](https://github.com/crosshatch/traits/pull/13)
  [`3516acd`](https://github.com/crosshatch/traits/commit/3516acdec2be9be9d0cccd8cd53c976fc90abc1d) -
  Exclude Git-ignored files by default, refreshing ignore rules on each check.
  Untracked files do not need to be added to Git to be evaluated.
  Already-tracked files remain eligible even if ignore rules match them. Set
  excludeGitignored: false to opt out.

- [#13](https://github.com/crosshatch/traits/pull/13)
  [`3516acd`](https://github.com/crosshatch/traits/commit/3516acdec2be9be9d0cccd8cd53c976fc90abc1d) -
  Keep init focused on creating configuration and print explicit skill
  installation instructions for native pnpm support and cross-agent installers.
  Stop copying a potentially stale skill snapshot automatically; existing files
  remain untouched.
