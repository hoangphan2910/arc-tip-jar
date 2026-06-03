import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { readFileSync } from "fs";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

const abi = JSON.parse(readFileSync("artifacts/contracts/TipJarV2.sol/TipJarV2.json", "utf8")).abi;
const bytecode = JSON.parse(readFileSync("artifacts/contracts/TipJarV2.sol/TipJarV2.json", "utf8")).bytecode;

const USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  console.log("Deploying from:", account.address);
  const hash = await walletClient.deployContract({ abi, bytecode, args: [USDC] });
  console.log("Tx hash:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Contract deployed at:", receipt.contractAddress);
}

main().catch(console.error);