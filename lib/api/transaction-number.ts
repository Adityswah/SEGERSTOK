type TransactionPrefix = "FIN-IN" | "FIN-OUT" | "STK-IN" | "STK-OUT" | "BOM";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function generateTransactionNo(prefix: TransactionPrefix, date = new Date()) {
  const dateKey = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timeKey = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `${prefix}-${dateKey}-${timeKey}-${suffix}`;
}
