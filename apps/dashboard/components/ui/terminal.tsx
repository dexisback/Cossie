"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const KEY_SOUNDS_DOWN: Record<string, [number, number]> = {
  A: [31542, 85],
  B: [40621, 107],
  C: [39632, 95],
  D: [32492, 85],
  E: [23317, 83],
  F: [32973, 87],
  G: [33453, 94],
  H: [33986, 93],
  I: [25795, 91],
  J: [34425, 88],
  K: [34932, 90],
  L: [35410, 95],
  M: [41610, 93],
  N: [41103, 90],
  O: [26309, 84],
  P: [26804, 83],
  Q: [22245, 95],
  R: [23817, 92],
  S: [32031, 88],
  T: [24297, 92],
  U: [25313, 95],
  V: [40136, 94],
  W: [22790, 89],
  X: [39148, 76],
  Y: [24811, 93],
  Z: [38694, 80],
  " ": [51541, 144],
  "-": [42594, 90],
  "@": [23317, 83],
  "/": [42594, 90],
  ".": [42594, 90],
  ":": [42594, 90],
  "0": [26309, 84],
  "1": [25313, 95],
  "2": [23317, 83],
  "3": [23817, 92],
  "4": [24297, 92],
  "5": [24811, 93],
  "6": [25313, 95],
  "7": [25795, 91],
  "8": [26309, 84],
  "9": [26804, 83],
  Enter: [19065, 110],
};

const KEY_SOUNDS_UP: Record<string, [number, number]> = {
  A: [31632, 80],
  B: [40736, 95],
  C: [39732, 85],
  D: [32577, 80],
  E: [23402, 80],
  F: [33063, 80],
  G: [33553, 85],
  H: [34081, 85],
  I: [25890, 85],
  J: [34515, 85],
  K: [35027, 85],
  L: [35510, 85],
  M: [41710, 85],
  N: [41198, 85],
  O: [26394, 80],
  P: [26889, 80],
  Q: [22345, 85],
  R: [23912, 85],
  S: [32121, 80],
  T: [24392, 85],
  U: [25413, 85],
  V: [40236, 85],
  W: [22880, 85],
  X: [39228, 70],
  Y: [24911, 85],
  Z: [38779, 75],
  " ": [51691, 130],
  "-": [42689, 85],
  "@": [23402, 80],
  "/": [42689, 85],
  ".": [42689, 85],
  ":": [42689, 85],
  "0": [26394, 80],
  "1": [25413, 85],
  "2": [23402, 80],
  "3": [23912, 85],
  "4": [24392, 85],
  "5": [24911, 85],
  "6": [25413, 85],
  "7": [25890, 85],
  "8": [26394, 80],
  "9": [26889, 80],
  Enter: [19180, 100],
};

function useAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const init = async () => {
      try {
        ctxRef.current = new AudioContext();
        const res = await fetch("/sounds/sound.ogg");
        if (!res.ok) return;
        bufferRef.current = await ctxRef.current.decodeAudioData(
          await res.arrayBuffer(),
        );
        readyRef.current = true;
      } catch {}
    };
    init();
    return () => {
      ctxRef.current?.close();
    };
  }, [enabled]);

  const playSound = (sound: [number, number] | undefined) => {
    if (!readyRef.current || !ctxRef.current || !bufferRef.current || !sound)
      return;
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    const src = ctxRef.current.createBufferSource();
    src.buffer = bufferRef.current;
    src.connect(ctxRef.current.destination);
    src.start(0, sound[0] / 1000, sound[1] / 1000);
  };

  const down = (key: string) =>
    playSound(KEY_SOUNDS_DOWN[key.toUpperCase()] || KEY_SOUNDS_DOWN[key]);
  const up = (key: string) =>
    playSound(KEY_SOUNDS_UP[key.toUpperCase()] || KEY_SOUNDS_UP[key]);

  return { down, up };
}

function useInView(ref: React.RefObject<HTMLElement | null>, once = true) {
  const [inView, setInView] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || (once && triggered.current)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          setInView(true);
          if (once) {
            triggered.current = true;
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, once]);

  return inView;
}

type TokenType =
  | "command"
  | "flag"
  | "string"
  | "number"
  | "operator"
  | "path"
  | "variable"
  | "comment"
  | "default";

interface Token {
  type: TokenType;
  value: string;
}

function tokenizeBash(text: string): Token[] {
  const tokens: Token[] = [];
  const words = text.split(/(\s+)/);

  let isFirstWord = true;

  for (const word of words) {
    if (/^\s+$/.test(word)) {
      tokens.push({ type: "default", value: word });
      continue;
    }

    if (word.startsWith("#")) {
      tokens.push({ type: "comment", value: word });
      continue;
    }

    if (word.startsWith("$")) {
      tokens.push({ type: "variable", value: word });
      isFirstWord = false;
      continue;
    }

    if (word.startsWith("--") || word.startsWith("-")) {
      tokens.push({ type: "flag", value: word });
      isFirstWord = false;
      continue;
    }

    if (/^["'].*["']$/.test(word)) {
      tokens.push({ type: "string", value: word });
      isFirstWord = false;
      continue;
    }

    if (/^\d+$/.test(word)) {
      tokens.push({ type: "number", value: word });
      isFirstWord = false;
      continue;
    }

    if (/^[|>&<]+$/.test(word)) {
      tokens.push({ type: "operator", value: word });
      isFirstWord = true;
      continue;
    }

    if (word.includes("/") || word.startsWith(".") || word.startsWith("~")) {
      tokens.push({ type: "path", value: word });
      isFirstWord = false;
      continue;
    }

    if (isFirstWord) {
      tokens.push({ type: "command", value: word });
      isFirstWord = false;
      continue;
    }

    tokens.push({ type: "default", value: word });
  }

  return tokens;
}

const tokenColors: Record<TokenType, string> = {
  command: "text-emerald-400",
  flag: "text-sky-400",
  string: "text-amber-300",
  number: "text-purple-400",
  operator: "text-red-400",
  path: "text-cyan-300",
  variable: "text-pink-400",
  comment: "text-neutral-500",
  default: "text-neutral-300",
};

function SyntaxHighlightedText({ text }: { text: string }) {
  const tokens = tokenizeBash(text);

  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className={tokenColors[token.type]}>
          {token.value}
        </span>
      ))}
    </>
  );
}

export interface TerminalLine {
  type: "command" | "output";
  content: string;
}

export interface FAQItem {
  q: string;
  cmd: string;
}

const defaultFAQs: FAQItem[] = [
  {
    q: "How does the Policy Engine evaluate requests?",
    cmd: "cossie --status",
  },
  {
    q: "What happens if a prompt injection is detected?",
    cmd: 'cossie evaluate --prompt "Ignore rules..."',
  },
  {
    q: "How are file path access restrictions enforced?",
    cmd: 'cossie run --tool filesystem:read_file --path "/etc/passwd"',
  },
];

export interface TerminalProps {
  commands?: string[];
  outputs?: Record<number, string[]>;
  username?: string;
  className?: string;
  typingSpeed?: number;
  delayBetweenCommands?: number;
  initialDelay?: number;
  enableSound?: boolean;
  faqList?: FAQItem[];
  loop?: boolean;
  onSelectFAQ?: (item: FAQItem) => void;
  interactive?: boolean;
  liveInput?: string;
  history?: TerminalLine[];
}

export function Terminal({
  commands = ["npx shadcn@latest init"],
  outputs = {},
  username = "Manus-Macbook",
  className,
  typingSpeed = 50,
  delayBetweenCommands = 800,
  initialDelay = 500,
  enableSound = true,
  faqList = defaultFAQs,
  loop = true,
  onSelectFAQ,
  interactive = false,
  liveInput = "",
  history = [],
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const { down, up } = useAudio(enableSound);

  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [commandIdx, setCommandIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [outputIdx, setOutputIdx] = useState(-1);
  const [phase, setPhase] = useState<
    "idle" | "typing" | "executing" | "outputting" | "pausing" | "done"
  >("idle");
  const [cursorVisible, setCursorVisible] = useState(true);

  const currentCommand = commands[commandIdx] || "";
  const currentOutputs = useMemo(
    () => outputs[commandIdx] || [],
    [outputs, commandIdx],
  );
  const isLastCommand = commandIdx === commands.length - 1;

  useEffect(() => {
    if (interactive || !inView || phase !== "idle") return;
    const t = setTimeout(() => setPhase("typing"), initialDelay);
    return () => clearTimeout(t);
  }, [inView, phase, initialDelay, interactive]);

  useEffect(() => {
    if (interactive || phase !== "typing") return;

    if (charIdx < currentCommand.length) {
      const char = currentCommand[charIdx];
      down(char);
      const t = setTimeout(
        () => {
          up(char);
          setCurrentText(currentCommand.slice(0, charIdx + 1));
          setCharIdx((c) => c + 1);
        },
        typingSpeed + Math.random() * 30,
      );
      return () => clearTimeout(t);
    } else {
      down("Enter");
      const t = setTimeout(() => {
        up("Enter");
        setPhase("executing");
      }, 80);
      return () => clearTimeout(t);
    }
  }, [phase, charIdx, currentCommand, typingSpeed, down, up, interactive]);

  useEffect(() => {
    if (interactive || phase !== "executing") return;

    setLines((prev) => [...prev, { type: "command", content: currentCommand }]);
    setCurrentText("");

    if (currentOutputs.length > 0) {
      setOutputIdx(0);
      setPhase("outputting");
    } else if (isLastCommand) {
      setPhase("done");
    } else {
      setPhase("pausing");
    }
  }, [
    phase,
    currentCommand,
    currentOutputs.length,
    isLastCommand,
    interactive,
  ]);

  useEffect(() => {
    if (interactive || phase !== "outputting") return;

    if (outputIdx >= 0 && outputIdx < currentOutputs.length) {
      const t = setTimeout(() => {
        setLines((prev) => [
          ...prev,
          { type: "output", content: currentOutputs[outputIdx] },
        ]);
        setOutputIdx((i) => i + 1);
      }, 150);
      return () => clearTimeout(t);
    } else if (outputIdx >= currentOutputs.length) {
      const t = setTimeout(() => {
        if (isLastCommand) {
          setPhase("done");
        } else {
          setPhase("pausing");
        }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [phase, outputIdx, currentOutputs, isLastCommand, interactive]);

  useEffect(() => {
    if (interactive || phase !== "pausing") return;
    const t = setTimeout(() => {
      setCharIdx(0);
      setOutputIdx(-1);
      setCommandIdx((c) => c + 1);
      setPhase("typing");
    }, delayBetweenCommands);
    return () => clearTimeout(t);
  }, [phase, delayBetweenCommands, interactive]);

  useEffect(() => {
    if (interactive || phase !== "done" || !loop) return;
    const t = setTimeout(() => {
      setLines([]);
      setCharIdx(0);
      setOutputIdx(-1);
      setCommandIdx(0);
      setPhase("typing");
    }, 3000);
    return () => clearTimeout(t);
  }, [phase, loop, interactive]);

  useEffect(() => {
    const interval = setInterval(() => setCursorVisible((v) => !v), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [lines, phase, history, liveInput]);

  const prompt = (
    <span className="text-neutral-500">
      <span className="text-sky-500">{username}</span>
      <span className="text-emerald-600">:</span>
      <span className="text-sky-400">~</span>
      <span className="text-neutral-500">$</span>{" "}
    </span>
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "mx-auto w-full max-w-xl px-4 font-mono text-xs",
        className,
      )}
    >
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-[0_4px_6px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.15),0_16px_32px_rgba(0,0,0,0.12)]">
        {/* Title Bar */}
        <div className="flex items-center justify-between bg-neutral-800 px-4 py-3 border-b border-neutral-700/50">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500 transition-all duration-200 hover:bg-red-600 hover:scale-110 active:scale-[0.96] cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
            <div className="h-3 w-3 rounded-full bg-yellow-500 transition-all duration-200 hover:bg-yellow-600 hover:scale-110 active:scale-[0.96] cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
            <div className="h-3 w-3 rounded-full bg-green-500 transition-all duration-200 hover:bg-green-600 hover:scale-110 active:scale-[0.96] cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
          </div>
          <div className="text-center flex-1">
            <span className="truncate text-xs text-neutral-400">
              {username} — bash
            </span>
          </div>
          <div className="relative group">
            <button
              type="button"
              className="px-2 py-0.5 rounded-full bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 text-[10px] font-mono text-neutral-300 transition-all duration-200 font-semibold active:scale-[0.96] cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.25)] hover:border-neutral-500"
            >
              FAQ
            </button>
            <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-xl border border-neutral-800 bg-neutral-950 text-left shadow-[0_4px_8px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)] opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 origin-top-right z-50">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2 border-b border-neutral-800 pb-1">
                Frequently Asked Questions
              </h4>
              <div className="space-y-2">
                {faqList.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <p className="text-[10px] font-medium text-neutral-200 leading-normal">
                      Q: {item.q}
                    </p>
                    <div className="flex items-center justify-between gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-md font-mono text-[9px] text-neutral-400 tabular-nums">
                      <span className="truncate max-w-[150px]">{item.cmd}</span>
                      <button
                        onClick={() => onSelectFAQ?.(item)}
                        type="button"
                        className="px-1 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 transition-all duration-150 font-semibold active:scale-[0.96] cursor-pointer hover:shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                      >
                        Run
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Terminal Content */}
        <div
          ref={contentRef}
          className="no-visible-scrollbar h-80 overflow-y-auto p-4 font-mono scroll-smooth"
          style={{ scrollBehavior: "smooth" }}
        >
          {(interactive ? history : lines).map((line, i) => (
            <div key={i} className="leading-relaxed whitespace-pre-wrap">
              {line.type === "command" ? (
                <span>
                  {prompt}
                  <SyntaxHighlightedText text={line.content} />
                </span>
              ) : (
                <span className="text-neutral-400">{line.content}</span>
              )}
            </div>
          ))}

          {interactive && (
            <div className="leading-relaxed whitespace-pre-wrap">
              {prompt}
              <SyntaxHighlightedText text={liveInput} />
              <span
                className={cn(
                  "ml-0.5 inline-block h-4 w-2 bg-neutral-300 align-middle transition-opacity duration-150 ease-linear",
                  cursorVisible ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
          )}

          {!interactive && phase === "typing" && (
            <div className="leading-relaxed whitespace-pre-wrap">
              {prompt}
              <SyntaxHighlightedText text={currentText} />
              <span className="ml-0.5 inline-block h-4 w-2 bg-neutral-300 align-middle shadow-[0_0_4px_rgba(212,212,212,0.4)]" />
            </div>
          )}

          {!interactive &&
            (phase === "done" ||
              phase === "pausing" ||
              phase === "outputting") && (
              <div className="leading-relaxed whitespace-pre-wrap">
                {prompt}
                <span
                  className={cn(
                    "inline-block h-4 w-2 bg-neutral-300 align-middle transition-opacity duration-150 ease-linear",
                    cursorVisible ? "opacity-100" : "opacity-0",
                  )}
                />
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
