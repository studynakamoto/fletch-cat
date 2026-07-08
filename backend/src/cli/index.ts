import { getLastIndexedBlock } from "../db.js";
import { runIndexer } from "../indexer.js";

const watch = process.argv.includes("--watch");

getLastIndexedBlock(); // ensure db init

runIndexer({ watch })
  .then(() => {
    console.log("Indexer finished.");
  })
  .catch((err) => {
    console.error("Indexer failed:", err);
    process.exit(1);
  });
