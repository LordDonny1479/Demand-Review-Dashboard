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
assert.strictEqual(RAW.stats.fy25, 1432728);
assert.strictEqual(RAW.stats.fy26, 1157633);
assert.strictEqual(RAW.stats.delta, -275095);
assert.strictEqual(RAW.stats.delta_pct, -19.2);

const grandTotal = RAW.rollup_ret.find((row) => row.label === "GRAND TOTAL");
assert.ok(grandTotal);
assert.strictEqual(grandTotal.fy25, RAW.stats.fy25);
assert.strictEqual(grandTotal.fy26, RAW.stats.fy26);

const walmart = RAW.rollup_ret.find((row) => row.label === "Walmart");
assert.ok(walmart);
assert.strictEqual(walmart.fy25, 394261);
assert.strictEqual(walmart.fy26, 319133);

const audit = fs.readFileSync("data/display-conversion-audit.csv", "utf8");
assert.ok(audit.includes("TDRGSB-48/300,R&G SMALL BAG 48/300GR,Roast & Ground,R&G Small Bag 6/300g,8.0,yes"));
assert.ok(audit.includes("TDSSKC-48/12,SS KCOMP 48/12CT,Single Serve (K-Cup),SS KComp 6/12ct,8.0,yes"));
assert.ok(audit.includes("6320912131,TDL ORG/DR/COL KCUP SS 1/2 DRP 145/30 CT,Single Serve (K-Cup),SS KComp 4/30ct,36.25,yes"));

assert.strictEqual(META.methodology.volume_source, "Product-level Fcst Inc Cases");
assert.strictEqual(META.methodology.row_filter, "Fcst Inc Cases > 0");
assert.strictEqual(META.methodology.product_level, "MPG pack-size level from Product List; individual flavours are combined");
assert.strictEqual(META.display_products_converted, 47);
assert.strictEqual(META.unconverted_display_products, 3);

const dashboardSource = fs.readFileSync("app/demand-dashboard.jsx", "utf8");
assert.ok(!dashboardSource.includes('type="file"'));
assert.ok(!dashboardSource.includes("Upload"));
assert.ok(dashboardSource.includes("./data/promo-yoy-data"));

console.log("dashboard data tests passed");
