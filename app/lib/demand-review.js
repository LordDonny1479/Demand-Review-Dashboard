export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function parseCsv(text) {
  const rows = [];
  let value = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);

  const headers = rows.shift() ?? [];
  return rows.map((cells) =>
    Object.fromEntries(
      headers.map((header, index) => [header, (cells[index] || "").trim()]),
    ),
  );
}

export function toCases(row) {
  if (row.cases !== undefined && row.cases !== "") {
    return Number(row.cases || 0);
  }

  const quantity = Number(row.quantity || 0);
  if ((row.unit_type || "").toUpperCase() === "DRP") {
    return quantity * Number(row.cases_per_drp || 0);
  }

  return quantity;
}

export function buildDemandReview(rows, baseYear = 2025, comparisonYear = 2026) {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = [row.retailer, row.mpg, row.month].join("||");
    if (!grouped.has(key)) {
      grouped.set(key, {
        retailer: row.retailer,
        mpg: row.mpg,
        month: row.month,
        baseCases: 0,
        comparisonCases: 0,
        difference: 0,
      });
    }

    const bucket = grouped.get(key);
    const cases = toCases(row);
    if (Number(row.year) === baseYear) bucket.baseCases += cases;
    if (Number(row.year) === comparisonYear) bucket.comparisonCases += cases;
    bucket.difference = bucket.comparisonCases - bucket.baseCases;
  });

  return [...grouped.values()].sort(
    (a, b) =>
      a.retailer.localeCompare(b.retailer) ||
      a.mpg.localeCompare(b.mpg) ||
      MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month),
  );
}

export function pivotByRetailerAndMpg(rows) {
  const pivot = new Map();

  rows.forEach((row) => {
    const key = [row.retailer, row.mpg].join("||");
    if (!pivot.has(key)) {
      pivot.set(key, { retailer: row.retailer, mpg: row.mpg, months: {} });
    }

    pivot.get(key).months[row.month] = row;
  });

  return [...pivot.values()];
}
