const fs = require('fs');
const code = `
import {createPublicClient,createWalletClient,decodeEventLog,formatUnits,http,keccak256,toHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {arcTestnet} from "viem/chains";

const AGENTIC_COMMERCE_CONTRACT = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const JOB_BUDGET = 1_000_000n;

const clientAccount = privateKeyToAccount(process.env.CLIENT_PRIVATE_KEY);
const providerAccount = privateKeyToAccount(process.env.PROVIDER_PRIVATE_KEY);

const publicClient = createPublicClient({chain:arcTestnet,transport:http()});
const clientWalletClient = createWalletClient({account:clientAccount,chain:arcTestnet,transport:http()});
const providerWalletClient = createWalletClient({account:providerAccount,chain:arcTestnet,transport:http()});

const agenticCommerceAbi = [
  {name:"createJob",type:"function",stateMutability:"nonpayable",inputs:[{name:"provider",type:"address"},{name:"evaluator",type:"address"},{name:"expiredAt",type:"uint256"},{name:"description",type:"string"},{name:"hook",type:"address"}],outputs:[{name:"jobId",type:"uint256"}]},
  {name:"setBudget",type:"function",stateMutability:"nonpayable",inputs:[{name:"jobId",type:"uint256"},{name:"amount",type:"uint256"},{name:"optParams",type:"bytes"}],outputs:[]},
  {name:"fund",type:"function",stateMutability:"nonpayable",inputs:[{name:"jobId",type:"uint256"},{name:"optParams",type:"bytes"}],outputs:[]},
  {name:"submit",type:"function",stateMutability:"nonpayable",inputs:[{name:"jobId",type:"uint256"},{name:"deliverable",type:"bytes32"},{name:"optParams",type:"bytes"}],outputs:[]},
  {name:"complete",type:"function",stateMutability:"nonpayable",inputs:[{name:"jobId",type:"uint256"},{name:"reason",type:"bytes32"},{name:"optParams",type:"bytes"}],outputs:[]},
  {name:"getJob",type:"function",stateMutability:"view",inputs:[{name:"jobId",type:"uint256"}],outputs:[{type:"tuple",components:[{name:"id",type:"uint256"},{name:"client",type:"address"},{name:"provider",type:"address"},{name:"evaluator",type:"address"},{name:"description",type:"string"},{name:"budget",type:"uint256"},{name:"expiredAt",type:"uint256"},{name:"status",type:"uint8"},{name:"hook",type:"address"}]}]},
  {name:"JobCreated",type:"event",anonymous:false,inputs:[{indexed:true,name:"jobId",type:"uint256"},{indexed:true,name:"client",type:"address"},{indexed:true,name:"provider",type:"address"},{indexed:false,name:"evaluator",type:"address"},{indexed:false,name:"expiredAt",type:"uint256"},{indexed:false,name:"hook",type:"address"}]},
];

const erc20Abi = [
  {name:"approve",type:"function",stateMutability:"nonpayable",inputs:[{name:"spender",type:"address"},{name:"amount",type:"uint256"}],outputs:[{name:"",type:"bool"}]},
  {name:"balanceOf",type:"function",stateMutability:"view",inputs:[{name:"account",type:"address"}],outputs:[{name:"",type:"uint256"}]},
];

const STATUS_NAMES = ["Open","Funded","Submitted","Completed","Rejected","Expired"];

async function waitForReceipt(hash, label) {
  process.stdout.write("  Waiting for " + label);
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  console.log(" OK\\n  Tx: https://testnet.arcscan.app/tx/" + hash);
  return receipt;
}

async function printBalances(title) {
  const cb = await publicClient.readContract({address:USDC_CONTRACT,abi:erc20Abi,functionName:"balanceOf",args:[clientAccount.address]});
  const pb = await publicClient.readContract({address:USDC_CONTRACT,abi:erc20Abi,functionName:"balanceOf",args:[providerAccount.address]});
  console.log(title + ":");
  console.log("  Client:   " + formatUnits(cb,6) + " USDC");
  console.log("  Provider: " + formatUnits(pb,6) + " USDC");
}

async function main() {
  console.log("Step 1: Client=" + clientAccount.address);
  console.log("        Provider=" + providerAccount.address);
  await printBalances("Step 2: Balances");

  const block = await publicClient.getBlock();
  const expiredAt = block.timestamp + 3600n;

  console.log("Step 3: Create job");
  const createJobHash = await clientWalletClient.writeContract({
    address:AGENTIC_COMMERCE_CONTRACT, abi:agenticCommerceAbi, functionName:"createJob",
    args:[providerAccount.address, clientAccount.address, expiredAt, "ERC-8183 demo job on Arc Testnet", "0x0000000000000000000000000000000000000000"],
  });
  const createReceipt = await waitForReceipt(createJobHash, "create job");

  let jobId;
  for (const log of createReceipt.logs) {
    try {
      const decoded = decodeEventLog({abi:agenticCommerceAbi, data:log.data, topics:log.topics});
      if (decoded.eventName === "JobCreated") { jobId = decoded.args.jobId; break; }
    } catch { continue; }
  }
  if (jobId == null) throw new Error("Could not parse JobCreated event");
  console.log("  Job ID: " + jobId);

  console.log("Step 4: Set budget");
  const setBudgetHash = await providerWalletClient.writeContract({
    address:AGENTIC_COMMERCE_CONTRACT, abi:agenticCommerceAbi, functionName:"setBudget",
    args:[jobId, JOB_BUDGET, "0x"],
  });
  await waitForReceipt(setBudgetHash, "set budget");

  console.log("Step 5: Approve USDC");
  const approveHash = await clientWalletClient.writeContract({
    address:USDC_CONTRACT, abi:erc20Abi, functionName:"approve",
    args:[AGENTIC_COMMERCE_CONTRACT, JOB_BUDGET],
  });
  await waitForReceipt(approveHash, "approve USDC");

  console.log("Step 6: Fund escrow");
  const fundHash = await clientWalletClient.writeContract({
    address:AGENTIC_COMMERCE_CONTRACT, abi:agenticCommerceAbi, functionName:"fund",
    args:[jobId, "0x"],
  });
  await waitForReceipt(fundHash, "fund escrow");

  console.log("Step 7: Submit deliverable");
  const deliverableHash = keccak256(toHex("arc-erc8183-demo-deliverable"));
  const submitHash = await providerWalletClient.writeContract({
    address:AGENTIC_COMMERCE_CONTRACT, abi:agenticCommerceAbi, functionName:"submit",
    args:[jobId, deliverableHash, "0x"],
  });
  await waitForReceipt(submitHash, "submit deliverable");

  console.log("Step 8: Complete job");
  const reasonHash = keccak256(toHex("work-delivered-and-approved"));
  const completeHash = await clientWalletClient.writeContract({
    address:AGENTIC_COMMERCE_CONTRACT, abi:agenticCommerceAbi, functionName:"complete",
    args:[jobId, reasonHash, "0x"],
  });
  await waitForReceipt(completeHash, "complete job");

  console.log("Step 9: Final state");
  const job = await publicClient.readContract({
    address:AGENTIC_COMMERCE_CONTRACT, abi:agenticCommerceAbi, functionName:"getJob", args:[jobId],
  });
  console.log("  Status: " + STATUS_NAMES[Number(job.status)] + "  Budget: " + formatUnits(job.budget,6) + " USDC");
  await printBalances("Step 10: Final balances");
  console.log("DONE");
}

main().catch(e => { console.error(e.message); process.exit(1); });
`;
fs.writeFileSync('index.mjs', code);
console.log('written');
