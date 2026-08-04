"use client";

import { useEffect, useMemo, useState } from "react";
import { DASHBOARD_DATA_URL } from "./data/promo-yoy-data";

const YOY_RETAILER_TAB = "tab-rollup-retailer-yoy";
const YOY_GROUP_TAB = "tab-rollup-group-yoy";
const MOM_RETAILER_TAB = "tab-rollup-retailer-mom";
const MOM_GROUP_TAB = "tab-rollup-group-mom";
const NON_MULO_RETAILER_MOM_TAB = "tab-non-mulo-retailer-mom";
const NON_MULO_GROUP_MOM_TAB = "tab-non-mulo-group-mom";

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
  promo_rows: [],
  retailer_totals: [],
  retailers: {},
  non_mulo: {
    stats: EMPTY_STATS,
    rollup_ret: [],
    rollup_grp: [],
    rollup_segment: [],
  },
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

function isRetailerSpecificTab(activeTab, raw) {
  return raw.banner_order.some((name) => bannerTabId(name) === activeTab);
}

function comparisonKeyForTab(activeTab, raw, retailerComparisonKey) {
  const isMomTab = activeTab === MOM_RETAILER_TAB ||
    activeTab === MOM_GROUP_TAB ||
    activeTab === NON_MULO_RETAILER_MOM_TAB ||
    activeTab === NON_MULO_GROUP_MOM_TAB;
  if (isMomTab) return "mom";
  if (isRetailerSpecificTab(activeTab, raw)) return retailerComparisonKey;
  return "yoy";
}

function isRetailerRollup(activeTab) {
  return activeTab === YOY_RETAILER_TAB ||
    activeTab === MOM_RETAILER_TAB ||
    activeTab === NON_MULO_RETAILER_MOM_TAB;
}

function isProductGroupRollup(activeTab) {
  return activeTab === YOY_GROUP_TAB ||
    activeTab === MOM_GROUP_TAB ||
    activeTab === NON_MULO_GROUP_MOM_TAB;
}

function isNonMuloTab(activeTab) {
  return activeTab === NON_MULO_RETAILER_MOM_TAB || activeTab === NON_MULO_GROUP_MOM_TAB;
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

function tabTitle(activeTab, raw, activeComparisonKey) {
  if (activeTab === YOY_RETAILER_TAB) return "All Retailers Roll-Up - by Retailer - YoY";
  if (activeTab === YOY_GROUP_TAB) return "All Retailers Roll-Up - by Product Group / MPG - YoY";
  if (activeTab === MOM_RETAILER_TAB) return "All Retailers Roll-Up - by Retailer - MoM";
  if (activeTab === MOM_GROUP_TAB) return "All Retailers Roll-Up - by Product Group / MPG - MoM";
  if (activeTab === NON_MULO_RETAILER_MOM_TAB) return "Non-Mulo - MoM by Retailer";
  if (activeTab === NON_MULO_GROUP_MOM_TAB) return "Non-Mulo - MoM by Product Group / MPG";
  const banner = raw.banner_order.find((name) => bannerTabId(name) === activeTab);
  return `${banner} - Fcst Inc Cases by Product Group / MPG - ${activeComparisonKey === "mom" ? "MoM" : "YoY"}`;
}

function tabSubtitle(activeTab, blendDisplays, periodLabels) {
  const base = periodLabels.base || "Base";
  const comparison = periodLabels.comparison || "Comparison";

  if (activeTab === NON_MULO_RETAILER_MOM_TAB) {
    return `Compares the ${comparison} pull against the ${base} pull for Amazon and Costco only.`;
  }
  if (activeTab === NON_MULO_GROUP_MOM_TAB) {
    return blendDisplays
      ? "Amazon and Costco only. Display volume is converted to regular cases, with retailer drilldowns sorted by total change."
      : "Amazon and Costco only. Displays stay separate and count as 1 case each, with retailer drilldowns sorted by total change.";
  }
  if (activeTab === MOM_RETAILER_TAB) {
    return `Compares the ${comparison} pull against the ${base} pull across all MPGs.`;
  }
  if (activeTab === MOM_GROUP_TAB) {
    return blendDisplays
      ? `Compares ${comparison} against ${base} with display volume converted to regular cases. Retailer drilldowns are sorted by total change.`
      : `Compares ${comparison} against ${base} with displays separate and counted as 1 case each. Retailer drilldowns are sorted by total change.`;
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

function promoLookupKey(...parts) {
  return parts.join("\u001f");
}

function sortPromoRows(rows) {
  return [...rows].sort((left, right) => {
    const deltaDifference = (right.fy26 - right.fy25) - (left.fy26 - left.fy25);
    return deltaDifference || left.label.localeCompare(right.label);
  });
}

function buildPromoLookups(promoRows) {
  const exact = new Map();
  const segmentAggregates = new Map();

  promoRows.forEach((row) => {
    const exactKey = promoLookupKey(row.banner, row.product_group, row.mpg);
    if (!exact.has(exactKey)) exact.set(exactKey, []);
    exact.get(exactKey).push(row);

    const aggregateKey = promoLookupKey(row.banner, row.product_group, row.promo_id);
    if (!segmentAggregates.has(aggregateKey)) {
      segmentAggregates.set(aggregateKey, {
        ...row,
        m25: Array(12).fill(0),
        m26: Array(12).fill(0),
        fy25: 0,
        fy26: 0,
      });
    }
    const aggregate = segmentAggregates.get(aggregateKey);
    row.m25.forEach((value, index) => {
      aggregate.m25[index] += value;
    });
    row.m26.forEach((value, index) => {
      aggregate.m26[index] += value;
    });
    aggregate.fy25 += row.fy25;
    aggregate.fy26 += row.fy26;
  });

  const segment = new Map();
  segmentAggregates.forEach((row) => {
    row.base_months = row.m25;
    row.comparison_months = row.m26;
    row.base_total = row.fy25;
    row.comparison_total = row.fy26;
    const segmentKey = promoLookupKey(row.banner, row.product_group);
    if (!segment.has(segmentKey)) segment.set(segmentKey, []);
    segment.get(segmentKey).push(row);
  });

  exact.forEach((rows, key) => exact.set(key, sortPromoRows(rows)));
  segment.forEach((rows, key) => segment.set(key, sortPromoRows(rows)));
  return { exact, segment };
}

function attachPromoRows(rows, promoLookups, layout, fixedBanner = null) {
  const result = [];
  let banner = fixedBanner;
  let productGroup = null;
  let mpg = null;

  function appendPromos(parent, promoRows) {
    const reconciledRows = promoRows.map((promo) => ({
      ...promo,
      m25: [...promo.m25],
      m26: [...promo.m26],
    }));

    ["m25", "m26"].forEach((field) => {
      parent[field].forEach((target, monthIndex) => {
        const residual = target - reconciledRows.reduce(
          (total, row) => total + row[field][monthIndex],
          0,
        );
        if (!residual || !reconciledRows.length) return;
        const recipient = reconciledRows.reduce((largest, row) =>
          Math.abs(row[field][monthIndex]) > Math.abs(largest[field][monthIndex]) ? row : largest,
        );
        recipient[field][monthIndex] += residual;
      });
    });

    ["fy25", "fy26"].forEach((field) => {
      const residual = parent[field] - reconciledRows.reduce((total, row) => total + row[field], 0);
      if (!residual || !reconciledRows.length) return;
      const recipient = reconciledRows.reduce((largest, row) =>
        Math.abs(row[field]) > Math.abs(largest[field]) ? row : largest,
      );
      recipient[field] += residual;
    });

    reconciledRows.forEach((promo) => {
      result.push({
        ...promo,
        base_months: promo.m25,
        comparison_months: promo.m26,
        base_total: promo.fy25,
        comparison_total: promo.fy26,
        depth: (parent.depth || 0) + 1,
        has_children: false,
        parent_key: parent.row_key,
        row_key: `${parent.row_key}::promo::${promo.promo_id}`,
      });
    });
  }

  rows.forEach((row) => {
    if (row.is_total) {
      result.push(row);
      return;
    }

    if (layout === "retailer") {
      if (row.is_retailer && row.depth === 0) {
        banner = row.label;
        productGroup = null;
        mpg = null;
      } else if (row.is_group) {
        productGroup = row.label;
        mpg = null;
      } else if (row.is_mpg) {
        mpg = row.label;
      }
    } else if (layout === "product") {
      if (row.is_group) {
        productGroup = row.label;
        mpg = null;
      } else if (row.is_mpg) {
        mpg = row.label;
      } else if (row.is_retailer) {
        banner = row.label;
      }
    } else if (layout === "segment") {
      if (row.is_group) productGroup = row.label;
      else if (row.is_retailer) banner = row.label;
    } else if (layout === "retailer-specific") {
      if (row.is_group) {
        productGroup = row.label;
        mpg = null;
      } else if (row.is_mpg) {
        mpg = row.label;
      }
    }

    result.push(row);

    const exactParent =
      (layout === "retailer" && row.is_mpg) ||
      (layout === "product" && row.is_retailer) ||
      (layout === "retailer-specific" && row.is_mpg);
    if (exactParent) {
      appendPromos(row, promoLookups.exact.get(promoLookupKey(banner, productGroup, mpg)) || []);
    } else if (layout === "segment" && row.is_retailer) {
      appendPromos(row, promoLookups.segment.get(promoLookupKey(banner, productGroup)) || []);
    }
  });

  return result;
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
  const [retailerComparisonKey, setRetailerComparisonKey] = useState("yoy");
  const [hideZeroChanges, setHideZeroChanges] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const { META, MONTHS, RAW } = dashboardData || EMPTY_DASHBOARD;
  const dataMode = blendDisplays ? "blended" : "separate";
  const activeComparisonKey = comparisonKeyForTab(activeTab, RAW, retailerComparisonKey);
  const activeComparison = RAW.comparisons?.[activeComparisonKey] || RAW;
  const yoyComparison = RAW.comparisons?.yoy || RAW;
  const momComparison = RAW.comparisons?.mom || RAW;
  const activeData = activeComparison.modes?.[dataMode] || EMPTY_MODE;
  const yoyData = yoyComparison.modes?.[dataMode] || EMPTY_MODE;
  const momData = momComparison.modes?.[dataMode] || EMPTY_MODE;
  const tableData = isNonMuloTab(activeTab) ? activeData.non_mulo || EMPTY_MODE : activeData;
  const yoyPeriodLabels = yoyComparison.period_labels || DEFAULT_PERIOD_LABELS;
  const momPeriodLabels = momComparison.period_labels || DEFAULT_PERIOD_LABELS;
  const periodLabels = activeComparison.period_labels || DEFAULT_PERIOD_LABELS;
  const activeBanner = RAW.banner_order.find((name) => bannerTabId(name) === activeTab) || null;
  const promoLookups = useMemo(
    () => buildPromoLookups(activeData.promo_rows || []),
    [activeData.promo_rows],
  );
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
      { id: NON_MULO_RETAILER_MOM_TAB, label: "Non-Mulo - MoM (Retailer)" },
      { id: NON_MULO_GROUP_MOM_TAB, label: "Non-Mulo - MoM (Product Group)" },
      ...RAW.banner_order.map((name, index) => ({
        id: bannerTabId(name),
        label: name,
        startsRetailerTabs: index === 0,
      })),
    ],
    [RAW.banner_order],
  );

  const activeRows = useMemo(() => {
    if (
      activeTab === YOY_RETAILER_TAB ||
      activeTab === MOM_RETAILER_TAB ||
      activeTab === NON_MULO_RETAILER_MOM_TAB
    ) {
      return attachPromoRows(tableData.rollup_ret, promoLookups, "retailer");
    }
    if (
      activeTab === YOY_GROUP_TAB ||
      activeTab === MOM_GROUP_TAB ||
      activeTab === NON_MULO_GROUP_MOM_TAB
    ) {
      const rows = productDrilldownLevel === "segment"
        ? tableData.rollup_segment || tableData.rollup_grp
        : tableData.rollup_grp;
      return attachPromoRows(
        rows,
        promoLookups,
        productDrilldownLevel === "segment" ? "segment" : "product",
      );
    }
    return attachPromoRows(
      activeData.retailers[activeBanner] || [],
      promoLookups,
      "retailer-specific",
      activeBanner,
    );
  }, [activeBanner, activeData.retailers, activeTab, productDrilldownLevel, promoLookups, tableData]);

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
          {momPeriodLabels.comparison} pull vs {momPeriodLabels.base} pull
        </p>
      </header>

      <StatsBar periodLabels={periodLabels} stats={tableData.stats} />

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
            momPeriodLabels={momPeriodLabels}
            momRow={findRetailerTotal(momData, name)}
            onClick={() => setActiveTab(bannerTabId(name))}
            yoyPeriodLabels={yoyPeriodLabels}
            yoyRow={findRetailerTotal(yoyData, name)}
          />
        ))}
      </section>

      <nav className="tabs" aria-label="Dashboard views">
        {tabs.map((tab) => (
          <button
            className={`tab-btn${activeTab === tab.id ? " active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.startsRetailerTabs ? <span className="tab-sep" aria-hidden="true">|</span> : null}
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="tab-pane active">
        <h2>{tabTitle(activeTab, RAW, activeComparisonKey)}</h2>
        <div className="sub">{tabSubtitle(activeTab, blendDisplays, periodLabels)}</div>
        {activeBanner ? (
          <ComparisonToggle
            comparisonKey={retailerComparisonKey}
            onChange={(comparisonKey) => {
              setRetailerComparisonKey(comparisonKey);
              setExpandedGroups(new Set());
            }}
          />
        ) : null}
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
              ? "Retailer / Product Group / MPG / Promo ID"
              : isProductGroupRollup(activeTab)
                ? productDrilldownLevel === "segment"
                  ? "Segment / Retailer / Promo ID"
                  : "Product Group / MPG / Retailer / Promo ID"
                : "Product Group / MPG / Promo ID"
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

function ComparisonToggle({ comparisonKey, onChange }) {
  return (
    <div className="comparison-toggle segmented-control" aria-label="Retailer comparison">
      <span>Comparison</span>
      <button
        className={comparisonKey === "yoy" ? "active" : ""}
        onClick={() => onChange("yoy")}
        type="button"
      >
        YoY
      </button>
      <button
        className={comparisonKey === "mom" ? "active" : ""}
        onClick={() => onChange("mom")}
        type="button"
      >
        MoM
      </button>
    </div>
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

function findRetailerTotal(data, name) {
  return (data.retailer_totals || data.rollup_ret || []).find((item) => item.label === name);
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

function RetailerCard({ active, momPeriodLabels, momRow, name, onClick, yoyPeriodLabels, yoyRow }) {
  return (
    <button className={`card${active ? " active-card" : ""}`} onClick={onClick} type="button">
      <div className="card-name" title={name}>{name}</div>
      <RetailerCardMetric label="YoY" periodLabels={yoyPeriodLabels} row={yoyRow} />
      <RetailerCardMetric label="MoM" periodLabels={momPeriodLabels} row={momRow} />
    </button>
  );
}

function RetailerCardMetric({ label, periodLabels, row }) {
  const fy25 = row?.fy25 || 0;
  const fy26 = row?.fy26 || 0;
  const delta = fy26 - fy25;
  const pct = fy25 ? ` (${delta >= 0 ? "+" : ""}${((delta / Math.abs(fy25)) * 100).toFixed(1)}%)` : "";
  const cls = delta > 0 ? "pos" : delta < 0 ? "neg" : "";

  return (
    <div className="card-section">
      <div className="card-section-title">{label}</div>
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
    </div>
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
  if (row.is_total) return -1;
  if (Number.isInteger(row.depth)) return row.depth;
  if (row.is_group) return 0;
  if (row.is_mpg) return 1;
  return 2;
}

function filterRowsForChange(rows, visibleMonths, hideZeroChanges) {
  if (!hideZeroChanges) return rows;

  const keep = rows.map((row) => row.is_total || rowHasChange(row, visibleMonths));

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const level = rowLevel(rows[index]);
    if (!rows[index].has_children) continue;

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
  const displayDividerParents = new Set();

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
      const displayParent = nextRow.parent_key || "root";
      const shouldStartDisplaySection = !displayDividerParents.has(displayParent);
      if (nextRow === row || nextRow.display_section_start !== shouldStartDisplaySection) {
        nextRow = { ...nextRow, display_section_start: shouldStartDisplaySection };
      }
      displayDividerParents.add(displayParent);
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
  const openByDepth = [];
  const visibleRows = [];

  rows.forEach((row, index) => {
    if (row.is_total) {
      visibleRows.push({ index, isOpen: false, row, rowClass: "tot-row", rowKey: null });
      return;
    }

    const depth = Math.max(0, rowLevel(row));
    const visible = depth === 0 || Boolean(openByDepth[depth - 1]);
    const rowKey = row.has_children
      ? `${tabId}-${row.row_key || `${index}-${row.row_type}-${row.label}`}`
      : null;
    const isOpen = row.has_children ? expandedGroups.has(rowKey) : true;
    openByDepth[depth] = visible && isOpen;
    openByDepth.length = depth + 1;

    if (!visible) return;

    const baseRowClass = row.is_total
      ? "tot-row"
      : row.is_group
        ? "grp-hdr"
        : row.is_mpg
          ? "mpg-row"
          : row.is_retailer
            ? "retailer-row"
            : row.is_promo
              ? "promo-row"
              : "sku-row";
    const rowClass = `${baseRowClass} depth-${depth}${row.display_section_start ? " display-section-start" : ""}`;
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
              <tr className={rowClass} key={`${tabId}-${row.row_key || `${index}-${row.label}`}`}>
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
  const endClass = index === monthCount ? "fy-end" : "month-end";

  return (
    <>
      <th className={`subhead-cell${boundaryClass}`}>{periodLabels.base_short}</th>
      <th>{periodLabels.comparison_short}</th>
      <th className={endClass}>{periodLabels.delta}</th>
    </>
  );
}

function LabelCell({ groupKey, isOpen, row, toggleGroup }) {
  if (row.is_total) return <td className="totlbl">{row.label}</td>;

  const labelClass = row.is_group
    ? "glbl"
    : row.is_mpg
      ? "mlbl"
      : row.is_retailer
        ? "rlbl"
        : row.is_promo
          ? "plbl"
          : "slbl";
  const style = { "--row-depth": rowLevel(row) };

  if (!row.has_children) {
    return <td className={`${labelClass} hierarchy-label`} style={style}>{row.label}</td>;
  }

  return (
    <td className={`${labelClass} hierarchy-label`} style={style}>
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

function MonthCells({ base, comparison, fullYear = false, monthIndex = null }) {
  const boundaryClass = fullYear || monthIndex !== null ? (fullYear ? " fy-boundary" : " month-boundary") : "";
  const endClass = fullYear ? " fy-end" : " month-end";

  return (
    <>
      <td className={`y25${boundaryClass}`}>{formatNumber(base)}</td>
      <td className="y26">{formatNumber(comparison)}</td>
      <td className={`${deltaClass(base, comparison)}${endClass}`}>
        {fullYear ? formatFullYearDelta(base, comparison) : formatDelta(base, comparison)}
      </td>
    </>
  );
}
