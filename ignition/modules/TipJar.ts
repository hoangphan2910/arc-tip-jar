import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const USDC_ARC_TESTNET = "0x3600000000000000000000000000000000000000";

const TipJarModule = buildModule("TipJarModule", (m) => {
  const tipJar = m.contract("TipJar", [USDC_ARC_TESTNET]);
  return { tipJar };
});

export default TipJarModule; 
