---
id: d3134329-b4ed-4a81-91e3-cfc9035d4a8a
name: align_operation_module_and_export_names
activation: When naming or renaming an operation-focused module and its primary export.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
---
For operation-focused modules, keep the filename and primary export aligned with the operation's canonical name. When improving that name, rename the file and export together and update consumers to import it directly, rather than retaining the old source name behind an import alias.
