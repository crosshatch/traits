---
id: 65b7f131-4429-4328-8c70-935360bebec1
name: inline-guaranteed-react-root-lookup
when: mounting a React client into an application-owned HTML root element.
mime: [text/tsx, text/jsx, text/html]
skip: When the DOM elements under assessment are not guaranteed to exist by application-owned HTML and therefore require null handling.
---
In a React client entry point, when the application-owned HTML guarantees the root element exists, inline its lookup into createRoot and use a non-null assertion: createRoot(document.getElementById("root")!).render(...). Keep the matching root element in the HTML; retain null handling for DOM elements whose presence is not guaranteed.
