---
id: 14d57490-42e7-45f7-a6d1-423152824569
name: domain_types_for_complete_record_storage
activation: When designing or implementing storage operations that create or replace complete domain records.
mime: [text/typescript, text/tsx]
---
For storage operations that create or replace complete domain records, accept the existing domain type instead of separate per-field parameters or a manually duplicated object type. Persist the complete record without dropping optional metadata or extension fields.
