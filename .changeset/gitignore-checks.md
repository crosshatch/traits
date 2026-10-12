---
"traits": patch
---

Exclude Git-ignored files by default, refreshing ignore rules on each check.
Untracked files do not need to be added to Git to be evaluated. Already-tracked
files remain eligible even if ignore rules match them. Set excludeGitignored:
false to opt out.
