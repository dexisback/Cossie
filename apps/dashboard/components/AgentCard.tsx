"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Conversation } from "./Conversation";
import { PromptInput } from "./PromptInput";
import { ChatMessage } from "./MessageBubble";
import { Terminal, FAQItem } from "./ui/terminal";
import { api } from "../lib/api";

const agentCommands = [
  "cossie agent status",
  'cossie run --tool fetch-web --url "https://api.github.com"',
  'cossie policy check --action write_file --path "/var/log/syslog"',
];

const agentOutputs = {
  0: [
    "Agent backend status: ACTIVE",
    "Connected to client on port 4000",
    "Evaluated 28 policy requests in last 24h",
  ],
  1: [
    "Evaluating URL request against network policies...",
    "Policy result: ALLOWED (fetch-web domain check passed)",
    "Status code: 200 OK (payload: 1.2KB)",
  ],
  2: [
    "Evaluating filesystem policy...",
    "Policy result: BLOCKED (write-access unauthorized for '/var/log/syslog')",
    "Alert dispatched to Security Console.",
  ],
};

const agentFAQs: FAQItem[] = [
  {
    q: "How do I check live agent connection status?",
    cmd: "cossie agent status",
  },
  {
    q: "Can the agent fetch data from external URLs?",
    cmd: 'cossie run --tool fetch-web --url "https://api.github.com"',
  },
  {
    q: "What happens if a tool modifies critical files?",
    cmd: 'cossie policy check --action write_file --path "/var/log/syslog"',
  },
];

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

  const chatMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const res = await api.post("/api/chat", { message: messageText });
      if (!res.ok) {
        throw new Error("API call failed");
      }
      return res.json();
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
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          content: "Unable to contact the agent.",
          createdAt: new Date(),
        },
      ]);
    },
  });

  function handleSend() {
    const trimmed = inputVal.trim();
    if (!trimmed || chatMutation.isPending) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: trimmed,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    chatMutation.mutate(trimmed);
  }

  function handleSelectPrompt(prompt: string) {
    setInputVal(prompt);
  }

  function handleRunPrompt(prompt: string) {
    if (chatMutation.isPending) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: prompt,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    chatMutation.mutate(prompt);
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
  }, [chatMutation.isPending]);

  return (
    <div className="flex flex-col h-full min-h-[480px] bg-card/40 backdrop-blur-sm rounded-2xl border border-white/[0.02] shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.04)] transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]">
      <div className="flex items-center gap-2.5 mb-4 pb-3.5 border-b border-white/[0.04]">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
          AI Agent Console
        </h3>
      </div>

      <div className="flex-1 flex flex-col min-h-0 mb-4 justify-center">
        {messages.length <= 1 ? (
          <Terminal
            commands={agentCommands}
            outputs={agentOutputs}
            faqList={agentFAQs}
            onSelectFAQ={(item) => handleRunPrompt(item.q)}
            username="Cossie-Agent"
            className="w-full max-w-2xl px-0 shadow-none border-0"
          />
        ) : (
          <Conversation messages={messages} loading={chatMutation.isPending} />
        )}
      </div>

      <div className="space-y-2.5 pb-4">
        <PromptInput
          value={inputVal}
          onChange={setInputVal}
          onSend={handleSend}
          disabled={chatMutation.isPending}
        />
        <p className="text-[10px] text-muted-foreground/80 font-medium italic leading-relaxed">
          Tool calls are evaluated by the Policy Engine before execution.
        </p>
      </div>
    </div>
  );
}
