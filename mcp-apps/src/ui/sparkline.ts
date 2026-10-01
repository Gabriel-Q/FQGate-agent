import { element } from "./dom";

export function createSparkline(values: readonly number[]): SVGSVGElement | HTMLElement {
  if (values.length < 2) return element("span", "sparkline-empty", "—");
  const width = 112;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = index / (values.length - 1) * width;
    const y = height - 2 - (value - min) / range * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", `sparkline is-${values.at(-1)! >= values[0]! ? "rise" : "fall"}`);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `日内走势，从 ${values[0]!.toFixed(2)} 到 ${values.at(-1)!.toFixed(2)}`);
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  line.setAttribute("fill", "none");
  line.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(line);
  return svg;
}
