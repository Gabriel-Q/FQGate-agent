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

/** FQGate Desktop 通过入口参数提供账号目录；其他 MCP 宿主不受该扩展影响。 */
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

/** 沙箱只发出选择意图；宿主会校验实例并用新的入口上下文重新渲染。 */
export function requestPreviewSourceSelection(instanceId: string): void {
  window.parent.postMessage(
    { type: "fqgate.preview.select-source", instanceId },
    "*",
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
