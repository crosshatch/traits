---
id: 160eec59-5c44-4bed-b335-ee693daf0124
name: avoid-omitting-overwritten-spread-fields
---
When building an object by spreading an existing record and explicitly assigning authoritative fields afterward, do not first omit fields that those later assignments already overwrite. Keep omission or filtering when it actually prevents unwanted properties from surviving, and preserve intentional merge precedence and conditional inheritance.