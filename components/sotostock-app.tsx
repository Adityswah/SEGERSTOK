"use client";

import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  ClipboardCheck,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  KeyRound,
  ListFilter,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Tags,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import {
  navItems,
  stockStatus,
  type Category,
  type Ingredient,
  type PageId,
  type Role,
} from "@/lib/data";
import { getOpnameAssignments } from "@/lib/opname";
import { cn, formatRupiah } from "@/lib/utils";

const OwnerAiBot = dynamic(() => import("@/components/owner-ai-bot").then((module) => module.OwnerAiBot), {
  ssr: false,
});

type ToastTone = "success" | "warning" | "default";
type Toast = { message: string; tone: ToastTone } | null;
type ThemeMode = "light" | "night";
type LayoutMode = "mobile" | "desktop";
type StockMode = "masuk" | "keluar";
type AuthMode = "signin" | "signup";
type DashboardRangePreset = "today" | "yesterday" | "7d" | "this-month" | "last-month" | "all" | "custom";
type ChartGranularity = "tanggal" | "hari" | "minggu" | "jam";
type NavItem = (typeof navItems)[number];
type StockInputMode = "regular" | "bom";
type SortDirection = "" | "asc" | "desc";
type AutoFilterKind = "text" | "number" | "date";
type AutoFilterState<T extends string> = { column: T | null; direction: SortDirection };

type ApiEnvelope<T> = { data: T };
type ApiError = { error?: { message?: string } };
type IngredientMasterOptions = { units: string[]; categories: string[]; financeNonStockSubcategories: string[] };

type IngredientRow = {
  id: string;
  name: string;
  category: Category;
  unit: string;
  stock: string;
  minimumStock: string;
  averagePrice: number;
  isBom?: boolean;
};

type BomRecipeItemRow = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  ingredientUnit: string;
  ingredientCategory: string;
  quantity: number;
  totalCost: number;
};

type BomRecipeRow = {
  id: string;
  finishedIngredientId: string;
  name: string;
  category: string;
  yieldQuantity: number;
  yieldUnit: string;
  totalCost: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  items: BomRecipeItemRow[];
};

type BomProductionHistoryRow = {
  id: string;
  bomId: string;
  finishedIngredientId: string;
  bomName: string;
  yieldUnit: string;
  productionCount: number;
  producedQuantity: number;
  totalCost: number;
  operatorName: string;
  note: string | null;
  productionDate: string;
  createdAt: string;
  items: Array<{
    id: string;
    ingredientId: string;
    ingredientName: string;
    ingredientUnit: string;
    consumedQuantity: number;
    unitCost: number;
    totalCost: number;
  }>;
};

type TransactionRow = {
  id: string;
  ingredientId: string;
  type: StockMode;
  quantity: string;
  unitPrice: number | null;
  transactionDate: string;
  createdAt?: string;
  operatorName: string;
  note: string | null;
};

type TransactionBatchResponse = {
  inserted: number;
  skipped: number;
  rows: TransactionRow[];
};

type FinanceTransactionType = "pendapatan" | "pengeluaran";
type FinanceFundMethod = "cash" | "bank";
type FinanceCategory = "keperluan_stock" | "non_keperluan_stock";

type FinanceTransactionRow = {
  id: string;
  type: FinanceTransactionType;
  fundMethod: FinanceFundMethod;
  category: FinanceCategory;
  subcategory: string;
  ingredientId: string | null;
  itemName: string;
  quantity: string;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  transactionDate: string;
  note: string | null;
  attachmentName: string | null;
  linkedStockTransactionId: string | null;
  operatorName: string;
  createdAt: string;
};

type StockHistoryState = {
  item: Ingredient;
  rows: TransactionRow[];
  loading: boolean;
} | null;

type AiProjectionRow = {
  id: string;
  ingredientName: string;
  ingredientUnit: string;
  currentStock: string;
  predictedWeeklyUsage: string;
  predictedEndingStock: string;
  stockCoverDays: string;
  weekStart: string;
  weekEnd: string;
};

type AiRecommendationRow = {
  id: string;
  ingredientName: string;
  ingredientUnit: string;
  action: "beli-sekarang" | "beli-bertahap" | "tunda-beli";
  recommendedQuantity: string;
  priorityScore: number;
  explanation: string;
};

type AiSummaryLite = {
  asOf: string;
  latestRun: { status: "success" | "partial" | "failed"; startedAt: string } | null;
  projections: AiProjectionRow[];
  recommendations: AiRecommendationRow[];
};

type OpnameSessionRow = {
  id: string;
  opnameDate: string;
  status: "draft" | "staff_input" | "owner_review" | "finalized";
  createdByName: string;
  finalizedByName: string | null;
  finalizedAt: string | null;
};

type OpnameSummaryRow = {
  id: string;
  sessionId: string;
  ingredientId: string;
  ingredientNameSnapshot: string;
  categorySnapshot: string;
  unitSnapshot: string;
  systemStockBefore: string;
  totalRoleActual: string | null;
  finalActual: string | null;
  varianceQty: string | null;
  variancePercent: string | null;
  estimatedVarianceValue: number;
  ownerFinalNote: string | null;
  needsOwnerReview: boolean;
};

type OpnameRoleInputRow = {
  id: string;
  sessionId: string;
  ingredientId: string;
  role: Role;
  areaName: string;
  inputType: "primary" | "secondary";
  actualQty: string;
  note: string | null;
  inputByName: string;
  inputAt: string;
};

type OwnerEvaluationRow = {
  id: string;
  sessionId: string;
  ingredientId: string | null;
  severity: "low" | "medium" | "high";
  suspectedCause: string;
  ownerNote: string;
  actionItem: string;
  status: "open" | "done";
};

type OpnameAuditPayload = {
  sessions: OpnameSessionRow[];
  selectedSession: OpnameSessionRow | null;
  summaries: OpnameSummaryRow[];
  roleInputs: OpnameRoleInputRow[];
  evaluations: OwnerEvaluationRow[];
};

type StockLedgerRow = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  ingredientUnit: string;
  source: "stock_in" | "stock_out" | "bom_production" | "monthly_opname_final" | "owner_stock_correction";
  stockBefore: string;
  stockAfter: string;
  delta: string;
  reason: string | null;
  operatorName: string;
  createdAt: string;
};

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role?: Role;
  mustChangePassword?: boolean;
};

type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, "Owner">;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};

const publicSignupRoles: Exclude<Role, "Owner">[] = ["Kasir", "Cheef", "Waiters"];
const publicSignupEnabled = process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";
type StaffRole = Exclude<Role, "Owner">;

const staffRoles: StaffRole[] = ["Kasir", "Cheef", "Waiters"];
const allCategories: Category[] = [
  "Protein & Daging",
  "Sayuran & Pelengkap",
  "Bumbu Basah & Rempah Segar",
  "Bahan Kering & Bumbu Kering",
];
const themeOptions: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "night", label: "Night", icon: Moon },
];
const bomCategoryOptions = ["Olahan Basah", "Olahan Kering"] as const;

const defaultCategoryTone = { bg: "bg-primary/10", text: "text-[#8A6E1E]", bar: "bg-primary" };
const categoryTones: Record<string, { bg: string; text: string; bar: string }> = {
  "Protein & Daging": { bg: "bg-[#8B2E2E]/10", text: "text-[#8B2E2E]", bar: "bg-[#8B2E2E]" },
  "Sayuran & Pelengkap": { bg: "bg-success/10", text: "text-success", bar: "bg-success" },
  "Bumbu Basah & Rempah Segar": { bg: "bg-primary/10", text: "text-[#8A6E1E]", bar: "bg-primary" },
  "Bahan Kering & Bumbu Kering": { bg: "bg-[#3D3328]/10", text: "text-[#3D3328]", bar: "bg-[#3D3328]" },
};

function getCategoryTone(category: string) {
  return categoryTones[category] ?? defaultCategoryTone;
}

const pageCopy: Record<PageId, { tag: string; title: string }> = {
  dashboard: {
    tag: "Owner View",
    title: "Dashboard Evaluasi",
  },
  stok: {
    tag: "Stok",
    title: "Stock",
  },
  opname: {
    tag: "Opname",
    title: "Opname",
  },
  "koreksi-stok": {
    tag: "Owner Control",
    title: "Koreksi Stock Owner",
  },
  "stok-masuk": {
    tag: "Input",
    title: "Stok Masuk",
  },
  "stok-keluar": {
    tag: "Input",
    title: "Stok Keluar",
  },
  input: {
    tag: "Operasional",
    title: "Input Stock & Finance",
  },
  ai: {
    tag: "AI Operasional",
    title: "Rekomendasi Pembelian & Proyeksi Stok",
  },
  laporan: {
    tag: "Laporan",
    title: "Laporan & Audit Trail",
  },
  bahan: {
    tag: "Master Data",
    title: "Master Bahan Baku",
  },
  pengaturan: {
    tag: "Pengaturan",
    title: "Pengaturan Data",
  },
};

function allowedNav(role: Role) {
  if (role === "Owner") return navItems.filter((item) => ["dashboard", "stok", "opname", "laporan", "input", "koreksi-stok", "pengaturan"].includes(item.id));
  if (role === "Kasir") return navItems.filter((item) => ["input", "opname"].includes(item.id));
  if (role === "Cheef") return navItems.filter((item) => ["stok-masuk", "stok-keluar", "opname", "pengaturan"].includes(item.id));
  return navItems.filter((item) => ["stok-masuk", "stok-keluar", "opname", "pengaturan"].includes(item.id));
}

function defaultPage(role: Role): PageId {
  if (role === "Owner") return "dashboard";
  if (role === "Kasir") return "input";
  return "stok-masuk";
}

function mapIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    stock: Number(row.stock),
    minimum: Number(row.minimumStock),
    price: row.averagePrice,
    isBom: row.isBom ?? false,
  };
}

function canAccessBomUi(role: Role) {
  return role === "Owner" || role === "Cheef";
}

function canAccessFinanceUi(role: Role) {
  return role === "Owner" || role === "Kasir";
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "id", { sensitivity: "base", numeric: true });
}

function compareNumber(a: number, b: number) {
  return a - b;
}

function compareDate(a: Date, b: Date) {
  return a.getTime() - b.getTime();
}

function applySortDirection(result: number, direction: SortDirection) {
  return direction === "desc" ? result * -1 : result;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & ApiError;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with ${response.status}`);
  }

  return payload.data as T;
}

function dayKey(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function combineDateWithCurrentTime(dateValue: string) {
  if (!dateValue) return new Date();
  const [year, month, day] = dateValue.split("-").map(Number);
  const now = new Date();
  if (!year || !month || !day) return now;
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
}

function transactionActivityDate(transaction: Pick<TransactionRow, "createdAt" | "transactionDate">) {
  return new Date(transaction.createdAt ?? transaction.transactionDate);
}

function transactionChartDate(transaction: Pick<TransactionRow, "transactionDate">) {
  return new Date(transaction.transactionDate);
}

function AutoFilterSelect({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: AutoFilterKind;
  value: SortDirection;
  onChange: (value: SortDirection) => void;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold normal-case text-muted-foreground">
      <span>{label}</span>
      <Select className="h-8 min-w-[168px]" onChange={(event) => onChange(event.target.value as SortDirection)} value={value}>
        <option value="">AutoFilter</option>
        {kind === "text" && (
          <>
            <option value="asc">Sort A to Z</option>
            <option value="desc">Sort Z to A</option>
          </>
        )}
        {kind === "number" && (
          <>
            <option value="asc">Sort smallest to largest</option>
            <option value="desc">Sort largest to smallest</option>
          </>
        )}
        {kind === "date" && (
          <>
            <option value="asc">Sort oldest to latest</option>
            <option value="desc">Sort latest to oldest</option>
          </>
        )}
      </Select>
    </label>
  );
}

function autoFilterOptions(kind: AutoFilterKind) {
  if (kind === "number") {
    return [
      { value: "asc" as const, label: "Terkecil ke terbesar" },
      { value: "desc" as const, label: "Terbesar ke terkecil" },
    ];
  }

  if (kind === "date") {
    return [
      { value: "asc" as const, label: "Terlama ke terbaru" },
      { value: "desc" as const, label: "Terbaru ke terlama" },
    ];
  }

  return [
    { value: "asc" as const, label: "A ke Z" },
    { value: "desc" as const, label: "Z ke A" },
  ];
}

function AutoFilterHeader({
  label,
  kind,
  value,
  onChange,
  align = "left",
}: {
  label: string;
  kind: AutoFilterKind;
  value: SortDirection;
  onChange: (value: SortDirection) => void;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("flex items-center gap-2", align === "right" ? "justify-end" : "justify-between")}>
      <span>{label}</span>
      <span
        className={cn(
          "relative grid size-5 shrink-0 place-items-center rounded border bg-card text-muted-foreground shadow-sm transition",
          value && "border-primary bg-primary/10 text-primary",
        )}
        title={`AutoFilter ${label}`}
      >
        <ListFilter className="size-3.5" />
        <select
          aria-label={`AutoFilter ${label}`}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(event) => onChange(event.target.value as SortDirection)}
          value={value}
        >
          <option value="">AutoFilter</option>
          {autoFilterOptions(kind).map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

function DateAutoFilterHeader({
  value,
  onSortChange,
  rangePreset,
  customStart,
  customEnd,
  onRangePresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: {
  value: SortDirection;
  onSortChange: (value: SortDirection) => void;
  rangePreset: DashboardRangePreset;
  customStart: string;
  customEnd: string;
  onRangePresetChange: (value: DashboardRangePreset) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>Waktu</span>
      <details className="group relative">
        <summary
          className={cn(
            "grid size-5 cursor-pointer list-none place-items-center rounded border bg-card text-muted-foreground shadow-sm transition hover:border-primary/45 [&::-webkit-details-marker]:hidden",
            (value || rangePreset !== "all") && "border-primary bg-primary/10 text-primary",
          )}
          title="AutoFilter Waktu"
        >
          <ListFilter className="size-3.5" />
        </summary>
        <div className="fixed inset-x-2 bottom-4 top-16 z-[120] overflow-y-auto rounded-lg border bg-card p-3 shadow-2xl ring-1 ring-black/10 md:absolute md:bottom-auto md:left-auto md:right-0 md:top-auto md:mt-2 md:max-h-[72vh] md:w-[540px]">
          <label className="mb-3 grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Sort Waktu
            <Select className="h-9 bg-muted/45 normal-case tracking-normal" onChange={(event) => onSortChange(event.target.value as SortDirection)} value={value}>
              <option value="">AutoFilter</option>
              {autoFilterOptions("date").map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid gap-3 md:grid-cols-[1fr_136px_1fr] md:items-start">
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Dari tanggal
              <Input
                className="h-9 font-mono text-xs"
                onChange={(event) => {
                  onCustomStartChange(event.target.value);
                  onRangePresetChange("custom");
                }}
                type="date"
                value={customStart}
              />
            </label>
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
              {dashboardRangeOptions.map((item) => (
                <button
                  className={cn(
                    "h-8 rounded-md px-3 text-left text-xs font-semibold normal-case transition",
                    rangePreset === item.value ? "bg-primary text-primary-foreground" : "bg-muted/55 text-primary hover:bg-primary/10",
                  )}
                  key={item.value}
                  onClick={() => onRangePresetChange(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Sampai tanggal
              <Input
                className="h-9 font-mono text-xs"
                onChange={(event) => {
                  onCustomEndChange(event.target.value);
                  onRangePresetChange("custom");
                }}
                type="date"
                value={customEnd}
              />
            </label>
          </div>
        </div>
      </details>
    </div>
  );
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function useAdaptiveLayout() {
  const [detectedLayout, setDetectedLayout] = useState<LayoutMode>("desktop");

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const syncLayout = () => setDetectedLayout(query.matches ? "mobile" : "desktop");

    syncLayout();
    query.addEventListener("change", syncLayout);
    return () => query.removeEventListener("change", syncLayout);
  }, []);

  return {
    layoutMode: detectedLayout,
  };
}

export function SotoStockApp() {
  const session = authClient.useSession();
  const user = session.data?.user as SessionUser | undefined;
  const role = user?.role ?? "Kasir";
  const isAuthenticated = Boolean(session.data);

  const { layoutMode } = useAdaptiveLayout();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [sessionFallbackReady, setSessionFallbackReady] = useState(false);
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransactionRow[]>([]);
  const [stockLedger, setStockLedger] = useState<StockLedgerRow[]>([]);
  const [opnameRoleInputs, setOpnameRoleInputs] = useState<OpnameRoleInputRow[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "Semua">("Semua");
  const [toast, setToast] = useState<Toast>(null);
  const [clock, setClock] = useState(() => new Date());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [stockPageSort, setStockPageSort] = useState<AutoFilterState<"name" | "category" | "stock" | "minimum" | "status" | "value">>({
    column: null,
    direction: "",
  });
  const [actualInputs, setActualInputs] = useState<Record<string, Record<Role, string>>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [submittingStockMode, setSubmittingStockMode] = useState<StockMode | null>(null);
  const [submittingBom, setSubmittingBom] = useState(false);
  const [stockHistory, setStockHistory] = useState<StockHistoryState>(null);

  useEffect(() => {
    if (!session.isPending) {
      setSessionFallbackReady(false);
      return;
    }

    const timer = window.setTimeout(() => setSessionFallbackReady(true), 1800);
    return () => window.clearTimeout(timer);
  }, [session.isPending]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingData(true);
    try {
      const ingredientRows = await apiJson<IngredientRow[]>("/api/ingredients");
      const nextInventory = ingredientRows.map(mapIngredient);
      setInventory(nextInventory);
      setSelectedIngredient((current) => current || nextInventory[0]?.id || "");
      setActualInputs((current) => {
        const next = { ...current };
        for (const item of nextInventory.slice(0, 8)) {
          next[item.id] ??= { Owner: "", Kasir: "", Cheef: "", Waiters: "" };
        }
        return next;
      });

      if (role === "Owner") {
        const [transactionRows, ledgerRows, opnameAudit, financeRows] = await Promise.all([
          apiJson<TransactionRow[]>("/api/transactions?limit=500"),
          apiJson<StockLedgerRow[]>("/api/stock-corrections"),
          apiJson<OpnameAuditPayload>("/api/opname").catch(() => null),
          apiJson<FinanceTransactionRow[]>("/api/finance/transactions?limit=500"),
        ]);
        setTransactions(transactionRows);
        setStockLedger(ledgerRows);
        setOpnameRoleInputs(opnameAudit?.roleInputs ?? []);
        setFinanceTransactions(financeRows);
      } else if (role === "Kasir") {
        setTransactions([]);
        setStockLedger([]);
        setOpnameRoleInputs([]);
        setFinanceTransactions(await apiJson<FinanceTransactionRow[]>("/api/finance/transactions?limit=200"));
      } else {
        setTransactions([]);
        setStockLedger([]);
        setOpnameRoleInputs([]);
        setFinanceTransactions([]);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat data API", "warning");
    } finally {
      setLoadingData(false);
    }
  }, [isAuthenticated, role]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setActivePage(defaultPage(role));
    void loadData();
  }, [isAuthenticated, loadData, role]);

  const metrics = useMemo(() => {
    const critical = inventory.filter((item) => stockStatus(item).label !== "Aman").length;
    const stockValue = inventory.reduce((total, item) => total + item.stock * item.price, 0);
    const weekExpense = transactions.reduce((sum, item) => {
      if (item.type !== "masuk") return sum;
      return sum + Number(item.quantity) * (item.unitPrice ?? 0);
    }, 0);
    const weekUsage = transactions.filter((item) => item.type === "keluar").length;
    return { total: inventory.length, critical, stockValue, weekExpense, weekUsage };
  }, [inventory, transactions]);

  const availableCategories = useMemo(
    () => Array.from(new Set([...allCategories, ...inventory.map((ingredient) => ingredient.category)])).filter((item) =>
      inventory.some((ingredient) => ingredient.category === item),
    ),
    [inventory],
  );

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesCategory = category === "Semua" || item.category === category;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [category, inventory, search]);

  const lowStockItems = useMemo(
    () =>
      inventory
        .filter((item) => stockStatus(item).label !== "Aman")
        .sort((a, b) => stockStatus(a).ratio - stockStatus(b).ratio)
        .slice(0, 4),
    [inventory],
  );

  const dailyExpenseBars = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return { label: dayKey(date), value: 0 };
    });
    for (const transaction of transactions) {
      if (transaction.type !== "masuk") continue;
      const label = dayKey(new Date(transaction.transactionDate));
      const target = days.find((item) => item.label === label);
      if (target) target.value += Number(transaction.quantity) * (transaction.unitPrice ?? 0);
    }
    return days;
  }, [transactions]);

  const usageBars = useMemo(() => {
    const byCategory = allCategories.map((item) => ({ label: item.split(" ")[0], value: 0 }));
    const ingredientById = new Map(inventory.map((item) => [item.id, item]));
    for (const transaction of transactions) {
      if (transaction.type !== "keluar") continue;
      const ingredient = ingredientById.get(transaction.ingredientId);
      if (!ingredient) continue;
      const target = byCategory.find((item) => item.label === ingredient.category.split(" ")[0]);
      if (target) target.value += Number(transaction.quantity);
    }
    return byCategory;
  }, [inventory, transactions]);

  function showToast(message: string, tone: ToastTone = "default") {
    setToast({ message, tone });
  }

  async function handleTransaction(formData: FormData, mode: StockMode) {
    if (submittingStockMode) {
      showToast("Transaksi masih diproses. Tunggu sebentar agar tidak double input.", "warning");
      return false;
    }

    const transactionDate = String(formData.get("date"));
    const ingredientIds = formData.getAll("ingredient").map(String);
    const quantities = formData.getAll("amount").map((value) => Number(value));
    const unitPrices = formData
      .getAll("price")
      .map((value) => Number(String(value).replace(/[^\d.-]/g, "")));
    const notes = formData.getAll("note").map(String);
    const rows = ingredientIds
      .map((ingredientId, index) => ({
        ingredientId,
        note: notes[index] ?? "",
        quantity: quantities[index],
        unitPrice: unitPrices[index],
      }))
      .filter((row) => row.ingredientId || row.quantity > 0 || row.note);

    if (!rows.length) {
      showToast("Minimal 1 bahan harus diisi", "warning");
      return false;
    }

    const invalidRow = rows.find((row) => !row.ingredientId || Number.isNaN(row.quantity) || row.quantity <= 0);
    if (invalidRow) {
      showToast("Setiap baris wajib memilih bahan dan jumlah lebih dari 0", "warning");
      return false;
    }

    const clientBatchId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setSubmittingStockMode(mode);
    try {
      const result = await apiJson<TransactionBatchResponse>("/api/transactions/batch", {
        method: "POST",
        body: JSON.stringify({
          clientBatchId,
          operatorName: user?.name ?? role,
          rows: rows.map((row) => ({
            ingredientId: row.ingredientId,
            note: row.note || undefined,
            quantity: row.quantity,
            unitPrice: mode === "masuk" && !Number.isNaN(row.unitPrice) ? row.unitPrice : undefined,
          })),
          transactionDate: combineDateWithCurrentTime(transactionDate).toISOString(),
          type: mode,
        }),
      });
      showToast(
        result.skipped
          ? `${result.inserted} tersimpan, ${result.skipped} duplikat diabaikan`
          : mode === "masuk"
            ? `${result.inserted} stok masuk tersimpan`
            : `${result.inserted} stok keluar tersimpan`,
        "success",
      );
      await loadData();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Transaksi gagal disimpan", "warning");
      return false;
    } finally {
      setSubmittingStockMode(null);
    }
  }

  async function handleFinanceTransaction(payload: {
    attachmentName?: string;
    category: FinanceCategory;
    fundMethod: FinanceFundMethod;
    ingredientId?: string;
    items?: Array<{ ingredientId?: string; itemName?: string; quantity: number; unitPrice: number }>;
    itemName?: string;
    note?: string;
    quantity?: number;
    subcategory?: string;
    transactionDate: string;
    type: FinanceTransactionType;
    unitPrice?: number;
  }) {
    try {
      await apiJson<FinanceTransactionRow>("/api/finance/transactions", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          transactionDate: combineDateWithCurrentTime(payload.transactionDate).toISOString(),
        }),
      });
      showToast(
        payload.category === "keperluan_stock"
          ? "Finance tersimpan dan stock masuk otomatis bertambah"
          : "Transaksi finance tersimpan",
        "success",
      );
      await loadData();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Transaksi finance gagal disimpan", "warning");
      return false;
    }
  }

  async function handleOpnameSubmit(ingredientIds?: string[]) {
    const selectedIds = new Set(ingredientIds ?? inventory.map((item) => item.id));
    const rows = inventory
      .filter((item) => selectedIds.has(item.id))
      .map((item) => ({
        ingredientId: item.id,
        actualQty: actualInputs[item.id]?.[role] ? Number(actualInputs[item.id][role]) : Number.NaN,
      }))
      .filter((item) => Number.isFinite(item.actualQty));

    if (!rows.length) {
      showToast("Pilih dan isi minimal 1 barang opname", "warning");
      return;
    }

    try {
      await apiJson("/api/opname", {
        method: "POST",
        body: JSON.stringify({
          action: "submit-role-input",
          opnameDate: new Date().toISOString(),
          rows,
        }),
      });
      showToast("Data aktual lapangan tersimpan ke API", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Opname gagal disimpan", "warning");
    }
  }

  async function handleStockDetail(item: Ingredient) {
    setStockHistory({ item, loading: true, rows: [] });
    try {
      const rows = await apiJson<TransactionRow[]>(
        `/api/transactions?ingredientId=${encodeURIComponent(item.id)}&limit=80`,
      );
      setStockHistory({ item, loading: false, rows });
    } catch (error) {
      setStockHistory({ item, loading: false, rows: [] });
      showToast(error instanceof Error ? error.message : "History barang gagal dibaca", "warning");
    }
  }

  async function logout() {
    await authClient.signOut();
    setInventory([]);
    setTransactions([]);
    setStockLedger([]);
    setOpnameRoleInputs([]);
    setActivePage("dashboard");
  }

  function navigate(page: PageId) {
    if (!allowedNav(role).some((item) => item.id === page)) {
      showToast("Akun ini tidak memiliki akses ke halaman tersebut", "warning");
      return;
    }
    setActivePage(page);
    setMobileNavOpen(false);
  }

  function navigateCriticalStock() {
    setSearch("");
    setCategory("Semua");
    setStockPageSort({ column: "stock", direction: "asc" });
    navigate("stok");
  }

  async function handleBomProduction(payload: { bomId: string; productionCount: number; transactionDate: string }) {
    if (submittingBom) {
      showToast("Produksi BOM masih diproses. Tunggu sebentar.", "warning");
      return false;
    }

    setSubmittingBom(true);
    try {
      await apiJson("/api/bom/produce", {
        method: "POST",
        body: JSON.stringify({
          bomId: payload.bomId,
          productionCount: payload.productionCount,
          operatorName: user?.name ?? role,
          transactionDate: combineDateWithCurrentTime(payload.transactionDate).toISOString(),
        }),
      });
      showToast("Produksi BOM tersimpan dan stok bahan baku sudah terpotong", "success");
      await loadData();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Produksi BOM gagal disimpan", "warning");
      return false;
    } finally {
      setSubmittingBom(false);
    }
  }

  if (session.isPending && !sessionFallbackReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-5 shadow-soft">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="font-bold">Memeriksa session STOKARA...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div data-theme={theme}>
        <AuthScreen onThemeChange={setTheme} theme={theme} />
        {toast && <ToastView toast={toast} />}
      </div>
    );
  }

  if (user?.mustChangePassword) {
    return (
      <div data-theme={theme}>
        <ForcePasswordChangeScreen
          email={user.email}
          name={user.name}
          onSaved={() => window.location.reload()}
          onThemeChange={setTheme}
          theme={theme}
        />
        {toast && <ToastView toast={toast} />}
      </div>
    );
  }

  const nav = allowedNav(role);

  return (
    <div
      className="min-h-screen bg-background text-foreground transition-colors duration-700"
      data-layout={layoutMode}
      data-theme={theme}
    >
      <div className={cn("min-h-screen animate-elegant-in", layoutMode === "desktop" ? "flex" : "pb-24")}>
        {layoutMode === "desktop" && (
          <Sidebar
            activePage={activePage}
            nav={nav}
            onLogoClick={() => navigate(defaultPage(role))}
            onLogout={logout}
            onNavigate={navigate}
            role={role}
          />
        )}

        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            layoutMode === "mobile" && "mx-auto min-h-screen w-full max-w-md",
          )}
        >
          {layoutMode === "mobile" && (
            <MobileHeader
              activePage={activePage}
              nav={nav}
              onLogoClick={() => navigate(defaultPage(role))}
              onNavigate={navigate}
              onToggle={() => setMobileNavOpen((current) => !current)}
              open={mobileNavOpen}
              role={role}
            />
          )}

          <div
            className={cn(
              "mx-auto flex w-full flex-1 flex-col gap-5",
              layoutMode === "desktop" ? "max-w-[1440px] px-5 py-5 sm:px-6 lg:px-8" : "px-3 py-3",
            )}
          >
            <PageHeader
              clock={clock}
              layoutMode={layoutMode}
              loadingData={loadingData}
              onBell={() => showToast(`${metrics.critical} bahan perlu dicek`, metrics.critical ? "warning" : "default")}
              onProfile={() => navigate("pengaturan")}
              onRefresh={loadData}
              onThemeChange={setTheme}
              page={activePage}
              role={role}
              theme={theme}
            />

            {activePage === "dashboard" && role === "Owner" && (
              <DashboardPage
                dailyExpenseBars={dailyExpenseBars}
                inventory={inventory}
                lowStockItems={lowStockItems}
                metrics={metrics}
                onCriticalStock={navigateCriticalStock}
                onNavigate={navigate}
                opnameRoleInputs={opnameRoleInputs}
                stockLedger={stockLedger}
                transactions={transactions}
                usageBars={usageBars}
              />
            )}
            {activePage === "stok" && (
              <StockPage
                categories={availableCategories}
                category={category}
                filteredInventory={filteredInventory}
                onCategory={setCategory}
                onDetail={handleStockDetail}
                onSearch={setSearch}
                requestedSort={stockPageSort}
                search={search}
              />
            )}
            {activePage === "opname" && (
              <OpnamePage
                actualInputs={actualInputs}
                clock={clock}
                inventory={inventory}
                onDataChanged={loadData}
                onActualChange={(id, inputRole, value) =>
                  setActualInputs((current) => ({
                    ...current,
                    [id]: { ...current[id], [inputRole]: value },
                  }))
                }
                onSubmit={handleOpnameSubmit}
                role={role}
              />
            )}
            {activePage === "koreksi-stok" && role === "Owner" && (
              <StockCorrectionPage inventory={inventory} onSaved={loadData} />
            )}
            {activePage === "input" && canAccessFinanceUi(role) && (
              <InputHubPage
                financeTransactions={financeTransactions}
                inventory={inventory}
                onFinanceSubmit={handleFinanceTransaction}
                onSubmitBom={handleBomProduction}
                onSelectedIngredient={setSelectedIngredient}
                onStockSubmit={handleTransaction}
                role={role}
                submittingBom={submittingBom}
                submittingStockMode={submittingStockMode}
                transactions={transactions}
              />
            )}
            {activePage === "stok-masuk" && (
              <StockInputPage
                inventory={inventory}
                mode="masuk"
                onSubmitBom={handleBomProduction}
                onSelectedIngredient={setSelectedIngredient}
                onSubmit={(formData) => handleTransaction(formData, "masuk")}
                role={role}
                submittingBom={submittingBom}
                submitting={submittingStockMode === "masuk"}
                transactions={transactions}
              />
            )}
            {activePage === "stok-keluar" && (
              <StockInputPage
                inventory={inventory}
                mode="keluar"
                onSubmitBom={handleBomProduction}
                onSelectedIngredient={setSelectedIngredient}
                onSubmit={(formData) => handleTransaction(formData, "keluar")}
                role={role}
                submittingBom={submittingBom}
                submitting={submittingStockMode === "keluar"}
                transactions={transactions}
              />
            )}
            {activePage === "ai" && <AiPage inventory={inventory} transactions={transactions} />}
            {activePage === "laporan" && (
              <ReportPage
                financeTransactions={financeTransactions}
                inventory={inventory}
                role={role}
                stockLedger={stockLedger}
                transactions={transactions}
              />
            )}
            {activePage === "bahan" && <MasterDataPage categories={availableCategories} inventory={inventory} />}
            {activePage === "pengaturan" && (
              <SettingsPage
                categories={allCategories}
                email={user?.email ?? ""}
                financeTransactions={financeTransactions}
                inventory={inventory}
                name={user?.name ?? ""}
                onSaved={loadData}
                role={role}
              />
            )}
          </div>
        </main>
      </div>

      {layoutMode === "mobile" && <MobileBottomNav activePage={activePage} nav={nav} onLogout={logout} onNavigate={navigate} />}
      {role === "Owner" && <OwnerAiBot activePage={activePage} role={role} />}
      <StockHistoryPanel history={stockHistory} onClose={() => setStockHistory(null)} />
      {toast && <ToastView toast={toast} />}
    </div>
  );
}

function AuthScreen({
  theme,
  onThemeChange,
}: {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [role, setRole] = useState<Exclude<Role, "Owner">>("Kasir");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (mode === "signup" && !publicSignupEnabled) {
      setError("Pendaftaran publik sedang ditutup. Hubungi Owner untuk membuat akun baru.");
      return;
    }

    setPending(true);
    try {
      const result =
        mode === "signin"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name, role } as Parameters<
              typeof authClient.signUp.email
            >[0]);

      if (result.error) {
        setError(result.error.message ?? "Autentikasi gagal");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Autentikasi gagal");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8 transition-colors duration-700">
      <form className="w-full max-w-[390px] animate-elegant-in rounded-lg border bg-card/95 p-6 shadow-soft" onSubmit={submit}>
        <div className="flex items-center gap-3">
          <LogoMark className="size-12" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Soto Seger Joyoboyo</p>
            <h1 className="joyo-display truncate text-3xl tracking-normal text-foreground">STOKARA</h1>
          </div>
        </div>

        <div
          className={cn(
            "mt-6 grid gap-1 rounded-md border bg-muted/70 p-1",
            publicSignupEnabled ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {(["signin", ...(publicSignupEnabled ? ["signup"] : [])] as AuthMode[]).map((item) => (
            <button
              key={item}
              className={cn(
                "h-10 rounded text-xs font-semibold text-muted-foreground transition",
                mode === item && "bg-card text-primary shadow-sm",
              )}
              onClick={() => setMode(item)}
              type="button"
            >
              {item === "signin" ? "Masuk" : "Daftar"}
            </button>
          ))}
        </div>

        {!publicSignupEnabled && (
          <p className="mt-3 rounded-md border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            Pendaftaran publik ditutup. Akun baru dibuat oleh Owner/admin agar akses operasional tidak bisa disalahgunakan.
          </p>
        )}

        <div className="mt-5 grid gap-3">
          {mode === "signup" && (
            <>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Nama
                <Input onChange={(event) => setName(event.target.value)} required value={name} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Role
                <Select onChange={(event) => setRole(event.target.value as Exclude<Role, "Owner">)} value={role}>
                  {publicSignupRoles.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Select>
              </label>
            </>
          )}
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Email
            <Input onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Password
            <Input minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
        </div>

        {error && <p className="mt-3 text-center text-xs font-semibold text-destructive">{error}</p>}

        <Button className="mt-6 w-full" disabled={pending} type="submit">
          {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          {mode === "signin" ? "Masuk" : "Buat Akun"}
        </Button>

        <ThemePicker className="mt-4" onChange={onThemeChange} theme={theme} />
      </form>
    </main>
  );
}

function ForcePasswordChangeScreen({
  email,
  name,
  theme,
  onSaved,
  onThemeChange,
}: {
  email: string;
  name: string;
  theme: ThemeMode;
  onSaved: () => void;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak sama.");
      return;
    }

    setPending(true);
    try {
      await apiJson("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword,
          email,
          name,
          newPassword,
        }),
      });
      onSaved();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Password gagal diganti");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8 transition-colors duration-700">
      <form className="w-full max-w-[430px] animate-elegant-in rounded-lg border bg-card/95 p-6 shadow-soft" onSubmit={submit}>
        <div className="flex items-center gap-3">
          <LogoMark className="size-12" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Reset keamanan akun</p>
            <h1 className="joyo-display truncate text-3xl tracking-normal text-foreground">Ganti Password</h1>
          </div>
        </div>

        <p className="mt-5 rounded-md border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
          Owner telah memberikan password sementara. Masukkan password sementara itu, lalu buat password baru pribadi Anda.
        </p>

        <div className="mt-5 grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Password sementara
            <Input onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Password baru
            <Input minLength={8} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Konfirmasi password baru
            <Input minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
          </label>
        </div>

        {error && <p className="mt-3 text-center text-xs font-semibold text-destructive">{error}</p>}

        <Button className="mt-6 w-full" disabled={pending} type="submit">
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Simpan Password Baru
        </Button>

        <ThemePicker className="mt-4" onChange={onThemeChange} theme={theme} />
      </form>
    </main>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("grid place-items-center text-primary", className)}>
      <svg aria-hidden="true" className="size-[78%]" viewBox="0 0 236 310">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(118 155)">
          <path d="M-118 0 0-155 118 0 0 155-118 0Z" stroke="#8B6514" strokeWidth="3.5" />
          <path d="M0 155 19.7 129.2M0 155 39.3 103.3M0 155 59 77.5M0 155 78.7 51.7M0 155 98.3 25.8" stroke="#C9A227" strokeWidth="2" />
          <path d="M0 155 101.1-22.1M0 155 84.3-44.3M0 155 67.4-66.4M0 155 50.6-88.6M0 155 33.7-110.7M0 155 16.9-132.9" stroke="#C9A227" strokeWidth="2.7" />
          <path d="M0 155V-155" stroke="#B8962E" strokeWidth="4" />
          <path d="M0 155-16.9-132.9M0 155-33.7-110.7M0 155-50.6-88.6M0 155-67.4-66.4M0 155-84.3-44.3M0 155-101.1-22.1" stroke="#C9A227" strokeWidth="2.7" />
          <path d="M0 155-98.3 25.8M0 155-78.7 51.7M0 155-59 77.5M0 155-39.3 103.3M0 155-19.7 129.2" stroke="#C9A227" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function ThemePicker({
  theme,
  onChange,
  className,
}: {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-1 rounded-lg bg-muted p-1", className)}>
      {themeOptions.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-bold text-muted-foreground transition duration-500",
              theme === item.id && "bg-card text-primary shadow-sm",
            )}
            onClick={() => onChange(item.id)}
            type="button"
          >
            <Icon className="size-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Sidebar({
  activePage,
  nav,
  role,
  onLogoClick,
  onNavigate,
  onLogout,
}: {
  activePage: PageId;
  nav: readonly NavItem[];
  role: Role;
  onLogoClick: () => void;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const expanded = hovered || pinned;
  const visibleNav = new Map(nav.map((item) => [item.id, item]));
  const sectionConfig: Array<{ label: string; ids: PageId[] }> =
    role === "Owner"
      ? [
          { label: "Command Center", ids: ["dashboard", "stok"] },
          { label: "Audit", ids: ["opname", "laporan"] },
          { label: "Operasional", ids: ["input", "koreksi-stok"] },
          { label: "Setting", ids: ["pengaturan"] },
        ]
      : role === "Cheef"
        ? [
            { label: "Transaksi", ids: ["stok-masuk", "stok-keluar", "opname"] },
            { label: "Pengaturan", ids: ["pengaturan"] },
          ]
      : role === "Kasir"
        ? [
            { label: "Operasional", ids: ["input"] },
            { label: "Audit", ids: ["opname"] },
          ]
        : [{ label: "Transaksi", ids: ["stok-masuk", "stok-keluar", "opname"] }];
  const sections = sectionConfig
    .map((section) => ({
      ...section,
      items: section.ids.map((id) => visibleNav.get(id)).filter((item): item is NavItem => Boolean(item)),
    }))
    .filter((section) => section.items.length);

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 flex h-screen shrink-0 flex-col border-r border-[#B8962E]/25 bg-[#1A1612] py-4 text-[#FAF7F2] shadow-brand transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        expanded ? "w-[164px]" : "w-[76px]",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={cn("mx-auto flex items-center gap-1", expanded ? "w-[144px]" : "w-11 justify-center")}>
        <button
          aria-label="Ke dashboard"
          className={cn(
            "flex h-11 items-center rounded-md text-[#B8962E] transition duration-500 hover:bg-[#FAF7F2]/6 hover:text-[#D4AE52]",
            expanded ? "w-[132px] justify-start gap-3 px-2" : "w-11 justify-center",
          )}
          onClick={onLogoClick}
          type="button"
        >
          <LogoMark className="size-9 shrink-0 shadow-none" />
          <span className={cn("overflow-hidden whitespace-nowrap text-xs font-semibold tracking-[0.14em] transition duration-500", expanded ? "w-20 opacity-100" : "w-0 opacity-0")}>
            STOKARA
          </span>
        </button>
      </div>

      <nav className="mt-6 flex flex-1 flex-col items-center overflow-y-auto px-2">
        {sections.map((section) => (
          <div
            key={section.label}
            className="mb-5 grid w-full justify-items-center gap-2 border-t border-[#FAF7F2]/10 pt-5 first:border-t-0 first:pt-0"
          >
            <p className={cn("h-4 w-full overflow-hidden px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#FAF7F2]/32 transition duration-500", expanded ? "opacity-100" : "opacity-0")}>
              {section.label}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  aria-label={item.label}
                  key={item.id}
                  className={cn(
                    "relative flex h-11 items-center rounded-md text-[#F0EBE3]/55 transition duration-500 hover:bg-[#FAF7F2]/8 hover:text-[#FAF7F2]",
                    expanded ? "w-[132px] justify-start gap-3 px-3" : "w-11 justify-center",
                    activePage === item.id && "bg-[#B8962E] text-[#1A1612] shadow-lg shadow-black/25",
                  )}
                  onClick={() => onNavigate(item.id)}
                  title={`${section.label}: ${item.label}`}
                  type="button"
                >
                  <Icon className="size-5 shrink-0" />
                  <span className={cn("overflow-hidden whitespace-nowrap text-xs font-semibold transition duration-500", expanded ? "w-24 opacity-100" : "w-0 opacity-0")}>
                    {item.label}
                  </span>
                  {"badge" in item && item.badge && (
                    <span className={cn("absolute top-1 grid size-4 place-items-center rounded-full bg-success text-[9px] font-medium text-success-foreground", expanded ? "right-2" : "-right-1")}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <button
        aria-label={`Logout ${role}`}
        className={cn(
          "mx-auto flex h-11 items-center rounded-md border border-[#FAF7F2]/10 bg-[#FAF7F2]/5 text-[#F0EBE3]/65 transition duration-500 hover:bg-[#FAF7F2]/10 hover:text-[#FAF7F2]",
          expanded ? "w-[132px] justify-start gap-3 px-3" : "w-11 justify-center",
        )}
        onClick={onLogout}
        title={`Logout ${role}`}
        type="button"
      >
        <LogOut className="size-5 shrink-0" />
        <span className={cn("overflow-hidden whitespace-nowrap text-xs font-semibold transition duration-500", expanded ? "w-20 opacity-100" : "w-0 opacity-0")}>
          Logout
        </span>
      </button>
    </aside>
  );
}

function MobileHeader({
  activePage,
  nav,
  open,
  role,
  onLogoClick,
  onToggle,
  onNavigate,
}: {
  activePage: PageId;
  nav: readonly NavItem[];
  open: boolean;
  role: Role;
  onLogoClick: () => void;
  onToggle: () => void;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <div className="sticky top-0 z-30 border-b bg-card/95 shadow-soft backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-3">
        <Button aria-label="Menu" className="rounded-md" onClick={onToggle} size="icon" variant="outline">
          <Menu />
        </Button>
        <button
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition hover:bg-muted/35"
          onClick={onLogoClick}
          type="button"
        >
          <LogoMark className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="joyo-display truncate text-lg leading-none">STOKARA</p>
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{role} view</p>
          </div>
        </button>
        <div className="grid size-9 place-items-center rounded-full border border-primary/20 bg-primary/10 font-mono text-xs font-medium text-primary">
          {role[0]}
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2 border-t bg-background/90 p-3">
          {nav.map((item) => (
            <Button
              key={item.id}
              className={cn("h-10 justify-start rounded-md bg-card text-xs font-medium", activePage === item.id && "border-primary text-primary")}
              onClick={() => onNavigate(item.id)}
              size="sm"
              variant="outline"
            >
              <item.icon />
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileBottomNav({
  activePage,
  nav,
  onLogout,
  onNavigate,
}: {
  activePage: PageId;
  nav: readonly NavItem[];
  onLogout: () => void;
  onNavigate: (page: PageId) => void;
}) {
  const primaryNav = nav.slice(0, 4);

  return (
    <nav className="fixed inset-x-0 bottom-3 z-40 mx-auto w-[calc(100%-1rem)] max-w-md rounded-lg border bg-card/95 p-1.5 shadow-brand backdrop-blur">
      <div className="grid grid-cols-5 gap-1">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={cn(
                "grid min-w-0 place-items-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-medium text-muted-foreground transition",
                activePage === item.id && "bg-primary text-primary-foreground",
              )}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <Icon className="size-[18px]" />
              <span className="w-full truncate">{item.label.replace("Stok ", "")}</span>
            </button>
          );
        })}
        <button
          className="grid min-w-0 place-items-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-medium text-destructive transition hover:bg-destructive/10"
          onClick={() => void onLogout()}
          type="button"
        >
          <LogOut className="size-[18px]" />
          <span className="w-full truncate">Logout</span>
        </button>
      </div>
    </nav>
  );
}

function PageHeader({
  page,
  clock,
  role,
  theme,
  layoutMode,
  loadingData,
  onBell,
  onProfile,
  onRefresh,
  onThemeChange,
}: {
  page: PageId;
  clock: Date;
  role: Role;
  theme: ThemeMode;
  layoutMode: LayoutMode;
  loadingData: boolean;
  onBell: () => void;
  onProfile: () => void;
  onRefresh: () => void;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const copy = pageCopy[page];
  const dateLabel = clock.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = clock.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const roleLabel = page === "dashboard" ? "DASHBOARD" : role === "Owner" ? "OWNER VIEW" : `${role.toUpperCase()} VIEW`;

  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 rounded-b-lg border bg-card/95 px-4 py-3 text-foreground shadow-soft backdrop-blur",
        layoutMode === "mobile" && "rounded-lg",
      )}
    >
      <div className="min-w-0">
        <Badge className="mb-1 h-5 border-primary/20 bg-primary/10 px-2 text-[10px] text-primary hover:bg-primary/10" variant="outline">
          {roleLabel}
        </Badge>
        {page === "dashboard" ? (
          <h1 className={cn("joyo-display truncate tracking-normal text-foreground", layoutMode === "desktop" ? "text-2xl" : "text-xl")}>
            <span className="font-normal">Selamat datang </span>
            <span className="font-bold">Owner</span>
          </h1>
        ) : (
          <h1 className={cn("joyo-display truncate tracking-normal text-foreground", layoutMode === "desktop" ? "text-2xl" : "text-xl")}>
            {copy.title}
          </h1>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
        <div className="hidden rounded-md border bg-muted/45 px-3 py-2 text-right sm:block">
          <p className="font-mono text-sm font-medium text-foreground">{timeLabel}</p>
          <p className="text-[10px] font-medium text-muted-foreground">{dateLabel}</p>
        </div>
        <Button aria-label="Refresh API data" className="size-9 rounded-lg" disabled={loadingData} onClick={onRefresh} size="icon" variant="outline">
          <RefreshCw className={cn(loadingData && "animate-spin")} />
        </Button>
        <Button aria-label="Peringatan" className="size-9 rounded-lg" onClick={onBell} size="icon" variant="outline">
          <Bell />
        </Button>
        <Button aria-label="Akun" className="size-9 rounded-lg" onClick={onProfile} size="icon" variant="outline">
          <UserRound />
        </Button>
        </div>
        <div className="flex items-center gap-1 rounded-md border bg-muted/45 p-0.5">
          <button
            aria-label="Light mode"
            className={cn(
              "grid size-6 place-items-center rounded text-muted-foreground transition hover:text-foreground",
              theme === "light" && "bg-primary/10 text-primary",
            )}
            onClick={() => onThemeChange("light")}
            type="button"
          >
            <Sun className="size-3.5" />
          </button>
          <button
            aria-label="Night mode"
            className={cn(
              "grid size-6 place-items-center rounded text-muted-foreground transition hover:text-foreground",
              theme === "night" && "bg-primary/10 text-primary",
            )}
            onClick={() => onThemeChange("night")}
            type="button"
          >
            <Moon className="size-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function DashboardPage({
  lowStockItems,
  metrics,
  dailyExpenseBars,
  usageBars,
  transactions,
  stockLedger,
  opnameRoleInputs,
  inventory,
  onNavigate,
  onCriticalStock,
}: {
  lowStockItems: Ingredient[];
  metrics: { total: number; critical: number; stockValue: number; weekExpense: number; weekUsage: number };
  dailyExpenseBars: Array<{ label: string; value: number }>;
  usageBars: Array<{ label: string; value: number }>;
  transactions: TransactionRow[];
  stockLedger: StockLedgerRow[];
  opnameRoleInputs: OpnameRoleInputRow[];
  inventory: Ingredient[];
  onNavigate: (page: PageId) => void;
  onCriticalStock: () => void;
}) {
  const todayKey = dateInputKey(new Date());
  const [dashboardRangePreset, setDashboardRangePreset] = useState<DashboardRangePreset>("7d");
  const [dashboardCustomStart, setDashboardCustomStart] = useState(dateInputKey(addDays(new Date(), -6)));
  const [dashboardCustomEnd, setDashboardCustomEnd] = useState(todayKey);
  const [stockGranularity, setStockGranularity] = useState<ChartGranularity>("tanggal");
  const [flowGranularity, setFlowGranularity] = useState<ChartGranularity>("tanggal");
  const [quantityGranularity, setQuantityGranularity] = useState<ChartGranularity>("tanggal");
  const ingredientById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const dashboardAllStart = useMemo(() => {
    const dates = [
      ...transactions.map((item) => transactionChartDate(item)),
      ...stockLedger.map((item) => new Date(item.createdAt)),
      ...opnameRoleInputs.map((item) => new Date(item.inputAt)),
    ].filter((date) => !Number.isNaN(date.getTime()));
    if (!dates.length) return dateInputKey(addDays(new Date(), -6));
    return dateInputKey(new Date(Math.min(...dates.map((date) => date.getTime()))));
  }, [opnameRoleInputs, stockLedger, transactions]);
  const recentActivities = useMemo(() => {
    const ledgerActivities = stockLedger.map((item) => ({
      id: `ledger-${item.id}`,
      date: new Date(item.createdAt),
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      label:
        item.source === "stock_in"
          ? "Stock masuk"
          : item.source === "stock_out"
            ? "Stock keluar"
            : item.source === "owner_stock_correction"
              ? "Koreksi stock"
              : item.source === "monthly_opname_final"
                ? "Final opname"
                : "Produksi BOM",
      operatorName: item.operatorName,
      quantity: Math.abs(Number(item.delta)),
      source: item.source,
      unit: item.ingredientUnit,
      variant: Number(item.delta) < 0 ? "warning" : "success",
    }));
    const opnameActivities = opnameRoleInputs.map((item) => ({
      id: `opname-${item.id}`,
      date: new Date(item.inputAt),
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientId,
      label: `Opname ${item.role}`,
      operatorName: item.inputByName,
      quantity: Number(item.actualQty),
      source: "opname_input",
      unit: "",
      variant: "secondary",
    }));

    return [...ledgerActivities, ...opnameActivities]
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, 10);
  }, [opnameRoleInputs, stockLedger]);
  const dashboardRangeDays = useMemo(
    () => dashboardRangeFromPreset(dashboardRangePreset, dashboardCustomStart, dashboardCustomEnd, dashboardAllStart),
    [dashboardAllStart, dashboardCustomEnd, dashboardCustomStart, dashboardRangePreset],
  );
  const stockBuckets = useMemo(() => buildChartBuckets(dashboardRangeDays, stockGranularity), [dashboardRangeDays, stockGranularity]);
  const flowBuckets = useMemo(() => buildChartBuckets(dashboardRangeDays, flowGranularity), [dashboardRangeDays, flowGranularity]);
  const quantityBuckets = useMemo(() => buildChartBuckets(dashboardRangeDays, quantityGranularity), [dashboardRangeDays, quantityGranularity]);
  const filteredExpense = useMemo(() => {
    const periodStart = dashboardRangeDays[0]?.start.getTime() ?? 0;
    const periodEnd = dashboardRangeDays.at(-1)?.end.getTime() ?? Date.now();
    return transactions.reduce((sum, item) => {
      const date = transactionChartDate(item).getTime();
      if (item.type !== "masuk" || date < periodStart || date > periodEnd) return sum;
      const ingredient = ingredientById.get(item.ingredientId);
      return sum + Number(item.quantity) * (item.unitPrice ?? ingredient?.price ?? 0);
    }, 0);
  }, [dashboardRangeDays, ingredientById, transactions]);
  const stockValueSeries = useMemo(() => {
    const impacts = new Map(stockBuckets.map((bucket) => [bucket.key, 0]));
    for (const transaction of transactions) {
      const key = bucketKeyForDate(transactionChartDate(transaction), stockBuckets, stockGranularity);
      if (!key || !impacts.has(key)) continue;
      const ingredient = ingredientById.get(transaction.ingredientId);
      const nominal =
        Number(transaction.quantity) *
        (transaction.type === "masuk" ? transaction.unitPrice ?? ingredient?.price ?? 0 : ingredient?.price ?? 0);
      impacts.set(key, (impacts.get(key) ?? 0) + (transaction.type === "masuk" ? nominal : -nominal));
    }
    for (const ledger of stockLedger.filter((item) => item.source !== "stock_in" && item.source !== "stock_out")) {
      const key = bucketKeyForDate(new Date(ledger.createdAt), stockBuckets, stockGranularity);
      if (!key || !impacts.has(key)) continue;
      const ingredient = ingredientById.get(ledger.ingredientId);
      const nominal = Number(ledger.delta) * (ingredient?.price ?? 0);
      impacts.set(key, (impacts.get(key) ?? 0) + nominal);
    }
    const totalImpact = Array.from(impacts.values()).reduce((sum, value) => sum + value, 0);
    let running = Math.max(0, metrics.stockValue - totalImpact);
    return stockBuckets.map((bucket) => {
      running = Math.max(0, running + (impacts.get(bucket.key) ?? 0));
      return { label: bucket.label, value: running };
    });
  }, [ingredientById, metrics.stockValue, stockBuckets, stockGranularity, stockLedger, transactions]);
  const flowSeries = useMemo(() => {
    const masuk = new Map(flowBuckets.map((bucket) => [bucket.key, 0]));
    const keluar = new Map(flowBuckets.map((bucket) => [bucket.key, 0]));
    for (const transaction of transactions) {
      const key = bucketKeyForDate(transactionChartDate(transaction), flowBuckets, flowGranularity);
      if (!key || !masuk.has(key)) continue;
      const ingredient = ingredientById.get(transaction.ingredientId);
      const nominal =
        Number(transaction.quantity) *
        (transaction.type === "masuk" ? transaction.unitPrice ?? ingredient?.price ?? 0 : ingredient?.price ?? 0);
      const target = transaction.type === "masuk" ? masuk : keluar;
      target.set(key, (target.get(key) ?? 0) + nominal);
    }
    for (const correction of stockLedger.filter((item) => item.source === "owner_stock_correction")) {
      const delta = Number(correction.delta);
      if (!delta) continue;
      const key = bucketKeyForDate(new Date(correction.createdAt), flowBuckets, flowGranularity);
      if (!key || !masuk.has(key)) continue;
      const ingredient = ingredientById.get(correction.ingredientId);
      const nominal = Math.abs(delta) * (ingredient?.price ?? 0);
      const target = delta > 0 ? masuk : keluar;
      target.set(key, (target.get(key) ?? 0) + nominal);
    }
    return {
      labels: flowBuckets.map((bucket) => bucket.label),
      masuk: flowBuckets.map((bucket) => masuk.get(bucket.key) ?? 0),
      keluar: flowBuckets.map((bucket) => keluar.get(bucket.key) ?? 0),
    };
  }, [flowBuckets, flowGranularity, ingredientById, stockLedger, transactions]);
  const quantitySeries = useMemo(() => {
    const masuk = new Map(quantityBuckets.map((bucket) => [bucket.key, 0]));
    const keluar = new Map(quantityBuckets.map((bucket) => [bucket.key, 0]));
    for (const transaction of transactions) {
      const key = bucketKeyForDate(transactionChartDate(transaction), quantityBuckets, quantityGranularity);
      if (!key || !masuk.has(key)) continue;
      const target = transaction.type === "masuk" ? masuk : keluar;
      target.set(key, (target.get(key) ?? 0) + Number(transaction.quantity));
    }
    for (const correction of stockLedger.filter((item) => item.source === "owner_stock_correction")) {
      const delta = Number(correction.delta);
      if (!delta) continue;
      const key = bucketKeyForDate(new Date(correction.createdAt), quantityBuckets, quantityGranularity);
      if (!key || !masuk.has(key)) continue;
      const target = delta > 0 ? masuk : keluar;
      target.set(key, (target.get(key) ?? 0) + Math.abs(delta));
    }
    return {
      labels: quantityBuckets.map((bucket) => bucket.label),
      masuk: quantityBuckets.map((bucket) => masuk.get(bucket.key) ?? 0),
      keluar: quantityBuckets.map((bucket) => keluar.get(bucket.key) ?? 0),
    };
  }, [quantityBuckets, quantityGranularity, stockLedger, transactions]);

  return (
    <div className="dashboard-shell space-y-5 rounded-lg border p-3 shadow-soft transition-colors duration-700 sm:p-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card/88 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Periode dashboard</p>
          <p className="mt-1 font-mono text-xs text-primary">{formatDashboardRangeSummary(dashboardRangeDays)}</p>
        </div>
        <div className="sm:w-[260px]">
          <ChartRangePicker
            customEnd={dashboardCustomEnd}
            customStart={dashboardCustomStart}
            label="Filter periode dashboard"
            onCustomEndChange={setDashboardCustomEnd}
            onCustomStartChange={setDashboardCustomStart}
            onRangePresetChange={setDashboardRangePreset}
            rangePreset={dashboardRangePreset}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SimpleMetric
          className="bg-card text-foreground"
          detail={`${metrics.total} item aktif`}
          icon={Package}
          title="Total SKU"
          value={`${metrics.total}`}
        />
        <SimpleMetric
          className="bg-card text-destructive"
          detail="perlu restock"
          icon={AlertTriangle}
          onClick={onCriticalStock}
          title="Bahan Kritis"
          value={`${metrics.critical}`}
        />
        <SimpleMetric
          className="bg-card text-primary"
          detail="periode terpilih"
          icon={LogOut}
          title="Pengeluaran"
          value={formatRupiah(filteredExpense)}
        />
        <SimpleMetric
          className="bg-card text-success"
          detail="estimasi"
          icon={Database}
          title="Nilai Stok"
          value={formatRupiah(metrics.stockValue)}
        />
      </div>

      <MoneyLineChart
        granularity={stockGranularity}
        onGranularityChange={setStockGranularity}
        series={stockValueSeries}
        title="Nominal Uang Semua Stock"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <MultiMoneyLineChart
          data={quantitySeries}
          formatter={formatCompactNumber}
          granularity={quantityGranularity}
          onGranularityChange={setQuantityGranularity}
          title="Stock Barang Masuk dan Keluar"
        />
        <MultiMoneyLineChart
          data={flowSeries}
          formatter={formatCompactNumber}
          granularity={flowGranularity}
          onGranularityChange={setFlowGranularity}
          title="Nominal Stock Masuk dan Keluar"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="bg-card/95">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Owner review</p>
              <CardTitle className="mt-1">Prioritas Restock</CardTitle>
            </div>
            <Button onClick={() => onNavigate("opname")} size="sm" variant="outline">
              <ClipboardCheck />
              Data Aktual
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {lowStockItems.length ? (
              lowStockItems.map((item) => {
                const status = stockStatus(item);
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-md border bg-muted/35 p-3">
                    <span className={cn("size-2.5 rounded-full", status.tone === "red" ? "bg-destructive" : "bg-amber-500")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.stock} {item.unit} / minimum {item.minimum} {item.unit}
                      </p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                );
              })
            ) : (
              <EmptyState message="Tidak ada bahan kritis dari API." />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/95">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Last activity</p>
              <CardTitle className="mt-1">Audit Transaksi</CardTitle>
            </div>
            <Badge variant="secondary">{recentActivities.length} item</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recentActivities.length ? (
              recentActivities.map((item) => {
                const ingredient = ingredientById.get(item.ingredientId);
                return (
                  <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border bg-muted/35 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{ingredient?.name ?? item.ingredientName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.operatorName} / {item.date.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={item.variant as "success" | "warning" | "secondary"}>{item.label}</Badge>
                      <p className="mt-1 font-mono text-xs font-bold">
                        {item.quantity.toLocaleString("id-ID")} {ingredient?.unit ?? item.unit}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState message="Belum ada aktivitas dari API." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function dateInputKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCompactNumber(value: number) {
  const rounded = Math.round(value);
  const absolute = Math.abs(rounded);
  const sign = rounded < 0 ? "-" : "";

  if (absolute >= 1_000_000) {
    const compact = absolute / 1_000_000;
    const digits = compact >= 10 ? 0 : 3;
    return `${sign}${new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(compact)}JT`;
  }

  if (absolute >= 1_000) {
    const compact = absolute / 1_000;
    const digits = compact >= 100 ? 0 : 1;
    return `${sign}${new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(compact)}K`;
  }

  return `${rounded}`;
}

function formatCompactRupiah(value: number) {
  return `Rp ${formatCompactNumber(value)}`;
}

const dashboardRangeOptions: Array<{ value: DashboardRangePreset; label: string }> = [
  { value: "today", label: "Hari ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "7d", label: "7 hari terakhir" },
  { value: "this-month", label: "Bulan ini" },
  { value: "last-month", label: "Bulan kemarin" },
  { value: "all", label: "Semua data" },
  { value: "custom", label: "Custom Range" },
];

const chartGranularityOptions: Array<{ value: ChartGranularity; label: string }> = [
  { value: "tanggal", label: "Tanggal" },
  { value: "hari", label: "Hari" },
  { value: "minggu", label: "Minggu" },
  { value: "jam", label: "Jam" },
];

type DashboardBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

function buildDashboardDays(length: 7 | 14 | 30) {
  return Array.from({ length }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (length - 1 - index));
    return {
      key: dateInputKey(date),
      label: date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    };
  });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function buildDashboardRangeDays(start: Date, end: Date): DashboardBucket[] {
  const safeStart = start > end ? end : start;
  const safeEnd = start > end ? start : end;
  const startDay = startOfDay(safeStart);
  const endDay = startOfDay(safeEnd);
  const totalDays = Math.min(1095, Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86_400_000) + 1));

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(startDay, index);
    return {
      key: dateInputKey(date),
      label: date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      start: startOfDay(date),
      end: endOfDay(date),
    };
  });
}

function dashboardRangeFromPreset(preset: DashboardRangePreset, customStart: string, customEnd: string, allStart?: string) {
  const today = new Date();
  if (preset === "today") return buildDashboardRangeDays(today, today);
  if (preset === "yesterday") {
    const yesterday = addDays(today, -1);
    return buildDashboardRangeDays(yesterday, yesterday);
  }
  if (preset === "7d") return buildDashboardRangeDays(addDays(today, -6), today);
  if (preset === "this-month") return buildDashboardRangeDays(monthStart(today), today);
  if (preset === "last-month") {
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return buildDashboardRangeDays(monthStart(previousMonth), monthEnd(previousMonth));
  }
  if (preset === "all") {
    const start = allStart ? new Date(allStart) : addDays(today, -6);
    return buildDashboardRangeDays(start, today);
  }

  const start = customStart ? new Date(customStart) : addDays(today, -6);
  const end = customEnd ? new Date(customEnd) : today;
  return buildDashboardRangeDays(start, end);
}

function formatDashboardRangeSummary(days: DashboardBucket[]) {
  const first = days[0]?.start;
  const last = days.at(-1)?.end;
  if (!first || !last) return "Pilih periode";
  return `${chartDateLabel(dateInputKey(first))} - ${chartDateLabel(dateInputKey(last))}`;
}

function buildChartBuckets(days: DashboardBucket[], granularity: ChartGranularity): DashboardBucket[] {
  const safeDays = days.length ? days : buildDashboardRangeDays(addDays(new Date(), -6), new Date());
  if (granularity === "jam") {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: `hour-${hour}`,
      label: `${String(hour).padStart(2, "0")}:00`,
      start: new Date(safeDays[0].start.getFullYear(), safeDays[0].start.getMonth(), safeDays[0].start.getDate(), hour),
      end: new Date(safeDays.at(-1)!.end.getFullYear(), safeDays.at(-1)!.end.getMonth(), safeDays.at(-1)!.end.getDate(), hour, 59, 59, 999),
    }));
  }

  if (granularity === "minggu") {
    const grouped = new Map<string, DashboardBucket>();
    for (const day of safeDays) {
      const weekStart = startOfWeek(day.start);
      const key = dateInputKey(weekStart);
      const existing = grouped.get(key);
      if (existing) {
        existing.end = day.end;
      } else {
        grouped.set(key, {
          key,
          label: weekStart.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
          start: weekStart,
          end: day.end,
        });
      }
    }
    return Array.from(grouped.values()).slice(-4);
  }

  if (granularity === "hari") {
    return safeDays.map((day) => ({
      ...day,
      label: day.start.toLocaleDateString("id-ID", { weekday: "short" }),
    }));
  }

  return safeDays;
}

function bucketKeyForDate(date: Date, buckets: DashboardBucket[], granularity: ChartGranularity) {
  if (Number.isNaN(date.getTime())) return null;
  if (granularity === "jam") return `hour-${date.getHours()}`;
  const targetTime = date.getTime();
  return buckets.find((bucket) => targetTime >= bucket.start.getTime() && targetTime <= bucket.end.getTime())?.key ?? null;
}

function chartDateLabel(value: string) {
  if (!value) return "Pilih tanggal";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pilih tanggal";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ChartRangePicker({
  label,
  rangePreset,
  customStart,
  customEnd,
  onRangePresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: {
  label: string;
  rangePreset: DashboardRangePreset;
  customStart: string;
  customEnd: string;
  onRangePresetChange: (value: DashboardRangePreset) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  return (
    <details className="group relative">
      <summary
        aria-label={label}
        className="flex h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-md border bg-muted/45 px-3 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/45 hover:bg-muted [&::-webkit-details-marker]:hidden"
      >
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {rangePreset === "custom"
            ? `${chartDateLabel(customStart)} - ${chartDateLabel(customEnd)}`
            : rangePreset === "all"
              ? "Awal - sekarang"
              : "Periode"}
        </span>
      </summary>
      <div className="fixed inset-x-3 top-24 z-[70] max-h-[72vh] overflow-y-auto rounded-lg border bg-card p-3 shadow-brand md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-[560px]">
        <div className="grid gap-3 md:grid-cols-[1fr_136px_1fr] md:items-start">
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Dari tanggal
            <span className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-primary" />
              <Input
                className="h-9 pl-9 font-mono text-xs"
                onChange={(event) => {
                  onCustomStartChange(event.target.value);
                  onRangePresetChange("custom");
                }}
                type="date"
                value={customStart}
              />
            </span>
          </label>
          <div className="grid gap-1.5">
            {dashboardRangeOptions.map((item) => (
              <button
                className={cn(
                  "h-8 rounded-md px-3 text-left text-xs font-semibold transition",
                  rangePreset === item.value ? "bg-primary text-primary-foreground" : "bg-muted/55 text-primary hover:bg-primary/10",
                )}
                key={item.value}
                onClick={() => onRangePresetChange(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Sampai tanggal
            <span className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-primary" />
              <Input
                className="h-9 pl-9 font-mono text-xs"
                onChange={(event) => {
                  onCustomEndChange(event.target.value);
                  onRangePresetChange("custom");
                }}
                type="date"
                value={customEnd}
              />
            </span>
          </label>
        </div>
      </div>
    </details>
  );
}

function ChartGranularitySelect({
  value,
  onChange,
}: {
  value: ChartGranularity;
  onChange: (value: ChartGranularity) => void;
}) {
  return (
    <label className="absolute right-3 top-3 z-10">
      <span className="sr-only">Granularitas chart</span>
      <Select
        className="h-8 min-w-[92px] border-border/70 bg-card/80 px-2 text-xs font-semibold normal-case tracking-normal shadow-sm backdrop-blur"
        onChange={(event) => onChange(event.target.value as ChartGranularity)}
        value={value}
      >
        {chartGranularityOptions.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function ChartWindowControl({
  value,
  onChange,
}: {
  value: 7 | 14 | 30;
  onChange: (value: 7 | 14 | 30) => void;
}) {
  return (
    <div className="flex rounded-md bg-muted p-1">
      {([7, 14, 30] as const).map((item) => (
        <button
          className={cn(
            "h-8 rounded px-3 font-mono text-xs font-medium text-muted-foreground transition",
            value === item && "bg-card text-primary shadow-sm",
          )}
          key={item}
          onClick={() => onChange(item)}
          type="button"
        >
          {item}D
        </button>
      ))}
    </div>
  );
}

function linePath(values: number[], width: number, height: number, padding: number) {
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function smoothLinePath(values: number[], width: number, height: number, padding: number) {
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => ({
    x: padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2),
    y: height - padding - ((value - min) / range) * (height - padding * 2),
  }));
  if (points.length < 2) return "";
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const previous = points[index - 1];
    const cp1x = previous.x + (point.x - previous.x) / 2;
    const cp2x = point.x - (point.x - previous.x) / 2;
    return `${path} C ${cp1x.toFixed(2)} ${previous.y.toFixed(2)}, ${cp2x.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
}

type ChartPoint = { x: number; y: number; value: number };

function chartPoints(values: number[], width: number, height: number, padding: { left: number; right: number; top: number; bottom: number }, max: number) {
  const range = Math.max(1, max);
  return values.map((value, index) => ({
    value,
    x: padding.left + (index / Math.max(values.length - 1, 1)) * (width - padding.left - padding.right),
    y: height - padding.bottom - (value / range) * (height - padding.top - padding.bottom),
  }));
}

function curvedPath(points: ChartPoint[]) {
  if (!points.length) return "";
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const previous = points[index - 1];
    const cp1x = previous.x + (point.x - previous.x) / 2;
    const cp2x = point.x - (point.x - previous.x) / 2;
    return `${path} C ${cp1x.toFixed(2)} ${previous.y.toFixed(2)}, ${cp2x.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
}

function chartAreaPath(path: string, padding: { left: number; right: number; bottom: number }, width: number, height: number) {
  const baseline = height - padding.bottom;
  return path ? `${path} L ${width - padding.right} ${baseline} L ${padding.left} ${baseline} Z` : "";
}

function chartTicks(max: number, min = 0) {
  const range = Math.max(1, max - min);
  return [max, min + range * 0.66, min + range * 0.33, min];
}

function MoneyLineChart({
  title,
  series,
  granularity,
  onGranularityChange,
}: {
  title: string;
  series: Array<{ label: string; value: number }>;
  granularity: ChartGranularity;
  onGranularityChange: (value: ChartGranularity) => void;
}) {
  const values = series.map((item) => item.value);
  const latest = values.at(-1) ?? 0;
  const width = 960;
  const height = 300;
  const padding = { bottom: 48, left: 92, right: 24, top: 22 };
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => ({
    value,
    x: padding.left + (index / Math.max(values.length - 1, 1)) * (width - padding.left - padding.right),
    y: height - padding.bottom - ((value - min) / range) * (height - padding.top - padding.bottom),
  }));
  const path = curvedPath(points);
  const areaPath = chartAreaPath(path, padding, width, height);
  const yTicks = chartTicks(max, min);
  const labelStep = Math.max(1, Math.ceil(series.length / 6));
  const gradientId = `inventory-area-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Nilai inventori</p>
          <CardTitle className="mt-1 text-xl tracking-normal">{title}</CardTitle>
          <p className="mt-2 font-mono text-sm font-medium text-primary">{formatRupiah(latest)}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-md border border-border/70 bg-[hsl(var(--muted)/0.42)] p-3 shadow-inner">
          <ChartGranularitySelect onChange={onGranularityChange} value={granularity} />
          <svg className="h-72 w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--foreground) / 0.30)" />
                <stop offset="58%" stopColor="hsl(var(--foreground) / 0.10)" />
                <stop offset="100%" stopColor="hsl(var(--foreground) / 0.01)" />
              </linearGradient>
            </defs>
            {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
            {yTicks.map((tick) => {
              const y = height - padding.bottom - ((tick - min) / range) * (height - padding.top - padding.bottom);
              return (
                <g key={tick}>
                  <line className="stroke-foreground/10 dark:stroke-white/10" strokeWidth="1" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                  <text className="fill-muted-foreground font-mono text-[12px] font-normal" textAnchor="end" x={padding.left - 12} y={y + 4}>
                    {formatCompactNumber(tick)}
                  </text>
                </g>
              );
            })}
            {path && (
              <path
                className="stroke-[#5f5a50] dark:stroke-white/80"
                d={path}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.35"
              />
            )}
            {series.map((item, index) => {
              if (index % labelStep !== 0 && index !== series.length - 1) return null;
              const x = padding.left + (index / Math.max(series.length - 1, 1)) * (width - padding.left - padding.right);
              return (
                <text className="fill-muted-foreground font-mono text-[11px] font-normal" key={item.label} textAnchor="middle" x={x} y={height - 12}>
                  {item.label}
                </text>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

function MultiMoneyLineChart({
  title,
  data,
  formatter,
  granularity,
  onGranularityChange,
}: {
  title: string;
  data: { labels: string[]; masuk: number[]; keluar: number[] };
  formatter: (value: number) => string;
  granularity: ChartGranularity;
  onGranularityChange: (value: ChartGranularity) => void;
}) {
  const allValues = [...data.masuk, ...data.keluar];
  const width = 620;
  const height = 250;
  const padding = { bottom: 44, left: 70, right: 22, top: 22 };
  const max = Math.max(1, ...allValues);
  const masukPoints = chartPoints(data.masuk, width, height, padding, max);
  const keluarPoints = chartPoints(data.keluar, width, height, padding, max);
  const masukPath = curvedPath(masukPoints);
  const keluarPath = curvedPath(keluarPoints);
  const labelStep = Math.max(1, Math.ceil(data.labels.length / 4));
  const yTicks = chartTicks(max);
  const masukAreaPath = chartAreaPath(masukPath, padding, width, height);
  const keluarAreaPath = chartAreaPath(keluarPath, padding, width, height);
  const gradientBase = title.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Multiple line</p>
          <CardTitle className="mt-1 text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative rounded-md border border-border/70 bg-[hsl(var(--muted)/0.42)] p-3 shadow-inner">
          <ChartGranularitySelect onChange={onGranularityChange} value={granularity} />
          <svg className="h-56 w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id={`${gradientBase}-masuk-area`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--foreground) / 0.18)" />
                <stop offset="100%" stopColor="hsl(var(--foreground) / 0.05)" />
              </linearGradient>
              <linearGradient id={`${gradientBase}-keluar-area`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary) / 0.16)" />
                <stop offset="100%" stopColor="hsl(var(--primary) / 0.02)" />
              </linearGradient>
            </defs>
            {masukAreaPath && <path d={masukAreaPath} fill={`url(#${gradientBase}-masuk-area)`} />}
            {keluarAreaPath && <path d={keluarAreaPath} fill={`url(#${gradientBase}-keluar-area)`} />}
            {yTicks.map((tick) => {
              const y = height - padding.bottom - (tick / max) * (height - padding.top - padding.bottom);
              return (
                <g key={tick}>
                  <line className="stroke-foreground/10 dark:stroke-white/10" strokeWidth="1" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                  <text className="fill-muted-foreground font-mono text-[10px] font-normal" textAnchor="end" x={padding.left - 10} y={y + 4}>
                    {formatter(tick)}
                  </text>
                </g>
              );
            })}
            <path className="stroke-[#4f6658] dark:stroke-white/82" d={masukPath} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
            <path className="stroke-[#b8962e] dark:stroke-[#d8d0c5]/78" d={keluarPath} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
            {data.labels.map((label, index) => {
              if (index % labelStep !== 0 && index !== data.labels.length - 1) return null;
              const x = padding.left + (index / Math.max(data.labels.length - 1, 1)) * (width - padding.left - padding.right);
              return (
                <text className="fill-muted-foreground font-mono text-[10px] font-normal" key={`date-${label}-${index}`} textAnchor="middle" x={x} y={height - 10}>
                  {label}
                </text>
              );
            })}
          </svg>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success" />
              Masuk {formatter(data.masuk.at(-1) ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              Keluar {formatter(data.keluar.at(-1) ?? 0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleMetric({
  title,
  value,
  detail,
  icon: Icon,
  className,
  onClick,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: typeof Database;
  className?: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      className={cn(
        "list-item relative min-h-32 overflow-hidden rounded-lg border bg-card p-4 text-left shadow-sm transition",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-brand",
        className,
      )}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <span className="absolute inset-y-4 left-0 w-0.5 bg-primary opacity-55" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] opacity-70">{title}</p>
        <Icon className="size-4 opacity-60" />
      </div>
      <p className="mt-4 font-mono text-2xl font-medium tracking-normal">{value}</p>
      {detail && <p className="mt-2 text-sm font-medium opacity-70">{detail}</p>}
    </Wrapper>
  );
}

function ChartCard({
  title,
  bars,
  formatter,
  variant,
  kicker,
}: {
  title: string;
  bars: Array<{ label: string; value: number }>;
  formatter: (value: number) => string;
  variant: "money" | "usage";
  kicker: string;
}) {
  const max = Math.max(1, ...bars.map((item) => item.value));
  return (
    <Card className="bg-card/95">
      <CardHeader>
        <p className="text-[11px] font-bold uppercase text-muted-foreground">{kicker}</p>
        <CardTitle className="mt-1">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-72 items-end gap-2 rounded-lg border bg-muted/35 p-3 sm:gap-3 sm:p-4">
          {bars.map((item, index) => {
            const height = Math.max(16, Math.round((item.value / max) * 100));
            const isFocus = index === bars.length - 1 || (variant === "usage" && item.value === max);
            return (
              <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground">{formatter(item.value)}</span>
                <div
                  className={cn(
                    "w-full rounded-t-lg transition-all duration-700",
                    isFocus ? "bg-primary" : "bg-accent",
                    variant === "usage" && isFocus && "bg-foreground",
                  )}
                  style={{ height: `${height}%` }}
                />
                <span className="text-xs font-bold text-muted-foreground">{item.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StockPage({
  filteredInventory,
  categories,
  search,
  category,
  onSearch,
  onCategory,
  onDetail,
  requestedSort,
}: {
  filteredInventory: Ingredient[];
  categories: Category[];
  search: string;
  category: Category | "Semua";
  onSearch: (value: string) => void;
  onCategory: (value: Category | "Semua") => void;
  onDetail: (item: Ingredient) => void;
  requestedSort: AutoFilterState<"name" | "category" | "stock" | "minimum" | "status" | "value">;
}) {
  const [stockSort, setStockSort] = useState<AutoFilterState<"name" | "category" | "stock" | "minimum" | "status" | "value">>({
    column: null,
    direction: "",
  });

  useEffect(() => {
    if (requestedSort.column && requestedSort.direction) setStockSort(requestedSort);
  }, [requestedSort]);
  const stockRows = useMemo(
    () => {
      if (!stockSort.column || !stockSort.direction) return filteredInventory;
      return [...filteredInventory].sort((left, right) => {
        const leftStatus = stockStatus(left).label;
        const rightStatus = stockStatus(right).label;
        const leftValue = left.stock * left.price;
        const rightValue = right.stock * right.price;
        switch (stockSort.column) {
          case "name":
            return applySortDirection(compareText(left.name, right.name), stockSort.direction);
          case "category":
            return applySortDirection(compareText(left.category, right.category), stockSort.direction);
          case "stock":
            return applySortDirection(compareNumber(left.stock, right.stock), stockSort.direction);
          case "minimum":
            return applySortDirection(compareNumber(left.minimum, right.minimum), stockSort.direction);
          case "status":
            return applySortDirection(compareText(leftStatus, rightStatus), stockSort.direction);
          case "value":
            return applySortDirection(compareNumber(leftValue, rightValue), stockSort.direction);
          default:
            return 0;
        }
      });
    },
    [filteredInventory, stockSort],
  );

  function setStockSortColumn(column: "name" | "category" | "stock" | "minimum" | "status" | "value", direction: SortDirection) {
    setStockSort(direction ? { column, direction } : { column: null, direction: "" });
  }

  return (
    <Card className="bg-card/95">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Daftar Stok dari API</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Cari bahan..."
                value={search}
              />
            </label>
            <Select onChange={(event) => onCategory(event.target.value as Category | "Semua")} value={category}>
              <option>Semua</option>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:hidden">
          {stockRows.map((item) => {
            const status = stockStatus(item);
            const progress = Math.min(100, Math.round(status.ratio));
            const tone = getCategoryTone(item.category);
            return (
              <div key={item.id} className="rounded-md border bg-muted/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{item.name}</p>
                    <Badge className={cn("mt-2", tone.bg, tone.text)} variant="outline">
                      {item.category.split(" ")[0]}
                    </Badge>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Stok</p>
                    <p className="font-mono font-medium">{item.stock} {item.unit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nilai</p>
                    <p className="font-mono font-medium">{formatRupiah(item.stock * item.price)}</p>
                  </div>
                </div>
                <Progress
                  className="mt-4 h-1.5"
                  indicatorClassName={cn(status.tone === "red" && "[--stock-bar:#dc2626]", status.tone === "amber" && "[--stock-bar:#d97706]", status.tone === "green" && "[--stock-bar:#B8962E]")}
                  value={progress}
                />
                <Button className="mt-4 w-full" onClick={() => onDetail(item)} size="sm" variant="outline">
                  <Eye />
                  Detail
                </Button>
              </div>
            );
          })}
          {!stockRows.length && <EmptyState message="Tidak ada bahan dari API untuk filter ini." />}
        </div>
        <div className="hidden overflow-x-auto rounded-md border md:block">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">
                  <AutoFilterHeader label="Bahan" kind="text" onChange={(value) => setStockSortColumn("name", value)} value={stockSort.column === "name" ? stockSort.direction : ""} />
                </th>
                <th className="px-4 py-2 text-left">
                  <AutoFilterHeader label="Kategori" kind="text" onChange={(value) => setStockSortColumn("category", value)} value={stockSort.column === "category" ? stockSort.direction : ""} />
                </th>
                <th className="px-4 py-2 text-left">
                  <AutoFilterHeader label="Stok" kind="number" onChange={(value) => setStockSortColumn("stock", value)} value={stockSort.column === "stock" ? stockSort.direction : ""} />
                </th>
                <th className="px-4 py-2 text-left">
                  <AutoFilterHeader label="Minimum" kind="number" onChange={(value) => setStockSortColumn("minimum", value)} value={stockSort.column === "minimum" ? stockSort.direction : ""} />
                </th>
                <th className="px-4 py-2 text-left">
                  <AutoFilterHeader label="Status" kind="text" onChange={(value) => setStockSortColumn("status", value)} value={stockSort.column === "status" ? stockSort.direction : ""} />
                </th>
                <th className="px-4 py-2 text-left">
                  <AutoFilterHeader label="Nilai" kind="number" onChange={(value) => setStockSortColumn("value", value)} value={stockSort.column === "value" ? stockSort.direction : ""} />
                </th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((item) => {
                const status = stockStatus(item);
                const progress = Math.min(100, Math.round(status.ratio));
                const tone = getCategoryTone(item.category);
                return (
                  <tr key={item.id} className="border-t transition hover:bg-muted/35">
                    <td className="px-4 py-3 font-bold">{item.name}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn(tone.bg, tone.text)} variant="outline">{item.category.split(" ")[0]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-24 font-mono font-bold">{item.stock} {item.unit}</span>
                        <Progress
                          className="h-1.5 w-24"
                          indicatorClassName={cn(status.tone === "red" && "[--stock-bar:#dc2626]", status.tone === "amber" && "[--stock-bar:#d97706]", status.tone === "green" && "[--stock-bar:#B8962E]")}
                          value={progress}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{item.minimum} {item.unit}</td>
                    <td className="px-4 py-3"><Badge variant={status.variant}>{status.label}</Badge></td>
                    <td className="px-4 py-3 font-mono">{formatRupiah(item.stock * item.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button onClick={() => onDetail(item)} size="sm" variant="outline">
                        <Eye />
                        Detail
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!stockRows.length && <EmptyState message="Tidak ada bahan dari API untuk filter ini." />}
        </div>
      </CardContent>
    </Card>
  );
}

function StockHistoryPanel({ history, onClose }: { history: StockHistoryState; onClose: () => void }) {
  if (!history) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#1A1612]/45 p-3 backdrop-blur-sm sm:place-items-center">
      <Card className="max-h-[86vh] w-full max-w-2xl overflow-hidden bg-card shadow-brand">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">History Barang</p>
            <CardTitle className="mt-1 truncate text-xl">{history.item.name}</CardTitle>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {history.item.stock} {history.item.unit} tersedia / minimum {history.item.minimum} {history.item.unit}
            </p>
          </div>
          <Button aria-label="Tutup history barang" onClick={onClose} size="icon" type="button" variant="outline">
            <LogOut className="rotate-180" />
          </Button>
        </CardHeader>
        <CardContent className="max-h-[68vh] overflow-y-auto p-0">
          {history.loading ? (
            <div className="flex items-center gap-3 p-5 text-sm font-semibold text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Membaca stock_transactions...
            </div>
          ) : history.rows.length ? (
            <div className="divide-y">
              {history.rows.map((row) => {
                const date = transactionActivityDate(row);
                return (
                  <div className="grid gap-2 p-4 sm:grid-cols-[1.1fr_0.75fr_1fr_0.75fr] sm:items-center" key={row.id}>
                    <div>
                      <p className="font-mono text-sm font-medium">{date.toLocaleDateString("id-ID")}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    </div>
                    <Badge className="w-fit" variant={row.type === "masuk" ? "success" : "warning"}>
                      {row.type === "masuk" ? "Masuk" : "Keluar"}
                    </Badge>
                    <p className="text-sm font-semibold">{row.operatorName}</p>
                    <p className="font-mono text-sm font-medium sm:text-right">
                      {Number(row.quantity)} {history.item.unit}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="Belum ada history transaksi untuk bahan ini." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StockInputPage({
  inventory,
  mode,
  transactions,
  onSelectedIngredient,
  onSubmit,
  onSubmitBom,
  role,
  submitting,
  submittingBom,
}: {
  inventory: Ingredient[];
  mode: StockMode;
  transactions: TransactionRow[];
  onSelectedIngredient: (id: string) => void;
  onSubmit: (formData: FormData) => Promise<boolean>;
  onSubmitBom: (payload: { bomId: string; productionCount: number; transactionDate: string }) => Promise<boolean>;
  role: Role;
  submitting: boolean;
  submittingBom: boolean;
}) {
  type StockInputRow = { key: string; ingredientId: string; query: string; amount: string; price: string; note: string };
  const isIn = mode === "masuk";
  const bomAccess = canAccessBomUi(role);
  const createEmptyRow = (suffix: string): StockInputRow => ({
    amount: "",
    ingredientId: "",
    key: `row-${suffix}`,
    note: "",
    price: "",
    query: "",
  });
  const [rows, setRows] = useState<StockInputRow[]>(() => [
    createEmptyRow("1"),
  ]);
  const ingredientById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const ingredientByName = useMemo(() => new Map(inventory.map((item) => [item.name.toLowerCase(), item])), [inventory]);
  const recentActivities = transactions.filter((item) => item.type === mode).slice(0, 6);
  const listId = `ingredient-list-${mode}`;
  const [entryMode, setEntryMode] = useState<StockInputMode>("regular");
  const [bomRecipes, setBomRecipes] = useState<BomRecipeRow[]>([]);
  const [bomId, setBomId] = useState("");
  const [bomProductionCount, setBomProductionCount] = useState("");
  const selectedBomRecipe = useMemo(() => bomRecipes.find((recipe) => recipe.id === bomId) ?? null, [bomId, bomRecipes]);
  const bomProductionValue = Number(bomProductionCount) || 0;
  const bomSimulation = useMemo(() => {
    if (!selectedBomRecipe || bomProductionValue <= 0) return [];
    return selectedBomRecipe.items.map((item) => {
      const ingredient = ingredientById.get(item.ingredientId);
      const requiredQuantity = item.quantity * bomProductionValue;
      const availableStock = ingredient?.stock ?? 0;
      const shortage = Math.max(0, requiredQuantity - availableStock);
      return {
        ...item,
        availableStock,
        requiredQuantity,
        shortage,
        enough: availableStock >= requiredQuantity,
      };
    });
  }, [bomProductionValue, ingredientById, selectedBomRecipe]);
  const hasBomShortage = bomSimulation.some((item) => !item.enough);

  useEffect(() => {
    if (!isIn || !bomAccess) return;
    let ignore = false;
    async function loadBomRecipes() {
      try {
        const rows = await apiJson<BomRecipeRow[]>("/api/bom");
        if (!ignore) setBomRecipes(rows);
      } catch {
        if (!ignore) setBomRecipes([]);
      }
    }
    void loadBomRecipes();
    return () => {
      ignore = true;
    };
  }, [bomAccess, isIn]);

  useEffect(() => {
    if (!isIn) setEntryMode("regular");
  }, [isIn]);

  function findIngredientByQuery(query: string) {
    const normalized = query.trim().toLowerCase();
    return ingredientByName.get(normalized);
  }

  function updateRow(key: string, patch: Partial<StockInputRow>) {
    if (submitting) return;
    setRows((currentRows) => currentRows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handleIngredientQuery(key: string, query: string) {
    const ingredient = findIngredientByQuery(query);
    updateRow(key, {
      ingredientId: ingredient?.id ?? "",
      price: ingredient && isIn ? String(ingredient.price) : "",
      query,
    });
    if (ingredient) onSelectedIngredient(ingredient.id);
  }

  function addRow() {
    if (rows.length >= 20 || submitting) return;
    setRows((currentRows) => [...currentRows, createEmptyRow(`${Date.now()}-${currentRows.length + 1}`)]);
  }

  function removeRow(key: string) {
    if (rows.length === 1 || submitting) return;
    setRows((currentRows) => currentRows.filter((row) => row.key !== key));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const success = await onSubmit(new FormData(event.currentTarget));
    if (success) setRows([createEmptyRow(`${Date.now()}`)]);
  }

  async function handleBomSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingBom) return;
    const productionCount = Number(bomProductionCount);
    if (!bomId || !Number.isFinite(productionCount) || productionCount <= 0) return;
    const dateValue = String(new FormData(event.currentTarget).get("date") ?? "");
    const success = await onSubmitBom({
      bomId,
      productionCount,
      transactionDate: dateValue,
    });
    if (success) {
      setBomProductionCount("");
      setBomId("");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
      <Card className="bg-card/95">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="mt-1 text-lg">{isIn ? "Form Stok Masuk" : "Form Stok Keluar"}</CardTitle>
            </div>
            <Badge variant="secondary">{rows.length}/20</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isIn && bomAccess && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {([
                { id: "regular", label: "Bahan Baku" },
                { id: "bom", label: "Produksi BOM" },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "h-9 rounded-md text-xs font-bold text-muted-foreground transition",
                    entryMode === item.id && "bg-card text-primary shadow-sm",
                  )}
                  onClick={() => setEntryMode(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {entryMode === "bom" && isIn && bomAccess ? (
            <form aria-busy={submittingBom} className="grid gap-4" onSubmit={handleBomSubmit}>
              <label className="grid gap-1.5 text-sm font-semibold">
                Tanggal
                <Input disabled={submittingBom} name="date" defaultValue={new Date().toISOString().slice(0, 10)} type="date" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Nama Barang Produksi
                <Select
                  disabled={submittingBom}
                  onChange={(event) => {
                    const nextBomId = event.target.value;
                    setBomId(nextBomId);
                  }}
                  value={bomId}
                >
                  <option value="">Pilih BOM yang sudah ada</option>
                  {bomRecipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name} ({recipe.yieldQuantity} {recipe.yieldUnit})
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Jumlah Produksi
                <Input
                  disabled={submittingBom}
                  min="0.001"
                  onChange={(event) => setBomProductionCount(event.target.value)}
                  placeholder="Contoh: 5 atau 0.001"
                  step="0.001"
                  type="number"
                  value={bomProductionCount}
                />
              </label>
              {bomId && (
                <div className="rounded-md border bg-muted/35 p-3 text-sm">
                  {selectedBomRecipe && (
                    <div className="grid gap-1">
                      <p className="font-semibold">{selectedBomRecipe.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Default hasil resep: {selectedBomRecipe.yieldQuantity} {selectedBomRecipe.yieldUnit} per 1 produksi
                      </p>
                      <p className="text-xs font-semibold text-primary">
                        Aktual masuk ke stok: {(selectedBomRecipe.yieldQuantity * bomProductionValue).toLocaleString("id-ID")} {selectedBomRecipe.yieldUnit}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!!bomSimulation.length && (
                <div className="rounded-md border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Simulasi Kebutuhan Bahan</p>
                      <p className="text-xs text-muted-foreground">
                        Kebutuhan bahan dihitung dari resep default x jumlah produksi.
                      </p>
                    </div>
                    <Badge variant={hasBomShortage ? "destructive" : "success"}>
                      {hasBomShortage ? "Stok tidak cukup" : "Stok cukup"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {bomSimulation.map((item) => (
                      <div className="rounded-md border bg-muted/25 px-3 py-2" key={item.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{item.ingredientName}</p>
                          <Badge variant={item.enough ? "success" : "destructive"}>
                            {item.enough ? "Cukup" : "Kurang"}
                          </Badge>
                        </div>
                        <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                          <p>Kebutuhan: {item.requiredQuantity.toLocaleString("id-ID")} {item.ingredientUnit}</p>
                          <p>Tersedia: {item.availableStock.toLocaleString("id-ID")} {item.ingredientUnit}</p>
                          <p className={cn(!item.enough && "font-semibold text-destructive")}>
                            Selisih: {item.shortage.toLocaleString("id-ID")} {item.ingredientUnit}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button className="w-full sm:w-auto" disabled={submittingBom || !bomRecipes.length || !bomId || hasBomShortage || bomProductionValue <= 0} type="submit">
                {submittingBom ? <Loader2 className="animate-spin" /> : <Check />}
                {submittingBom ? "Menyimpan..." : "Simpan Produksi BOM"}
              </Button>
            </form>
          ) : (
            <form aria-busy={submitting} className="grid gap-3" onSubmit={handleSubmit}>
              <label className="grid gap-1.5 text-sm font-semibold">
                Tanggal
                <Input disabled={submitting} name="date" defaultValue={new Date().toISOString().slice(0, 10)} type="date" />
              </label>
              <datalist id={listId}>
                {inventory.map((item) => (
                  <option key={item.id} label={`${item.stock} ${item.unit} tersedia`} value={item.name} />
                ))}
              </datalist>

              <div className="grid max-h-[62vh] gap-2 overflow-y-auto pr-1">
                {rows.map((row, index) => {
                  const selected = ingredientById.get(row.ingredientId);
                  return (
                    <div key={row.key} className="rounded-md border bg-muted/35 p-2.5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-mono text-xs font-medium text-muted-foreground">#{String(index + 1).padStart(2, "0")}</p>
                        <Button
                          aria-label={`Hapus bahan ${index + 1}`}
                          disabled={submitting || rows.length === 1}
                          className="size-7"
                          onClick={() => removeRow(row.key)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className={cn("grid gap-2", isIn ? "sm:grid-cols-[minmax(0,1.4fr)_0.65fr_0.8fr]" : "sm:grid-cols-[minmax(0,1.4fr)_0.7fr]")}>
                        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                          <span className="sr-only">Bahan</span>
                          <Input
                            autoComplete="off"
                            disabled={submitting}
                            list={listId}
                            onChange={(event) => handleIngredientQuery(row.key, event.target.value)}
                            placeholder="Ketik nama bahan"
                            value={row.query}
                          />
                          <input name="ingredient" type="hidden" value={row.ingredientId} />
                          <span className={cn("truncate text-[11px] font-medium", selected ? "text-muted-foreground" : "text-destructive")}>
                            {selected ? `${selected.stock} ${selected.unit}` : "Pilih dari autocomplete"}
                          </span>
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                          <span className="sr-only">Jumlah</span>
                          <Input
                            disabled={submitting}
                            min="0.001"
                            name="amount"
                            onChange={(event) => updateRow(row.key, { amount: event.target.value })}
                            placeholder={selected ? `0 ${selected.unit}` : "0"}
                            step="0.001"
                            type="number"
                            value={row.amount}
                          />
                        </label>
                        {isIn && (
                          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                            <span className="sr-only">Harga satuan</span>
                            <Input
                              disabled={submitting}
                              inputMode="numeric"
                              name="price"
                              onChange={(event) => updateRow(row.key, { price: event.target.value })}
                              placeholder="Rp 0"
                              type="text"
                              value={row.price}
                            />
                          </label>
                        )}
                      </div>
                      <label className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
                        <span className="sr-only">Catatan</span>
                        <Input
                          disabled={submitting}
                          name="note"
                          onChange={(event) => updateRow(row.key, { note: event.target.value })}
                          placeholder="Catatan opsional"
                          value={row.note}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button disabled={submitting || rows.length >= 20 || !inventory.length} onClick={addRow} type="button" variant="outline">
                  <Plus />
                  Tambah Bahan
                </Button>
                <Button className="w-full sm:w-auto" disabled={submitting || !inventory.length} type="submit">
                  {submitting ? <Loader2 className="animate-spin" /> : <Check />}
                  {submitting ? "Menyimpan..." : `Simpan ${isIn ? "Stok Masuk" : "Stok Keluar"}`}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Last activity</p>
          <CardTitle className="mt-1">{isIn ? "Barang Masuk" : "Barang Keluar"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {recentActivities.length ? (
            recentActivities.map((activity) => {
              const ingredient = ingredientById.get(activity.ingredientId);
              const date = transactionActivityDate(activity);
              return (
                <div className="rounded-md border bg-muted/35 p-3" key={activity.id}>
                  <div className="flex items-center justify-between gap-3">
                    <Badge className={isIn ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"} variant="outline">
                      {isIn ? "Barang masuk" : "Barang keluar"}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {date.toLocaleDateString("id-ID")} {date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-bold">{ingredient?.name ?? activity.ingredientId}</p>
                    <p className="shrink-0 font-mono text-sm font-medium">{Number(activity.quantity)} {ingredient?.unit ?? ""}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState message={`Belum ada aktivitas ${isIn ? "barang masuk" : "barang keluar"} dari API.`} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OpnamePage({
  inventory,
  actualInputs,
  clock,
  role,
  onActualChange,
  onDataChanged,
  onSubmit,
}: {
  inventory: Ingredient[];
  actualInputs: Record<string, Record<Role, string>>;
  clock: Date;
  role: Role;
  onActualChange: (id: string, role: Role, value: string) => void;
  onDataChanged: () => Promise<void>;
  onSubmit: (ingredientIds: string[]) => Promise<void>;
}) {
  const isInputDay = clock.getDate() === 30;
  const [auditData, setAuditData] = useState<OpnameAuditPayload | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditMessage, setAuditMessage] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [finalInputs, setFinalInputs] = useState<Record<string, { finalActual: string; ownerFinalNote: string }>>({});
  const [extraOpnameIds, setExtraOpnameIds] = useState<string[]>([]);
  const [opnamePickerQuery, setOpnamePickerQuery] = useState("");
  const [selectedOpnameCategory, setSelectedOpnameCategory] = useState("");
  const [opnameSort, setOpnameSort] = useState<AutoFilterState<"name" | "systemStock" | Role | "variance">>({
    column: null,
    direction: "",
  });
  const ingredientById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const ingredientByName = useMemo(() => new Map(inventory.map((item) => [item.name.toLowerCase(), item])), [inventory]);
  const pickerListId = `opname-product-list-${role.toLowerCase()}`;
  const starterGroups = useMemo(() => {
    return Array.from(new Set(inventory.map((item) => item.category))).map((categoryName) => ({
      label: categoryName,
      items: inventory.filter((item) => item.category === categoryName),
    }));
  }, [inventory]);
  const starterOpnameIds = useMemo(
    () => starterGroups.find((group) => group.label === selectedOpnameCategory)?.items.map((item) => item.id) ?? [],
    [selectedOpnameCategory, starterGroups],
  );
  const selectedOpnameIds = useMemo(
    () => Array.from(new Set([...starterOpnameIds, ...extraOpnameIds])).filter((id) => ingredientById.has(id)),
    [extraOpnameIds, ingredientById, starterOpnameIds],
  );
  const visibleInventory = useMemo(
    () => selectedOpnameIds.map((id) => ingredientById.get(id)).filter((item): item is Ingredient => Boolean(item)),
    [ingredientById, selectedOpnameIds],
  );
  const inputRoles = useMemo(() => (role === "Owner" ? (["Owner"] as Role[]) : ([role] as Role[])), [role]);
  const opnameRows = useMemo(
    () => {
      const rows = visibleInventory
        .map((item) => {
          const values = inputRoles.map((inputRole) => Number(actualInputs[item.id]?.[inputRole] || 0)).filter(Boolean);
          const total = values.length ? values.reduce((sum, value) => sum + value, 0) : item.stock;
          const gap = Number((item.stock - total).toFixed(3));
          return {
            item,
            gap,
            assignments: getOpnameAssignments(item),
            values: {
              Owner: actualInputs[item.id]?.Owner ?? "",
              Kasir: actualInputs[item.id]?.Kasir ?? "",
              Cheef: actualInputs[item.id]?.Cheef ?? "",
              Waiters: actualInputs[item.id]?.Waiters ?? "",
            },
          };
        });
      if (!opnameSort.column || !opnameSort.direction) return rows;
      return [...rows].sort((left, right) => {
        switch (opnameSort.column) {
          case "name":
            return applySortDirection(compareText(left.item.name, right.item.name), opnameSort.direction);
          case "systemStock":
            return applySortDirection(compareNumber(left.item.stock, right.item.stock), opnameSort.direction);
          case "Kasir":
          case "Cheef":
          case "Waiters":
          case "Owner":
            return applySortDirection(
              compareNumber(Number(left.values[opnameSort.column] || 0), Number(right.values[opnameSort.column] || 0)),
              opnameSort.direction,
            );
          case "variance":
            return applySortDirection(compareNumber(left.gap, right.gap), opnameSort.direction);
          default:
            return 0;
        }
      });
    },
    [actualInputs, inputRoles, visibleInventory, opnameSort],
  );
  const selectedSession = auditData?.selectedSession ?? null;
  const roleInputsByIngredient = useMemo(() => {
    const map = new Map<string, OpnameRoleInputRow[]>();
    for (const item of auditData?.roleInputs ?? []) {
      map.set(item.ingredientId, [...(map.get(item.ingredientId) ?? []), item]);
    }
    return map;
  }, [auditData]);

  function setOpnameSortColumn(column: "name" | "systemStock" | Role | "variance", direction: SortDirection) {
    setOpnameSort(direction ? { column, direction } : { column: null, direction: "" });
  }

  function addOpnameItem() {
    const ingredient = ingredientByName.get(opnamePickerQuery.trim().toLowerCase());
    if (!ingredient) {
      setAuditMessage("Pilih barang dari daftar autocomplete terlebih dahulu.");
      return;
    }
    setExtraOpnameIds((current) => (current.includes(ingredient.id) || starterOpnameIds.includes(ingredient.id) ? current : [...current, ingredient.id]));
    setOpnamePickerQuery("");
    setAuditMessage("");
  }

  function removeOpnameItem(ingredientId: string) {
    if (starterOpnameIds.includes(ingredientId)) return;
    setExtraOpnameIds((current) => current.filter((id) => id !== ingredientId));
  }

  const loadAudit = useCallback(async (sessionId?: string) => {
    if (role !== "Owner") return;
    setAuditLoading(true);
    try {
      const data = await apiJson<OpnameAuditPayload>(
        `/api/opname${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`,
      );
      setAuditData(data);
      setSelectedSessionId(data.selectedSession?.id ?? "");
      setFinalInputs((current) => {
        const next = { ...current };
        for (const item of data.summaries) {
          next[item.ingredientId] = {
            finalActual: next[item.ingredientId]?.finalActual ?? item.finalActual ?? item.totalRoleActual ?? "",
            ownerFinalNote: next[item.ingredientId]?.ownerFinalNote ?? item.ownerFinalNote ?? "",
          };
        }
        return next;
      });
    } catch (error) {
      setAuditMessage(error instanceof Error ? error.message : "Audit opname gagal dimuat");
    } finally {
      setAuditLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void loadAudit(selectedSessionId || undefined);
  }, [loadAudit, selectedSessionId]);

  async function submitVisibleOpname() {
    await onSubmit(opnameRows.map(({ item }) => item.id));
    if (role === "Owner") await loadAudit(selectedSessionId || undefined);
  }

  async function saveOwnerFinals() {
    if (!selectedSession) return;
    setAuditMessage("");
    try {
      const rows = auditData?.summaries
        .map((item) => ({
          ingredientId: item.ingredientId,
          finalActual: Number(finalInputs[item.ingredientId]?.finalActual),
          ownerFinalNote: finalInputs[item.ingredientId]?.ownerFinalNote,
        }))
        .filter((item) => Number.isFinite(item.finalActual)) ?? [];
      await apiJson<OpnameAuditPayload>("/api/opname", {
        method: "POST",
        body: JSON.stringify({ action: "save-owner-final", sessionId: selectedSession.id, rows }),
      });
      await loadAudit(selectedSession.id);
      setAuditMessage("Final aktual Owner tersimpan.");
    } catch (error) {
      setAuditMessage(error instanceof Error ? error.message : "Final aktual gagal disimpan");
    }
  }

  async function finalizeOpname() {
    if (!selectedSession) return;
    setAuditMessage("");
    try {
      await apiJson<OpnameAuditPayload>("/api/opname", {
        method: "POST",
        body: JSON.stringify({ action: "finalize", sessionId: selectedSession.id }),
      });
      await Promise.all([loadAudit(selectedSession.id), onDataChanged()]);
      setAuditMessage("Opname finalized. Stock ingredients sudah diperbarui.");
    } catch (error) {
      setAuditMessage(error instanceof Error ? error.message : "Finalisasi opname gagal");
    }
  }

  async function downloadOpnameWorkbook(kind: "audit" | "analysis") {
    if (!auditData || !selectedSession) return;
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "STOKARA";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(kind === "audit" ? "data_audit" : "analisis_product");

    if (kind === "audit") {
      const rows = auditData.summaries.flatMap((summary) => {
        const inputs = roleInputsByIngredient.get(summary.ingredientId) ?? [];
        return (inputs.length ? inputs : [null]).map((input) => ({
          session_id: selectedSession.id,
          opname_date: selectedSession.opnameDate,
          status: selectedSession.status,
          finalized_by: selectedSession.finalizedByName ?? "",
          finalized_at: selectedSession.finalizedAt ?? "",
          ingredient: summary.ingredientNameSnapshot,
          category: summary.categorySnapshot,
          unit: summary.unitSnapshot,
          area_name: input?.areaName ?? "",
          responsible_role: input?.role ?? "",
          input_type: input?.inputType ?? "",
          actual_qty_role: input ? Number(input.actualQty) : "",
          input_by: input?.inputByName ?? "",
          input_at: input?.inputAt ?? "",
          system_stock_before: Number(summary.systemStockBefore),
          final_actual: summary.finalActual ? Number(summary.finalActual) : "",
          variance_qty: summary.varianceQty ? Number(summary.varianceQty) : "",
          owner_final_note: summary.ownerFinalNote ?? "",
        }));
      });
      sheet.columns = Object.keys(rows[0] ?? { session_id: "" }).map((key) => ({ header: key, key, width: 22 }));
      sheet.addRows(rows);
    }

    if (kind === "analysis") {
      const rows = auditData.summaries.map((summary) => {
        const inputs = roleInputsByIngredient.get(summary.ingredientId) ?? [];
        const largestInput = [...inputs].sort((a, b) => Number(b.actualQty) - Number(a.actualQty))[0];
        const variance = Number(summary.varianceQty ?? 0);
        return {
          ingredient: summary.ingredientNameSnapshot,
          category: summary.categorySnapshot,
          unit: summary.unitSnapshot,
          system_stock_before: Number(summary.systemStockBefore),
          total_role_actual: summary.totalRoleActual ? Number(summary.totalRoleActual) : "",
          final_actual: summary.finalActual ? Number(summary.finalActual) : "",
          variance_qty: variance,
          variance_percent: summary.variancePercent ? Number(summary.variancePercent) : "",
          estimated_variance_value: summary.estimatedVarianceValue,
          role_inputs_breakdown: inputs.map((input) => `${input.role}:${input.actualQty}`).join(", "),
          input_mode: inputs.length > 1 ? "multi-role" : "single-role",
          largest_role_input: largestInput ? `${largestInput.role} ${largestInput.actualQty}` : "",
          recommendation: Math.abs(variance) > 0 ? "Review pemakaian dan pencatatan area terkait" : "Tidak ada selisih material",
        };
      });
      sheet.columns = Object.keys(rows[0] ?? { ingredient: "" }).map((key) => ({ header: key, key, width: 24 }));
      sheet.addRows(rows);
    }

    const output = await workbook.xlsx.writeBuffer();
    downloadBlob(
      new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `stokara-opname-${kind}-${dateInputKey(new Date(selectedSession.opnameDate))}.xlsx`,
    );
  }

  if (role === "Owner") {
    return (
      <div className="space-y-5">
        <Card className="bg-card/95">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Input Opname Owner</p>
              <p className="text-sm text-muted-foreground">
                Hari ini tanggal {clock.getDate()}. Owner bisa memilih barang, isi aktual, lalu simpan ke sesi opname.
              </p>
            </div>
            <Button disabled={!isInputDay || !opnameRows.length} onClick={() => void submitVisibleOpname()}>
              <Check />
              Simpan Input Owner
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card/95">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-muted-foreground">Pilih barang opname</p>
                <CardTitle className="mt-1 text-lg">Semua Kategori Owner</CardTitle>
              </div>
              <Badge variant="secondary">{opnameRows.length} item dipilih</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              {starterGroups.map((group) => (
                <div className="rounded-md border bg-muted/35 p-3" key={group.label}>
                  <p className="text-xs font-bold uppercase text-muted-foreground">{group.label}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{group.items.length} item</p>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <datalist id={pickerListId}>
                {inventory.map((item) => (
                  <option key={item.id} label={`${item.category} - ${item.stock} ${item.unit}`} value={item.name} />
                ))}
              </datalist>
              <Input
                autoComplete="off"
                list={pickerListId}
                onChange={(event) => setOpnamePickerQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addOpnameItem();
                  }
                }}
                placeholder="Ketik nama barang yang ingin diopname"
                value={opnamePickerQuery}
              />
              <Button disabled={!inventory.length} onClick={addOpnameItem} type="button" variant="outline">
                <Plus />
                Tambahkan
              </Button>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Bahan</th>
                    <th className="px-4 py-2 text-left">Kategori</th>
                    <th className="px-4 py-2 text-left">Stok Aplikasi</th>
                    <th className="px-4 py-2 text-left">Aktual Owner</th>
                    <th className="px-4 py-2 text-left">Estimasi Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {opnameRows.map(({ item, gap }) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-bold">{item.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                      <td className="px-4 py-3 font-mono">{item.stock} {item.unit}</td>
                      <td className="px-4 py-3">
                        <Input
                          disabled={!isInputDay}
                          min="0"
                          onChange={(event) => onActualChange(item.id, "Owner", event.target.value)}
                          placeholder={`0 ${item.unit}`}
                          step="0.001"
                          type="number"
                          value={actualInputs[item.id]?.Owner ?? ""}
                        />
                      </td>
                      <td className={cn("px-4 py-3 font-mono font-bold", gap > 0 ? "text-destructive" : "text-success")}>
                        {gap} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!opnameRows.length && <EmptyState message="Belum ada data bahan dari API." />}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/95">
          <CardHeader>
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Owner audit</p>
            <CardTitle className="mt-1">Riwayat & Detail Opname</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Select onChange={(event) => setSelectedSessionId(event.target.value)} value={selectedSessionId}>
                <option value="">Sesi terbaru</option>
                {auditData?.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {new Date(session.opnameDate).toLocaleDateString("id-ID")} - {session.status}
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void downloadOpnameWorkbook("audit")} size="sm" type="button" variant="outline">
                  <Download /> Data Audit
                </Button>
                <Button onClick={() => void downloadOpnameWorkbook("analysis")} size="sm" type="button" variant="outline">
                  <Download /> Analisis Product
                </Button>
              </div>
            </div>
            {selectedSession && (
              <div className="grid gap-3 sm:grid-cols-4">
                <SimpleMetric detail="sesi opname" icon={ClipboardCheck} title="Status" value={selectedSession.status} />
                <SimpleMetric detail="product" icon={Database} title="Item Audit" value={`${auditData?.summaries.length ?? 0}`} />
                <SimpleMetric detail="variance" icon={AlertTriangle} title="Item Selisih" value={`${auditData?.summaries.filter((item) => Number(item.varianceQty ?? 0) !== 0).length ?? 0}`} />
                <SimpleMetric detail="Owner" icon={ShieldCheck} title="Final oleh" value={selectedSession.finalizedByName ?? "-"} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card className="bg-card/95">
            <CardHeader>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Audit table</p>
              <CardTitle className="mt-1">Final Aktual Per Product</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">Input Role</th>
                      <th className="px-4 py-3 text-left">System</th>
                      <th className="px-4 py-3 text-left">Total Role</th>
                      <th className="px-4 py-3 text-left">Final Owner</th>
                      <th className="px-4 py-3 text-left">Variance</th>
                      <th className="px-4 py-3 text-left">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData?.summaries.map((summary) => {
                      const inputs = roleInputsByIngredient.get(summary.ingredientId) ?? [];
                      return (
                        <tr className="border-t align-top" key={summary.id}>
                          <td className="px-4 py-3 font-bold">
                            {summary.ingredientNameSnapshot}
                            <p className="mt-1 text-xs font-normal text-muted-foreground">{summary.categorySnapshot}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="grid gap-1">
                              {inputs.map((input) => (
                                <Badge key={input.id} variant={input.inputType === "primary" ? "default" : "secondary"}>
                                  {input.role}: {Number(input.actualQty)} {summary.unitSnapshot}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono">{Number(summary.systemStockBefore)} {summary.unitSnapshot}</td>
                          <td className="px-4 py-3 font-mono">{summary.totalRoleActual ? Number(summary.totalRoleActual) : "-"} {summary.unitSnapshot}</td>
                          <td className="px-4 py-3">
                            <Input
                              disabled={selectedSession?.status === "finalized"}
                              min="0"
                              onChange={(event) =>
                                setFinalInputs((current) => ({
                                  ...current,
                                  [summary.ingredientId]: { ...current[summary.ingredientId], finalActual: event.target.value },
                                }))
                              }
                              type="number"
                              value={finalInputs[summary.ingredientId]?.finalActual ?? ""}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-destructive">{summary.varianceQty ? Number(summary.varianceQty) : "-"}</td>
                          <td className="px-4 py-3">
                            <Input
                              disabled={selectedSession?.status === "finalized"}
                              onChange={(event) =>
                                setFinalInputs((current) => ({
                                  ...current,
                                  [summary.ingredientId]: { ...current[summary.ingredientId], ownerFinalNote: event.target.value },
                                }))
                              }
                              placeholder="Catatan final"
                              value={finalInputs[summary.ingredientId]?.ownerFinalNote ?? ""}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!auditData?.summaries.length && <EmptyState message={auditLoading ? "Memuat audit opname..." : "Belum ada sesi opname hybrid."} />}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button disabled={!selectedSession || selectedSession.status === "finalized"} onClick={() => void saveOwnerFinals()} type="button">
                  <Save /> Simpan Final Aktual
                </Button>
                <Button disabled={!selectedSession || selectedSession.status === "finalized"} onClick={() => void finalizeOpname()} type="button" variant="outline">
                  <ShieldCheck /> Finalisasi Opname
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
        {auditMessage && <p className="rounded-md border bg-card p-3 text-xs font-semibold text-muted-foreground">{auditMessage}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="bg-card/95">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Opname Dilakukan Tanggal 30</p>
            <p className="text-sm text-muted-foreground">
              Hari ini tanggal {clock.getDate()}. {role} hanya menginput barang yang dipilih untuk dicek fisik.
            </p>
          </div>
          <Button disabled={!isInputDay || !opnameRows.length} onClick={() => void submitVisibleOpname()}>
            <Check />
            Simpan Data Aktual
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card/95">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Pilih barang opname</p>
              <CardTitle className="mt-1 text-lg">Daftar Ringan Per Role</CardTitle>
            </div>
            <Badge variant="secondary">{opnameRows.length} item dipilih</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {starterGroups.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {starterGroups.map((group) => (
                <button
                  className={cn(
                    "rounded-md border bg-muted/35 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5",
                    selectedOpnameCategory === group.label && "border-primary bg-primary/10 text-primary",
                  )}
                  key={group.label}
                  onClick={() => {
                    setSelectedOpnameCategory(group.label);
                    setAuditMessage("");
                  }}
                  type="button"
                >
                  <p className="text-xs font-bold uppercase text-muted-foreground">{group.label}</p>
                  <p className="mt-2 text-sm font-semibold">{group.items.length} product</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
              Tabel awal kosong. Tambahkan barang yang memang dicek fisik oleh {role}.
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <datalist id={pickerListId}>
              {inventory.map((item) => (
                <option key={item.id} label={`${item.category} - ${item.stock} ${item.unit}`} value={item.name} />
              ))}
            </datalist>
            <Input
              autoComplete="off"
              list={pickerListId}
              onChange={(event) => setOpnamePickerQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addOpnameItem();
                }
              }}
              placeholder="Ketik nama barang yang ingin diopname"
              value={opnamePickerQuery}
            />
              <Button disabled={!inventory.length} onClick={addOpnameItem} type="button" variant="outline">
                <Plus />
                Tambahkan
              </Button>
            </div>
          {!selectedOpnameCategory && !extraOpnameIds.length && (
            <p className="rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
              Pilih satu kategori dulu untuk menampilkan product opname.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Stock opname</p>
          <CardTitle className="mt-1">Kolom Aktual Lapangan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:hidden">
            {opnameRows.map(({ item, gap }) => {
              return (
                <div key={item.id} className="rounded-md border bg-muted/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{item.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{item.stock} {item.unit} sistem</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getOpnameAssignments(item).map((assignment) => `${assignment.role} (${assignment.inputType})`).join(", ")}
                      </p>
                    </div>
                    <div className="grid justify-items-end gap-2">
                      <Badge variant={gap > 0 ? "destructive" : "success"}>{gap} {item.unit}</Badge>
                      {!starterOpnameIds.includes(item.id) && (
                        <Button aria-label={`Hapus ${item.name} dari opname`} className="size-7" onClick={() => removeOpnameItem(item.id)} size="icon" type="button" variant="ghost">
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {inputRoles.map((inputRole) => (
                      <label key={inputRole} className="grid gap-2 text-sm font-semibold">
                        Aktual {inputRole}
                        <Input
                          disabled={!isInputDay || role !== inputRole}
                          min="0"
                          onChange={(event) => onActualChange(item.id, inputRole, event.target.value)}
                          placeholder={`0 ${item.unit}`}
                          step="0.001"
                          type="number"
                          value={actualInputs[item.id]?.[inputRole] ?? ""}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {!opnameRows.length && <EmptyState message="Belum ada data bahan dari API." />}
          </div>
          <div className="hidden overflow-x-auto rounded-md border lg:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <AutoFilterHeader label="Bahan" kind="text" onChange={(value) => setOpnameSortColumn("name", value)} value={opnameSort.column === "name" ? opnameSort.direction : ""} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <AutoFilterHeader label="Stok Aplikasi" kind="number" onChange={(value) => setOpnameSortColumn("systemStock", value)} value={opnameSort.column === "systemStock" ? opnameSort.direction : ""} />
                  </th>
                  {inputRoles.map((inputRole) => (
                    <th className="px-4 py-2 text-left" key={`${inputRole}-filter`}>
                      <AutoFilterHeader label={`Aktual ${inputRole}`} kind="number" onChange={(value) => setOpnameSortColumn(inputRole, value)} value={opnameSort.column === inputRole ? opnameSort.direction : ""} />
                    </th>
                  ))}
                  <th className="px-4 py-2 text-left">
                    <AutoFilterHeader label="Estimasi Selisih" kind="number" onChange={(value) => setOpnameSortColumn("variance", value)} value={opnameSort.column === "variance" ? opnameSort.direction : ""} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {opnameRows.map(({ item, gap }) => {
                  return (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold">{item.name}</span>
                          {!starterOpnameIds.includes(item.id) && (
                            <Button aria-label={`Hapus ${item.name} dari opname`} className="size-7" onClick={() => removeOpnameItem(item.id)} size="icon" type="button" variant="ghost">
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">{item.stock} {item.unit}</td>
                      {inputRoles.map((inputRole) => (
                        <td key={inputRole} className="px-4 py-3">
                          <Input
                            disabled={!isInputDay || role !== inputRole}
                            min="0"
                            onChange={(event) => onActualChange(item.id, inputRole, event.target.value)}
                            placeholder={`0 ${item.unit}`}
                            step="0.001"
                            type="number"
                            value={actualInputs[item.id]?.[inputRole] ?? ""}
                          />
                        </td>
                      ))}
                      <td className={cn("px-4 py-3 font-mono font-bold", gap > 0 ? "text-destructive" : "text-success")}>
                        {gap} {item.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!opnameRows.length && <EmptyState message="Belum ada data bahan dari API." />}
          </div>
        </CardContent>
      </Card>
      {auditMessage && <p className="rounded-md border bg-card p-3 text-xs font-semibold text-muted-foreground">{auditMessage}</p>}
    </div>
  );
}

function StockCorrectionPage({ inventory, onSaved }: { inventory: Ingredient[]; onSaved: () => Promise<void> }) {
  type CorrectionRow = { key: string; ingredientId: string; query: string; actualStock: string; reason: string };
  const emptyCorrectionRow = (suffix: string): CorrectionRow => ({
    actualStock: "",
    ingredientId: "",
    key: `correction-${suffix}`,
    query: "",
    reason: "",
  });
  const [rows, setRows] = useState<CorrectionRow[]>(() => [emptyCorrectionRow("1")]);
  const [message, setMessage] = useState("");
  const [ledger, setLedger] = useState<StockLedgerRow[]>([]);
  const ingredientById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const ingredientByName = useMemo(() => new Map(inventory.map((item) => [item.name.toLowerCase(), item])), [inventory]);
  const listId = "correction-product-list";

  const loadLedger = useCallback(async () => {
    try {
      const rows = await apiJson<StockLedgerRow[]>("/api/stock-corrections");
      setLedger(rows);
    } catch {
      setLedger([]);
    }
  }, []);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  function updateRow(key: string, patch: Partial<CorrectionRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function selectRowProduct(key: string, query: string) {
    const ingredient = ingredientByName.get(query.trim().toLowerCase());
    updateRow(key, {
      actualStock: ingredient ? String(ingredient.stock) : "",
      ingredientId: ingredient?.id ?? "",
      query,
    });
  }

  function addRow() {
    setRows((current) => current.length >= 5 ? current : [...current, emptyCorrectionRow(`${Date.now()}-${current.length + 1}`)]);
  }

  function removeRow(key: string) {
    setRows((current) => current.length === 1 ? [emptyCorrectionRow("1")] : current.filter((row) => row.key !== key));
  }

  async function saveCorrection() {
    setMessage("");
    try {
      const payloadRows = rows
        .map((row) => ({
          actualStock: Number(row.actualStock),
          ingredientId: row.ingredientId,
          reason: row.reason.trim(),
        }))
        .filter((row) => row.ingredientId || Number.isFinite(row.actualStock) || row.reason);
      if (!payloadRows.length) throw new Error("Minimal 1 product wajib diisi");
      if (payloadRows.some((row) => !row.ingredientId || !Number.isFinite(row.actualStock) || row.actualStock < 0 || row.reason.length < 3)) {
        throw new Error("Setiap baris wajib memilih product, stock aktual valid, dan alasan minimal 3 karakter");
      }
      await apiJson("/api/stock-corrections", {
        method: "POST",
        body: JSON.stringify({ rows: payloadRows }),
      });
      setRows([emptyCorrectionRow(`${Date.now()}`)]);
      await Promise.all([onSaved(), loadLedger()]);
      setMessage(`${payloadRows.length} koreksi stok tersimpan dan ledger diperbarui.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Koreksi stok gagal disimpan");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Owner stock correction</p>
          <CardTitle className="mt-1">Koreksi Stock Owner</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <datalist id={listId}>
            {inventory.map((item) => (
              <option key={item.id} label={`${item.stock} ${item.unit} sistem`} value={item.name} />
            ))}
          </datalist>
          <div className="grid max-h-[62vh] gap-3 overflow-y-auto pr-1">
            {rows.map((row, index) => {
              const selectedIngredient = ingredientById.get(row.ingredientId) ?? null;
              const delta = selectedIngredient && row.actualStock ? Number(row.actualStock) - selectedIngredient.stock : 0;
              return (
                <div className="rounded-md border bg-muted/35 p-3" key={row.key}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge variant={selectedIngredient ? "success" : "secondary"}>Koreksi {index + 1}/5</Badge>
                    <Button aria-label="Hapus koreksi" className="size-8" onClick={() => removeRow(row.key)} size="icon" type="button" variant="outline">
                      <Trash2 />
                    </Button>
                  </div>
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Product
                    <Input
                      autoComplete="off"
                      list={listId}
                      onChange={(event) => selectRowProduct(row.key, event.target.value)}
                      placeholder="Ketik nama product"
                      value={row.query}
                    />
                  </label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border bg-card p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Stock sistem</p>
                      <p className="mt-2 font-mono text-lg font-medium">{selectedIngredient ? `${selectedIngredient.stock} ${selectedIngredient.unit}` : "-"}</p>
                    </div>
                    <label className="grid gap-2 text-sm font-semibold">
                      Stock aktual
                      <Input min="0.001" onChange={(event) => updateRow(row.key, { actualStock: event.target.value })} placeholder="0.001" step="0.001" type="number" value={row.actualStock} />
                    </label>
                    <div className="rounded-md border bg-card p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Selisih</p>
                      <p className={cn("mt-2 font-mono text-lg font-medium", delta < 0 ? "text-destructive" : "text-success")}>
                        {selectedIngredient && row.actualStock ? `${delta.toFixed(3)} ${selectedIngredient.unit}` : "-"}
                      </p>
                    </div>
                  </div>
                  <label className="mt-3 grid gap-2 text-sm font-semibold">
                    Alasan koreksi
                    <Input onChange={(event) => updateRow(row.key, { reason: event.target.value })} placeholder="Contoh: bahan rusak / salah input / stok fisik dicek Owner" value={row.reason} />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button disabled={rows.length >= 5} onClick={addRow} type="button" variant="outline">
              <Plus />
              Tambah Koreksi
            </Button>
          <Button onClick={() => void saveCorrection()} type="button">
            <Save />
            Simpan Koreksi
          </Button>
          </div>
          {message && <p className="rounded-md border bg-card p-3 text-xs font-semibold text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Stock ledger</p>
          <CardTitle className="mt-1">Riwayat Perubahan Stok</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Before</th>
                  <th className="px-4 py-3 text-left">After</th>
                  <th className="px-4 py-3 text-left">Alasan</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((item) => (
                  <tr className="border-t" key={item.id}>
                    <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 font-bold">{item.ingredientName}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{item.source}</Badge></td>
                    <td className="px-4 py-3 font-mono">{Number(item.stockBefore)} {item.ingredientUnit}</td>
                    <td className="px-4 py-3 font-mono">{Number(item.stockAfter)} {item.ingredientUnit}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ledger.length && <EmptyState message="Belum ada ledger koreksi stok." />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AiPage({ inventory, transactions }: { inventory: Ingredient[]; transactions: TransactionRow[] }) {
  const [summary, setSummary] = useState<AiSummaryLite | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadSummary() {
      setLoadingSummary(true);
      setSummaryError("");
      try {
        const nextSummary = await apiJson<AiSummaryLite>("/api/ai/summary");
        if (!ignore) setSummary(nextSummary);
      } catch (error) {
        if (!ignore) setSummaryError(error instanceof Error ? error.message : "AI operasional gagal dimuat.");
      } finally {
        if (!ignore) setLoadingSummary(false);
      }
    }
    void loadSummary();
    return () => {
      ignore = true;
    };
  }, []);

  const aiFallback = useMemo(() => {
    const ingredientById = new Map(inventory.map((item) => [item.id, item]));
    const sevenDaysAgo = addDays(new Date(), -6).getTime();
    const usageByIngredient = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== "keluar") continue;
      const time = transactionChartDate(transaction).getTime();
      if (time < sevenDaysAgo) continue;
      usageByIngredient.set(transaction.ingredientId, (usageByIngredient.get(transaction.ingredientId) ?? 0) + Number(transaction.quantity));
    }

    const projections = inventory
      .map((item) => {
        const weeklyUsage = usageByIngredient.get(item.id) ?? Math.max(0, item.minimum * 0.5);
        const endingStock = item.stock - weeklyUsage;
        const dailyUsage = weeklyUsage / 7;
        return {
          id: `fallback-projection-${item.id}`,
          ingredientName: item.name,
          ingredientUnit: item.unit,
          currentStock: String(item.stock),
          predictedWeeklyUsage: String(weeklyUsage),
          predictedEndingStock: String(endingStock),
          stockCoverDays: String(dailyUsage > 0 ? item.stock / dailyUsage : 99),
          weekEnd: dateInputKey(addDays(new Date(), 6)),
          weekStart: dateInputKey(new Date()),
        };
      })
      .sort((left, right) => Number(left.stockCoverDays) - Number(right.stockCoverDays))
      .slice(0, 12);

    const recommendations = projections
      .filter((item) => Number(item.predictedEndingStock) <= Number(ingredientById.get(item.id.replace("fallback-projection-", ""))?.minimum ?? 0) || Number(item.stockCoverDays) <= 7)
      .slice(0, 8)
      .map((item) => {
        const ingredient = inventory.find((candidate) => candidate.name === item.ingredientName);
        const recommendedQuantity = Math.max(ingredient?.minimum ?? 0, Number(item.predictedWeeklyUsage));
        const stockCoverDays = Number(item.stockCoverDays);
        const action: AiRecommendationRow["action"] = stockCoverDays <= 3 ? "beli-sekarang" : stockCoverDays <= 7 ? "beli-bertahap" : "tunda-beli";
        return {
          id: `fallback-recommendation-${ingredient?.id ?? item.id}`,
          action,
          explanation:
            action === "beli-sekarang"
              ? "Stok cover sangat pendek berdasarkan pemakaian 7 hari terakhir. Prioritaskan pembelian agar operasional tidak berhenti."
              : action === "beli-bertahap"
                ? "Stok masih cukup pendek. Pembelian bertahap menjaga cashflow sambil mengurangi risiko stockout."
                : "Stok relatif aman, pembelian bisa ditunda sambil tetap dipantau.",
          ingredientName: item.ingredientName,
          ingredientUnit: item.ingredientUnit,
          priorityScore: Math.max(1, Math.round(100 - stockCoverDays * 8)),
          recommendedQuantity: String(recommendedQuantity),
        };
      });

    return { projections, recommendations };
  }, [inventory, transactions]);

  const recommendations = summary?.recommendations.length ? summary.recommendations : aiFallback.recommendations;
  const projections = summary?.projections.length ? summary.projections : aiFallback.projections;

  return (
    <div className="space-y-5">
      <Card className="border-primary/25 bg-primary/10">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 size-5 text-primary" />
            <div>
              <p className="font-semibold">AI operasional internal</p>
              <p className="text-sm text-muted-foreground">
                Fokus AI: rekomendasi waktu beli terbaik dan proyeksi kebutuhan stok mingguan dari data internal.
              </p>
            </div>
          </div>
          <Badge variant="outline">{summary?.asOf ?? "internal"}</Badge>
        </CardContent>
      </Card>

      {loadingSummary && (
        <Card className="bg-card/95">
          <CardContent className="flex items-center gap-3 p-5 text-sm font-semibold text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Membaca rekomendasi AI internal...
          </CardContent>
        </Card>
      )}
      {summaryError && <p className="rounded-md border bg-muted/35 p-3 text-sm font-semibold text-muted-foreground">{summaryError}</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="bg-card/95">
          <CardHeader>
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Best buy timing</p>
            <CardTitle className="mt-1">Rekomendasi Waktu Beli Terbaik</CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length ? (
              <div className="grid gap-3">
                {recommendations.map((item) => (
                  <div className="rounded-md border bg-muted/35 p-4" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{item.ingredientName}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {Number(item.recommendedQuantity)} {item.ingredientUnit}
                        </p>
                      </div>
                      <Badge variant={item.action === "beli-sekarang" ? "destructive" : item.action === "beli-bertahap" ? "warning" : "secondary"}>
                        {item.action.replaceAll("-", " ")}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.explanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Belum ada rekomendasi waktu beli dari AI internal." />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/95">
          <CardHeader>
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Weekly projection</p>
            <CardTitle className="mt-1">Proyeksi Kebutuhan Stok Mingguan</CardTitle>
          </CardHeader>
          <CardContent>
            {projections.length ? (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Bahan</th>
                      <th className="px-4 py-3 text-left">Stok Sekarang</th>
                      <th className="px-4 py-3 text-left">Prediksi Pakai</th>
                      <th className="px-4 py-3 text-left">Sisa Akhir Minggu</th>
                      <th className="px-4 py-3 text-left">Cover Hari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map((item) => (
                      <tr className="border-t" key={item.id}>
                        <td className="px-4 py-3 font-bold">{item.ingredientName}</td>
                        <td className="px-4 py-3 font-mono">{Number(item.currentStock)} {item.ingredientUnit}</td>
                        <td className="px-4 py-3 font-mono">{Number(item.predictedWeeklyUsage).toFixed(1)} {item.ingredientUnit}</td>
                        <td className="px-4 py-3 font-mono">{Number(item.predictedEndingStock).toFixed(1)} {item.ingredientUnit}</td>
                        <td className="px-4 py-3 font-mono">{Number(item.stockCoverDays).toFixed(1)} hari</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="Belum ada proyeksi kebutuhan stok mingguan." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

const reportMonthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

type ReportPeriod = {
  end: Date;
  label: string;
  month: number;
  start: Date;
  year: number;
};

type FinancialReportData = {
  bomIngredientRows: Array<Record<string, string | number>>;
  bomRows: Array<Record<string, string | number>>;
  correctionMinus: number;
  correctionPlus: number;
  correctionRows: Array<Record<string, string | number>>;
  currentValue: number;
  endingValueEstimate: number;
  initialValueEstimate: number;
  purchaseByCategory: Array<{ category: string; value: number }>;
  purchaseRows: Array<Record<string, string | number>>;
  purchaseTotal: number;
  usageByCategory: Array<{ category: string; value: number }>;
  usageRows: Array<Record<string, string | number>>;
  usageTotal: number;
};

function reportPeriodFromSelection(year: number, month: number): ReportPeriod {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { end, label: `${reportMonthNames[month]} ${year}`, month, start, year };
}

function isDateInPeriod(date: Date, period: ReportPeriod) {
  const time = date.getTime();
  return !Number.isNaN(time) && time >= period.start.getTime() && time <= period.end.getTime();
}

function buildFinancialReportData(
  inventory: Ingredient[],
  transactions: TransactionRow[],
  stockLedger: StockLedgerRow[],
  bomHistory: BomProductionHistoryRow[],
  period: ReportPeriod,
): FinancialReportData {
  const ingredientById = new Map(inventory.map((item) => [item.id, item]));
  const currentValue = inventory.reduce((sum, item) => sum + item.stock * item.price, 0);
  const periodTransactions = transactions.filter((item) => isDateInPeriod(transactionChartDate(item), period));
  const periodCorrections = stockLedger.filter((item) =>
    ["owner_stock_correction", "monthly_opname_final"].includes(item.source) && isDateInPeriod(new Date(item.createdAt), period),
  );
  const periodBomHistory = bomHistory.filter((item) => isDateInPeriod(new Date(item.productionDate), period));

  const purchaseByIngredient = new Map<string, { ingredient: Ingredient | undefined; quantity: number; total: number }>();
  const usageByIngredient = new Map<string, { ingredient: Ingredient | undefined; quantity: number; total: number }>();

  for (const transaction of periodTransactions) {
    const ingredient = ingredientById.get(transaction.ingredientId);
    const total =
      Number(transaction.quantity) *
      (transaction.type === "masuk" ? transaction.unitPrice ?? ingredient?.price ?? 0 : ingredient?.price ?? 0);
    const target = transaction.type === "masuk" ? purchaseByIngredient : usageByIngredient;
    const current = target.get(transaction.ingredientId) ?? { ingredient, quantity: 0, total: 0 };
    current.quantity += Number(transaction.quantity);
    current.total += total;
    target.set(transaction.ingredientId, current);
  }

  const correctionRows = periodCorrections.map((item) => {
    const ingredient = ingredientById.get(item.ingredientId);
    const delta = Number(item.delta);
    const nominal = Math.abs(delta) * (ingredient?.price ?? 0);
    return {
      tanggal: new Date(item.createdAt).toLocaleString("id-ID"),
      tipe: delta >= 0 ? "Plus" : "Minus",
      sumber: item.source === "monthly_opname_final" ? "Opname" : "Koreksi Owner / Settings",
      bahan: item.ingredientName,
      selisih_qty: Math.abs(delta),
      unit: item.ingredientUnit,
      harga: ingredient?.price ?? 0,
      nominal,
      operator: item.operatorName,
      alasan: item.reason ?? "",
    };
  });

  const correctionPlus = correctionRows
    .filter((item) => item.tipe === "Plus")
    .reduce((sum, item) => sum + Number(item.nominal), 0);
  const correctionMinus = correctionRows
    .filter((item) => item.tipe === "Minus")
    .reduce((sum, item) => sum + Number(item.nominal), 0);

  const purchaseRows = Array.from(purchaseByIngredient.values()).map(({ ingredient, quantity, total }) => ({
    bahan: ingredient?.name ?? "-",
    kategori: ingredient?.category ?? "-",
    qty: quantity,
    unit: ingredient?.unit ?? "",
    harga_rata_rata: quantity > 0 ? Math.round(total / quantity) : ingredient?.price ?? 0,
    total,
  }));
  const usageRows = Array.from(usageByIngredient.values()).map(({ ingredient, quantity, total }) => ({
    bahan: ingredient?.name ?? "-",
    kategori: ingredient?.category ?? "-",
    qty_keluar: quantity,
    unit: ingredient?.unit ?? "",
    harga_rata_rata: ingredient?.price ?? 0,
    total,
  }));

  const purchaseTotal = purchaseRows.reduce((sum, item) => sum + Number(item.total), 0);
  const usageTotal = usageRows.reduce((sum, item) => sum + Number(item.total), 0);
  const purchaseByCategory = allCategories.map((category) => ({
    category,
    value: purchaseRows.filter((item) => item.kategori === category).reduce((sum, item) => sum + Number(item.total), 0),
  }));
  const usageByCategory = allCategories.map((category) => ({
    category,
    value: usageRows.filter((item) => item.kategori === category).reduce((sum, item) => sum + Number(item.total), 0),
  }));

  const bomRows = periodBomHistory.map((item) => ({
    tanggal: new Date(item.productionDate).toLocaleString("id-ID"),
    bom: item.bomName,
    jumlah_produksi: item.productionCount,
    hasil_aktual: item.producedQuantity,
    unit: item.yieldUnit,
    biaya_total: item.totalCost,
    operator: item.operatorName,
    catatan: item.note ?? "",
  }));
  const bomIngredientRows = periodBomHistory.flatMap((item) =>
    item.items.map((bomItem) => ({
      tanggal: new Date(item.productionDate).toLocaleString("id-ID"),
      bom: item.bomName,
      bahan: bomItem.ingredientName,
      qty_terpakai: bomItem.consumedQuantity,
      unit: bomItem.ingredientUnit,
      harga: bomItem.unitCost,
      total: bomItem.totalCost,
    })),
  );

  const initialValueEstimate = currentValue - purchaseTotal + usageTotal - correctionPlus + correctionMinus;
  const endingValueEstimate = initialValueEstimate + purchaseTotal - usageTotal + correctionPlus - correctionMinus;

  return {
    bomIngredientRows,
    bomRows,
    correctionMinus,
    correctionPlus,
    correctionRows,
    currentValue,
    endingValueEstimate,
    initialValueEstimate,
    purchaseByCategory,
    purchaseRows,
    purchaseTotal,
    usageByCategory,
    usageRows,
    usageTotal,
  };
}

async function downloadReportAnalyticsPdf(
  inventory: Ingredient[],
  transactions: TransactionRow[],
  stockLedger: StockLedgerRow[],
  bomHistory: BomProductionHistoryRow[],
  period: ReportPeriod,
) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ format: "a4", orientation: "portrait", unit: "mm" });
  const report = buildFinancialReportData(inventory, transactions, stockLedger, bomHistory, period);
  const totalValue = inventory.reduce((sum, item) => sum + item.stock * item.price, 0);
  const critical = inventory.filter((item) => item.stock <= item.minimum).length;
  const periodTransactions = transactions.filter((item) => isDateInPeriod(transactionChartDate(item), period));
  const masuk = periodTransactions.filter((item) => item.type === "masuk").length;
  const keluar = periodTransactions.filter((item) => item.type === "keluar").length;
  const ingredientById = new Map(inventory.map((item) => [item.id, item]));
  const byCategory = allCategories.map((category) => ({
    category,
    value: inventory.filter((item) => item.category === category).reduce((sum, item) => sum + item.stock * item.price, 0),
  }));
  const days = buildDashboardRangeDays(period.start, period.end);
  const flowMasuk = new Map(days.map((day) => [day.key, 0]));
  const flowKeluar = new Map(days.map((day) => [day.key, 0]));

  for (const transaction of periodTransactions) {
    const key = dateInputKey(new Date(transaction.transactionDate));
    if (!flowMasuk.has(key)) continue;
    const ingredient = ingredientById.get(transaction.ingredientId);
    const nominal =
      Number(transaction.quantity) *
      (transaction.type === "masuk" ? transaction.unitPrice ?? ingredient?.price ?? 0 : ingredient?.price ?? 0);
    const target = transaction.type === "masuk" ? flowMasuk : flowKeluar;
    target.set(key, (target.get(key) ?? 0) + nominal);
  }

  const stockImpact = new Map(days.map((day) => [day.key, 0]));
  for (const transaction of periodTransactions) {
    const key = dateInputKey(new Date(transaction.transactionDate));
    if (!stockImpact.has(key)) continue;
    const ingredient = ingredientById.get(transaction.ingredientId);
    const nominal =
      Number(transaction.quantity) *
      (transaction.type === "masuk" ? transaction.unitPrice ?? ingredient?.price ?? 0 : ingredient?.price ?? 0);
    stockImpact.set(key, (stockImpact.get(key) ?? 0) + (transaction.type === "masuk" ? nominal : -nominal));
  }
  const totalImpact = Array.from(stockImpact.values()).reduce((sum, value) => sum + value, 0);
  let runningStockValue = Math.max(0, totalValue - totalImpact);
  const stockSeries = days.map((day) => {
    runningStockValue = Math.max(0, runningStockValue + (stockImpact.get(day.key) ?? 0));
    return runningStockValue;
  });
  const masukSeries = days.map((day) => flowMasuk.get(day.key) ?? 0);
  const keluarSeries = days.map((day) => flowKeluar.get(day.key) ?? 0);
  const topCritical = inventory
    .filter((item) => item.stock <= item.minimum)
    .sort((a, b) => stockStatus(a).ratio - stockStatus(b).ratio)
    .slice(0, 10);
  const topInventoryValue = [...inventory].sort((a, b) => b.stock * b.price - a.stock * a.price).slice(0, 10);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  function setHeading(text: string, y: number) {
    doc.setTextColor("#1A1612");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(text, 14, y);
  }

  function drawKpiCard(label: string, value: string, x: number, y: number, w: number) {
    doc.setDrawColor("#D9CEC0");
    doc.setFillColor("#FAF7F2");
    doc.roundedRect(x, y, w, 24, 2, 2, "FD");
    doc.setTextColor("#6B5A47");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 4, y + 7);
    doc.setTextColor("#1A1612");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(value, x + 4, y + 17);
  }

  function drawLineChart(
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
    series: Array<{ label: string; values: number[]; color: string }>,
    valueFormatter: (value: number) => string,
  ) {
    const allValues = series.flatMap((item) => item.values);
    const max = Math.max(1, ...allValues);
    const left = x + 19;
    const right = x + w - 6;
    const top = y + 15;
    const bottom = y + h - 16;

    doc.setDrawColor("#D9CEC0");
    doc.setFillColor("#FAF7F2");
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
    doc.setTextColor("#1A1612");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title, x + 5, y + 8);

    [0, 0.5, 1].forEach((ratio) => {
      const tick = max * ratio;
      const tickY = bottom - ratio * (bottom - top);
      doc.setDrawColor("#E5DDD2");
      doc.line(left, tickY, right, tickY);
      doc.setTextColor("#6B5A47");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.text(valueFormatter(tick), x + 4, tickY + 1.8);
    });

    series.forEach((item) => {
      const points = item.values.map((value, index) => ({
        x: left + (index / Math.max(item.values.length - 1, 1)) * (right - left),
        y: bottom - (value / max) * (bottom - top),
      }));
      doc.setDrawColor(item.color);
      doc.setFillColor(item.color);
      doc.setLineWidth(0.7);
      points.forEach((point, index) => {
        if (index === 0) return;
        const previous = points[index - 1];
        doc.line(previous.x, previous.y, point.x, point.y);
      });
      points.forEach((point) => doc.circle(point.x, point.y, 0.9, "F"));
    });

    const labelIndexes = [0, Math.floor(days.length / 2), days.length - 1];
    doc.setTextColor("#6B5A47");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    labelIndexes.forEach((index) => {
      const day = days[index];
      if (!day) return;
      const labelX = left + (index / Math.max(days.length - 1, 1)) * (right - left);
      doc.text(day.label, labelX, y + h - 5, { align: "center" });
    });
  }

  doc.setFillColor("#FAF7F2");
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setTextColor("#B8962E");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SOTO SEGER JOYOBOYO / STOKARA", 14, 17);
  doc.setTextColor("#1A1612");
  doc.setFontSize(20);
  doc.text("Laporan Analitik Inventory", 14, 28);
  doc.setTextColor("#6B5A47");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Periode: ${period.label} / Dibuat: ${new Date().toLocaleString("id-ID")}`, 14, 36);

  drawKpiCard("Total nilai stok", formatRupiah(totalValue), 14, 47, 55);
  drawKpiCard("Bahan kritis", `${critical} item`, 75, 47, 38);
  drawKpiCard("Transaksi masuk", `${masuk} row`, 119, 47, 38);
  drawKpiCard("Transaksi keluar", `${keluar} row`, 163, 47, 33);

  drawLineChart("Trend Nilai Stok 14 Hari", 14, 82, 182, 70, [{ label: "Nilai stok", values: stockSeries, color: "#B8962E" }], formatCompactRupiah);
  drawLineChart(
    "Cash Flow Stok Masuk vs Keluar",
    14,
    160,
    182,
    70,
    [
      { label: "Masuk", values: masukSeries, color: "#3D6B4F" },
      { label: "Keluar", values: keluarSeries, color: "#B8962E" },
    ],
    formatCompactRupiah,
  );

  autoTable(doc, {
    head: [["No", "Komponen", "Nominal"]],
    body: [
      [1, "Nilai Stok Awal", formatRupiah(report.initialValueEstimate)],
      [2, "Total Stock Masuk / Pembelian", formatRupiah(report.purchaseTotal)],
      [3, "Total Stock Keluar / Pemakaian", formatRupiah(report.usageTotal)],
      [4, "Koreksi Stock Plus", formatRupiah(report.correctionPlus)],
      [5, "Koreksi Stock Minus", formatRupiah(report.correctionMinus)],
      [6, "Selisih Bersih Koreksi", formatRupiah(report.correctionPlus - report.correctionMinus)],
      [7, "Nilai Stok Akhir", formatRupiah(report.endingValueEstimate)],
    ],
    margin: { left: 14, right: 14 },
    startY: 238,
    styles: { fontSize: 7.5, cellPadding: 2, textColor: "#1A1612" },
    headStyles: { fillColor: "#1A1612", textColor: "#FAF7F2" },
    alternateRowStyles: { fillColor: "#FAF7F2" },
  });

  setHeading("Nilai stok per kategori", 246);
  const maxCategoryValue = Math.max(1, ...byCategory.map((item) => item.value));
  byCategory.forEach((item, index) => {
    const y = 256 + index * 9;
    const barWidth = Math.max(4, (item.value / maxCategoryValue) * 88);
    doc.setTextColor("#6B5A47");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(item.category, 14, y + 3);
    doc.setFillColor("#F0EBE3");
    doc.rect(88, y, 92, 4, "F");
    doc.setFillColor("#B8962E");
    doc.rect(88, y, barWidth, 4, "F");
    doc.text(formatCompactRupiah(item.value), 183, y + 3);
  });

  doc.addPage();
  doc.setFillColor("#FAF7F2");
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  setHeading("Detail Pembelian dan Pemakaian", 16);
  autoTable(doc, {
    head: [["Bahan", "Kategori", "Qty", "Harga Rata-rata", "Total"]],
    body: [
      ...report.purchaseRows.map((item) => [
        item.bahan,
        item.kategori,
        `${item.qty} ${item.unit}`,
        formatRupiah(Number(item.harga_rata_rata)),
        formatRupiah(Number(item.total)),
      ]),
      ["Total Pembelian", "", "", "", formatRupiah(report.purchaseTotal)],
    ],
    margin: { left: 14, right: 14 },
    startY: 24,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: "#1A1612" },
    headStyles: { fillColor: "#1A1612", textColor: "#FAF7F2" },
    alternateRowStyles: { fillColor: "#FAF7F2" },
  });
  autoTable(doc, {
    head: [["Bahan", "Kategori", "Qty Keluar", "Harga Rata-rata", "Total"]],
    body: [
      ...report.usageRows.map((item) => [
        item.bahan,
        item.kategori,
        `${item.qty_keluar} ${item.unit}`,
        formatRupiah(Number(item.harga_rata_rata)),
        formatRupiah(Number(item.total)),
      ]),
      ["Total Pemakaian", "", "", "", formatRupiah(report.usageTotal)],
    ],
    margin: { left: 14, right: 14 },
    startY: ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30) + 10,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: "#1A1612" },
    headStyles: { fillColor: "#B8962E", textColor: "#1A1612" },
    alternateRowStyles: { fillColor: "#FAF7F2" },
  });

  doc.addPage();
  doc.setFillColor("#FAF7F2");
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  setHeading("Detail Koreksi dan Produksi BOM", 16);
  autoTable(doc, {
    head: [["Tipe", "Sumber", "Bahan", "Selisih", "Harga", "Nominal", "Operator"]],
    body: [
      ...report.correctionRows.map((item) => [
        item.tipe,
        item.sumber,
        item.bahan,
        `${item.selisih_qty} ${item.unit}`,
        formatRupiah(Number(item.harga)),
        formatRupiah(Number(item.nominal)),
        item.operator,
      ]),
      ["Total Koreksi Plus", "", "", "", "", formatRupiah(report.correctionPlus), ""],
      ["Total Koreksi Minus", "", "", "", "", formatRupiah(report.correctionMinus), ""],
    ],
    margin: { left: 10, right: 10 },
    startY: 24,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", textColor: "#1A1612" },
    headStyles: { fillColor: "#1A1612", textColor: "#FAF7F2" },
    alternateRowStyles: { fillColor: "#FAF7F2" },
  });

  autoTable(doc, {
    head: [["Tanggal", "BOM", "Bahan", "Qty Terpakai", "Harga", "Total"]],
    body: report.bomIngredientRows.slice(0, 100).map((item) => [
      item.tanggal,
      item.bom,
      item.bahan,
      `${item.qty_terpakai} ${item.unit}`,
      formatRupiah(Number(item.harga)),
      formatRupiah(Number(item.total)),
    ]),
    margin: { left: 10, right: 10 },
    startY: ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30) + 10,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", textColor: "#1A1612" },
    headStyles: { fillColor: "#B8962E", textColor: "#1A1612" },
    alternateRowStyles: { fillColor: "#FAF7F2" },
  });

  doc.save(`stokara-analytics-${period.year}-${String(period.month + 1).padStart(2, "0")}.pdf`);
}

async function downloadReportExcel(
  inventory: Ingredient[],
  transactions: TransactionRow[],
  stockLedger: StockLedgerRow[],
  bomHistory: BomProductionHistoryRow[],
  period: ReportPeriod,
) {
  const ExcelJS = await import("exceljs");
  const report = buildFinancialReportData(inventory, transactions, stockLedger, bomHistory, period);
  const ingredientRows = inventory.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    stock: item.stock,
    minimum_stock: item.minimum,
    average_price: item.price,
    stock_value: item.stock * item.price,
  }));
  const ingredientById = new Map(inventory.map((item) => [item.id, item]));
  const periodTransactions = transactions.filter((item) => isDateInPeriod(transactionChartDate(item), period));
  const transactionRows = periodTransactions.map((item) => {
    const ingredient = ingredientById.get(item.ingredientId);
    return {
      id: item.id,
      transaction_date: item.transactionDate,
      input_at: item.createdAt ?? item.transactionDate,
      type: item.type,
      ingredient_id: item.ingredientId,
      ingredient_name: ingredient?.name ?? item.ingredientId,
      quantity: Number(item.quantity),
      unit: ingredient?.unit ?? "",
      unit_price: item.unitPrice ?? ingredient?.price ?? 0,
      operator_name: item.operatorName,
      note: item.note ?? "",
    };
  });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "STOKARA";
  workbook.created = new Date();

  function addRowsSheet(name: string, rows: Array<Record<string, string | number>>) {
    const sheet = workbook.addWorksheet(name);
    const sample = rows[0] ?? { kosong: "" };
    sheet.columns = Object.keys(sample).map((key) => ({ header: key, key, width: Math.max(14, key.length + 2) }));
    sheet.addRows(rows.length ? rows : [{ kosong: "Tidak ada data pada periode ini" }]);
    sheet.getRow(1).font = { bold: true };
    return sheet;
  }

  addRowsSheet("Ringkasan", [
    { komponen: "Periode", nominal: period.label },
    { komponen: "Nilai Stok Awal", nominal: report.initialValueEstimate },
    { komponen: "Ditambah Pembelian", nominal: report.purchaseTotal },
    { komponen: "Dikurangi Pemakaian", nominal: report.usageTotal },
    { komponen: "Ditambah Koreksi Plus", nominal: report.correctionPlus },
    { komponen: "Dikurangi Koreksi Minus", nominal: report.correctionMinus },
    { komponen: "Estimasi Nilai Stok Akhir", nominal: report.endingValueEstimate },
    { komponen: "Stock Saat Ini", nominal: report.currentValue },
  ]);
  addRowsSheet("Stock Masuk", transactionRows.filter((item) => item.type === "masuk"));
  addRowsSheet("Stock Keluar", transactionRows.filter((item) => item.type === "keluar"));
  addRowsSheet("Selisih Koreksi", report.correctionRows);
  addRowsSheet("Produksi BOM", report.bomRows);
  addRowsSheet("Ingredients BOM", report.bomIngredientRows);
  addRowsSheet("Ingredients Snapshot", ingredientRows);

  const output = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `stokara-laporan-${period.year}-${String(period.month + 1).padStart(2, "0")}.xlsx`,
  );
}

function ReportPage({
  financeTransactions,
  inventory,
  transactions,
  stockLedger,
  role,
}: {
  financeTransactions: FinanceTransactionRow[];
  inventory: Ingredient[];
  transactions: TransactionRow[];
  stockLedger: StockLedgerRow[];
  role: Role;
}) {
  const value = inventory.reduce((sum, item) => sum + item.stock * item.price, 0);
  const ingredientById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const [reportMessage, setReportMessage] = useState("");
  const [bomHistory, setBomHistory] = useState<BomProductionHistoryRow[]>([]);
  const [expandedBomHistoryId, setExpandedBomHistoryId] = useState<string | null>(null);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [transactionSort, setTransactionSort] = useState<AutoFilterState<"time" | "type" | "ingredient" | "quantity" | "operator">>({
    column: null,
    direction: "",
  });
  const [transactionRangePreset, setTransactionRangePreset] = useState<DashboardRangePreset>("all");
  const [transactionCustomStart, setTransactionCustomStart] = useState(dateInputKey(addDays(new Date(), -6)));
  const [transactionCustomEnd, setTransactionCustomEnd] = useState(dateInputKey(new Date()));
  const [bomSort, setBomSort] = useState<
    AutoFilterState<"time" | "bom" | "productionCount" | "producedQuantity" | "cost" | "operator" | "note">
  >({
    column: null,
    direction: "",
  });
  const filteredTransactions = useMemo(
    () => {
      const rangeDays = dashboardRangeFromPreset(transactionRangePreset, transactionCustomStart, transactionCustomEnd);
      const rangeStart = rangeDays[0]?.start.getTime() ?? 0;
      const rangeEnd = rangeDays.at(-1)?.end.getTime() ?? Date.now();
      const rows = transactions.filter((item) => {
        if (transactionRangePreset === "all") return true;
        const timestamp = transactionActivityDate(item).getTime();
        return timestamp >= rangeStart && timestamp <= rangeEnd;
      });
      if (!transactionSort.column || !transactionSort.direction) return rows;
      return [...rows].sort((left, right) => {
        const leftIngredient = ingredientById.get(left.ingredientId);
        const rightIngredient = ingredientById.get(right.ingredientId);
        switch (transactionSort.column) {
          case "time":
            return applySortDirection(compareDate(transactionActivityDate(left), transactionActivityDate(right)), transactionSort.direction);
          case "type":
            return applySortDirection(compareText(left.type, right.type), transactionSort.direction);
          case "ingredient":
            return applySortDirection(compareText(leftIngredient?.name ?? left.ingredientId, rightIngredient?.name ?? right.ingredientId), transactionSort.direction);
          case "quantity":
            return applySortDirection(compareNumber(Number(left.quantity), Number(right.quantity)), transactionSort.direction);
          case "operator":
            return applySortDirection(compareText(left.operatorName, right.operatorName), transactionSort.direction);
          default:
            return 0;
        }
      });
    },
    [ingredientById, transactionCustomEnd, transactionCustomStart, transactionRangePreset, transactionSort, transactions],
  );

  function setTransactionSortColumn(column: "time" | "type" | "ingredient" | "quantity" | "operator", direction: SortDirection) {
    setTransactionSort(direction ? { column, direction } : { column: null, direction: "" });
  }

  const sortedBomHistory = useMemo(() => {
    if (!bomSort.column || !bomSort.direction) return bomHistory;
    return [...bomHistory].sort((left, right) => {
      switch (bomSort.column) {
        case "time":
          return applySortDirection(compareDate(new Date(left.productionDate), new Date(right.productionDate)), bomSort.direction);
        case "bom":
          return applySortDirection(compareText(left.bomName, right.bomName), bomSort.direction);
        case "productionCount":
          return applySortDirection(compareNumber(left.productionCount, right.productionCount), bomSort.direction);
        case "producedQuantity":
          return applySortDirection(compareNumber(left.producedQuantity, right.producedQuantity), bomSort.direction);
        case "cost":
          return applySortDirection(compareNumber(left.totalCost, right.totalCost), bomSort.direction);
        case "operator":
          return applySortDirection(compareText(left.operatorName, right.operatorName), bomSort.direction);
        case "note":
          return applySortDirection(compareText(left.note ?? "", right.note ?? ""), bomSort.direction);
        default:
          return 0;
      }
    });
  }, [bomHistory, bomSort]);

  function setBomSortColumn(
    column: "time" | "bom" | "productionCount" | "producedQuantity" | "cost" | "operator" | "note",
    direction: SortDirection,
  ) {
    setBomSort(direction ? { column, direction } : { column: null, direction: "" });
  }

  const exportOptions = useMemo(() => {
    const dates = [
      ...transactions.map((item) => transactionChartDate(item)),
      ...stockLedger.map((item) => new Date(item.createdAt)),
      ...bomHistory.map((item) => new Date(item.productionDate)),
    ].filter((date) => !Number.isNaN(date.getTime()));
    const maxYear = Math.max(new Date().getFullYear(), 2026, ...dates.map((date) => date.getFullYear()));
    const years = Array.from({ length: maxYear - 2026 + 1 }, (_, index) => 2026 + index);
    const monthsWithData = new Set(
      dates.filter((date) => date.getFullYear() === exportYear).map((date) => date.getMonth()),
    );
    const months = monthsWithData.size ? Array.from(monthsWithData).sort((a, b) => a - b) : reportMonthNames.map((_, index) => index);
    return { months, years };
  }, [bomHistory, exportYear, stockLedger, transactions]);

  useEffect(() => {
    if (!exportOptions.months.includes(exportMonth)) {
      setExportMonth(exportOptions.months[0] ?? 0);
    }
  }, [exportMonth, exportOptions.months]);

  const exportPeriod = useMemo(() => reportPeriodFromSelection(exportYear, exportMonth), [exportMonth, exportYear]);
  const financialReport = useMemo(
    () => buildFinancialReportData(inventory, transactions, stockLedger, bomHistory, exportPeriod),
    [bomHistory, exportPeriod, inventory, stockLedger, transactions],
  );
  const financeReport = useMemo(() => {
    const rows = financeTransactions.filter((item) => isDateInPeriod(new Date(item.transactionDate), exportPeriod));
    const income = rows.filter((item) => item.type === "pendapatan").reduce((sum, item) => sum + item.totalAmount, 0);
    const expense = rows.filter((item) => item.type === "pengeluaran").reduce((sum, item) => sum + item.totalAmount, 0);
    const cashIn = rows
      .filter((item) => item.type === "pendapatan" && item.fundMethod === "cash")
      .reduce((sum, item) => sum + item.totalAmount, 0);
    const cashOut = rows
      .filter((item) => item.type === "pengeluaran" && item.fundMethod === "cash")
      .reduce((sum, item) => sum + item.totalAmount, 0);
    const bankIn = rows
      .filter((item) => item.type === "pendapatan" && item.fundMethod === "bank")
      .reduce((sum, item) => sum + item.totalAmount, 0);
    const bankOut = rows
      .filter((item) => item.type === "pengeluaran" && item.fundMethod === "bank")
      .reduce((sum, item) => sum + item.totalAmount, 0);
    return {
      rows,
      income,
      expense,
      cashBalance: cashIn - cashOut,
      bankBalance: bankIn - bankOut,
      netCashFlow: income - expense,
      balanceSheetLite: cashIn - cashOut + bankIn - bankOut + value,
    };
  }, [exportPeriod, financeTransactions, value]);

  const transactionCards = useMemo(
    () =>
      filteredTransactions.map((item) => {
        const ingredient = ingredientById.get(item.ingredientId);
        return {
          item,
          ingredient,
          timestamp: transactionActivityDate(item),
        };
      }),
    [filteredTransactions, ingredientById],
  );

  useEffect(() => {
    if (!canAccessBomUi(role)) {
      setBomHistory([]);
      return;
    }
    let ignore = false;
    async function loadBomHistory() {
      try {
        const rows = await apiJson<BomProductionHistoryRow[]>("/api/bom/produce");
        if (!ignore) setBomHistory(rows);
      } catch {
        if (!ignore) setBomHistory([]);
      }
    }
    void loadBomHistory();
    return () => {
      ignore = true;
    };
  }, [role]);

  async function handleExcelDownload() {
    setReportMessage("");
    try {
      await downloadReportExcel(inventory, transactions, stockLedger, bomHistory, exportPeriod);
      setReportMessage("File Excel raw data berhasil dibuat.");
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : "Export Excel gagal dibuat.");
    }
  }

  async function handlePdfDownload() {
    setReportMessage("");
    try {
      await downloadReportAnalyticsPdf(inventory, transactions, stockLedger, bomHistory, exportPeriod);
      setReportMessage("File PDF analitik berhasil dibuat.");
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : "Export PDF gagal dibuat.");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Reporting</p>
          <CardTitle className="mt-1">Ekspor</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Tahun
              <Select className="h-9 bg-muted/45" onChange={(event) => setExportYear(Number(event.target.value))} value={String(exportYear)}>
                {exportOptions.years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Bulan
              <Select className="h-9 bg-muted/45" onChange={(event) => setExportMonth(Number(event.target.value))} value={String(exportMonth)}>
                {exportOptions.months.map((month) => (
                  <option key={month} value={month}>
                    {reportMonthNames[month]}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <Button className="justify-start" onClick={() => void handleExcelDownload()} variant="outline">
            <FileSpreadsheet />
            Export Excel {exportPeriod.label}
          </Button>
          <Button className="justify-start" onClick={() => void handlePdfDownload()} variant="outline">
            <Download />
            Export PDF analitik {exportPeriod.label}
          </Button>
          <Separator className="my-2" />
          <div className="rounded-md bg-muted/45 p-4">
            <p className="text-xs text-muted-foreground">Nilai stok saat ini</p>
            <p className="mt-1 font-mono text-2xl font-bold">{formatRupiah(value)}</p>
            <div className="mt-4 grid gap-2 text-sm">
              {[
                ["Nilai Stok Awal", financialReport.initialValueEstimate],
                ["Ditambah Pembelian", financialReport.purchaseTotal],
                ["Dikurangi Pemakaian", financialReport.usageTotal],
                ["Ditambah Koreksi Plus", financialReport.correctionPlus],
                ["Dikurangi Koreksi Minus", financialReport.correctionMinus],
              ].map(([label, nominal]) => (
                <div className="flex items-center justify-between gap-3 border-t border-border/55 pt-2" key={String(label)}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-semibold">{formatRupiah(Number(nominal))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Laporan Finance</p>
                <p className="mt-1 text-sm font-bold">{exportPeriod.label}</p>
              </div>
              <Wallet className="size-5 text-primary" />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              {[
                ["Pendapatan", financeReport.income],
                ["Pengeluaran", financeReport.expense],
                ["Saldo Cash", financeReport.cashBalance],
                ["Saldo Bank", financeReport.bankBalance],
                ["Arus Kas Bersih", financeReport.netCashFlow],
                ["Laba/Rugi Manajerial", financeReport.netCashFlow],
                ["Neraca Lite: Kas+Bank+Stok", financeReport.balanceSheetLite],
              ].map(([label, nominal]) => (
                <div className="flex items-center justify-between gap-3 border-t border-border/55 pt-2" key={String(label)}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-semibold">{formatRupiah(Number(nominal))}</span>
                </div>
              ))}
            </div>
          </div>
          {reportMessage && <p className="rounded-md border bg-muted/35 p-3 text-xs font-medium text-muted-foreground">{reportMessage}</p>}
        </CardContent>
      </Card>
      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Transaction log</p>
          <CardTitle className="mt-1">Audit Trail dari API</CardTitle>
          </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:hidden">
            {transactionCards.map(({ item, ingredient, timestamp }) => {
              return (
                <div key={item.id} className="rounded-md border bg-muted/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{ingredient?.name ?? item.ingredientId}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{timestamp.toLocaleString("id-ID")}</p>
                    </div>
                    <Badge variant={item.type === "keluar" ? "warning" : "success"}>{item.type}</Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{item.operatorName}</span>
                    <span className="font-mono font-medium">{Number(item.quantity)} {ingredient?.unit ?? ""}</span>
                  </div>
                </div>
              );
            })}
            {!transactionCards.length && <EmptyState message="Belum ada transaksi atau role Anda bukan Owner." />}
          </div>
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <DateAutoFilterHeader
                      customEnd={transactionCustomEnd}
                      customStart={transactionCustomStart}
                      onCustomEndChange={setTransactionCustomEnd}
                      onCustomStartChange={setTransactionCustomStart}
                      onRangePresetChange={setTransactionRangePreset}
                      onSortChange={(value) => setTransactionSortColumn("time", value)}
                      rangePreset={transactionRangePreset}
                      value={transactionSort.column === "time" ? transactionSort.direction : ""}
                    />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <AutoFilterHeader label="Tipe" kind="text" onChange={(value) => setTransactionSortColumn("type", value)} value={transactionSort.column === "type" ? transactionSort.direction : ""} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <AutoFilterHeader label="Bahan" kind="text" onChange={(value) => setTransactionSortColumn("ingredient", value)} value={transactionSort.column === "ingredient" ? transactionSort.direction : ""} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <AutoFilterHeader label="Jumlah" kind="number" onChange={(value) => setTransactionSortColumn("quantity", value)} value={transactionSort.column === "quantity" ? transactionSort.direction : ""} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <AutoFilterHeader label="Operator" kind="text" onChange={(value) => setTransactionSortColumn("operator", value)} value={transactionSort.column === "operator" ? transactionSort.direction : ""} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactionCards.map(({ item, ingredient, timestamp }) => {
                  return (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-mono">{timestamp.toLocaleString("id-ID")}</td>
                      <td className="px-4 py-3"><Badge variant={item.type === "keluar" ? "warning" : "success"}>{item.type}</Badge></td>
                      <td className="px-4 py-3 font-bold">{ingredient?.name ?? item.ingredientId}</td>
                      <td className="px-4 py-3 font-mono">{Number(item.quantity)} {ingredient?.unit ?? ""}</td>
                      <td className="px-4 py-3">{item.operatorName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredTransactions.length && <EmptyState message="Belum ada transaksi atau role Anda bukan Owner." />}
          </div>
        </CardContent>
      </Card>
      {canAccessBomUi(role) && (
        <Card className="bg-card/95 xl:col-span-2">
          <CardHeader>
            <p className="text-[11px] font-bold uppercase text-muted-foreground">BOM production log</p>
            <CardTitle className="mt-1">Riwayat Produksi BOM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:hidden">
              {sortedBomHistory.map((item) => (
                <div key={item.id} className="rounded-md border bg-muted/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{item.bomName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(item.productionDate).toLocaleString("id-ID")}</p>
                    </div>
                    <Badge variant="success">{item.producedQuantity} {item.yieldUnit}</Badge>
                  </div>
                  <div className="mt-4 grid gap-1 text-sm">
                    <p>Produksi: <span className="font-mono">{item.productionCount}x</span></p>
                    <p>Operator: <span className="font-medium">{item.operatorName}</span></p>
                    <p>Biaya: <span className="font-mono">{formatRupiah(item.totalCost)}</span></p>
                  </div>
                  <button
                    className="mt-3 text-xs font-semibold text-primary"
                    onClick={() => setExpandedBomHistoryId((current) => (current === item.id ? null : item.id))}
                    type="button"
                  >
                    {expandedBomHistoryId === item.id ? "Tutup detail bahan" : "Lihat detail bahan"}
                  </button>
                  {expandedBomHistoryId === item.id && (
                    <div className="mt-3 grid gap-2">
                      {item.items.map((detail) => (
                        <div className="rounded-md border bg-card px-3 py-2 text-xs" key={detail.id}>
                          <p className="font-semibold">{detail.ingredientName}</p>
                          <p className="mt-1 text-muted-foreground">
                            {detail.consumedQuantity} {detail.ingredientUnit} • {formatRupiah(detail.totalCost)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {!sortedBomHistory.length && <EmptyState message="Belum ada riwayat produksi BOM." />}
            </div>
            <div className="hidden overflow-x-auto rounded-md border md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <AutoFilterHeader label="Waktu" kind="date" onChange={(value) => setBomSortColumn("time", value)} value={bomSort.column === "time" ? bomSort.direction : ""} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <AutoFilterHeader label="BOM" kind="text" onChange={(value) => setBomSortColumn("bom", value)} value={bomSort.column === "bom" ? bomSort.direction : ""} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <AutoFilterHeader label="Jumlah Produksi" kind="number" onChange={(value) => setBomSortColumn("productionCount", value)} value={bomSort.column === "productionCount" ? bomSort.direction : ""} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <AutoFilterHeader label="Hasil Aktual" kind="number" onChange={(value) => setBomSortColumn("producedQuantity", value)} value={bomSort.column === "producedQuantity" ? bomSort.direction : ""} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <AutoFilterHeader label="Biaya" kind="number" onChange={(value) => setBomSortColumn("cost", value)} value={bomSort.column === "cost" ? bomSort.direction : ""} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <AutoFilterHeader label="Operator" kind="text" onChange={(value) => setBomSortColumn("operator", value)} value={bomSort.column === "operator" ? bomSort.direction : ""} />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <AutoFilterHeader label="Catatan" kind="text" onChange={(value) => setBomSortColumn("note", value)} value={bomSort.column === "note" ? bomSort.direction : ""} />
                    </th>
                    <th className="px-4 py-3 text-left">Detail Bahan</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBomHistory.map((item) => (
                    <Fragment key={item.id}>
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3 font-mono">{new Date(item.productionDate).toLocaleString("id-ID")}</td>
                        <td className="px-4 py-3 font-bold">{item.bomName}</td>
                        <td className="px-4 py-3 font-mono">{item.productionCount}x</td>
                        <td className="px-4 py-3 font-mono">{item.producedQuantity} {item.yieldUnit}</td>
                        <td className="px-4 py-3 font-mono">{formatRupiah(item.totalCost)}</td>
                        <td className="px-4 py-3">{item.operatorName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.note || "-"}</td>
                        <td className="px-4 py-3">
                          <button
                            className="text-xs font-semibold text-primary"
                            onClick={() => setExpandedBomHistoryId((current) => (current === item.id ? null : item.id))}
                            type="button"
                          >
                            {expandedBomHistoryId === item.id ? "Sembunyikan" : "Lihat"}
                          </button>
                        </td>
                      </tr>
                      {expandedBomHistoryId === item.id && (
                        <tr className="border-t bg-muted/25">
                          <td className="px-4 py-3" colSpan={8}>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {item.items.map((detail) => (
                                <div className="rounded-md border bg-card px-3 py-2 text-xs" key={detail.id}>
                                  <p className="font-semibold">{detail.ingredientName}</p>
                                  <div className="mt-1 grid gap-1 text-muted-foreground">
                                    <p>Konsumsi: {detail.consumedQuantity} {detail.ingredientUnit}</p>
                                    <p>Harga/unit: {formatRupiah(detail.unitCost)}</p>
                                    <p>Total: {formatRupiah(detail.totalCost)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {!sortedBomHistory.length && <EmptyState message="Belum ada riwayat produksi BOM." />}
            </div>
          </CardContent>
        </Card>
      )}
      {role === "Owner" && (
        <Card className="bg-card/95 xl:col-span-2">
          <CardHeader>
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Laporan Finance</p>
            <CardTitle className="mt-1">Cash Flow, Kas dan Bank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Tipe</th>
                    <th className="px-4 py-3 text-left">Metode</th>
                    <th className="px-4 py-3 text-left">Kategori</th>
                    <th className="px-4 py-3 text-left">Nama</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                    <th className="px-4 py-3 text-left">Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {financeReport.rows.map((item) => (
                    <tr className="border-t" key={item.id}>
                      <td className="px-4 py-3">{new Date(item.transactionDate).toLocaleString("id-ID")}</td>
                      <td className="px-4 py-3">
                        <Badge variant={item.type === "pendapatan" ? "success" : "warning"}>{item.type}</Badge>
                      </td>
                      <td className="px-4 py-3">{item.fundMethod}</td>
                      <td className="px-4 py-3">{item.subcategory}</td>
                      <td className="px-4 py-3">{item.itemName}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatRupiah(item.totalAmount)}</td>
                      <td className="px-4 py-3">{item.operatorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!financeReport.rows.length && <EmptyState message="Belum ada transaksi finance pada periode ini." />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MasterDataPage({ inventory, categories }: { inventory: Ingredient[]; categories: Category[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {categories.map((cat) => {
          const count = inventory.filter((item) => item.category === cat).length;
          const tone = getCategoryTone(cat);
          return (
            <div key={cat} className={cn("rounded-lg border p-4 shadow-soft", tone.bg)}>
              <p className={cn("text-xs font-semibold uppercase tracking-[0.1em]", tone.text)}>{cat}</p>
              <p className="mt-3 font-mono text-2xl font-medium">{count}</p>
            </div>
          );
        })}
      </div>
      {categories.map((cat) => (
        <Card className="bg-card/95" key={cat}>
          <CardHeader><CardTitle className={getCategoryTone(cat).text}>{cat}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {inventory.filter((item) => item.category === cat).map((item) => (
                <div key={item.id} className="rounded-md border bg-card p-3">
                  <p className="truncate text-sm font-bold">{item.name}</p>
                  <p className={cn("mt-1 text-xs font-bold", getCategoryTone(cat).text)}>{item.unit}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      {!inventory.length && <EmptyState message="Belum ada master bahan dari API." />}
    </div>
  );
}

type SettingsPanel = "unit" | "category" | "product" | "finance_non_stock_subcategory" | "finance_transactions" | "employees" | "bom";
type ProductDraft = {
  name: string;
  category: string;
  unit: string;
  stock: string;
  minimumStock: string;
  averagePrice: string;
};
type ProductEditRow = ProductDraft & {
  key: string;
  ingredientId: string;
  query: string;
};

type BomDraftItem = {
  key: string;
  ingredientId: string;
  quantity: string;
  totalCost: string;
};

type BomDraft = {
  id?: string;
  finishedIngredientId?: string;
  name: string;
  category: string;
  unit: string;
  yieldQuantity: string;
  minimumStock: string;
  items: BomDraftItem[];
};

function emptyProductDraft(): ProductDraft {
  return {
    averagePrice: "",
    category: "",
    minimumStock: "",
    name: "",
    stock: "",
    unit: "",
  };
}

function emptyBomDraftItem(): BomDraftItem {
  return {
    key: `bom-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ingredientId: "",
    quantity: "",
    totalCost: "",
  };
}

function emptyBomDraft(): BomDraft {
  return {
    id: undefined,
    finishedIngredientId: undefined,
    name: "",
    category: "BOM / Produk Olahan",
    unit: "Pax",
    yieldQuantity: "",
    minimumStock: "0",
    items: [emptyBomDraftItem()],
  };
}

function SettingsPage({
  role,
  name,
  email,
  financeTransactions,
  inventory,
  categories,
  onSaved,
}: {
  role: Role;
  name: string;
  email: string;
  financeTransactions: FinanceTransactionRow[];
  inventory: Ingredient[];
  categories: Category[];
  onSaved: () => Promise<void>;
}) {
  const [activePanel, setActivePanel] = useState<SettingsPanel>(role === "Owner" ? "unit" : "bom");
  const [units, setUnits] = useState<string[]>([]);
  const [originalUnits, setOriginalUnits] = useState<string[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<string[]>([]);
  const [originalCategories, setOriginalCategories] = useState<string[]>([]);
  const [financeNonStockSubcategories, setFinanceNonStockSubcategories] = useState<string[]>([]);
  const [originalFinanceNonStockSubcategories, setOriginalFinanceNonStockSubcategories] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [newValue, setNewValue] = useState("");
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft);
  const [productEditRows, setProductEditRows] = useState<ProductEditRow[]>([
    { ...emptyProductDraft(), ingredientId: "", key: "edit-1", query: "" },
  ]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [resettingEmployeeId, setResettingEmployeeId] = useState<string | null>(null);
  const [updatingRoleEmployeeId, setUpdatingRoleEmployeeId] = useState<string | null>(null);
  const [savingFinanceId, setSavingFinanceId] = useState<string | null>(null);
  const [financeEditRows, setFinanceEditRows] = useState<Record<string, { fundMethod: FinanceFundMethod; itemName: string; note: string; quantity: string; transactionDate: string; unitPrice: string }>>({});
  const [temporaryPassword, setTemporaryPassword] = useState<{ employeeName: string; password: string } | null>(null);
  const [bomDraft, setBomDraft] = useState<BomDraft>(emptyBomDraft);
  const [bomRecipes, setBomRecipes] = useState<BomRecipeRow[]>([]);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [profileDraft, setProfileDraft] = useState({ currentPassword: "", email, name, newPassword: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setProfileDraft((current) => ({ ...current, email, name }));
  }, [email, name]);

  useEffect(() => {
    if (role !== "Owner") setActivePanel("bom");
  }, [role]);

  useEffect(() => {
    setFinanceEditRows((current) => {
      const next = { ...current };
      for (const item of financeTransactions.slice(0, 30)) {
        if (next[item.id]) continue;
        next[item.id] = {
          fundMethod: item.fundMethod,
          itemName: item.itemName,
          note: item.note ?? "",
          quantity: String(Number(item.quantity)),
          transactionDate: new Date(item.transactionDate).toISOString().slice(0, 10),
          unitPrice: String(item.unitPrice),
        };
      }
      return next;
    });
  }, [financeTransactions]);

  useEffect(() => {
    const nextUnits = Array.from(new Set(inventory.map((item) => item.unit))).sort();
    setUnits(nextUnits);
    setOriginalUnits(nextUnits);
    setProducts(Array.from(new Set(inventory.map((item) => item.name))).sort());
  }, [inventory]);

  useEffect(() => {
    const nextCategories = Array.from(new Set([...categories, ...inventory.map((item) => item.category)])).sort();
    setCategoryDrafts(nextCategories);
    setOriginalCategories(nextCategories);
  }, [categories, inventory]);

  useEffect(() => {
    let ignore = false;
    async function loadMasterOptions() {
      try {
        const options = await apiJson<IngredientMasterOptions>("/api/ingredients/master");
        if (ignore) return;
        setUnits(options.units);
        setOriginalUnits(options.units);
        setCategoryDrafts(options.categories);
        setOriginalCategories(options.categories);
        setFinanceNonStockSubcategories(options.financeNonStockSubcategories ?? []);
        setOriginalFinanceNonStockSubcategories(options.financeNonStockSubcategories ?? []);
      } catch (error) {
        setSettingsMessage(error instanceof Error ? error.message : "Master data gagal dimuat dari database");
      }
    }
    void loadMasterOptions();
    return () => {
      ignore = true;
    };
  }, [inventory]);

  useEffect(() => {
    let ignore = false;
    async function loadBomRecipes() {
      if (!canAccessBomUi(role)) {
        setBomRecipes([]);
        return;
      }
      try {
        const rows = await apiJson<BomRecipeRow[]>("/api/bom");
        if (!ignore) setBomRecipes(rows);
      } catch (error) {
        if (!ignore) {
          setSettingsMessage(error instanceof Error ? error.message : "Data BOM gagal dimuat dari database");
        }
      }
    }
    void loadBomRecipes();
    return () => {
      ignore = true;
    };
  }, [inventory, role]);

  useEffect(() => {
    let ignore = false;
    async function loadEmployees() {
      if (role !== "Owner") {
        setEmployees([]);
        return;
      }
      try {
        const rows = await apiJson<EmployeeRow[]>("/api/employees");
        if (!ignore) setEmployees(rows);
      } catch (error) {
        if (!ignore) setSettingsMessage(error instanceof Error ? error.message : "Data karyawan gagal dimuat");
      }
    }
    void loadEmployees();
    return () => {
      ignore = true;
    };
  }, [role]);

  const panelItems = {
    unit: units,
    category: categoryDrafts,
    finance_non_stock_subcategory: financeNonStockSubcategories,
    finance_transactions: financeTransactions.map((item) => item.itemName),
    product: products,
    employees: employees.map((item) => item.name),
    bom: bomRecipes.map((item) => item.name),
  };
  const panelCopy: Record<SettingsPanel, { title: string; placeholder: string }> = {
    unit: {
      title: "Satuan Ukuran",
      placeholder: "Contoh: kg, liter, ikat",
    },
    category: {
      title: "Kategori Produk",
      placeholder: "Contoh: Bumbu Siap Pakai",
    },
    product: {
      title: "Product",
      placeholder: "Contoh: Cabai hijau besar",
    },
    finance_non_stock_subcategory: {
      title: "Kategori Finance Non-Stock",
      placeholder: "Contoh: Prive, Operasional, Maintenance",
    },
    finance_transactions: {
      title: "Edit Data Finance",
      placeholder: "Edit transaksi finance terbaru",
    },
    employees: {
      title: "Kelola Karyawan",
      placeholder: "Reset password akun karyawan",
    },
    bom: {
      title: "Setting BOM",
      placeholder: "Contoh: Bumbu Soto",
    },
  };

  function updateActiveItems(next: string[]) {
    const cleaned = Array.from(new Set(next.map((item) => item.trim()).filter(Boolean))).sort();
    if (activePanel === "unit") setUnits(cleaned);
    if (activePanel === "category") setCategoryDrafts(cleaned);
    if (activePanel === "finance_non_stock_subcategory") setFinanceNonStockSubcategories(cleaned);
    if (activePanel === "product") setProducts(cleaned);
  }

  function setActiveItemsRaw(next: string[]) {
    if (activePanel === "unit") setUnits(next);
    if (activePanel === "category") setCategoryDrafts(next);
    if (activePanel === "finance_non_stock_subcategory") setFinanceNonStockSubcategories(next);
    if (activePanel === "product") setProducts(next);
  }

  async function addActiveItem() {
    if (!newValue.trim()) return;
    if (activePanel === "product") return;
    setSettingsMessage("");
    try {
      await apiJson("/api/ingredients/master", {
        method: "POST",
        body: JSON.stringify({ type: activePanel, value: newValue }),
      });
      updateActiveItems([...panelItems[activePanel], newValue]);
      if (activePanel === "unit") setOriginalUnits((current) => Array.from(new Set([...current, newValue.trim()])).sort());
      if (activePanel === "category") setOriginalCategories((current) => Array.from(new Set([...current, newValue.trim()])).sort());
      if (activePanel === "finance_non_stock_subcategory") {
        setOriginalFinanceNonStockSubcategories((current) => Array.from(new Set([...current, newValue.trim()])).sort());
      }
      setNewValue("");
      await onSaved();
      setSettingsMessage(`${panelCopy[activePanel].title} tersimpan ke database.`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Master data gagal disimpan");
    }
  }

  function updateActiveItem(index: number, value: string) {
    setActiveItemsRaw(panelItems[activePanel].map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  async function saveActiveItem(index: number, previousValue: string, nextValue: string) {
    if (activePanel === "product" || previousValue === nextValue) return;
    setSettingsMessage("");
    try {
      await apiJson("/api/ingredients/master", {
        method: "PATCH",
        body: JSON.stringify({ type: activePanel, previousValue, nextValue }),
      });
      await onSaved();
      if (activePanel === "unit") setOriginalUnits((current) => current.map((item, itemIndex) => (itemIndex === index ? nextValue : item)));
      if (activePanel === "category") {
        setOriginalCategories((current) => current.map((item, itemIndex) => (itemIndex === index ? nextValue : item)));
      }
      if (activePanel === "finance_non_stock_subcategory") {
        setOriginalFinanceNonStockSubcategories((current) => current.map((item, itemIndex) => (itemIndex === index ? nextValue : item)));
      }
      setSettingsMessage(`${panelCopy[activePanel].title} diperbarui di database.`);
    } catch (error) {
      updateActiveItem(index, previousValue);
      setSettingsMessage(error instanceof Error ? error.message : "Master data gagal diperbarui");
    }
  }

  async function removeActiveItem(index: number) {
    if (activePanel === "product") return;
    const value = panelItems[activePanel][index];
    setSettingsMessage("");
    try {
      await apiJson("/api/ingredients/master", {
        method: "DELETE",
        body: JSON.stringify({ type: activePanel, value }),
      });
      updateActiveItems(panelItems[activePanel].filter((_, itemIndex) => itemIndex !== index));
      if (activePanel === "unit") setOriginalUnits((current) => current.filter((_, itemIndex) => itemIndex !== index));
      if (activePanel === "category") setOriginalCategories((current) => current.filter((_, itemIndex) => itemIndex !== index));
      if (activePanel === "finance_non_stock_subcategory") {
        setOriginalFinanceNonStockSubcategories((current) => current.filter((_, itemIndex) => itemIndex !== index));
      }
      await onSaved();
      setSettingsMessage(`${panelCopy[activePanel].title} dinonaktifkan dari database.`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Master data gagal dihapus");
    }
  }

  function updateProductDraft(patch: Partial<ProductDraft>) {
    setProductDraft((current) => ({ ...current, ...patch }));
  }

  function productDraftFromIngredient(item: Ingredient): ProductDraft {
    return {
      averagePrice: String(item.price),
      category: item.category,
      minimumStock: String(item.minimum),
      name: item.name,
      stock: String(item.stock),
      unit: item.unit,
    };
  }

  function resetProductDraft() {
    setProductDraft(emptyProductDraft());
  }

  function productPayloadFromDraft(draft: ProductDraft) {
    const payload = {
      averagePrice: Number(String(draft.averagePrice).replace(/[^\d.-]/g, "")) || 0,
      category: draft.category,
      minimumStock: Number(draft.minimumStock) || 0,
      name: draft.name.trim(),
      stock: Number(draft.stock) || 0,
      unit: draft.unit.trim(),
    };

    if (!payload.name || !payload.category || !payload.unit) {
      throw new Error("Nama, kategori, dan satuan wajib diisi");
    }
    return payload;
  }

  async function saveProductDraft(draft: ProductDraft, ingredientId?: string) {
    const payload = productPayloadFromDraft(draft);
    await apiJson<IngredientRow>("/api/ingredients", {
      method: ingredientId ? "PATCH" : "POST",
      body: JSON.stringify(ingredientId ? { id: ingredientId, ...payload } : payload),
    });
    setProducts((current) => Array.from(new Set([...current, payload.name])).sort());
  }

  async function handleCreateProduct() {
    setSettingsMessage("");
    try {
      await saveProductDraft(productDraft);
      resetProductDraft();
      await onSaved();
      setSettingsMessage("Product tersimpan ke ingredients.");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Product gagal disimpan");
    }
  }

  function updateProductEditRow(key: string, patch: Partial<ProductEditRow>) {
    setProductEditRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function selectProductEditRow(key: string, query: string) {
    const item = inventory.find((ingredient) => ingredient.name.toLowerCase() === query.toLowerCase());
    updateProductEditRow(
      key,
      item
        ? { ...productDraftFromIngredient(item), ingredientId: item.id, query: item.name }
        : { ingredientId: "", query },
    );
  }

  function addProductEditRow() {
    setProductEditRows((current) =>
      current.length >= 20 ? current : [...current, { ...emptyProductDraft(), ingredientId: "", key: `edit-${Date.now()}-${current.length}`, query: "" }],
    );
  }

  function removeProductEditRow(key: string) {
    setProductEditRows((current) =>
      current.length === 1 ? [{ ...emptyProductDraft(), ingredientId: "", key: "edit-1", query: "" }] : current.filter((row) => row.key !== key),
    );
  }

  async function handleSaveProductEdits() {
    setSettingsMessage("");
    try {
      const selectedRows = productEditRows.filter((row) => row.ingredientId);
      if (!selectedRows.length) throw new Error("Pilih minimal 1 product existing untuk diedit");

      for (const row of selectedRows) {
        await saveProductDraft(row, row.ingredientId);
      }
      await onSaved();
      setSettingsMessage(`${selectedRows.length} product existing berhasil diperbarui.`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Edit product gagal disimpan");
    }
  }

  async function resetEmployeePassword(employee: EmployeeRow) {
    setSettingsMessage("");
    setTemporaryPassword(null);
    setResettingEmployeeId(employee.id);
    try {
      const result = await apiJson<{ employee: EmployeeRow; temporaryPassword: string; mustChangePassword: boolean }>("/api/employees", {
        method: "POST",
        body: JSON.stringify({ action: "reset-password", userId: employee.id }),
      });
      setEmployees((current) =>
        current.map((item) => (item.id === employee.id ? { ...item, mustChangePassword: result.mustChangePassword } : item)),
      );
      setTemporaryPassword({ employeeName: employee.name, password: result.temporaryPassword });
      setSettingsMessage(`Password sementara untuk ${employee.name} berhasil dibuat.`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Reset password karyawan gagal");
    } finally {
      setResettingEmployeeId(null);
    }
  }

  async function updateEmployeeRole(employee: EmployeeRow, nextRole: Exclude<Role, "Owner">) {
    if (employee.role === nextRole) return;
    setSettingsMessage("");
    setUpdatingRoleEmployeeId(employee.id);
    try {
      const result = await apiJson<{ employee: EmployeeRow }>("/api/employees", {
        method: "POST",
        body: JSON.stringify({ action: "update-role", userId: employee.id, role: nextRole }),
      });
      setEmployees((current) => current.map((item) => (item.id === employee.id ? result.employee : item)));
      setSettingsMessage(`Akses ${employee.name} diubah menjadi ${nextRole}. Session lama akun tersebut sudah dicabut.`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Role karyawan gagal diperbarui");
    } finally {
      setUpdatingRoleEmployeeId(null);
    }
  }

  function updateFinanceEditRow(id: string, patch: Partial<{ fundMethod: FinanceFundMethod; itemName: string; note: string; quantity: string; transactionDate: string; unitPrice: string }>) {
    const fallback = {
      fundMethod: "cash" as FinanceFundMethod,
      itemName: "",
      note: "",
      quantity: "1",
      transactionDate: new Date().toISOString().slice(0, 10),
      unitPrice: "",
    };
    setFinanceEditRows((current) => ({
      ...current,
      [id]: {
        ...fallback,
        ...current[id],
        ...patch,
      },
    }));
  }

  async function saveFinanceEdit(item: FinanceTransactionRow) {
    const draft = financeEditRows[item.id];
    if (!draft) return;
    setSettingsMessage("");
    setSavingFinanceId(item.id);
    try {
      await apiJson<FinanceTransactionRow>("/api/finance/transactions", {
        method: "PATCH",
        body: JSON.stringify({
          id: item.id,
          fundMethod: draft.fundMethod,
          itemName: draft.itemName,
          note: draft.note || undefined,
          quantity: Number(draft.quantity),
          transactionDate: combineDateWithCurrentTime(draft.transactionDate).toISOString(),
          unitPrice: Math.round(Number(String(draft.unitPrice).replace(/[^\d.-]/g, ""))),
        }),
      });
      await onSaved();
      setSettingsMessage(`Data finance ${item.itemName} berhasil diperbarui.`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Data finance gagal diperbarui");
    } finally {
      setSavingFinanceId(null);
    }
  }

  async function copyTemporaryPassword() {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword.password);
    setSettingsMessage("Password sementara disalin. Berikan langsung ke karyawan terkait.");
  }

  async function saveProfile() {
    setSettingsMessage("");
    setSavingProfile(true);
    try {
      await apiJson("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: profileDraft.currentPassword || undefined,
          email: profileDraft.email,
          name: profileDraft.name,
          newPassword: profileDraft.newPassword || undefined,
        }),
      });
      setProfileDraft((current) => ({ ...current, currentPassword: "", newPassword: "" }));
      setSettingsMessage("Profil akun berhasil diperbarui. Halaman akan refresh agar session sinkron.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Profil akun gagal diperbarui");
    } finally {
      setSavingProfile(false);
    }
  }

  const availableBomIngredients = inventory.filter((item) => !item.isBom);
  const bomTotalCost = bomDraft.items.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
  const bomUnitCost = bomDraft.yieldQuantity ? Math.round(bomTotalCost / Number(bomDraft.yieldQuantity || 0)) : 0;

  function updateBomDraft(patch: Partial<Omit<BomDraft, "items">>) {
    setBomDraft((current) => ({ ...current, ...patch }));
  }

  function updateBomItem(key: string, patch: Partial<BomDraftItem>) {
    setBomDraft((current) => {
      const nextItems = current.items.map((item) => {
        if (item.key !== key) return item;
        const nextItem = { ...item, ...patch };
        const selectedIngredient = availableBomIngredients.find((ingredient) => ingredient.id === nextItem.ingredientId);
        const quantity = Number(nextItem.quantity) || 0;
        return {
          ...nextItem,
          totalCost: selectedIngredient && quantity > 0 ? String(Math.round(selectedIngredient.price * quantity)) : quantity > 0 ? nextItem.totalCost : "",
        };
      });
      return { ...current, items: nextItems };
    });
  }

  function addBomItem() {
    setBomDraft((current) =>
      current.items.length >= 20 ? current : { ...current, items: [...current.items, emptyBomDraftItem()] },
    );
  }

  function removeBomItem(key: string) {
    setBomDraft((current) => ({
      ...current,
      items: current.items.length === 1 ? [emptyBomDraftItem()] : current.items.filter((item) => item.key !== key),
    }));
  }

  async function reloadBomRecipes() {
    const rows = await apiJson<BomRecipeRow[]>("/api/bom");
    setBomRecipes(rows);
  }

  async function saveBomDraft() {
    setSettingsMessage("");
    try {
      const payload = {
        name: bomDraft.name.trim(),
        category: bomDraft.category.trim(),
        unit: bomDraft.unit.trim(),
        yieldQuantity: Number(bomDraft.yieldQuantity),
        minimumStock: Number(bomDraft.minimumStock || 0),
        items: bomDraft.items
          .map((item) => ({
            ingredientId: item.ingredientId,
            quantity: Number(item.quantity),
            totalCost: Number(item.totalCost),
          }))
          .filter((item) => item.ingredientId || item.quantity > 0 || item.totalCost > 0),
      };

      if (!payload.name || !payload.category || !payload.unit || !payload.yieldQuantity) {
        throw new Error("Nama BOM, kategori, satuan, dan hasil wajib diisi");
      }

      if (!payload.items.length) {
        throw new Error("Minimal 1 bahan penyusun BOM wajib diisi");
      }

      if (payload.items.some((item) => !item.ingredientId || item.quantity <= 0 || item.totalCost < 0)) {
        throw new Error("Setiap bahan BOM wajib memilih bahan, quantity, dan nominal total yang valid");
      }

      await apiJson("/api/bom", {
        method: bomDraft.id ? "PATCH" : "POST",
        body: JSON.stringify(
          bomDraft.id && bomDraft.finishedIngredientId
            ? { id: bomDraft.id, finishedIngredientId: bomDraft.finishedIngredientId, ...payload }
            : payload,
        ),
      });
      setBomDraft(emptyBomDraft());
      await Promise.all([reloadBomRecipes(), onSaved()]);
      setSettingsMessage(bomDraft.id ? "BOM berhasil diperbarui." : "BOM berhasil disimpan. Barang BOM sudah masuk ke database master stok.");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "BOM gagal disimpan");
    }
  }

  function editBomRecipe(recipe: BomRecipeRow) {
    setActivePanel("bom");
    setBomDraft({
      id: recipe.id,
      finishedIngredientId: recipe.finishedIngredientId,
      name: recipe.name,
      category: recipe.category,
      unit: recipe.yieldUnit,
      yieldQuantity: String(recipe.yieldQuantity),
      minimumStock: String(inventory.find((item) => item.id === recipe.finishedIngredientId)?.minimum ?? 0),
      items: recipe.items.map((item) => ({
        key: `bom-item-${item.id}`,
        ingredientId: item.ingredientId,
        quantity: String(item.quantity),
        totalCost: String(item.totalCost),
      })),
    });
    setSettingsMessage(`Mode edit BOM: ${recipe.name}`);
  }

  const settingCardsBase: Array<{ group: "Master Data Stock" | "Master Data Finance" | "Account" | "Operasional"; id: SettingsPanel; title: string; count: number; icon: typeof Ruler }> = [
    { group: "Master Data Stock", id: "unit", title: "Satuan stock", count: units.length, icon: Ruler },
    { group: "Master Data Stock", id: "category", title: "Kategori stock", count: categoryDrafts.length, icon: Tags },
    { group: "Master Data Stock", id: "product", title: "Barang stock", count: products.length, icon: Package },
    {
      group: "Master Data Finance",
      id: "finance_non_stock_subcategory",
      title: "Kategori finance",
      count: financeNonStockSubcategories.length,
      icon: Wallet,
    },
    {
      group: "Master Data Finance",
      id: "finance_transactions",
      title: "Edit data finance",
      count: financeTransactions.length,
      icon: FileSpreadsheet,
    },
    { group: "Account", id: "employees", title: "Akses akun", count: employees.length, icon: Users },
    { group: "Operasional", id: "bom", title: "BOM", count: bomRecipes.length, icon: Database },
  ];
  const settingCards = settingCardsBase.filter((item) =>
    role === "Owner" ? true : canAccessBomUi(role) && item.id === "bom",
  );
  const settingCardGroups = Array.from(new Set(settingCards.map((item) => item.group)));

  return (
    <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Account</p>
          <CardTitle className="mt-1">Akun Aktif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border bg-muted/35 p-4">
            <div className="grid size-12 place-items-center rounded-full bg-primary text-lg font-medium text-primary-foreground">{role[0]}</div>
            <div className="min-w-0">
              <p className="font-semibold">{name || role}</p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm font-semibold">
              Nama
              <Input onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} value={profileDraft.name} />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Email
              <Input onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} type="email" value={profileDraft.email} />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Password lama
              <Input
                onChange={(event) => setProfileDraft((current) => ({ ...current, currentPassword: event.target.value }))}
                placeholder="Wajib jika ganti password"
                type="password"
                value={profileDraft.currentPassword}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Password baru
              <Input
                minLength={8}
                onChange={(event) => setProfileDraft((current) => ({ ...current, newPassword: event.target.value }))}
                placeholder="Minimal 8 karakter"
                type="password"
                value={profileDraft.newPassword}
              />
            </label>
            <Button disabled={savingProfile || profileDraft.name.trim().length < 2 || !profileDraft.email.includes("@")} onClick={() => void saveProfile()} type="button">
              {savingProfile ? <Loader2 className="animate-spin" /> : <Save />}
              Simpan Akun
            </Button>
          </div>
        </CardContent>
      </Card>

      {settingCards.length > 0 && (
      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Master ingredients</p>
          <CardTitle className="mt-1">Pengaturan Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {settingCardGroups.map((group) => (
              <div className="grid gap-2" key={group}>
                <p className="text-[11px] font-bold uppercase text-muted-foreground">{group}</p>
                <div className={cn("grid gap-2", settingCards.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2")}>
                  {settingCards.filter((item) => item.group === group).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        className={cn(
                          "rounded-md border bg-muted/35 p-3 text-left transition hover:border-primary hover:bg-primary/5",
                          activePanel === item.id && "border-primary bg-primary/10",
                        )}
                        key={item.id}
                        onClick={() => {
                          setActivePanel(item.id);
                          setNewValue("");
                        }}
                        type="button"
                      >
                        <Icon className="size-4 text-primary" />
                        <p className="mt-2 text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.count} data</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border bg-muted/35 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold">{panelCopy[activePanel].title}</p>
              </div>
              <Badge variant="secondary">{panelItems[activePanel].length} item</Badge>
            </div>

            {activePanel !== "product" && activePanel !== "bom" && activePanel !== "employees" && activePanel !== "finance_transactions" ? (
              <>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Input
                    onChange={(event) => setNewValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addActiveItem();
                      }
                    }}
                    placeholder={panelCopy[activePanel].placeholder}
                    value={newValue}
                  />
                  <Button className="sm:w-auto" onClick={() => void addActiveItem()} type="button">
                    <Plus />
                    Tambah
                  </Button>
                </div>

                <div className="mt-4 grid max-h-[460px] gap-2 overflow-y-auto pr-1">
                  {panelItems[activePanel].map((item, index) => (
                    <div className="grid gap-2 rounded-md border bg-card p-2 sm:grid-cols-[1fr_auto]" key={`${activePanel}-${index}`}>
                      <label className="relative">
                        <Pencil className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-9 pr-10"
                          onChange={(event) => updateActiveItem(index, event.target.value)}
                          value={item}
                        />
                        <button
                          aria-label={`Simpan ${item}`}
                          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted-foreground"
                          disabled={!item.trim()}
                          onClick={() =>
                            void saveActiveItem(
                              index,
                              activePanel === "unit"
                                ? originalUnits[index] ?? item
                                : activePanel === "category"
                                  ? originalCategories[index] ?? item
                                  : originalFinanceNonStockSubcategories[index] ?? item,
                              item,
                            )
                          }
                          type="button"
                        >
                          <Save className="size-4" />
                        </button>
                      </label>
                      <Button
                        aria-label={`Hapus ${item}`}
                        onClick={() => void removeActiveItem(index)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  {!panelItems[activePanel].length && <EmptyState message="Belum ada data untuk panel ini." />}
                </div>
              </>
            ) : activePanel === "finance_transactions" ? (
              <div className="mt-4 grid gap-3">
                {financeTransactions.slice(0, 30).map((item) => {
                  const draft = financeEditRows[item.id];
                  const quantity = Number(draft?.quantity ?? item.quantity);
                  const unitPrice = Number(String(draft?.unitPrice ?? item.unitPrice).replace(/[^\d.-]/g, ""));
                  const total = Number.isFinite(quantity * unitPrice) ? Math.round(quantity * unitPrice) : item.totalAmount;
                  const stockLocked = item.category === "keperluan_stock" && !!item.ingredientId;
                  return (
                    <div className="grid gap-3 rounded-md border bg-card p-3" key={item.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.itemName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.type} • {item.subcategory} • {formatRupiah(item.totalAmount)}
                          </p>
                        </div>
                        <Badge variant={item.type === "pendapatan" ? "success" : "warning"}>{item.fundMethod}</Badge>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[130px_120px_minmax(0,1fr)_110px_140px]">
                        <Input onChange={(event) => updateFinanceEditRow(item.id, { transactionDate: event.target.value })} type="date" value={draft?.transactionDate ?? new Date(item.transactionDate).toISOString().slice(0, 10)} />
                        <Select onChange={(event) => updateFinanceEditRow(item.id, { fundMethod: event.target.value as FinanceFundMethod })} value={draft?.fundMethod ?? item.fundMethod}>
                          <option value="cash">Cash</option>
                          <option value="bank">Bank</option>
                        </Select>
                        <Input disabled={stockLocked} onChange={(event) => updateFinanceEditRow(item.id, { itemName: event.target.value })} placeholder="Nama/keterangan" value={draft?.itemName ?? item.itemName} />
                        <Input min="0.001" onChange={(event) => updateFinanceEditRow(item.id, { quantity: event.target.value })} step="0.001" type="number" value={draft?.quantity ?? String(Number(item.quantity))} />
                        <Input inputMode="numeric" onChange={(event) => updateFinanceEditRow(item.id, { unitPrice: event.target.value })} placeholder="Rp 0" value={draft?.unitPrice ?? String(item.unitPrice)} />
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                        <Input onChange={(event) => updateFinanceEditRow(item.id, { note: event.target.value })} placeholder="Catatan" value={draft?.note ?? item.note ?? ""} />
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-sm font-semibold">{formatRupiah(total)}</span>
                          <Button disabled={savingFinanceId === item.id || total <= 0} onClick={() => void saveFinanceEdit(item)} type="button">
                            {savingFinanceId === item.id ? <Loader2 className="animate-spin" /> : <Save />}
                            Simpan
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!financeTransactions.length && <EmptyState message="Belum ada data finance untuk diedit." />}
              </div>
            ) : activePanel === "employees" ? (
              <div className="mt-4 grid gap-3">
                {temporaryPassword && (
                  <div className="rounded-md border border-primary/40 bg-primary/10 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Password sementara: {temporaryPassword.employeeName}</p>
                        <p className="mt-1 font-mono text-base font-bold tracking-normal text-primary">{temporaryPassword.password}</p>
                      </div>
                      <Button onClick={() => void copyTemporaryPassword()} type="button" variant="outline">
                        <KeyRound />
                        Salin
                      </Button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Password ini hanya ditampilkan sekali. Karyawan akan dipaksa mengganti password setelah login.
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  {employees.map((employee) => (
                    <div className="grid gap-3 rounded-md border bg-card p-3 lg:grid-cols-[1fr_170px_auto]" key={employee.id}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{employee.name}</p>
                          <Badge variant="secondary">{employee.role}</Badge>
                          {employee.mustChangePassword && <Badge variant="warning">Wajib ganti password</Badge>}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{employee.email}</p>
                      </div>
                      <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                        Akses
                        <Select
                          disabled={updatingRoleEmployeeId === employee.id || resettingEmployeeId === employee.id}
                          onChange={(event) => void updateEmployeeRole(employee, event.target.value as Exclude<Role, "Owner">)}
                          value={employee.role}
                        >
                          {staffRoles.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <Button
                        disabled={resettingEmployeeId === employee.id || updatingRoleEmployeeId === employee.id}
                        onClick={() => void resetEmployeePassword(employee)}
                        type="button"
                        variant="outline"
                      >
                        {resettingEmployeeId === employee.id ? <Loader2 className="animate-spin" /> : <KeyRound />}
                        Reset Password
                      </Button>
                    </div>
                  ))}
                  {!employees.length && <EmptyState message="Belum ada akun karyawan." />}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <datalist id="settings-category-list">
                  {categoryDrafts.map((item) => <option key={item} value={item} />)}
                </datalist>
                <datalist id="settings-unit-list">
                  {units.map((item) => <option key={item} value={item} />)}
                </datalist>
                <datalist id="settings-product-list">
                  {inventory.map((item) => <option key={item.id} value={item.name} />)}
                </datalist>
                <datalist id="settings-ingredient-list">
                  {availableBomIngredients.map((item) => <option key={item.id} value={item.name} />)}
                </datalist>

                {activePanel === "product" ? (
                  <div className="grid gap-4">
                    <div className="rounded-md border bg-card p-3">
                      <p className="text-sm font-semibold">Tambah product baru</p>
                      <div className="mt-3 grid gap-3">
                        <label className="grid gap-1.5 text-sm font-semibold">
                          Nama produk
                          <Input onChange={(event) => updateProductDraft({ name: event.target.value })} placeholder="Contoh: Cabai rawit merah" value={productDraft.name} />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Kategori
                            <Input list="settings-category-list" onChange={(event) => updateProductDraft({ category: event.target.value })} placeholder="Ketik/pilih kategori" value={productDraft.category} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Satuan ukuran
                            <Input list="settings-unit-list" onChange={(event) => updateProductDraft({ unit: event.target.value })} placeholder="Ketik/pilih unit" value={productDraft.unit} />
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Stock
                            <Input min="0" onChange={(event) => updateProductDraft({ stock: event.target.value })} placeholder="0" step="0.001" type="number" value={productDraft.stock} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Minim stock
                            <Input min="0" onChange={(event) => updateProductDraft({ minimumStock: event.target.value })} placeholder="0" step="0.001" type="number" value={productDraft.minimumStock} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Harga
                            <Input inputMode="numeric" onChange={(event) => updateProductDraft({ averagePrice: event.target.value })} placeholder="Rp 0" value={productDraft.averagePrice} />
                          </label>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button onClick={() => void handleCreateProduct()} type="button">
                            <Plus />
                            Simpan Product
                          </Button>
                          <Button onClick={resetProductDraft} type="button" variant="outline">
                            Bersihkan
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border bg-card p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">Edit product existing</p>
                          <p className="text-xs text-muted-foreground">Autocomplete nama bahan, maksimal 20 baris edit.</p>
                        </div>
                        <Button disabled={productEditRows.length >= 20} onClick={addProductEditRow} size="sm" type="button" variant="outline">
                          <Plus />
                          Tambah Edit
                        </Button>
                      </div>

                      <div className="mt-3 grid max-h-[620px] gap-3 overflow-y-auto pr-1">
                        {productEditRows.map((row, index) => (
                          <div className="rounded-md border bg-muted/25 p-3" key={row.key}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <Badge variant={row.ingredientId ? "success" : "secondary"}>Edit {index + 1}</Badge>
                              <Button aria-label="Hapus baris edit" onClick={() => removeProductEditRow(row.key)} size="icon" type="button" variant="outline">
                                <Trash2 />
                              </Button>
                            </div>
                            <div className="grid gap-3">
                              <label className="grid gap-1.5 text-sm font-semibold">
                                Product existing
                                <Input
                                  list="settings-product-list"
                                  onChange={(event) => selectProductEditRow(row.key, event.target.value)}
                                  placeholder="Ketik nama bahan"
                                  value={row.query}
                                />
                              </label>
                              <label className="grid gap-1.5 text-sm font-semibold">
                                Nama produk
                                <Input onChange={(event) => updateProductEditRow(row.key, { name: event.target.value })} placeholder="Nama bahan di database" value={row.name} />
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1.5 text-sm font-semibold">
                                  Kategori
                                  <Input list="settings-category-list" onChange={(event) => updateProductEditRow(row.key, { category: event.target.value })} placeholder="Ketik/pilih kategori" value={row.category} />
                                </label>
                                <label className="grid gap-1.5 text-sm font-semibold">
                                  Satuan ukuran
                                  <Input list="settings-unit-list" onChange={(event) => updateProductEditRow(row.key, { unit: event.target.value })} placeholder="Ketik/pilih unit" value={row.unit} />
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <label className="grid gap-1.5 text-sm font-semibold">
                                  Stock
                                  <Input min="0" onChange={(event) => updateProductEditRow(row.key, { stock: event.target.value })} placeholder="0" step="0.001" type="number" value={row.stock} />
                                </label>
                                <label className="grid gap-1.5 text-sm font-semibold">
                                  Minim stock
                                  <Input min="0" onChange={(event) => updateProductEditRow(row.key, { minimumStock: event.target.value })} placeholder="0" step="0.001" type="number" value={row.minimumStock} />
                                </label>
                                <label className="grid gap-1.5 text-sm font-semibold">
                                  Harga
                                  <Input inputMode="numeric" onChange={(event) => updateProductEditRow(row.key, { averagePrice: event.target.value })} placeholder="Rp 0" value={row.averagePrice} />
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button className="mt-3 w-full sm:w-auto" onClick={() => void handleSaveProductEdits()} type="button">
                        <Save />
                        Simpan Edit Product
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border bg-card p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm font-semibold">{bomDraft.id ? "Edit BOM" : "Input BOM baru"}</p>
                        <Badge variant="secondary">Harga batch: {formatRupiah(bomTotalCost)}</Badge>
                      </div>

                      <div className="mt-3 grid gap-3">
                        <label className="grid gap-1.5 text-sm font-semibold">
                          Nama barang BOM
                          <Input onChange={(event) => updateBomDraft({ name: event.target.value })} placeholder="Contoh: Bumbu Soto" value={bomDraft.name} />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Kategori
                            <Select onChange={(event) => updateBomDraft({ category: event.target.value })} value={bomDraft.category}>
                              {bomCategoryOptions.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Hasil
                            <Input min="0.001" onChange={(event) => updateBomDraft({ yieldQuantity: event.target.value })} placeholder="20 atau 0.001" step="0.001" type="number" value={bomDraft.yieldQuantity} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Satuan hasil
                            <Input list="settings-unit-list" onChange={(event) => updateBomDraft({ unit: event.target.value })} placeholder="Pax" value={bomDraft.unit} />
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Minimum stock BOM
                            <Input min="0" onChange={(event) => updateBomDraft({ minimumStock: event.target.value })} placeholder="0" step="0.001" type="number" value={bomDraft.minimumStock} />
                          </label>
                          <div className="grid content-end">
                            <Badge className="h-10 justify-center" variant="secondary">
                              {formatRupiah(bomTotalCost)} / batch
                            </Badge>
                          </div>
                        </div>

                        <div className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">Komposisi bahan BOM</p>
                            <Button onClick={addBomItem} size="sm" type="button" variant="outline">
                              <Plus />
                              Tambah Bahan
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-2">
                            {bomDraft.items.map((item, index) => (
                              <div className="grid gap-2 rounded-md border bg-card p-2 sm:grid-cols-[1fr_120px_150px_40px]" key={item.key}>
                                <Select onChange={(event) => updateBomItem(item.key, { ingredientId: event.target.value })} value={item.ingredientId}>
                                  <option value="">Bahan {index + 1}</option>
                                  {availableBomIngredients.map((ingredient) => (
                                    <option key={ingredient.id} value={ingredient.id}>
                                      {ingredient.name} ({ingredient.stock} {ingredient.unit})
                                    </option>
                                  ))}
                                </Select>
                                <Input min="0.001" onChange={(event) => updateBomItem(item.key, { quantity: event.target.value })} placeholder="0.001" step="0.001" type="number" value={item.quantity} />
                                <Input disabled placeholder="Nominal" value={item.totalCost ? formatRupiah(Number(item.totalCost)) : ""} />
                                <Button aria-label="Hapus bahan BOM" onClick={() => removeBomItem(item.key)} size="icon" type="button" variant="outline">
                                  <Trash2 />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button onClick={() => void saveBomDraft()} type="button">
                            <Save />
                            Simpan BOM
                          </Button>
                          <Button onClick={() => setBomDraft(emptyBomDraft())} type="button" variant="outline">
                            Bersihkan Form
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border bg-card p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Daftar BOM aktif</p>
                        <Badge variant="secondary">{bomRecipes.length} BOM</Badge>
                      </div>

                      <div className="mt-3 grid gap-2">
                        {bomRecipes.map((recipe) => (
                          <div className="rounded-md border bg-muted/25 p-3" key={recipe.id}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold">{recipe.name}</p>
                                <Badge variant="success">{recipe.yieldQuantity} {recipe.yieldUnit}</Badge>
                                <Badge variant="secondary">Batch {formatRupiah(recipe.totalCost)}</Badge>
                                </div>
                              </div>
                              <Button onClick={() => editBomRecipe(recipe)} size="sm" type="button" variant="outline">
                                <Pencil />
                                Edit
                              </Button>
                            </div>
                          </div>
                        ))}
                        {!bomRecipes.length && <EmptyState message="Belum ada BOM yang tersimpan." />}
                      </div>
                    </div>
                  </div>
                )}

                {settingsMessage && <p className="rounded-md border bg-card p-3 text-xs font-semibold text-muted-foreground">{settingsMessage}</p>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid min-h-32 place-items-center p-6 text-center text-sm text-muted-foreground">
      <div>
        <Database className="mx-auto mb-2 size-6" />
        <p>{message}</p>
      </div>
    </div>
  );
}

function InputHubPage({
  financeTransactions,
  inventory,
  onFinanceSubmit,
  onSubmitBom,
  onSelectedIngredient,
  onStockSubmit,
  role,
  submittingBom,
  submittingStockMode,
  transactions,
}: {
  financeTransactions: FinanceTransactionRow[];
  inventory: Ingredient[];
  onFinanceSubmit: (payload: {
    attachmentName?: string;
    category: FinanceCategory;
    fundMethod: FinanceFundMethod;
    ingredientId?: string;
    items?: Array<{ ingredientId?: string; itemName?: string; quantity: number; unitPrice: number }>;
    itemName?: string;
    note?: string;
    quantity?: number;
    subcategory?: string;
    transactionDate: string;
    type: FinanceTransactionType;
    unitPrice?: number;
  }) => Promise<boolean>;
  onSubmitBom: (payload: { bomId: string; productionCount: number; transactionDate: string }) => Promise<boolean>;
  onSelectedIngredient: (id: string) => void;
  onStockSubmit: (formData: FormData, mode: StockMode) => Promise<boolean>;
  role: Role;
  submittingBom: boolean;
  submittingStockMode: StockMode | null;
  transactions: TransactionRow[];
}) {
  const [activeInput, setActiveInput] = useState<"stock" | "finance">("finance");
  const [stockMode, setStockMode] = useState<StockMode>("masuk");

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {([
          { id: "finance", label: "Input Finance" },
          { id: "stock", label: "Input Stock" },
        ] as const).map((item) => (
          <button
            className={cn(
              "h-10 rounded-md text-xs font-bold text-muted-foreground transition",
              activeInput === item.id && "bg-card text-primary shadow-sm",
            )}
            key={item.id}
            onClick={() => setActiveInput(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeInput === "finance" ? (
        <FinanceInputPage financeTransactions={financeTransactions} inventory={inventory} onSubmit={onFinanceSubmit} role={role} />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {([
              { id: "masuk", label: "Stock Masuk" },
              { id: "keluar", label: "Stock Keluar" },
            ] as const).map((item) => (
              <button
                className={cn(
                  "h-10 rounded-md text-xs font-bold text-muted-foreground transition",
                  stockMode === item.id && "bg-card text-primary shadow-sm",
                )}
                key={item.id}
                onClick={() => setStockMode(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <StockInputPage
            inventory={inventory}
            mode={stockMode}
            onSelectedIngredient={onSelectedIngredient}
            onSubmit={(formData) => onStockSubmit(formData, stockMode)}
            onSubmitBom={onSubmitBom}
            role={role}
            submitting={submittingStockMode === stockMode}
            submittingBom={submittingBom}
            transactions={transactions}
          />
        </div>
      )}
    </div>
  );
}

function FinanceInputPage({
  financeTransactions,
  inventory,
  onSubmit,
  role,
}: {
  financeTransactions: FinanceTransactionRow[];
  inventory: Ingredient[];
  onSubmit: (payload: {
    attachmentName?: string;
    category: FinanceCategory;
    fundMethod: FinanceFundMethod;
    ingredientId?: string;
    items?: Array<{ ingredientId?: string; itemName?: string; quantity: number; unitPrice: number }>;
    itemName?: string;
    note?: string;
    quantity?: number;
    subcategory?: string;
    transactionDate: string;
    type: FinanceTransactionType;
    unitPrice?: number;
  }) => Promise<boolean>;
  role: Role;
}) {
  type FinanceExpenseRow = { key: string; ingredientId: string; itemName: string; query: string; quantity: string; unitPrice: string };
  const createExpenseRow = (suffix: string): FinanceExpenseRow => ({
    ingredientId: "",
    itemName: "",
    key: `finance-row-${suffix}`,
    query: "",
    quantity: "1",
    unitPrice: "",
  });
  const [activeForm, setActiveForm] = useState<FinanceTransactionType>("pengeluaran");
  const [fundMethod, setFundMethod] = useState<FinanceFundMethod>("cash");
  const [category, setCategory] = useState<FinanceCategory>("keperluan_stock");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [expenseRows, setExpenseRows] = useState<FinanceExpenseRow[]>(() => [createExpenseRow("1")]);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [scanMessage, setScanMessage] = useState("");
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ingredientById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const ingredientByName = useMemo(() => new Map(inventory.map((item) => [item.name.toLowerCase(), item])), [inventory]);
  const recentFinanceRows = financeTransactions.slice(0, 6);
  const isStockExpense = activeForm === "pengeluaran" && category === "keperluan_stock";
  const financeIngredientListId = "finance-ingredient-list";
  const parsedExpenseRows = expenseRows.map((row) => ({
    ingredient: ingredientById.get(row.ingredientId),
    itemName: row.itemName.trim(),
    quantity: Number(row.quantity),
    unitPrice: Number(String(row.unitPrice).replace(/[^\d.-]/g, "")),
  }));
  const totalAmount =
    activeForm === "pendapatan"
      ? Number(String(incomeAmount).replace(/[^\d.-]/g, "")) || 0
      : parsedExpenseRows.reduce((sum, row) => {
          if (!Number.isFinite(row.quantity) || !Number.isFinite(row.unitPrice)) return sum;
          return sum + Math.round(row.quantity * row.unitPrice);
        }, 0);

  useEffect(() => {
    if (activeForm === "pendapatan") {
      setCategory("non_keperluan_stock");
    }
  }, [activeForm]);

  const stockItemsForCategory = inventory;

  function handleExpenseIngredientQuery(key: string, query: string) {
    const ingredient = ingredientByName.get(query.trim().toLowerCase());
    updateExpenseRow(key, {
      ingredientId: ingredient?.id ?? "",
      query,
      unitPrice: ingredient ? String(ingredient.price) : "",
    });
  }

  function updateExpenseRow(key: string, patch: Partial<FinanceExpenseRow>) {
    setExpenseRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addExpenseRow() {
    setExpenseRows((current) => (current.length >= 20 ? current : [...current, createExpenseRow(`${Date.now()}-${current.length}`)]));
  }

  function removeExpenseRow(key: string) {
    setExpenseRows((current) => (current.length === 1 ? [createExpenseRow(`${Date.now()}`)] : current.filter((row) => row.key !== key)));
  }

  async function scanReceiptPhoto() {
    if (!attachmentFile || scanningReceipt) return;
    setScanningReceipt(true);
    setScanMessage("");
    try {
      const formData = new FormData();
      formData.set("image", attachmentFile);
      formData.set("category", category);
      const result = await apiJson<{
        items: Array<{ itemName: string; quantity: number; unitPrice: number; ingredientId?: string }>;
        note?: string;
      }>("/api/finance/scan-receipt", {
        method: "POST",
        body: formData,
      });
      if (!result.items.length) {
        setScanMessage("AI belum menemukan item yang bisa dipakai. Input manual tetap tersedia.");
        return;
      }
      setExpenseRows(
        result.items.slice(0, 20).map((item, index) => {
          const ingredient = item.ingredientId ? ingredientById.get(item.ingredientId) : ingredientByName.get(item.itemName.toLowerCase());
          return {
            ingredientId: isStockExpense ? ingredient?.id ?? "" : "",
            itemName: isStockExpense ? "" : item.itemName,
            key: `finance-scan-${Date.now()}-${index}`,
            query: isStockExpense ? ingredient?.name ?? item.itemName : "",
            quantity: String(item.quantity || 1),
            unitPrice: String(Math.round(item.unitPrice || 0)),
          };
        }),
      );
      if (result.note) setNote((current) => current || result.note || "");
      setScanMessage(`${result.items.length} item terbaca. Tetap cek ulang sebelum simpan.`);
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : "Scan foto gagal");
    } finally {
      setScanningReceipt(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const payloadItems: Array<{ ingredientId?: string; itemName?: string; quantity: number; unitPrice: number }> =
      activeForm === "pendapatan"
        ? [{ itemName: "Pendapatan", quantity: 1, unitPrice: Math.round(totalAmount) }]
        : parsedExpenseRows.map((row) => ({
            ingredientId: isStockExpense ? row.ingredient?.id : undefined,
            itemName: isStockExpense ? row.ingredient?.name : row.itemName,
            quantity: row.quantity,
            unitPrice: Math.round(row.unitPrice),
          }));
    const hasInvalidExpense = payloadItems.some((item) => {
      const invalidAmount = !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0;
      const invalidName = activeForm === "pengeluaran" && !isStockExpense && !item.itemName?.trim();
      const invalidIngredient = activeForm === "pengeluaran" && isStockExpense && !item.ingredientId;
      return invalidAmount || invalidName || invalidIngredient;
    });
    if (totalAmount <= 0 || hasInvalidExpense) return;

    setSubmitting(true);
    const success = await onSubmit({
      attachmentName: activeForm === "pengeluaran" ? attachmentName || undefined : undefined,
      category,
      fundMethod,
      items: payloadItems,
      note: note || undefined,
      subcategory: activeForm === "pendapatan" ? "Pendapatan" : undefined,
      transactionDate,
      type: activeForm,
    });
    setSubmitting(false);

    if (success) {
      setExpenseRows([createExpenseRow(`${Date.now()}`)]);
      setIncomeAmount("");
      setNote("");
      setAttachmentName("");
      setAttachmentFile(null);
      setScanMessage("");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {([
            { id: "pendapatan", label: "Input Pendapatan" },
            { id: "pengeluaran", label: "Input Pengeluaran" },
          ] as const).map((item) => (
            <button
              className={cn(
                "h-10 rounded-md text-xs font-bold text-muted-foreground transition",
                activeForm === item.id && "bg-card text-primary shadow-sm",
              )}
              key={item.id}
              onClick={() => setActiveForm(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      <Card className="bg-card/95">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Finance</p>
              <CardTitle className="mt-1 text-lg">Input Pendapatan & Pengeluaran</CardTitle>
            </div>
            <Badge variant={role === "Owner" ? "success" : "secondary"}>{role}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid min-w-0 gap-4" onSubmit={handleSubmit}>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold">
                <span className="sr-only">Tanggal transaksi</span>
                <Input disabled={submitting} onChange={(event) => setTransactionDate(event.target.value)} type="date" value={transactionDate} />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                <span className="sr-only">Metode dana</span>
                <Select disabled={submitting} onChange={(event) => setFundMethod(event.target.value as FinanceFundMethod)} value={fundMethod}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </Select>
              </label>
            </div>

            {activeForm === "pendapatan" ? (
              <label className="grid gap-1.5 text-sm font-semibold">
                <span className="sr-only">Nominal Rupiah</span>
                <Input disabled={submitting} inputMode="numeric" onChange={(event) => setIncomeAmount(event.target.value)} placeholder="Rp 0" value={incomeAmount} />
              </label>
            ) : (
              <>
                <div className="grid min-w-0 gap-3">
                  <label className="grid gap-1.5 text-sm font-semibold">
                    <span className="sr-only">Kategori</span>
                    <Select disabled={submitting} onChange={(event) => setCategory(event.target.value as FinanceCategory)} value={category}>
                      <option value="keperluan_stock">Keperluan Stock</option>
                      <option value="non_keperluan_stock">Non Keperluan Stock</option>
                    </Select>
                  </label>
                </div>

                <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <label className="grid gap-1.5 text-sm font-semibold">
                    <span className="sr-only">Bukti foto opsional</span>
                    <Input
                      disabled={submitting || scanningReceipt}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setAttachmentFile(file);
                        setAttachmentName(file?.name ?? "");
                        setScanMessage("");
                      }}
                      type="file"
                      accept="image/*"
                    />
                  </label>
                  <Button disabled={!attachmentFile || submitting || scanningReceipt} onClick={() => void scanReceiptPhoto()} type="button" variant="outline">
                    {scanningReceipt ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {scanningReceipt ? "Membaca..." : "Scan AI"}
                  </Button>
                  {(attachmentName || scanMessage) && (
                    <p className="text-xs font-medium text-muted-foreground sm:col-span-2">
                      {scanMessage || attachmentName}
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="sr-only">Detail Pengeluaran</span>
                    <Button disabled={submitting || expenseRows.length >= 20} onClick={addExpenseRow} size="sm" type="button" variant="outline">
                      <Plus />
                      Tambah Barang
                    </Button>
                  </div>
                  {expenseRows.map((row, index) => {
                    const rowIngredient = ingredientById.get(row.ingredientId);
                    const rowQty = Number(row.quantity);
                    const rowPrice = Number(String(row.unitPrice).replace(/[^\d.-]/g, ""));
                    const rowTotal = Number.isFinite(rowQty) && Number.isFinite(rowPrice) ? Math.round(rowQty * rowPrice) : 0;
                    return (
                      <div className="grid min-w-0 gap-3 rounded-md border bg-muted/25 p-3" key={row.key}>
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="secondary">Barang {index + 1}</Badge>
                          <Button aria-label="Hapus barang" disabled={submitting || expenseRows.length === 1} onClick={() => removeExpenseRow(row.key)} size="icon" type="button" variant="outline">
                            <Trash2 />
                          </Button>
                        </div>
                        <datalist id={financeIngredientListId}>
                          {stockItemsForCategory.map((item) => (
                            <option key={item.id} label={`${item.stock} ${item.unit} tersedia`} value={item.name} />
                          ))}
                        </datalist>
                        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_110px_150px_100px_140px]">
                          <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
                            <span className="sr-only">Nama barang/keterangan</span>
                            {isStockExpense ? (
                              <>
                                <Input
                                  autoComplete="off"
                                  disabled={submitting}
                                  list={financeIngredientListId}
                                  onChange={(event) => handleExpenseIngredientQuery(row.key, event.target.value)}
                                  placeholder="Ketik nama bahan"
                                  value={row.query}
                                />
                                <span className={cn("truncate text-[11px] font-medium", rowIngredient ? "text-muted-foreground" : "text-destructive")}>
                                  {rowIngredient ? `${rowIngredient.stock} ${rowIngredient.unit}` : "Pilih dari autocomplete"}
                                </span>
                              </>
                            ) : (
                              <Input disabled={submitting} onChange={(event) => updateExpenseRow(row.key, { itemName: event.target.value })} placeholder="Contoh: Tagihan listrik Mei" value={row.itemName} />
                            )}
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            <span className="sr-only">Jumlah barang</span>
                            <Input disabled={submitting} min="0.001" onChange={(event) => updateExpenseRow(row.key, { quantity: event.target.value })} placeholder="0.001" step="0.001" type="number" value={row.quantity} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            <span className="sr-only">Nominal Rupiah</span>
                            <Input disabled={submitting} inputMode="numeric" onChange={(event) => updateExpenseRow(row.key, { unitPrice: event.target.value })} placeholder="Rp 0" value={row.unitPrice} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            <span className="sr-only">Satuan</span>
                            <Input disabled value={isStockExpense ? rowIngredient?.unit ?? "-" : "item"} />
                          </label>
                          <div className="grid content-end">
                            <div className="rounded-md border bg-card px-3 py-2">
                              <p className="text-[11px] text-muted-foreground">Jumlah</p>
                              <p className="font-mono text-sm font-bold">{formatRupiah(rowTotal)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="rounded-md border bg-muted/35 p-4">
              <p className="text-xs text-muted-foreground">Jumlah otomatis</p>
              <p className="mt-1 font-mono text-2xl font-bold">{formatRupiah(totalAmount)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold">
                Deskripsi/catatan
                <Input disabled={submitting} onChange={(event) => setNote(event.target.value)} placeholder="Catatan transaksi" value={note} />
              </label>
            </div>

            <Button disabled={submitting || totalAmount <= 0} type="submit">
              <Save />
              Simpan Finance
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>

      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Finance log</p>
          <CardTitle className="mt-1 text-lg">Transaksi Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {recentFinanceRows.map((item) => (
            <div className="rounded-md border bg-muted/35 p-3" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{item.itemName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(item.transactionDate).toLocaleString("id-ID")}</p>
                </div>
                <Badge variant={item.type === "pendapatan" ? "success" : "warning"}>{item.fundMethod}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{item.operatorName}</span>
                <span className="font-mono font-semibold">{formatRupiah(item.totalAmount)}</span>
              </div>
            </div>
          ))}
          {!recentFinanceRows.length && <EmptyState message="Belum ada transaksi finance." />}
        </CardContent>
      </Card>
    </div>
  );
}

function ToastView({ toast }: { toast: NonNullable<Toast> }) {
  return (
    <div
      className={cn(
        "fixed bottom-5 right-5 z-50 rounded-md px-4 py-3 text-sm font-bold text-white shadow-lg",
        toast.tone === "success" && "bg-success",
        toast.tone === "warning" && "bg-warning",
        toast.tone === "default" && "bg-foreground",
      )}
    >
      {toast.message}
    </div>
  );
}
