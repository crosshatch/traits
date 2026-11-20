import { Plugin } from "@opencode/plugin/effect"
import { Effect } from "effect"

/** Reintroduce the feedback obligation at dispatch time, including after compaction and tool continuations. */
export default Plugin.define({
  id: "@traits/opencode",
  effect: (context) =>
    context.session
      .hook("context", (event) =>
        Effect.sync(() => {
          event.system.push({
            type: "text",
            text: "Feedback review: Before acting on a user correction, preference, or approval/rejection of an approach, identify the reusable lesson. A specific file, command, or example does not make feedback inherently one-off. If the lesson may generalize and has not already been processed in this conversation, tell the user what you propose and call traits.derive. For ApprovalRequired, show the full proposal and ask the user using your native question tool or conversation, then submit their explicit decision with the returned snapshot. Do not trigger MCP elicitation, run an approval CLI, or write trait files directly. Explain Covered, blocked, or failed results. If no reusable lesson exists, briefly say why. Do not repeat feedback already handled during this turn. This reminder does not imply that a trait was saved."
          })
        })
      )
      .pipe(Effect.asVoid)
})
