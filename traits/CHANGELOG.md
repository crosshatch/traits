# traits

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
