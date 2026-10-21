---
name: resource-aware-bulk-concurrency
subject: Concurrency choices for bulk operations.
requirement: Bound concurrency when potentially large or externally controlled
  collections could exhaust resources. Account for existing resource limits
  before adding another limiter. Use unbounded concurrency when the workload is
  predictably small or resource usage is already adequately controlled. Choose
  numeric limits using representative measurements and preserve ordering and
  consistency requirements.
purpose: Exploit useful parallelism without unnecessary throttling or
  uncontrolled resource consumption.
---
