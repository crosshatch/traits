---
id: 04aad068-1367-47c8-a262-64beb708512b
name: direct_schema_construction_with_explicit_ids
---
Construct domain records directly with their schema constructors instead of adding a wrapper whose only behavior is generating an identifier and forwarding fields. Generate new IDs explicitly at actual creation sites, and preserve existing IDs when constructing updates or migrating records.