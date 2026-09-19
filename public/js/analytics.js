/**
 * Advocate DigiDiary — Practice Analytics Logic
 * Powered by Chart.js with real MongoDB aggregation queries.
 */

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth();

  await loadSummaryKPIs();
  await renderCourtChart();
  await renderCaseTypeChart();
  await renderOutcomesChart();
  await renderRevenueChart();
});

async function loadSummaryKPIs() {
  try {
    const res = await API.analytics.getSummary();
    if (res.success && res.data) {
      const d = res.data;
      document.getElementById('anTotalCases').innerText = d.totalCases || 0;
      document.getElementById('anActiveCasesSub').innerText = `${d.totalActiveCases || 0} active matters in progress`;
      document.getElementById('anTotalBilled').innerText = UI.formatINR(d.totalBilled || 0);
      document.getElementById('anTotalRevenue').innerText = UI.formatINR(d.totalCollected || 0);
      document.getElementById('anTotalExpenses').innerText = UI.formatINR(d.totalExpenses || 0);
    }
  } catch (err) {
    console.error('Failed to load KPIs:', err);
  }
}

async function renderCourtChart() {
  try {
    const res = await API.analytics.getCaseDistribution();
    if (res.success && res.data && res.data.byCourt) {
      const courts = res.data.byCourt;
      const labels = courts.map(c => c._id || 'Unspecified');
      const counts = courts.map(c => c.count);

      const ctx = document.getElementById('courtChart').getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: counts,
            backgroundColor: [
              '#0A1128',
              '#C59B27',
              '#1E3A8A',
              '#059669',
              '#D97706',
              '#6B7280'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right' }
          }
        }
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function renderCaseTypeChart() {
  try {
    const res = await API.analytics.getCaseDistribution();
    if (res.success && res.data && res.data.byCaseType) {
      const types = res.data.byCaseType;
      const labels = types.map(t => t._id || 'Other');
      const counts = types.map(t => t.count);

      const ctx = document.getElementById('caseTypeChart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Cases',
            data: counts,
            backgroundColor: '#C59B27',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function renderOutcomesChart() {
  try {
    const res = await API.analytics.getHearingOutcomes();
    if (res.success && res.data) {
      const outcomes = res.data;
      const labels = outcomes.map(o => (o._id || 'Scheduled').toUpperCase());
      const counts = outcomes.map(o => o.count);

      const ctx = document.getElementById('outcomesChart').getContext('2d');
      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: counts,
            backgroundColor: [
              '#059669', // completed
              '#D97706', // adjourned
              '#0A1128', // scheduled
              '#DC2626'  // cancelled
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right' } }
        }
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function renderRevenueChart() {
  try {
    const res = await API.analytics.getMonthlyRevenue();
    if (res.success && res.data) {
      const monthly = res.data;
      const labels = monthly.map(m => m.month || 'Current');
      const revenue = monthly.map(m => m.revenue || 0);
      const expenses = monthly.map(m => m.expenses || 0);

      const ctx = document.getElementById('revenueChart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['Current Month'],
          datasets: [
            {
              label: 'Fees Collected (₹)',
              data: revenue.length ? revenue : [0],
              backgroundColor: '#059669',
              borderRadius: 4
            },
            {
              label: 'Expenses (₹)',
              data: expenses.length ? expenses : [0],
              backgroundColor: '#DC2626',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }
  } catch (err) {
    console.error(err);
  }
}
