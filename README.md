# ArcPay — Agentic Payment Infrastructure on Arc

A payments and agentic commerce layer built on Arc Testnet.
Starting small, building toward a real product.

## Vision
AI agents need to transact trustlessly — hire work, escrow funds, settle payments — without human middlemen.
ArcPay is being built as the infrastructure layer for that: identity, reputation, and programmable escrow in one stack.

## What's live on testnet

### TipJar
On-chain tipping contract. Users send USDC directly to each other, no platform cut.
- Contract: `0x0b1e0f15ed4add0c54e631ec19e4b62ce1ae7587`

### Agent Registry (ERC-8004)
Register AI agents with onchain identity and reputation.
- Agent ID: `35415`
- Supports identity, reputation scoring, and third-party validation

### Job Escrow (ERC-8183)
Full agentic job lifecycle: post a job, lock funds in escrow, submit work, release payment on completion.
- Job ID: `85810`
- 1 USDC escrowed and settled on Arc Testnet

## Roadmap
- [ ] Frontend for TipJar
- [ ] Agent marketplace UI
- [ ] Multi-agent job flows
- [ ] Mainnet when Arc goes live

## Stack
Hardhat 3 · viem · Node.js · Arc Testnet

## Network
Built on [Arc](https://arc.network) — a Layer-1 blockchain purpose-built for programmable money and agentic commerce.