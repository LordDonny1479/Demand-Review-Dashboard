import assert from "node:assert";
import fs from "node:fs";
import { META, MONTHS, RAW } from "../app/data/promo-yoy-data.js";

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

assert.strictEqual(RAW.banner_order.length, 11);
assert.strictEqual(RAW.default_mode, "blended");
assert.ok(RAW.modes.blended);
assert.ok(RAW.modes.separate);
assert.strictEqual(RAW.modes.blended.stats.fy25, 1432728);
assert.strictEqual(RAW.modes.blended.stats.fy26, 1157633);
assert.strictEqual(RAW.modes.blended.stats.delta, -275095);
assert.strictEqual(RAW.modes.blended.stats.delta_pct, -19.2);
assert.strictEqual(RAW.modes.separate.stats.fy25, 1037293);
assert.strictEqual(RAW.modes.separate.stats.fy26, 888666);
assert.strictEqual(RAW.modes.separate.stats.delta, -148627);
assert.strictEqual(RAW.modes.separate.stats.delta_pct, -14.3);

const grandTotal = RAW.modes.blended.rollup_ret.find((row) => row.label === "GRAND TOTAL");
assert.ok(grandTotal);
assert.strictEqual(grandTotal.fy25, RAW.modes.blended.stats.fy25);
assert.strictEqual(grandTotal.fy26, RAW.modes.blended.stats.fy26);

const walmart = RAW.modes.blended.rollup_ret.find((row) => row.label === "Walmart");
assert.ok(walmart);
assert.strictEqual(walmart.fy25, 394261);
assert.strictEqual(walmart.fy26, 319133);

const separateWalmart = RAW.modes.separate.rollup_ret.find((row) => row.label === "Walmart");
assert.ok(separateWalmart);
assert.strictEqual(separateWalmart.fy25, 84306);
assert.strictEqual(separateWalmart.fy26, 132812);

const separateDisplayGroup = RAW.modes.separate.rollup_grp.find((row) => row.label === "Roast & Ground Displays");
assert.ok(separateDisplayGroup);
assert.strictEqual(separateDisplayGroup.fy25, 5364);
assert.strictEqual(separateDisplayGroup.fy26, 5039);

const blendedDisplayGroup = RAW.modes.blended.rollup_grp.find((row) => row.label === "Roast & Ground Displays");
assert.strictEqual(blendedDisplayGroup, undefined);

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

const audit = fs.readFileSync("data/display-conversion-audit.csv", "utf8");
assert.ok(audit.includes("TDRGSB-48/300,R&G SMALL BAG 48/300GR,Roast & Ground,R&G Small Bag 6/300g,Roast & Ground Displays,R&G Small Bag 48/300g,8.0,yes"));
assert.ok(audit.includes("TDSSKC-48/12,SS KCOMP 48/12CT,Single Serve (K-Cup),SS KComp 6/12ct,Single Serve (K-Cup) Displays,SS KComp 48/12ct,8.0,yes"));
assert.ok(audit.includes("6320912131,TDL ORG/DR/COL KCUP SS 1/2 DRP 145/30 CT,Single Serve (K-Cup),SS KComp 4/30ct,Single Serve (K-Cup) Displays,SS KComp 145/30ct,36.25,yes"));

assert.strictEqual(META.methodology.volume_source, "Product-level Fcst Inc Cases");
assert.strictEqual(META.methodology.row_filter, "Fcst Inc Cases > 0");
assert.strictEqual(META.methodology.product_level, "MPG pack-size level from Product List; individual flavours are combined");
assert.strictEqual(META.mode_totals.blended.fy25, 1432728);
assert.strictEqual(META.mode_totals.separate.fy25, 1037293);
assert.strictEqual(META.display_products_converted, 47);
assert.strictEqual(META.unconverted_display_products, 3);

const dashboardSource = fs.readFileSync("app/demand-dashboard.jsx", "utf8");
assert.ok(!dashboardSource.includes('type="file"'));
assert.ok(!dashboardSource.includes("Upload"));
assert.ok(dashboardSource.includes("./data/promo-yoy-data"));
assert.ok(dashboardSource.includes("Blend DRPs into cases"));
assert.ok(dashboardSource.includes("row.is_mpg"));
assert.ok(dashboardSource.includes("row.is_retailer"));

console.log("dashboard data tests passed");
