"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { SendHorizontal, Square } from "lucide-react";
import { Conversation } from "./Conversation";
import { ChatMessage } from "./MessageBubble";
import { api } from "../lib/api";

function Bolt({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`absolute ${className} h-2.5 w-2.5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)] bg-[radial-gradient(circle_at_32%_30%,#f0f0f3,#c6c6cd_52%,#87878f)] dark:bg-[radial-gradient(circle_at_32%_30%,#55555e,#303037_52%,#17171c)]`}
    >
      <div className="absolute left-1/2 top-1/2 h-[1.5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-black/35 dark:bg-black/60" />
    </div>
  );
}

function BootBlock() {
  const reduce = useReducedMotion();
  return (
    <div className="h-full flex flex-col justify-center px-6 py-8 text-xs space-y-2.5">
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0, delay: 0.35 }}
        className="flex items-center gap-2 text-[#3ecf8e]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]/80" />
        policy engine active
      </motion.p>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          duration: 0.5,
          bounce: 0,
          delay: 0.47,
        }}
        className="text-white/35"
      >
        tool calls are evaluated before execution
      </motion.p>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          duration: 0.5,
          bounce: 0,
          delay: 0.59,
        }}
        className="text-white/35"
      >
        type a message below to begin
      </motion.p>
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex items-center gap-2 pt-1 text-white/70"
      >
        <span className="text-[#3ecf8e]/80">$</span>
        <span
          aria-hidden
          className="cursor-block inline-block h-[14px] w-[8px] bg-[#d4d4d8]"
        />
      </motion.p>
    </div>
  );
}

export function AgentCard() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! Ask me to interact with your MCP tools.",
      createdAt: new Date(),
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const reduce = useReducedMotion();

  const chatMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await api.post(
          "/api/chat",
          { message: messageText },
          { signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error("API call failed");
        }
        return res.json();
      } finally {
        abortRef.current = null;
      }
    },
    onSuccess: (data) => {
      const replyContent = data.response || "No response content from agent.";
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content: replyContent,
          createdAt: new Date(),
        },
      ]);
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${error.name === "AbortError" ? "stopped" : "error"}`,
          role: "assistant",
          content:
            error.name === "AbortError"
              ? "response stopped"
              : "Unable to contact the agent.",
          createdAt: new Date(),
        },
      ]);
    },
  });

  // Flush the queue: whenever the agent goes idle and messages are waiting,
  // send the next one (one at a time, in order).
  useEffect(() => {
    if (chatMutation.isPending || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    pushUserAndSend(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, chatMutation.isPending]);

  // Abort any in-flight request if the card unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  function pushUserAndSend(text: string) {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: text,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    chatMutation.mutate(text);
  }

  function handleSend() {
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    setInputVal("");

    // Agent busy? Queue the message — it sends automatically when idle.
    if (chatMutation.isPending) {
      setQueue((q) => [...q, trimmed]);
      return;
    }
    pushUserAndSend(trimmed);
  }

  function handleStop() {
    abortRef.current?.abort();
    setQueue([]);
  }

  function handleSelectPrompt(prompt: string) {
    setInputVal(prompt);
  }

  function handleRunPrompt(prompt: string) {
    if (chatMutation.isPending) {
      setQueue((q) => [...q, prompt]);
      return;
    }
    pushUserAndSend(prompt);
  }

  useEffect(() => {
    function onSelectPrompt(e: Event) {
      handleSelectPrompt((e as CustomEvent).detail);
    }
    function onRunPrompt(e: Event) {
      handleRunPrompt((e as CustomEvent).detail);
    }
    window.addEventListener("cossie:select-prompt", onSelectPrompt);
    window.addEventListener("cossie:run-prompt", onRunPrompt);
    return () => {
      window.removeEventListener("cossie:select-prompt", onSelectPrompt);
      window.removeEventListener("cossie:run-prompt", onRunPrompt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMutation.isPending]);

  const inConversation = messages.length > 1;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 28, scale: 0.975, rotate: -0.5 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", duration: 0.85, bounce: 0.16 }
      }
      style={{
        boxShadow:
          "0 0 0 1px var(--border), 0 1px 2px rgba(22,25,37,0.04), 0 8px 24px rgba(22,25,37,0.05), 0 24px 56px rgba(22,25,37,0.06)",
      }}
      className="relative rounded-[24px] p-3.5 bg-card"
    >
      <Bolt className="top-[7px] left-[10px]" />
      <Bolt className="top-[7px] right-[10px]" />

      {/* Screen — always dark, Ghostty-like surface, mounted inside the plate */}
      <div
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.035), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(0,0,0,0.4)",
        }}
        className="terminal-screen flex flex-col h-[400px] rounded-[10px] overflow-hidden bg-[#0b0e13]/95 backdrop-blur-md"
      >
        {/* Title bar */}
        <div className="relative flex items-center h-9 px-3.5 shrink-0 border-b border-white/[0.05] bg-white/[0.015]">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/85" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/85" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/85" />
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 text-[10px] text-white/35">
            cossie-agent — session
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0">
          {inConversation ? (
            <Conversation
              messages={messages}
              loading={chatMutation.isPending}
            />
          ) : (
            <BootBlock />
          )}
        </div>

        {/* Command line */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-white/[0.05] transition-colors duration-150 focus-within:bg-white/[0.02]">
          <span className="text-xs text-[#3ecf8e]/80 shrink-0 select-none">
            $
          </span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              chatMutation.isPending
                ? "agent is responding — keep typing, your message will queue…"
                : "type a command or message…"
            }
            aria-label="Message input"
            className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-white/25 caret-[#3ecf8e] focus:outline-none"
          />
          {chatMutation.isPending ? (
            <button
              type="button"
              onClick={handleStop}
              aria-label="Stop response"
              title="Stop response"
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-accent text-accent-foreground shrink-0 cursor-pointer transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96]"
            >
              <Square size={10} fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputVal.trim()}
              aria-label="Send message"
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-accent text-accent-foreground shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96]"
            >
              <SendHorizontal size={12} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
