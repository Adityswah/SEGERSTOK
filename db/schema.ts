import { relations } from "drizzle-orm";
import {
  boolean,
  date,
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
export const stockTransactionTypeEnum = pgEnum("stock_transaction_type", ["masuk", "keluar"]);
export const financeTransactionTypeEnum = pgEnum("finance_transaction_type", ["pendapatan", "pengeluaran"]);
export const financeFundMethodEnum = pgEnum("finance_fund_method", ["cash", "bank"]);
export const financeCategoryEnum = pgEnum("finance_category", ["keperluan_stock", "non_keperluan_stock"]);
export const predictionRiskEnum = pgEnum("prediction_risk", ["Rendah", "Sedang", "Tinggi"]);
export const opnameSessionStatusEnum = pgEnum("opname_session_status", [
  "draft",
  "staff_input",
  "owner_review",
  "finalized",
]);
export const opnameInputTypeEnum = pgEnum("opname_input_type", ["primary", "secondary"]);
export const ownerEvaluationSeverityEnum = pgEnum("owner_evaluation_severity", ["low", "medium", "high"]);
export const ownerEvaluationStatusEnum = pgEnum("owner_evaluation_status", ["open", "done"]);
export const stockLedgerSourceEnum = pgEnum("stock_ledger_source", [
  "stock_in",
  "stock_out",
  "bom_production",
  "monthly_opname_final",
  "owner_stock_correction",
]);
export const aiRecommendationActionEnum = pgEnum("ai_recommendation_action", [
  "beli-sekarang",
  "beli-bertahap",
  "tunda-beli",
]);
export const aiPipelineRunStatusEnum = pgEnum("ai_pipeline_run_status", ["success", "partial", "failed"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: roleEnum("role").notNull().default("Kasir"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
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
    category: varchar("category", { length: 160 }).notNull(),
    unit: varchar("unit", { length: 32 }).notNull(),
    stock: numeric("stock", { precision: 12, scale: 2 }).notNull().default("0"),
    minimumStock: numeric("minimum_stock", { precision: 12, scale: 2 }).notNull().default("0"),
    averagePrice: integer("average_price").notNull().default(0),
    isBom: boolean("is_bom").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("ingredients_name_idx").on(table.name),
    categoryIdx: index("ingredients_category_idx").on(table.category),
  }),
);

export const bomRecipesTable = pgTable(
  "bom_recipes",
  {
    id: text("id").primaryKey(),
    finishedIngredientId: text("finished_ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    yieldQuantity: numeric("yield_quantity", { precision: 12, scale: 2 }).notNull(),
    yieldUnit: varchar("yield_unit", { length: 32 }).notNull(),
    totalCost: integer("total_cost").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdByName: varchar("created_by_name", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    finishedIngredientIdx: uniqueIndex("bom_recipes_finished_ingredient_idx").on(table.finishedIngredientId),
    nameIdx: uniqueIndex("bom_recipes_name_idx").on(table.name),
  }),
);

export const bomRecipeItemsTable = pgTable(
  "bom_recipe_items",
  {
    id: text("id").primaryKey(),
    bomRecipeId: text("bom_recipe_id")
      .notNull()
      .references(() => bomRecipesTable.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    totalCost: integer("total_cost").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recipeIngredientIdx: uniqueIndex("bom_recipe_items_recipe_ingredient_idx").on(table.bomRecipeId, table.ingredientId),
  }),
);

export const bomProductionRunsTable = pgTable(
  "bom_production_runs",
  {
    id: text("id").primaryKey(),
    bomRecipeId: text("bom_recipe_id")
      .notNull()
      .references(() => bomRecipesTable.id, { onDelete: "cascade" }),
    finishedIngredientId: text("finished_ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "cascade" }),
    batches: numeric("batches", { precision: 12, scale: 2 }).notNull().default("1"),
    producedQuantity: numeric("produced_quantity", { precision: 12, scale: 2 }).notNull(),
    totalCost: integer("total_cost").notNull().default(0),
    productionDate: timestamp("production_date", { withTimezone: true }).notNull().defaultNow(),
    operatorId: text("operator_id").references(() => user.id, { onDelete: "set null" }),
    operatorName: varchar("operator_name", { length: 80 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recipeIdx: index("bom_production_runs_recipe_idx").on(table.bomRecipeId),
    productionDateIdx: index("bom_production_runs_date_idx").on(table.productionDate),
  }),
);

export const bomProductionRunItemsTable = pgTable(
  "bom_production_run_items",
  {
    id: text("id").primaryKey(),
    productionRunId: text("production_run_id")
      .notNull()
      .references(() => bomProductionRunsTable.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "restrict" }),
    ingredientName: varchar("ingredient_name", { length: 160 }).notNull(),
    ingredientUnit: varchar("ingredient_unit", { length: 32 }).notNull(),
    consumedQuantity: numeric("consumed_quantity", { precision: 12, scale: 2 }).notNull(),
    unitCost: integer("unit_cost").notNull().default(0),
    totalCost: integer("total_cost").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productionRunIdx: index("bom_production_run_items_run_idx").on(table.productionRunId),
  }),
);

export const ingredientMasterOptionsTable = pgTable(
  "ingredient_master_options",
  {
    id: text("id").primaryKey(),
    type: varchar("type", { length: 48 }).notNull(),
    value: varchar("value", { length: 160 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    optionIdx: uniqueIndex("ingredient_master_options_type_value_idx").on(table.type, table.value),
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
    financeTransactionId: text("finance_transaction_id"),
    transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull().defaultNow(),
    clientRequestId: varchar("client_request_id", { length: 120 }),
    operatorId: text("operator_id").references(() => user.id, { onDelete: "set null" }),
    operatorName: varchar("operator_name", { length: 80 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ingredientIdx: index("stock_transactions_ingredient_idx").on(table.ingredientId),
    financeTransactionIdx: index("stock_transactions_finance_transaction_idx").on(table.financeTransactionId),
    dateIdx: index("stock_transactions_date_idx").on(table.transactionDate),
    clientRequestIdx: uniqueIndex("stock_transactions_client_request_id_idx").on(table.clientRequestId),
  }),
);

export const financeTransactionsTable = pgTable(
  "finance_transactions",
  {
    id: text("id").primaryKey(),
    type: financeTransactionTypeEnum("type").notNull(),
    fundMethod: financeFundMethodEnum("fund_method").notNull(),
    category: financeCategoryEnum("category").notNull(),
    subcategory: varchar("subcategory", { length: 160 }).notNull(),
    ingredientId: text("ingredient_id").references(() => ingredientsTable.id, { onDelete: "restrict" }),
    itemName: varchar("item_name", { length: 160 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unit: varchar("unit", { length: 32 }).notNull(),
    unitPrice: integer("unit_price").notNull(),
    totalAmount: integer("total_amount").notNull(),
    transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    attachmentName: varchar("attachment_name", { length: 240 }),
    linkedStockTransactionId: text("linked_stock_transaction_id"),
    operatorId: text("operator_id").references(() => user.id, { onDelete: "set null" }),
    operatorName: varchar("operator_name", { length: 80 }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dateIdx: index("finance_transactions_date_idx").on(table.transactionDate),
    typeIdx: index("finance_transactions_type_idx").on(table.type),
    fundMethodIdx: index("finance_transactions_fund_method_idx").on(table.fundMethod),
    categoryIdx: index("finance_transactions_category_idx").on(table.category),
    ingredientIdx: index("finance_transactions_ingredient_idx").on(table.ingredientId),
    operatorIdx: index("finance_transactions_operator_idx").on(table.operatorId),
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

export const stockOpnameSessionsTable = pgTable(
  "stock_opname_sessions",
  {
    id: text("id").primaryKey(),
    opnameDate: timestamp("opname_date", { withTimezone: true }).notNull(),
    status: opnameSessionStatusEnum("status").notNull().default("draft"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdByName: varchar("created_by_name", { length: 80 }).notNull(),
    finalizedById: text("finalized_by_id").references(() => user.id, { onDelete: "set null" }),
    finalizedByName: varchar("finalized_by_name", { length: 80 }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    opnameDateIdx: index("stock_opname_sessions_date_idx").on(table.opnameDate),
  }),
);

export const stockOpnameItemSummariesTable = pgTable(
  "stock_opname_item_summaries",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => stockOpnameSessionsTable.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "restrict" }),
    ingredientNameSnapshot: varchar("ingredient_name_snapshot", { length: 160 }).notNull(),
    categorySnapshot: varchar("category_snapshot", { length: 160 }).notNull(),
    unitSnapshot: varchar("unit_snapshot", { length: 32 }).notNull(),
    systemStockBefore: numeric("system_stock_before", { precision: 12, scale: 2 }).notNull(),
    totalRoleActual: numeric("total_role_actual", { precision: 12, scale: 2 }),
    finalActual: numeric("final_actual", { precision: 12, scale: 2 }),
    varianceQty: numeric("variance_qty", { precision: 12, scale: 2 }),
    variancePercent: numeric("variance_percent", { precision: 8, scale: 2 }),
    estimatedVarianceValue: integer("estimated_variance_value").notNull().default(0),
    ownerFinalNote: text("owner_final_note"),
    needsOwnerReview: boolean("needs_owner_review").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIngredientIdx: uniqueIndex("stock_opname_item_summaries_session_ingredient_idx").on(
      table.sessionId,
      table.ingredientId,
    ),
    sessionIdx: index("stock_opname_item_summaries_session_idx").on(table.sessionId),
  }),
);

export const stockOpnameRoleInputsTable = pgTable(
  "stock_opname_role_inputs",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => stockOpnameSessionsTable.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "restrict" }),
    role: roleEnum("role").notNull(),
    areaName: varchar("area_name", { length: 120 }).notNull(),
    inputType: opnameInputTypeEnum("input_type").notNull().default("primary"),
    actualQty: numeric("actual_qty", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    inputById: text("input_by_id").references(() => user.id, { onDelete: "set null" }),
    inputByName: varchar("input_by_name", { length: 80 }).notNull(),
    inputAt: timestamp("input_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIngredientRoleIdx: uniqueIndex("stock_opname_role_inputs_session_ingredient_role_idx").on(
      table.sessionId,
      table.ingredientId,
      table.role,
    ),
    sessionIdx: index("stock_opname_role_inputs_session_idx").on(table.sessionId),
  }),
);

export const ownerEvaluationsTable = pgTable(
  "owner_evaluations",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => stockOpnameSessionsTable.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id").references(() => ingredientsTable.id, { onDelete: "set null" }),
    severity: ownerEvaluationSeverityEnum("severity").notNull().default("low"),
    suspectedCause: varchar("suspected_cause", { length: 240 }).notNull(),
    ownerNote: text("owner_note").notNull(),
    actionItem: text("action_item").notNull(),
    dueDate: date("due_date"),
    status: ownerEvaluationStatusEnum("status").notNull().default("open"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdByName: varchar("created_by_name", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("owner_evaluations_session_idx").on(table.sessionId),
  }),
);

export const stockLedgerTable = pgTable(
  "stock_ledger",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "restrict" }),
    source: stockLedgerSourceEnum("source").notNull(),
    referenceId: text("reference_id"),
    stockBefore: numeric("stock_before", { precision: 12, scale: 2 }).notNull(),
    stockAfter: numeric("stock_after", { precision: 12, scale: 2 }).notNull(),
    delta: numeric("delta", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason"),
    operatorId: text("operator_id").references(() => user.id, { onDelete: "set null" }),
    operatorName: varchar("operator_name", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ingredientIdx: index("stock_ledger_ingredient_idx").on(table.ingredientId),
    sourceIdx: index("stock_ledger_source_idx").on(table.source),
    createdAtIdx: index("stock_ledger_created_at_idx").on(table.createdAt),
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

export const aiSourceSignalsTable = pgTable(
  "ai_source_signals",
  {
    id: text("id").primaryKey(),
    sourceType: varchar("source_type", { length: 24 }).notNull(),
    sourceName: varchar("source_name", { length: 160 }).notNull(),
    sourceUrl: text("source_url").notNull(),
    headline: varchar("headline", { length: 280 }).notNull(),
    summary: text("summary").notNull(),
    commodityTags: text("commodity_tags").notNull().default(""),
    signalScore: integer("signal_score").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    contentHash: varchar("content_hash", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    hashIdx: uniqueIndex("ai_source_signals_hash_idx").on(table.contentHash),
    publishedAtIdx: index("ai_source_signals_published_at_idx").on(table.publishedAt),
    sourceTypeIdx: index("ai_source_signals_source_type_idx").on(table.sourceType),
  }),
);

export const aiMaterialRiskDailyTable = pgTable(
  "ai_material_risk_daily",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id").references(() => ingredientsTable.id, { onDelete: "set null" }),
    itemName: varchar("item_name", { length: 160 }).notNull(),
    signalDate: date("signal_date", { mode: "string" }).notNull(),
    riskScore: integer("risk_score").notNull(),
    risk: predictionRiskEnum("risk").notNull(),
    trendPercent: numeric("trend_percent", { precision: 6, scale: 2 }).notNull().default("0"),
    currentPrice: integer("current_price").notNull().default(0),
    predictedPrice: integer("predicted_price").notNull().default(0),
    sourceCount: integer("source_count").notNull().default(0),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dailyRiskIdx: uniqueIndex("ai_material_risk_daily_item_date_idx").on(table.itemName, table.signalDate),
    signalDateIdx: index("ai_material_risk_daily_signal_date_idx").on(table.signalDate),
    riskIdx: index("ai_material_risk_daily_risk_idx").on(table.risk),
  }),
);

export const aiWeeklyStockProjectionsTable = pgTable(
  "ai_weekly_stock_projections",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "cascade" }),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    weekEnd: date("week_end", { mode: "string" }).notNull(),
    currentStock: numeric("current_stock", { precision: 12, scale: 2 }).notNull(),
    predictedWeeklyUsage: numeric("predicted_weekly_usage", { precision: 12, scale: 2 }).notNull(),
    predictedEndingStock: numeric("predicted_ending_stock", { precision: 12, scale: 2 }).notNull(),
    stockCoverDays: numeric("stock_cover_days", { precision: 12, scale: 2 }).notNull(),
    riskBoostPercent: numeric("risk_boost_percent", { precision: 6, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    weeklyProjectionUniqueIdx: uniqueIndex("ai_weekly_stock_projection_ingredient_week_idx").on(
      table.ingredientId,
      table.weekStart,
    ),
    weekStartIdx: index("ai_weekly_stock_projection_week_start_idx").on(table.weekStart),
  }),
);

export const aiBuyRecommendationsTable = pgTable(
  "ai_buy_recommendations",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredientsTable.id, { onDelete: "cascade" }),
    recommendationDate: date("recommendation_date", { mode: "string" }).notNull(),
    action: aiRecommendationActionEnum("action").notNull(),
    recommendedQuantity: numeric("recommended_quantity", { precision: 12, scale: 2 }).notNull(),
    priorityScore: integer("priority_score").notNull(),
    explanation: text("explanation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recommendationUniqueIdx: uniqueIndex("ai_buy_recommendations_ingredient_date_idx").on(
      table.ingredientId,
      table.recommendationDate,
    ),
    recommendationDateIdx: index("ai_buy_recommendations_date_idx").on(table.recommendationDate),
    priorityIdx: index("ai_buy_recommendations_priority_idx").on(table.priorityScore),
  }),
);

export const aiPipelineRunsTable = pgTable(
  "ai_pipeline_runs",
  {
    id: text("id").primaryKey(),
    runType: varchar("run_type", { length: 64 }).notNull(),
    status: aiPipelineRunStatusEnum("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    metricsJson: text("metrics_json").notNull().default("{}"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runTypeIdx: index("ai_pipeline_runs_run_type_idx").on(table.runType),
    startedAtIdx: index("ai_pipeline_runs_started_at_idx").on(table.startedAt),
    statusIdx: index("ai_pipeline_runs_status_idx").on(table.status),
  }),
);

export const aiBotLogsTable = pgTable(
  "ai_bot_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    message: text("message").notNull(),
    cleanMessage: text("clean_message").notNull(),
    intent: varchar("intent", { length: 32 }).notNull(),
    flow: varchar("flow", { length: 32 }).notNull(),
    answer: text("answer").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("ai_bot_logs_created_at_idx").on(table.createdAt),
    flowIdx: index("ai_bot_logs_flow_idx").on(table.flow),
    intentIdx: index("ai_bot_logs_intent_idx").on(table.intent),
    userIdx: index("ai_bot_logs_user_idx").on(table.userId),
  }),
);

export const ingredientsRelations = relations(ingredientsTable, ({ many }) => ({
  transactions: many(stockTransactionsTable),
  opnameDetails: many(stockOpnameDetailsTable),
  opnameItemSummaries: many(stockOpnameItemSummariesTable),
  opnameRoleInputs: many(stockOpnameRoleInputsTable),
  stockLedger: many(stockLedgerTable),
  predictions: many(pricePredictionsTable),
  bomRecipes: many(bomRecipeItemsTable),
  finishedBomRecipes: many(bomRecipesTable),
  bomProductionRuns: many(bomProductionRunsTable),
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

export const bomRecipesRelations = relations(bomRecipesTable, ({ one, many }) => ({
  finishedIngredient: one(ingredientsTable, {
    fields: [bomRecipesTable.finishedIngredientId],
    references: [ingredientsTable.id],
  }),
  items: many(bomRecipeItemsTable),
  productionRuns: many(bomProductionRunsTable),
  createdBy: one(user, {
    fields: [bomRecipesTable.createdById],
    references: [user.id],
  }),
}));

export const bomRecipeItemsRelations = relations(bomRecipeItemsTable, ({ one }) => ({
  recipe: one(bomRecipesTable, {
    fields: [bomRecipeItemsTable.bomRecipeId],
    references: [bomRecipesTable.id],
  }),
  ingredient: one(ingredientsTable, {
    fields: [bomRecipeItemsTable.ingredientId],
    references: [ingredientsTable.id],
  }),
}));

export const bomProductionRunsRelations = relations(bomProductionRunsTable, ({ one, many }) => ({
  recipe: one(bomRecipesTable, {
    fields: [bomProductionRunsTable.bomRecipeId],
    references: [bomRecipesTable.id],
  }),
  finishedIngredient: one(ingredientsTable, {
    fields: [bomProductionRunsTable.finishedIngredientId],
    references: [ingredientsTable.id],
  }),
  operator: one(user, {
    fields: [bomProductionRunsTable.operatorId],
    references: [user.id],
  }),
  items: many(bomProductionRunItemsTable),
}));

export const bomProductionRunItemsRelations = relations(bomProductionRunItemsTable, ({ one }) => ({
  productionRun: one(bomProductionRunsTable, {
    fields: [bomProductionRunItemsTable.productionRunId],
    references: [bomProductionRunsTable.id],
  }),
  ingredient: one(ingredientsTable, {
    fields: [bomProductionRunItemsTable.ingredientId],
    references: [ingredientsTable.id],
  }),
}));

export const schema = {
  user,
  session,
  account,
  verification,
  ingredientsTable,
  ingredientMasterOptionsTable,
  bomRecipesTable,
  bomRecipeItemsTable,
  bomProductionRunsTable,
  bomProductionRunItemsTable,
  stockTransactionsTable,
  financeTransactionsTable,
  stockOpnameTable,
  stockOpnameDetailsTable,
  stockOpnameSessionsTable,
  stockOpnameItemSummariesTable,
  stockOpnameRoleInputsTable,
  ownerEvaluationsTable,
  stockLedgerTable,
  pricePredictionsTable,
  aiSourceSignalsTable,
  aiMaterialRiskDailyTable,
  aiWeeklyStockProjectionsTable,
  aiBuyRecommendationsTable,
  aiPipelineRunsTable,
  aiBotLogsTable,
};
