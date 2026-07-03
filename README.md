# Demand Review Dashboard

Sites dashboard for reviewing Tim Hortons CPG promotional forecast incremental
cases year-over-year between 2025 and 2026.

The dashboard is built from embedded generated data. There is no upload control
in the site.

In the all-retailer Product Group view, product groups expand into MPGs and
MPGs expand into retailer rows sorted by full-year delta from highest to lowest.
Those drilldown values switch with the display blending toggle.

## Source data

Raw workbooks are stored in `data/raw`:

- `DR 07 July - YoY.xlsx`
- `Product List 20260629.xlsx`
- `Market List.xlsx`

Generated dashboard data is written to:

- `app/data/promo-yoy-data.js` for the website bundle
- `data/promo-yoy-dashboard.json` for the table payload
- `data/promo-yoy-detail.csv` for row-level audit detail
- `data/display-conversion-audit.csv` for DRP/display conversion checks
- `data/promo-yoy-excluded-rows.csv` for rows excluded by methodology
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
- includes 2026 rows with `Planned` or `Committed` promo status;
- uses `Execution Start` through `Execution End`;
- pro-rates cases into calendar months by inclusive execution days;
- maps products through the product list and combines flavours at MPG pack-size
  level;
- maps retailer/customer names through `Market List.xlsx` and renders active
  mapped retailers from the current demand workbook;
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
cases, fail the status filter, or cannot map to an MPG are preserved in
`data/promo-yoy-excluded-rows.csv`.

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
