# Demand Review Dashboard

Sites dashboard for reviewing monthly demand changes by customer/retailer and
MPG. The main table shows `2026 cases - 2025 cases` for each month.

## Source data

Raw workbooks are stored in `data/raw`:

- `DR 06 June - 2025 vs 2026.xlsx`
- `Product List 20260629.xlsx`

The generated dashboard CSV is stored in both `data/demand-review.csv` and
`public/data/demand-review.csv`; the `public` copy is what the hosted site
loads.

## Data transformation

Run:

```bash
python scripts/build_dashboard_data.py
```

The builder:

- uses product-level `Fcst Total Cases` from the demand workbook;
- uses `TLS Ship Start` for the demand month, falling back to execution or
  contract start when needed;
- maps demand product IDs through `Item ID` or `Pack Size ID` in the product
  list;
- groups products at MPG pack-size level, such as `Instant Coffee 12/100g`;
- converts display/DRP/PDQ rows into regular cases using matching regular pack
  sizes from demand-used product master data;
- writes audit files for product mapping, unmapped rows, and display rows that
  could not be converted from available metadata.

Rows that only map to broad `TDL CAN` product IDs are excluded from product MPG
totals and preserved in `data/unmapped-products.csv`.

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
