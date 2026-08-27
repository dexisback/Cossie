import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DiscoveredTool, MCPServerConfig } from "@cossie/shared-types";

const { discoverToolsMock, executeToolMock } = vi.hoisted(() => ({
  discoverToolsMock: vi.fn(),
  executeToolMock: vi.fn(),
}));

vi.mock("./discovery.js", () => ({
  discoverTools: discoverToolsMock,
}));

vi.mock("./tool-executor.js", () => ({
  executeTool: executeToolMock,
}));

import { MCPRegistry } from "./registry.js";

const fakeServer: MCPServerConfig = {
  id: "infra-mcp",
  name: "Infrastructure",
  transport: "stdio",
  command: "node",
  args: ["fake.js"],
};

const fakeTools: DiscoveredTool[] = [
  {
    name: "list_servers",
    description: "List servers",
    serverId: "infra-mcp",
    inputSchema: {},
    riskLevel: "LOW",
  },
  {
    name: "restart_server",
    description: "Restart a server",
    serverId: "infra-mcp",
    inputSchema: {},
    riskLevel: "HIGH",
  },
];

beforeEach(() => {
  discoverToolsMock.mockReset();
  executeToolMock.mockReset();
});

describe("MCPRegistry", () => {
  it("registers a server and lists its tools", async () => {
    discoverToolsMock.mockResolvedValue(fakeTools);

    const reg = new MCPRegistry();
    await reg.registerServer(fakeServer);

    expect(reg.getServers()).toHaveLength(1);
    expect(reg.getServers()[0].connected).toBe(true);
    expect(reg.getTools()).toHaveLength(2);
  });

  it("finds a tool by name", async () => {
    discoverToolsMock.mockResolvedValue(fakeTools);
    const reg = new MCPRegistry();
    await reg.registerServer(fakeServer);

    const tool = reg.getTool("restart_server");
    expect(tool).toBeDefined();
    expect(tool!.serverId).toBe("infra-mcp");
    expect(tool!.riskLevel).toBe("HIGH");
  });

  it("returns undefined for an unknown tool", async () => {
    discoverToolsMock.mockResolvedValue(fakeTools);
    const reg = new MCPRegistry();
    await reg.registerServer(fakeServer);

    expect(reg.getTool("does_not_exist")).toBeUndefined();
  });

  it("throws when executing an unknown tool", async () => {
    discoverToolsMock.mockResolvedValue(fakeTools);
    const reg = new MCPRegistry();
    await reg.registerServer(fakeServer);

    await expect(reg.executeTool("missing_tool", {})).rejects.toThrow(
      /Tool missing_tool not found/
    );
  });

  it("delegates execution to the tool-executor for a known tool", async () => {
    discoverToolsMock.mockResolvedValue(fakeTools);
    executeToolMock.mockResolvedValue({
      success: true,
      content: [{ type: "text", text: "ok" }],
    });

    const reg = new MCPRegistry();
    await reg.registerServer(fakeServer);

    const result = await reg.executeTool("list_servers", { id: "srv-1" });
    expect(executeToolMock).toHaveBeenCalledWith(fakeServer, {
      toolName: "list_servers",
      args: { id: "srv-1" },
    });
    expect(result.success).toBe(true);
  });

  it("aggregates tools across multiple servers", async () => {
    discoverToolsMock
      .mockResolvedValueOnce([fakeTools[0]])
      .mockResolvedValueOnce([fakeTools[1]]);

    const reg = new MCPRegistry();
    await reg.registerServer(fakeServer);
    await reg.registerServer({
      id: "context7",
      name: "Context7",
      transport: "stdio",
      command: "node",
      args: ["ctx7.js"],
    });

    expect(reg.getServers()).toHaveLength(2);
    expect(reg.getTools()).toHaveLength(2);
    expect(reg.getTools().map((t) => t.name).sort()).toEqual([
      "list_servers",
      "restart_server",
    ]);
  });
});
