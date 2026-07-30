#!/usr/bin/env node
/**
 * Downloads, checksum-verifies, and installs the Whisper speech-to-text
 * model into public/models/whisper-base.en/, for on-device voice-note
 * transcription (see src/workers/whisperWorker.ts).
 *
 * Unlike scripts/fetch-model.mjs (which trusts a signed manifest published
 * alongside the fine-tuned intent-recovery-model releases), this is a
 * stock, un-fine-tuned model pulled straight from its public Hugging Face
 * repo -- there is no upstream manifest to trust here. Instead, the
 * sha256 + byte-length of each file below were computed once, by hand,
 * against that repo and pinned as the trust anchor: this script refuses to
 * install anything that doesn't match, exactly like fetch-model.mjs does
 * for the organizer model.
 *
 * Usage:
 *   node scripts/fetch-whisper-model.mjs
 *   npm run fetch-whisper-model
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const HF_REPO = "Xenova/whisper-base.en";
const HF_REVISION = "main";
const INSTALL_DIR = path.resolve("public", "models", "whisper-base.en");

// Pinned against https://huggingface.co/Xenova/whisper-base.en on 2026-07-30.
// If this model is ever updated upstream, these files will fail their
// checksum and this script will (correctly) refuse to install them --
// re-verify and re-pin deliberately if that happens.
const FILES = [
  { name: "config.json", size_bytes: 2202, sha256: "5c390f2c6ba84ddeb7e362cd8b2123832911407850174e64d7081ccc36df2d64" },
  { name: "generation_config.json", size_bytes: 1500, sha256: "1e57ed56ad1bd7f08a49ece7fe7daada674573805a35f8bdbbe68380aab5b1ee" },
  { name: "preprocessor_config.json", size_bytes: 339, sha256: "a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d" },
  { name: "tokenizer.json", size_bytes: 2128494, sha256: "c6ee8f089220a5b1188f6426456772572671c6141ae007eecb83c6a8349f5deb" },
  { name: "tokenizer_config.json", size_bytes: 835, sha256: "e082c1ad251541bf277967a703252cddd4bb37a71a43737e03d050c22ec08238" },
  { name: "special_tokens_map.json", size_bytes: 1717, sha256: "7da611d517fe29e77335b8d8384e71795fb7b37cbf95bdc3b5252fa7e09dd1f8" },
  { name: "normalizer.json", size_bytes: 52666, sha256: "bf1c507dc8724ca9cf9903640dacfb69dae2f00edee4f21ceba106a7392f26dd" },
  { name: "added_tokens.json", size_bytes: 2082, sha256: "598c98875c01fe7ebd08ba6779f052f1136de6d36d9e7b99e04b432f78ecb28d" },
  { name: "vocab.json", size_bytes: 999186, sha256: "f6bd25a65e4e63ca31360e9fb11c7e4f9a391a78385d640acd814092dd6eee4f" },
  { name: "merges.txt", size_bytes: 456318, sha256: "1ce1664773c50f3e0cc8842619a93edc4624525b728b188a9e0be33b7726adc5" },
  { name: "onnx/encoder_model_quantized.onnx", size_bytes: 23200856, sha256: "d0d4e59e2842617b39787cece73d7e8f76f99b1697d3386c0e682eca2269f4a1" },
  { name: "onnx/decoder_model_merged_quantized.onnx", size_bytes: 53707027, sha256: "a25afc5858a20aabb7652cb2d555996ebe10691a69bbdb423d5073d52f060325" },
];

const fileUrl = (name) =>
  `https://huggingface.co/${HF_REPO}/resolve/${HF_REVISION}/${name}`;

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  console.log(`Fetching ${HF_REPO} (Whisper speech-to-text model)...`);

  const downloaded = new Map();
  for (const file of FILES) {
    console.log(`Downloading ${file.name} (${file.size_bytes} bytes)...`);
    const buffer = await fetchBuffer(fileUrl(file.name));

    if (buffer.length !== file.size_bytes) {
      throw new Error(
        `${file.name}: expected ${file.size_bytes} bytes, got ${buffer.length}. Refusing to install an incomplete download.`,
      );
    }
    const actualHash = sha256(buffer);
    if (actualHash !== file.sha256) {
      throw new Error(
        `${file.name}: checksum mismatch (expected ${file.sha256}, got ${actualHash}). Refusing to install a corrupted or unexpectedly-changed download.`,
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

  console.log(`Installed Whisper (whisper-base.en) to ${INSTALL_DIR}`);
}

main().catch((err) => {
  console.error(`fetch-whisper-model failed: ${err.message}`);
  process.exit(1);
});
