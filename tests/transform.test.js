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

assert.strictEqual(RAW.banner_order.length, 33);
assert.deepStrictEqual(RAW.banner_order.slice(0, 5), [
  "Amazon",
  "Associated Grocers",
  "Atlantic Grocers",
  "Canadian Tire",
  "Chens",
]);
assert.strictEqual(RAW.banner_order.includes("Canada"), false);
assert.strictEqual(RAW.default_mode, "blended");
assert.ok(RAW.comparisons.yoy);
assert.ok(RAW.comparisons.mom);
assert.ok(RAW.modes.blended);
assert.ok(RAW.modes.separate);
assert.ok(RAW.modes.blended.rollup_segment);
assert.ok(RAW.modes.separate.rollup_segment);
assert.strictEqual(RAW.modes.blended.stats.fy25, 1516066);
assert.strictEqual(RAW.modes.blended.stats.fy26, 1300641);
assert.strictEqual(RAW.modes.blended.stats.delta, -215425);
assert.strictEqual(RAW.modes.blended.stats.delta_pct, -14.2);
assert.strictEqual(RAW.modes.blended.stats.banners, 31);
assert.strictEqual(RAW.modes.separate.stats.fy25, 1199848);
assert.strictEqual(RAW.modes.separate.stats.fy26, 1020138);
assert.strictEqual(RAW.modes.separate.stats.delta, -179710);
assert.strictEqual(RAW.modes.separate.stats.delta_pct, -15.0);
assert.strictEqual(RAW.modes.separate.stats.banners, 31);
assert.strictEqual(RAW.comparisons.yoy.modes.blended.stats.fy26, RAW.modes.blended.stats.fy26);
assert.strictEqual(RAW.comparisons.mom.period_labels.base, "June");
assert.strictEqual(RAW.comparisons.mom.period_labels.comparison, "July");
assert.strictEqual(RAW.comparisons.mom.modes.blended.stats.fy25, 1330420);
assert.strictEqual(RAW.comparisons.mom.modes.blended.stats.fy26, 1300641);
assert.strictEqual(RAW.comparisons.mom.modes.blended.stats.delta, -29779);
assert.strictEqual(RAW.comparisons.mom.modes.blended.stats.delta_pct, -2.2);
assert.strictEqual(RAW.comparisons.mom.modes.blended.stats.banners, 29);
assert.strictEqual(RAW.comparisons.mom.modes.separate.stats.fy25, 1058829);
assert.strictEqual(RAW.comparisons.mom.modes.separate.stats.fy26, 1020138);
assert.strictEqual(RAW.comparisons.mom.modes.separate.stats.delta, -38691);
assert.strictEqual(RAW.comparisons.mom.modes.separate.stats.delta_pct, -3.7);
assert.strictEqual(RAW.comparisons.mom.modes.separate.stats.banners, 29);

const grandTotal = RAW.modes.blended.rollup_ret.find((row) => row.label === "GRAND TOTAL");
assert.ok(grandTotal);
assert.strictEqual(grandTotal.fy25, RAW.modes.blended.stats.fy25);
assert.strictEqual(grandTotal.fy26, RAW.modes.blended.stats.fy26);
assert.strictEqual(RAW.modes.blended.rollup_ret.find((row) => row.label === "Amazon"), undefined);
assert.strictEqual(RAW.modes.blended.rollup_ret.find((row) => row.label === "Costco"), undefined);
assert.strictEqual(RAW.modes.blended.rollup_ret.find((row) => row.label === "Canada"), undefined);
assert.strictEqual(RAW.comparisons.mom.modes.blended.rollup_ret.find((row) => row.label === "Amazon"), undefined);
assert.strictEqual(RAW.comparisons.mom.modes.blended.rollup_ret.find((row) => row.label === "Costco"), undefined);
assert.strictEqual(RAW.comparisons.mom.modes.blended.rollup_ret.find((row) => row.label === "Canada"), undefined);

const amazonStandalone = RAW.modes.blended.retailer_totals.find((row) => row.label === "Amazon");
const costcoStandalone = RAW.modes.blended.retailer_totals.find((row) => row.label === "Costco");
const canadaStandalone = RAW.modes.blended.retailer_totals.find((row) => row.label === "Canada");
assert.ok(amazonStandalone);
assert.ok(costcoStandalone);
assert.strictEqual(canadaStandalone, undefined);
assert.strictEqual(amazonStandalone.fy25, 58973);
assert.strictEqual(amazonStandalone.fy26, 31091);
assert.strictEqual(costcoStandalone.fy25, 749784);
assert.strictEqual(costcoStandalone.fy26, 1206151);
const amazonTabGrandTotal = RAW.modes.blended.retailers.Amazon.find((row) => row.label === "GRAND TOTAL");
assert.ok(amazonTabGrandTotal);
assert.strictEqual(amazonTabGrandTotal.fy25, amazonStandalone.fy25);
assert.strictEqual(amazonTabGrandTotal.fy26, amazonStandalone.fy26);

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
assert.strictEqual(RAW.modes.blended.retailers.Canada, undefined);

const categoryFallbackRows = [
  RAW.modes.blended.rollup_grp.find((row) => row.label === "R&G Unspecified"),
  RAW.modes.blended.rollup_grp.find((row) => row.label === "SS KComp Unspecified"),
];
assert.strictEqual(categoryFallbackRows[0].fy26, 8821);
assert.strictEqual(categoryFallbackRows[1].fy26, 14655);

function groupRows(rows) {
  return rows.filter((row) => row.is_group && !row.is_total);
}

function assertDisplayGroupsAtBottom(rows, expectedFirstDisplayGroup) {
  const groups = groupRows(rows);
  const firstDisplayIndex = groups.findIndex((row) => row.label.endsWith(" Displays"));
  assert.ok(firstDisplayIndex > 0, "Missing display category block");
  assert.strictEqual(groups[firstDisplayIndex].label, expectedFirstDisplayGroup);
  assert.strictEqual(groups[firstDisplayIndex].display_section_start, true);
  assert.strictEqual(
    groups.filter((row) => row.display_section_start).length,
    1,
    "Expected one display-section divider marker",
  );

  for (const row of groups.slice(0, firstDisplayIndex)) {
    assert.ok(!row.label.endsWith(" Displays"), `${row.label} should remain in the regular section`);
  }
  for (const row of groups.slice(firstDisplayIndex)) {
    assert.ok(row.label.endsWith(" Displays"), `${row.label} should remain in the display section`);
    assert.strictEqual(row.is_display_group, true);
  }
}

function assertNoDisplayDivider(rows) {
  assert.strictEqual(
    groupRows(rows).filter((row) => row.display_section_start).length,
    0,
    "Blended tables should not have a display-section divider",
  );
}

assertNoDisplayDivider(RAW.modes.blended.rollup_grp);
assertNoDisplayDivider(RAW.comparisons.mom.modes.blended.rollup_grp);
assertNoDisplayDivider(RAW.modes.blended.rollup_segment);
assertNoDisplayDivider(RAW.comparisons.mom.modes.blended.rollup_segment);
assertDisplayGroupsAtBottom(RAW.modes.separate.rollup_grp, "Granola Displays");
assertDisplayGroupsAtBottom(RAW.comparisons.mom.modes.separate.rollup_grp, "Granola Displays");
assertDisplayGroupsAtBottom(RAW.modes.separate.rollup_segment, "Granola Displays");
assertDisplayGroupsAtBottom(RAW.modes.separate.retailers.Walmart, "Hot Chocolate Displays");

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

function retailerRowsForSegment(rows, segment) {
  const start = rows.findIndex((row) => row.label === segment && row.is_group);
  assert.ok(start >= 0, `Missing segment row for ${segment}`);
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

const mpgRoastGround = RAW.modes.blended.rollup_grp.find((row) => row.label === "Roast & Ground" && row.is_group);
const segmentRoastGround = RAW.modes.blended.rollup_segment.find(
  (row) => row.label === "Roast & Ground" && row.is_group,
);
assert.ok(mpgRoastGround);
assert.ok(segmentRoastGround);
assert.strictEqual(segmentRoastGround.fy25, mpgRoastGround.fy25);
assert.strictEqual(segmentRoastGround.fy26, mpgRoastGround.fy26);
assert.strictEqual(RAW.modes.blended.rollup_segment.some((row) => row.is_mpg), false);
const segmentRetailers = retailerRowsForSegment(RAW.modes.blended.rollup_segment, "Roast & Ground");
assert.ok(segmentRetailers.length > 5);
assert.strictEqual(segmentRetailers[0].label, "Walmart");
assert.strictEqual(segmentRetailers[0].fy25, 34293);
assert.strictEqual(segmentRetailers[0].fy26, 65410);
assert.ok(segmentRetailers.every((row) => row.parent_level === "group"));
assertSortedByDeltaDesc(segmentRetailers);

const visibleDrilldownRetailers = new Set([
  "Canadian Tire",
  "Fed Coop",
  "Giant Tiger",
  "Loblaw",
  "Metro Ontario",
  "Metro Quebec",
  "PFG",
  "Pratts Wholesale",
  "SDM",
  "Sobeys Quebec",
  "Sobeys ROC",
  "Walmart",
]);

for (const [label, rows] of [
  ["YoY blended", RAW.modes.blended.rollup_grp],
  ["YoY separate", RAW.modes.separate.rollup_grp],
  ["YoY blended segment", RAW.modes.blended.rollup_segment],
  ["YoY separate segment", RAW.modes.separate.rollup_segment],
  ["MoM blended", RAW.comparisons.mom.modes.blended.rollup_grp],
  ["MoM separate", RAW.comparisons.mom.modes.separate.rollup_grp],
  ["MoM blended segment", RAW.comparisons.mom.modes.blended.rollup_segment],
  ["MoM separate segment", RAW.comparisons.mom.modes.separate.rollup_segment],
]) {
  const hiddenRows = rows.filter((row) => row.is_retailer && !visibleDrilldownRetailers.has(row.label));
  assert.deepStrictEqual(hiddenRows, [], `${label} has non-visible drilldown retailers`);
}

const audit = fs.readFileSync("data/display-conversion-audit.csv", "utf8");
assert.ok(audit.includes("TDRGSB-48/300,R&G SMALL BAG 48/300GR,Roast & Ground,R&G Small Bag 6/300g,Roast & Ground Displays,R&G Small Bag 48/300g,8.0,yes"));
assert.ok(audit.includes("TDSSKC-48/12,SS KCOMP 48/12CT,Single Serve,SS KComp 6/12ct,Single Serve Displays,SS KComp 48/12ct,8.0,yes"));
assert.ok(audit.includes("6320912131,TDL ORG/DR/COL KCUP SS 1/2 DRP 145/30 CT,Single Serve,SS KComp 4/30ct,Single Serve Displays,SS KComp 145/30ct,36.25,yes"));
assert.ok(audit.includes("TDGB-56/5,GRANOLA BAR 56/5EA,Granola,Granola Bar 12/5/30g,Granola Displays,Granola Bar 56/5ea,4.666667,yes"));
assert.ok(audit.includes("6320925922,TDL INST MED/IC SYR CAP/MOC 1/2DRP 288EA,Instant,Instant & Syrup Drp 288/1ea,Instant Displays,Instant & Syrup Drp 288/1ea,1.0,no"));

assert.strictEqual(META.methodology.volume_source, "Product-level Fcst Inc Cases");
assert.strictEqual(META.methodology.row_filter, "Fcst Inc Cases > 0");
assert.strictEqual(META.methodology.product_level, "Product group is sourced from Product List column Q (Demand Review Planner); MPG pack-size level combines individual flavours");
assert.strictEqual(META.generated_from.demand_workbook, "DR 07 July - YoY.xlsx");
assert.strictEqual(META.generated_from.mom_workbook, "DR 07 July - MoM.xlsx");
assert.strictEqual(META.generated_from.product_workbook, "Product List 20260629 (2).xlsx");
assert.strictEqual(META.generated_from.market_workbook, "Market List.xlsx");
assert.deepStrictEqual(META.methodology.year_status_filter["2026"], [
  "Closed",
  "Committed",
  "Planned",
]);
assert.deepStrictEqual(META.methodology.site_excluded_banners, ["Canada"]);
assert.deepStrictEqual(META.methodology.rollup_excluded_banners, ["Amazon", "Costco"]);
assert.deepStrictEqual(META.methodology.product_drilldown_visible_banners, [
  "Canadian Tire",
  "Fed Coop",
  "Giant Tiger",
  "Loblaw",
  "Metro Ontario",
  "Metro Quebec",
  "PFG",
  "Pratts Wholesale",
  "SDM",
  "Sobeys Quebec",
  "Sobeys ROC",
  "Walmart",
]);
assert.strictEqual(META.mode_totals.blended.fy25, 1516066);
assert.strictEqual(META.mode_totals.separate.fy25, 1199848);
assert.strictEqual(META.mode_totals.blended.fy26, 1300641);
assert.strictEqual(META.mode_totals.separate.fy26, 1020138);
assert.strictEqual(META.display_products_converted, 59);
assert.strictEqual(META.unconverted_display_products, 5);
assert.strictEqual(META.comparisons.mom.mode_totals.blended.fy25, 1330420);
assert.strictEqual(META.comparisons.mom.mode_totals.blended.fy26, 1300641);
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
assert.ok(dashboardSource.includes("Quarter"));
assert.ok(dashboardSource.includes("Drilldown"));
assert.ok(dashboardSource.includes("Segment"));
assert.ok(dashboardSource.includes("visibleMonths"));
assert.ok(dashboardSource.includes("row.is_mpg"));
assert.ok(dashboardSource.includes("row.is_retailer"));

console.log("dashboard data tests passed");
