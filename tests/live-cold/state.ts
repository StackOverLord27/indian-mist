import fs from "node:fs";
import path from "node:path";

export const TEST_FOLDER = "indian-mist-test/prompt5";
const FILE = path.join(process.cwd(), "node_modules/.cache/cloudinary-cold-state.json");

export const saveState = (state: { publicId: string; url: string }) => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
};
export const loadState = (): { publicId: string; url: string } => JSON.parse(fs.readFileSync(FILE, "utf8"));
export const clearState = () => fs.rmSync(FILE, { force: true });
