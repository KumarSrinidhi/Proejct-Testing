import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

export default function TrendChart({ type = "line", labels = [], values = [], label = "Attendance" }) {
  const accentColor = type === "bar" ? "rgba(0,212,255,0.8)" : "rgba(0,212,255,1)";
  const fillColor = "rgba(0,212,255,0.1)";

  const data = {
    labels,
    datasets: [
      {
        label,
        data: values,
        borderColor: accentColor,
        backgroundColor: type === "bar" ? "rgba(0,212,255,0.6)" : fillColor,
        borderWidth: type === "bar" ? 0 : 2,
        tension: 0.4,
        fill: type === "line",
        pointBackgroundColor: "rgba(0,212,255,1)",
        pointBorderColor: "rgba(0,212,255,1)",
        pointRadius: type === "line" ? 4 : 0,
        pointHoverRadius: 6,
        borderRadius: type === "bar" ? 6 : 0,
        barThickness: "flex",
        maxBarThickness: 40,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(22,27,34,0.95)",
        borderColor: "rgba(0,212,255,0.3)",
        borderWidth: 1,
        titleColor: "#e2e8f0",
        bodyColor: "#94a3b8",
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(255,255,255,0.04)",
          drawBorder: false,
        },
        ticks: {
          color: "#64748b",
          font: { size: 11, family: "Inter" },
        },
        border: { display: false },
      },
      y: {
        grid: {
          color: "rgba(255,255,255,0.05)",
          drawBorder: false,
        },
        ticks: {
          color: "#64748b",
          font: { size: 11, family: "Inter" },
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  if (labels.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
        No data available
      </div>
    );
  }

  return type === "bar" ? <Bar data={data} options={options} /> : <Line data={data} options={options} />;
}
