---
name: inline-effect-service-shapes
---

```diff
-interface StoreShape { readonly load: Effect.Effect<string> }
-class Store extends Context.Service<Store, StoreShape>()("Store") {}
+class Store extends Context.Service<Store, { readonly load: Effect.Effect<string> }>()("Store") {}
+type Implementation = Store["Service"]
```

---
For an Effect service whose shape exists only to support Context.Service, inline the shape in a class named after the service and use ClassName["Service"] to refer to its implementation type instead of declaring a separate interface solely to name that shape.
