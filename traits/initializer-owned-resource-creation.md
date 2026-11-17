---
name: initializer-owned-resource-creation
subject: Access to resources whose initialization contract permits creation when absent.
assertion: Let the owning initializer create absent resources and expose the
  normal empty state where applicable, rather than adding existence prechecks
  and missing-resource errors for that valid initial state. For
  filesystem-backed resources, keep required parent-directory creation in the
  initializer.
purpose: Avoid redundant missing-resource handling and centralize first-use setup.
---

Violation: creating a parent directory before calling a writer that already creates it, such as `yield* fs.makeDirectory(cacheDirectory, { recursive: true })` followed by `yield* JsonFile.write(indexFile, text)` when `JsonFile.write` makes its file's directory itself; drop the caller's `makeDirectory`.

Not a violation: a read that returns the empty state when its file does not exist yet, such as `if (!(yield* fs.exists(indexFile))) { return [] }`. The rule targets failing on absence, or checking for it before an initializer that would create the resource.
