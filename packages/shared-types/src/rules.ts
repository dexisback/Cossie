import { z } from "zod";

export const RuleTypeSchema = z.enum([
  "BLOCK_TOOL",
  "REQUIRE_APPROVAL",
  "INPUT_VALIDATION",
  "BUDGET_LIMIT",
  "RISK_BASED",
]);

export type RuleType = z.infer<
  typeof RuleTypeSchema
>;

export const RiskLevelSchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export type RiskLevel = z.infer<
  typeof RiskLevelSchema
>;

export const BlockToolRuleSchema = z.object({
  type: z.literal("BLOCK_TOOL"),
  toolNames: z.array(z.string()),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const ApprovalRuleSchema = z.object({
  type: z.literal("REQUIRE_APPROVAL"),
  toolNames: z.array(z.string()),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const InputValidationRuleSchema = z.object({
  type: z.literal("INPUT_VALIDATION"),
  toolName: z.string(),
  allowedPrefix: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const BudgetRuleSchema = z.object({
  type: z.literal("BUDGET_LIMIT"),
  maxTokens: z.number().positive(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const RiskBasedRuleSchema = z.object({
  type: z.literal("RISK_BASED"),
  riskLevel: RiskLevelSchema.optional(),
  minimumRisk: RiskLevelSchema.optional(),
  decision: z.enum(["ALLOW", "DENY", "REQUIRE_APPROVAL", "VALIDATION_FAILED"]).optional().default("REQUIRE_APPROVAL"),
  name: z.string().optional(),
  description: z.string().optional(),
});

export type BlockToolRule = z.infer<
  typeof BlockToolRuleSchema
>;

export type ApprovalRule = z.infer<
  typeof ApprovalRuleSchema
>;

export type InputValidationRule = z.infer<
  typeof InputValidationRuleSchema
>;

export type BudgetRule = z.infer<
  typeof BudgetRuleSchema
>;

export type RiskBasedRule = z.infer<
  typeof RiskBasedRuleSchema
>;

export const RuleSchema = z.discriminatedUnion(
  "type",
  [
    BlockToolRuleSchema,
    ApprovalRuleSchema,
    InputValidationRuleSchema,
    BudgetRuleSchema,
    RiskBasedRuleSchema,
  ]
);

export type Rule = z.infer<typeof RuleSchema>;
//used by policy engine, dashboard and db
//defines all rule schemas so things like block_tool, require_approval, input_validation, budget_limit, and risk_based
//also risk lvel and rule


