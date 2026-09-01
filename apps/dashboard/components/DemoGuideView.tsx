"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { ArchitectureOverviewWidget } from "./ArchitectureOverviewWidget";

const capabilities = [
  {
    title: "Real-time Interception",
    description:
      "Intercepts incoming tool requests before execution and scans for dangerous command structures.",
  },
  {
    title: "Risk-based Analysis",
    description:
      "Assigns dynamic risk factors to custom commands to ensure high-risk tasks request manual authorization.",
  },
  {
    title: "Prompt Security Playground",
    description:
      "Dedicated playground containing injection scanning heuristics and threat analysis simulation.",
  },
];

const coverage = [
  { label: "Dynamic Rule Builder", status: "Full UI Form constructor" },
  { label: "Approval Drawer Details", status: "Subsystem traces & payload inspections" },
  { label: "Runtime Health Panel", status: "Live heartbeat check for MCP, DB & Redis" },
  { label: "Trace Timeline Lifecycle", status: "Jaeger-like request execution stages" },
  { label: "Connected Servers Page", status: "Topological card listing for active servers" },
];

export function DemoGuideView() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-12 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0 }}
          className="col-span-12 lg:col-span-7 p-6 rounded-2xl app-glass app-surface flex flex-col gap-6"
        >
          <div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-accent">
              Platform Engine
            </span>
            <h3 className="text-lg font-bold text-foreground mt-1">
              Capabilities
            </h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Cossie serves as a model-agnostic security plane for agents. It
              sits directly in the tool loop, evaluating execution safety.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {capabilities.map((cap, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col gap-2"
              >
                <h4 className="text-xs font-semibold text-foreground leading-snug">
                  {cap.title}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {cap.description}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0, delay: 0.05 }}
          className="col-span-12 lg:col-span-5 p-6 rounded-2xl app-glass flex flex-col gap-4"
        >
          <div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-accent">
              System Scope
            </span>
            <h3 className="text-lg font-bold text-foreground mt-1">
              Project Coverage
            </h3>
          </div>

          <div className="space-y-2">
            {coverage.map((item, idx) => (
              <div
                key={idx}
                className="px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl flex items-start gap-2.5"
              >
                <CheckCircle2 size={12} className="text-accent shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-snug">
                    {item.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    {item.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0, delay: 0.1 }}
          className="col-span-12 p-6 rounded-2xl app-glass app-surface"
        >
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-accent">
            Process Topology
          </span>
          <h3 className="text-lg font-bold text-foreground mt-1 mb-6">
            How Cossie Works
          </h3>
          <ArchitectureOverviewWidget />
        </motion.div>
      </div>
    </div>
  );
}
