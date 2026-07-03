"use client";

import { useEffect, useMemo, useState } from "react";
import { DASHBOARD_DATA_URL } from "./data/promo-yoy-data";

const YOY_RETAILER_TAB = "tab-rollup-retailer-yoy";
const YOY_GROUP_TAB = "tab-rollup-group-yoy";
const MOM_RETAILER_TAB = "tab-rollup-retailer-mom";
const MOM_GROUP_TAB = "tab-rollup-group-mom";

const DEFAULT_PERIOD_LABELS = {
  base: "2025",
  comparison: "2026",
  base_short: "'25",
  comparison_short: "'26",
  base_stat: "FY 2025 Cases",
  comparison_stat: "FY 2026 Cases",
  delta: "Delta",
  delta_stat: "YoY Delta Cases",
  pct_stat: "YoY %",
  legend: "Grey = 2025 | Bold = 2026 | Full Year delta includes %",
};

const QUARTER_OPTIONS = [
  { value: "all", label: "All Months", start: 0, end: 11 },
  { value: "q1", label: "Q1", start: 0, end: 2 },
  { value: "q2", label: "Q2", start: 3, end: 5 },
  { value: "q3", label: "Q3", start: 6, end: 8 },
  { value: "q4", label: "Q4", start: 9, end: 11 },
  { value: "custom", label: "Custom", start: 0, end: 11 },
];

const EMPTY_STATS = {
  fy25: 0,
  fy26: 0,
  delta: 0,
  delta_pct: 0,
  banners: 0,
};

const EMPTY_MODE = {
  stats: EMPTY_STATS,
  rollup_ret: [],
  rollup_grp: [],
  rollup_segment: [],
  retailers: {},
};

const EMPTY_DASHBOARD = {
  MONTHS: [],
  RAW: {
    banner_order: [],
    comparisons: {},
    modes: {
      blended: EMPTY_MODE,
      separate: EMPTY_MODE,
    },
  },
  META: {
    generated_from: {},
  },
};

function bannerTabId(name) {
  return `tab-${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "-";
  return Math.round(value).toLocaleString("en-US");
}

function formatSigned(value) {
  const rounded = Math.round(value);
  if (rounded === 0) return "-";
  return `${rounded > 0 ? "+" : "-"}${Math.abs(rounded).toLocaleString("en-US")}`;
}

function formatDelta(base, comparison) {
  const a = base || 0;
  const b = comparison || 0;
  if (a === 0 && b > 0) return "NEW";
  if (a === 0 && b === 0) return "-";
  return formatSigned(b - a);
}

function formatFullYearDelta(base, comparison) {
  const a = base || 0;
  const b = comparison || 0;
  if (!a || !b) return formatDelta(a, b);
  const delta = b - a;
  if (delta === 0) return "-";
  const pct = ((delta / Math.abs(a)) * 100).toFixed(1);
  return `${formatSigned(delta)} (${delta > 0 ? "+" : ""}${pct}%)`;
}

function deltaClass(base, comparison) {
  const a = base || 0;
  const b = comparison || 0;
  if (a === 0 && b > 0) return "delta-new";
  if (a > 0 && b === 0) return "delta-neg";
  const delta = b - a;
  if (delta > 0) return "delta-pos";
  if (delta < 0) return "delta-neg";
  return "delta-zero";
}

function comparisonKeyForTab(activeTab) {
  return activeTab === MOM_RETAILER_TAB || activeTab === MOM_GROUP_TAB ? "mom" : "yoy";
}

function isRetailerRollup(activeTab) {
  return activeTab === YOY_RETAILER_TAB || activeTab === MOM_RETAILER_TAB;
}

function isProductGroupRollup(activeTab) {
  return activeTab === YOY_GROUP_TAB || activeTab === MOM_GROUP_TAB;
}

function quarterForRange(start, end) {
  const match = QUARTER_OPTIONS.find(
    (option) => option.value !== "custom" && option.start === start && option.end === end,
  );
  return match?.value || "custom";
}

function selectedPeriodLabel(months, start, end, quarterSelection) {
  if (quarterSelection === "all") return "FULL YEAR";
  if (["q1", "q2", "q3", "q4"].includes(quarterSelection)) return quarterSelection.toUpperCase();
  const startLabel = months[start] || "Jan";
  const endLabel = months[end] || "Dec";
  return start === end ? startLabel.toUpperCase() : `${startLabel}-${endLabel}`.toUpperCase();
}

function sumMonthValues(values = [], visibleMonths = []) {
  return visibleMonths.reduce((total, month) => total + (values?.[month.index] || 0), 0);
}

function monthDelta(row, monthIndex) {
  return (row.m26?.[monthIndex] || 0) - (row.m25?.[monthIndex] || 0);
}

function rowPeriodDelta(row, visibleMonths) {
  const base =
    visibleMonths.length === 12
      ? row.fy25 || 0
      : sumMonthValues(row.m25, visibleMonths);
  const comparison =
    visibleMonths.length === 12
      ? row.fy26 || 0
      : sumMonthValues(row.m26, visibleMonths);
  return comparison - base;
}

function rowHasChange(row, visibleMonths) {
  return (
    visibleMonths.some((month) => monthDelta(row, month.index) !== 0) ||
    rowPeriodDelta(row, visibleMonths) !== 0
  );
}

function tabTitle(activeTab, raw) {
  if (activeTab === YOY_RETAILER_TAB) return "All Retailers Roll-Up - by Retailer - YoY";
  if (activeTab === YOY_GROUP_TAB) return "All Retailers Roll-Up - by Product Group / MPG - YoY";
  if (activeTab === MOM_RETAILER_TAB) return "All Retailers Roll-Up - by Retailer - MoM";
  if (activeTab === MOM_GROUP_TAB) return "All Retailers Roll-Up - by Product Group / MPG - MoM";
  const banner = raw.banner_order.find((name) => bannerTabId(name) === activeTab);
  return `${banner} - Fcst Inc Cases by Product Group / MPG`;
}

function tabSubtitle(activeTab, blendDisplays) {
  if (activeTab === MOM_RETAILER_TAB) {
    return "Compares the July pull against the June pull across all MPGs.";
  }
  if (activeTab === MOM_GROUP_TAB) {
    return blendDisplays
      ? "Compares July against June with display volume converted to regular cases. Retailer drilldowns are sorted by total change."
      : "Compares July against June with displays separate and counted as 1 case each. Retailer drilldowns are sorted by total change.";
  }
  if (activeTab === YOY_RETAILER_TAB) {
    return "Each row is one banner/customer total across all MPGs.";
  }
  if (activeTab === YOY_GROUP_TAB) {
    return blendDisplays
      ? "MPGs include display volume converted to regular cases. Retailer drilldowns are sorted by FY delta."
      : "Displays stay separate and count as 1 case each. Retailer drilldowns are sorted by FY delta.";
  }
  return blendDisplays
    ? "MPG rows combine flavours and include display volume converted to regular cases."
    : "Display and DRP rows stay separate and count each display as 1 case.";
}

export default function DemandDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState(YOY_RETAILER_TAB);
  const [blendDisplays, setBlendDisplays] = useState(true);
  const [monthStart, setMonthStart] = useState(0);
  const [monthEnd, setMonthEnd] = useState(11);
  const [quarterSelection, setQuarterSelection] = useState("all");
  const [productDrilldownLevel, setProductDrilldownLevel] = useState("mpg");
  const [hideZeroChanges, setHideZeroChanges] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const { META, MONTHS, RAW } = dashboardData || EMPTY_DASHBOARD;
  const dataMode = blendDisplays ? "blended" : "separate";
  const activeComparisonKey = comparisonKeyForTab(activeTab);
  const activeComparison = RAW.comparisons?.[activeComparisonKey] || RAW;
  const yoyComparison = RAW.comparisons?.yoy || RAW;
  const activeData = activeComparison.modes?.[dataMode] || EMPTY_MODE;
  const yoyData = yoyComparison.modes?.[dataMode] || EMPTY_MODE;
  const retailerCardComparisonKey = activeTab === MOM_RETAILER_TAB || activeTab === MOM_GROUP_TAB ? "mom" : "yoy";
  const retailerCardComparison = RAW.comparisons?.[retailerCardComparisonKey] || RAW;
  const retailerCardData = retailerCardComparison.modes?.[dataMode] || EMPTY_MODE;
  const retailerCardPeriodLabels = retailerCardComparison.period_labels || DEFAULT_PERIOD_LABELS;
  const periodLabels = activeComparison.period_labels || DEFAULT_PERIOD_LABELS;
  const visibleMonths = useMemo(
    () =>
      MONTHS.map((label, index) => ({ label, index })).filter(
        (month) => month.index >= monthStart && month.index <= monthEnd,
      ),
    [MONTHS, monthEnd, monthStart],
  );
  const summaryLabel = selectedPeriodLabel(MONTHS, monthStart, monthEnd, quarterSelection);

  useEffect(() => {
    let alive = true;

    fetch(DASHBOARD_DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (alive) setDashboardData(data);
      })
      .catch((error) => {
        if (alive) setLoadError(error);
      });

    return () => {
      alive = false;
    };
  }, []);

  const tabs = useMemo(
    () => [
      { id: YOY_RETAILER_TAB, label: "By Retailer - YoY" },
      { id: YOY_GROUP_TAB, label: "By Product Group - YoY" },
      { id: MOM_RETAILER_TAB, label: "By Retailer - MoM" },
      { id: MOM_GROUP_TAB, label: "By Product Group - MoM" },
      ...RAW.banner_order.map((name) => ({ id: bannerTabId(name), label: name })),
    ],
    [RAW.banner_order],
  );

  const activeRows = useMemo(() => {
    if (activeTab === YOY_RETAILER_TAB || activeTab === MOM_RETAILER_TAB) return activeData.rollup_ret;
    if (activeTab === YOY_GROUP_TAB || activeTab === MOM_GROUP_TAB) {
      return productDrilldownLevel === "segment"
        ? activeData.rollup_segment || activeData.rollup_grp
        : activeData.rollup_grp;
    }
    const banner = RAW.banner_order.find((name) => bannerTabId(name) === activeTab);
    return yoyData.retailers[banner] || [];
  }, [activeData, activeTab, productDrilldownLevel, RAW.banner_order, yoyData]);

  function applyQuarter(value) {
    const option = QUARTER_OPTIONS.find((quarter) => quarter.value === value) || QUARTER_OPTIONS[0];
    if (option.value === "custom") {
      setQuarterSelection("custom");
      return;
    }

    const maxMonth = Math.max(0, MONTHS.length - 1);
    const nextStart = Math.min(option.start, maxMonth);
    const nextEnd = Math.min(option.end, maxMonth);
    setMonthStart(nextStart);
    setMonthEnd(nextEnd);
    setQuarterSelection(option.value);
  }

  function updateMonthStart(value) {
    const maxMonth = Math.max(0, MONTHS.length - 1);
    const nextStart = Math.max(0, Math.min(Number(value), maxMonth));
    const nextEnd = Math.max(nextStart, monthEnd);
    setMonthStart(nextStart);
    setMonthEnd(nextEnd);
    setQuarterSelection(quarterForRange(nextStart, nextEnd));
  }

  function updateMonthEnd(value) {
    const maxMonth = Math.max(0, MONTHS.length - 1);
    const nextEnd = Math.max(0, Math.min(Number(value), maxMonth));
    const nextStart = Math.min(monthStart, nextEnd);
    setMonthStart(nextStart);
    setMonthEnd(nextEnd);
    setQuarterSelection(quarterForRange(nextStart, nextEnd));
  }

  function toggleGroup(groupKey) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  if (loadError) {
    return (
      <main className="promo-dashboard">
        <header className="promo-header">
          <h1>TH CPG - Promotional Fcst Inc Cases Demand Review</h1>
          <p>Unable to load the embedded dashboard data.</p>
        </header>
      </main>
    );
  }

  if (!dashboardData) {
    return (
      <main className="promo-dashboard">
        <header className="promo-header">
          <h1>TH CPG - Promotional Fcst Inc Cases Demand Review</h1>
          <p>Loading embedded forecast data...</p>
        </header>
      </main>
    );
  }

  return (
    <main className="promo-dashboard">
      <header className="promo-header">
        <h1>TH CPG - Promotional Fcst Inc Cases Demand Review</h1>
        <p>
          In-market execution dates | Cases pro-rated by execution days per
          calendar month | Fcst Inc Cases &gt; 0 rows only | 2025 =
          Closed/Committed | 2026 = Closed/Planned/Committed | MoM =
          July pull vs June pull
        </p>
      </header>

      <StatsBar periodLabels={periodLabels} stats={activeData.stats} />

      <ModeToggle
        blendDisplays={blendDisplays}
        onChange={(checked) => {
          setBlendDisplays(checked);
          setExpandedGroups(new Set());
        }}
      />

      <section className="cards" aria-label="Retailer summary cards">
        {RAW.banner_order.map((name) => (
          <RetailerCard
            key={name}
            active={activeTab === bannerTabId(name)}
            name={name}
            periodLabels={retailerCardPeriodLabels}
            row={
              (retailerCardData.retailer_totals || retailerCardData.rollup_ret).find(
                (item) => item.label === name,
              )
            }
            onClick={() => setActiveTab(bannerTabId(name))}
          />
        ))}
      </section>

      <nav className="tabs" aria-label="Dashboard views">
        {tabs.map((tab, index) => (
          <button
            className={`tab-btn${activeTab === tab.id ? " active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {index === 4 ? <span className="tab-sep" aria-hidden="true">|</span> : null}
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="tab-pane active">
        <h2>{tabTitle(activeTab, RAW)}</h2>
        <div className="sub">{tabSubtitle(activeTab, blendDisplays)}</div>
        <TableControls
          monthEnd={monthEnd}
          months={MONTHS}
          monthStart={monthStart}
          onMonthEndChange={updateMonthEnd}
          onMonthStartChange={updateMonthStart}
          onProductDrilldownChange={(level) => {
            setProductDrilldownLevel(level);
            setExpandedGroups(new Set());
          }}
          onQuarterChange={applyQuarter}
          onZeroToggle={setHideZeroChanges}
          hideZeroChanges={hideZeroChanges}
          productDrilldownLevel={productDrilldownLevel}
          quarterSelection={quarterSelection}
          showProductDrilldown={isProductGroupRollup(activeTab)}
        />
        <Legend periodLabels={periodLabels} />
        <DataTable
          expandedGroups={expandedGroups}
          labelHeader={
            isRetailerRollup(activeTab)
              ? "Retailer"
              : isProductGroupRollup(activeTab)
                ? productDrilldownLevel === "segment"
                  ? "Segment / Retailer"
                  : "Product Group / MPG / Retailer"
                : "Product Group / MPG"
          }
          months={MONTHS}
          periodLabels={periodLabels}
          hideZeroChanges={hideZeroChanges}
          rows={activeRows}
          summaryLabel={summaryLabel}
          tabId={`${activeComparisonKey}-${dataMode}-${productDrilldownLevel}-${activeTab}`}
          toggleGroup={toggleGroup}
          visibleMonths={visibleMonths}
        />
      </section>

      <footer className="data-footnote">
        Sources: YoY {META.generated_from.yoy_workbook || META.generated_from.demand_workbook};
        MoM {META.generated_from.mom_workbook}; mapping:{" "}
        {META.generated_from.product_workbook} and {META.generated_from.market_workbook}
      </footer>
    </main>
  );
}

function TableControls({
  hideZeroChanges,
  monthEnd,
  months,
  monthStart,
  onMonthEndChange,
  onMonthStartChange,
  onProductDrilldownChange,
  onQuarterChange,
  onZeroToggle,
  productDrilldownLevel,
  quarterSelection,
  showProductDrilldown,
}) {
  const maxMonth = Math.max(0, months.length - 1);
  const selectedRange = `${months[monthStart] || "Jan"} - ${months[monthEnd] || "Dec"}`;
  const startPct = maxMonth ? (monthStart / maxMonth) * 100 : 0;
  const endPct = maxMonth ? (monthEnd / maxMonth) * 100 : 100;

  return (
    <div className="table-controls" aria-label="Table filters">
      <label className="control-field">
        <span>Quarter</span>
        <select value={quarterSelection} onChange={(event) => onQuarterChange(event.target.value)}>
          {QUARTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="month-slider" aria-label="Month range">
        <span className="range-label">{selectedRange}</span>
        <div className="range-slider">
          <span className="range-track" aria-hidden="true" />
          <span
            className="range-selection"
            style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
            aria-hidden="true"
          />
          <input
            aria-label="Start month"
            max={maxMonth}
            min="0"
            onChange={(event) => onMonthStartChange(event.target.value)}
            step="1"
            type="range"
            value={monthStart}
          />
          <input
            aria-label="End month"
            max={maxMonth}
            min="0"
            onChange={(event) => onMonthEndChange(event.target.value)}
            step="1"
            type="range"
            value={monthEnd}
          />
        </div>
      </div>

      <label className="switch-row compact-switch">
        <span>Hide 0s</span>
        <input
          checked={hideZeroChanges}
          onChange={(event) => onZeroToggle(event.target.checked)}
          type="checkbox"
        />
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
      </label>

      {showProductDrilldown ? (
        <div className="segmented-control" aria-label="Product drilldown level">
          <span>Drilldown</span>
          <button
            className={productDrilldownLevel === "mpg" ? "active" : ""}
            onClick={() => onProductDrilldownChange("mpg")}
            type="button"
          >
            MPG
          </button>
          <button
            className={productDrilldownLevel === "segment" ? "active" : ""}
            onClick={() => onProductDrilldownChange("segment")}
            type="button"
          >
            Segment
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StatsBar({ periodLabels, stats }) {
  const deltaTone = stats.delta >= 0 ? "pos" : "neg";
  const pct = stats.delta_pct === null ? "-" : `${stats.delta_pct >= 0 ? "+" : ""}${stats.delta_pct}%`;

  return (
    <section className="stats-bar" aria-label="Full-year summary">
      <Stat label={periodLabels.base_stat} value={formatNumber(stats.fy25)} />
      <Stat label={periodLabels.comparison_stat} value={formatNumber(stats.fy26)} />
      <Stat className={deltaTone} label={periodLabels.delta_stat} value={formatSigned(stats.delta)} />
      <Stat className={deltaTone} label={periodLabels.pct_stat} value={pct} />
      <Stat label="Banners" value={formatNumber(stats.banners)} />
    </section>
  );
}

function Stat({ className = "", label, value }) {
  return (
    <div className="stat">
      <div className={`val ${className}`}>{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

function ModeToggle({ blendDisplays, onChange }) {
  return (
    <section className="mode-bar" aria-label="Display treatment">
      <label className="switch-row">
        <span>Blend DRPs into cases</span>
        <input
          checked={blendDisplays}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
      </label>
      <span className="mode-note">
        {blendDisplays
          ? "Displays converted to regular-case equivalents"
          : "Displays shown separately and counted as 1 case each"}
      </span>
    </section>
  );
}

function RetailerCard({ active, name, onClick, periodLabels, row }) {
  const fy25 = row?.fy25 || 0;
  const fy26 = row?.fy26 || 0;
  const delta = fy26 - fy25;
  const pct = fy25 ? ` (${delta >= 0 ? "+" : ""}${((delta / Math.abs(fy25)) * 100).toFixed(1)}%)` : "";
  const cls = delta > 0 ? "pos" : delta < 0 ? "neg" : "";

  return (
    <button className={`card${active ? " active-card" : ""}`} onClick={onClick} type="button">
      <div className="card-name">{name}</div>
      <div className="card-row">
        <span>{periodLabels.base}</span>
        <span>{formatNumber(fy25)}</span>
      </div>
      <div className="card-row">
        <span>{periodLabels.comparison}</span>
        <span>{formatNumber(fy26)}</span>
      </div>
      <div className={`card-delta ${cls}`}>
        {formatSigned(delta)}
        {pct}
      </div>
    </button>
  );
}

function Legend({ periodLabels }) {
  return (
    <div className="legend" aria-label="Delta legend">
      <span className="li"><span className="sw sw-up" /> Increase</span>
      <span className="li"><span className="sw sw-dn" /> Decrease</span>
      <span className="li"><span className="sw sw-nw" /> New in {periodLabels.comparison}</span>
      <span className="legend-note">{periodLabels.legend}</span>
    </div>
  );
}

function rowLevel(row) {
  if (row.is_total) return 0;
  if (row.is_group) return 1;
  if (row.is_mpg) return 2;
  return 3;
}

function filterRowsForChange(rows, visibleMonths, hideZeroChanges) {
  if (!hideZeroChanges) return rows;

  const keep = rows.map((row) => row.is_total || rowHasChange(row, visibleMonths));

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const level = rowLevel(rows[index]);
    if (level !== 1 && level !== 2) continue;

    for (let childIndex = index + 1; childIndex < rows.length; childIndex += 1) {
      const childLevel = rowLevel(rows[childIndex]);
      if (childLevel <= level) break;
      if (keep[childIndex]) {
        keep[index] = true;
        break;
      }
    }
  }

  const filteredRows = rows.filter((_, index) => keep[index]);
  let displayDividerSeen = false;

  return filteredRows.map((row, index) => {
    let hasVisibleChild = false;
    if (row.has_children) {
      const level = rowLevel(row);
      for (let childIndex = index + 1; childIndex < filteredRows.length; childIndex += 1) {
        const childLevel = rowLevel(filteredRows[childIndex]);
        if (childLevel <= level) break;
        hasVisibleChild = true;
        break;
      }
    }

    let nextRow = row.has_children !== hasVisibleChild ? { ...row, has_children: hasVisibleChild } : row;

    if (nextRow.is_display_group) {
      const shouldStartDisplaySection = !displayDividerSeen;
      if (nextRow === row || nextRow.display_section_start !== shouldStartDisplaySection) {
        nextRow = { ...nextRow, display_section_start: shouldStartDisplaySection };
      }
      displayDividerSeen = true;
    } else if (nextRow.display_section_start) {
      nextRow = { ...nextRow, display_section_start: false };
    }

    return nextRow;
  });
}

function visibleMonthColumns(rows, visibleMonths, hideZeroChanges) {
  if (!hideZeroChanges) return visibleMonths;
  return visibleMonths.filter((month) =>
    rows.some((row) => !row.is_total && monthDelta(row, month.index) !== 0),
  );
}

function prepareVisibleRows(rows, expandedGroups, tabId) {
  let currentGroup = null;
  let currentGroupOpen = true;
  let currentMpg = null;
  let currentMpgOpen = true;
  let groupIndex = 0;
  let mpgIndex = 0;
  const visibleRows = [];

  rows.forEach((row, index) => {
    let groupKey = currentGroup;
    let mpgKey = currentMpg;
    let rowKey = null;
    let visible = currentGroupOpen;
    let isOpen = false;

    if (row.is_group && !row.is_total) {
      groupKey = `${tabId}-${groupIndex}-${row.label}`;
      currentGroup = groupKey;
      currentMpg = null;
      currentMpgOpen = false;
      groupIndex += 1;
      mpgIndex = 0;
      currentGroupOpen = row.has_children ? expandedGroups.has(groupKey) : true;
      visible = true;
      rowKey = row.has_children ? groupKey : null;
      isOpen = currentGroupOpen;
    } else if (row.is_mpg) {
      mpgKey = `${groupKey}-${mpgIndex}-${row.label}`;
      currentMpg = mpgKey;
      mpgIndex += 1;
      currentMpgOpen = row.has_children ? expandedGroups.has(mpgKey) : true;
      visible = currentGroupOpen;
      rowKey = row.has_children ? mpgKey : null;
      isOpen = currentMpgOpen;
    } else if (row.is_retailer) {
      visible = row.parent_level === "group" ? currentGroupOpen : currentGroupOpen && currentMpgOpen;
    } else if (row.is_total) {
      groupKey = null;
      mpgKey = null;
      visible = true;
    } else {
      visible = currentGroupOpen;
    }

    if (!visible) return;

    const baseRowClass = row.is_total
      ? "tot-row"
      : row.is_group
        ? "grp-hdr"
        : row.is_mpg
          ? "mpg-row"
          : row.is_retailer
            ? "retailer-row"
            : "sku-row";
    const rowClass = `${baseRowClass}${row.display_section_start ? " display-section-start" : ""}`;
    visibleRows.push({ index, isOpen, row, rowClass, rowKey });
  });

  return visibleRows;
}

function DataTable({
  expandedGroups,
  hideZeroChanges,
  labelHeader,
  months,
  periodLabels,
  rows,
  summaryLabel,
  tabId,
  toggleGroup,
  visibleMonths,
}) {
  const filteredRows = filterRowsForChange(rows, visibleMonths, hideZeroChanges);
  const monthColumns = visibleMonthColumns(filteredRows, visibleMonths, hideZeroChanges);
  const visibleRows = prepareVisibleRows(filteredRows, expandedGroups, tabId);

  return (
    <div className="tbl-wrap">
      <table className="dt">
        <thead>
          <tr className="hdr1">
            <th className="lhdr" rowSpan="2">{labelHeader}</th>
            {monthColumns.map((month) => (
              <th className="month-head" colSpan="3" key={month.label}>{month.label}</th>
            ))}
            <th className="month-head fy-head" colSpan="3">{summaryLabel}</th>
          </tr>
          <tr className="hdr2">
            {Array.from({ length: monthColumns.length + 1 }, (_, index) => (
              <MonthSubhead index={index} key={index} monthCount={monthColumns.length} periodLabels={periodLabels} />
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(({ index, isOpen, row, rowClass, rowKey }) => (
              <tr className={rowClass} key={`${tabId}-${index}-${row.label}`}>
                <LabelCell
                  groupKey={rowKey}
                  isOpen={isOpen}
                  row={row}
                  toggleGroup={toggleGroup}
                />
                {monthColumns.map((month) => (
                  <MonthCells
                    base={row.m25?.[month.index] || 0}
                    comparison={row.m26?.[month.index] || 0}
                    key={month.label}
                    monthIndex={month.index}
                  />
                ))}
                <MonthCells
                  base={
                    visibleMonths.length === months.length
                      ? row.fy25 || 0
                      : sumMonthValues(row.m25, visibleMonths)
                  }
                  comparison={
                    visibleMonths.length === months.length
                      ? row.fy26 || 0
                      : sumMonthValues(row.m26, visibleMonths)
                  }
                  fullYear
                />
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthSubhead({ index, monthCount, periodLabels }) {
  const boundaryClass = index === monthCount ? " fy-boundary" : " month-boundary";

  return (
    <>
      <th className={`subhead-cell${boundaryClass}`}>{periodLabels.base_short}</th>
      <th>{periodLabels.comparison_short}</th>
      <th>{periodLabels.delta}</th>
    </>
  );
}

function LabelCell({ groupKey, isOpen, row, toggleGroup }) {
  if (row.is_total) return <td className="totlbl">{row.label}</td>;

  if (row.is_group) {
    if (!row.has_children) return <td className="glbl">{row.label}</td>;

    return (
      <td className="glbl">
        <button
          aria-expanded={isOpen}
          className="group-toggle"
          onClick={() => toggleGroup(groupKey)}
          type="button"
        >
          <span className={`arr${isOpen ? " open" : ""}`} aria-hidden="true">&gt;</span>
          <span>{row.label}</span>
        </button>
      </td>
    );
  }

  if (row.is_mpg) {
    return (
      <td className="mlbl">
        <button
          aria-expanded={isOpen}
          className="group-toggle"
          onClick={() => toggleGroup(groupKey)}
          type="button"
        >
          <span className={`arr${isOpen ? " open" : ""}`} aria-hidden="true">&gt;</span>
          <span>{row.label}</span>
        </button>
      </td>
    );
  }

  if (row.is_retailer) return <td className="rlbl">{row.label}</td>;

  return <td className="slbl">{row.label}</td>;
}

function MonthCells({ base, comparison, fullYear = false, monthIndex = null }) {
  const boundaryClass = fullYear || monthIndex !== null ? (fullYear ? " fy-boundary" : " month-boundary") : "";

  return (
    <>
      <td className={`y25${boundaryClass}`}>{formatNumber(base)}</td>
      <td className="y26">{formatNumber(comparison)}</td>
      <td className={deltaClass(base, comparison)}>
        {fullYear ? formatFullYearDelta(base, comparison) : formatDelta(base, comparison)}
      </td>
    </>
  );
}
