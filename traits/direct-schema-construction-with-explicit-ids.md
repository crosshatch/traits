---
name: direct-schema-construction-with-explicit-ids
subject: Construction of schema-backed domain records.
assertion: Construct domain records directly with their schema constructors
  instead of adding a wrapper whose only behavior is generating a fresh
  identifier (such as a UUID, counter, or clock-derived value) and forwarding
  fields. Generate new IDs explicitly at actual creation sites, and preserve
  existing IDs when constructing updates or migrating records. A domain
  operation that enforces rules, such as validation, availability checks, or
  state transitions, and then constructs the record is itself a creation site;
  generating the ID inside it complies.
purpose: Make record construction and identity creation explicit while avoiding
  forwarding abstractions.
---
```diff
-const record = createRecord(body) // Wrapper only generates an ID and forwards fields.
+const record = Record.make({ id: newId(), body })
```

Not a violation: a test fixture builder that takes or defaults an explicit ID and fills other fields, such as `const account = (key, name = "primary") => Account.make({ id: AccountName.make(name), ... })`.

Not a violation: a domain operation that checks its rules and then constructs the record, such as `const reserve = (input, available) => { if (input.quantity > available) throw new RangeError("Unavailable"); return Reservation.make({ id: randomUUID(), ...input }) }`.
