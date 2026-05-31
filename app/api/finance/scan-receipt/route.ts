import { and, eq, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable } from "@/db/schema";
import { canInputFinance, getRole, requireSession } from "@/lib/api/authz";
import { badRequest, forbidden, ok, payloadTooLarge, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation } from "@/lib/api/security";

const scanItemSchema = z.object({
  itemName: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().nonnegative().default(0),
});

const scanResponseSchema = z.object({
  items: z.array(scanItemSchema).max(20).default([]),
  note: z.string().trim().max(500).optional(),
});

function imageMimeToDataUrl(mime: string, buffer: ArrayBuffer) {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mime};base64,${base64}`;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const directText = (payload as { output_text?: unknown }).output_text;
  if (typeof directText === "string") return directText;

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      const content = item && typeof item === "object" ? (item as { content?: unknown }).content : null;
      return Array.isArray(content) ? content : [];
    })
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "finance:scan-receipt", limit: 12, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (!canInputFinance(getRole(session))) return forbidden("Hanya Owner dan Kasir yang bisa scan bukti finance");

    const formData = await request.formData();
    const image = formData.get("image");
    const category = String(formData.get("category") ?? "");
    if (!(image instanceof File)) return badRequest("Bukti foto wajib dikirim");
    if (!image.type.startsWith("image/")) return badRequest("File harus berupa gambar");
    if (image.size > 4_000_000) return payloadTooLarge("Ukuran foto maksimal 4 MB");

    const ingredientClauses: SQL[] = [eq(ingredientsTable.active, true)];

    const ingredients = await db
      .select({
        id: ingredientsTable.id,
        name: ingredientsTable.name,
        category: ingredientsTable.category,
        unit: ingredientsTable.unit,
        averagePrice: ingredientsTable.averagePrice,
      })
      .from(ingredientsTable)
      .where(and(...ingredientClauses));

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return badRequest("OPENAI_API_KEY belum tersedia. Foto sudah bisa diupload, tetapi scan AI belum aktif di environment ini.");
    }

    const dataUrl = imageMimeToDataUrl(image.type, await image.arrayBuffer());
    const ingredientList = ingredients.map((item) => `${item.name} (${item.unit})`).join(", ");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Baca nota/struk pengeluaran usaha makanan dari gambar. Kembalikan JSON valid saja dengan format " +
                  '{"items":[{"itemName":"nama","quantity":1,"unitPrice":10000}],"note":"ringkas"}. ' +
                  "unitPrice adalah harga satuan rupiah, bukan total baris. Maksimal 20 item. " +
                  (category === "keperluan_stock"
                    ? `Cocokkan item dengan master barang berikut: ${ingredientList}. Jika tidak yakin, pakai nama pada struk.`
                    : "Untuk non-stock, pakai nama/keterangan yang tertulis di struk."),
              },
              { type: "input_image", image_url: dataUrl },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return badRequest(`Scan AI gagal diproses${text ? `: ${text.slice(0, 180)}` : ""}`);
    }

    const payload = await response.json();
    const rawText = extractResponseText(payload);
    if (!rawText) return badRequest("Scan AI tidak mengembalikan teks yang bisa dibaca");
    const jsonText = rawText.match(/\{[\s\S]*\}/)?.[0] ?? rawText;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch {
      return badRequest("Scan AI membaca foto, tetapi hasilnya bukan JSON valid. Coba foto ulang lebih jelas.");
    }
    const parsed = scanResponseSchema.safeParse(parsedJson);
    if (!parsed.success) return badRequest("Scan AI membaca foto, tetapi format hasilnya belum valid. Coba foto ulang lebih jelas.");
    const ingredientByName = new Map(ingredients.map((item) => [normalizeName(item.name), item]));

    return ok({
      items: parsed.data.items.map((item) => {
        const ingredient = ingredientByName.get(normalizeName(item.itemName));
        return {
          itemName: ingredient?.name ?? item.itemName,
          ingredientId: ingredient?.id,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice || ingredient?.averagePrice || 0),
        };
      }),
      note: parsed.data.note,
    });
  } catch (error) {
    return serverError(error);
  }
}
