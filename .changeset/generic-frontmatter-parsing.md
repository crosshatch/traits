---
"traits": patch
---

Extract generic schema-driven YAML envelope parsing and serialization into
_util/Frontmatter. Parsing requires `{ text, path }` and preserves schema
decoding services. Trait.parse now requires a diagnostic path; document errors
use generic MissingFrontmatterError, UnterminatedFrontmatterError, and
InvalidYamlError tags.
