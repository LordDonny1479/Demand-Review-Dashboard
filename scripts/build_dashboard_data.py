from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
DEMAND_XLSX = RAW_DIR / "DR 06 June - 2025 vs 2026.xlsx"
PRODUCT_XLSX = RAW_DIR / "Product List 20260629.xlsx"
OUTPUT_DATA = ROOT / "data" / "demand-review.csv"
OUTPUT_PUBLIC = ROOT / "public" / "data" / "demand-review.csv"
OUTPUT_MAPPING = ROOT / "data" / "product-mpg-mapping.csv"
OUTPUT_UNMAPPED = ROOT / "data" / "unmapped-products.csv"
OUTPUT_UNCONVERTED = ROOT / "data" / "unconverted-display-products.csv"
OUTPUT_SUMMARY = ROOT / "data" / "dashboard-summary.json"

MONTHS = [
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
]

DISPLAY_RE = re.compile(
    r"DISPLAY|DISPLAYER|\bDISP\b|\bDRP\b|1/2\s*DRP|HALF\s*DRP|PDQ|DISPLY",
    re.IGNORECASE,
)
PACK_RE = re.compile(
    r"(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?\s*(?:GR|G|KG|ML|L|CT|EA|LB))\b",
    re.IGNORECASE,
)


def clean(value) -> str:
    return "" if value is None else str(value).strip()


def number(value) -> float:
    if value in (None, ""):
        return 0.0
    return float(value)


def excel_date(value):
    if isinstance(value, datetime):
        return value
    return None


def is_display_text(*parts: str) -> bool:
    return bool(DISPLAY_RE.search(" ".join(part for part in parts if part)))


def parse_pack(text: str):
    match = PACK_RE.search(clean(text).upper().replace(" ", ""))
    if not match:
        return None
    pack_qty = float(match.group(1))
    unit = match.group(2).replace("GR", "G")
    return pack_qty, unit


def format_qty(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def pretty_unit(unit: str) -> str:
    unit = unit.replace("GR", "G")
    for suffix in ("KG", "ML", "CT", "EA", "LB", "L", "G"):
        if unit.endswith(suffix):
            return unit[: -len(suffix)] + suffix.lower()
    return unit.lower()


def pretty_label(text: str) -> str:
    replacements = {
        "R&G": "R&G",
        "SS": "SS",
        "KCOMP": "KComp",
        "HB": "HB",
        "CB": "CB",
        "NCOMP": "NComp",
        "RTD": "RTD",
        "DD": "DD",
    }
    words = []
    for word in re.split(r"(\s+)", text.strip()):
        if word.isspace():
            words.append(word)
            continue
        upper = word.upper()
        words.append(replacements.get(upper, word.capitalize()))
    return "".join(words).strip()


def pretty_pack_size(pack_size: str) -> str:
    text = clean(pack_size)
    compact = text.upper().replace(" ", "")
    match = PACK_RE.search(compact)
    if not match:
        return pretty_label(text)

    pack_qty = format_qty(float(match.group(1)))
    unit = pretty_unit(match.group(2).replace("GR", "G"))
    prefix = text[: text.upper().find(match.group(1))].strip()
    return f"{pretty_label(prefix)} {pack_qty}/{unit}".strip()


def display_pack_candidates(row: dict, rec: dict):
    candidates = [
        parse_pack(row["product"]),
        parse_pack(rec["item"]),
        parse_pack(rec["pack_size"]),
        rec["pack"],
    ]
    unique = []
    seen = set()
    for candidate in candidates:
        if not candidate:
            continue
        key = (candidate[0], candidate[1])
        if key in seen:
            continue
        seen.add(key)
        unique.append(candidate)
    return unique


def product_record(row) -> dict[str, str]:
    return {
        "pack_size_id": clean(row[6]),
        "pack_size": clean(row[7]),
        "item_id": clean(row[8]),
        "item": clean(row[9]),
        "segment": clean(row[5]),
        "planner": clean(row[16]),
    }


def load_products():
    workbook = load_workbook(PRODUCT_XLSX, read_only=True, data_only=True)
    sheet = workbook["Products"]
    products = []
    item_by_id = {}
    pack_groups = defaultdict(list)

    for row in sheet.iter_rows(min_row=6, values_only=True):
        rec = product_record(row)
        rec["pack"] = parse_pack(rec["pack_size"])
        rec["is_display"] = is_display_text(
            rec["pack_size_id"], rec["pack_size"], rec["item"]
        )
        products.append(rec)
        if rec["item_id"]:
            item_by_id[rec["item_id"]] = rec
        if rec["pack_size_id"]:
            pack_groups[rec["pack_size_id"]].append(rec)

    return products, item_by_id, pack_groups


def lookup_product(product_id: str, item_by_id, pack_groups):
    if product_id in item_by_id:
        return item_by_id[product_id]
    group = pack_groups.get(product_id)
    if not group:
        return None
    non_display = [rec for rec in group if not rec["is_display"]]
    return (non_display or group)[0]


def build_base_pack_lookup(products, demand_rows):
    product_master_candidates = defaultdict(Counter)
    for rec in products:
        if rec["pack"] and not rec["is_display"]:
            product_master_candidates[(rec["segment"], rec["pack"][1])][
                rec["pack"][0]
            ] += 1

    demand_candidates = defaultdict(Counter)
    demand_pack_size = {}
    for row in demand_rows:
        rec = row["product_record"]
        if not rec or not rec["pack"]:
            continue
        if row["is_display_product"]:
            continue
        key = (rec["segment"], rec["pack"][1])
        pack_qty = rec["pack"][0]
        demand_candidates[key][pack_qty] += 1
        demand_pack_size[(key, pack_qty)] = rec["pack_size"]

    base = {}
    all_keys = set(product_master_candidates) | set(demand_candidates)
    for key in all_keys:
        source = demand_candidates.get(key) or product_master_candidates.get(key)
        if not source:
            continue
        pack_qty = source.most_common(1)[0][0]
        pack_size = demand_pack_size.get((key, pack_qty))
        if not pack_size:
            for rec in products:
                if rec["pack"] and (rec["segment"], rec["pack"][1]) == key:
                    if rec["pack"][0] == pack_qty and not rec["is_display"]:
                        pack_size = rec["pack_size"]
                        break
        base[key] = {"pack_qty": pack_qty, "pack_size": pack_size or ""}
    return base


def raw_demand_rows(products, item_by_id, pack_groups):
    workbook = load_workbook(DEMAND_XLSX, read_only=True, data_only=True)
    rows = []
    for sheet_name in ("2025", "2026"):
        sheet = workbook[sheet_name]
        for row_number, row in enumerate(
            sheet.iter_rows(min_row=7, values_only=True), start=7
        ):
            if not any(value is not None for value in row):
                continue
            product_id = clean(row[23])
            product = clean(row[24])
            rec = lookup_product(product_id, item_by_id, pack_groups)
            is_display = bool(
                rec
                and is_display_text(
                    product_id,
                    product,
                    rec["pack_size_id"],
                    rec["pack_size"],
                    rec["item"],
                )
            )
            rows.append(
                {
                    "source_sheet": sheet_name,
                    "source_row": row_number,
                    "year": int(sheet_name),
                    "market": clean(row[0]),
                    "contract_start": excel_date(row[1]),
                    "execution_start": excel_date(row[2]),
                    "tls_ship_start": excel_date(row[3]),
                    "description": clean(row[6]),
                    "promo_id": clean(row[7]),
                    "approval_status": clean(row[8]),
                    "promo_status": clean(row[9]),
                    "product_id": product_id,
                    "product": product,
                    "promotion_type": clean(row[28]),
                    "forecast_base_cases": number(row[34]),
                    "forecast_incremental_cases": number(row[35]),
                    "forecast_total_cases": number(row[36]),
                    "product_record": rec,
                    "is_display_product": is_display,
                }
            )
    return rows


def source_month(row) -> str:
    date = row["tls_ship_start"] or row["execution_start"] or row["contract_start"]
    if not date:
        return ""
    return MONTHS[date.month - 1]


def build_outputs():
    products, item_by_id, pack_groups = load_products()
    demand_rows = raw_demand_rows(products, item_by_id, pack_groups)
    base_lookup = build_base_pack_lookup(products, demand_rows)

    normalized = []
    mapping_rows = {}
    unmapped = []
    unconverted = []

    for row in demand_rows:
        rec = row["product_record"]
        if not rec or not rec["pack"]:
            unmapped.append(row)
            continue

        month = source_month(row)
        if not month:
            unmapped.append(row | {"unmapped_reason": "Missing source date"})
            continue

        source_qty = row["forecast_total_cases"]
        pack = rec["pack"]
        base = base_lookup.get((rec["segment"], pack[1]))
        conversion = 1.0
        unit_type = "CASE"
        base_pack_size = rec["pack_size"]
        conversion_note = "Product-level forecast total cases"

        if row["is_display_product"]:
            candidates = display_pack_candidates(row, rec)
            display_pack = next(
                (
                    candidate
                    for candidate in candidates
                    if base_lookup.get((rec["segment"], candidate[1]))
                ),
                candidates[0] if candidates else None,
            )
            base = (
                base_lookup.get((rec["segment"], display_pack[1]))
                if display_pack
                else None
            )
            unit_type = "DRP"
            if base and display_pack:
                conversion = display_pack[0] / base["pack_qty"]
                base_pack_size = base["pack_size"]
                conversion_note = (
                    f"Display pack {format_qty(display_pack[0])}/{display_pack[1]} "
                    f"converted to regular case pack {format_qty(base['pack_qty'])}/{display_pack[1]}"
                )
            else:
                conversion = 1.0
                conversion_note = "Display product without matching regular pack; left as reported cases"
                unconverted.append(row)

        mpg = pretty_pack_size(base_pack_size)
        cases = source_qty * conversion
        normalized_row = {
            "retailer": row["market"],
            "year": row["year"],
            "month": month,
            "mpg": mpg,
            "product": row["product"],
            "product_id": row["product_id"],
            "source_product": row["product"],
            "unit_type": unit_type,
            "quantity": round(source_qty, 6),
            "cases_per_drp": "" if unit_type == "CASE" else round(conversion, 6),
            "cases": round(cases, 6),
            "source_sheet": row["source_sheet"],
            "source_row": row["source_row"],
            "promo_id": row["promo_id"],
            "promotion_type": row["promotion_type"],
            "date_source": (
                row["tls_ship_start"] or row["execution_start"] or row["contract_start"]
            ).date().isoformat(),
            "product_pack_size": pretty_pack_size(rec["pack_size"]),
            "base_pack_size": pretty_pack_size(base_pack_size),
            "conversion_note": conversion_note,
        }
        normalized.append(normalized_row)

        mapping_key = (row["product_id"], row["product"], mpg, unit_type)
        mapping_rows[mapping_key] = {
            "product_id": row["product_id"],
            "product": row["product"],
            "mpg": mpg,
            "unit_type": unit_type,
            "product_pack_size": pretty_pack_size(rec["pack_size"]),
            "base_pack_size": pretty_pack_size(base_pack_size),
            "cases_per_drp": "" if unit_type == "CASE" else round(conversion, 6),
            "conversion_note": conversion_note,
        }

    normalized.sort(
        key=lambda row: (
            row["retailer"],
            row["mpg"],
            row["year"],
            MONTHS.index(row["month"]),
            row["product_id"],
            row["source_row"],
        )
    )

    for path in (OUTPUT_DATA.parent, OUTPUT_PUBLIC.parent):
        path.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "retailer",
        "year",
        "month",
        "mpg",
        "product",
        "product_id",
        "source_product",
        "unit_type",
        "quantity",
        "cases_per_drp",
        "cases",
        "source_sheet",
        "source_row",
        "promo_id",
        "promotion_type",
        "date_source",
        "product_pack_size",
        "base_pack_size",
        "conversion_note",
    ]
    write_csv(OUTPUT_DATA, fieldnames, normalized)
    write_csv(OUTPUT_PUBLIC, fieldnames, normalized)

    write_csv(
        OUTPUT_MAPPING,
        [
            "product_id",
            "product",
            "mpg",
            "unit_type",
            "product_pack_size",
            "base_pack_size",
            "cases_per_drp",
            "conversion_note",
        ],
        sorted(mapping_rows.values(), key=lambda row: (row["mpg"], row["product_id"])),
    )

    write_csv(
        OUTPUT_UNMAPPED,
        [
            "source_sheet",
            "source_row",
            "retailer",
            "product_id",
            "product",
            "forecast_total_cases",
            "promo_id",
            "promotion_type",
            "description",
            "unmapped_reason",
        ],
        [
            {
                "source_sheet": row["source_sheet"],
                "source_row": row["source_row"],
                "retailer": row["market"],
                "product_id": row["product_id"],
                "product": row["product"],
                "forecast_total_cases": row["forecast_total_cases"],
                "promo_id": row["promo_id"],
                "promotion_type": row["promotion_type"],
                "description": row["description"],
                "unmapped_reason": row.get("unmapped_reason", "Product ID not found in product list or no pack size"),
            }
            for row in unmapped
        ],
    )

    write_csv(
        OUTPUT_UNCONVERTED,
        [
            "source_sheet",
            "source_row",
            "retailer",
            "product_id",
            "product",
            "forecast_total_cases",
            "promo_id",
            "promotion_type",
            "description",
        ],
        [
            {
                "source_sheet": row["source_sheet"],
                "source_row": row["source_row"],
                "retailer": row["market"],
                "product_id": row["product_id"],
                "product": row["product"],
                "forecast_total_cases": row["forecast_total_cases"],
                "promo_id": row["promo_id"],
                "promotion_type": row["promotion_type"],
                "description": row["description"],
            }
            for row in unconverted
        ],
    )

    summary = {
        "generated_from": {
            "demand_workbook": DEMAND_XLSX.name,
            "product_workbook": PRODUCT_XLSX.name,
        },
        "output_rows": len(normalized),
        "unique_retailers": len({row["retailer"] for row in normalized}),
        "unique_mpgs": len({row["mpg"] for row in normalized}),
        "display_rows_converted": sum(1 for row in normalized if row["unit_type"] == "DRP"),
        "unmapped_rows": len(unmapped),
        "unconverted_display_rows": len(unconverted),
        "total_cases_2025": round(sum(row["cases"] for row in normalized if row["year"] == 2025), 2),
        "total_cases_2026": round(sum(row["cases"] for row in normalized if row["year"] == 2026), 2),
    }
    OUTPUT_SUMMARY.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    print(json.dumps(build_outputs(), indent=2))
