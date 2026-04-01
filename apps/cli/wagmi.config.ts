import { defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";

export default defineConfig({
  out: "src/contracts/generated.ts",
  plugins: [
    foundry({
      project: "../contracts",
      include: [
        "AgentRegistry.sol/AgentRegistry.json",
        "VideoRegistry.sol/VideoRegistry.json",
        "PredictionMarket.sol/PredictionMarket.json",
        "PointsRegistry.sol/PointsRegistry.json",
      ],
    }),
  ],
});
