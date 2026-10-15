---
id: c16304dd-9e77-4f07-9717-5ea835962aa8
name: flow_for_forwarding_pipeline_callbacks
when: a callback only forwards its argument through a pipe of transformations.
mime: [text/typescript, text/tsx]
---
When a callback only forwards its argument through a pipe of transformations, use flow to compose the callback directly: Effect.map(flow(Array.findFirst(predicate), Option.getOrUndefined)), not Effect.map((files) => pipe(files, Array.findFirst(predicate), Option.getOrUndefined)). Keep a callback when it needs additional logic or argument handling that flow would not preserve.
