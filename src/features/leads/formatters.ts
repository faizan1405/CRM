export function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatDate(value: string | null) {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[Number(month) - 1]} ${year}`;
}
