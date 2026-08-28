"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Server,
  Shield,
  Database,
  Cpu,
  Radio,
  Zap,
  AlertCircle,
} from "lucide-react";
import { api } from "../lib/api";

interface SubsystemCardProps {
  name: string;
  status: string;
  description: string;
  icon: any;
  state: "healthy" | "warning" | "error" | "unknown";
  metrics?: { label: string; value: string | number }[];
}

function SubsystemCard({
  name,
  status,
  icon: Icon,
  state,
  metrics,
}: SubsystemCardProps) {
  const badgeColors = {
    healthy: "text-status-ok",
    warning: "text-status-warn",
    error: "text-status-critical",
    unknown: "text-stone-500",
  };

  const dotColors = {
    healthy: "bg-[var(--status-ok)]",
    warning: "bg-[var(--status-warn)]",
    error: "bg-[var(--status-critical)]",
    unknown: "bg-stone-500",
  };

  const dotAnimations = {
    healthy: "animate-pulse",
    warning: "animate-pulse",
    error: "animate-pulse",
    unknown: "",
  };

  const metricText =
    metrics && metrics.length > 0 ? metrics[metrics.length - 1].value : "";

  return (
    <div className="group flex items-center justify-between py-2.5 text-xs border-b border-white/[0.04] last:border-0 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-white/[0.02] px-2 -mx-2 rounded-lg">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1 rounded-md bg-card/60 border border-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] transition-all duration-200 group-hover:border-white/[0.1]">
          <Icon size={12} className="text-muted-foreground" strokeWidth={2} />
        </div>
        <span className="font-semibold text-foreground truncate text-[11px]">
          {name}
        </span>
        {metricText !== "" && metricText !== undefined && (
          <span className="text-[8px] font-mono tabular-nums text-muted-foreground px-1.5 py-0.5 bg-muted/60 rounded border border-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
            {metricText}
          </span>
        )}
      </div>
      <span
        className={`inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider ${badgeColors[state]}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotColors[state]} ${dotAnimations[state]}`}
        />
        {status}
      </span>
    </div>
  );
}

function SubsystemSkeleton() {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0 animate-pulse px-2 -mx-2">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 bg-muted/40 rounded-md border border-white/[0.04]" />
        <div className="w-20 h-3 bg-muted/40 rounded" />
      </div>
      <div className="w-14 h-4 bg-muted/40 rounded-full" />
    </div>
  );
}

export function SystemStatusPanel() {
  const queryClient = useQueryClient();
  const [lastSuccessTime, setLastSuccessTime] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const [healthRes, rulesRes] = await Promise.all([
        api.get("/api/health").then((r) => {
          if (!r.ok) throw new Error("Health check API failed");
          return r.json();
        }),
        api.get("/api/rules").then((r) => {
          if (!r.ok) throw new Error("Rules API failed");
          return r.json();
        }),
      ]);
      return { health: healthRes, rules: rulesRes };
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (data) {
      setLastSuccessTime(Date.now());
      setSecondsAgo(0);
    }
  }, [data]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastSuccessTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSuccessTime]);

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["system-health"] });
    refetch();
  };

  function formatUptime(seconds: number) {
    if (!seconds || isNaN(seconds)) return "Unknown";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  const health = data?.health;
  const rules = data?.rules;

  const agentUptime = health?.uptime ? formatUptime(health.uptime) : "N/A";
  const activeRulesCount = rules
    ? rules.filter((r: any) => r.enabled).length
    : 0;
  const mcpServers = health?.servers ?? 0;
  const mcpTools = health?.tools ?? 0;

  const dbStatus =
    health?.database === "healthy"
      ? "healthy"
      : health?.database === "unhealthy"
        ? "error"
        : "unknown";
  const redisStatus =
    health?.redis === "healthy"
      ? "healthy"
      : health?.redis === "unhealthy"
        ? "warning"
        : "unknown";

  const subsystems = [
    {
      name: "AI Agent",
      status: error ? "Offline" : health ? "Online" : "Unknown",
      description:
        "Controls the autonomous tool loop and processes user requests.",
      icon: Cpu,
      state: error
        ? ("error" as const)
        : health
          ? ("healthy" as const)
          : ("unknown" as const),
      metrics: [
        { label: "Status", value: "Active" },
        { label: "Uptime", value: agentUptime },
      ],
    },
    {
      name: "Database",
      status: error
        ? "Offline"
        : dbStatus === "healthy"
          ? "Healthy"
          : dbStatus === "error"
            ? "Error"
            : "Unknown",
      description:
        "Prisma and PostgreSQL storage engine for configurations and audit logs.",
      icon: Database,
      state: error
        ? ("error" as const)
        : dbStatus === "healthy"
          ? ("healthy" as const)
          : ("error" as const),
      metrics: [
        {
          label: "Connection",
          value: error
            ? "Offline"
            : dbStatus === "healthy"
              ? "Active"
              : "Failed",
        },
      ],
    },
    {
      name: "Policy Engine",
      status: error ? "Error" : rules ? "Loaded" : "Unknown",
      description:
        "Evaluates action safety rules and enforces automated guardrails.",
      icon: Shield,
      state: error
        ? ("error" as const)
        : rules
          ? ("healthy" as const)
          : ("unknown" as const),
      metrics: [{ label: "Rules", value: `${activeRulesCount} Active` }],
    },
    {
      name: "MCP Registry",
      status: error ? "Offline" : health ? "Connected" : "Unknown",
      description:
        "Registry and connection manager for Model Context Protocol servers.",
      icon: Server,
      state: error
        ? ("error" as const)
        : health
          ? ("healthy" as const)
          : ("unknown" as const),
      metrics: [{ label: "Servers", value: `${mcpServers} Svr` }],
    },
    {
      name: "Redis Sync",
      status: error
        ? "Offline"
        : redisStatus === "healthy"
          ? "Connected"
          : redisStatus === "warning"
            ? "Warning"
            : "Unknown",
      description:
        "Pub/Sub layer synchronizing security policy updates instantly.",
      icon: Radio,
      state: error
        ? ("error" as const)
        : redisStatus === "healthy"
          ? ("healthy" as const)
          : ("warning" as const),
      metrics: [
        {
          label: "Sync",
          value: redisStatus === "healthy" ? "Active" : "Inactive",
        },
      ],
    },
    {
      name: "Gemini",
      status: error
        ? "Offline"
        : health?.models?.gemini
          ? "Available"
          : "Unknown",
      description:
        "Primary LLM provider endpoint powering agent reasoning and tool loop.",
      icon: Zap,
      state: error
        ? ("error" as const)
        : health?.models?.gemini
          ? ("healthy" as const)
          : ("unknown" as const),
      metrics: [{ label: "Model", value: "gemini-2.5" }],
    },
  ];

  return (
    <div className="flex flex-col gap-4 text-foreground select-none">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 shrink-0">
        <div>
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground leading-relaxed">
            System Status
          </h4>
          <p className="text-[9px] text-muted-foreground/80 mt-0.5 leading-relaxed">
            Live Health Monitor
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[8px] font-mono tabular-nums text-muted-foreground/80 px-1.5 py-0.5 bg-muted/40 rounded border border-white/[0.04]">
            {secondsAgo === 0 ? "Just now" : `${secondsAgo}s ago`}
          </span>
          <button
            onClick={handleManualRefresh}
            disabled={isFetching}
            className="p-1.5 border border-white/[0.04] hover:border-accent/40 hover:bg-accent/10 text-muted-foreground hover:text-accent rounded-md transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] disabled:opacity-50 cursor-pointer active:scale-[0.96] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]"
            title="Refresh Status"
          >
            <RefreshCw
              size={11}
              strokeWidth={2}
              className={isFetching ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="flex flex-col">
          {Array.from({ length: 6 }).map((_, idx) => (
            <SubsystemSkeleton key={idx} />
          ))}
        </div>
      ) : (
        <>
          {error && (
            <div className="p-3 bg-[color-mix(in_srgb,var(--status-critical)_4%,transparent)] border-[color-mix(in_srgb,var(--status-critical)_20%,transparent)] rounded-lg flex items-start gap-2 text-[10px] text-status-critical leading-relaxed">
              <div className="p-1 chip chip-critical shrink-0">
                <AlertCircle size={12} strokeWidth={2} />
              </div>
              <div>Connection issue. Status may be cached.</div>
            </div>
          )}

          <div className="flex flex-col">
            {subsystems.map((sub) => (
              <SubsystemCard
                key={sub.name}
                name={sub.name}
                status={sub.status}
                description={sub.description}
                icon={sub.icon}
                state={sub.state}
                metrics={sub.metrics}
              />
            ))}
          </div>

          <div className="border-t border-white/[0.06] pt-3 mt-2">
            <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground/80 p-2 bg-muted/20 rounded-lg border border-white/[0.04]">
              <span className="uppercase tracking-wider font-bold">
                ACTIVE GUARDS
              </span>
              <span className="font-bold text-foreground tabular-nums px-1.5 py-0.5 bg-accent/10 text-accent rounded border border-accent/20">
                {activeRulesCount} loaded
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
