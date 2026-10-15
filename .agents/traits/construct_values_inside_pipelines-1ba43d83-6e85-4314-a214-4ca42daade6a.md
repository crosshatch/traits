---
id: 1ba43d83-6e85-4314-a214-4ca42daade6a
name: construct_values_inside_pipelines
when: constructing a final value from a transformation pipeline.
mime: [text/typescript, text/tsx]
---
Keep final value construction inside a transformation pipeline rather than wrapping the pipeline in a constructor call: use pipe(values, transform, (items) => new Set(items)), not new Set(pipe(values, transform)). This also applies to other constructors when the construction is the final transformation.
