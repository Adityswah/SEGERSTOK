const xlsx = require("xlsx");
const fs = require("fs");

const workbook = xlsx.readFile("STOCK BAHAN.xlsx");
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet);

fs.writeFileSync("stock_bahan.json", JSON.stringify(data, null, 2));
console.log("Saved to stock_bahan.json");
