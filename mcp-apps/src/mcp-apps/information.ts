import { McpFqgateFetch } from "@/adapters/mcp-app";
import { FqgateInformationService } from "@/adapters/local-api";
import { InformationApp } from "@/apps/InformationApp";
import { requiredRoot } from "@/ui/dom";
import {
  FQGATE_LOOPBACK_URL,
  connectMcpApp,
  mountNativeApp,
  readSecurity,
  showEntryError
} from "./bootstrap";

async function main(): Promise<void> {
  const runtime = await connectMcpApp("fqgate-information", "fqgate_information_articles");
  const security = readSecurity(await runtime.waitForToolInput());
  if (!security) throw new Error("没有收到资讯查询所需的证券代码。");

  const bridge = new McpFqgateFetch(runtime);
  const service = new FqgateInformationService({
    baseUrl: FQGATE_LOOPBACK_URL,
    fetch: bridge.fetch
  });
  mountNativeApp(new InformationApp(
    requiredRoot(),
    service,
    security,
    (url) => runtime.openExternalUrl(url)
  ));
}

void main().catch(showEntryError);
