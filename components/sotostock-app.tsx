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
  Sun,
  Tags,
  Trash2,
  UserRound,
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
type DashboardRangePreset = "today" | "yesterday" | "7d" | "this-month" | "last-month" | "custom";
type NavItem = (typeof navItems)[number];
type StockInputMode = "regular" | "bom";

type ApiEnvelope<T> = { data: T };
type ApiError = { error?: { message?: string } };
type IngredientMasterOptions = { units: string[]; categories: string[] };

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

type StockHistoryState = {
  item: Ingredient;
  rows: TransactionRow[];
  loading: boolean;
} | null;

type PricePredictionRow = {
  id: string;
  itemName: string;
  currentPrice: number;
  predictedPrice: number;
  changePercent: string;
  risk: "Rendah" | "Sedang" | "Tinggi";
  sourceName: string;
  sourceUrl: string;
  summary: string;
  publishedAt: string | null;
};

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role?: Role;
};

const publicSignupRoles: Exclude<Role, "Owner">[] = ["Kasir", "Cheef", "Waiters"];
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

const pageCopy: Record<PageId, { tag: string; title: string; sub: string }> = {
  dashboard: {
    tag: "Owner View",
    title: "Dashboard Evaluasi",
    sub: "Data langsung dari API stok, transaksi, dan prediksi harga",
  },
  stok: {
    tag: "Stok",
    title: "Stock",
    sub: "Pantau status minimum, nilai stok, dan prioritas restock",
  },
  opname: {
    tag: "Opname",
    title: "Opname",
    sub: "Data aktual lapangan untuk audit stok akhir bulan",
  },
  "stok-masuk": {
    tag: "Input",
    title: "Stok Masuk",
    sub: "Catat penerimaan bahan masuk ke stok",
  },
  "stok-keluar": {
    tag: "Input",
    title: "Stok Keluar",
    sub: "Catat pemakaian bahan keluar dari stok",
  },
  ai: {
    tag: "Harga Pangan",
    title: "Prediksi Kenaikan Harga",
    sub: "Prediksi harga yang tersimpan di API",
  },
  laporan: {
    tag: "Laporan",
    title: "Laporan & Audit Trail",
    sub: "Ringkasan transaksi dan ekspor data operasional",
  },
  supplier: {
    tag: "Supplier",
    title: "Manajemen Supplier",
    sub: "Ruang data supplier untuk integrasi berikutnya",
  },
  bahan: {
    tag: "Master Data",
    title: "Master Bahan Baku",
    sub: "Dataset bahan aktif dari tabel ingredients",
  },
  pengaturan: {
    tag: "Pengaturan",
    title: "Pengaturan Data",
    sub: "Kelola preferensi frontend dan master bahan",
  },
};

function allowedNav(role: Role) {
  if (role === "Owner") return navItems;
  if (role === "Cheef") return navItems.filter((item) => ["stok-masuk", "stok-keluar", "opname", "pengaturan"].includes(item.id));
  return navItems.filter((item) => ["stok-masuk", "stok-keluar", "opname"].includes(item.id));
}

function defaultPage(role: Role): PageId {
  return role === "Owner" ? "dashboard" : "stok-masuk";
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

function includesFilterValue(value: string | number, filter: string, extra: Array<string | number> = []) {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) return true;
  const haystack = [value, ...extra]
    .map((entry) => String(entry ?? "").toLowerCase())
    .join(" ");
  return haystack.includes(normalizedFilter);
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
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
  const [predictions, setPredictions] = useState<PricePredictionRow[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "Semua">("Semua");
  const [toast, setToast] = useState<Toast>(null);
  const [clock, setClock] = useState(() => new Date());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState("");
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
        const [transactionRows, predictionRows] = await Promise.all([
          apiJson<TransactionRow[]>("/api/transactions"),
          apiJson<PricePredictionRow[]>("/api/price-predictions"),
        ]);
        setTransactions(transactionRows);
        setPredictions(predictionRows);
      } else {
        setTransactions([]);
        setPredictions([]);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat data API", "warning");
    } finally {
      setLoadingData(false);
    }
  }, [isAuthenticated, role]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
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
    for (const transaction of transactions.filter((item) => item.type === "keluar")) {
      const ingredient = inventory.find((item) => item.id === transaction.ingredientId);
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

  async function handleOpnameSubmit() {
    const details = inventory.map((item) => ({
      ingredientId: item.id,
      systemStock: item.stock,
      cashierActual: actualInputs[item.id]?.Kasir ? Number(actualInputs[item.id].Kasir) : undefined,
      chefActual: actualInputs[item.id]?.Cheef ? Number(actualInputs[item.id].Cheef) : undefined,
      waitersActual: actualInputs[item.id]?.Waiters ? Number(actualInputs[item.id].Waiters) : undefined,
    }));

    try {
      await apiJson("/api/opname", {
        method: "POST",
        body: JSON.stringify({
          opnameDate: new Date().toISOString(),
          createdByName: user?.name ?? role,
          status: "submitted",
          details,
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
    setPredictions([]);
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
                onNavigate={navigate}
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
                search={search}
              />
            )}
            {activePage === "opname" && (
              <OpnamePage
                actualInputs={actualInputs}
                clock={clock}
                inventory={inventory}
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
            {activePage === "ai" && <AiPage predictions={predictions} />}
            {activePage === "laporan" && <ReportPage inventory={inventory} role={role} transactions={transactions} />}
            {activePage === "supplier" && <SupplierPage />}
            {activePage === "bahan" && <MasterDataPage categories={availableCategories} inventory={inventory} />}
            {activePage === "pengaturan" && (
              <SettingsPage
                categories={allCategories}
                email={user?.email ?? ""}
                inventory={inventory}
                name={user?.name ?? ""}
                onSaved={loadData}
                role={role}
              />
            )}
          </div>
        </main>
      </div>

      {layoutMode === "mobile" && <MobileBottomNav activePage={activePage} nav={nav} onNavigate={navigate} />}
      <OwnerAiBot activePage={activePage} role={role} />
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

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-md border bg-muted/70 p-1">
          {(["signin", "signup"] as AuthMode[]).map((item) => (
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
          { label: "Utama", ids: ["dashboard", "stok"] },
          { label: "Transaksi", ids: ["stok-masuk", "stok-keluar", "opname"] },
          { label: "Analitik", ids: ["ai", "laporan"] },
          { label: "Pengaturan", ids: ["pengaturan"] },
        ]
      : role === "Cheef"
        ? [
            { label: "Transaksi", ids: ["stok-masuk", "stok-keluar", "opname"] },
            { label: "Pengaturan", ids: ["pengaturan"] },
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
        {expanded && (
          <button
            aria-label={pinned ? "Lepas pin sidebar" : "Kunci sidebar"}
            className="grid size-9 place-items-center rounded-md text-[#F0EBE3]/65 transition duration-500 hover:bg-[#FAF7F2]/8 hover:text-[#FAF7F2]"
            onClick={() => setPinned((current) => !current)}
            type="button"
          >
            <Menu className="size-4" />
          </button>
        )}
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
  onNavigate,
}: {
  activePage: PageId;
  nav: readonly NavItem[];
  onNavigate: (page: PageId) => void;
}) {
  const primaryNav = nav.slice(0, 5);

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
  const roleLabel = role === "Owner" ? "OWNER VIEW" : `${role.toUpperCase()} VIEW`;

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
        <h1 className={cn("joyo-display truncate tracking-normal text-foreground", layoutMode === "desktop" ? "text-2xl" : "text-xl")}>
          {copy.title}
        </h1>
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
  inventory,
  onNavigate,
}: {
  lowStockItems: Ingredient[];
  metrics: { total: number; critical: number; stockValue: number; weekExpense: number; weekUsage: number };
  dailyExpenseBars: Array<{ label: string; value: number }>;
  usageBars: Array<{ label: string; value: number }>;
  transactions: TransactionRow[];
  inventory: Ingredient[];
  onNavigate: (page: PageId) => void;
}) {
  const todayKey = dateInputKey(new Date());
  const [stockRangePreset, setStockRangePreset] = useState<DashboardRangePreset>("7d");
  const [stockCustomStart, setStockCustomStart] = useState(dateInputKey(addDays(new Date(), -6)));
  const [stockCustomEnd, setStockCustomEnd] = useState(todayKey);
  const [flowRangePreset, setFlowRangePreset] = useState<DashboardRangePreset>("7d");
  const [flowCustomStart, setFlowCustomStart] = useState(dateInputKey(addDays(new Date(), -6)));
  const [flowCustomEnd, setFlowCustomEnd] = useState(todayKey);
  const [quantityRangePreset, setQuantityRangePreset] = useState<DashboardRangePreset>("7d");
  const [quantityCustomStart, setQuantityCustomStart] = useState(dateInputKey(addDays(new Date(), -6)));
  const [quantityCustomEnd, setQuantityCustomEnd] = useState(todayKey);
  const ingredientById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const recentTransactions = transactions.slice(0, 5);
  const stockRangeDays = useMemo(
    () => dashboardRangeFromPreset(stockRangePreset, stockCustomStart, stockCustomEnd),
    [stockCustomEnd, stockCustomStart, stockRangePreset],
  );
  const flowRangeDays = useMemo(
    () => dashboardRangeFromPreset(flowRangePreset, flowCustomStart, flowCustomEnd),
    [flowCustomEnd, flowCustomStart, flowRangePreset],
  );
  const quantityRangeDays = useMemo(
    () => dashboardRangeFromPreset(quantityRangePreset, quantityCustomStart, quantityCustomEnd),
    [quantityCustomEnd, quantityCustomStart, quantityRangePreset],
  );
  const stockValueSeries = useMemo(() => {
    const impacts = new Map(stockRangeDays.map((day) => [day.key, 0]));
    for (const transaction of transactions) {
      const key = dateInputKey(new Date(transaction.transactionDate));
      if (!impacts.has(key)) continue;
      const ingredient = ingredientById.get(transaction.ingredientId);
      const nominal =
        Number(transaction.quantity) *
        (transaction.type === "masuk" ? transaction.unitPrice ?? ingredient?.price ?? 0 : ingredient?.price ?? 0);
      impacts.set(key, (impacts.get(key) ?? 0) + (transaction.type === "masuk" ? nominal : -nominal));
    }
    const totalImpact = Array.from(impacts.values()).reduce((sum, value) => sum + value, 0);
    let running = Math.max(0, metrics.stockValue - totalImpact);
    return stockRangeDays.map((day) => {
      running = Math.max(0, running + (impacts.get(day.key) ?? 0));
      return { label: day.label, value: running };
    });
  }, [ingredientById, metrics.stockValue, stockRangeDays, transactions]);
  const flowSeries = useMemo(() => {
    const masuk = new Map(flowRangeDays.map((day) => [day.key, 0]));
    const keluar = new Map(flowRangeDays.map((day) => [day.key, 0]));
    for (const transaction of transactions) {
      const key = dateInputKey(new Date(transaction.transactionDate));
      if (!masuk.has(key)) continue;
      const ingredient = ingredientById.get(transaction.ingredientId);
      const nominal =
        Number(transaction.quantity) *
        (transaction.type === "masuk" ? transaction.unitPrice ?? ingredient?.price ?? 0 : ingredient?.price ?? 0);
      const target = transaction.type === "masuk" ? masuk : keluar;
      target.set(key, (target.get(key) ?? 0) + nominal);
    }
    return {
      labels: flowRangeDays.map((day) => day.label),
      masuk: flowRangeDays.map((day) => masuk.get(day.key) ?? 0),
      keluar: flowRangeDays.map((day) => keluar.get(day.key) ?? 0),
    };
  }, [flowRangeDays, ingredientById, transactions]);
  const quantitySeries = useMemo(() => {
    const masuk = new Map(quantityRangeDays.map((day) => [day.key, 0]));
    const keluar = new Map(quantityRangeDays.map((day) => [day.key, 0]));
    for (const transaction of transactions) {
      const key = dateInputKey(new Date(transaction.transactionDate));
      if (!masuk.has(key)) continue;
      const target = transaction.type === "masuk" ? masuk : keluar;
      target.set(key, (target.get(key) ?? 0) + Number(transaction.quantity));
    }
    return {
      labels: quantityRangeDays.map((day) => day.label),
      masuk: quantityRangeDays.map((day) => masuk.get(day.key) ?? 0),
      keluar: quantityRangeDays.map((day) => keluar.get(day.key) ?? 0),
    };
  }, [quantityRangeDays, transactions]);

  return (
    <div className="dashboard-shell space-y-5 rounded-lg border p-3 shadow-soft transition-colors duration-700 sm:p-4">
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
          title="Bahan Kritis"
          value={`${metrics.critical}`}
        />
        <SimpleMetric
          className="bg-card text-primary"
          detail="minggu ini"
          icon={LogOut}
          title="Pengeluaran"
          value={formatRupiah(metrics.weekExpense)}
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
        customEnd={stockCustomEnd}
        customStart={stockCustomStart}
        onCustomEndChange={setStockCustomEnd}
        onCustomStartChange={setStockCustomStart}
        onRangePresetChange={setStockRangePreset}
        rangePreset={stockRangePreset}
        series={stockValueSeries}
        title="Nominal Uang Semua Stock"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <MultiMoneyLineChart
          customEnd={quantityCustomEnd}
          customStart={quantityCustomStart}
          data={quantitySeries}
          formatter={formatCompactNumber}
          onCustomEndChange={setQuantityCustomEnd}
          onCustomStartChange={setQuantityCustomStart}
          onRangePresetChange={setQuantityRangePreset}
          rangePreset={quantityRangePreset}
          title="Stock Barang Masuk dan Keluar"
        />
        <MultiMoneyLineChart
          customEnd={flowCustomEnd}
          customStart={flowCustomStart}
          data={flowSeries}
          formatter={formatCompactRupiah}
          onCustomEndChange={setFlowCustomEnd}
          onCustomStartChange={setFlowCustomStart}
          onRangePresetChange={setFlowRangePreset}
          rangePreset={flowRangePreset}
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
            <Badge variant="secondary">{recentTransactions.length} item</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recentTransactions.length ? (
              recentTransactions.map((item) => {
                const ingredient = ingredientById.get(item.ingredientId);
                return (
                  <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border bg-muted/35 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{ingredient?.name ?? item.ingredientId}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.operatorName} / {transactionActivityDate(item).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={item.type === "keluar" ? "warning" : "success"}>{item.type}</Badge>
                      <p className="mt-1 font-mono text-xs font-bold">
                        {Number(item.quantity)} {ingredient?.unit ?? ""}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState message="Belum ada transaksi dari API." />
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
    return `${sign}${new Intl.NumberFormat("id-ID", { maximumFractionDigits: compact >= 10 ? 0 : 1 }).format(compact)}jt`;
  }

  if (absolute >= 1_000) {
    const compact = absolute / 1_000;
    return `${sign}${new Intl.NumberFormat("id-ID", { maximumFractionDigits: compact >= 10 ? 0 : 1 }).format(compact)}k`;
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
  { value: "custom", label: "Custom Range" },
];

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

function buildDashboardRangeDays(start: Date, end: Date) {
  const safeStart = start > end ? end : start;
  const safeEnd = start > end ? start : end;
  const totalDays = Math.min(
    90,
    Math.max(1, Math.round((safeEnd.getTime() - safeStart.getTime()) / 86_400_000) + 1),
  );

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(safeStart, index);
    return {
      key: dateInputKey(date),
      label: date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    };
  });
}

function dashboardRangeFromPreset(preset: DashboardRangePreset, customStart: string, customEnd: string) {
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

  const start = customStart ? new Date(customStart) : addDays(today, -6);
  const end = customEnd ? new Date(customEnd) : today;
  return buildDashboardRangeDays(start, end);
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
  const activeLabel = dashboardRangeOptions.find((item) => item.value === rangePreset)?.label ?? "7 hari terakhir";

  return (
    <details className="group relative">
      <summary
        aria-label={label}
        className="flex h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md border bg-muted/45 px-3 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/45 hover:bg-muted [&::-webkit-details-marker]:hidden"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <Calendar className="size-4 text-primary" />
          <span className="truncate">{activeLabel}</span>
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {rangePreset === "custom" ? `${chartDateLabel(customStart)} - ${chartDateLabel(customEnd)}` : chartDateLabel(customEnd)}
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

function MoneyLineChart({
  title,
  series,
  rangePreset,
  customStart,
  customEnd,
  onRangePresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: {
  title: string;
  series: Array<{ label: string; value: number }>;
  rangePreset: DashboardRangePreset;
  customStart: string;
  customEnd: string;
  onRangePresetChange: (value: DashboardRangePreset) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  const values = series.map((item) => item.value);
  const latest = values.at(-1) ?? 0;
  const width = 960;
  const height = 300;
  const padding = { bottom: 46, left: 92, right: 26, top: 26 };
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => ({
    value,
    x: padding.left + (index / Math.max(values.length - 1, 1)) * (width - padding.left - padding.right),
    y: height - padding.bottom - ((value - min) / range) * (height - padding.top - padding.bottom),
  }));
  const path = curvedPath(points);
  const baseline = height - padding.bottom;
  const areaPath = path ? `${path} L ${width - padding.right} ${baseline} L ${padding.left} ${baseline} Z` : "";
  const yTicks = [max, min + range / 2, min];
  const labelStep = Math.max(1, Math.ceil(series.length / 6));

  return (
    <Card className="bg-card/95 shadow-sm">
      <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Nilai inventori</p>
          <CardTitle className="mt-1 text-xl tracking-normal">{title}</CardTitle>
          <p className="mt-2 font-mono text-sm font-medium text-primary">{formatRupiah(latest)}</p>
        </div>
        <ChartRangePicker
          customEnd={customEnd}
          customStart={customStart}
          label="Filter periode nilai stok"
          onCustomEndChange={onCustomEndChange}
          onCustomStartChange={onCustomStartChange}
          onRangePresetChange={onRangePresetChange}
          rangePreset={rangePreset}
        />
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border bg-muted/30 p-3">
          <svg className="h-72 w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
            {areaPath && <path d={areaPath} fill="hsl(var(--primary) / 0.10)" />}
            {yTicks.map((tick) => {
              const y = height - padding.bottom - ((tick - min) / range) * (height - padding.top - padding.bottom);
              return (
                <g key={tick}>
                  <line stroke="hsl(var(--border) / 0.45)" strokeWidth="1" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                  <text className="fill-muted-foreground text-[12px] font-normal" textAnchor="start" x="8" y={y + 4}>
                    {formatCompactRupiah(tick)}
                  </text>
                </g>
              );
            })}
            {path && <path d={path} fill="none" stroke="hsl(var(--primary))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />}
            {points.map((point, index) => (
              <circle cx={point.x} cy={point.y} fill="hsl(var(--primary))" key={`${series[index]?.label}-${index}`} r="3.5" />
            ))}
            {series.map((item, index) => {
              if (index % labelStep !== 0 && index !== series.length - 1) return null;
              const x = padding.left + (index / Math.max(series.length - 1, 1)) * (width - padding.left - padding.right);
              return (
                <text className="fill-muted-foreground text-[12px] font-normal" key={item.label} textAnchor="middle" x={x} y={height - 12}>
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
  rangePreset,
  customStart,
  customEnd,
  onRangePresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: {
  title: string;
  data: { labels: string[]; masuk: number[]; keluar: number[] };
  formatter: (value: number) => string;
  rangePreset: DashboardRangePreset;
  customStart: string;
  customEnd: string;
  onRangePresetChange: (value: DashboardRangePreset) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  const allValues = [...data.masuk, ...data.keluar];
  const width = 620;
  const height = 250;
  const padding = { bottom: 44, left: 64, right: 22, top: 26 };
  const max = Math.max(1, ...allValues);
  const masukPoints = chartPoints(data.masuk, width, height, padding, max);
  const keluarPoints = chartPoints(data.keluar, width, height, padding, max);
  const masukPath = curvedPath(masukPoints);
  const keluarPath = curvedPath(keluarPoints);
  const labelStep = Math.max(1, Math.ceil(data.labels.length / 4));
  const yTicks = [max, max / 2, 0];

  return (
    <Card className="bg-card/95 shadow-sm">
      <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Multiple line</p>
          <CardTitle className="mt-1 text-base">{title}</CardTitle>
        </div>
        <ChartRangePicker
          customEnd={customEnd}
          customStart={customStart}
          label={`Filter periode ${title}`}
          onCustomEndChange={onCustomEndChange}
          onCustomStartChange={onCustomStartChange}
          onRangePresetChange={onRangePresetChange}
          rangePreset={rangePreset}
        />
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-muted/30 p-3">
          <svg className="h-56 w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
            {yTicks.map((tick) => {
              const y = height - padding.bottom - (tick / max) * (height - padding.top - padding.bottom);
              return (
                <g key={tick}>
                  <line stroke="hsl(var(--border) / 0.45)" strokeWidth="1" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                  <text className="fill-muted-foreground text-[10px] font-normal" textAnchor="end" x={padding.left - 8} y={y + 4}>
                    {formatter(tick)}
                  </text>
                </g>
              );
            })}
            <path d={masukPath} fill="none" stroke="hsl(var(--success))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            <path d={keluarPath} fill="none" stroke="hsl(var(--primary))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            {masukPoints.map((point, index) => (
              <circle cx={point.x} cy={point.y} fill="hsl(var(--success))" key={`masuk-dot-${data.labels[index]}-${index}`} r="3" />
            ))}
            {keluarPoints.map((point, index) => (
              <circle cx={point.x} cy={point.y} fill="hsl(var(--primary))" key={`keluar-dot-${data.labels[index]}-${index}`} r="3" />
            ))}
            {data.labels.map((label, index) => {
              if (index % labelStep !== 0 && index !== data.labels.length - 1) return null;
              const x = padding.left + (index / Math.max(data.labels.length - 1, 1)) * (width - padding.left - padding.right);
              return (
                <text className="fill-muted-foreground text-[10px] font-normal" key={`date-${label}-${index}`} textAnchor="middle" x={x} y={height - 10}>
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
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Database;
  className?: string;
}) {
  return (
    <div className={cn("list-item relative min-h-32 overflow-hidden rounded-lg border bg-card p-4 shadow-sm", className)}>
      <span className="absolute inset-y-4 left-0 w-0.5 bg-primary opacity-55" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] opacity-70">{title}</p>
        <Icon className="size-4 opacity-60" />
      </div>
      <p className="mt-4 font-mono text-2xl font-medium tracking-normal">{value}</p>
      <p className="mt-2 text-sm font-medium opacity-70">{detail}</p>
    </div>
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
}: {
  filteredInventory: Ingredient[];
  categories: Category[];
  search: string;
  category: Category | "Semua";
  onSearch: (value: string) => void;
  onCategory: (value: Category | "Semua") => void;
  onDetail: (item: Ingredient) => void;
}) {
  const [filters, setFilters] = useState({
    name: "",
    category: "",
    stock: "",
    minimum: "",
    status: "",
    value: "",
  });
  const stockRows = useMemo(
    () =>
      filteredInventory.filter((item) => {
        const status = stockStatus(item).label;
        const stockValue = item.stock * item.price;
        return (
          includesFilterValue(item.name, filters.name) &&
          includesFilterValue(item.category, filters.category) &&
          includesFilterValue(item.stock, filters.stock, [item.unit]) &&
          includesFilterValue(item.minimum, filters.minimum, [item.unit]) &&
          (!filters.status || status === filters.status) &&
          includesFilterValue(stockValue, filters.value, [formatRupiah(stockValue)])
        );
      }),
    [filteredInventory, filters],
  );

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
        <div className="mb-4 grid gap-2 md:hidden">
          <Input
            onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
            placeholder="Filter bahan"
            value={filters.name}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              placeholder="Filter kategori"
              value={filters.category}
            />
            <Select
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              value={filters.status}
            >
              <option value="">Semua status</option>
              {["Aman", "Rendah", "Kritis", "Habis"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              onChange={(event) => setFilters((current) => ({ ...current, stock: event.target.value }))}
              placeholder="Stok"
              value={filters.stock}
            />
            <Input
              onChange={(event) => setFilters((current) => ({ ...current, minimum: event.target.value }))}
              placeholder="Minimum"
              value={filters.minimum}
            />
            <Input
              onChange={(event) => setFilters((current) => ({ ...current, value: event.target.value }))}
              placeholder="Nilai"
              value={filters.value}
            />
          </div>
        </div>
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
                <th className="px-4 py-3 text-left">Bahan</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Stok</th>
                <th className="px-4 py-3 text-left">Minimum</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Nilai</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
              <tr className="border-t bg-background/80 normal-case">
                <th className="px-4 py-2 text-left">
                  <Input className="h-8" onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))} placeholder="Filter bahan" value={filters.name} />
                </th>
                <th className="px-4 py-2 text-left">
                  <Input className="h-8" onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} placeholder="Filter kategori" value={filters.category} />
                </th>
                <th className="px-4 py-2 text-left">
                  <Input className="h-8" onChange={(event) => setFilters((current) => ({ ...current, stock: event.target.value }))} placeholder="Filter stok" value={filters.stock} />
                </th>
                <th className="px-4 py-2 text-left">
                  <Input className="h-8" onChange={(event) => setFilters((current) => ({ ...current, minimum: event.target.value }))} placeholder="Filter minimum" value={filters.minimum} />
                </th>
                <th className="px-4 py-2 text-left">
                  <Select className="h-8" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}>
                    <option value="">Semua status</option>
                    {["Aman", "Rendah", "Kritis", "Habis"].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </th>
                <th className="px-4 py-2 text-left">
                  <Input className="h-8" onChange={(event) => setFilters((current) => ({ ...current, value: event.target.value }))} placeholder="Filter nilai" value={filters.value} />
                </th>
                <th className="px-4 py-2 text-right text-[11px] text-muted-foreground">{stockRows.length} baris</th>
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
                  min="0.01"
                  onChange={(event) => setBomProductionCount(event.target.value)}
                  placeholder="Contoh: 5"
                  step="0.01"
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
                            min="0"
                            name="amount"
                            onChange={(event) => updateRow(row.key, { amount: event.target.value })}
                            placeholder={selected ? `0 ${selected.unit}` : "0"}
                            step="0.1"
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
  onSubmit,
}: {
  inventory: Ingredient[];
  actualInputs: Record<string, Record<Role, string>>;
  clock: Date;
  role: Role;
  onActualChange: (id: string, role: Role, value: string) => void;
  onSubmit: () => void;
}) {
  const isInputDay = clock.getDate() === 30;
  const inputRoles = staffRoles;
  const [filters, setFilters] = useState({
    name: "",
    systemStock: "",
    Kasir: "",
    Cheef: "",
    Waiters: "",
    variance: "",
  });
  const opnameRows = useMemo(
    () =>
      inventory
        .map((item) => {
          const values = inputRoles.map((inputRole) => Number(actualInputs[item.id]?.[inputRole] || 0)).filter(Boolean);
          const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : item.stock;
          const gap = Number((item.stock - avg).toFixed(2));
          return {
            item,
            gap,
            values: {
              Kasir: actualInputs[item.id]?.Kasir ?? "",
              Cheef: actualInputs[item.id]?.Cheef ?? "",
              Waiters: actualInputs[item.id]?.Waiters ?? "",
            },
          };
        })
        .filter(({ item, gap, values }) => {
          return (
            includesFilterValue(item.name, filters.name) &&
            includesFilterValue(item.stock, filters.systemStock, [item.unit]) &&
            includesFilterValue(values.Kasir, filters.Kasir) &&
            includesFilterValue(values.Cheef, filters.Cheef) &&
            includesFilterValue(values.Waiters, filters.Waiters) &&
            includesFilterValue(gap, filters.variance, [item.unit])
          );
        }),
    [actualInputs, filters, inputRoles, inventory],
  );

  return (
    <div className="space-y-5">
      <Card className="bg-card/95">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Opname Dilakukan Tanggal 30</p>
            <p className="text-sm text-muted-foreground">
              Hari ini tanggal {clock.getDate()}. Backend juga memvalidasi tanggal operasional Asia/Jakarta.
            </p>
          </div>
          <Button disabled={!isInputDay || !inventory.length} onClick={onSubmit}>
            <Check />
            Simpan Data Aktual
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Stock opname</p>
          <CardTitle className="mt-1">Kolom Aktual Lapangan</CardTitle>
        </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-2 md:hidden">
          <Input
            onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
            placeholder="Filter bahan"
            value={filters.name}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              onChange={(event) => setFilters((current) => ({ ...current, systemStock: event.target.value }))}
              placeholder="Stok aplikasi"
              value={filters.systemStock}
            />
            <Input
              onChange={(event) => setFilters((current) => ({ ...current, variance: event.target.value }))}
              placeholder="Selisih"
              value={filters.variance}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              onChange={(event) => setFilters((current) => ({ ...current, Kasir: event.target.value }))}
              placeholder="Kasir"
              value={filters.Kasir}
            />
            <Input
              onChange={(event) => setFilters((current) => ({ ...current, Cheef: event.target.value }))}
              placeholder="Cheef"
              value={filters.Cheef}
            />
            <Input
              onChange={(event) => setFilters((current) => ({ ...current, Waiters: event.target.value }))}
              placeholder="Waiters"
              value={filters.Waiters}
            />
          </div>
        </div>
          <div className="grid gap-3 lg:hidden">
            {opnameRows.map(({ item, gap }) => {
              return (
                <div key={item.id} className="rounded-md border bg-muted/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{item.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{item.stock} {item.unit} sistem</p>
                    </div>
                    <Badge variant={gap > 0 ? "destructive" : "success"}>{gap} {item.unit}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {inputRoles.map((inputRole) => (
                      <label key={inputRole} className="grid gap-2 text-sm font-semibold">
                        Aktual {inputRole}
                        <Input
                          disabled={!isInputDay || (role !== "Owner" && role !== inputRole)}
                          min="0"
                          onChange={(event) => onActualChange(item.id, inputRole, event.target.value)}
                          placeholder={`0 ${item.unit}`}
                          step="0.1"
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
                  <th className="px-4 py-3 text-left">Bahan</th>
                  <th className="px-4 py-3 text-left">Stok Aplikasi</th>
                  {inputRoles.map((item) => (
                    <th key={item} className="px-4 py-3 text-left">Aktual {item}</th>
                  ))}
                  <th className="px-4 py-3 text-left">Estimasi Selisih</th>
                </tr>
                <tr className="border-t bg-background/80 normal-case">
                  <th className="px-4 py-2 text-left">
                    <Input className="h-8" onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))} placeholder="Filter bahan" value={filters.name} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <Input className="h-8" onChange={(event) => setFilters((current) => ({ ...current, systemStock: event.target.value }))} placeholder="Filter stok aplikasi" value={filters.systemStock} />
                  </th>
                  {inputRoles.map((inputRole) => (
                    <th className="px-4 py-2 text-left" key={`${inputRole}-filter`}>
                      <Input
                        className="h-8"
                        onChange={(event) => setFilters((current) => ({ ...current, [inputRole]: event.target.value }))}
                        placeholder={`Filter ${inputRole}`}
                        value={filters[inputRole]}
                      />
                    </th>
                  ))}
                  <th className="px-4 py-2 text-left">
                    <Input className="h-8" onChange={(event) => setFilters((current) => ({ ...current, variance: event.target.value }))} placeholder="Filter selisih" value={filters.variance} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {opnameRows.map(({ item, gap }) => {
                  return (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-bold">{item.name}</td>
                      <td className="px-4 py-3 font-mono">{item.stock} {item.unit}</td>
                      {inputRoles.map((inputRole) => (
                        <td key={inputRole} className="px-4 py-3">
                          <Input
                            disabled={!isInputDay || (role !== "Owner" && role !== inputRole)}
                            min="0"
                            onChange={(event) => onActualChange(item.id, inputRole, event.target.value)}
                            placeholder={`0 ${item.unit}`}
                            step="0.1"
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
    </div>
  );
}

function AiPage({ predictions }: { predictions: PricePredictionRow[] }) {
  const highRisk = predictions.filter((item) => item.risk === "Tinggi");
  return (
    <div className="space-y-5">
      <Card className="border-amber-300 bg-amber-50/80 text-amber-950">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 size-5 text-amber-700" />
            <div>
              <p className="font-semibold">Peringatan harga barang berpotensi naik</p>
              <p className="text-sm text-amber-800">
                {highRisk.length ? `${highRisk.length} komoditas berisiko tinggi dari API.` : "Tidak ada prediksi risiko tinggi dari API."}
              </p>
            </div>
          </div>
          <Badge className="bg-amber-200 text-amber-900" variant="outline">API data</Badge>
        </CardContent>
      </Card>

      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Price intelligence</p>
          <CardTitle className="mt-1">Ringkasan Prediksi Harga</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:hidden">
            {predictions.map((item) => (
              <div key={item.id} className="rounded-md border bg-muted/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{item.itemName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.sourceName}</p>
                  </div>
                  <Badge variant={item.risk === "Tinggi" ? "destructive" : "warning"}>{item.risk}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Harga acuan</p>
                    <p className="font-mono font-medium">{formatRupiah(item.currentPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Prediksi</p>
                    <p className="font-mono font-medium">{formatRupiah(item.predictedPrice)}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-bold text-destructive">{Number(item.changePercent).toFixed(2)}%</p>
              </div>
            ))}
            {!predictions.length && <EmptyState message="Belum ada prediksi harga dari API atau role Anda bukan Owner." />}
          </div>
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Barang</th>
                  <th className="px-4 py-3 text-left">Harga Acuan</th>
                  <th className="px-4 py-3 text-left">Prediksi</th>
                  <th className="px-4 py-3 text-left">Perubahan</th>
                  <th className="px-4 py-3 text-left">Risiko</th>
                  <th className="px-4 py-3 text-left">Sumber</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3 font-bold">{item.itemName}</td>
                    <td className="px-4 py-3 font-mono">{formatRupiah(item.currentPrice)}</td>
                    <td className="px-4 py-3 font-mono">{formatRupiah(item.predictedPrice)}</td>
                    <td className="px-4 py-3 font-bold text-destructive">{Number(item.changePercent).toFixed(2)}%</td>
                    <td className="px-4 py-3"><Badge variant={item.risk === "Tinggi" ? "destructive" : "warning"}>{item.risk}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{item.sourceName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!predictions.length && <EmptyState message="Belum ada prediksi harga dari API atau role Anda bukan Owner." />}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {predictions.map((item) => (
          <a
            key={item.id}
            className="rounded-lg border bg-card p-4 shadow-sm transition duration-500 hover:border-primary hover:shadow-soft"
            href={item.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            <div className="flex items-start justify-between gap-3">
              <Badge variant={item.risk === "Tinggi" ? "destructive" : "warning"}>{item.risk}</Badge>
              <span className="text-xs font-bold text-muted-foreground">{item.sourceName}</span>
            </div>
            <h3 className="mt-3 font-semibold">{item.itemName}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
          </a>
        ))}
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

async function downloadReportAnalyticsPdf(inventory: Ingredient[], transactions: TransactionRow[]) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ format: "a4", orientation: "portrait", unit: "mm" });
  const totalValue = inventory.reduce((sum, item) => sum + item.stock * item.price, 0);
  const critical = inventory.filter((item) => item.stock <= item.minimum).length;
  const masuk = transactions.filter((item) => item.type === "masuk").length;
  const keluar = transactions.filter((item) => item.type === "keluar").length;
  const ingredientById = new Map(inventory.map((item) => [item.id, item]));
  const byCategory = allCategories.map((category) => ({
    category,
    value: inventory.filter((item) => item.category === category).reduce((sum, item) => sum + item.stock * item.price, 0),
  }));
  const days = buildDashboardRangeDays(addDays(new Date(), -13), new Date());
  const flowMasuk = new Map(days.map((day) => [day.key, 0]));
  const flowKeluar = new Map(days.map((day) => [day.key, 0]));

  for (const transaction of transactions) {
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
  for (const transaction of transactions) {
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
  doc.text(`Dibuat: ${new Date().toLocaleString("id-ID")}`, 14, 36);

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
  setHeading("Bahan kritis dan nilai inventory terbesar", 16);
  autoTable(doc, {
    head: [["Bahan kritis", "Stock", "Minimum", "Status"]],
    body: topCritical.map((item) => [item.name, `${item.stock} ${item.unit}`, `${item.minimum} ${item.unit}`, stockStatus(item).label]),
    margin: { left: 14, right: 14 },
    startY: 24,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: "#1A1612" },
    headStyles: { fillColor: "#1A1612", textColor: "#FAF7F2" },
    alternateRowStyles: { fillColor: "#FAF7F2" },
  });
  autoTable(doc, {
    head: [["Bahan", "Kategori", "Stock", "Nilai"]],
    body: topInventoryValue.map((item) => [item.name, item.category, `${item.stock} ${item.unit}`, formatRupiah(item.stock * item.price)]),
    margin: { left: 14, right: 14 },
    startY: ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30) + 10,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: "#1A1612" },
    headStyles: { fillColor: "#B8962E", textColor: "#1A1612" },
    alternateRowStyles: { fillColor: "#FAF7F2" },
  });

  doc.addPage();
  doc.setFillColor("#FAF7F2");
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  setHeading("Audit transaction table", 16);
  autoTable(doc, {
    head: [["Tanggal", "Tipe", "Bahan", "Jumlah", "Harga", "Operator", "Catatan"]],
    body: transactions.slice(0, 120).map((item) => {
      const ingredient = ingredientById.get(item.ingredientId);
      return [
        transactionActivityDate(item).toLocaleString("id-ID"),
        item.type,
        ingredient?.name ?? item.ingredientId,
        `${Number(item.quantity)} ${ingredient?.unit ?? ""}`,
        formatRupiah(item.unitPrice ?? ingredient?.price ?? 0),
        item.operatorName,
        item.note ?? "",
      ];
    }),
    margin: { left: 10, right: 10 },
    startY: 24,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", textColor: "#1A1612" },
    headStyles: { fillColor: "#1A1612", textColor: "#FAF7F2" },
    alternateRowStyles: { fillColor: "#FAF7F2" },
  });

  doc.save("stokara-analytics.pdf");
}

async function downloadReportExcel(inventory: Ingredient[], transactions: TransactionRow[]) {
  const ExcelJS = await import("exceljs");
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
  const transactionRows = transactions.map((item) => {
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
  const ingredientsSheet = workbook.addWorksheet("ingredients");
  ingredientsSheet.columns = Object.keys(ingredientRows[0] ?? {
    id: "",
    name: "",
    category: "",
    unit: "",
    stock: 0,
    minimum_stock: 0,
    average_price: 0,
    stock_value: 0,
  }).map((key) => ({ header: key, key, width: Math.max(14, key.length + 2) }));
  ingredientsSheet.addRows(ingredientRows);
  const transactionsSheet = workbook.addWorksheet("transactions");
  transactionsSheet.columns = Object.keys(transactionRows[0] ?? {
    id: "",
    transaction_date: "",
    type: "",
    ingredient_id: "",
    ingredient_name: "",
    quantity: 0,
    unit: "",
    unit_price: 0,
    operator_name: "",
    note: "",
  }).map((key) => ({ header: key, key, width: Math.max(14, key.length + 2) }));
  transactionsSheet.addRows(transactionRows);
  const output = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "stokara-raw-data.xlsx");
}

function ReportPage({ inventory, transactions, role }: { inventory: Ingredient[]; transactions: TransactionRow[]; role: Role }) {
  const value = inventory.reduce((sum, item) => sum + item.stock * item.price, 0);
  const ingredientById = useMemo(() => new Map(inventory.map((item) => [item.id, item])), [inventory]);
  const [reportMessage, setReportMessage] = useState("");
  const [bomHistory, setBomHistory] = useState<BomProductionHistoryRow[]>([]);
  const [expandedBomHistoryId, setExpandedBomHistoryId] = useState<string | null>(null);
  const [transactionFilters, setTransactionFilters] = useState({
    time: "",
    type: "",
    ingredient: "",
    quantity: "",
    operator: "",
  });
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((item) => {
        const ingredient = ingredientById.get(item.ingredientId);
        const timeLabel = transactionActivityDate(item).toLocaleString("id-ID");
        return (
          includesFilterValue(timeLabel, transactionFilters.time) &&
          (!transactionFilters.type || item.type === transactionFilters.type) &&
          includesFilterValue(ingredient?.name ?? item.ingredientId, transactionFilters.ingredient) &&
          includesFilterValue(item.quantity, transactionFilters.quantity, [ingredient?.unit ?? ""]) &&
          includesFilterValue(item.operatorName, transactionFilters.operator)
        );
      }),
    [ingredientById, transactionFilters, transactions],
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
      await downloadReportExcel(inventory, transactions);
      setReportMessage("File Excel raw data berhasil dibuat.");
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : "Export Excel gagal dibuat.");
    }
  }

  async function handlePdfDownload() {
    setReportMessage("");
    try {
      await downloadReportAnalyticsPdf(inventory, transactions);
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
          <Button className="justify-start" onClick={() => void handleExcelDownload()} variant="outline">
            <FileSpreadsheet />
            Export Excel raw rows
          </Button>
          <Button className="justify-start" onClick={() => void handlePdfDownload()} variant="outline">
            <Download />
            Export PDF analitik
          </Button>
          <Separator className="my-2" />
          <div className="rounded-md bg-muted/45 p-4">
            <p className="text-xs text-muted-foreground">Nilai stok saat ini</p>
            <p className="mt-1 font-mono text-xl font-medium">{formatRupiah(value)}</p>
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
          <div className="grid gap-2">
            <Input
              onChange={(event) => setTransactionFilters((current) => ({ ...current, time: event.target.value }))}
              placeholder="Filter waktu"
              value={transactionFilters.time}
            />
            <Select
              onChange={(event) => setTransactionFilters((current) => ({ ...current, type: event.target.value }))}
              value={transactionFilters.type}
            >
              <option value="">Semua tipe</option>
              <option value="masuk">Masuk</option>
              <option value="keluar">Keluar</option>
            </Select>
            <Input
              onChange={(event) => setTransactionFilters((current) => ({ ...current, ingredient: event.target.value }))}
              placeholder="Filter bahan"
              value={transactionFilters.ingredient}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                onChange={(event) => setTransactionFilters((current) => ({ ...current, quantity: event.target.value }))}
                placeholder="Filter jumlah"
                value={transactionFilters.quantity}
              />
              <Input
                onChange={(event) => setTransactionFilters((current) => ({ ...current, operator: event.target.value }))}
                placeholder="Filter operator"
                value={transactionFilters.operator}
              />
            </div>
          </div>
          {filteredTransactions.map((item) => {
              const ingredient = ingredientById.get(item.ingredientId);
              return (
                <div key={item.id} className="rounded-md border bg-muted/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{ingredient?.name ?? item.ingredientId}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{transactionActivityDate(item).toLocaleString("id-ID")}</p>
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
          {!filteredTransactions.length && <EmptyState message="Belum ada transaksi atau role Anda bukan Owner." />}
        </div>
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">Tipe</th>
                  <th className="px-4 py-3 text-left">Bahan</th>
                  <th className="px-4 py-3 text-left">Jumlah</th>
                  <th className="px-4 py-3 text-left">Operator</th>
                </tr>
                <tr className="border-t bg-background/80 normal-case">
                  <th className="px-4 py-2 text-left">
                    <Input className="h-8" onChange={(event) => setTransactionFilters((current) => ({ ...current, time: event.target.value }))} placeholder="Filter waktu" value={transactionFilters.time} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <Select className="h-8" onChange={(event) => setTransactionFilters((current) => ({ ...current, type: event.target.value }))} value={transactionFilters.type}>
                      <option value="">Semua tipe</option>
                      <option value="masuk">Masuk</option>
                      <option value="keluar">Keluar</option>
                    </Select>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <Input className="h-8" onChange={(event) => setTransactionFilters((current) => ({ ...current, ingredient: event.target.value }))} placeholder="Filter bahan" value={transactionFilters.ingredient} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <Input className="h-8" onChange={(event) => setTransactionFilters((current) => ({ ...current, quantity: event.target.value }))} placeholder="Filter jumlah" value={transactionFilters.quantity} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <Input className="h-8" onChange={(event) => setTransactionFilters((current) => ({ ...current, operator: event.target.value }))} placeholder="Filter operator" value={transactionFilters.operator} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((item) => {
                  const ingredient = ingredientById.get(item.ingredientId);
                  return (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-mono">{transactionActivityDate(item).toLocaleString("id-ID")}</td>
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
              {bomHistory.map((item) => (
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
              {!bomHistory.length && <EmptyState message="Belum ada riwayat produksi BOM." />}
            </div>
            <div className="hidden overflow-x-auto rounded-md border md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Waktu</th>
                    <th className="px-4 py-3 text-left">BOM</th>
                    <th className="px-4 py-3 text-left">Jumlah Produksi</th>
                    <th className="px-4 py-3 text-left">Hasil Aktual</th>
                    <th className="px-4 py-3 text-left">Biaya</th>
                    <th className="px-4 py-3 text-left">Operator</th>
                    <th className="px-4 py-3 text-left">Catatan</th>
                    <th className="px-4 py-3 text-left">Detail Bahan</th>
                  </tr>
                </thead>
                <tbody>
                  {bomHistory.map((item) => (
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
              {!bomHistory.length && <EmptyState message="Belum ada riwayat produksi BOM." />}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SupplierPage() {
  return (
    <Card className="bg-card/95">
      <CardHeader>
        <p className="text-[11px] font-bold uppercase text-muted-foreground">Data source</p>
        <CardTitle className="mt-1">Supplier</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState message="Dummy supplier sudah dihapus. Tambahkan endpoint supplier agar halaman ini menampilkan data real." />
      </CardContent>
    </Card>
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
              <p className="text-xs text-muted-foreground">bahan aktif dari API</p>
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

type SettingsPanel = "unit" | "category" | "product" | "bom";
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
  inventory,
  categories,
  onSaved,
}: {
  role: Role;
  name: string;
  email: string;
  inventory: Ingredient[];
  categories: Category[];
  onSaved: () => Promise<void>;
}) {
  const [activePanel, setActivePanel] = useState<SettingsPanel>(role === "Owner" ? "unit" : "bom");
  const [units, setUnits] = useState<string[]>([]);
  const [originalUnits, setOriginalUnits] = useState<string[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<string[]>([]);
  const [originalCategories, setOriginalCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [newValue, setNewValue] = useState("");
  const [productMode, setProductMode] = useState<"manual" | "import">("manual");
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft);
  const [productEditRows, setProductEditRows] = useState<ProductEditRow[]>([
    { ...emptyProductDraft(), ingredientId: "", key: "edit-1", query: "" },
  ]);
  const [importRows, setImportRows] = useState<ProductDraft[]>([]);
  const [bomDraft, setBomDraft] = useState<BomDraft>(emptyBomDraft);
  const [bomRecipes, setBomRecipes] = useState<BomRecipeRow[]>([]);
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    if (role !== "Owner") setActivePanel("bom");
  }, [role]);

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

  const panelItems = {
    unit: units,
    category: categoryDrafts,
    product: products,
    bom: bomRecipes.map((item) => item.name),
  };
  const panelCopy: Record<SettingsPanel, { title: string; hint: string; placeholder: string }> = {
    unit: {
      title: "Satuan Ukuran",
      hint: "Mengikuti field unit pada tabel ingredients.",
      placeholder: "Contoh: kg, liter, ikat",
    },
    category: {
      title: "Kategori Produk",
      hint: "Mengikuti field category pada tabel ingredients.",
      placeholder: "Contoh: Bumbu Siap Pakai",
    },
    product: {
      title: "Product",
      hint: "Mengikuti field name pada tabel ingredients.",
      placeholder: "Contoh: Cabai hijau besar",
    },
    bom: {
      title: "Setting BOM",
      hint: "Bangun resep BOM, simpan ke database, lalu produksi untuk menambah stok barang jadi.",
      placeholder: "Contoh: Bumbu Soto",
    },
  };

  function updateActiveItems(next: string[]) {
    const cleaned = Array.from(new Set(next.map((item) => item.trim()).filter(Boolean))).sort();
    if (activePanel === "unit") setUnits(cleaned);
    if (activePanel === "category") setCategoryDrafts(cleaned);
    if (activePanel === "product") setProducts(cleaned);
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
      setNewValue("");
      await onSaved();
      setSettingsMessage(`${panelCopy[activePanel].title} tersimpan ke database.`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Master data gagal disimpan");
    }
  }

  function updateActiveItem(index: number, value: string) {
    updateActiveItems(panelItems[activePanel].map((item, itemIndex) => (itemIndex === index ? value : item)));
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

  async function downloadProductTemplate() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "STOKARA";
    workbook.created = new Date();
    const templateSheet = workbook.addWorksheet("template_product");
    templateSheet.columns = [
      { header: "name", key: "name", width: 26 },
      { header: "category", key: "category", width: 32 },
      { header: "unit", key: "unit", width: 14 },
      { header: "stock", key: "stock", width: 12 },
      { header: "minimum_stock", key: "minimum_stock", width: 16 },
      { header: "average_price", key: "average_price", width: 16 },
    ];
    templateSheet.addRow({
      name: "Cabai rawit merah",
      category: categoryDrafts[0] ?? "Bumbu Basah & Rempah Segar",
      unit: units[0] ?? "kg",
      stock: 2,
      minimum_stock: 1,
      average_price: 48000,
    });
    const categorySheet = workbook.addWorksheet("category_reference");
    categorySheet.columns = [{ header: "category", key: "category", width: 34 }];
    categorySheet.addRows(categoryDrafts.map((category) => ({ category })));
    const unitSheet = workbook.addWorksheet("unit_reference");
    unitSheet.columns = [{ header: "unit", key: "unit", width: 16 }];
    unitSheet.addRows(units.map((unit) => ({ unit })));
    const output = await workbook.xlsx.writeBuffer();
    downloadBlob(
      new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      "stokara-template-product.xlsx",
    );
  }

  async function handleProductImport(file: File | null) {
    if (!file) return;
    setSettingsMessage("");
    try {
      if (file.size > 1_500_000) throw new Error("Ukuran file maksimal 1.5MB");
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("Sheet pertama tidak ditemukan");

      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = excelCellText(cell.value).trim();
      });
      const rows: Record<string, unknown>[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const item: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          if (!header) return;
          item[header] = excelCellText(row.getCell(index + 1).value).trim();
        });
        rows.push(item);
      });
      const parsed = rows.map((row) => ({
        averagePrice: String(row.average_price ?? row.avarge_price ?? row.averagePrice ?? ""),
        category: String(row.category ?? ""),
        minimumStock: String(row.minimum_stock ?? row.minimumStock ?? ""),
        name: String(row.name ?? ""),
        stock: String(row.stock ?? ""),
        unit: String(row.unit ?? ""),
      }));
      setImportRows(parsed.filter((row) => row.name || row.category || row.unit));
      setSettingsMessage(`${parsed.length} baris terbaca dari Excel.`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "File Excel gagal dibaca");
    }
  }

  async function saveImportedProducts() {
    setSettingsMessage("");
    try {
      for (const row of importRows) {
        await saveProductDraft(row);
      }
      setImportRows([]);
      await onSaved();
      setSettingsMessage("Import product selesai disimpan.");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Import gagal disimpan");
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
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBomDraft(emptyBomDraft());
      await Promise.all([reloadBomRecipes(), onSaved()]);
      setSettingsMessage("BOM berhasil disimpan. Barang BOM sudah masuk ke database master stok.");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "BOM gagal disimpan");
    }
  }

  const settingCardsBase: Array<{ id: SettingsPanel; title: string; count: number; icon: typeof Ruler }> = [
    { id: "unit", title: "Satuan ukuran", count: units.length, icon: Ruler },
    { id: "category", title: "Kategori produk", count: categoryDrafts.length, icon: Tags },
    { id: "product", title: "Product", count: products.length, icon: Package },
    { id: "bom", title: "BOM", count: bomRecipes.length, icon: Database },
  ];
  const settingCards = settingCardsBase.filter((item) => (role === "Owner" ? true : item.id === "bom"));

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
        </CardContent>
      </Card>

      <Card className="bg-card/95">
        <CardHeader>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Master ingredients</p>
          <CardTitle className="mt-1">Pengaturan Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn("grid gap-2", settingCards.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2")}>
            {settingCards.map((item) => {
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

          <div className="rounded-md border bg-muted/35 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold">{panelCopy[activePanel].title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{panelCopy[activePanel].hint}</p>
              </div>
              <Badge variant="secondary">{panelItems[activePanel].length} item</Badge>
            </div>

            {activePanel !== "product" && activePanel !== "bom" ? (
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
                    <div className="grid gap-2 rounded-md border bg-card p-2 sm:grid-cols-[1fr_auto]" key={`${activePanel}-${index}-${item}`}>
                      <label className="relative">
                        <Pencil className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          onBlur={(event) =>
                            void saveActiveItem(
                              index,
                              activePanel === "unit" ? originalUnits[index] ?? item : originalCategories[index] ?? item,
                              event.target.value,
                            )
                          }
                          onChange={(event) => updateActiveItem(index, event.target.value)}
                          value={item}
                        />
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
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(["manual", "import"] as const).map((item) => (
                    <button
                      className={cn(
                        "h-9 rounded-md text-xs font-bold text-muted-foreground transition",
                        productMode === item && "bg-card text-primary shadow-sm",
                      )}
                      key={item}
                      onClick={() => setProductMode(item)}
                      type="button"
                    >
                      {item === "manual" ? "Input Manual" : "Import Excel"}
                    </button>
                  ))}
                </div>

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
                  productMode === "manual" ? (
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
                            <Input min="0" onChange={(event) => updateProductDraft({ stock: event.target.value })} placeholder="0" type="number" value={productDraft.stock} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Minim stock
                            <Input min="0" onChange={(event) => updateProductDraft({ minimumStock: event.target.value })} placeholder="0" type="number" value={productDraft.minimumStock} />
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
                                  <Input min="0" onChange={(event) => updateProductEditRow(row.key, { stock: event.target.value })} placeholder="0" type="number" value={row.stock} />
                                </label>
                                <label className="grid gap-1.5 text-sm font-semibold">
                                  Minim stock
                                  <Input min="0" onChange={(event) => updateProductEditRow(row.key, { minimumStock: event.target.value })} placeholder="0" type="number" value={row.minimumStock} />
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
                    <Button onClick={() => void downloadProductTemplate()} size="sm" type="button" variant="outline">
                      <Download />
                      Download Template
                    </Button>
                    <label className="grid gap-2 text-sm font-semibold">
                      File Excel
                      <Input accept=".xlsx,.xls,.csv" onChange={(event) => void handleProductImport(event.target.files?.[0] ?? null)} type="file" />
                    </label>
                    {!!importRows.length && (
                      <div className="rounded-md border bg-card p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{importRows.length} product siap diimport</p>
                          <Button onClick={() => void saveImportedProducts()} size="sm" type="button">
                            <FileSpreadsheet />
                            Simpan Import
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  )
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border bg-card p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">Input BOM baru</p>
                          <p className="text-xs text-muted-foreground">
                            Setelah disimpan, BOM otomatis menjadi barang stok tersendiri dan bisa dipakai di Stock Keluar.
                          </p>
                        </div>
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
                            <Input min="0" onChange={(event) => updateBomDraft({ yieldQuantity: event.target.value })} placeholder="20" type="number" value={bomDraft.yieldQuantity} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Satuan hasil
                            <Input list="settings-unit-list" onChange={(event) => updateBomDraft({ unit: event.target.value })} placeholder="Pax" value={bomDraft.unit} />
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1.5 text-sm font-semibold">
                            Minimum stock BOM
                            <Input min="0" onChange={(event) => updateBomDraft({ minimumStock: event.target.value })} placeholder="0" type="number" value={bomDraft.minimumStock} />
                          </label>
                          <div className="rounded-md border bg-muted/25 p-3">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Ringkasan biaya</p>
                            <div className="mt-2 grid gap-1 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span>Total bahan per batch</span>
                                <span className="font-semibold">{formatRupiah(bomTotalCost)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span>Harga per {bomDraft.unit || "unit"}</span>
                                <span className="font-semibold">{formatRupiah(bomUnitCost)}</span>
                              </div>
                            </div>
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
                          <div className="mt-3 grid gap-3">
                            {bomDraft.items.map((item, index) => (
                              <div className="rounded-md border bg-card p-3" key={item.key}>
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <Badge variant="secondary">Bahan {index + 1}</Badge>
                                  <Button aria-label="Hapus bahan BOM" onClick={() => removeBomItem(item.key)} size="icon" type="button" variant="outline">
                                    <Trash2 />
                                  </Button>
                                </div>
                                <div className="grid gap-3">
                                  <label className="grid gap-1.5 text-sm font-semibold">
                                    Nama bahan
                                    <Select
                                      onChange={(event) => updateBomItem(item.key, { ingredientId: event.target.value })}
                                      value={item.ingredientId}
                                    >
                                      <option value="">Pilih bahan baku</option>
                                      {availableBomIngredients.map((ingredient) => (
                                        <option key={ingredient.id} value={ingredient.id}>
                                          {ingredient.name} ({ingredient.stock} {ingredient.unit})
                                        </option>
                                      ))}
                                    </Select>
                                  </label>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="grid gap-1.5 text-sm font-semibold">
                                      Quantity dipakai
                                      <Input min="0" onChange={(event) => updateBomItem(item.key, { quantity: event.target.value })} placeholder="5" type="number" value={item.quantity} />
                                    </label>
                                    <label className="grid gap-1.5 text-sm font-semibold">
                                      Nominal total bahan
                                      <Input disabled placeholder="Otomatis dari harga bahan x quantity" value={item.totalCost ? formatRupiah(Number(item.totalCost)) : ""} />
                                    </label>
                                  </div>
                                </div>
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
                        <div>
                          <p className="text-sm font-semibold">Daftar BOM aktif</p>
                          <p className="text-xs text-muted-foreground">Produksi BOM dilakukan dari halaman Stock Masuk agar operator cukup memasukkan hasil produksi saja.</p>
                        </div>
                        <Badge variant="secondary">{bomRecipes.length} BOM</Badge>
                      </div>

                      <div className="mt-3 grid gap-3">
                        {bomRecipes.map((recipe) => (
                          <div className="rounded-md border bg-muted/25 p-3" key={recipe.id}>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold">{recipe.name}</p>
                                <Badge variant="success">{recipe.yieldQuantity} {recipe.yieldUnit}</Badge>
                                <Badge variant="secondary">Batch {formatRupiah(recipe.totalCost)}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Dibuat oleh {recipe.createdByName}. Harga per unit sekitar {formatRupiah(Math.round(recipe.totalCost / recipe.yieldQuantity || 0))}.
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {recipe.items.map((item) => (
                                  <div className="rounded-md border bg-card px-3 py-2 text-xs" key={item.id}>
                                    <p className="font-semibold">{item.ingredientName}</p>
                                    <p className="mt-1 text-muted-foreground">
                                      {item.quantity} {item.ingredientUnit} • {formatRupiah(item.totalCost)}
                                    </p>
                                  </div>
                                ))}
                              </div>
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
