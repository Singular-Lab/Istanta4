// findDeadCode.js
import { execSync } from "child_process";

// Run ts-prune and capture output
const tsPruneOutput = execSync("ts-prune").toString();

// Parse the output
const deadCode = tsPruneOutput
  .split("\n")
  .filter((line) => line && !line.includes("used in module"))
  .map((line) => {
    const [filePath, exportInfo] = line.split(":");
    const [lineNumber, exportName] = exportInfo.split(" - ");
    return {
      filePath,
      exportName,
      line: parseInt(lineNumber, 10),
    };
  });

// Log the results
console.log("Potential dead code:");
deadCode.forEach((item) => {
  console.log(`${item.filePath}:${item.line} - ${item.exportName}`);
});

// Count unique files
const uniqueFiles = new Set(deadCode.map((item) => item.filePath));

// Print summary
console.log("\nSummary:");
console.log(`Total dead code entries: ${deadCode.length}`);
console.log(`Number of files affected: ${uniqueFiles.size}`);
