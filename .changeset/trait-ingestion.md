---
"traits": patch
---

Add trait ingestion through `WritableTraitStore`, `traits add`, and
`traits pull`. Files are parsed as trait Markdown before falling back to
structured language-model extraction. Remote sources can be tracked in
`traits/_metadata.json`, including source and installed hashes for incremental
refresh and local-edit detection.

Use `traits apply`, or `add --apply` / `pull --apply`, to apply installed
traits. Configure `agent.command` and `agent.continue` in `traits/_config.json`
for headless application and version migrations. `traits update` retains its
version-migration meaning; `pull` refreshes tracked trait sources.
