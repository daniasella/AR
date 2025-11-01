export function createChart() {
  const ctx = document.getElementById("sensorChart").getContext("2d");
  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Suhu (°C)",
        data: [],
        borderColor: "#ff6384",
        backgroundColor: "rgba(255, 99, 132, 0.15)",
        fill: true,
        tension: 0.4
      }, {
        label: "AQI",
        data: [],
        borderColor: "#36a2eb",
        backgroundColor: "rgba(54, 162, 235, 0.12)",
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 200 },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
  return chart;
}

export function pushData(chart, point) {
  const label = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(point.temperature);
  chart.data.datasets[1].data.push(point.aqi);

  // Keep last 12 points
  if (chart.data.labels.length > 12) {
    chart.data.labels.shift();
    chart.data.datasets.forEach(ds => ds.data.shift());
  }
  chart.update('none');
}
