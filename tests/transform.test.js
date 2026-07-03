import assert from "node:assert";
import fs from "node:fs";

const { META, MONTHS, RAW } = JSON.parse(
  fs.readFileSync("public/data/promo-dashboard-data.json", "utf8"),
);

assert.deepStrictEqual(MONTHS, [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]);

assert.strictEqual(RAW.banner_order.length, 34);
assert.deepStrictEqual(RAW.banner_order.slice(0, 5), [
  "Amazon",
  "Associated Grocers",
  "Atlantic Grocers",
  "Canada",
  "Canadian Tire",
]);
assert.strictEqual(RAW.default_mode, "blended");
assert.ok(RAW.comparisons.yoy);
assert.ok(RAW.comparisons.mom);
assert.ok(RAW.modes.blended);
assert.ok(RAW.modes.separate);
assert.strictEqual(RAW.modes.blended.stats.fy25, 2324823);
assert.strictEqual(RAW.modes.blended.stats.fy26, 2586883);
assert.strictEqual(RAW.modes.blended.stats.delta, 262060);
assert.strictEqual(RAW.modes.blended.stats.delta_pct, 11.3);
assert.strictEqual(RAW.modes.separate.stats.fy25, 2008605);
assert.strictEqual(RAW.modes.separate.stats.fy26, 2306380);
assert.strictEqual(RAW.modes.separate.stats.delta, 297775);
assert.strictEqual(RAW.modes.separate.stats.delta_pct, 14.8);
assert.strictEqual(RAW.comparisons.yoy.modes.blended.stats.fy26, RAW.modes.blended.stats.fy26);
assert.strictEqual(RAW.comparisons.mom.period_labels.base, "June");
assert.strictEqual(RAW.comparisons.mom.period_labels.comparison, "July");
assert.strictEqual(RAW.comparisons.mom.modes.blended.stats.fy25, 2571167);
assert.strictEqual(RAW.comparisons.mom.modes.blended.stats.fy26, 2586883);
assert.strictEqual(RAW.comparisons.mom.modes.blended.stats.delta, 15716);
assert.strictEqual(RAW.comparisons.mom.modes.blended.stats.delta_pct, 0.6);
assert.strictEqual(RAW.comparisons.mom.modes.separate.stats.fy25, 2299576);
assert.strictEqual(RAW.comparisons.mom.modes.separate.stats.fy26, 2306380);
assert.strictEqual(RAW.comparisons.mom.modes.separate.stats.delta, 6804);
assert.strictEqual(RAW.comparisons.mom.modes.separate.stats.delta_pct, 0.3);

const grandTotal = RAW.modes.blended.rollup_ret.find((row) => row.label === "GRAND TOTAL");
assert.ok(grandTotal);
assert.strictEqual(grandTotal.fy25, RAW.modes.blended.stats.fy25);
assert.strictEqual(grandTotal.fy26, RAW.modes.blended.stats.fy26);

const walmart = RAW.modes.blended.rollup_ret.find((row) => row.label === "Walmart");
assert.ok(walmart);
assert.strictEqual(walmart.fy25, 307261);
assert.strictEqual(walmart.fy26, 324149);

const separateWalmart = RAW.modes.separate.rollup_ret.find((row) => row.label === "Walmart");
assert.ok(separateWalmart);
assert.strictEqual(separateWalmart.fy25, 81906);
assert.strictEqual(separateWalmart.fy26, 130171);

const separateDisplayGroup = RAW.modes.separate.rollup_grp.find((row) => row.label === "Roast & Ground Displays");
assert.ok(separateDisplayGroup);
assert.strictEqual(separateDisplayGroup.fy25, 5906);
assert.strictEqual(separateDisplayGroup.fy26, 5219);

const blendedDisplayGroup = RAW.modes.blended.rollup_grp.find((row) => row.label === "Roast & Ground Displays");
assert.strictEqual(blendedDisplayGroup, undefined);

const categoryFallbackRows = [
  RAW.modes.blended.rollup_grp.find((row) => row.label === "R&G Unspecified"),
  RAW.modes.blended.rollup_grp.find((row) => row.label === "SS KComp Unspecified"),
];
assert.strictEqual(categoryFallbackRows[0].fy26, 8821);
assert.strictEqual(categoryFallbackRows[1].fy26, 14655);

function retailerRowsForMpg(rows, mpg) {
  const start = rows.findIndex((row) => row.label === mpg && row.is_mpg);
  assert.ok(start >= 0, `Missing MPG row for ${mpg}`);
  const retailers = [];
  for (const row of rows.slice(start + 1)) {
    if (row.is_group || row.is_mpg || row.is_total) break;
    if (row.is_retailer) retailers.push(row);
  }
  return retailers;
}

function assertSortedByDeltaDesc(rows) {
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1].fy26 - rows[index - 1].fy25;
    const current = rows[index].fy26 - rows[index].fy25;
    assert.ok(previous >= current, `${rows[index - 1].label} should sort before ${rows[index].label}`);
  }
}

const blendedRetailers = retailerRowsForMpg(RAW.modes.blended.rollup_grp, "R&G Small Bag 6/300g");
assert.ok(blendedRetailers.length > 5);
assert.strictEqual(blendedRetailers[0].label, "Walmart");
assert.strictEqual(blendedRetailers[0].fy25, 0);
assert.strictEqual(blendedRetailers[0].fy26, 40000);
assertSortedByDeltaDesc(blendedRetailers);

const separateRetailers = retailerRowsForMpg(RAW.modes.separate.rollup_grp, "R&G Small Bag 6/300g");
assert.ok(separateRetailers.length > 5);
assert.strictEqual(separateRetailers[0].label, "Walmart");
assert.strictEqual(separateRetailers[0].fy25, 0);
assert.strictEqual(separateRetailers[0].fy26, 18000);
assertSortedByDeltaDesc(separateRetailers);

const momRetailers = retailerRowsForMpg(RAW.comparisons.mom.modes.blended.rollup_grp, "R&G Small Bag 6/300g");
assert.ok(momRetailers.length > 5);
assert.strictEqual(momRetailers[0].label, "Metro Quebec");
assert.strictEqual(momRetailers[0].fy25, 14191);
assert.strictEqual(momRetailers[0].fy26, 15388);
assertSortedByDeltaDesc(momRetailers);

const audit = fs.readFileSync("data/display-conversion-audit.csv", "utf8");
assert.ok(audit.includes("TDRGSB-48/300,R&G SMALL BAG 48/300GR,Roast & Ground,R&G Small Bag 6/300g,Roast & Ground Displays,R&G Small Bag 48/300g,8.0,yes"));
assert.ok(audit.includes("TDSSKC-48/12,SS KCOMP 48/12CT,Single Serve (K-Cup),SS KComp 6/12ct,Single Serve (K-Cup) Displays,SS KComp 48/12ct,8.0,yes"));
assert.ok(audit.includes("6320912131,TDL ORG/DR/COL KCUP SS 1/2 DRP 145/30 CT,Single Serve (K-Cup),SS KComp 4/30ct,Single Serve (K-Cup) Displays,SS KComp 145/30ct,36.25,yes"));
assert.ok(audit.includes("TDGB-56/5,GRANOLA BAR 56/5EA,Granola Bar,Granola Bar 12/5/30g,Granola Bar Displays,Granola Bar 56/5ea,4.666667,yes"));
assert.ok(audit.includes("6320925922,TDL INST MED/IC SYR CAP/MOC 1/2DRP 288EA,Iced Coffee & Syrups,Instant & Syrup Drp 288/1ea,Iced Coffee & Syrups Displays,Instant & Syrup Drp 288/1ea,1.0,no"));

assert.strictEqual(META.methodology.volume_source, "Product-level Fcst Inc Cases");
assert.strictEqual(META.methodology.row_filter, "Fcst Inc Cases > 0");
assert.strictEqual(META.methodology.product_level, "MPG pack-size level from Product List; individual flavours are combined");
assert.strictEqual(META.generated_from.demand_workbook, "DR 07 July - YoY.xlsx");
assert.strictEqual(META.generated_from.mom_workbook, "DR 07 July - MoM.xlsx");
assert.strictEqual(META.generated_from.market_workbook, "Market List.xlsx");
assert.deepStrictEqual(META.methodology.year_status_filter["2026"], [
  "Closed",
  "Committed",
  "Planned",
]);
assert.strictEqual(META.mode_totals.blended.fy25, 2324823);
assert.strictEqual(META.mode_totals.separate.fy25, 2008605);
assert.strictEqual(META.mode_totals.blended.fy26, 2586883);
assert.strictEqual(META.mode_totals.separate.fy26, 2306380);
assert.strictEqual(META.display_products_converted, 59);
assert.strictEqual(META.unconverted_display_products, 5);
assert.strictEqual(META.comparisons.mom.mode_totals.blended.fy25, 2571167);
assert.strictEqual(META.comparisons.mom.mode_totals.blended.fy26, 2586883);
assert.strictEqual(META.comparisons.mom.display_products_converted, 45);

const dashboardSource = fs.readFileSync("app/demand-dashboard.jsx", "utf8");
assert.ok(!dashboardSource.includes('type="file"'));
assert.ok(!dashboardSource.includes("Upload"));
assert.ok(dashboardSource.includes("DASHBOARD_DATA_URL"));
assert.ok(dashboardSource.includes("Blend DRPs into cases"));
assert.ok(dashboardSource.includes("By Retailer - YoY"));
assert.ok(dashboardSource.includes("By Product Group - YoY"));
assert.ok(dashboardSource.includes("By Retailer - MoM"));
assert.ok(dashboardSource.includes("By Product Group - MoM"));
assert.ok(dashboardSource.includes("row.is_mpg"));
assert.ok(dashboardSource.includes("row.is_retailer"));

console.log("dashboard data tests passed");
