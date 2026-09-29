export function formatTime(value: number | null | undefined, seconds = true): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: false
  }).format(value);
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value!) >= 100_000_000) return `${(value! / 100_000_000).toFixed(2)}亿`;
  if (Math.abs(value!) >= 10_000) return `${(value! / 10_000).toFixed(2)}万`;
  return value!.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

export function direction(value: number | null | undefined): "rise" | "fall" | "flat" {
  return value === null || value === undefined || value === 0 ? "flat" : value > 0 ? "rise" : "fall";
}

export function signed(value: number | null | undefined, suffix = ""): string {
  if (!Number.isFinite(value)) return "—";
  return `${value! > 0 ? "+" : ""}${value!.toFixed(2)}${suffix}`;
}
