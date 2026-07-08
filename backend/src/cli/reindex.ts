import { resetDb } from "../db.js";
import { findFactoryDeployBlock, runIndexer } from "../indexer.js";

async function main() {
  console.log("Reindexing: wiping database...");
  resetDb();

  let fromBlock: bigint | undefined;
  try {
    fromBlock = await findFactoryDeployBlock();
    console.log(`Factory deploy block: ${fromBlock}`);
  } catch (err) {
    console.warn("Could not detect factory deploy block:", err);
  }

  await runIndexer({ watch: false, fromBlock });
  console.log("Reindex complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
