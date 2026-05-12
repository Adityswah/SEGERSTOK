import {
  BarChart3,
  Bot,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  Store,
  Warehouse,
} from "lucide-react";

export type Role = "Owner" | "Kasir" | "Cheef" | "Waiters";

export type Category =
  | "Protein & Daging"
  | "Sayuran & Pelengkap"
  | "Bumbu Basah & Rempah Segar"
  | "Bahan Kering & Bumbu Kering";

export type Ingredient = {
  id: string;
  name: string;
  unit: string;
  category: Category;
  stock: number;
  minimum: number;
  price: number;
};

type SeedIngredient = Omit<Ingredient, "id" | "category">;

export const pins: Record<Role, string> = {
  Owner: "123456",
  Kasir: "123456",
  Cheef: "123456",
  Waiters: "123456",
};

export const roleAccess: Record<Role, string[]> = {
  Owner: ["Akses penuh", "Export data", "Import data", "Setting"],
  Kasir: ["Input stok masuk", "Input stok keluar", "Data aktual akhir bulan"],
  Cheef: ["Input stok masuk", "Input stok keluar", "Data aktual akhir bulan"],
  Waiters: ["Input stok masuk", "Input stok keluar", "Data aktual akhir bulan"],
};

export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Operasional" },
  { id: "stok", label: "Stok Bahan", icon: Warehouse, group: "Operasional", badge: "3" },
  { id: "opname", label: "Stock Opname", icon: ClipboardCheck, group: "Operasional" },
  { id: "stok-masuk", label: "Stok Masuk", icon: LogIn, group: "Input" },
  { id: "stok-keluar", label: "Stok Keluar", icon: LogOut, group: "Input" },
  { id: "ai", label: "Prediksi Harga", icon: Bot, group: "Analitik" },
  { id: "laporan", label: "Laporan", icon: FileText, group: "Analitik" },
  { id: "supplier", label: "Supplier", icon: Store, group: "Data" },
  { id: "bahan", label: "Master Bahan", icon: BarChart3, group: "Data" },
  { id: "pengaturan", label: "Pengaturan", icon: Settings, group: "Sistem" },
] as const;

export type PageId = (typeof navItems)[number]["id"];

const bahanData: Record<Category, SeedIngredient[]> = {
  "Protein & Daging": [
    { name: "Daging sapi sandung lamur", unit: "kg", stock: 0.8, minimum: 2, price: 145000 },
    { name: "Daging sapi has dalam", unit: "kg", stock: 3.5, minimum: 2, price: 160000 },
    { name: "Daging sapi iga", unit: "kg", stock: 2.2, minimum: 1.5, price: 155000 },
    { name: "Babat sapi", unit: "kg", stock: 1.8, minimum: 1, price: 55000 },
    { name: "Kikil sapi", unit: "kg", stock: 2.5, minimum: 1, price: 48000 },
    { name: "Paru sapi", unit: "kg", stock: 1.2, minimum: 0.5, price: 42000 },
    { name: "Lidah sapi", unit: "kg", stock: 0.8, minimum: 0.5, price: 75000 },
    { name: "Sumsum tulang sapi", unit: "kg", stock: 3, minimum: 1, price: 35000 },
    { name: "Tulang sapi kaldu", unit: "kg", stock: 5, minimum: 3, price: 25000 },
    { name: "Ayam kampung utuh", unit: "ekor", stock: 8, minimum: 5, price: 65000 },
    { name: "Telur ayam kampung", unit: "butir", stock: 24, minimum: 12, price: 3500 },
    { name: "Telur ayam negeri", unit: "butir", stock: 36, minimum: 20, price: 2200 },
    { name: "Tahu putih", unit: "buah", stock: 20, minimum: 10, price: 1500 },
    { name: "Tempe", unit: "papan", stock: 5, minimum: 3, price: 8000 },
    { name: "Perkedel kentang", unit: "buah", stock: 30, minimum: 15, price: 2000 },
    { name: "Sate usus", unit: "tusuk", stock: 40, minimum: 20, price: 1500 },
    { name: "Sate ayam", unit: "tusuk", stock: 50, minimum: 25, price: 2500 },
    { name: "Pindang telur", unit: "butir", stock: 12, minimum: 6, price: 3000 },
  ],
  "Sayuran & Pelengkap": [
    { name: "Kol / kubis segar", unit: "kg", stock: 3, minimum: 2, price: 5000 },
    { name: "Taoge pendek", unit: "kg", stock: 2, minimum: 1, price: 8000 },
    { name: "Wortel", unit: "kg", stock: 2.5, minimum: 1, price: 9000 },
    { name: "Kentang", unit: "kg", stock: 4, minimum: 2, price: 12000 },
    { name: "Tomat segar", unit: "kg", stock: 2, minimum: 1, price: 15000 },
    { name: "Sawi hijau", unit: "ikat", stock: 5, minimum: 3, price: 4000 },
    { name: "Daun bawang", unit: "ikat", stock: 4, minimum: 2, price: 3000 },
    { name: "Seledri", unit: "ikat", stock: 3, minimum: 2, price: 4000 },
    { name: "Peterseli", unit: "ikat", stock: 2, minimum: 1, price: 5000 },
    { name: "Buncis", unit: "kg", stock: 1.5, minimum: 0.5, price: 14000 },
    { name: "Jeruk nipis", unit: "buah", stock: 20, minimum: 10, price: 1500 },
    { name: "Jeruk kunci", unit: "buah", stock: 30, minimum: 15, price: 1000 },
    { name: "Taoge panjang", unit: "kg", stock: 1.5, minimum: 1, price: 8000 },
    { name: "Kacang tanah goreng", unit: "kg", stock: 1, minimum: 0.5, price: 22000 },
  ],
  "Bumbu Basah & Rempah Segar": [
    { name: "Bawang merah", unit: "kg", stock: 1.2, minimum: 2, price: 28000 },
    { name: "Bawang putih", unit: "kg", stock: 2.5, minimum: 1.5, price: 35000 },
    { name: "Jahe segar", unit: "kg", stock: 0.8, minimum: 0.5, price: 18000 },
    { name: "Kunyit segar", unit: "kg", stock: 0.5, minimum: 0.3, price: 15000 },
    { name: "Lengkuas", unit: "kg", stock: 0.6, minimum: 0.3, price: 12000 },
    { name: "Serai", unit: "batang", stock: 15, minimum: 8, price: 1000 },
    { name: "Daun jeruk", unit: "lembar", stock: 30, minimum: 15, price: 500 },
    { name: "Daun salam", unit: "lembar", stock: 20, minimum: 10, price: 500 },
    { name: "Cabai rawit merah", unit: "kg", stock: 0.3, minimum: 1, price: 48000 },
    { name: "Cabai merah keriting", unit: "kg", stock: 0.8, minimum: 0.5, price: 38000 },
    { name: "Kemiri", unit: "biji", stock: 30, minimum: 15, price: 1000 },
    { name: "Kencur", unit: "kg", stock: 0.3, minimum: 0.2, price: 22000 },
    { name: "Daun kunyit", unit: "lembar", stock: 10, minimum: 5, price: 1000 },
    { name: "Daun pandan", unit: "lembar", stock: 12, minimum: 5, price: 1000 },
  ],
  "Bahan Kering & Bumbu Kering": [
    { name: "Ketumbar bubuk", unit: "gram", stock: 200, minimum: 100, price: 80 },
    { name: "Jinten bubuk", unit: "gram", stock: 150, minimum: 80, price: 90 },
    { name: "Merica bubuk", unit: "gram", stock: 180, minimum: 100, price: 120 },
    { name: "Pala bubuk", unit: "gram", stock: 120, minimum: 50, price: 150 },
    { name: "Kayu manis", unit: "gram", stock: 140, minimum: 60, price: 90 },
    { name: "Cengkeh", unit: "gram", stock: 100, minimum: 50, price: 140 },
    { name: "Kapulaga", unit: "gram", stock: 90, minimum: 40, price: 180 },
    { name: "Bunga lawang", unit: "gram", stock: 80, minimum: 40, price: 160 },
    { name: "Kunyit bubuk", unit: "gram", stock: 180, minimum: 80, price: 80 },
    { name: "Garam dapur", unit: "kg", stock: 2, minimum: 1, price: 3000 },
    { name: "Gula pasir", unit: "kg", stock: 3, minimum: 2, price: 16000 },
    { name: "Gula merah", unit: "kg", stock: 1.5, minimum: 0.5, price: 22000 },
    { name: "Penyedap kaldu sapi", unit: "sachet", stock: 28, minimum: 12, price: 1500 },
    { name: "Vetsin / MSG", unit: "gram", stock: 250, minimum: 100, price: 45 },
    { name: "Kecap manis", unit: "botol", stock: 4, minimum: 2, price: 15000 },
    { name: "Kecap asin", unit: "botol", stock: 3, minimum: 1, price: 12000 },
    { name: "Cuka makan", unit: "botol", stock: 2, minimum: 1, price: 9000 },
    { name: "Minyak goreng", unit: "liter", stock: 12, minimum: 5, price: 14000 },
    { name: "Santan instan", unit: "kotak", stock: 18, minimum: 8, price: 4500 },
    { name: "Santan segar", unit: "liter", stock: 4, minimum: 2, price: 11000 },
    { name: "Bawang goreng siap pakai", unit: "kg", stock: 0.8, minimum: 0.3, price: 65000 },
    { name: "Mie kuning basah", unit: "kg", stock: 5, minimum: 2, price: 12000 },
    { name: "Mie bihun", unit: "kg", stock: 3, minimum: 1.5, price: 18000 },
    { name: "Mie soun", unit: "kg", stock: 2.5, minimum: 1, price: 20000 },
    { name: "Lontong", unit: "bungkus", stock: 20, minimum: 10, price: 3000 },
    { name: "Beras putih", unit: "kg", stock: 25, minimum: 10, price: 13500 },
    { name: "Kerupuk udang", unit: "kg", stock: 2, minimum: 0.5, price: 40000 },
    { name: "Emping melinjo", unit: "kg", stock: 1, minimum: 0.5, price: 55000 },
    { name: "Sambal pecel botol", unit: "botol", stock: 8, minimum: 3, price: 18000 },
    { name: "Teh celup", unit: "box", stock: 6, minimum: 2, price: 22000 },
    { name: "Gula aren", unit: "kg", stock: 2, minimum: 1, price: 24000 },
    { name: "Air mineral galon", unit: "galon", stock: 9, minimum: 4, price: 19000 },
  ],
};

export const categories = Object.keys(bahanData) as Category[];

export const ingredients: Ingredient[] = categories.flatMap((category) =>
  bahanData[category].map((item, index) => ({
    ...item,
    id: `${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index + 1}`,
    category,
  })),
);

export function stockStatus(item: Pick<Ingredient, "stock" | "minimum">) {
  const ratio = item.minimum === 0 ? 999 : (item.stock / item.minimum) * 100;
  if (item.stock === 0) {
    return { label: "Habis", variant: "destructive" as const, tone: "red", ratio };
  }
  if (ratio < 50) {
    return { label: "Kritis", variant: "destructive" as const, tone: "red", ratio };
  }
  if (ratio < 80) {
    return { label: "Rendah", variant: "warning" as const, tone: "amber", ratio };
  }
  return { label: "Aman", variant: "success" as const, tone: "green", ratio };
}

export const suppliers = [
  {
    name: "Pak Roni Daging Segar",
    items: "Daging sapi, babat, kikil",
    rating: 4.8,
    spend: 4850000,
    initials: "PR",
    color: "bg-red-100 text-red-700",
  },
  {
    name: "Bu Sri Sayur Pagi",
    items: "Sayuran, rempah segar",
    rating: 4.7,
    spend: 1820000,
    initials: "BS",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Toko Makmur Bumbu",
    items: "Bumbu kering, minyak, beras",
    rating: 4.6,
    spend: 2675000,
    initials: "TM",
    color: "bg-blue-100 text-blue-700",
  },
];

export const movements = [
  { time: "08:12", type: "Masuk", item: "Daging sapi has dalam", qty: "2 kg", operator: "Admin" },
  { time: "09:35", type: "Keluar", item: "Bawang merah", qty: "0.4 kg", operator: "Kasir" },
  { time: "10:18", type: "Keluar", item: "Cabai rawit merah", qty: "0.2 kg", operator: "Admin" },
  { time: "12:02", type: "Opname", item: "Protein & Daging", qty: "5 item", operator: "Owner" },
  { time: "14:44", type: "Masuk", item: "Jeruk nipis", qty: "20 buah", operator: "Admin" },
];

export const aiInsights = [
  {
    title: "Cabai rawit merah masih tinggi",
    desc: "Harga cabai rawit merah nasional dilaporkan berada di kisaran Rp63.700-Rp64.850/kg pada 7 Mei 2026.",
    confidence: 86,
    impact: "Prioritas beli: cabai rawit merah",
  },
  {
    title: "Bawang merah masih mahal",
    desc: "Bawang merah dilaporkan berada di sekitar Rp46.350-Rp48.300/kg, sehingga stok bumbu dasar perlu diamankan.",
    confidence: 82,
    impact: "Prioritas beli: bawang merah",
  },
  {
    title: "Minyak goreng naik tipis",
    desc: "Beberapa laporan 7 Mei 2026 mencatat minyak goreng curah dan kemasan bergerak naik.",
    confidence: 74,
    impact: "Pantau supplier minyak",
  },
];

export const priceNews = [
  {
    source: "Liputan6",
    date: "7 Mei 2026",
    title: "Harga Pangan 7 Mei 2026: Cabai Rawit Merah Rp63.700, Telur Ayam Rp31.400",
    commodity: "Cabai rawit merah, telur, bawang",
    signal: "Waspada naik",
    summary:
      "PIHPS mencatat cabai rawit merah Rp63.700/kg, bawang merah Rp48.300/kg, dan bawang putih Rp39.050/kg.",
    url: "https://www.liputan6.com/bisnis/read/6335232/harga-pangan-7-mei-2026-cabai-rawit-merah-rp-63700-telur-ayam-rp-31400",
  },
  {
    source: "Okezone",
    date: "7 Mei 2026",
    title: "Update Harga Pangan: Cabai, Daging Ayam hingga Minyak Goreng Naik",
    commodity: "Cabai, ayam, minyak goreng",
    signal: "Naik",
    summary:
      "Cabai rawit merah naik 7,37% ke Rp64.850/kg; cabai merah besar, keriting, ayam, dan minyak goreng ikut naik.",
    url: "https://economy.okezone.com/read/2026/05/07/320/3216899/update-harga-pangan-cabai-daging-ayam-hingga-minyak-goreng-naik",
  },
  {
    source: "Suara",
    date: "7 Mei 2026",
    title: "Harga Pangan Nasional 7 Mei 2026: Bawang Merah Meroket, Cabai dan Minyak Goreng Ikut Naik",
    commodity: "Bawang merah, cabai, minyak goreng",
    signal: "Naik",
    summary:
      "Tekanan harga masih terjadi pada bawang merah, cabai, dan minyak goreng kemasan bermerek.",
    url: "https://www.suara.com/bisnis/2026/05/07/095830/harga-pangan-nasional-7-mei-2026-bawang-merah-meroket-cabai-dan-minyak-goreng-ikut-naik",
  },
  {
    source: "Suara",
    date: "6 Mei 2026",
    title: "Harga Pangan Hari Ini: Bawang hingga Cabai Kompak Naik",
    commodity: "Bawang, cabai, beras",
    signal: "Naik",
    summary:
      "Kenaikan paling kuat dilaporkan pada bawang, cabai, beras, daging sapi, dan gula.",
    url: "https://www.suara.com/bisnis/2026/05/06/111850/harga-pangan-hari-ini-bawang-hingga-cabai-kompak-naik-beras-dan-minyak-goreng-ikut-terkerek",
  },
  {
    source: "Kompas",
    date: "14 Maret 2026",
    title: "Mengapa Harga Bahan Pokok Cenderung Naik Jelang Lebaran?",
    commodity: "Cabai rawit merah",
    signal: "Musiman",
    summary:
      "Kompas menjelaskan permintaan Lebaran mendorong kenaikan; cabai rawit merah disebut menjadi komoditas yang ekstrem naik.",
    url: "https://amp.kompas.com/tren/read/2026/03/14/180000665/mengapa-harga-bahan-pokok-cenderung-naik-jelang-lebaran-",
  },
  {
    source: "Detik",
    date: "21 Februari 2026",
    title: "Harga Pangan Mahal Awal Ramadan: Cabai Rp113.000/Kg-Ayam Rp44.000/Kg",
    commodity: "Cabai, ayam, bawang, daging sapi",
    signal: "Musiman",
    summary:
      "DKI melaporkan cabai rawit, cabai keriting, bawang merah, daging ayam, dan daging sapi naik pada awal Ramadan.",
    url: "https://finance.detik.com/berita-ekonomi-bisnis/d-8366045/harga-pangan-mahal-awal-ramadan-cabai-rp-113-000-kg-ayam-rp-44-000-kg",
  },
];

export const priceForecast = [
  { item: "Cabai rawit merah", current: 64850, next: 70500, change: "+8.7%", risk: "Tinggi", source: "Okezone, Liputan6" },
  { item: "Bawang merah", current: 48300, next: 51500, change: "+6.6%", risk: "Tinggi", source: "Liputan6, Suara" },
  { item: "Cabai merah keriting", current: 50300, next: 53800, change: "+7.0%", risk: "Sedang", source: "Liputan6" },
  { item: "Minyak goreng", current: 20600, next: 21200, change: "+2.9%", risk: "Sedang", source: "Okezone" },
  { item: "Daging ayam", current: 39100, next: 40500, change: "+3.6%", risk: "Sedang", source: "Okezone" },
  { item: "Bawang putih", current: 39050, next: 39800, change: "+1.9%", risk: "Rendah", source: "Liputan6" },
];
