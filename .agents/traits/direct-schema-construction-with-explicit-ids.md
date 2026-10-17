---
name: direct-schema-construction-with-explicit-ids
---
Construct domain records directly with their schema constructors instead of adding a wrapper whose only behavior is generating an identifier and forwarding fields. Generate new IDs explicitly at actual creation sites, and preserve existing IDs when constructing updates or migrating records.
