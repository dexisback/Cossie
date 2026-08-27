"use client";

import { useState } from "react";
import { Check, Shield, CircleDot, Info, Scale } from "lucide-react";

interface Node {
  id: string;
  title: string;
  description: string;
}

export function ArchitectureOverviewWidget() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const nodes: Node[] = [
    {
      id: "User Prompt",
      title: "User Prompt",
      description:
        "Natural language instruction submitted by the administrator.",
    },
    {
      id: "AI Agent",
      title: "AI Agent (Gemini)",
      description:
        "The LLM evaluates input and determines tool invocation parameters. It does NOT run tools directly.",
    },
    {
      id: "Policy Engine",
      title: "Policy Engine",
      description:
        "Every requested tool call is evaluated against administrator-defined guardrails.",
    },
    {
      id: "Decision",
      title: "Decision",
      description:
        "The action is either ALLOWED, BLOCKED (denied), or PAUSED for administrator manual authorization.",
    },
    {
      id: "MCP Registry",
      title: "MCP Registry",
      description:
        "Manages dynamic discovery, server registry, and routes execution calls to target servers.",
    },
    {
      id: "MCP Server",
      title: "MCP Server",
      description:
        "Executes the requested tool under stdio process or SSE transport layers.",
    },
    {
      id: "Tool Result",
      title: "Tool Result",
      description:
        "Execution payload or exit outcome is returned securely back to the AI agent loop.",
    },
    {
      id: "AI Response",
      title: "AI Response",
      description:
        "The AI agent aggregates the tool execution results and formulates the final human response.",
    },
  ];

  const nextStages: Record<string, string[]> = {
    "User Prompt": ["AI Agent"],
    "AI Agent": ["Policy Engine"],
    "Policy Engine": ["Decision", "MCP Registry"],
    Decision: ["MCP Registry", "MCP Server"],
    "MCP Registry": ["MCP Server"],
    "MCP Server": ["Tool Result"],
    "Tool Result": ["AI Response"],
    "AI Response": [],
  };

  const capabilities = [
    "AI Agent Tool Loop",
    "Dynamic MCP Discovery",
    "Multiple MCP Servers",
    "Policy Engine",
    "Runtime Rule Reload",
    "Human Approval Workflow",
    "Tool Blocking",
    "Input Validation",
    "Risk-Based Policies",
    "Budget Limits",
    "Prompt Injection Detection",
    "Audit Logging",
    "Risk Overrides",
    "Tool Catalog",
    "Runtime Health Monitoring",
    "Approval Queue",
    "Live Dashboard",
    "Redis Pub/Sub Synchronization",
  ];

  const coverage = [
    { req: "AI Agent", status: "Implemented" },
    { req: "Dynamic MCP Discovery", status: "Implemented" },
    { req: "Custom MCP Server", status: "Implemented" },
    { req: "Policy Engine", status: "Implemented" },
    { req: "Runtime Rule Updates", status: "Implemented" },
    { req: "Approval Workflow", status: "Implemented" },
    { req: "Audit Logs", status: "Implemented" },
    { req: "Prompt Injection Protection", status: "Bonus" },
  ];

  function isNodeHighlighted(nodeId: string) {
    if (!hoveredNode) return false;
    if (hoveredNode === nodeId) return true;
    return nextStages[hoveredNode]?.includes(nodeId) || false;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="group p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-white/[0.04] shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_4px_rgba(0,0,0,0.05),0_4px_8px_rgba(0,0,0,0.05),0_8px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] flex flex-col justify-between gap-5">
        <div>
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground leading-relaxed">
            How Cossie Works
          </h4>
          <p className="text-[10px] text-muted-foreground/80 mt-1 leading-relaxed">
            Hover over any node in the request pipeline to trace its path.
          </p>
        </div>

        <div className="relative space-y-3 pl-4">
          <div className="absolute left-[29px] top-4 bottom-4 w-[1px] border-l border-dashed border-white/[0.08]" />

          {nodes.map((node, idx) => {
            const isHighlighted = isNodeHighlighted(node.id);
            const isCurrent = hoveredNode === node.id;

            return (
              <div
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className={`relative z-10 flex items-start gap-4 p-3 rounded-xl border transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] cursor-help ${
                  isCurrent
                    ? "border-accent/60 bg-accent/10 shadow-[0_0_0_1px_rgba(219,138,116,0.2),0_0_12px_rgba(219,138,116,0.15),0_2px_4px_rgba(0,0,0,0.04)] text-foreground scale-[1.02]"
                    : isHighlighted
                      ? "border-accent/30 bg-accent/5 text-foreground"
                      : "border-transparent bg-transparent text-muted-foreground hover:border-white/[0.04] hover:bg-white/[0.02]"
                }`}
              >
                <div
                  className={`p-1.5 border rounded-lg shrink-0 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] ${
                    isHighlighted
                      ? "text-accent border-accent/40 bg-accent/10 shadow-[0_0_8px_rgba(219,138,116,0.2)]"
                      : "border-white/[0.08] bg-card/60 text-muted-foreground"
                  }`}
                >
                  <CircleDot
                    size={12}
                    strokeWidth={2}
                    className={isHighlighted ? "animate-pulse" : ""}
                  />
                </div>
                <div className="min-w-0">
                  <h5
                    className={`text-xs font-bold leading-snug transition-colors duration-200 ${isHighlighted ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {node.title}
                  </h5>
                  <p className="text-[10px] text-muted-foreground/80 mt-1 leading-relaxed line-clamp-2">
                    {node.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div className="group p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-white/[0.04] shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_4px_rgba(0,0,0,0.05),0_4px_8px_rgba(0,0,0,0.05),0_8px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] space-y-4">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground border-b border-white/[0.06] pb-3 leading-relaxed">
            Platform Capabilities
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
            {capabilities.map((cap) => (
              <div
                key={cap}
                className="flex items-center gap-2 text-muted-foreground font-semibold"
              >
                <div className="p-0.5 bg-green-500/10 text-green-500 rounded border border-green-500/20 shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                  <Check size={10} strokeWidth={2.5} />
                </div>
                <span className="truncate">{cap}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="group p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-white/[0.04] shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_4px_rgba(0,0,0,0.05),0_4px_8px_rgba(0,0,0,0.05),0_8px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] space-y-4">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground border-b border-white/[0.06] pb-3 leading-relaxed">
            Project Coverage
          </h4>
          <div className="divide-y divide-white/[0.04] border border-white/[0.06] rounded-xl bg-background/30 overflow-hidden text-[10px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
            {coverage.map((c) => (
              <div
                key={c.req}
                className="p-3 flex items-center justify-between font-semibold transition-colors hover:bg-white/[0.02]"
              >
                <span className="text-muted-foreground text-[11px]">
                  {c.req}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ${
                    c.status === "Bonus"
                      ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                      : "bg-green-500/10 text-green-500 border border-green-500/20"
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-1 md:col-span-2 p-6 bg-card/40 backdrop-blur-sm border border-white/[0.04] rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)] space-y-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
            <Info size={14} className="text-accent" strokeWidth={2} />
          </div>
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
            Architecture Summary
          </h4>
        </div>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          Cossie separates AI reasoning from tool execution. Every tool request
          passes through the Policy Engine before reaching any MCP server.
          Administrators can modify policies at runtime without restarting the
          agent, allowing security rules to evolve independently of application
          code.
        </p>
      </div>
    </div>
  );
}
