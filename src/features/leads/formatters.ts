export function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatDate(value: string | null) {
  if (!value) return "Not set";
  const dateOnly = value.includes("T") ? value.split("T")[0] : value;
  const [year, month, day] = dateOnly.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[Number(month) - 1];
  if (!m || !day || !year) return value;
  return `${Number(day)} ${m} ${year}`;
}

