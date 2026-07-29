#!/usr/bin/env node
/**
 * Downloads, checksum-verifies, and installs a tagged intent-recovery-model
 * release into public/models/, per docs/inference-contract.md and
 * https://github.com/ThisIsJohnnyt/thought-organizer-app's model-integration
 * approach (PDR-003 in the model repo).
 *
 * Usage:
 *   node scripts/fetch-model.mjs [release-tag]
 *   npm run fetch-model
 *
 * Defaults to MODEL_RELEASE below if no tag is given on the command line.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const MODEL_OWNER = "ThisIsJohnnyt";
const MODEL_REPO = "intent-recovery-model";
const MODEL_RELEASE = process.argv[2] ?? "intent-recovery-model-v0.1.0";
const MODEL_DIR = "thoughtorganizer-flan-t5"; // matches training/export_onnx.py's output_name
const INSTALL_DIR = path.resolve("public", "models", MODEL_DIR);
const VERSION_FILE = path.resolve("public", "models", ".installed-version");

const releaseUrl = (tag, asset) =>
  `https://github.com/${MODEL_OWNER}/${MODEL_REPO}/releases/download/${tag}/${asset}`;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  console.log(`Fetching manifest for ${MODEL_RELEASE}...`);
  // Release assets can't have a fixed "manifest.json" name enforced across
  // releases (upload keeps whatever filename it was given) -- this repo's
  // convention is "<release-tag>.manifest.json".
  const manifest = await fetchJson(releaseUrl(MODEL_RELEASE, `${MODEL_RELEASE}.manifest.json`));

  if (manifest.contract_version && !manifest.contract_version.startsWith("1")) {
    throw new Error(
      `Release declares inference contract version ${manifest.contract_version}, ` +
        `but this application only supports major version 1. See docs/inference-contract.md.`,
    );
  }

  const downloaded = new Map();
  for (const file of manifest.files) {
    console.log(`Downloading ${file.name} (${file.size_bytes} bytes)...`);
    const buffer = await fetchBuffer(releaseUrl(MODEL_RELEASE, path.basename(file.name)));

    if (buffer.length !== file.size_bytes) {
      throw new Error(
        `${file.name}: expected ${file.size_bytes} bytes, got ${buffer.length}. Refusing to install an incomplete download.`,
      );
    }
    const actualHash = sha256(buffer);
    if (actualHash !== file.sha256) {
      throw new Error(
        `${file.name}: checksum mismatch (expected ${file.sha256}, got ${actualHash}). Refusing to install a corrupted download.`,
      );
    }
    downloaded.set(file.name, buffer);
  }

  console.log("All files downloaded and verified. Installing...");
  await rm(INSTALL_DIR, { recursive: true, force: true });
  for (const [name, buffer] of downloaded) {
    const dest = path.join(INSTALL_DIR, name);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
  }

  await mkdir(path.dirname(VERSION_FILE), { recursive: true });
  await writeFile(VERSION_FILE, `${manifest.release}\n`);

  console.log(`Installed ${manifest.release} to ${INSTALL_DIR}`);
}

main().catch((err) => {
  console.error(`fetch-model failed: ${err.message}`);
  process.exit(1);
});
