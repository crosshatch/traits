---
name: inline-effect-service-shapes
subject: Effect services declared with Context.Service whose shape is a
  separately declared interface or type.
assertion: When nothing besides the Context.Service declaration uses a service's
  shape, inline the shape in a class named after the service and use
  ClassName["Service"] to refer to its implementation type, instead of declaring
  a separate interface solely to name that shape. A shape that something else
  also uses, such as another service, a function's return type, or another file,
  may stay a named declaration. Uses in other files, when supplied as context,
  decide this.
purpose: Keep a service contract beside its identity without introducing
  redundant shape names.
enrichments:
  - "@traits/typescript/references"
---
```diff
-interface StoreShape { readonly load: Effect.Effect<string> }
-class Store extends Context.Service<Store, StoreShape>()("Store") {}
+class Store extends Context.Service<Store, { readonly load: Effect.Effect<string> }>()("Store") {}
+type Implementation = Store["Service"]
```
