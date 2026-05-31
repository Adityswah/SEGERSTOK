import { db } from "@/db";
import { aiBotLogsTable } from "@/db/schema";
import { readAiSummaryForOwner, runAiPipeline, searchIngredientsForBot } from "@/lib/ai/pipeline";

type BotIntent = "INTERNAL_DATA" | "GENERAL_QA" | "UNCLEAR";
type BotFlow = "internal" | "general" | "clarification";

type BotResult = {
  reply: string;
  intent: BotIntent;
  flow: BotFlow;
  asOf: string | null;
  latestRun: Awaited<ReturnType<typeof readAiSummaryForOwner>>["latestRun"] | null;
  risks: Awaited<ReturnType<typeof readAiSummaryForOwner>>["risks"];
  weeklyProjection: Awaited<ReturnType<typeof readAiSummaryForOwner>>["projections"];
  buyRecommendations: Awaited<ReturnType<typeof readAiSummaryForOwner>>["recommendations"];
  relatedIngredients: Awaited<ReturnType<typeof searchIngredientsForBot>>;
};

type BotContext = {
  userId: string;
  message: string;
};

type AiSummary = Awaited<ReturnType<typeof readAiSummaryForOwner>>;
type RelatedIngredient = Awaited<ReturnType<typeof searchIngredientsForBot>>[number];

const STOPWORDS = new Set([
  "ada",
  "akan",
  "apa",
  "apakah",
  "atau",
  "bahan",
  "baku",
  "beli",
  "berapa",
  "besok",
  "bisa",
  "cari",
  "carikan",
  "data",
  "dari",
  "dengan",
  "harga",
  "harganya",
  "ini",
  "kalau",
  "kira",
  "mau",
  "membeli",
  "prediksi",
  "saya",
  "sisa",
  "stock",
  "stok",
  "terbaru",
  "untuk",
  "yang",
]);

const INTERNAL_KEYWORDS = [
  "ai",
  "ayam",
  "bahan",
  "beli",
  "cabai",
  "dashboard",
  "database",
  "harga",
  "laporan",
  "minyak",
  "prediksi",
  "proyeksi",
  "rekomendasi",
  "sisa",
  "stok",
  "stock",
  "transaksi",
];

const GENERAL_KEYWORDS = [
  "apa itu",
  "arti",
  "cara",
  "contoh",
  "definisi",
  "jelaskan",
  "konsep",
  "maksud",
  "pengertian",
  "saran umum",
  "strategi",
];

const VAGUE_MESSAGES = new Set(["gimana", "gimana ini", "ini gimana", "itu gimana", "kenapa", "berapa", "sisanya"]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bstock\b/g, "stok")
    .replace(/\s+/g, " ")
    .trim();
}

function searchableText(value: string) {
  return normalizeText(value).replace(/[^a-z0-9\s]/g, " ");
}

function preprocess(message: string) {
  return normalizeText(message)
    .replace(/\binpun\b/g, "input")
    .replace(/\bunutk\b/g, "untuk")
    .replace(/\bter integrasi\b/g, "terintegrasi")
    .replace(/\bkira2\b/g, "kira-kira");
}

function tokenizeMaterial(message: string) {
  return Array.from(
    new Set(
      searchableText(message)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
    ),
  );
}

function classifyIntent(cleanMessage: string): BotIntent {
  const tokens = searchableText(cleanMessage).split(/\s+/).filter(Boolean);

  if (tokens.length <= 2 && (VAGUE_MESSAGES.has(cleanMessage) || !tokens.some((token) => INTERNAL_KEYWORDS.includes(token)))) {
    return "UNCLEAR";
  }

  if (INTERNAL_KEYWORDS.some((keyword) => cleanMessage.includes(keyword))) {
    const hasObject = tokenizeMaterial(cleanMessage).length > 0;
    if (!hasObject && /(stok|harga|beli|prediksi|proyeksi|sisa)/.test(cleanMessage)) return "UNCLEAR";
    return "INTERNAL_DATA";
  }

  if (GENERAL_KEYWORDS.some((keyword) => cleanMessage.includes(keyword))) return "GENERAL_QA";

  return tokens.length <= 3 ? "UNCLEAR" : "GENERAL_QA";
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQty(value: unknown) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatRupiah(value: unknown) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(toNumber(value));
}

function formatPercent(value: unknown) {
  const number = toNumber(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(number)}%`;
}

function stockStatus(stock: number, minimumStock: number) {
  if (stock <= 0) return "Habis";
  if (stock <= minimumStock) return "Kritis";
  if (minimumStock > 0 && stock <= minimumStock * 1.25) return "Waspada";
  return "Aman";
}

function matchesTerms(text: string, terms: string[]) {
  if (!terms.length) return false;
  const normalized = searchableText(text);
  return terms.some((term) => normalized.includes(term));
}

function relatedIngredientIds(ingredients: RelatedIngredient[]) {
  return new Set(ingredients.map((item) => item.id));
}

async function readFreshSummary() {
  let summary = await readAiSummaryForOwner();
  if (!summary.risks.length && !summary.recommendations.length && !summary.projections.length) {
    await runAiPipeline();
    summary = await readAiSummaryForOwner();
  }
  return summary;
}

function buildInternalAnswer(cleanMessage: string, summary: AiSummary, relatedIngredients: RelatedIngredient[]) {
  const lower = searchableText(cleanMessage);
  const terms = tokenizeMaterial(cleanMessage);
  const materialLabel = terms.length ? terms.join(", ") : "bahan terkait";
  const ingredientIds = relatedIngredientIds(relatedIngredients);

  const wantsStock = /(sisa|stok|tersedia)/.test(lower);
  const wantsPrice = /(harga|prediksi|naik|turun|besok)/.test(lower);
  const wantsBuyTiming = /(kapan|waktu|rekomendasi|beli)/.test(lower);
  const wantsProjection = /(minggu|proyeksi|habis|cukup)/.test(lower);

  const matchedProjections = summary.projections
    .filter((item) => ingredientIds.has(item.ingredientId) || matchesTerms(item.ingredientName, terms))
    .slice(0, 3);
  const matchedRecommendations = summary.recommendations
    .filter((item) => ingredientIds.has(item.ingredientId) || matchesTerms(item.ingredientName, terms))
    .slice(0, 3);

  const lines: string[] = [];

  if (wantsStock) {
    if (!relatedIngredients.length) return `Saya belum menemukan stok untuk "${materialLabel}" di master bahan.`;

    const stockLines = relatedIngredients.slice(0, 3).map((item) => {
      const stock = toNumber(item.stock);
      const minimum = toNumber(item.minimumStock);
      return `${item.name}: ${formatQty(stock)} ${item.unit} (${stockStatus(stock, minimum)})`;
    });
    lines.push(`Stok ${materialLabel}: ${stockLines.join("; ")}.`);
  }

  if (wantsPrice) {
    lines.push(
      "Prediksi harga berbasis berita nasional sudah dinonaktifkan agar aplikasi lebih ringan. Saya tetap bisa bantu dari data internal: rekomendasi waktu beli dan proyeksi kebutuhan stok mingguan.",
    );
  }

  if (wantsBuyTiming) {
    const mainRecommendation = matchedRecommendations[0];
    if (mainRecommendation) {
      const action =
        mainRecommendation.action === "beli-sekarang"
          ? "beli sekarang"
          : mainRecommendation.action === "beli-bertahap"
            ? "beli bertahap"
            : "tunda beli";
      lines.push(
        `Saran saya: ${action} ${mainRecommendation.ingredientName} ${formatQty(mainRecommendation.recommendedQuantity)} ${mainRecommendation.ingredientUnit}.`,
      );
    } else {
      const criticalItem = relatedIngredients.find(
        (item) => stockStatus(toNumber(item.stock), toNumber(item.minimumStock)) !== "Aman",
      );
      lines.push(
        criticalItem
          ? `Saran saya: beli ${criticalItem.name} secukupnya sampai melewati minimum aman.`
          : "Saran saya: belum perlu beli mendadak, stok masih aman.",
      );
    }
  }

  if (wantsProjection) {
    const mainProjection = matchedProjections[0];
    lines.push(
      mainProjection
        ? `Proyeksi minggu ini: ${mainProjection.ingredientName} terpakai sekitar ${formatQty(mainProjection.predictedWeeklyUsage)} ${mainProjection.ingredientUnit}, sisa akhir minggu ${formatQty(mainProjection.predictedEndingStock)} ${mainProjection.ingredientUnit}.`
        : `Saya belum menemukan proyeksi mingguan untuk "${materialLabel}".`,
    );
  }

  if (!lines.length) {
    const urgentBuy = summary.recommendations
      .filter((item) => item.action === "beli-sekarang")
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 3);
    lines.push(
      urgentBuy.length
        ? `Prioritas hari ini: ${urgentBuy.map((item) => item.ingredientName).join(", ")}.`
        : "Belum ada bahan yang wajib dibeli sekarang. Pantau stok minimum dan jadwal pembelian bertahap.",
    );
  }

  lines.push(`Data: internal AI ${summary.asOf}.`);
  return lines.join("\n");
}

function buildGeneralAnswer(cleanMessage: string) {
  if (cleanMessage.includes("gross margin")) {
    return "Jawaban singkat: gross margin adalah persentase laba kotor dari penjualan.\nRumus: (Penjualan - HPP) / Penjualan x 100%.";
  }

  if (cleanMessage.includes("food cost")) {
    return "Jawaban singkat: food cost adalah biaya bahan makanan dibanding penjualan menu.\nPatokan restoran biasanya dipantau agar margin tidak bocor.";
  }

  if (cleanMessage.includes("stok opname")) {
    return "Jawaban singkat: stok opname adalah pengecekan stok fisik lalu dibandingkan dengan stok sistem.\nTujuannya menemukan selisih, kehilangan, atau salah input.";
  }

  if (cleanMessage.includes("fifo")) {
    return "Jawaban singkat: FIFO berarti bahan yang masuk lebih dulu dipakai lebih dulu.\nIni penting untuk bahan makanan agar kualitas dan umur simpan terjaga.";
  }

  return "Jawaban singkat: saya bisa bantu jelaskan konsep operasional, stok, finance, atau restoran.\nUntuk jawaban yang lebih presisi, sebutkan topik spesifiknya.";
}

function buildClarification(cleanMessage: string) {
  const likelyInternal = /(stok|harga|beli|prediksi|proyeksi|sisa)/.test(cleanMessage);
  if (likelyInternal) {
    return "Saya perlu memperjelas 1 hal dulu: bahan apa yang Anda maksud? Contoh: ayam, cabai rawit, beras, atau minyak goreng.";
  }

  return "Saya perlu memperjelas 1 hal dulu: yang ingin Anda cek itu data stok, proyeksi stok, rekomendasi beli, atau pertanyaan umum?";
}

function qualityGate(answer: string) {
  const cleanLines = answer
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const compact = cleanLines.slice(0, 4).join("\n");
  if (!compact) return "Saya belum bisa menjawab pertanyaan itu. Mohon sebutkan bahan atau topik yang ingin dicek.";
  if (compact.length <= 650) return compact;
  return `${compact.slice(0, 647).trim()}...`;
}

async function logInteraction(params: {
  answer: string;
  cleanMessage: string;
  flow: BotFlow;
  intent: BotIntent;
  message: string;
  metadata: Record<string, unknown>;
  userId: string;
}) {
  try {
    await db.insert(aiBotLogsTable).values({
      id: crypto.randomUUID(),
      userId: params.userId,
      message: params.message,
      cleanMessage: params.cleanMessage,
      intent: params.intent,
      flow: params.flow,
      answer: params.answer,
      metadataJson: JSON.stringify(params.metadata),
    });
  } catch (error) {
    console.warn("AI bot logging skipped", error);
  }
}

export async function handleAiBotMessage({ userId, message }: BotContext): Promise<BotResult> {
  const cleanMessage = preprocess(message);
  const intent = classifyIntent(cleanMessage);

  let reply = "";
  let flow: BotFlow = "clarification";
  let summary: AiSummary | null = null;
  let relatedIngredients: Awaited<ReturnType<typeof searchIngredientsForBot>> = [];

  if (intent === "INTERNAL_DATA") {
    flow = "internal";
    summary = await readFreshSummary();
    relatedIngredients = await searchIngredientsForBot(cleanMessage);
    reply = buildInternalAnswer(cleanMessage, summary, relatedIngredients);
  } else if (intent === "GENERAL_QA") {
    flow = "general";
    reply = buildGeneralAnswer(cleanMessage);
  } else {
    flow = "clarification";
    reply = buildClarification(cleanMessage);
  }

  const finalReply = qualityGate(reply);

  await logInteraction({
    answer: finalReply,
    cleanMessage,
    flow,
    intent,
    message,
    metadata: {
      relatedIngredientCount: relatedIngredients.length,
      summaryDate: summary?.asOf ?? null,
    },
    userId,
  });

  return {
    reply: finalReply,
    intent,
    flow,
    asOf: summary?.asOf ?? null,
    latestRun: summary?.latestRun ?? null,
    risks: summary?.risks.slice(0, 8) ?? [],
    weeklyProjection: summary?.projections.slice(0, 8) ?? [],
    buyRecommendations: summary?.recommendations.slice(0, 8) ?? [],
    relatedIngredients,
  };
}
