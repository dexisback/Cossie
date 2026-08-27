"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar, TabType } from "../components/Sidebar";
import { OverviewView } from "../components/OverviewView";
import { PoliciesView } from "../components/PoliciesView";
import { ToolCatalogView } from "../components/ToolCatalogView";
import { McpServersView } from "../components/McpServersView";
import { ApprovalQueueView } from "../components/ApprovalQueueView";
import { AuditLogsView } from "../components/AuditLogsView";
import { PromptPlaygroundView } from "../components/PromptPlaygroundView";
import { CommandSearchModal } from "../components/CommandSearchModal";
import { DemoGuideView } from "../components/DemoGuideView";
import { SystemStatusPanel } from "../components/SystemStatusPanel";
import { Search, Volume2, VolumeX, Sun, Moon, ChevronDown, BookOpen } from "lucide-react";
import { sound } from "../components/SoundSystem";

function GithubIcon({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Initial theme and sound state synchronization
    const theme = localStorage.getItem("theme");
    const isDark = theme !== "light";
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    setSoundEnabled(sound.getSoundEnabled());

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function getTabTitle() {
    switch (activeTab) {
      case "overview":
        return "System Overview";
      case "policies":
        return "Policies & Guards";
      case "catalog":
        return "Discovered MCP Tools";
      case "servers":
        return "Connected MCP Servers";
      case "approvals":
        return "Action Approval Queue";
      case "logs":
        return "Audit Trails";
      case "playground":
        return "Prompt Security Playground";
      case "demo":
        return "Platform Capabilities & Operations";
      default:
        return "Dashboard";
    }
  }

  const handleToggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    sound.playTap();
  };

  const handleToggleSound = () => {
    const nextEnabled = sound.toggleSound();
    setSoundEnabled(nextEnabled);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab={activeTab} onChangeTab={(tab) => { sound.playTap(); setActiveTab(tab); }} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 border-b border-border bg-card/75 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-bold text-foreground tracking-tight">
              {getTabTitle()}
            </h2>
            <button
              onClick={() => { sound.playTap(); setIsSearchOpen(true); }}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all duration-150 cursor-pointer"
            >
              <Search size={11} className="opacity-80" />
              <span>Search...</span>
              <kbd className="pointer-events-none rounded bg-card px-1 font-mono text-[8px] text-muted-foreground/60 border border-border/30">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground z-30">
            <div className="relative">
              <button
                onClick={() => { sound.playTap(); setIsStatusOpen(!isStatusOpen); }}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold text-foreground hover:bg-muted/70 cursor-pointer transition-all active:scale-[0.96]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>System Status</span>
                <ChevronDown size={11} className={`transition-transform duration-200 ${isStatusOpen ? "rotate-180" : ""}`} />
              </button>

              {isStatusOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsStatusOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-card border border-border shadow-lg z-50 p-4 rounded-md animate-in fade-in slide-in-from-top-2 duration-200">
                    <SystemStatusPanel />
                  </div>
                </>
              )}
            </div>
            <div className="h-4 w-[1px] bg-border" />
            <Link
              href="/docs"
              onClick={() => sound.playTap()}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold text-foreground hover:bg-muted/70 cursor-pointer transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.96] hover:text-accent"
            >
              <BookOpen size={11} className="text-muted-foreground" />
              <span>Docs</span>
            </Link>
            <div className="h-4 w-[1px] bg-border" />
            <a
              href="https://github.com/dexisback/cossie"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sound.playTap()}
              className="flex items-center justify-center p-1.5 rounded-lg border border-border bg-muted/40 text-foreground hover:bg-muted/70 hover:text-accent cursor-pointer transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]"
              title="View GitHub Repository"
            >
              <GithubIcon size={13} className="text-foreground" />
            </a>
            <div className="h-4 w-[1px] bg-border" />
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSound}
                className="p-2 border border-border hover:border-accent/40 hover:bg-muted/40 rounded-xl text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-[0.96]"
                title={soundEnabled ? "Mute Sounds" : "Unmute Sounds"}
              >
                {soundEnabled ? <Volume2 size={15} strokeWidth={1.75} /> : <VolumeX size={15} strokeWidth={1.75} />}
              </button>
              <button
                onClick={handleToggleTheme}
                className="p-2 border border-border hover:border-accent/40 hover:bg-muted/40 rounded-xl text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center active:scale-[0.96]"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 relative">
          {activeTab === "overview" && (
            <OverviewView onNavigate={setActiveTab} />
          )}
          {activeTab === "policies" && (
            <PoliciesView />
          )}
          {activeTab === "catalog" && (
            <ToolCatalogView />
          )}
          {activeTab === "servers" && (
            <McpServersView />
          )}
          {activeTab === "approvals" && (
            <ApprovalQueueView />
          )}
          {activeTab === "logs" && (
            <AuditLogsView />
          )}
          {activeTab === "playground" && (
            <PromptPlaygroundView />
          )}
          {activeTab === "demo" && (
            <DemoGuideView />
          )}
        </main>
      </div>

      <CommandSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={setActiveTab}
      />
    </div>
  );
}

