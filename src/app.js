const state = { rows: [], baseYear: 2025, comparisonYear: 2026 };

const fileInput = document.querySelector('#fileInput');
const retailerFilter = document.querySelector('#retailerFilter');
const mpgFilter = document.querySelector('#mpgFilter');
const summaryCards = document.querySelector('#summaryCards');
const tableBody = document.querySelector('#reviewTable tbody');
const updatedAt = document.querySelector('#updatedAt');

function formatCases(value, signed = false) {
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, signDisplay: signed ? 'always' : 'auto' });
  return formatter.format(value);
}

function hydrateFilters(rows) {
  const retailers = [...new Set(rows.map((row) => row.retailer))].sort();
  const mpgs = [...new Set(rows.map((row) => row.mpg))].sort();
  retailerFilter.innerHTML = '<option value="all">All retailers</option>' + retailers.map((retailer) => `<option>${retailer}</option>`).join('');
  mpgFilter.innerHTML = '<option value="all">All MPGs</option>' + mpgs.map((mpg) => `<option>${mpg}</option>`).join('');
}

function filteredRows() {
  return state.rows.filter((row) => (
    (retailerFilter.value === 'all' || row.retailer === retailerFilter.value)
    && (mpgFilter.value === 'all' || row.mpg === mpgFilter.value)
  ));
}

function renderSummary(rows) {
  const baseCases = rows.reduce((total, row) => total + row.baseCases, 0);
  const comparisonCases = rows.reduce((total, row) => total + row.comparisonCases, 0);
  const difference = comparisonCases - baseCases;
  summaryCards.innerHTML = [
    ['2025 cases', baseCases, false],
    ['2026 cases', comparisonCases, false],
    ['Volume difference', difference, true]
  ].map(([label, value, signed]) => `
    <article class="card ${value < 0 ? 'negative' : 'positive'}">
      <span>${label}</span>
      <strong>${formatCases(value, signed)}</strong>
      <small>All values are cases.</small>
    </article>
  `).join('');
}

function renderTable() {
  const rows = filteredRows();
  renderSummary(rows);
  const pivot = pivotByRetailerAndMpg(rows);
  tableBody.innerHTML = pivot.map((group) => `
    <tr>
      <th>${group.retailer}</th>
      <th>${group.mpg}</th>
      ${MONTHS.map((month) => {
        const record = group.months[month];
        if (!record) return '<td class="muted">—</td>';
        const className = record.difference < 0 ? 'down' : record.difference > 0 ? 'up' : 'flat';
        return `<td class="${className}" title="2026: ${formatCases(record.comparisonCases)} cases; 2025: ${formatCases(record.baseCases)} cases">${formatCases(record.difference, true)}</td>`;
      }).join('')}
    </tr>
  `).join('');
}

function loadCsv(text) {
  const rawRows = parseCsv(text);
  state.rows = buildDemandReview(rawRows, state.baseYear, state.comparisonYear);
  hydrateFilters(state.rows);
  renderTable();
  updatedAt.textContent = `Loaded ${rawRows.length} source rows. Displays converted to cases before totals are calculated.`;
}

fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  loadCsv(await file.text());
});
retailerFilter.addEventListener('change', renderTable);
mpgFilter.addEventListener('change', renderTable);

fetch('data/demand-review-sample.csv')
  .then((response) => response.text())
  .then(loadCsv)
  .catch(() => {
    updatedAt.textContent = 'Upload a CSV to begin. Expected columns: retailer, year, month, mpg, product, unit_type, quantity, cases_per_drp.';
  });
