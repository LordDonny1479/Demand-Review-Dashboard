from __future__ import annotations

import calendar
import csv
import json
import math
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
DEMAND_XLSX = RAW_DIR / "DR 06 June - 2025 vs 2026.xlsx"
PRODUCT_XLSX = RAW_DIR / "Product List 20260629.xlsx"

OUTPUT_MODULE = ROOT / "app" / "data" / "promo-yoy-data.js"
OUTPUT_DASHBOARD_JSON = ROOT / "data" / "promo-yoy-dashboard.json"
OUTPUT_DETAIL = ROOT / "data" / "promo-yoy-detail.csv"
OUTPUT_EXCLUDED = ROOT / "data" / "promo-yoy-excluded-rows.csv"
OUTPUT_DISPLAY_AUDIT = ROOT / "data" / "display-conversion-audit.csv"
OUTPUT_SUMMARY = ROOT / "data" / "dashboard-summary.json"

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
YEARS = (2025, 2026)
STATUS_BY_YEAR = {
    2025: {"Closed", "Committed"},
    2026: {"Planned", "Committed"},
}

BANNER_ORDER = [
    "Sobeys Banners FS",
    "FreshCo",
    "Sobeys Quebec",
    "Metro Ontario",
    "Metro Quebec",
    "Pattison Food Group",
    "Giant Tiger",
    "FCL",
    "Canadian Tire",
    "Walmart",
    "Loblaws",
]

DIRECT_BANNERS = {
    "BT-SOBEYS ONTARIO": "Sobeys Banners FS",
    "CG-SOBEY'S QUEBEC": "Sobeys Quebec",
    "BT-SOBEYS QC MONTREAL": "Sobeys Quebec",
    "NA-METRO ONTARIO": "Metro Ontario",
    "NA-METRO QUEBEC": "Metro Quebec",
    "NA-PATTISON FOOD GROUP": "Pattison Food Group",
    "NA-OVERWAITEA FOOD GROUP": "Pattison Food Group",
    "NA-GIANT TIGER": "Giant Tiger",
    "NA-FED CO-OP": "FCL",
    "NA-CANADIAN TIRE": "Canadian Tire",
    "NA-WAL-MART": "Walmart",
    "NA-LOBLAWS": "Loblaws",
}

GROUP_ORDER = [
    "Granola Bar",
    "Hot Choc & Cappuccino",
    "Iced Coffee & Syrups",
    "Instant Coffee",
    "Nespresso Compatible",
    "Roast & Ground",
    "Single Serve (K-Cup)",
    "Soup & Chili",
    "Tassimo",
    "Tea",
    "Other",
]

DATA_MODES = {
    "blended": "Blend DRPs/displays into regular-case equivalents",
    "separate": "Keep DRPs/displays separate and count each display as 1 case",
}

DISPLAY_RE = re.compile(
    r"DISPLAY|DISPLAYER|\bDISP\b|\bDRP\b|1/2\s*DRP|HALF\s*DRP|PDQ|DISPLY",
    re.IGNORECASE,
)
PACK_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*/\s*"
    r"(\d+(?:\.\d+)?(?:\s*/\s*\d+(?:\.\d+)?)?\s*(?:GR|G|KG|ML|L|CT|EA|LB))",
    re.IGNORECASE,
)


def clean(value) -> str:
    return "" if value is None else str(value).strip()


def number(value) -> float:
    if value in (None, ""):
        return 0.0
    return float(value)


def as_date(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def is_display_text(*parts: str) -> bool:
    return bool(DISPLAY_RE.search(" ".join(part for part in parts if part)))


def normalize_unit(unit: str) -> str:
    return clean(unit).upper().replace(" ", "").replace("GR", "G")


def parse_pack(text: str):
    match = PACK_RE.search(clean(text).upper())
    if not match:
        return None
    return float(match.group(1)), normalize_unit(match.group(2))


def format_qty(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def pretty_unit(unit: str) -> str:
    unit = normalize_unit(unit)
    for suffix in ("KG", "ML", "CT", "EA", "LB", "L", "G"):
        if unit.endswith(suffix):
            return f"{unit[:-len(suffix)]}{suffix.lower()}"
    return unit.lower()


def pretty_label(text: str) -> str:
    replacements = {
        "R&G": "R&G",
        "SS": "SS",
        "KCOMP": "KComp",
        "NCOMP": "NComp",
        "HB": "HB",
        "CB": "CB",
        "RTD": "RTD",
        "FVC": "FVC",
        "TDL": "TDL",
        "KCUP": "K-Cup",
    }
    parts = []
    for token in re.split(r"(\s+)", clean(text)):
        if token.isspace():
            parts.append(token)
            continue
        parts.append(replacements.get(token.upper(), token.capitalize()))
    return "".join(parts).strip()


def pretty_pack_size(pack_size: str) -> str:
    text = clean(pack_size)
    match = PACK_RE.search(text.upper())
    if not match:
        return pretty_label(text)
    prefix = text[: match.start()].strip()
    qty = format_qty(float(match.group(1)))
    unit = pretty_unit(match.group(2))
    return f"{pretty_label(prefix)} {qty}/{unit}".strip()


def map_banner(market: str, description: str) -> str | None:
    market = clean(market)
    if market == "CG-SOBEY'S ROC":
        return "FreshCo" if re.search(r"\bfresh\s*co\b|freshco", description, re.IGNORECASE) else "Sobeys Banners FS"
    return DIRECT_BANNERS.get(market)


def infer_planner(*parts: str) -> str:
    text = " ".join(clean(part).upper() for part in parts)
    if "INSTANT" in text:
        return "Instant"
    if "NCOMP" in text or "NESPRESSO" in text:
        return "Nespresso"
    if "TASSIMO" in text:
        return "Tassimo"
    if "KCOMP" in text or "K-CUP" in text or "KCUP" in text:
        return "Single Serve"
    if "R&G" in text or "ROAST" in text or "GROUND" in text:
        return "Roast & Ground"
    if "HOT CHOC" in text or "CAPPUCCINO" in text or "CREAMER" in text:
        return "Hot Chocolate"
    if "SOUP" in text or "CHILI" in text or "HOT BOWL" in text:
        return "Soups and Hot Bowls"
    if "TEA" in text:
        return "Hot Tea"
    if "GRANOLA" in text:
        return "Granola"
    if "SYRUP" in text or "READY TO DRINK" in text or "RTD" in text or "COLD" in text:
        return "Cold Beverage"
    return "Other"


def product_group_label(mpg: str, planner: str, segment: str = "") -> str:
    text = f"{mpg} {planner} {segment}".upper()
    if "GRANOLA" in text:
        return "Granola Bar"
    if "HOT CHOC" in text or "CAPPUCCINO" in text or "CREAMER" in text:
        return "Hot Choc & Cappuccino"
    if "SYRUP" in text or "READY TO DRINK" in text or "RTD" in text or "COLD BEVERAGE" in text:
        return "Iced Coffee & Syrups"
    if "INSTANT" in text:
        return "Instant Coffee"
    if "NCOMP" in text or "NESPRESSO" in text:
        return "Nespresso Compatible"
    if "TASSIMO" in text:
        return "Tassimo"
    if "KCOMP" in text or "K-CUP" in text or "KCUP" in text:
        return "Single Serve (K-Cup)"
    if "R&G" in text or "ROAST" in text or "GROUND" in text:
        return "Roast & Ground"
    if "SOUP" in text or "CHILI" in text or "HOT BOWL" in text or "CONDENSED" in text:
        return "Soup & Chili"
    if "TEA" in text:
        return "Tea"
    return "Other"


def display_group_label(group: str) -> str:
    return f"{group} Displays"


def family_key(rec: dict) -> str:
    planner = clean(rec.get("planner", "")).upper()
    pack_text = clean(rec.get("pack_size", "")).upper()
    item_text = clean(rec.get("item", "")).upper()
    text = " ".join(
        clean(rec.get(key, "")).upper()
        for key in ("pack_size", "item", "planner", "segment", "sub_category_1")
    )

    if "INSTANT" in planner or "INSTANT" in pack_text:
        return "instant"
    if "NESPRESSO" in planner or "NCOMP" in pack_text or "NESPRESSO" in text:
        return "nespresso"
    if "TASSIMO" in planner or "TASSIMO" in pack_text or "TASSIMO" in item_text:
        return "tassimo"
    if "HOT CHOCOLATE" in planner or "SWEET" in planner or "HOT CHOC" in pack_text:
        return "hot_chocolate"
    if "SINGLE SERVE" in planner or "KCOMP" in pack_text or "K-CUP" in text or "KCUP" in text:
        return "kcomp"
    if "ROAST" in planner or "R&G" in text or "ROAST" in text or "GROUND" in text:
        return "roast_ground"
    if "SOUP" in planner or "SOUP" in text or "CHILI" in text or "HOT BOWL" in text:
        return "soup"
    if "TEA" in planner or "TEA" in text:
        return "tea"
    if "COLD" in planner or "SYRUP" in text or "READY TO DRINK" in text or "RTD" in text:
        return "cold_beverage"
    return clean(rec.get("planner")) or clean(rec.get("segment")) or "other"


def product_record(row) -> dict:
    pack_size_id = clean(row[6])
    pack_size = clean(row[7])
    item_id = clean(row[8])
    item = clean(row[9])
    rec = {
        "line_of_business": clean(row[1]),
        "brand": clean(row[3]),
        "segment": clean(row[5]),
        "pack_size_id": pack_size_id,
        "pack_size": pack_size,
        "item_id": item_id,
        "item": item,
        "sub_category_1": clean(row[15]),
        "planner": clean(row[16]) or clean(row[15]) or infer_planner(pack_size, item),
        "lookup_source": "product_master",
    }
    rec["pack"] = parse_pack(pack_size)
    rec["is_display"] = is_display_text(pack_size_id, pack_size, item)
    return rec


def fallback_product_record(product_id: str, product: str) -> dict | None:
    pack = parse_pack(product)
    if not pack:
        return None
    planner = infer_planner(product_id, product)
    rec = {
        "line_of_business": "",
        "brand": "",
        "segment": planner,
        "pack_size_id": product_id,
        "pack_size": product,
        "item_id": product_id,
        "item": product,
        "sub_category_1": "",
        "planner": planner,
        "lookup_source": "demand_product_text",
        "pack": pack,
        "is_display": is_display_text(product_id, product),
    }
    return rec


def load_products():
    workbook = load_workbook(PRODUCT_XLSX, read_only=True, data_only=True)
    sheet = workbook["Products"]
    products = []
    item_by_id = {}
    pack_groups = defaultdict(list)

    for row in sheet.iter_rows(min_row=6, values_only=True):
        rec = product_record(row)
        products.append(rec)
        if rec["item_id"]:
            item_by_id[rec["item_id"]] = rec
        if rec["pack_size_id"]:
            pack_groups[rec["pack_size_id"]].append(rec)

    return products, item_by_id, pack_groups


def lookup_product(product_id: str, product: str, item_by_id, pack_groups):
    if product_id in item_by_id:
        return item_by_id[product_id]

    group = pack_groups.get(product_id)
    if group:
        display_product = is_display_text(product_id, product)
        preferred = [
            rec
            for rec in group
            if rec["is_display"] == display_product or is_display_text(product, rec["item"])
        ]
        non_display = [rec for rec in group if not rec["is_display"]]
        return (preferred or non_display or group)[0]

    return fallback_product_record(product_id, product)


def raw_demand_rows(item_by_id, pack_groups):
    workbook = load_workbook(DEMAND_XLSX, read_only=True, data_only=True)
    rows = []

    for sheet_name in ("2025", "2026"):
        sheet = workbook[sheet_name]
        year = int(sheet_name)
        for row_number, row in enumerate(sheet.iter_rows(min_row=7, values_only=True), start=7):
            if not any(value is not None for value in row):
                continue

            product_id = clean(row[23])
            product = clean(row[24])
            rec = lookup_product(product_id, product, item_by_id, pack_groups)
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
                    "year": year,
                    "market": clean(row[0]),
                    "contract_start": as_date(row[1]),
                    "execution_start": as_date(row[2]),
                    "tls_ship_start": as_date(row[3]),
                    "contract_end": as_date(row[4]),
                    "execution_end": as_date(row[5]),
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


def build_base_pack_lookup(products, demand_rows):
    master_candidates = defaultdict(Counter)
    demand_candidates = defaultdict(Counter)
    pack_size_by_key = {}

    for rec in products:
        if rec["pack"] and not rec["is_display"]:
            key = (family_key(rec), rec["pack"][1])
            master_candidates[key][rec["pack"][0]] += 1
            pack_size_by_key.setdefault((key, rec["pack"][0]), rec["pack_size"])

    for row in demand_rows:
        rec = row["product_record"]
        if not rec or not rec.get("pack") or row["is_display_product"]:
            continue
        key = (family_key(rec), rec["pack"][1])
        demand_candidates[key][rec["pack"][0]] += 1
        pack_size_by_key[(key, rec["pack"][0])] = rec["pack_size"]

    lookup = {}
    for key in set(master_candidates) | set(demand_candidates):
        source = demand_candidates.get(key) or master_candidates.get(key)
        if not source:
            continue
        pack_qty = source.most_common(1)[0][0]
        lookup[key] = {
            "pack_qty": pack_qty,
            "pack_size": pack_size_by_key.get((key, pack_qty), ""),
        }
    return lookup


def display_pack_candidates(row: dict, rec: dict):
    candidates = [
        parse_pack(row["product"]),
        parse_pack(row["product_id"]),
        parse_pack(rec.get("item", "")),
        parse_pack(rec.get("pack_size", "")),
        rec.get("pack"),
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


def month_splits(start: date, end: date):
    if end < start:
        start, end = end, start

    total_days = (end - start).days + 1
    cursor = start
    splits = []
    while cursor <= end:
        last_day = calendar.monthrange(cursor.year, cursor.month)[1]
        month_end = date(cursor.year, cursor.month, last_day)
        segment_end = min(month_end, end)
        days = (segment_end - cursor).days + 1
        splits.append((cursor.month - 1, days / total_days, days, total_days))
        cursor = segment_end + timedelta(days=1)
    return splits


def round_cases(value: float) -> int:
    if value >= 0:
        return int(math.floor(value + 0.5))
    return int(math.ceil(value - 0.5))


def empty_years():
    return {year: [0.0] * 12 for year in YEARS}


def add_month(values, year: int, month_index: int, cases: float):
    values[year][month_index] += cases


def row_from_values(label: str, values: dict, is_group: bool = False, is_total: bool = False):
    m25 = [round_cases(value) for value in values[2025]]
    m26 = [round_cases(value) for value in values[2026]]
    return {
        "label": label,
        "is_group": is_group,
        "is_total": is_total,
        "m25": m25,
        "m26": m26,
        "fy25": round_cases(sum(values[2025])),
        "fy26": round_cases(sum(values[2026])),
    }


def add_values(target: dict, source: dict):
    for year in YEARS:
        for index, value in enumerate(source[year]):
            target[year][index] += value


def group_sort_key(group_name: str):
    display_rank = 1 if group_name.endswith(" Displays") else 0
    base_name = group_name.removesuffix(" Displays")
    try:
        return (GROUP_ORDER.index(base_name), display_rank, group_name)
    except ValueError:
        return (len(GROUP_ORDER), display_rank, group_name)


def build_product_table(rows):
    group_values = defaultdict(empty_years)
    mpg_values = defaultdict(empty_years)
    total_values = empty_years()

    for row in rows:
        key = (row["product_group"], row["mpg"])
        add_month(group_values[row["product_group"]], row["year"], row["month_index"], row["cases"])
        add_month(mpg_values[key], row["year"], row["month_index"], row["cases"])
        add_month(total_values, row["year"], row["month_index"], row["cases"])

    table_rows = []
    for group in sorted(group_values, key=group_sort_key):
        table_rows.append(row_from_values(group, group_values[group], is_group=True))
        children = sorted(
            (key for key in mpg_values if key[0] == group),
            key=lambda key: key[1],
        )
        for _, mpg in children:
            table_rows.append(row_from_values(mpg, mpg_values[(group, mpg)]))

    table_rows.append(row_from_values("GRAND TOTAL", total_values, is_total=True))
    return table_rows


def build_retailer_rollup(rows):
    retailer_values = {banner: empty_years() for banner in BANNER_ORDER}
    total_values = empty_years()

    for row in rows:
        add_month(retailer_values[row["banner"]], row["year"], row["month_index"], row["cases"])
        add_month(total_values, row["year"], row["month_index"], row["cases"])

    table_rows = [
        row_from_values(banner, retailer_values[banner], is_group=True)
        for banner in BANNER_ORDER
        if sum(retailer_values[banner][2025]) or sum(retailer_values[banner][2026])
    ]
    table_rows.append(row_from_values("GRAND TOTAL", total_values, is_total=True))
    return table_rows, total_values


def conversion_for_row(row: dict, base_lookup: dict):
    rec = row["product_record"]
    unit_type = "CASE"
    conversion = 1.0
    base_pack_size = rec["pack_size"]
    conversion_note = "Reported as regular cases"
    display_pack = None
    base = None

    if row["is_display_product"]:
        unit_type = "DRP"
        candidates = display_pack_candidates(row, rec)
        for candidate in candidates:
            key = (family_key(rec), candidate[1])
            if key in base_lookup:
                display_pack = candidate
                base = base_lookup[key]
                break
        if display_pack is None and candidates:
            display_pack = candidates[0]
            base = base_lookup.get((family_key(rec), display_pack[1]))

        if display_pack and base:
            conversion = display_pack[0] / base["pack_qty"]
            base_pack_size = base["pack_size"] or rec["pack_size"]
            conversion_note = (
                f"Display pack {format_qty(display_pack[0])}/{display_pack[1]} "
                f"converted to regular case pack {format_qty(base['pack_qty'])}/{display_pack[1]}"
            )
        else:
            conversion_note = "Display product without matching regular pack; left as reported cases"

    return {
        "unit_type": unit_type,
        "conversion": conversion,
        "base_pack_size": base_pack_size,
        "conversion_note": conversion_note,
        "display_pack_qty": "" if display_pack is None else display_pack[0],
        "display_pack_unit": "" if display_pack is None else display_pack[1],
    }


def build_dashboard_from_rows(rows: list[dict]):
    rollup_ret, total_values = build_retailer_rollup(rows)
    return {
        "rollup_ret": rollup_ret,
        "rollup_grp": build_product_table(rows),
        "retailers": {
            banner: build_product_table([row for row in rows if row["banner"] == banner])
            for banner in BANNER_ORDER
        },
        "stats": build_stats(total_values),
    }


def build_outputs():
    products, item_by_id, pack_groups = load_products()
    demand_rows = raw_demand_rows(item_by_id, pack_groups)
    base_lookup = build_base_pack_lookup(products, demand_rows)

    mode_rows = {mode: [] for mode in DATA_MODES}
    detail_rows = []
    included_split_keys = set()
    excluded_rows = []
    display_audit = {}

    for row in demand_rows:
        year = row["year"]
        banner = map_banner(row["market"], row["description"])
        rec = row["product_record"]
        reason = None

        if row["promo_status"] not in STATUS_BY_YEAR[year]:
            reason = "Promo status outside dashboard methodology"
        elif row["forecast_incremental_cases"] <= 0:
            reason = "Fcst Inc Cases is not positive"
        elif not banner:
            reason = "Market is outside the 11 displayed banner/customer groups"
        elif not rec or not rec.get("pack"):
            reason = "Product cannot be mapped to an MPG pack size"
        elif not row["execution_start"] or not row["execution_end"]:
            reason = "Missing execution start or end date"

        if reason:
            excluded_rows.append(excluded_row(row, banner, reason))
            continue

        conversion = conversion_for_row(row, base_lookup)
        blended_mpg = pretty_pack_size(conversion["base_pack_size"])
        blended_product_group = product_group_label(blended_mpg, rec["planner"], rec["segment"])
        separate_mpg = pretty_pack_size(rec["pack_size"])
        separate_product_group = product_group_label(separate_mpg, rec["planner"], rec["segment"])
        source_cases = row["forecast_incremental_cases"]
        converted_cases = source_cases * conversion["conversion"]

        if conversion["unit_type"] == "DRP":
            separate_product_group = display_group_label(blended_product_group)

        if conversion["unit_type"] == "DRP":
            converted = "without matching regular pack" not in conversion["conversion_note"]
            audit_key = (
                row["product_id"],
                row["product"],
                blended_mpg,
                separate_mpg,
                conversion["conversion"],
                conversion["conversion_note"],
            )
            display_audit[audit_key] = {
                "product_id": row["product_id"],
                "product": row["product"],
                "blended_mpg": blended_mpg,
                "separate_mpg": separate_mpg,
                "blended_product_group": blended_product_group,
                "separate_product_group": separate_product_group,
                "cases_per_display": round(conversion["conversion"], 6),
                "converted": "yes" if converted else "no",
                "conversion_note": conversion["conversion_note"],
            }

        for month_index, weight, split_days, total_days in month_splits(row["execution_start"], row["execution_end"]):
            included_split_keys.add((row["source_sheet"], row["source_row"], month_index))
            mode_definitions = [
                ("blended", blended_product_group, blended_mpg, converted_cases),
                ("separate", separate_product_group, separate_mpg, source_cases),
            ]
            for data_mode, product_group, mpg, mode_cases in mode_definitions:
                month_cases = mode_cases * weight
                mode_rows[data_mode].append(
                    {
                        "banner": banner,
                        "market": row["market"],
                        "year": year,
                        "month": MONTHS[month_index],
                        "month_index": month_index,
                        "product_group": product_group,
                        "mpg": mpg,
                        "cases": month_cases,
                    }
                )
                detail_rows.append({
                    "data_mode": data_mode,
                    "banner": banner,
                    "market": row["market"],
                    "year": year,
                    "month": MONTHS[month_index],
                    "product_group": product_group,
                    "mpg": mpg,
                    "product_id": row["product_id"],
                    "product": row["product"],
                    "promo_id": row["promo_id"],
                    "promo_status": row["promo_status"],
                    "promotion_type": row["promotion_type"],
                    "execution_start": row["execution_start"].isoformat(),
                    "execution_end": row["execution_end"].isoformat(),
                    "source_fcst_inc_cases": round(source_cases, 6),
                    "unit_type": conversion["unit_type"],
                    "cases_per_display": "" if conversion["unit_type"] == "CASE" else round(conversion["conversion"], 6),
                    "converted_fcst_inc_cases": round(converted_cases, 6),
                    "mode_fcst_inc_cases": round(mode_cases, 6),
                    "prorate_weight": round(weight, 8),
                    "execution_days_in_month": split_days,
                    "execution_days_total": total_days,
                    "month_cases": round(month_cases, 6),
                    "source_sheet": row["source_sheet"],
                    "source_row": row["source_row"],
                    "conversion_note": conversion["conversion_note"],
                })

    dashboard_modes = {
        mode: build_dashboard_from_rows(rows)
        for mode, rows in mode_rows.items()
    }
    dashboard = {
        "banner_order": BANNER_ORDER,
        "default_mode": "blended",
        "mode_labels": DATA_MODES,
        "modes": dashboard_modes,
        **dashboard_modes["blended"],
    }

    summary = {
        "generated_from": {
            "demand_workbook": DEMAND_XLSX.name,
            "product_workbook": PRODUCT_XLSX.name,
        },
        "methodology": {
            "volume_source": "Product-level Fcst Inc Cases",
            "row_filter": "Fcst Inc Cases > 0",
            "date_method": "Execution Start through Execution End, prorated by inclusive execution days per calendar month",
            "year_status_filter": {
                "2025": sorted(STATUS_BY_YEAR[2025]),
                "2026": sorted(STATUS_BY_YEAR[2026]),
            },
            "display_method": "Toggleable: blended mode converts display/DRP/PDQ pack sizes to equivalent regular cases; separate mode keeps display/DRP rows separate and counts each as 1 case",
            "product_level": "MPG pack-size level from Product List; individual flavours are combined",
            "banner_scope": BANNER_ORDER,
        },
        "source_rows_read": len(demand_rows),
        "data_modes": DATA_MODES,
        "included_source_month_rows": len(included_split_keys),
        "included_source_rows": len({(row["source_sheet"], row["source_row"]) for row in detail_rows}),
        "excluded_rows": len(excluded_rows),
        "display_products_reviewed": len(display_audit),
        "display_products_converted": sum(1 for row in display_audit.values() if row["converted"] == "yes"),
        "unconverted_display_products": sum(1 for row in display_audit.values() if row["converted"] == "no"),
        "detail_rows": len(detail_rows),
        "mode_totals": {
            mode: data["stats"]
            for mode, data in dashboard_modes.items()
        },
        "total_cases_2025": dashboard_modes["blended"]["stats"]["fy25"],
        "total_cases_2026": dashboard_modes["blended"]["stats"]["fy26"],
        "delta_cases": dashboard_modes["blended"]["stats"]["delta"],
        "delta_pct": dashboard_modes["blended"]["stats"]["delta_pct"],
    }

    OUTPUT_MODULE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_DASHBOARD_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_DASHBOARD_JSON.write_text(json.dumps(dashboard, indent=2), encoding="utf-8")
    OUTPUT_SUMMARY.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    OUTPUT_MODULE.write_text(module_text(dashboard, summary), encoding="utf-8")

    write_csv(OUTPUT_DETAIL, detail_fieldnames(), detail_rows)
    write_csv(OUTPUT_EXCLUDED, excluded_fieldnames(), excluded_rows)
    write_csv(
        OUTPUT_DISPLAY_AUDIT,
        [
            "product_id",
            "product",
            "blended_product_group",
            "blended_mpg",
            "separate_product_group",
            "separate_mpg",
            "cases_per_display",
            "converted",
            "conversion_note",
        ],
        sorted(display_audit.values(), key=lambda row: (row["blended_product_group"], row["blended_mpg"], row["product_id"])),
    )

    return summary


def build_stats(total_values: dict):
    fy25 = round_cases(sum(total_values[2025]))
    fy26 = round_cases(sum(total_values[2026]))
    delta = fy26 - fy25
    delta_pct = round((delta / abs(fy25)) * 100, 1) if fy25 else None
    return {
        "fy25": fy25,
        "fy26": fy26,
        "delta": delta,
        "delta_pct": delta_pct,
        "banners": len(BANNER_ORDER),
    }


def module_text(dashboard: dict, summary: dict) -> str:
    return (
        "// Generated by scripts/build_dashboard_data.py. Do not edit by hand.\n"
        f"export const MONTHS = {json.dumps(MONTHS)};\n"
        f"export const RAW = {json.dumps(dashboard, separators=(',', ':'))};\n"
        f"export const META = {json.dumps(summary, separators=(',', ':'))};\n"
    )


def excluded_row(row: dict, banner: str | None, reason: str):
    return {
        "reason": reason,
        "banner": banner or "",
        "market": row["market"],
        "year": row["year"],
        "product_id": row["product_id"],
        "product": row["product"],
        "promo_id": row["promo_id"],
        "promo_status": row["promo_status"],
        "forecast_incremental_cases": row["forecast_incremental_cases"],
        "execution_start": "" if not row["execution_start"] else row["execution_start"].isoformat(),
        "execution_end": "" if not row["execution_end"] else row["execution_end"].isoformat(),
        "source_sheet": row["source_sheet"],
        "source_row": row["source_row"],
        "description": row["description"],
    }


def detail_fieldnames():
    return [
        "data_mode",
        "banner",
        "market",
        "year",
        "month",
        "product_group",
        "mpg",
        "product_id",
        "product",
        "promo_id",
        "promo_status",
        "promotion_type",
        "execution_start",
        "execution_end",
        "source_fcst_inc_cases",
        "unit_type",
        "cases_per_display",
        "converted_fcst_inc_cases",
        "mode_fcst_inc_cases",
        "prorate_weight",
        "execution_days_in_month",
        "execution_days_total",
        "month_cases",
        "source_sheet",
        "source_row",
        "conversion_note",
    ]


def excluded_fieldnames():
    return [
        "reason",
        "banner",
        "market",
        "year",
        "product_id",
        "product",
        "promo_id",
        "promo_status",
        "forecast_incremental_cases",
        "execution_start",
        "execution_end",
        "source_sheet",
        "source_row",
        "description",
    ]


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    print(json.dumps(build_outputs(), indent=2))
