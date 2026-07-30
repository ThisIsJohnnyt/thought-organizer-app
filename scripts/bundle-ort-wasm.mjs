#!/usr/bin/env node
/**
 * Copies ONNX Runtime's .wasm binaries out of node_modules and into
 * public/ort-wasm/, so both the organizer (FLAN-T5) and speech-to-text
 * (Whisper) pipelines can point env.backends.onnx.wasm.wasmPaths at a
 * local path instead of @xenova/transformers' default jsDelivr CDN
 * fallback -- which would otherwise fetch these binaries over the network
 * on every first run, quietly contradicting "no data is sent to servers".
 *
 * Copied straight from node_modules (not downloaded/checksummed like the
 * model scripts) so the binaries always exactly match whatever
 * onnxruntime-web version npm actually resolved for this install --
 * npm's own lockfile integrity check already covers that content.
 *
 * Usage:
 *   node scripts/bundle-ort-wasm.mjs   (run once after `npm install`)
 *   npm run bundle-ort-wasm
 */
import { readdir, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SOURCE_DIR = path.resolve("node_modules", "onnxruntime-web", "dist");
const DEST_DIR = path.resolve("public", "ort-wasm");

async function main() {
  let entries;
  try {
    entries = await readdir(SOURCE_DIR);
  } catch (err) {
    throw new Error(
      `Couldn't read ${SOURCE_DIR} (${err.message}). Run "npm install" first.`,
    );
  }

  const wasmFiles = entries.filter((name) => name.endsWith(".wasm"));
  if (wasmFiles.length === 0) {
    throw new Error(`No .wasm files found in ${SOURCE_DIR}.`);
  }

  await mkdir(DEST_DIR, { recursive: true });
  for (const file of wasmFiles) {
    await copyFile(path.join(SOURCE_DIR, file), path.join(DEST_DIR, file));
    console.log(`Copied ${file} -> public/ort-wasm/`);
  }

  console.log(`Installed ${wasmFiles.length} ONNX Runtime WASM binaries to ${DEST_DIR}`);
}

main().catch((err) => {
  console.error(`bundle-ort-wasm failed: ${err.message}`);
  process.exit(1);
});
