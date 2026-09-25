type Breakpoint = readonly [number, number, number, number];
const PM25: readonly Breakpoint[] = [[0, 9, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]];
const PM10: readonly Breakpoint[] = [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150], [255, 354, 151, 200], [355, 424, 201, 300], [425, 604, 301, 500]];
function subIndex(value: number, breakpoints: readonly Breakpoint[], decimalPlaces: number) {
  const scale = 10 ** decimalPlaces;
  const rounded = Math.floor(value * scale) / scale;
  const band = breakpoints.find(([low, high]) => rounded >= low && rounded <= high);
  if (!band) return rounded < 0 ? 0 : 500;
  const [cLow, cHigh, iLow, iHigh] = band;
  return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (rounded - cLow) + iLow);
}
export function calculateAqi(pm25: number, pm10: number) {
  return Math.max(subIndex(pm25, PM25, 1), subIndex(pm10, PM10, 0));
}
export function classifyAqi(aqi: number) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}
