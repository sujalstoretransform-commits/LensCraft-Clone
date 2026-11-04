import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const seeders = [
    "lens-types.seed.ts",
    "lens-indices.seed.ts",
    "lens-technologies.seed.ts",
    "lens-options.seed.ts",
    "lens-index-compatibility.seed.ts",
    "lens-price.seed.ts",
    "lens-technology-options.seed.ts",
    "lens-prescription-method.seed.ts"
];

for (const file of seeders) {
    const fullPath = path.join(here, file);
    console.log(`\n> Seeding: ${file}`);
    execFileSync("npx", ["tsx", `"${fullPath}"`], { stdio: "inherit", shell: true });
}

console.log("\nAll seeders finished.");