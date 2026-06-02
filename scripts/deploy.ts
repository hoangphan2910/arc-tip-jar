import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config();

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

const abi = JSON.parse(readFileSync("artifacts/contracts/TipJar.sol/TipJar.json", "utf8")).abi;
const bytecode = JSON.parse(readFileSync("artifacts/contracts/TipJar.sol/TipJar.json", "utf8")).bytecode;

const USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  console.log("Deploying from:", account.address);
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [USDC],
  });
  console.log("Tx hash:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Contract deployed at:", receipt.contractAddress);
}

main().catch(console.error); 
