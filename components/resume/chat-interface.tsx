"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PdfUploader } from "@/components/resume/pdf-uploader";
import { generateId, cn } from "@/lib/utils";
import type { ChatMessage, ResumeProfile } from "@/lib/types";
import { Send, FileUp, ChevronDown } from "lucide-react";

interface Props {
  onResumeUpdate: (resume: Partial<ResumeProfile>) => void;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm here to help build your resume. You can dump your experience in plain English — no need to format anything.\n\nTry: *\"I interned at Capital One last summer, built an internal React dashboard, and helped reduce analyst load time by 40%\"*\n\nOr upload an existing PDF and I'll parse and improve it.",
  timestamp: new Date(),
};

const PROMPTS = [
  "Tell me about your most recent internship or job",
  "Add your education (school, degree, graduation year)",
  "What technical skills do you have?",
  "Any leadership, research, or club activities?",
];

export function ChatInterface({ onResumeUpdate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generating]);

  async function sendMessage(content: string) {
    if (!content.trim() || generating) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setGenerating(true);

    // Optimistic assistant placeholder
    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    try {
      const res = await fetch("/api/resume/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE lines
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const { text } = JSON.parse(data);
              if (text) {
                fullText += text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullText } : m
                  )
                );
              }
            } catch {
              // non-JSON line, skip
            }
          }
        }
      }

      // After streaming, try to extract structured resume data
      try {
        const jsonMatch = fullText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.extracted) {
            onResumeUpdate(parsed.extracted);
          }
        }
      } catch {
        // No structured data in this response, that's fine
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "Sorry, I ran into an issue. Please try again.",
              }
            : m
        )
      );
    } finally {
      setGenerating(false);
      textareaRef.current?.focus();
    }
  }

  function handlePdfParsed(text: string) {
    setShowUploader(false);
    sendMessage(
      `Here's my existing resume — please parse it and structure it:\n\n${text}`
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {generating && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-1 px-3 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-dot"
                style={{ animationDelay: `${i * 0.16}s` }}
              />
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length === 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="text-xs rounded-full border border-gray-200 bg-white px-3 py-1.5 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* PDF uploader (collapsible) */}
      {showUploader && (
        <div className="px-4 pb-3 animate-slide-up">
          <PdfUploader onParsed={handlePdfParsed} />
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex gap-2 items-end">
          <button
            onClick={() => setShowUploader((v) => !v)}
            className={cn(
              "shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
              showUploader
                ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                : "border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:border-gray-300"
            )}
            title="Upload PDF"
          >
            <FileUp className="w-4 h-4" />
          </button>

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your experience, or paste your resume..."
            className="flex-1 min-h-[40px] max-h-[160px] resize-none"
            rows={1}
          />

          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || generating}
            loading={generating}
            className="shrink-0 h-9 w-9 p-0"
          >
            {!generating && <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (!message.content) return null;

  // Strip json code blocks from display
  const displayContent = message.content.replace(/```json[\s\S]*?```/g, "").trim();

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold mr-2 mt-0.5">
          A
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-indigo-600 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-900 rounded-bl-sm"
        )}
      >
        {displayContent}
      </div>
    </div>
  );
}
