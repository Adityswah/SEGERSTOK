"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PageId, Role } from "@/lib/data";
import { cn } from "@/lib/utils";

type AiSummaryResponse = {
  asOf: string;
  latestRun: { status: "success" | "partial" | "failed"; startedAt: string } | null;
  recommendations: Array<{
    id: string;
    ingredientName: string;
    ingredientUnit: string;
    action: "beli-sekarang" | "beli-bertahap" | "tunda-beli";
    recommendedQuantity: string;
    priorityScore: number;
  }>;
};

type BotMessage = {
  id: string;
  role: "assistant" | "owner";
  text: string;
  createdAt: string;
};

type BotQueryResponse = {
  reply: string;
  asOf: string;
  latestRun: { status: "success" | "partial" | "failed"; startedAt: string } | null;
  integratedFeatures: string[];
  excludedFeatures: string[];
};

type ApiEnvelope<T> = {
  data: T;
};

export function OwnerAiBot({
  role,
}: {
  role: Role;
  activePage: PageId;
}) {
  const [open, setOpen] = useState(false);
  const [cursorOffsetY, setCursorOffsetY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [loadingAsk, setLoadingAsk] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<BotMessage[]>([]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setCursorOffsetY(0);
      return;
    }

    const handleMove = (event: MouseEvent) => {
      const ratio = event.clientY / Math.max(window.innerHeight, 1);
      setCursorOffsetY((ratio - 0.5) * 30);
    };

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [isMobile]);

  async function refreshAiNow() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/ai/refresh", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Gagal refresh pipeline AI");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Pipeline AI berhasil di-refresh. Data proyeksi dan rekomendasi pembelian sudah diperbarui.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: error instanceof Error ? error.message : "Refresh pipeline gagal",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function askBot() {
    if (!input.trim()) return;

    const question = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "owner", text: question, createdAt: new Date().toISOString() },
    ]);

    setLoadingAsk(true);
    try {
      const response = await fetch("/api/ai-bot/query", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<BotQueryResponse>;
      if (!response.ok) throw new Error("AI bot gagal memproses pertanyaan");

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload.data.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: error instanceof Error ? error.message : "AI bot gagal memproses pertanyaan",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoadingAsk(false);
    }
  }

  if (role !== "Owner") return null;

  return (
    <div
      className="pointer-events-none fixed bottom-24 right-4 z-50 md:bottom-4"
      style={{
        transform: `translateY(${isMobile ? 0 : cursorOffsetY}px)`,
      }}
    >
      {!open && (
        <Button
          className="pointer-events-auto h-14 rounded-full border border-primary/30 bg-[#1A1612] px-5 text-primary shadow-brand hover:bg-[#3D3328]"
          onClick={() => setOpen(true)}
          size="lg"
        >
          <DiamondGlyph className="size-5" />
          Tanyakan saya
        </Button>
      )}

      {open && (
        <Card className="pointer-events-auto w-[calc(100vw-2rem)] max-w-[420px] border-primary/25 bg-card shadow-brand">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-8 shrink-0 place-items-center text-primary">
                  <DiamondGlyph className="size-6" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base">Tanyakan saya</CardTitle>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button className="h-8 px-2" onClick={() => void refreshAiNow()} size="sm" variant="outline">
                  {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                </Button>
                <Button className="h-8 px-2" onClick={() => setOpen(false)} size="sm" variant="outline">
                  Tutup
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-md border bg-muted/35 p-2">
              {messages.length ? (
                messages.map((message) => (
                  <div
                    className={cn(
                      "whitespace-pre-line break-words rounded-md px-3 py-2 text-sm leading-6",
                      message.role === "assistant" ? "bg-primary/10 text-foreground" : "bg-card text-foreground",
                    )}
                    key={message.id}
                  >
                    {message.text}
                  </div>
                ))
              ) : (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">Tulis pertanyaan operasional Anda.</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void askBot();
                  }
                }}
                placeholder="Tanya: bahan prioritas beli hari ini?"
                value={input}
              />
              <Button disabled={loadingAsk || !input.trim()} onClick={() => void askBot()} size="icon">
                {loadingAsk ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DiamondGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 236 310">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(118 155)">
        <path d="M-118 0 0-155 118 0 0 155-118 0Z" stroke="currentColor" strokeWidth="14" opacity="0.8" />
        <path d="M0 155 98.3 25.8M0 155 84.3-44.3M0 155 50.6-88.6M0 155 16.9-132.9M0 155V-155M0 155-16.9-132.9M0 155-50.6-88.6M0 155-84.3-44.3M0 155-98.3 25.8" stroke="currentColor" strokeWidth="10" />
      </g>
    </svg>
  );
}
