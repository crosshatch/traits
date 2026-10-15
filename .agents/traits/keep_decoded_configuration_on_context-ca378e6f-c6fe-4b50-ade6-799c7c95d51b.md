---
id: ca378e6f-c6fe-4b50-ade6-799c7c95d51b
name: keep_decoded_configuration_on_context
activation: When exposing decoded configuration and derived runtime values through an Effect context.
mime: [text/typescript, text/tsx]
---
When an Effect context exposes decoded configuration, keep the configuration object on the context and read unchanged settings through it rather than copying individual settings into separate context fields. Keep derived runtime values, such as normalized paths and semaphores, as separate context fields.
