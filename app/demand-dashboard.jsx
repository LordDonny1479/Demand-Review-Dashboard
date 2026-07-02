"use client";

import { useMemo, useState } from "react";
import { META, MONTHS, RAW } from "./data/promo-yoy-data";

const ROLLUP_RETAILER_TAB = "tab-rollup-retailer";
const ROLLUP_GROUP_TAB = "tab-rollup-group";

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

function tabTitle(activeTab) {
  if (activeTab === ROLLUP_RETAILER_TAB) return "All Retailers Roll-Up - by Retailer";
  if (activeTab === ROLLUP_GROUP_TAB) return "All Retailers Roll-Up - by Product Group / MPG";
  const banner = RAW.banner_order.find((name) => bannerTabId(name) === activeTab);
  return `${banner} - Fcst Inc Cases by Product Group / MPG`;
}

function tabSubtitle(activeTab, blendDisplays) {
  if (activeTab === ROLLUP_RETAILER_TAB) {
    return "Each row is one banner/customer total across all MPGs.";
  }
  return blendDisplays
    ? "MPG rows combine flavours and include display volume converted to regular cases."
    : "Display and DRP rows stay separate and count each display as 1 case.";
}

export default function DemandDashboard() {
  const [activeTab, setActiveTab] = useState(ROLLUP_RETAILER_TAB);
  const [blendDisplays, setBlendDisplays] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const dataMode = blendDisplays ? "blended" : "separate";
  const activeData = RAW.modes[dataMode];

  const tabs = useMemo(
    () => [
      { id: ROLLUP_RETAILER_TAB, label: "By Retailer" },
      { id: ROLLUP_GROUP_TAB, label: "By Product Group" },
      ...RAW.banner_order.map((name) => ({ id: bannerTabId(name), label: name })),
    ],
    [],
  );

  const activeRows = useMemo(() => {
    if (activeTab === ROLLUP_RETAILER_TAB) return activeData.rollup_ret;
    if (activeTab === ROLLUP_GROUP_TAB) return activeData.rollup_grp;
    const banner = RAW.banner_order.find((name) => bannerTabId(name) === activeTab);
    return activeData.retailers[banner] || [];
  }, [activeData, activeTab]);

  function toggleGroup(groupKey) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  return (
    <main className="promo-dashboard">
      <header className="promo-header">
        <h1>TH CPG - Promotional Fcst Inc Cases Year-over-Year (2025 vs 2026)</h1>
        <p>
          In-market execution dates | Cases pro-rated by execution days per
          calendar month | Fcst Inc Cases &gt; 0 rows only | 2025 =
          Closed/Committed | 2026 = Planned/Committed
        </p>
      </header>

      <StatsBar stats={activeData.stats} />

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
            row={activeData.rollup_ret.find((item) => item.label === name)}
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
            {index === 2 ? <span className="tab-sep" aria-hidden="true">|</span> : null}
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="tab-pane active">
        <h2>{tabTitle(activeTab)}</h2>
        <div className="sub">{tabSubtitle(activeTab, blendDisplays)}</div>
        <Legend />
        <DataTable
          expandedGroups={expandedGroups}
          labelHeader={activeTab === ROLLUP_RETAILER_TAB ? "Retailer" : "Product Group / MPG"}
          rows={activeRows}
          tabId={`${dataMode}-${activeTab}`}
          toggleGroup={toggleGroup}
        />
      </section>

      <footer className="data-footnote">
        Source: {META.generated_from.demand_workbook} and {META.generated_from.product_workbook}
      </footer>
    </main>
  );
}

function StatsBar({ stats }) {
  const deltaTone = stats.delta >= 0 ? "pos" : "neg";
  const pct = stats.delta_pct === null ? "-" : `${stats.delta_pct >= 0 ? "+" : ""}${stats.delta_pct}%`;

  return (
    <section className="stats-bar" aria-label="Full-year summary">
      <Stat label="FY 2025 Cases" value={formatNumber(stats.fy25)} />
      <Stat label="FY 2026 Cases" value={formatNumber(stats.fy26)} />
      <Stat className={deltaTone} label="YoY Delta Cases" value={formatSigned(stats.delta)} />
      <Stat className={deltaTone} label="YoY %" value={pct} />
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

function RetailerCard({ active, name, onClick, row }) {
  const fy25 = row?.fy25 || 0;
  const fy26 = row?.fy26 || 0;
  const delta = fy26 - fy25;
  const pct = fy25 ? ` (${delta >= 0 ? "+" : ""}${((delta / Math.abs(fy25)) * 100).toFixed(1)}%)` : "";
  const cls = delta > 0 ? "pos" : delta < 0 ? "neg" : "";

  return (
    <button className={`card${active ? " active-card" : ""}`} onClick={onClick} type="button">
      <div className="card-name">{name}</div>
      <div className="card-row">
        <span>2025</span>
        <span>{formatNumber(fy25)}</span>
      </div>
      <div className="card-row">
        <span>2026</span>
        <span>{formatNumber(fy26)}</span>
      </div>
      <div className={`card-delta ${cls}`}>
        {formatSigned(delta)}
        {pct}
      </div>
    </button>
  );
}

function Legend() {
  return (
    <div className="legend" aria-label="Delta legend">
      <span className="li"><span className="sw sw-up" /> Increase</span>
      <span className="li"><span className="sw sw-dn" /> Decrease</span>
      <span className="li"><span className="sw sw-nw" /> New in 2026</span>
      <span className="legend-note">Grey = 2025 | Bold = 2026 | Full Year delta includes %</span>
    </div>
  );
}

function DataTable({ expandedGroups, labelHeader, rows, tabId, toggleGroup }) {
  let currentGroup = null;
  let currentGroupOpen = true;
  let groupIndex = 0;

  return (
    <div className="tbl-wrap">
      <table className="dt">
        <thead>
          <tr className="hdr1">
            <th className="lhdr" rowSpan="2">{labelHeader}</th>
            {MONTHS.map((month) => (
              <th colSpan="3" key={month}>{month}</th>
            ))}
            <th colSpan="3">FULL YEAR</th>
          </tr>
          <tr className="hdr2">
            {Array.from({ length: 13 }, (_, index) => (
              <MonthSubhead index={index} key={index} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            let groupKey = currentGroup;
            let visible = currentGroupOpen;

            if (row.is_group && !row.is_total) {
              groupKey = `${tabId}-${groupIndex}-${row.label}`;
              currentGroup = groupKey;
              groupIndex += 1;
              currentGroupOpen = expandedGroups.has(groupKey);
              visible = true;
            } else if (row.is_total) {
              groupKey = null;
              visible = true;
            }

            if (!visible) return null;

            const rowClass = row.is_total ? "tot-row" : row.is_group ? "grp-hdr" : "sku-row";
            return (
              <tr className={rowClass} key={`${tabId}-${index}-${row.label}`}>
                <LabelCell
                  groupKey={groupKey}
                  isOpen={groupKey ? expandedGroups.has(groupKey) : false}
                  row={row}
                  toggleGroup={toggleGroup}
                />
                {MONTHS.map((month, monthIndex) => (
                  <MonthCells
                    base={row.m25?.[monthIndex] || 0}
                    comparison={row.m26?.[monthIndex] || 0}
                    key={month}
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

function MonthSubhead() {
  return (
    <>
      <th>&apos;25</th>
      <th>&apos;26</th>
      <th>Delta</th>
    </>
  );
}

function LabelCell({ groupKey, isOpen, row, toggleGroup }) {
  if (row.is_total) return <td className="totlbl">{row.label}</td>;

  if (row.is_group) {
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

  return <td className="slbl">{row.label}</td>;
}

function MonthCells({ base, comparison, fullYear = false }) {
  return (
    <>
      <td className="y25">{formatNumber(base)}</td>
      <td className="y26">{formatNumber(comparison)}</td>
      <td className={deltaClass(base, comparison)}>
        {fullYear ? formatFullYearDelta(base, comparison) : formatDelta(base, comparison)}
      </td>
    </>
  );
}
