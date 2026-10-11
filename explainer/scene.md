# Traits: from feedback to habit

## Deliverable and scope

A complete source brief for a **75-second Psychopomp motion-graphic explainer**,
not a Scene Program or a rendered film. Render at 1920 × 1080, 30 fps, with
spoken narration from `narration/script.json`. Follow one reusable case-guard
preference from user feedback through approval and storage to a later code
review and correction. Use the seven tabs in their displayed order: Feedback,
Draft, Compare, Approve, Save, Review, Correct.

The selected path is a distinct proposal that the user approves, followed by an
applicable finding that the agent corrects and rechecks. The first corrected
edit and the later generated edit are **different edits**; never make the first
correction silently undo itself. The film illustrates this path, not an actual
recorded tool run or measured quality improvement.

Skip initialization/provider setup, covered-rule reuse, clarification, conflict
reconciliation, Edit/Skip outcomes, inconclusive comparisons, and telemetry. The
comparison briefly names the alternate outcomes without sending packets down
them. Do not depict reconciliation as an automatic overwrite.

## Facts

- **Start:** A user asks the coding agent to use a tagged union’s built-in case
  guard rather than manually compare `_tag`.
- **Feedback hop:** The agent applies the correction to the current edit and
  identifies a preference that could apply to future code.
- **Draft hop:** The agent reads saved traits and drafts a standalone rule with
  a concrete behavior and reusable scope.
- **Compare hop:** `derive_trait` compares the proposed rule with every saved
  trait for coverage, possible clarification, and conflicts.
- **Approval hop:** The user reviews the exact proposal and explicitly approves,
  edits, or skips it; this film follows approval.
- **Save hop:** After approval, `derive_trait` saves a Markdown trait in
  `.agents/traits` and returns its ID to the agent.
- **Review hop:** After a later edit to `src/Outcome.ts`, the agent submits the
  current file to `check_traits`, and a model compares it with saved traits.
- **Correction hop:** The agent inspects the finding, confirms it applies,
  replaces the manual predicate with `Outcome.guards.Fail`, and reruns trait
  review and relevant project checks.
- **Terminal state:** The approved rule remains available in a readable file,
  and the later code has been corrected and rechecked.
- **Approval invariant:** Approval of a code fix is not approval to save a
  trait, and additions or changes to the collection need their own explicit
  approval.
- **Assessment invariant:** Model assessments are guidance, not guarantees; only
  confirmed applicable violations should be fixed.

### Source map

- `README.md`, opening paragraphs: learn from feedback, remember preferences,
  and avoid repeating the same correction.
- `README.md`, **From feedback to habit**: the seven-node Mermaid flow,
  approval, stored Markdown, the two tools, and the assessment caveat.
- `README.md`, **Start**: checkout-root context; setup is outside this film.
- `traits.sh/src/LifecycleStep.ts`: concrete actions, scope, and caveats for all
  seven hops.
- `traits.sh/src/LifecycleVisual.tsx`: chat/diff, agent draft, comparison,
  approval choices, file tree, three-rule cross-reference, and corrected code.

## Stage and visual grammar

Use a dark, quiet 2.5D stage: matte charcoal-purple background `#241d28`, matte
card faces `#302535`, warm readable text `#ece0cf`, secondary text `#b8a6b0`,
and thin inactive borders `#504052`. **Gold `#cbb078` is the one active
accent**: the packet, its immediate path, and the receiving socket. Gold means
“follow this signal,” not “the model is certainly correct.”

Do not use red. A review finding is a reason to inspect evidence, not a network
failure. Show the manual comparison with an underlined neutral annotation and an
explicit `Inspect` label. Use `−` and `+` for the diff, so meaning never depends
on color alone. Use neutral checkmarks for illustrative compliant traits and the
final `Rechecked` label, not a global “all code is safe” badge.

Use shallow extruded cards with visible but restrained depth, soft contact
shadows, and no glossy floors, ambient sparks, perpetual orbiting, or idle glow.
Text faces remain nearly front-on. Body labels should render at least 28 px and
code at least 24 px in the delivery frame; close the camera before showing a
long sentence. Do not shrink a directory tree to show full UUIDs: focus one
filename and show an explicitly illustrative `<uuid>` suffix.

### Actors: eight persistent elements

World units are arbitrary; coordinates below are `(x, y, z)`. Each card includes
its own socket and text/content layer; these are part of the actor, not extra
moving stage elements. No additional icons or animated decorations are needed.

| ID        | Kind     | Short label           | Position and role                                                                                       |
| --------- | -------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `user`    | `card`   | You                   | `(-4.5, 0, 0)`; chat input, then the approval surface.                                                  |
| `agent`   | `orb`    | Coding agent          | `(-1.5, 0, 0.3)`; the hero process, receiving corrections and orchestrating tool calls.                 |
| `tools`   | `card`   | Traits MCP tools      | `(1.5, 0, 0)`; two labeled sockets, `derive_trait` and `check_traits`, with an assessment/content area. |
| `store`   | `card`   | `.agents/traits`      | `(4.5, 0, -0.3)`; existing Markdown collection and, only after approval, the new file.                  |
| `code`    | `card`   | `src/Outcome.ts`      | `(-1.5, -2.8, 0)`; current-edit diff, later-edit snippet, and corrected result.                         |
| `route`   | `beam`   | Active connection     | One reusable beam between named actor sockets, including the reverse direction for replies.             |
| `signal`  | `packet` | Active request/result | One reusable packet instance carrying the currently identified payload.                                 |
| `caption` | `label`  | State caption         | Screen-safe lower-left label for Draft, Not saved, Saved, Inspect, and Rechecked states.                |

All five actor bodies exist matte at time zero, with `code` initially showing
`Current edit`. The store begins with existing rules; the case-guard rule is not
in it. The `agent` orb has an inset neutral center label, not a spinning text
ring. Camera framing, card content changes, and a single serial packet provide
the visual hierarchy; do not duplicate tool services or imply distributed
infrastructure that the sources do not describe.

### Payloads and routes

The same `signal` actor changes its labeled payload **only while parked at a
socket**. The beam is redrawn for each hop; there are no simultaneous flights.
Packets originate from the actor performing the action, never from empty space.

| Payload          | Source → sink               | Meaning                                                                                         |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| Correction       | `user` → `agent`            | Request to use the built-in case guard.                                                         |
| Current edit     | `agent` → `code`            | Apply the immediate correction.                                                                 |
| Read traits      | `agent` → `store` → `agent` | Consult the collection before drafting.                                                         |
| Draft rule       | `agent` → `tools`           | Submit the proposal to `derive_trait`.                                                          |
| Compare          | `tools` → `store` → `tools` | Compare against existing traits without adding a file.                                          |
| Proposed rule    | `tools` → `user`            | Present the exact proposal for approval.                                                        |
| Approval         | `user` → `tools`            | Authorize this proposal, not unrelated writes.                                                  |
| Approved trait   | `tools` → `store`           | Persist the approved rule.                                                                      |
| Trait ID         | `store` → `tools` → `agent` | Return the saved identity through the tool.                                                     |
| New code         | `agent` → `code`            | A later, separate edit containing a manual comparison.                                          |
| Review request   | `agent` → `tools`           | Request `check_traits` for the edited file.                                                     |
| Current contents | `tools` → `code` → `tools`  | Read the file supplied for review.                                                              |
| Saved rules      | `tools` → `store` → `tools` | Supply traits for the model’s cross-reference.                                                  |
| Assessment       | `tools` → `agent`           | Return the finding for inspection, not an automatic correction.                                 |
| Corrected edit   | `agent` → `code`            | Replace the confirmed manual predicate.                                                         |
| Recheck          | `agent` → `tools` → `agent` | Rerun trait review; relevant project checks are agent-side actions, not a new invented service. |

## Motion and sound rules

- **Card settle:** On an anchored presentation/content change, translate at most
  8 px over 180–240 ms with a damped ease-out; the text/content follows 60 ms
  behind the card surface. Never bounce or scale the whole receiver.
- **Wire:** Draw source-to-sink over 140–220 ms. Emit one quiet tick when
  drawing completes. Undraw or dim the previous route before drawing another.
- **Packet:** Gather at its visible source socket for 80–120 ms, fly along the
  completed beam for 220–420 ms, and land as a small 90–140 ms ring centered on
  the destination socket. Travel speed may compress for a multi-hop beat, but
  flight must remain legible and each direction must be visible.
- **Receiver:** A local gold wash spreads from the contacted socket for no more
  than 180 ms, then returns to matte. No receiver lights up before arrival.
- **Approval gate:** Hold the proposed packet at `user` until the exact approval
  phrase. No write beam or new stored file exists before the gate opens.
- **Camera:** Orthographic 2.5D projection, shallow 8° pitch, cards yawed no
  more than 4°. Use eased moves between active sockets and short two-actor
  frames; keep sufficient surrounding context to identify each source and sink.
  No unmotivated spins, whip pans, or push-ins on idle content.
- **Impact:** At most 1–2 px of camera displacement for 80 ms on the approved
  write landing and on the corrected-code landing; otherwise no shake.
- **Audio:** Dry, quiet UI sounds only: a tick at completed wire draw, a soft
  send on departure, a small impact on landing, and a restrained two-note
  confirm on an actual returned result. No music bed, drone, cinematic riser,
  typing loop, or celebratory fanfare. Narration remains clearly dominant; leave
  approval and final hold pauses quiet.

## Timing and phrase-anchored beats

Target **75 seconds**, approximately 175 spoken words at a measured
conversational pace with short pauses. Clip windows are editorial budgets, not
measured audio durations. In the Scene Program, bind each beat to the exact
corresponding phrase in `script.json`; time values below are the target location
of that phrase. Respect clip order and causal dependencies if recorded speech
timing differs. Stretch quiet holds before accelerating packet motion. Do not
schedule important text or motion on an unspoken timer.

Every row below uses a distinct phrase, verbatim from its clip. Motion, camera,
and contact sounds inside a row are subevents of that anchored beat. The final
matte hold is the completion of the final anchor, not an extra narrative beat.

| Window / clip       | Target | Exact spoken anchor                               | Visual action and causal path                                                                                                                                                                                                                                                     | Camera and sound                                                                                   |
| ------------------- | ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 0–5 s / `intro`     | 0.4 s  | One useful correction                             | Present `user` with the chat-input surface; other actors are already matte.                                                                                                                                                                                                       | Wide establishing frame; a single card-settle tick, no energy on routes.                           |
|                     | 2.0 s  | something your coding agent remembers             | Bring `agent` and `store` into the same readable composition; caption reads `Feedback → remembered preference`. Do not light the store or add a file.                                                                                                                             | Gentle contextual pan; silence.                                                                    |
| 5–13 s / `feedback` | 5.2 s  | You ask for the built-in case guard               | Show the chat input: “Use the union’s case guard here, rather than comparing the tag yourself.” Send Correction from `user` to `agent`.                                                                                                                                           | Follow the signal; wire tick, send, socket impact.                                                 |
|                     | 8.5 s  | replaces the manual tag comparison                | Send Current edit from `agent` to `code`; reveal `− value._tag === "Fail"` and `+ Outcome.guards.Fail(value)` on the card.                                                                                                                                                        | Frame `agent` and `code`; socket-origin flash, no receiver scale.                                  |
|                     | 11.5 s | in this edit                                      | Settle the diff with `Current edit · corrected` visible; `store` stays unchanged.                                                                                                                                                                                                 | Hold on the code card; quiet after the impact.                                                     |
| 13–21 s / `draft`   | 13.3 s | reads your saved traits                           | Read traits travels `agent` → `store` → `agent`; briefly expose the existing file list without the new case-guard trait.                                                                                                                                                          | Track outward and back; confirm only on the returned read.                                         |
|                     | 16.2 s | drafts a reusable rule                            | `user` switches to an agent-response skin containing the drafted rule; the signal stays parked at `agent`. The chat response is a presentation of agent output, not a store write.                                                                                                | Frame the response and orb; content lags the surface by 60 ms.                                     |
|                     | 18.8 s | testing or filtering tagged unions                | Underline that scope within the exact draft text; caption reads `Draft · not saved`.                                                                                                                                                                                              | Shallow close-up, then a silent matte hold.                                                        |
| 21–29 s / `compare` | 21.2 s | goes to derive trait                              | Draft rule travels `agent` → `tools`, landing at the `derive_trait` socket; spell the API name exactly on screen.                                                                                                                                                                 | Follow into the tool card; draw/send/impact.                                                       |
|                     | 23.5 s | compares it with the collection                   | Compare travels `tools` → `store` → `tools`. The card lists `Covered / Clarify / Conflict / New / Uncertain`; only the returned `New` result receives the active accent.                                                                                                          | Two-card framing; result confirm on return.                                                        |
|                     | 26.6 s | a new preference                                  | Present the selected `New → suggest saving → your approval` path within `tools`; inactive outcomes remain plain text with no beams or motion. Proposed rule travels `tools` → `user`.                                                                                             | Follow the proposal toward the user; no store illumination.                                        |
| 29–37 s / `approve` | 29.1 s | review the exact rule                             | `user` becomes the approval-dialog card; show the full rule and `Nothing saved yet`. Park the proposal at the user socket.                                                                                                                                                        | Stable readable close-up; card settle and quiet hold.                                              |
|                     | 31.0 s | Approve, edit, or skip                            | Reveal three illustrative choices: `Approve`, `Edit`, `Skip`; none is selected yet.                                                                                                                                                                                               | Silent content reveal; no cursor actor or write route.                                             |
|                     | 32.8 s | you approve it                                    | Mark `Approve` and send Approval from `user` to `tools`. The exact draft remains unchanged.                                                                                                                                                                                       | Follow the approved packet; socket impact at the tool.                                             |
|                     | 35.0 s | Nothing is saved before that choice               | Caption reads `Explicit approval → write permitted`; briefly frame the unchanged store beside the approved tool state. The actual write starts in the next clip.                                                                                                                  | Small framing adjustment, no packet flight or new-file glow.                                       |
| 37–45 s / `save`    | 37.2 s | becomes a Markdown file                           | Approved trait travels `tools` → `store`; only on landing add `aurora_adventure_sunbeam-<uuid>.md` under `.agents/traits`, with a readable body preview. Caption explains that `<uuid>` is illustrative.                                                                          | Follow to the file row; local ring, restrained impact shake.                                       |
|                     | 40.4 s | Its ID comes back                                 | Trait ID returns `store` → `tools` → `agent`; socket confirmations follow the return route, not the write departure.                                                                                                                                                              | Track the returned ID; final confirm at the agent.                                                 |
|                     | 43.0 s | ready for future sessions                         | Leave the new file plainly visible with `Saved · readable Markdown`; caption says `Available to future sessions`. No new session actor appears.                                                                                                                                   | Hold the store and agent in one matte frame.                                                       |
| 45–55 s / `review`  | 45.2 s | sends new code to check traits                    | Label `code` as `Later edit`; show `Array.filter(outcomes, (value) => value._tag === "Fail")` as a fresh snippet. New code travels `agent` → `code`, then Review request travels `agent` → `tools` at `check_traits`, then Current contents is read `tools` → `code` → `tools`.   | Follow these short serial hops; keep `Later edit` readable so this is not an unexplained reversal. |
|                     | 48.8 s | cross-references your rules                       | Saved rules travels `tools` → `store` → `tools`; expose three review rows: `Use case guards`, `Prefer Effect utilities`, `Use atoms for React state`.                                                                                                                             | Frame tool and collection; read-return confirm.                                                    |
|                     | 51.0 s | flags another manual comparison                   | Return Assessment `tools` → `agent`; the rows read `Inspect`, `Compliant`, and `Not applicable`, matching the tab example. Underline `_tag` in the referenced code.                                                                                                               | Follow the assessment; neutral finding label, no red alarm.                                        |
|                     | 53.2 s | inspects the evidence                             | `agent` frames the relevant code and case-guard rule together; caption reads `Does this rule apply?`. No correction or success stamp yet.                                                                                                                                         | Stop the camera and hold; quiet.                                                                   |
| 55–67 s / `correct` | 55.2 s | The finding applies                               | Replace the pending question with `Confirmed applicable`; the case-guard rule and highlighted predicate remain side by side.                                                                                                                                                      | Small, silent evidence-focused reframing.                                                          |
|                     | 57.2 s | replaces the predicate with the guard             | Corrected edit travels `agent` → `code`; the old filter gives way to `Array.filter(outcomes, Outcome.guards.Fail)`, with the guard emphasized and the removed comparison ghosted above it.                                                                                        | Follow the edit; local socket flash and restrained impact shake.                                   |
|                     | 60.8 s | reruns trait review and project checks            | Recheck travels `agent` → `tools` → `agent`; the orb’s content labels the separate actions `Trait review` and `Project checks`. After the returned review, the code label becomes `Corrected · rechecked`. Do not claim an unconditional clean repository or invent a test count. | Frame the corrected code and returning signal; quiet result confirm.                               |
|                     | 64.7 s | guidance, not guarantees                          | Keep the corrected snippet visible and set the caption to `Inspect model judgments. Fix confirmed violations.` Accent energy decays to matte.                                                                                                                                     | Hold; no victory sound.                                                                            |
| 67–75 s / `outro`   | 67.2 s | Feedback becomes an approved rule                 | Pull back to show `user`, `agent`, `tools`, the saved file, and the corrected code with their final matte states. No fresh writes or repeated requests.                                                                                                                           | Gentle contextual pullback; silence.                                                               |
|                     | 69.5 s | helps improve the next edit                       | Frame the saved rule and corrected later edit together; caption reads `A preference you don’t have to repeat`.                                                                                                                                                                    | Small compositional move, no decorative pulse.                                                     |
|                     | 72.4 s | without relying on a half-remembered conversation | Set the final title to `Traits` and retain the file/code evidence beneath it; settle into a quiet hold until 75 s.                                                                                                                                                                | Stationary camera; clean narration tail, no music.                                                 |

## On-screen content

**Correction chat:** “Use the union’s case guard here, rather than comparing the
tag yourself.”

**Exact proposed and approved rule:** “Use tagged unions’ built-in case guards
when testing or filtering cases, rather than comparing `_tag`.” Keep identical
wording between the draft, approval, and saved file body.

**Later-edit before:**

```ts
Array.filter(outcomes, (value) => value._tag === "Fail")
```

**Later-edit after:**

```ts
Array.filter(outcomes, Outcome.guards.Fail)
```

The `outcomes` and `Outcome` names are the tabs’ illustrative example, not a
claim that this file or union exists in the repository. The final code removes a
manual comparison; do not attach fabricated performance, token, accuracy, or
productivity measurements.

## Narration and production handoff

Use the nine clip IDs and text in `narration/script.json` as the spoken master.
Bracketed tags direct performance and are not spoken. Say `derive_trait` as
“derive trait,” `check_traits` as “check traits,” and `_tag` as “tag”; exact API
spellings remain in on-screen labels. Each clip is well below 25 seconds.

Record without a music bed. Fit the roughly 75-second budget by editing pauses,
not cutting approval, evidence inspection, or recheck. If more time is needed,
the permitted total is 45–90 seconds. The Scene Program should expose
clip/anchor bindings, route endpoints, actor state changes, and contact-sound
subevents, so the causal order can be inspected without reverse-engineering
animation curves.

Before rendering, check that every anchor appears once in its clip, every beat
has an anchor, no stored file appears before approval, every moving signal has a
visible source and destination, the first and later edits are distinguished, and
the ending says `Rechecked` rather than promising model infallibility.
