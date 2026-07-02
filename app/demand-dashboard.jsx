"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MONTHS,
  buildDemandReview,
  parseCsv,
  pivotByRetailerAndMpg,
} from "./lib/demand-review";

const BASE_YEAR = 2025;
const COMPARISON_YEAR = 2026;

function formatCases(value, signed = false) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    signDisplay: signed ? "always" : "auto",
  }).format(value);
}

export default function DemandDashboard() {
  const [rows, setRows] = useState([]);
  const [retailerFilter, setRetailerFilter] = useState("all");
  const [mpgFilter, setMpgFilter] = useState("all");
  const [status, setStatus] = useState("Loading sample demand review data.");

  useEffect(() => {
    fetch("/data/demand-review.csv")
      .then((response) => response.text())
      .then((text) => loadCsv(text))
      .catch(() => {
        setStatus(
          "Upload a CSV to begin. Expected columns: retailer, year, month, mpg, unit_type, quantity, cases_per_drp, and cases.",
        );
      });
  }, []);

  function loadCsv(text) {
    const rawRows = parseCsv(text);
    setRows(buildDemandReview(rawRows, BASE_YEAR, COMPARISON_YEAR));
    setRetailerFilter("all");
    setMpgFilter("all");
    setStatus(
      `Loaded ${rawRows.length} source rows. DRP displays converted to regular cases before totals are calculated.`,
    );
  }

  async function handleUpload(event) {
    const [file] = event.target.files;
    if (!file) return;
    loadCsv(await file.text());
  }

  const retailers = useMemo(
    () => [...new Set(rows.map((row) => row.retailer))].sort(),
    [rows],
  );

  const mpgs = useMemo(
    () => [...new Set(rows.map((row) => row.mpg))].sort(),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (retailerFilter === "all" || row.retailer === retailerFilter) &&
          (mpgFilter === "all" || row.mpg === mpgFilter),
      ),
    [mpgFilter, retailerFilter, rows],
  );

  const summary = useMemo(() => {
    const baseCases = filteredRows.reduce((total, row) => total + row.baseCases, 0);
    const comparisonCases = filteredRows.reduce(
      (total, row) => total + row.comparisonCases,
      0,
    );

    return {
      baseCases,
      comparisonCases,
      difference: comparisonCases - baseCases,
    };
  }, [filteredRows]);

  const pivotRows = useMemo(
    () => pivotByRetailerAndMpg(filteredRows),
    [filteredRows],
  );

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <p className="eyebrow">Demand review</p>
        <div>
          <h1>Monthly case-volume difference by retailer and MPG</h1>
          <p>
            Compare 2026 against 2025, convert DRP displays into cases, and
            review combined MPG-level movement without flavour-level noise.
          </p>
        </div>
      </section>

      <section className="control-grid" aria-label="Dashboard controls">
        <label>
          <span>Upload CSV</span>
          <input type="file" accept=".csv" onChange={handleUpload} />
        </label>
        <label>
          <span>Retailer</span>
          <select
            value={retailerFilter}
            onChange={(event) => setRetailerFilter(event.target.value)}
          >
            <option value="all">All retailers</option>
            {retailers.map((retailer) => (
              <option key={retailer} value={retailer}>
                {retailer}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>MPG</span>
          <select
            value={mpgFilter}
            onChange={(event) => setMpgFilter(event.target.value)}
          >
            <option value="all">All MPGs</option>
            {mpgs.map((mpg) => (
              <option key={mpg} value={mpg}>
                {mpg}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="summary-grid" aria-label="Volume summary">
        <SummaryCard label="2025 cases" value={summary.baseCases} />
        <SummaryCard label="2026 cases" value={summary.comparisonCases} />
        <SummaryCard label="Volume difference" value={summary.difference} signed />
      </section>

      <p className="status-line">{status}</p>

      <section className="table-panel" aria-label="Monthly demand review table">
        <table>
          <caption>
            Values show 2026 cases minus 2025 cases for each month.
          </caption>
          <thead>
            <tr>
              <th>Retailer</th>
              <th>MPG</th>
              {MONTHS.map((month) => (
                <th key={month}>{month.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pivotRows.map((group) => (
              <tr key={`${group.retailer}-${group.mpg}`}>
                <th>{group.retailer}</th>
                <th>{group.mpg}</th>
                {MONTHS.map((month) => {
                  const record = group.months[month];
                  if (!record) {
                    return (
                      <td key={month} className="muted">
                        -
                      </td>
                    );
                  }

                  const className =
                    record.difference < 0
                      ? "down"
                      : record.difference > 0
                        ? "up"
                        : "flat";

                  return (
                    <td
                      key={month}
                      className={className}
                      title={`2026: ${formatCases(record.comparisonCases)} cases; 2025: ${formatCases(record.baseCases)} cases`}
                    >
                      {formatCases(record.difference, true)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function SummaryCard({ label, value, signed = false }) {
  const tone = value < 0 ? "negative" : "positive";

  return (
    <article className={`summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{formatCases(value, signed)}</strong>
      <small>All values are cases.</small>
    </article>
  );
}
