# Demand Review Dashboard

Sites dashboard for reviewing Tim Hortons CPG promotional forecast incremental
cases year-over-year between 2025 and 2026, plus month-over-month changes
between the September and October forecast pulls.

The dashboard is built from embedded generated data. There is no upload control
in the site.

In the all-retailer Product Group views, product groups expand into MPGs and
MPGs expand into selected major-retailer rows sorted by full-year delta/change.
Retailer rows then expand into the promo IDs sourced from column H of the demand
workbooks. In the all-retailer Retailer views, each retailer expands into product
group, MPG, and promo ID. Retailer-specific tabs include a YoY/MoM selector and
expand from product group to MPG to promo ID. All drilldown values switch with
the display blending toggle.

The By Retailer and By Product Group YoY/MoM tabs also include a second table
for net inventory build and burn. It uses the same hierarchy, promo drilldowns,
month range, quarter, zero filtering, and display treatment as the forecast
volume table above it.

## Source data

Raw workbooks are stored in `data/raw`:

- `DR 2025 - 2026-10-02 (EXCEXP_TLS_000JJKSK3).xlsx` for the latest 2025 YoY pull
- `DR 2026 - 2026-10-02 (EXCEXP_TLS_000JJKSJR).xlsx` for the latest 2026 YoY and October MoM pull
- `DR 2026 - 2026-08-28 (EXCEXP_TLS_000JHWRH0).xlsx` for the September-labelled MoM baseline previously in the site
- `Product List 20260629 (2).xlsx`
- `Market List.xlsx`

Approved market alias: `CG-LCL` maps to `Loblaw`. This retains the two promotions
that moved from `NA-LOBLAWS` to `CG-LCL` in the October pull. Original reports
and the market mapping workbook remain unchanged.

Generated dashboard data is written to:

- `app/data/promo-yoy-data.js` for the website data URL helper
- `public/data/promo-dashboard-data.json` for the embedded static site payload
- `data/promo-yoy-dashboard.json` for the table payload
- `data/promo-yoy-detail.csv` for row-level audit detail
- `data/promo-mom-dashboard.json` for the month-over-month table payload
- `data/promo-mom-detail.csv` for month-over-month row-level audit detail
- `data/promo-yoy-inventory-detail.csv` for YoY inventory build/burn audit detail
- `data/promo-mom-inventory-detail.csv` for MoM inventory build/burn audit detail
- `data/display-conversion-audit.csv` for DRP/display conversion checks
- `data/promo-yoy-excluded-rows.csv` for rows excluded by methodology
- `data/promo-mom-excluded-rows.csv` for MoM rows excluded by methodology
- `data/dashboard-summary.json` for transformation totals

## Methodology

Run:

```bash
python scripts/build_dashboard_data.py
```

The builder:

- uses product-level `Fcst Inc Cases`;
- keeps only rows where `Fcst Inc Cases > 0`;
- includes 2025 rows with `Closed` or `Committed` promo status;
- includes 2026 rows with `Closed`, `Planned`, or `Committed` promo status;
- compares YoY as 2026 less 2025 and MoM as the October pull less the September-labelled pull;
- uses `Execution Start` through `Execution End`;
- pro-rates cases into calendar months by inclusive execution days;
- treats inventory build as positive cases prorated from `TLS Ship Start`
  through `Execution Start`, inclusive;
- treats inventory burn as the same volume in negative cases prorated from
  `Execution Start` through `Execution End`, inclusive;
- assigns the full build to the `TLS Ship Start` month when a source row has
  ship start after execution start;
- maps products through the product list and combines flavours at MPG pack-size
  level;
- maps retailer/customer names through `Market List.xlsx` and renders active
  mapped retailers from the current demand workbook;
- carries promo IDs from demand-workbook column H into reconciled drilldowns;
- excludes Amazon and Costco from all-retailer rollup tabs, product-group
  rollup totals, and top-line rollup statistics, while keeping their individual
  retailer tabs intact;
- limits product-group retailer drilldowns to selected major retailers while
  keeping product-group and MPG totals at the full rollup scope;
- retains material category-level rows without pack-size detail as transparent
  `Unspecified` MPG rows rather than dropping their volume;
- generates two display modes:
  - blended mode converts display, DRP, and PDQ pack sizes into equivalent
    regular cases and blends them into the regular MPG;
  - separate mode keeps display rows on their display MPG and counts each
    display/DRP as 1 case;
- writes a display-conversion audit showing converted and unconverted display
  products.

Rows that cannot be mapped to a supplied retailer, have no positive incremental
cases, fail the status filter, or cannot map to an MPG are preserved in the
excluded-row CSV for the relevant comparison.

## Run locally

Install dependencies and start the Sites dev server:

```bash
pnpm install
pnpm dev
```

## Test

```bash
pnpm test
pnpm build
```
