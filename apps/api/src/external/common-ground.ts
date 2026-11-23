// Common Ground through the shared outbound client (001/FR-012). Only the sample read of
// specs/001-observability-baseline exists so far; in development and CI it reaches the mock
// (contracts/mocks.md). Nothing here writes to Common Ground.

import type { Admin } from "@riviera/common-ground";
import { z } from "zod";
import type { ApiKey, ExternalClient } from "./client.ts";

/**
 * The document of `packages/common-ground/operations/admin/SampleShopConfig.graphql`, which
 * codegen validates against the Admin schema; a test keeps the two identical.
 */
export const SAMPLE_SHOP_CONFIG_DOCUMENT = `query SampleShopConfig {
  config {
    shopName
  }
}`;

const sampleShopConfigResponse: z.ZodType<{ data: Admin.SampleShopConfigQuery }> = z.object({
  data: z.object({ config: z.object({ shopName: z.string() }).nullable() }),
});

export interface CommonGround {
  readonly sampleShopConfig: () => Promise<Admin.SampleShopConfigQuery>;
}

export interface CommonGroundOptions {
  readonly client: ExternalClient;
  /** `COMMON_GROUND_URL`: the GraphQL endpoint is `/graphql` on it. */
  readonly url: URL;
  /** `COMMON_GROUND_DEV_API_KEY`; without one the request carries no Authorization header. */
  readonly apiKey: ApiKey | undefined;
}

export function createCommonGround(options: CommonGroundOptions): CommonGround {
  const endpoint = new URL("/graphql", options.url);
  return {
    async sampleShopConfig() {
      // The key is revealed only here, into the request; the client never records headers.
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "application/json",
      };
      if (options.apiKey !== undefined) {
        headers["authorization"] = `Bearer ${options.apiKey.reveal()}`;
      }
      const response = await options.client.call({
        service: "common_ground",
        operation: "SampleShopConfig",
        method: "POST",
        url: endpoint,
        headers,
        body: JSON.stringify({
          operationName: "SampleShopConfig",
          query: SAMPLE_SHOP_CONFIG_DOCUMENT,
        }),
        parse: (body) => sampleShopConfigResponse.parse(body),
      });
      return response.data;
    },
  };
}
