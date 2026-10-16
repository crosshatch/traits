---
id: 917ecf78-2651-4987-903c-95d23f39b6eb
name: fixed_error_messages_on_error_types
---
Define messages intrinsic to an error type on that error type rather than requiring callers to repeat them in constructor props. Use a class property or getter when schema encoding is unnecessary; when messages must remain in encoded tool responses, use a schema constructor default. Keep genuinely instance-specific diagnostic data in constructor fields.