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
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const { META, MONTHS, RAW } = dashboardData || EMPTY_DASHBOARD;
  const dataMode = blendDisplays ? "blended" : "separate";
  const activeComparisonKey = comparisonKeyForTab(activeTab);
  const activeComparison = RAW.comparisons?.[activeComparisonKey] || RAW;
  const yoyComparison = RAW.comparisons?.yoy || RAW;
  const activeData = activeComparison.modes?.[dataMode] || EMPTY_MODE;
  const yoyData = yoyComparison.modes?.[dataMode] || EMPTY_MODE;
  const periodLabels = activeComparison.period_labels || DEFAULT_PERIOD_LABELS;
  const yoyPeriodLabels = yoyComparison.period_labels || DEFAULT_PERIOD_LABELS;

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
    if (activeTab === YOY_GROUP_TAB || activeTab === MOM_GROUP_TAB) return activeData.rollup_grp;
    const banner = RAW.banner_order.find((name) => bannerTabId(name) === activeTab);
    return yoyData.retailers[banner] || [];
  }, [activeData, activeTab, RAW.banner_order, yoyData]);

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
            periodLabels={yoyPeriodLabels}
            row={yoyData.rollup_ret.find((item) => item.label === name)}
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
        <Legend periodLabels={periodLabels} />
        <DataTable
          expandedGroups={expandedGroups}
          labelHeader={
            isRetailerRollup(activeTab)
              ? "Retailer"
              : isProductGroupRollup(activeTab)
                ? "Product Group / MPG / Retailer"
                : "Product Group / MPG"
          }
          months={MONTHS}
          periodLabels={periodLabels}
          rows={activeRows}
          tabId={`${activeComparisonKey}-${dataMode}-${activeTab}`}
          toggleGroup={toggleGroup}
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

function DataTable({ expandedGroups, labelHeader, months, periodLabels, rows, tabId, toggleGroup }) {
  let currentGroup = null;
  let currentGroupOpen = true;
  let currentMpg = null;
  let currentMpgOpen = true;
  let groupIndex = 0;
  let mpgIndex = 0;

  return (
    <div className="tbl-wrap">
      <table className="dt">
        <thead>
          <tr className="hdr1">
            <th className="lhdr" rowSpan="2">{labelHeader}</th>
            {months.map((month) => (
              <th className="month-head" colSpan="3" key={month}>{month}</th>
            ))}
            <th className="month-head fy-head" colSpan="3">FULL YEAR</th>
          </tr>
          <tr className="hdr2">
            {Array.from({ length: months.length + 1 }, (_, index) => (
              <MonthSubhead index={index} key={index} monthCount={months.length} periodLabels={periodLabels} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
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
              visible = currentGroupOpen && currentMpgOpen;
            } else if (row.is_total) {
              groupKey = null;
              mpgKey = null;
              visible = true;
            } else {
              visible = currentGroupOpen;
            }

            if (!visible) return null;

            const rowClass = row.is_total
              ? "tot-row"
              : row.is_group
                ? "grp-hdr"
                : row.is_mpg
                  ? "mpg-row"
                  : row.is_retailer
                    ? "retailer-row"
                    : "sku-row";
            return (
              <tr className={rowClass} key={`${tabId}-${index}-${row.label}`}>
                <LabelCell
                  groupKey={rowKey}
                  isOpen={isOpen}
                  row={row}
                  toggleGroup={toggleGroup}
                />
                {months.map((month, monthIndex) => (
                  <MonthCells
                    base={row.m25?.[monthIndex] || 0}
                    comparison={row.m26?.[monthIndex] || 0}
                    key={month}
                    monthIndex={monthIndex}
                  />
                ))}
                <MonthCells base={row.fy25 || 0} comparison={row.fy26 || 0} fullYear />
              </tr>
            );
          })}
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
