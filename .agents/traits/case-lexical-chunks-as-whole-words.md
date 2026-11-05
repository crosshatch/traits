---
name: case-lexical-chunks-as-whole-words
subject: Word chunks in project-owned identifiers and matching filenames.
requirement: Treat a lexical term as a single word chunk when composing
  identifiers, even when it is an abbreviation or conventionally has internal
  capitals. Apply PascalCase or camelCase at word-chunk boundaries instead of
  preserving special capitalization inside a chunk. For the oauth chunk, use
  OauthAttempt, OauthAttemptStatus, and oauthAttempt rather than OAuthAttempt,
  OAuthAttemptStatus, or oAuthAttempt. Use the same casing in matching
  filenames, such as OauthAttempt.ts.
applicability: Project-owned identifiers and filenames; not external API names,
  serialized schema/protocol values, or prose.
purpose: Keep compound identifier names consistently word-based rather than
  carrying special acronym capitalization.
---
