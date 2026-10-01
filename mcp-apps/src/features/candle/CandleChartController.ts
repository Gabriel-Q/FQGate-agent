import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  TickMarkType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type Time,
  type UTCTimestamp
} from "lightweight-charts";

import type { CandleBar, CandleData } from "@/shared/contracts";
import { isLineKlineInterval, isMinuteKlineInterval } from "@/shared/kline";
import { formatPrice } from "./formatters";

export type CandleHoverHandler = (bar: CandleBar | null) => void;
export type CandleHistoryBoundaryHandler = () => void;

const HISTORY_BOUNDARY_BARS = 30;

export class CandleChartController {
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<"Candlestick"> | null = null;
  private lineSeries: ISeriesApi<"Line"> | null = null;
  private volumeSeries: ISeriesApi<"Histogram"> | null = null;
  private movingAverageSeries: Array<ISeriesApi<"Line">> = [];
  private data: CandleData | null = null;
  private movingAveragesVisible = true;
  private visibleLogicalRange: LogicalRange | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly onHover: CandleHoverHandler,
    private readonly onHistoryBoundary: CandleHistoryBoundaryHandler
  ) {}

  render(data: CandleData): void {
    this.destroyChart();
    this.data = data;

    const styles = getComputedStyle(this.container);
    const textColor = cssColor(styles, "--fg-muted", "#667085");
    const lineColor = cssColor(styles, "--border-subtle", "#e4e7ec");
    const riseColor = cssColor(styles, "--market-rise", "#d92d20");
    const fallColor = cssColor(styles, "--market-fall", "#07883f");
    const isLineChart = isLineKlineInterval(data.interval);
    this.chart = createChart(this.container, {
      width: Math.max(1, this.container.clientWidth),
      height: Math.max(1, this.container.clientHeight),
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
        fontSize: 10
      },
      grid: {
        vertLines: { color: lineColor },
        horzLines: { color: lineColor }
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { visible: false },
      timeScale: {
        borderColor: lineColor,
        timeVisible: isMinuteKlineInterval(data.interval),
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => formatTickMark(time, tickMarkType)
      },
      localization: {
        locale: "zh-CN",
        priceFormatter: (price: number) => formatPrice(price),
        timeFormatter: (time: Time) => formatChartTime(time, isMinuteKlineInterval(data.interval))
      }
    });

    if (isLineChart) {
      this.lineSeries = this.chart.addSeries(LineSeries, {
        color: "#165dff",
        lineWidth: 2,
        priceLineVisible: true,
        crosshairMarkerVisible: true
      });
      this.lineSeries.setData(data.bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        value: bar.close
      })));
    } else {
      this.candleSeries = this.chart.addSeries(CandlestickSeries, {
        upColor: riseColor,
        downColor: fallColor,
        borderVisible: false,
        wickUpColor: riseColor,
        wickDownColor: fallColor,
        priceLineVisible: false
      });
      this.candleSeries.setData(data.bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close
      })));
    }
    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false
    });
    this.chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.14, bottom: 0.28 } });
    this.volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const volumes = isLineChart ? incrementalVolumes(data.bars) : data.bars.map((bar) => bar.volume);
    this.volumeSeries.setData(data.bars.map((bar, index) => ({
      time: bar.time as UTCTimestamp,
      value: volumes[index] ?? 0,
      color: `${isRisingBar(data.bars, index, isLineChart) ? riseColor : fallColor}70`
    })));

    const averageColors = ["#ff7d00", "#722ed1", "#0fc6c2"];
    this.movingAverageSeries = isLineChart
      ? []
      : [5, 10, 20].map((period, index) => this.addMovingAverage(
          data.bars,
          period,
          averageColors[index]!
        ));
    this.chart.timeScale().fitContent();
    this.chart.subscribeCrosshairMove((parameter) => this.handleCrosshair(parameter.time));
    this.visibleLogicalRange = this.chart.timeScale().getVisibleLogicalRange();
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.handleVisibleLogicalRangeChange);
  }

  /**
   * 实时推送只更新最后一个点或追加一个点，不重建图表，避免报价到达时图表闪烁、
   * 缩放位置复位。若历史结构真的发生变化，才回退到完整 render。
   */
  update(data: CandleData): void {
    const previous = this.data;
    if (!previous || !this.chart || !isIncrementalUpdate(previous, data)) {
      this.render(data);
      return;
    }
    const visibleRange = this.chart.timeScale().getVisibleLogicalRange();
    const wasFollowingRealtime = !visibleRange || visibleRange.to >= previous.bars.length - 2;
    const bar = data.bars.at(-1);
    if (!bar || !this.volumeSeries) return;
    const isLineChart = isLineKlineInterval(data.interval);
    if (isLineChart) {
      this.lineSeries?.update({ time: bar.time as UTCTimestamp, value: bar.close });
    } else {
      this.candleSeries?.update({
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close
      });
    }

    const barIndex = data.bars.length - 1;
    const volume = isLineChart ? incrementalVolumeAt(data.bars, barIndex) : bar.volume;
    this.volumeSeries.update({
      time: bar.time as UTCTimestamp,
      value: volume,
      color: `${isRisingBar(data.bars, barIndex, isLineChart)
        ? cssColor(getComputedStyle(this.container), "--market-rise", "#d92d20")
        : cssColor(getComputedStyle(this.container), "--market-fall", "#07883f")}70`
    });
    if (!isLineChart) {
      [5, 10, 20].forEach((period, index) => {
        const average = movingAverageAt(data.bars, period);
        if (average !== null) {
          this.movingAverageSeries[index]?.update({
            time: bar.time as UTCTimestamp,
            value: average
          });
        }
      });
    }
    this.data = data;
    if (data.bars.length > previous.bars.length && wasFollowingRealtime) {
      this.chart.timeScale().scrollToRealTime();
    }
  }

  /** 在现有图表前方补入历史数据，并保持用户当前查看区间不跳动。 */
  prependHistory(data: CandleData): void {
    const previous = this.data;
    if (!previous || !this.chart || previous.interval !== data.interval) {
      this.render(data);
      return;
    }
    const previousStart = previous.bars.at(0)?.time ?? Number.POSITIVE_INFINITY;
    const addedBefore = data.bars.filter((bar) => bar.time < previousStart).length;
    if (addedBefore === 0) {
      this.data = data;
      return;
    }

    const visibleRange = this.chart.timeScale().getVisibleLogicalRange();
    this.setSeriesData(data);
    this.data = data;
    if (visibleRange) {
      this.chart.timeScale().setVisibleLogicalRange({
        from: visibleRange.from + addedBefore,
        to: visibleRange.to + addedBefore
      });
    }
    this.visibleLogicalRange = this.chart.timeScale().getVisibleLogicalRange();
  }

  setMovingAveragesVisible(visible: boolean): void {
    this.movingAveragesVisible = visible;
    for (const series of this.movingAverageSeries) series.applyOptions({ visible });
  }

  resize(): void {
    this.chart?.applyOptions({
      width: Math.max(1, this.container.clientWidth),
      height: Math.max(1, this.container.clientHeight)
    });
  }

  destroy(): void {
    this.destroyChart();
    this.data = null;
  }

  private addMovingAverage(bars: CandleBar[], period: number, color: string): ISeriesApi<"Line"> {
    const series = this.chart!.addSeries(LineSeries, {
      color,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: this.movingAveragesVisible
    });
    series.setData(movingAverageValues(bars, period));
    return series;
  }

  private setSeriesData(data: CandleData): void {
    const isLineChart = isLineKlineInterval(data.interval);
    if (isLineChart) {
      this.lineSeries?.setData(data.bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        value: bar.close
      })));
    } else {
      this.candleSeries?.setData(data.bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close
      })));
    }
    const styles = getComputedStyle(this.container);
    const riseColor = cssColor(styles, "--market-rise", "#d92d20");
    const fallColor = cssColor(styles, "--market-fall", "#07883f");
    const volumes = isLineChart ? incrementalVolumes(data.bars) : data.bars.map((bar) => bar.volume);
    this.volumeSeries?.setData(data.bars.map((bar, index) => ({
      time: bar.time as UTCTimestamp,
      value: volumes[index] ?? 0,
      color: `${isRisingBar(data.bars, index, isLineChart) ? riseColor : fallColor}70`
    })));
    this.movingAverageSeries.forEach((series, index) => {
      series.setData(movingAverageValues(data.bars, [5, 10, 20][index]!));
    });
  }

  private readonly handleVisibleLogicalRangeChange = (range: LogicalRange | null): void => {
    const previous = this.visibleLogicalRange;
    this.visibleLogicalRange = range;
    if (!range || !previous || range.from >= previous.from - 0.5) return;
    const series = this.candleSeries ?? this.lineSeries;
    const bars = series?.barsInLogicalRange(range);
    if (bars && bars.barsBefore <= HISTORY_BOUNDARY_BARS) this.onHistoryBoundary();
  };

  private handleCrosshair(time: Time | undefined): void {
    if (typeof time !== "number" || !this.data) {
      this.onHover(null);
      return;
    }
    this.onHover(this.data.bars.find((bar) => bar.time === time) ?? null);
  }

  private destroyChart(): void {
    this.chart?.timeScale().unsubscribeVisibleLogicalRangeChange(this.handleVisibleLogicalRangeChange);
    this.chart?.remove();
    this.chart = null;
    this.candleSeries = null;
    this.lineSeries = null;
    this.volumeSeries = null;
    this.movingAverageSeries = [];
    this.visibleLogicalRange = null;
    this.onHover(null);
  }
}

function movingAverageValues(
  bars: CandleBar[],
  period: number
): Array<{ time: UTCTimestamp; value: number }> {
  const values: Array<{ time: UTCTimestamp; value: number }> = [];
  let sum = 0;
  for (let index = 0; index < bars.length; index += 1) {
    sum += bars[index]!.close;
    if (index >= period) sum -= bars[index - period]!.close;
    if (index >= period - 1) {
      values.push({ time: bars[index]!.time as UTCTimestamp, value: sum / period });
    }
  }
  return values;
}

function cssColor(styles: CSSStyleDeclaration, property: string, fallback: string): string {
  return styles.getPropertyValue(property).trim() || fallback;
}

function formatTickMark(time: Time, tickMarkType: TickMarkType): string {
  const date = chartDate(time);
  if (!date) return "";
  if (tickMarkType === TickMarkType.Time || tickMarkType === TickMarkType.TimeWithSeconds) {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric"
  }).format(date);
}

function formatChartTime(time: Time, withTime: boolean): string {
  const date = chartDate(time);
  if (!date) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {})
  }).format(date);
}

function chartDate(time: Time): Date | null {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") {
    const parsed = new Date(time);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return new Date(Date.UTC(time.year, time.month - 1, time.day));
}

function incrementalVolumes(bars: CandleBar[]): number[] {
  return bars.map((bar, index) => {
    const previous = index > 0 ? bars[index - 1]!.volume : 0;
    const difference = bar.volume - previous;
    return difference >= 0 ? difference : bar.volume;
  });
}

function incrementalVolumeAt(bars: CandleBar[], index: number): number {
  const previous = index > 0 ? bars[index - 1]!.volume : 0;
  const difference = bars[index]!.volume - previous;
  return difference >= 0 ? difference : bars[index]!.volume;
}

function movingAverageAt(bars: CandleBar[], period: number): number | null {
  if (bars.length < period) return null;
  return bars.slice(-period).reduce((sum, bar) => sum + bar.close, 0) / period;
}

function isIncrementalUpdate(previous: CandleData, next: CandleData): boolean {
  if (previous.interval !== next.interval || next.bars.length < previous.bars.length) return false;
  if (next.bars.length - previous.bars.length > 1 || next.bars.length === 0) return false;
  const stableLength = next.bars.length > previous.bars.length
    ? previous.bars.length
    : Math.max(0, previous.bars.length - 1);
  for (let index = 0; index < stableLength; index += 1) {
    if (previous.bars[index]?.time !== next.bars[index]?.time) return false;
  }
  return next.bars.at(-1)!.time >= previous.bars.at(-1)!.time;
}

function isRisingBar(bars: CandleBar[], index: number, isIntraday: boolean): boolean {
  const bar = bars[index]!;
  if (!isIntraday || index === 0) return bar.close >= bar.open;
  return bar.close >= bars[index - 1]!.close;
}
