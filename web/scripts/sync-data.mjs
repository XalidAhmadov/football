// Copies the model's JSON outputs from the project root into web/data/ so the
// UI always reflects the latest `python tournament.py` / `python model.py` run.
// Runs automatically via the predev/prebuild npm hooks.
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const projectRoot = join(webRoot, "..");
const destDir = join(webRoot, "data");

const FILES = ["predictions.json", "ratings.json", "goals_model.json"];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

await mkdir(destDir, { recursive: true });

let copied = 0;
let missing = 0;
for (const f of FILES) {
  const src = join(projectRoot, f);
  const dest = join(destDir, f);
  if (!(await exists(src))) {
    // Keep the existing copy in web/data/ rather than failing the build.
    console.warn(`[sync-data] skip ${f} — not found in ${projectRoot}`);
    missing++;
    continue;
  }
  await copyFile(src, dest);
  copied++;
}

console.log(
  `[sync-data] ${copied} file(s) synced from project root` +
    (missing ? `, ${missing} missing (kept existing copy)` : ""),
);
