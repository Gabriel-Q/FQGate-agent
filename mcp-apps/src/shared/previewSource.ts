import type { JsonObject } from "@/adapters/mcp-app";

export type PreviewSourceDepthMode = "basic" | "level2" | "auto";

export interface PreviewSourceOption {
  id: string;
  label: string;
  depthMode: PreviewSourceDepthMode;
}

export interface PreviewSourceContext {
  selectedInstanceId: string;
  sources: PreviewSourceOption[];
}

const MAX_HOST_ACTION_INSET = 160;

/** FQGate Desktop 通过入口参数提供账号目录；其他 MCP 客户端不受该扩展影响。 */
export function readPreviewSourceContext(
  argumentsValue: JsonObject | undefined,
): PreviewSourceContext | undefined {
  const value = argumentsValue?._fqgatePreview;
  if (!isRecord(value) || !Array.isArray(value.sources)) return undefined;
  const sources = value.sources.flatMap((source) => {
    if (!isRecord(source)) return [];
    const id = stringValue(source.id);
    const label = stringValue(source.label);
    if (!id || !label) return [];
    return [{ id, label, depthMode: depthMode(source.depthMode) }];
  });
  const selectedInstanceId = stringValue(value.selectedInstanceId) ?? "";
  if (sources.length === 0 || !sources.some(({ id }) => id === selectedInstanceId)) {
    return undefined;
  }
  return { selectedInstanceId, sources };
}

/** 沙箱只发出选择意图；MCP Apps 客户端会校验实例并用新的入口上下文重新渲染。 */
export function requestPreviewSourceSelection(instanceId: string): void {
  window.parent.postMessage(
    { type: "fqgate.preview.select-source", instanceId },
    "*",
  );
}

/** FQGate Desktop 可在 App 工具栏内叠放窗口级动作；其他 MCP 客户端保持零占位。 */
export function applyPreviewHostActionInset(
  argumentsValue: JsonObject | undefined,
): void {
  const value = argumentsValue?._fqgatePreview;
  const inset = isRecord(value) ? Number(value.hostActionInset) : 0;
  if (!Number.isFinite(inset) || inset <= 0) return;
  document.documentElement.style.setProperty(
    "--fqgate-host-action-inset",
    `${Math.min(Math.round(inset), MAX_HOST_ACTION_INSET)}px`,
  );
}

function depthMode(value: unknown): PreviewSourceDepthMode {
  return value === "basic" || value === "level2" ? value : "auto";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
