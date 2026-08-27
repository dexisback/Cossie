//NOT shared types, these are the reigstry implementation details
import type {
  DiscoveredTool,
  MCPServerConfig,
} from "@cossie/shared-types";

export interface RegistryEntry {
  server: MCPServerConfig;

  tools: DiscoveredTool[];

  connected: boolean;

  lastSyncedAt: Date;
}

export interface RegistryState {
  servers: Map<
    string,
    RegistryEntry
  >;
}