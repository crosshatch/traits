---
name: prune-configuration
description: Audit and simplify repository configuration, package scripts, and supporting files. Use when reviewing configuration for redundant settings, duplicate scripts, unnecessary files, or accidental complexity.
---

# Prune Configuration

Keep configuration concise, deliberate, and easy to explain. Every explicit
setting, script, config file, and abstraction should serve a current purpose.
Prefer removing unnecessary configuration over explaining why it might someday
be useful.

## Principles

- Configure actual requirements, not hypothetical future needs.
- Rely on verified tool defaults when they express the intended behavior.
- Remove duplicate scripts, flags, settings, and overlapping configurations.
- Prefer one straightforward configuration over factories, custom plugins,
  generated identifiers, environment checks, and layers of indirection.
- Split configurations only when their different behavior is necessary. A
  different filename or execution command alone does not justify another file.
- Preserve meaningful boundaries, such as a published library's source-only
  build versus application tests. Concision must not change intended behavior.
- Use descriptive names that reflect purpose. Do not invent conventions and
  present them as upstream requirements.
- Do not add placeholder source files or tests merely to satisfy configuration.
- Do not compensate for unnecessary complexity with lengthy documentation.

## Audit Workflow

### 1. Establish scope and intent

Read the applicable `AGENTS.md` files and inspect the working tree before editing.
Preserve unrelated user changes.

Inventory first-party configuration and supporting files, including:

- `package.json` files, workspace catalogs, and package-manager settings.
- TypeScript configs and their project references.
- Test, build, bundler, migration, formatting, and linting configs.
- CI workflows, environment declarations, helper scripts, and documentation.

Exclude vendored repositories, dependencies, generated outputs, and build caches
from edits unless explicitly requested. Vendored code is reference material.

For each package, identify what runs where, what gets emitted or published, and
which commands users actually need. Distinguish current requirements from plans.

### 2. Trace effective configuration

Do not assess files in isolation. Follow inheritance, project references, script
delegation, environment variables, config discovery, and command-line overrides.

For every non-obvious setting, ask:

1. What behavior does this change from the installed tool's default?
2. Is that behavior required here?
3. Is it already supplied by a parent config, another setting, or the tool?
4. Which command consumes this file, and from which working directory?
5. What would break if this setting or file were removed?

If there is no concrete answer, investigate removal rather than retaining it
"just in case."

### 3. Verify defaults and conventions

Check the installed tool version's behavior, types, source, or documentation.
Do not rely on remembered defaults from another version.

When using vendored repositories as examples, choose the comparable application
or library. An upstream tool's internal monorepo test infrastructure is not
automatically appropriate for an application consuming that tool.

Preserve this project's runtime choices. For example, translate an upstream Bun
example into Node-compatible tooling instead of introducing Bun dependencies.

### 4. Simplify deliberately

#### TypeScript

- Resolve inherited relative paths from the config where they are declared.
  Do not assume a root exclusion is package-relative.
- Remember that child `include`, `exclude`, and `files` settings replace their
  inherited counterparts; they are not simply concatenated. Check the effective
  configuration before deleting an override.
- Remove exclusions that cannot match the explicit includes, unless they protect
  a real nested input such as fixtures or generated source.
- `exclude` filters discovery; it does not block imported files or declarations.
- `rootDir` controls source/output layout and constraints, not file discovery.
  Check `composite` and tool-version defaults before specifying it explicitly.
- Account for imports into composite projects: source files reached by imports
  may need explicit inclusion even when another project also checks them.
- Check whether emission-related options have an actual emitting consumer.
  A shared option can be meaningful for the library even when an app has
  `noEmit: true`.
- Keep ambient types intentional. Prefer `compilerOptions.types` over a
  redundant triple-slash declaration file.
- Consolidate configs when they check the same connected application graph and
  the separate environment check is not needed.
- Update the root reference graph when removing or renaming configs.

#### Package manifests and scripts

- Remove aliases that duplicate commands without providing a useful interface.
- Reuse lifecycle scripts directly when a separate script would run the same
  command. For example, do not duplicate `prepack` as `build:release` without a
  distinct requirement.
- Omit `--config` when the tool discovers that exact file by default.
- Keep workspace-level commands as simple, purposeful package delegations.
- Verify working-directory semantics instead of adding runtime guards around
  guarantees already provided by package scripts.
- Check dependencies against actual imports, commands, peers, and runtime use.
  A catalog entry alone does not install a dependency; an optional-looking peer
  may still be required by an adapter we use.
- Reassess package extensions and compatibility settings when upgrading the
  dependency that needed them. Do not silently suppress compatibility problems.
- Regenerate lockfiles with the package manager when dependency settings change.
  Do not manually prune generated lockfile entries.

#### Test and build configuration

- Use the simplest structure that matches the real suites. Do not add separate
  unit/integration projects to a package that only needs one suite.
- Let the test framework or deployment library own behavior it already supplies.
  Avoid reimplementing stage selection, lifecycle management, or config loading.
- Keep deployment lifecycle code in the appropriate tests or harness, rather
  than hiding it in unrelated configuration.
- Preserve intentional discovery, ordering, timeouts, live-mode selection, and
  failure behavior. Verify which settings are root-only versus project-specific.
- Do not make an empty suite pass merely to obtain a green verification result
  when the intended contract requires tests to exist.
- Never run a live deployment just to validate a configuration cleanup unless
  that deployment is part of the requested verification scope.

#### Supporting files and documentation

- Remove obsolete configs and helpers after updating their consumers.
- Search first-party files for stale filenames, paths, scripts, and examples.
- Keep cross-package guidance at the repository root; keep package-specific
  material local when it genuinely serves only that package.
- Document the resulting workflow, not the history of discarded configuration.
- Keep documented behavior aligned with actual defaults and scripts.

### 5. Validate the result

Run the smallest checks that establish the intended behavior is preserved:

- For TypeScript graph/inheritance changes, use a fresh build-mode check when
  incremental caches could obscure the result, and verify relevant emit output.
- For script or config discovery changes, confirm the command selects the
  intended configuration and suite without accidentally starting live tests.
- For publication changes, inspect a packed artifact rather than publishing.
- For dependency changes, update installation and lockfile consistency.
- For documentation-only or plainly redundant settings, avoid unnecessary tests.

Do not add implementation-mirroring tests for trivial cleanup. Once appropriate
checks pass, stop; do not broaden testing without an unresolved reason.

Report what was removed or consolidated, any deliberate settings retained, and
the checks actually performed. Distinguish successful configuration loading from
executed tests, and disclose expected empty-suite failures or upstream blockers.

## Completion Criteria

- Every remaining non-default setting has a concrete purpose.
- Scripts and configuration files do not duplicate behavior unnecessarily.
- Paths, inheritance, references, and runtime environments are understood.
- Documentation and command names match the resulting structure.
- No vendored source, unrelated work, or intended behavior was changed.
- Validation is proportionate and reported accurately.
