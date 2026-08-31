// Rough token estimate (~4 chars/token). Used to feed `currentTokens` into the
// policy engine so BUDGET_LIMIT rules actually see conversation usage, and to
// keep Conversation.totalTokens in sync. Deliberately an estimate: the budget
// rule is a coarse circuit breaker, not billing.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}
