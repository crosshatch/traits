---
name: reuse-library-environment-configuration
subject: Code that configures a third-party SDK or client (constructor options,
  CLI flags, process.env reads, or configuration parsing) where the library can
  read the same settings from environment variables or its own configuration
  API, such as SDK clients defaulting to OPENAI_API_KEY or AWS_* variables.
assertion: Prefer the library's environment-based configuration when it meets
  the integration's requirements. Do not add duplicate CLI flags, configuration
  parsing, or override-precedence logic unless a distinct requirement calls for
  them.
purpose: Keep configuration minimal and reuse the library's standard behavior
  instead of maintaining redundant configuration paths.
---
