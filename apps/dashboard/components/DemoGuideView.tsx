"use client";

import { motion } from "framer-motion";
import { ArchitectureOverviewWidget } from "./ArchitectureOverviewWidget";
import { CheckCircle2 } from "lucide-react";

export function DemoGuideView() {
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
    {
      label: "Approval Drawer Details",
      status: "Subsystem traces & payload inspections",
    },
    {
      label: "Runtime Health Panel",
      status: "Live heartbeat check for MCP, DB & Redis",
    },
    {
      label: "Trace Timeline Lifecycle",
      status: "Jaeger-like request execution stages",
    },
    {
      label: "Connected Servers Page",
      status: "Topological card listing for active servers",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-12 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0 }}
          className="col-span-12 lg:col-span-7 p-6 rounded-2xl app-glass app-surface flex flex-col justify-between gap-6 transition-all duration-200 ease-out hover:-translate-y-0.5"
        >
          <div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-accent">
              Platform Engine
            </span>
            <h3 className="text-lg font-bold text-foreground mt-1">
              Capabilities Overview
            </h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Cossie serves as a model-agnostic security plane for agents. It
              sits directly in the tool loop, evaluating execution safety.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {capabilities.map((cap, idx) => {
              return (
                <div
                  key={idx}
                  className="group p-5 rounded-lg bg-card/60 border border-border flex flex-col gap-2 cursor-pointer hover:border-border/80 transition-colors duration-200"
                >
                  <h4 className="text-sm font-medium text-foreground leading-snug">
                    {cap.title}
                  </h4>
                  <div className="max-h-0 opacity-0 group-hover:max-h-16 group-hover:opacity-100 transition-all duration-300 ease-out overflow-hidden">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cap.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            mass: 1.2,
            stiffness: 180,
            damping: 20,
            delay: 0.05,
          }}
          className="col-span-12 lg:col-span-5 p-6 rounded-2xl app-glass flex flex-col justify-between gap-4"
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
                className="p-3 bg-muted/30 border border-border/60 rounded-xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={12} className="text-accent shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">
                    {item.label}
                  </span>
                </div>
                <span className="text-[9px] font-mono font-medium text-muted-foreground shrink-0">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            mass: 1.2,
            stiffness: 180,
            damping: 20,
            delay: 0.1,
          }}
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
