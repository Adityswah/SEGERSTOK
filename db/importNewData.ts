import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import ExcelJS from "exceljs";
import postgres from "postgres";

import { ingredientsTable } from "./schema";

config({ path: ".env.local" });

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/sotostock";

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

type ExcelIngredient = {
  id?: string;
  nama?: string;
  category?: string;
  unit?: string;
  " stock "?: number;
  minimum_stock?: number;
  avarage_price?: number;
};

// Enum Mapping for categories
function mapCategory(
  excelCategory: string,
): "Protein & Daging" | "Sayuran & Pelengkap" | "Bumbu Basah & Rempah Segar" | "Bahan Kering & Bumbu Kering" {
  const cat = excelCategory.trim();
  switch (cat) {
    case "Protein":
      return "Protein & Daging";
    case "Sayur":
      return "Sayuran & Pelengkap";
    case "Rempah - Rempah":
      return "Bumbu Basah & Rempah Segar";
    case "Gudang":
    case "Gudang ":
    case "Minuman":
      return "Bahan Kering & Bumbu Kering";
    default:
      return "Bahan Kering & Bumbu Kering";
  }
}

function parseNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error(`Invalid numeric value in Excel data: ${String(value)}`);
  }
  return numericValue;
}

function excelCellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);

  const cellObject = value as Record<string, unknown>;
  if (typeof cellObject.text === "string") return cellObject.text;
  if ("result" in cellObject) return excelCellText(cellObject.result);
  if (Array.isArray(cellObject.richText)) {
    return cellObject.richText
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as Record<string, unknown>).text ?? "") : ""))
      .join("");
  }

  return String(value);
}

async function readExcelIngredients() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("STOCK BAHAN.xlsx");
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("STOCK BAHAN.xlsx does not contain sheets.");

  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = excelCellText(cell.value).trim();
  });

  const data: ExcelIngredient[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      item[header] = excelCellText(row.getCell(index + 1).value).trim();
    });
    data.push(item as ExcelIngredient);
  });

  if (data.length === 0) {
    throw new Error("STOCK BAHAN.xlsx does not contain ingredient rows.");
  }

  const ids = new Set<string>();

  return data.map((item, index) => {
    const rowNumber = index + 2;
    const id = item.id?.trim();
    const name = item.nama?.trim();
    const category = item.category?.trim();
    const unit = item.unit?.trim();

    if (!id || !name || !category || !unit) {
      throw new Error(`Missing required ingredient field at Excel row ${rowNumber}.`);
    }

    if (ids.has(id)) {
      throw new Error(`Duplicate ingredient id in Excel data: ${id}`);
    }

    ids.add(id);

    return {
      id,
      name,
      category: mapCategory(category),
      unit,
      stock: String(parseNumber(item[" stock "])),
      minimumStock: String(parseNumber(item.minimum_stock)),
      averagePrice: Math.round(parseNumber(item.avarage_price)),
      active: true,
      updatedAt: new Date(),
    };
  });
}

async function main() {
  console.log("Connecting to Database...");

  const insertData = await readExcelIngredients();
  console.log(`Validated ${insertData.length} ingredient rows from STOCK BAHAN.xlsx.`);

  await db.transaction(async (tx) => {
    console.log("Deleting only price_predictions, stock_transactions, and ingredients...");
    await tx.execute(sql`DELETE FROM price_predictions;`);
    await tx.execute(sql`DELETE FROM stock_transactions;`);
    await tx.execute(sql`DELETE FROM ingredients;`);

    console.log(`Inserting ${insertData.length} ingredients...`);
    await tx.insert(ingredientsTable).values(insertData);
  });

  console.log("Data import complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    client.end();
  });
