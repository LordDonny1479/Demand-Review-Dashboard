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
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift()?.split(",").map((header) => header.trim()) ?? [];

  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(
      headers.map((header, index) => [header, (values[index] || "").trim()]),
    );
  });
}

export function toCases(row) {
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
