"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
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
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  ThermometerSun,
  UserRound,
  Utensils,
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
  roleAccess,
  stockStatus,
  type Category,
  type Ingredient,
  type PageId,
  type Role,
} from "@/lib/data";
import { cn, formatRupiah } from "@/lib/utils";

type ToastTone = "success" | "warning" | "default";
type Toast = { message: string; tone: ToastTone } | null;
type ThemeMode = "light" | "night" | "warm";
type StockMode = "masuk" | "keluar";
type AuthMode = "signin" | "signup";
type NavItem = (typeof navItems)[number];

type ApiEnvelope<T> = { data: T };
type ApiError = { error?: { message?: string } };

type IngredientRow = {
  id: string;
  name: string;
  category: Category;
  unit: string;
  stock: string;
  minimumStock: string;
  averagePrice: number;
};

type TransactionRow = {
  id: string;
  ingredientId: string;
  type: StockMode;
  quantity: string;
  unitPrice: number | null;
  transactionDate: string;
  operatorName: string;
  note: string | null;
};

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

const roles: Role[] = ["Owner", "Kasir", "Cheef", "Waiters"];
const staffRoles: Role[] = ["Kasir", "Cheef", "Waiters"];
const allCategories: Category[] = [
  "Protein & Daging",
  "Sayuran & Pelengkap",
  "Bumbu Basah & Rempah Segar",
  "Bahan Kering & Bumbu Kering",
];
const themeOptions: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "night", label: "Night", icon: Moon },
  { id: "warm", label: "Warm", icon: ThermometerSun },
];

const categoryTones: Record<Category, { bg: string; text: string; bar: string }> = {
  "Protein & Daging": { bg: "bg-rose-50", text: "text-rose-700", bar: "bg-rose-500" },
  "Sayuran & Pelengkap": { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
  "Bumbu Basah & Rempah Segar": { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
  "Bahan Kering & Bumbu Kering": { bg: "bg-sky-50", text: "text-sky-700", bar: "bg-sky-500" },
};

const pageCopy: Record<PageId, { tag: string; title: string; sub: string }> = {
  dashboard: {
    tag: "Owner View",
    title: "Dashboard Evaluasi",
    sub: "Data langsung dari API stok, transaksi, dan prediksi harga",
  },
  stok: {
    tag: "Stok",
    title: "Manajemen Stok Bahan Baku",
    sub: "Pantau status minimum, nilai stok, dan prioritas restock",
  },
  opname: {
    tag: "Opname",
    title: "Data Aktual Lapangan",
    sub: "Kasir, Cheef, dan Waiters mengisi data aktual setiap tanggal 30",
  },
  "stok-masuk": {
    tag: "Input",
    title: "Stok Masuk",
    sub: "Catat bahan masuk ke database PostgreSQL",
  },
  "stok-keluar": {
    tag: "Input",
    title: "Stok Keluar",
    sub: "Catat pemakaian bahan ke database PostgreSQL",
  },
  ai: {
    tag: "Harga Pangan",
    title: "Prediksi Kenaikan Harga",
    sub: "Prediksi harga yang tersimpan di API",
  },
  laporan: {
    tag: "Laporan",
    title: "Laporan & Audit Trail",
    sub: "Ringkasan transaksi dari backend",
  },
  supplier: {
    tag: "Supplier",
    title: "Manajemen Supplier",
    sub: "Belum ada endpoint supplier di backend saat ini",
  },
  bahan: {
    tag: "Master Data",
    title: "Master Bahan Baku",
    sub: "Dataset bahan aktif dari tabel ingredients",
  },
  pengaturan: {
    tag: "Pengaturan",
    title: "Akun & Hak Akses",
    sub: "Session Better Auth dan role authorization",
  },
};

function allowedNav(role: Role) {
  if (role === "Owner") return navItems;
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
  };
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

export function SotoStockApp() {
  const session = authClient.useSession();
  const user = session.data?.user as SessionUser | undefined;
  const role = user?.role ?? "Kasir";
  const isAuthenticated = Boolean(session.data);

  const [theme, setTheme] = useState<ThemeMode>("warm");
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
    () => allCategories.filter((item) => inventory.some((ingredient) => ingredient.category === item)),
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
    const ingredientId = String(formData.get("ingredient"));
    const quantity = Number(formData.get("amount"));
    const unitPrice = Number(formData.get("price"));
    const transactionDate = String(formData.get("date"));
    const note = String(formData.get("note") ?? "");

    if (!ingredientId || Number.isNaN(quantity) || quantity <= 0) {
      showToast("Jumlah transaksi harus lebih dari 0", "warning");
      return;
    }

    try {
      await apiJson<TransactionRow>("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          ingredientId,
          type: mode,
          quantity,
          unitPrice: mode === "masuk" && !Number.isNaN(unitPrice) ? unitPrice : undefined,
          transactionDate: transactionDate ? new Date(transactionDate).toISOString() : undefined,
          operatorName: user?.name ?? role,
          note: note || undefined,
        }),
      });
      showToast(mode === "masuk" ? "Stok masuk tersimpan ke API" : "Stok keluar tersimpan ke API", "success");
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Transaksi gagal disimpan", "warning");
    }
  }

  async function handleOpnameSubmit() {
    const details = inventory.slice(0, 8).map((item) => ({
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

  if (session.isPending && !sessionFallbackReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-5 shadow-soft">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="font-bold">Memeriksa session Better Auth...</span>
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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-700" data-theme={theme}>
      <div className="flex min-h-screen animate-elegant-in">
        <Sidebar activePage={activePage} nav={nav} onLogout={logout} onNavigate={navigate} role={role} />

        <main className="flex min-w-0 flex-1 flex-col">
          <MobileHeader
            activePage={activePage}
            nav={nav}
            onNavigate={navigate}
            onToggle={() => setMobileNavOpen((current) => !current)}
            open={mobileNavOpen}
            role={role}
          />

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
            <PageHeader
              clock={clock}
              loadingData={loadingData}
              onBell={() => showToast(`${metrics.critical} bahan perlu dicek`, metrics.critical ? "warning" : "default")}
              onProfile={() => navigate("pengaturan")}
              onQuickInput={() => navigate("stok-masuk")}
              onRefresh={loadData}
              onThemeChange={setTheme}
              page={activePage}
              role={role}
              theme={theme}
            />

            {activePage === "dashboard" && role === "Owner" && (
              <DashboardPage
                dailyExpenseBars={dailyExpenseBars}
                lowStockItems={lowStockItems}
                metrics={metrics}
                onNavigate={navigate}
                usageBars={usageBars}
              />
            )}
            {activePage === "stok" && (
              <StockPage
                categories={availableCategories}
                category={category}
                filteredInventory={filteredInventory}
                onCategory={setCategory}
                onEdit={(name) => showToast(`Data ${name} dibaca dari API`)}
                onSearch={setSearch}
                search={search}
              />
            )}
            {activePage === "opname" && (
              <OpnamePage
                actualInputs={actualInputs}
                clock={clock}
                inventory={inventory.slice(0, 8)}
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
                onSelectedIngredient={setSelectedIngredient}
                onSubmit={(formData) => void handleTransaction(formData, "masuk")}
                selectedIngredient={selectedIngredient}
              />
            )}
            {activePage === "stok-keluar" && (
              <StockInputPage
                inventory={inventory}
                mode="keluar"
                onSelectedIngredient={setSelectedIngredient}
                onSubmit={(formData) => void handleTransaction(formData, "keluar")}
                selectedIngredient={selectedIngredient}
              />
            )}
            {activePage === "ai" && <AiPage predictions={predictions} />}
            {activePage === "laporan" && <ReportPage inventory={inventory} transactions={transactions} />}
            {activePage === "supplier" && <SupplierPage />}
            {activePage === "bahan" && <MasterDataPage categories={availableCategories} inventory={inventory} />}
            {activePage === "pengaturan" && <SettingsPage email={user?.email ?? ""} name={user?.name ?? ""} role={role} />}
          </div>
        </main>
      </div>

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
  const [role, setRole] = useState<Role>("Owner");
  const [name, setName] = useState("Owner SotoStock");
  const [email, setEmail] = useState("owner@sotostock.local");
  const [password, setPassword] = useState("password123");
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
    <main className="grid min-h-screen place-items-center overflow-hidden bg-background px-4 transition-colors duration-700">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.45),transparent_32%)]" />
      <form
        className="relative w-full max-w-md animate-elegant-in rounded-2xl border bg-card/95 p-7 shadow-2xl backdrop-blur"
        onSubmit={submit}
      >
        <LogoMark className="mx-auto mb-5 size-20" />
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-normal">SotoStock</h1>
          <p className="mt-1 text-sm text-muted-foreground">Login Better Auth untuk mengakses aplikasi</p>
        </div>

        <ThemePicker className="mt-6" onChange={onThemeChange} theme={theme} />

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["signin", "signup"] as AuthMode[]).map((item) => (
            <button
              key={item}
              className={cn(
                "h-10 rounded-md text-xs font-bold text-muted-foreground transition duration-500",
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
              <label className="grid gap-2 text-sm font-semibold">
                Nama
                <Input onChange={(event) => setName(event.target.value)} required value={name} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Role
                <Select onChange={(event) => setRole(event.target.value as Role)} value={role}>
                  {roles.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Select>
              </label>
            </>
          )}
          <label className="grid gap-2 text-sm font-semibold">
            Email
            <Input onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Password
            <Input minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
        </div>

        {error && <p className="mt-3 text-center text-xs font-semibold text-destructive">{error}</p>}

        <Button className="mt-6 w-full" disabled={pending} type="submit">
          {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          {mode === "signin" ? "Masuk" : "Buat Akun"}
        </Button>

        <div className="mt-5 rounded-md border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          Aplikasi terkunci penuh oleh Better Auth. Buat akun pertama sebagai Owner, lalu gunakan session itu untuk
          mengakses endpoint Owner-only.
        </div>
      </form>
    </main>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("grid place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25", className)}>
      <div className="grid size-[72%] place-items-center rounded-xl border border-white/30 bg-white/10">
        <Utensils className="size-8" />
        <span className="mt-[-6px] text-[10px] font-black tracking-wide">SS</span>
      </div>
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
    <div className={cn("grid grid-cols-3 gap-1 rounded-lg bg-muted p-1", className)}>
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
  onNavigate,
  onLogout,
}: {
  activePage: PageId;
  nav: readonly NavItem[];
  role: Role;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
}) {
  const groups = Array.from(new Set(nav.map((item) => item.group)));

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/85 backdrop-blur lg:flex">
      <div className="flex h-20 items-center gap-3 border-b px-5">
        <LogoMark className="size-11 rounded-xl" />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">SotoStock</p>
          <p className="truncate text-xs text-muted-foreground">PostgreSQL API</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group} className="mb-5">
            <p className="mb-2 px-2 text-[11px] font-black uppercase text-muted-foreground">{group}</p>
            <div className="grid gap-1">
              {nav.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground",
                      activePage === item.id && "bg-primary/10 text-primary",
                    )}
                    onClick={() => onNavigate(item.id)}
                    type="button"
                  >
                    <Icon className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <button className="flex items-center gap-3 border-t p-4 text-left transition hover:bg-muted" onClick={onLogout} type="button">
        <div className="grid size-10 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">{role[0]}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{role}</p>
          <p className="truncate text-xs text-muted-foreground">Logout Better Auth</p>
        </div>
        <LogOut className="size-4 text-muted-foreground" />
      </button>
    </aside>
  );
}

function MobileHeader({
  activePage,
  nav,
  open,
  role,
  onToggle,
  onNavigate,
}: {
  activePage: PageId;
  nav: readonly NavItem[];
  open: boolean;
  role: Role;
  onToggle: () => void;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <div className="border-b bg-card lg:hidden">
      <div className="flex h-16 items-center gap-3 px-4">
        <Button aria-label="Menu" onClick={onToggle} size="icon" variant="outline">
          <Menu />
        </Button>
        <LogoMark className="size-9 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">SotoStock</p>
          <p className="truncate text-xs text-muted-foreground">{role}</p>
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2 border-t p-3 sm:grid-cols-3">
          {nav.map((item) => (
            <Button
              key={item.id}
              className={cn("justify-start", activePage === item.id && "border-primary text-primary")}
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

function PageHeader({
  page,
  clock,
  role,
  theme,
  loadingData,
  onQuickInput,
  onBell,
  onProfile,
  onRefresh,
  onThemeChange,
}: {
  page: PageId;
  clock: Date;
  role: Role;
  theme: ThemeMode;
  loadingData: boolean;
  onQuickInput: () => void;
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
    year: "numeric",
  });
  const timeLabel = clock.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Badge className="mb-2" variant="default">{copy.tag}</Badge>
        <h1 className="text-2xl font-black tracking-normal">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.sub}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="rounded-md border bg-card px-3 py-2 text-right shadow-sm">
          <p className="font-mono text-sm font-bold">{timeLabel}</p>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </div>
        <Button aria-label="Refresh API data" disabled={loadingData} onClick={onRefresh} size="icon" variant="outline">
          <RefreshCw className={cn(loadingData && "animate-spin")} />
        </Button>
        <Button aria-label="Peringatan" onClick={onBell} size="icon" variant="outline">
          <Bell />
        </Button>
        <Button aria-label="Akun" onClick={onProfile} size="icon" variant="outline">
          <UserRound />
        </Button>
        <ThemePicker className="w-48" onChange={onThemeChange} theme={theme} />
        {role === "Owner" && (
          <Button onClick={onQuickInput}>
            <Plus />
            Input Stok
          </Button>
        )}
      </div>
    </header>
  );
}

function DashboardPage({
  lowStockItems,
  metrics,
  dailyExpenseBars,
  usageBars,
  onNavigate,
}: {
  lowStockItems: Ingredient[];
  metrics: { total: number; critical: number; stockValue: number; weekExpense: number; weekUsage: number };
  dailyExpenseBars: Array<{ label: string; value: number }>;
  usageBars: Array<{ label: string; value: number }>;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <div className="dashboard-shell space-y-5 rounded-2xl border p-4 shadow-soft transition-colors duration-700">
      <div className="grid gap-3 md:grid-cols-4">
        <SimpleMetric title="Nilai Stok" value={formatRupiah(metrics.stockValue)} tone="text-rose-600" />
        <SimpleMetric title="Total Bahan" value={`${metrics.total} bahan`} tone="text-sky-600" />
        <SimpleMetric title="Transaksi Keluar" value={`${metrics.weekUsage} input`} tone="text-amber-600" />
        <SimpleMetric title="Stok Kritis" value={`${metrics.critical} bahan`} tone="text-red-600" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          bars={dailyExpenseBars}
          formatter={(value) => `${Math.round(value / 1000)}rb`}
          title="Belanja Masuk 7 Hari"
          variant="money"
        />
        <ChartCard
          bars={usageBars}
          formatter={(value) => `${Number(value.toFixed(1))}`}
          title="Pemakaian Keluar per Kategori"
          variant="usage"
        />
      </div>

      <Card className="bg-card/90">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Evaluasi Owner</CardTitle>
          <Button onClick={() => onNavigate("opname")} size="sm" variant="outline">
            <ClipboardCheck />
            Data Aktual
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {lowStockItems.length ? (
            lowStockItems.map((item) => {
              const status = stockStatus(item);
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-md border bg-background/60 p-3">
                  <span className={cn("size-2.5 rounded-full", status.tone === "red" ? "bg-destructive" : "bg-amber-500")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.stock} {item.unit} tersisa dari minimum {item.minimum} {item.unit}
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
    </div>
  );
}

function SimpleMetric({ title, value, tone }: { title: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border bg-card/85 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-muted-foreground">{title}</p>
      <p className={cn("mt-2 text-xl font-black", tone)}>{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  bars,
  formatter,
  variant,
}: {
  title: string;
  bars: Array<{ label: string; value: number }>;
  formatter: (value: number) => string;
  variant: "money" | "usage";
}) {
  const max = Math.max(1, ...bars.map((item) => item.value));
  return (
    <Card className="bg-card/90">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-72 items-end gap-3 rounded-lg border bg-background/55 p-4">
          {bars.map((item) => {
            const height = Math.max(16, Math.round((item.value / max) * 100));
            return (
              <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground">{formatter(item.value)}</span>
                <div
                  className={cn(
                    "w-full rounded-t-lg transition-all duration-700",
                    variant === "money" ? "bg-rose-500" : "bg-sky-500",
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
  onEdit,
}: {
  filteredInventory: Ingredient[];
  categories: Category[];
  search: string;
  category: Category | "Semua";
  onSearch: (value: string) => void;
  onCategory: (value: Category | "Semua") => void;
  onEdit: (name: string) => void;
}) {
  return (
    <Card>
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
        <div className="overflow-x-auto rounded-md border">
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
            </thead>
            <tbody>
              {filteredInventory.map((item) => {
                const status = stockStatus(item);
                const progress = Math.min(100, Math.round(status.ratio));
                const tone = categoryTones[item.category];
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
                          indicatorClassName={cn(status.tone === "red" && "bg-destructive", status.tone === "amber" && "bg-amber-500", status.tone === "green" && "bg-success")}
                          value={progress}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{item.minimum} {item.unit}</td>
                    <td className="px-4 py-3"><Badge variant={status.variant}>{status.label}</Badge></td>
                    <td className="px-4 py-3 font-mono">{formatRupiah(item.stock * item.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button onClick={() => onEdit(item.name)} size="sm" variant="outline">
                        <Eye />
                        Detail
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredInventory.length && <EmptyState message="Tidak ada bahan dari API untuk filter ini." />}
        </div>
      </CardContent>
    </Card>
  );
}

function StockInputPage({
  inventory,
  mode,
  selectedIngredient,
  onSelectedIngredient,
  onSubmit,
}: {
  inventory: Ingredient[];
  mode: StockMode;
  selectedIngredient: string;
  onSelectedIngredient: (id: string) => void;
  onSubmit: (formData: FormData) => void;
}) {
  const current = inventory.find((item) => item.id === selectedIngredient) ?? inventory[0];
  const isIn = mode === "masuk";

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>{isIn ? "Form Stok Masuk" : "Form Stok Keluar"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Bahan
              <Select name="ingredient" onChange={(event) => onSelectedIngredient(event.target.value)} value={selectedIngredient}>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} - {item.stock} {item.unit}</option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Tanggal
              <Input name="date" defaultValue={new Date().toISOString().slice(0, 10)} type="date" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Jumlah
              <Input min="0" name="amount" placeholder="0" step="0.1" type="number" />
            </label>
            {isIn && (
              <label className="grid gap-2 text-sm font-semibold">
                Harga satuan
                <Input name="price" defaultValue={current?.price ?? 0} type="number" />
              </label>
            )}
            <label className={cn("grid gap-2 text-sm font-semibold", isIn ? "" : "sm:col-span-2")}>
              Catatan
              <Input name="note" placeholder={isIn ? "Contoh: belanja pasar pagi" : "Contoh: pemakaian dapur siang"} />
            </label>
            <div className="sm:col-span-2">
              <Button disabled={!inventory.length} type="submit">
                <Check />
                Simpan {isIn ? "Stok Masuk" : "Stok Keluar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Bahan</CardTitle>
        </CardHeader>
        <CardContent>
          {current ? (
            <div className="rounded-md border bg-muted/35 p-4">
              <p className="text-sm font-black">{current.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{current.category}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Stok saat ini</p>
                  <p className="font-mono text-lg font-black">{current.stock} {current.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Minimum</p>
                  <p className="font-mono text-lg font-black">{current.minimum} {current.unit}</p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState message="Belum ada bahan. Jalankan seed atau tambahkan data master." />
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

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black">Input data aktual hanya dibuka setiap tanggal 30</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Kolom Aktual Lapangan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
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
              </thead>
              <tbody>
                {inventory.map((item) => {
                  const values = inputRoles.map((inputRole) => Number(actualInputs[item.id]?.[inputRole] || 0)).filter(Boolean);
                  const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : item.stock;
                  const gap = Number((item.stock - avg).toFixed(2));
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
            {!inventory.length && <EmptyState message="Belum ada data bahan dari API." />}
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
              <p className="font-black">Peringatan harga barang berpotensi naik</p>
              <p className="text-sm text-amber-800">
                {highRisk.length ? `${highRisk.length} komoditas berisiko tinggi dari API.` : "Tidak ada prediksi risiko tinggi dari API."}
              </p>
            </div>
          </div>
          <Badge className="bg-amber-200 text-amber-900" variant="outline">API data</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Prediksi Harga</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
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
            <h3 className="mt-3 font-black">{item.itemName}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function ReportPage({ inventory, transactions }: { inventory: Ingredient[]; transactions: TransactionRow[] }) {
  const value = inventory.reduce((sum, item) => sum + item.stock * item.price, 0);
  const ingredientById = new Map(inventory.map((item) => [item.id, item]));
  return (
    <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
      <Card>
        <CardHeader><CardTitle>Ekspor</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          <Button className="justify-start" variant="outline"><FileSpreadsheet />Export Excel</Button>
          <Button className="justify-start" variant="outline"><Download />Export PDF</Button>
          <Separator className="my-2" />
          <div className="rounded-md bg-muted/45 p-4">
            <p className="text-xs text-muted-foreground">Nilai stok saat ini</p>
            <p className="mt-1 text-xl font-black">{formatRupiah(value)}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Audit Trail dari API</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">Tipe</th>
                  <th className="px-4 py-3 text-left">Bahan</th>
                  <th className="px-4 py-3 text-left">Jumlah</th>
                  <th className="px-4 py-3 text-left">Operator</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((item) => {
                  const ingredient = ingredientById.get(item.ingredientId);
                  return (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-mono">{new Date(item.transactionDate).toLocaleString("id-ID")}</td>
                      <td className="px-4 py-3"><Badge variant={item.type === "keluar" ? "warning" : "success"}>{item.type}</Badge></td>
                      <td className="px-4 py-3 font-bold">{ingredient?.name ?? item.ingredientId}</td>
                      <td className="px-4 py-3 font-mono">{Number(item.quantity)} {ingredient?.unit ?? ""}</td>
                      <td className="px-4 py-3">{item.operatorName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!transactions.length && <EmptyState message="Belum ada transaksi atau role Anda bukan Owner." />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SupplierPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier</CardTitle>
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
          const tone = categoryTones[cat];
          return (
            <div key={cat} className={cn("rounded-lg border p-4 shadow-soft", tone.bg)}>
              <p className={cn("text-xs font-black uppercase", tone.text)}>{cat}</p>
              <p className="mt-3 text-2xl font-black">{count}</p>
              <p className="text-xs text-muted-foreground">bahan aktif dari API</p>
            </div>
          );
        })}
      </div>
      {categories.map((cat) => (
        <Card key={cat}>
          <CardHeader><CardTitle className={categoryTones[cat].text}>{cat}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {inventory.filter((item) => item.category === cat).map((item) => (
                <div key={item.id} className="rounded-md border bg-card p-3">
                  <p className="truncate text-sm font-bold">{item.name}</p>
                  <p className={cn("mt-1 text-xs font-bold", categoryTones[cat].text)}>{item.unit}</p>
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

function SettingsPage({ role, name, email }: { role: Role; name: string; email: string }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader><CardTitle>Akun Aktif</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border bg-muted/35 p-4">
            <div className="grid size-12 place-items-center rounded-full bg-primary text-lg font-black text-primary-foreground">{role[0]}</div>
            <div className="min-w-0">
              <p className="font-black">{name || role}</p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Kontrol Role</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {roles.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-md border p-3">
              <ShieldCheck className={cn("size-5", item === role ? "text-primary" : "text-muted-foreground")} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{item}</p>
                <p className="truncate text-xs text-muted-foreground">{roleAccess[item].join(", ")}</p>
              </div>
              <Badge variant={item === role ? "default" : "secondary"}>{item === role ? "Aktif" : "Role"}</Badge>
            </div>
          ))}
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
