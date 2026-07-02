import assert from "node:assert";
import {
  buildDemandReview,
  parseCsv,
  pivotByRetailerAndMpg,
  toCases,
} from "../app/lib/demand-review.js";

const rows = parseCsv(`retailer,year,month,mpg,product,unit_type,quantity,cases_per_drp
Retailer A,2025,June,Instant 6/100g,Flavour A,CASE,2500,
Retailer A,2026,June,Instant 6/100g,Flavour A,CASE,3000,
Retailer A,2026,June,Instant 6/100g,Display,DRP,2,12`);

assert.strictEqual(toCases(rows[2]), 24);
const review = buildDemandReview(rows);
assert.strictEqual(review.length, 1);
assert.strictEqual(review[0].baseCases, 2500);
assert.strictEqual(review[0].comparisonCases, 3024);
assert.strictEqual(review[0].difference, 524);
const pivot = pivotByRetailerAndMpg(review);
assert.strictEqual(pivot[0].months.June.difference, 524);
console.log("transform tests passed");
