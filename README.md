# Demand Review Dashboard

Sites dashboard for reviewing monthly demand changes by retailer and MPG.

## Data format

Upload a CSV with these columns:

- `retailer`
- `year`
- `month`
- `mpg`
- `product`
- `unit_type` (`CASE` or `DRP`)
- `quantity`
- `cases_per_drp` (required for DRP rows)

The dashboard converts DRP display quantities to cases, combines cases at the retailer + MPG + month level, and displays `2026 cases - 2025 cases` for each month.

## Run locally

Install dependencies and start the Sites dev server:

```bash
npm ci
npm run dev
```

The dashboard loads `public/data/demand-review-sample.csv` by default and can
replace it in-session with the CSV upload control.

## Test

```bash
npm test
```
