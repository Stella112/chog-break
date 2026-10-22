// Reads the real first Recorded Splice receipt from Monad and writes the numbers the video's receipt card shows.
//   node video/receipt.mjs  → video/footage/receipt.json
import { createPublicClient, http, formatUnits } from 'viem';
import { writeFileSync } from 'node:fs';

const TX = '0xfa06348c2cc0b589c68dd7c1e9d7e21aa34b562cfc3a852b53abb7be0b9ac874';
const client = createPublicClient({ transport: http('https://rpc.monad.xyz') });
const r = await client.getTransactionReceipt({ hash: TX });
const block = await client.getBlock({ blockNumber: r.blockNumber });
const transfers = [];
for (const l of r.logs) {
  if (l.topics[0] !== '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' || l.topics.length !== 3) continue;
  const from = '0x' + l.topics[1].slice(26), to = '0x' + l.topics[2].slice(26);
  transfers.push({ token: l.address, from, to, value: formatUnits(BigInt(l.data), 18) });
}
// SpliceRecorded(splicer indexed, payer indexed, ...): the registry log whose first indexed topic is an address
const rec = r.logs.find((l) => l.address.toLowerCase() === r.to.toLowerCase() && l.topics[1]?.startsWith('0x' + '0'.repeat(24)));
const splicer = rec ? '0x' + rec.topics[1].slice(26) : null;
const out = { tx: TX, splicer, status: r.status, block: Number(r.blockNumber), timestamp: Number(block.timestamp), to: r.to, transfers };
writeFileSync('video/footage/receipt.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
