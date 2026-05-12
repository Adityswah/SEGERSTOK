import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["Owner", "Kasir", "Cheef", "Waiters"]);
export const categoryEnum = pgEnum("ingredient_category", [
  "Protein & Daging",
  "Sayuran & Pelengkap",
  "Bumbu Basah & Rempah Segar",
  "Bahan Kering & Bumbu Kering",
]);
export const stockTransactionTypeEnum = pgEnum("stock_transaction_type", ["masuk", "keluar"]);
export const predictionRiskEnum = pgEnum("prediction_risk", ["Rendah", "Sedang", "Tinggi"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: roleEnum("role").notNull().default("Kasir"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    userIdIdx: index("session_user_id_idx").on(table.userId),
  }),
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("account_user_id_idx").on(table.userId),
  }),
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingredientsTable = pgTable(
  "ingredients",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    category: categoryEnum("category").notNull(),
    unit: varchar("unit", { length: 32 }).notNull(),
    stock: numeric("stock", { precision: 12, scale: 2 }).notNull().default("0"),
    minimumStock: numeric("minimum_stock", { precision: 12, scale: 2 }).notNull().default("0"),
    averagePrice: integer("average_price").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("ingredients_name_idx").on(table.name),
    categoryIdx: index("ingredients_category_idx").on(table.category),
  }),
);

export const stockTransactionsTable = pgTable(
  "stock_transactions",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "restrict" }),
    type: stockTransactionTypeEnum("type").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitPrice: integer("unit_price"),
    transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull().defaultNow(),
    operatorId: text("operator_id").references(() => user.id, { onDelete: "set null" }),
    operatorName: varchar("operator_name", { length: 80 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ingredientIdx: index("stock_transactions_ingredient_idx").on(table.ingredientId),
    dateIdx: index("stock_transactions_date_idx").on(table.transactionDate),
  }),
);

export const stockOpnameTable = pgTable("stock_opname", {
  id: text("id").primaryKey(),
  opnameDate: timestamp("opname_date", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  createdByName: varchar("created_by_name", { length: 80 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockOpnameDetailsTable = pgTable(
  "stock_opname_details",
  {
    id: text("id").primaryKey(),
    opnameId: text("opname_id")
      .notNull()
      .references(() => stockOpnameTable.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "restrict" }),
    systemStock: numeric("system_stock", { precision: 12, scale: 2 }).notNull(),
    cashierActual: numeric("cashier_actual", { precision: 12, scale: 2 }),
    chefActual: numeric("chef_actual", { precision: 12, scale: 2 }),
    waitersActual: numeric("waiters_actual", { precision: 12, scale: 2 }),
    finalActual: numeric("final_actual", { precision: 12, scale: 2 }),
    variance: numeric("variance", { precision: 12, scale: 2 }),
    note: text("note"),
  },
  (table) => ({
    opnameIngredientIdx: uniqueIndex("stock_opname_details_opname_ingredient_idx").on(
      table.opnameId,
      table.ingredientId,
    ),
  }),
);

export const pricePredictionsTable = pgTable(
  "price_predictions",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id").references(() => ingredientsTable.id, { onDelete: "set null" }),
    itemName: varchar("item_name", { length: 160 }).notNull(),
    currentPrice: integer("current_price").notNull(),
    predictedPrice: integer("predicted_price").notNull(),
    changePercent: numeric("change_percent", { precision: 6, scale: 2 }).notNull(),
    risk: predictionRiskEnum("risk").notNull(),
    sourceName: varchar("source_name", { length: 160 }).notNull(),
    sourceUrl: text("source_url").notNull(),
    summary: text("summary").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    itemIdx: index("price_predictions_item_idx").on(table.itemName),
    riskIdx: index("price_predictions_risk_idx").on(table.risk),
  }),
);

export const ingredientsRelations = relations(ingredientsTable, ({ many }) => ({
  transactions: many(stockTransactionsTable),
  opnameDetails: many(stockOpnameDetailsTable),
  predictions: many(pricePredictionsTable),
}));

export const transactionRelations = relations(stockTransactionsTable, ({ one }) => ({
  ingredient: one(ingredientsTable, {
    fields: [stockTransactionsTable.ingredientId],
    references: [ingredientsTable.id],
  }),
  operator: one(user, {
    fields: [stockTransactionsTable.operatorId],
    references: [user.id],
  }),
}));

export const schema = {
  user,
  session,
  account,
  verification,
  ingredientsTable,
  stockTransactionsTable,
  stockOpnameTable,
  stockOpnameDetailsTable,
  pricePredictionsTable,
};
