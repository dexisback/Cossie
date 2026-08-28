"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Server, RefreshCw, Wrench, ShieldCheck, Terminal, X, Radio, Play, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";

interface McpServer {
  id: string;
  name: string;
  transport: "stdio" | "sse";
  command?: string;
  args?: string[];
  url?: string;
}

interface McpServersViewProps {}

export function McpServersView({}: McpServersViewProps) {
  const queryClient = useQueryClient();
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mcp-topology"],
    queryFn: async () => {
      const [healthRes, toolsRes] = await Promise.all([
        api.get("/api/health").then((r) => r.json()),
        api.get("/api/tools").then((r) => r.json()),
      ]);
      return { health: healthRes, tools: toolsRes };
    },
  });

  const tools = data?.tools || [];
  const serversList: McpServer[] = data?.health?.serversList || [];

  async function handleRefreshAll() {
    try {
      setRefreshingId("all");
      const res = await api.post("/api/tools/refresh");
      if (res.ok) {
        toast.success("Tool discovery completed successfully.");
        queryClient.invalidateQueries({ queryKey: ["mcp-topology"] });
        queryClient.invalidateQueries({ queryKey: ["system-health"] });
        refetch();
      } else {
        toast.error("Failed to refresh tools");
      }
    } catch (err) {
      toast.error("Error refreshing tools");
    } finally {
      setRefreshingId(null);
    }
  }

  function getServerTools(serverId: string) {
    return tools.filter((t: any) => t.serverId === serverId);
  }

  function getServerStatus(server: McpServer, serverToolsCount: number) {
    if (server.transport === "sse" && !server.url) {
      return { status: "Disconnected", state: "offline" };
    }
    if (serverToolsCount > 0) {
      return { status: "Connected", state: "healthy" };
    }
    return { status: "Unknown", state: "unknown" };
  }

  const healthyServersCount = serversList.filter(
    (s) => getServerStatus(s, getServerTools(s.id).length).state === "healthy"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">MCP Servers</h2>
            <div className="relative"
              onMouseEnter={() => setHelpOpen(true)}
              onMouseLeave={() => setHelpOpen(false)}
            >
              <button className="p-1 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-all duration-150">
                <HelpCircle size={13} />
              </button>
              {helpOpen && (
                <div className="absolute left-0 top-full mt-1 w-80 z-30 bg-card border border-border/70 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-1 duration-100">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">What is an MCP Server?</p>
                  <div className="space-y-2.5 text-[10px] text-muted-foreground leading-relaxed">
                    <p>Model Context Protocol (MCP) servers expose tools and resources that AI models can safely query or invoke. Cossie dynamically registers these servers at runtime and applies safety, risk evaluation, and approval guardrails before any action execution.</p>
                    <div>
                      <p className="font-semibold text-foreground/70 mb-1">Supported transports:</p>
                      <ul className="space-y-1 pl-1">
                        <li><span className="font-mono font-semibold text-foreground/60">stdio</span> — Local process transport (e.g. node scripts).</li>
                        <li><span className="font-mono font-semibold text-foreground/60">SSE</span> — Server-Sent Events over HTTP (e.g. remote services).</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage and monitor connected Model Context Protocol providers.
          </p>
        </div>
        <button
          onClick={handleRefreshAll}
          disabled={refreshingId !== null || isLoading}
          className="app-btn-3d px-4 py-2 bg-accent text-accent-foreground text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all self-start sm:self-auto"
        >
          <RefreshCw size={14} className={refreshingId === "all" ? "animate-spin" : ""} />
          Refresh Discovery
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-20 bg-muted rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl app-glass">
            <span className="text-[9px] font-mono font-medium uppercase tracking-wider text-muted-foreground">Connected Servers</span>
            <div className="text-xl font-semibold text-foreground mt-1">{serversList.length}</div>
          </div>
          <div className="p-4 rounded-2xl app-glass">
            <span className="text-[9px] font-mono font-medium uppercase tracking-wider text-muted-foreground">Healthy Servers</span>
            <div className="text-xl font-semibold text-status-ok mt-1">{healthyServersCount}</div>
          </div>
          <div className="p-4 rounded-2xl app-glass">
            <span className="text-[9px] font-mono font-medium uppercase tracking-wider text-muted-foreground">Total Discovered Tools</span>
            <div className="text-xl font-semibold text-foreground mt-1">{tools.length}</div>
          </div>
          <div className="p-4 rounded-2xl app-glass">
            <span className="text-[9px] font-mono font-medium uppercase tracking-wider text-muted-foreground">Last Discovery</span>
            <div className="text-xs font-medium text-foreground mt-2 truncate">Synchronized</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-48 bg-muted rounded-2xl animate-pulse" />
          <div className="h-48 bg-muted rounded-2xl animate-pulse" />
        </div>
      ) : serversList.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-2xl bg-card">
          <Server className="mx-auto text-muted-foreground mb-3" size={24} />
          <h3 className="text-xs font-bold text-foreground">No MCP Servers Connected</h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Connect an MCP server to begin discovering tools.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {serversList.map((server) => {
            const serverTools = getServerTools(server.id);
            const { status, state } = getServerStatus(server, serverTools.length);

            const badgeColor =
              state === "healthy"
                ? "bg-emerald-500/10 text-status-ok border border-emerald-500/20"
                : state === "offline"
                ? "bg-rose-500/10 text-status-critical border border-rose-500/20"
                : "bg-stone-500/10 text-stone-500 border border-stone-500/20";

            return (
              <div
                key={server.id}
                onClick={() => setSelectedServer(server)}
                className="p-4 rounded-lg border border-border bg-card/60 hover:border-accent/40 flex flex-col justify-between gap-3.5 cursor-pointer relative group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Server size={16} className="text-accent" />
                      <span className="text-xs font-semibold text-foreground">{server.name}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-wider ${state === "healthy" ? "text-status-ok font-medium" : (state === "offline" ? "text-status-critical font-medium" : "text-stone-500 font-medium")}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${state === "healthy" ? "bg-[var(--status-ok)]" : (state === "offline" ? "bg-[var(--status-critical)]" : "bg-stone-500")}`} />
                      {status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-[8px] font-mono text-muted-foreground uppercase block">Transport</span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono uppercase bg-muted text-muted-foreground border border-border font-medium inline-block mt-0.5">
                        {server.transport}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-muted-foreground uppercase block">Tools</span>
                      <span className="font-semibold text-foreground block mt-0.5">{serverTools.length}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-muted-foreground uppercase block">Tools Preview</span>
                    <div className="flex flex-wrap gap-1.5">
                      {serverTools.length === 0 ? (
                        <span className="text-[9px] text-muted-foreground italic">No tools exposed</span>
                      ) : (
                        <>
                          {serverTools.slice(0, 3).map((t: any) => (
                            <span key={t.id} className="px-1.5 py-0.5 bg-background border border-border rounded text-[9px] font-mono text-foreground font-medium">
                              {t.toolName}
                            </span>
                          ))}
                          {serverTools.length > 3 && (
                            <span className="text-[9px] text-muted-foreground font-medium flex items-center">
                              +{serverTools.length - 3} more
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-3.5 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground font-mono">Last Sync: Active</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshAll();
                    }}
                    className="p-1 hover:bg-muted/60 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                    title="Refresh server tools"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}


      <AnimatePresence>
        {selectedServer && (
          <ServerDetailsDrawer
            server={selectedServer}
            tools={getServerTools(selectedServer.id)}
            status={getServerStatus(selectedServer, getServerTools(selectedServer.id).length)}
            onClose={() => setSelectedServer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface ServerDetailsDrawerProps {
  server: McpServer;
  tools: any[];
  status: { status: string; state: string };
  onClose: () => void;
}

function ServerDetailsDrawer({ server, tools, status, onClose }: ServerDetailsDrawerProps) {
  const badgeColor =
    status.state === "healthy"
      ? "bg-emerald-500/10 text-status-ok border border-emerald-500/20"
      : status.state === "offline"
      ? "bg-rose-500/10 text-status-critical border border-rose-500/20"
      : "bg-stone-500/10 text-stone-500 border border-stone-500/20";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-background/40 backdrop-blur-sm transition-opacity"
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", mass: 1.2, stiffness: 180, damping: 20 }}
        className="relative w-full sm:max-w-md app-glass border-y-0 border-r-0 h-full flex flex-col shadow-2xl z-10 overflow-hidden"
      >
        <div className="h-16 border-b border-border bg-transparent flex items-center justify-between px-6 shrink-0">
          <h3 className="text-sm font-semibold text-foreground">Server Details</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted/60 text-muted-foreground rounded-lg cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-background/40 p-5 rounded-2xl border border-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium uppercase text-muted-foreground">Server Name</span>
              <span className="text-xs text-foreground font-semibold">{server.name}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium uppercase text-muted-foreground">Connection</span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider ${badgeColor}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.state === "healthy" ? "bg-[var(--status-ok)]" : (status.state === "offline" ? "bg-[var(--status-critical)]" : "bg-stone-500")} animate-pulse`} />
                {status.status}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium uppercase text-muted-foreground">Transport</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-mono uppercase bg-muted text-muted-foreground border border-border font-medium">
                {server.transport}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium uppercase text-muted-foreground">Total Tools</span>
              <span className="text-xs text-foreground font-semibold">{tools.length}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              Configuration Details
            </h4>
            {server.transport === "stdio" ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase">Runtime Command</span>
                  <p className="font-mono text-xs font-semibold text-foreground mt-0.5">{server.command}</p>
                </div>
                {server.args && server.args.length > 0 && (
                  <div>
                    <span className="text-[9px] font-mono text-muted-foreground uppercase">Command Arguments</span>
                    <pre className="text-[10px] font-mono bg-background/50 border border-border p-2.5 rounded-lg overflow-x-auto text-foreground mt-0.5 no-scrollbar">
                      {server.args.join(" ")}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs">
                <span className="text-[9px] font-mono text-muted-foreground uppercase">SSE Connection URL</span>
                <p className="font-mono text-xs font-semibold text-foreground mt-0.5 break-all">
                  {server.url || "SSE connection URL not configured in variables."}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              Health Metrics
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Runtime Status</span>
                <span className="font-medium text-foreground">{status.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discovery Mode</span>
                <span className="font-medium text-foreground">Dynamic Registry</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Tools</h4>
            <div className="space-y-2">
              {tools.length === 0 ? (
                <div className="p-3 text-center border border-border bg-background/25 rounded-xl text-xs text-muted-foreground">
                  No tools found for this server.
                </div>
              ) : (
                <div className="divide-y divide-border border border-border rounded-xl bg-background/20 overflow-hidden">
                  {tools.map((t) => (
                    <div key={t.id} className="p-3 flex items-center justify-between text-xs hover:bg-muted/10">
                      <div>
                        <span className="font-mono font-semibold text-foreground">{t.toolName}</span>
                        <span className="text-[10px] text-muted-foreground block truncate max-w-[200px] mt-0.5">
                          {t.description}
                        </span>
                      </div>
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-mono uppercase bg-muted text-muted-foreground border border-border font-medium">
                        {t.finalRisk} Risk
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <details className="group border border-border rounded-xl bg-background/25 overflow-hidden">
            <summary className="flex items-center justify-between p-3.5 text-xs font-semibold text-muted-foreground cursor-pointer select-none group-open:border-b group-open:border-border transition-colors hover:text-foreground">
              <span className="flex items-center gap-1.5">
                <Terminal size={14} />
                Raw Configuration
              </span>
            </summary>
            <div className="p-3.5 bg-background/50">
              <pre className="text-[9px] font-mono overflow-x-auto text-muted-foreground max-h-48 leading-relaxed no-scrollbar">
                {JSON.stringify(server, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      </motion.div>
    </div>
  );
}
