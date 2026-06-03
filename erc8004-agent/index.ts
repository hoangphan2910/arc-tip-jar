import {
  createPublicClient, createWalletClient, getContract,
  http, keccak256, parseAbiItem, toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const VALIDATION_REGISTRY = "0x8004Cb1BF31DAf7788923b405b754f57acEB4272";
const METADATA_URI = process.env.METADATA_URI || "ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei";

const ownerAccount = privateKeyToAccount(process.env.OWNER_PRIVATE_KEY as `0x${string}`);
const validatorAccount = privateKeyToAccount(process.env.VALIDATOR_PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const ownerWalletClient = createWalletClient({ account: ownerAccount, chain: arcTestnet, transport: http() });
const validatorWalletClient = createWalletClient({ account: validatorAccount, chain: arcTestnet, transport: http() });

const identityAbi = [
  { name: "register", type: "function", stateMutability: "nonpayable", inputs: [{ name: "metadataURI", type: "string" }], outputs: [] },
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { name: "tokenURI", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
] as const;

const reputationAbi = [
  { name: "giveFeedback", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }, { name: "score", type: "int128" }, { name: "feedbackType", type: "uint8" }, { name: "tag", type: "string" }, { name: "metadataURI", type: "string" }, { name: "evidenceURI", type: "string" }, { name: "comment", type: "string" }, { name: "feedbackHash", type: "bytes32" }], outputs: [] },
] as const;

const validationAbi = [
  { name: "validationRequest", type: "function", stateMutability: "nonpayable", inputs: [{ name: "validator", type: "address" }, { name: "agentId", type: "uint256" }, { name: "requestURI", type: "string" }, { name: "requestHash", type: "bytes32" }], outputs: [] },
  { name: "validationResponse", type: "function", stateMutability: "nonpayable", inputs: [{ name: "requestHash", type: "bytes32" }, { name: "response", type: "uint8" }, { name: "responseURI", type: "string" }, { name: "responseHash", type: "bytes32" }, { name: "tag", type: "string" }], outputs: [] },
  { name: "getValidationStatus", type: "function", stateMutability: "view", inputs: [{ name: "requestHash", type: "bytes32" }], outputs: [{ name: "validatorAddress", type: "address" }, { name: "agentId", type: "uint256" }, { name: "response", type: "uint8" }, { name: "responseHash", type: "bytes32" }, { name: "tag", type: "string" }, { name: "lastUpdate", type: "uint256" }] },
] as const;

type ValidationStatus = readonly [`0x${string}`, bigint, number, `0x${string}`, string, bigint];

async function waitForReceipt(hash: `0x${string}`, label: string) {
  console.log(`  Waiting for ${label}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✓ ${label} — https://testnet.arcscan.app/tx/${hash}`);
  return receipt;
}

async function main() {
  console.log("\n── Step 1: Wallets ──");
  console.log(`  Owner:     ${ownerAccount.address}`);
  console.log(`  Validator: ${validatorAccount.address}`);

  console.log("\n── Step 2: Register agent identity ──");
  const registerTx = await ownerWalletClient.writeContract({
    address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "register",
    args: [METADATA_URI], account: ownerAccount,
  });
  const receipt = await waitForReceipt(registerTx, "Registration");

  console.log("\n── Step 3: Get agent ID ──");
  const transferLogs = await publicClient.getLogs({
    address: IDENTITY_REGISTRY,
    event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
    args: { to: ownerAccount.address },
    fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber,
  });
  if (transferLogs.length === 0) throw new Error("No Transfer event found");
  const agentId = transferLogs[transferLogs.length - 1].args.tokenId!;
  const identityContract = getContract({ address: IDENTITY_REGISTRY, abi: identityAbi, client: publicClient });
  const tokenURI = await identityContract.read.tokenURI([agentId]);
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  Metadata: ${tokenURI}`);

  console.log("\n── Step 4: Record reputation ──");
  const tag = "successful_trade";
  const feedbackHash = keccak256(toHex(tag));
  const reputationContract = getContract({ address: REPUTATION_REGISTRY, abi: reputationAbi, client: { public: publicClient, wallet: validatorWalletClient } });
  const reputationTx = await reputationContract.write.giveFeedback(
    [agentId, 95n, 0, tag, "", "", "", feedbackHash], { account: validatorAccount }
  );
  await waitForReceipt(reputationTx, "Reputation");

  console.log("\n── Step 5: Request validation ──");
  const requestURI = "ipfs://bafkreiexamplevalidationrequest";
  const requestHash = keccak256(toHex(`kyc_verification_request_agent_${agentId}`));
  const validationRequestContract = getContract({ address: VALIDATION_REGISTRY, abi: validationAbi, client: { public: publicClient, wallet: ownerWalletClient } });
  const validationRequestTx = await validationRequestContract.write.validationRequest(
    [validatorAccount.address, agentId, requestURI, requestHash], { account: ownerAccount }
  );
  await waitForReceipt(validationRequestTx, "Validation request");

  console.log("\n── Step 6: Validation response ──");
  const validationResponseContract = getContract({ address: VALIDATION_REGISTRY, abi: validationAbi, client: { public: publicClient, wallet: validatorWalletClient } });
  const validationResponseTx = await validationResponseContract.write.validationResponse(
    [requestHash, 100, "", `0x${"0".repeat(64)}` as `0x${string}`, "kyc_verified"], { account: validatorAccount }
  );
  await waitForReceipt(validationResponseTx, "Validation response");

  console.log("\n── Step 7: Verify ──");
  const validationReadContract = getContract({ address: VALIDATION_REGISTRY, abi: validationAbi, client: publicClient });
  const [valAddr, , response, , validationTag] = (await validationReadContract.read.getValidationStatus([requestHash])) as ValidationStatus;
  console.log(`  Validator: ${valAddr}`);
  console.log(`  Response:  ${response} (100 = passed)`);
  console.log(`  Tag:       ${validationTag}`);

  console.log("\n── ✓ DONE ──");
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  Explorer: https://testnet.arcscan.app/address/${ownerAccount.address}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
