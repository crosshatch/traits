---
name: align-operation-module-and-export-names
when: naming or renaming an operation-focused module and its primary export.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
---
For operation-focused modules, keep the filename and primary export aligned with the operation's canonical name. When improving that name, rename the file and export together and update consumers to import it directly, rather than retaining the old source name behind an import alias.
