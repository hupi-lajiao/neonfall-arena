// NEONFALL ARENA — entrypoint for the make.fun best-game-01 submission.
//
// What this program does, in order:
//   1. Works out where it lives and where the output goes
//      (MAKEFUN_OUTPUT_DIR when set, otherwise /output).
//   2. Preflight: walks game/ and screenshots/ and refuses to hand in an
//      entry the scorer would refuse anyway — too many files, too many
//      bytes, an over-long path, a missing or oversized index.html, or the
//      wrong number of screenshots. Every failure names the path at fault.
//   3. Copies game/ and screenshots/ into the output directory.
//   4. Asks the vendored make.fun library to build the dossier from the
//      copied tree and writes it as dossier.json next to the copies.
//   5. Prints a short run report so a human can see what was handed in.
//
// Node 22, standard library only, ES module. Run it with: node main.ts

import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps, named once so the preflight checks and the dossier
// options below can never drift apart.
const CAPS = {
  textBytes: 163840, // dossier text budget; the only cap that shapes bytes
  shotCountMax: 4,
  shotCountMin: 3,
  shotBytes: 262144, // 256 KiB per screenshot
  gameFiles: 993,
  gameBytes: 50331648, // 48 MiB across all of game/
  gamePathBytes: 1000, // longest allowed path inside game/
  indexBytes: 1048576, // game/index.html on its own: at most 1 MiB
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Byte length of a string as UTF-8 — path caps are measured in bytes. */
function utf8Length(text) {
  return Buffer.byteLength(text, 'utf8');
}

/** Lower-case file extension including the dot, or '' when there is none. */
function extensionOf(name) {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

/**
 * Recursively list every file under dir as { path, bytes } records.
 * Directories themselves are traversed but not returned; the caller counts
 * files only, which is what the caps speak about.
 */
function walkFiles(dir) {
  const found = [];
  const pending = [dir];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(full);
      } else if (entry.isFile()) {
        found.push({ path: full, bytes: statSync(full).size });
      }
    }
  }
  return found;
}

/** Sum of the bytes column of a walkFiles result. */
function totalBytes(files) {
  let sum = 0;
  for (const file of files) sum += file.bytes;
  return sum;
}

// ---------------------------------------------------------------------------
// Preflight validation
// ---------------------------------------------------------------------------

/**
 * Check game/ against the scorer's limits before anything is copied.
 * Returns the walked file list so the run report can reuse it.
 * Throws an Error naming the offending path on the first failed check.
 */
function checkGameTree(gameDir) {
  if (!existsSync(gameDir)) {
    throw new Error(`preflight: game directory is missing: ${gameDir}`);
  }

  const files = walkFiles(gameDir);

  if (files.length > CAPS.gameFiles) {
    throw new Error(
      `preflight: game/ holds ${files.length} files, over the ${CAPS.gameFiles} cap: ${gameDir}`,
    );
  }

  const bytes = totalBytes(files);
  if (bytes > CAPS.gameBytes) {
    throw new Error(
      `preflight: game/ totals ${bytes} bytes, over the ${CAPS.gameBytes} cap: ${gameDir}`,
    );
  }

  for (const file of files) {
    const rel = relative(gameDir, file.path);
    if (utf8Length(rel) > CAPS.gamePathBytes) {
      throw new Error(
        `preflight: path inside game/ is ${utf8Length(rel)} bytes, over the ${CAPS.gamePathBytes} cap: ${rel}`,
      );
    }
  }

  const indexPath = join(gameDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`preflight: the game has no entry page: ${indexPath}`);
  }
  const indexBytes = statSync(indexPath).size;
  if (indexBytes > CAPS.indexBytes) {
    throw new Error(
      `preflight: index.html is ${indexBytes} bytes, over the ${CAPS.indexBytes} cap: ${indexPath}`,
    );
  }

  return files;
}

/**
 * Check screenshots/: it must hold between 3 and 4 image files and every
 * one of them must fit the per-image byte cap. Returns the image list.
 */
function checkScreenshots(shotsDir) {
  if (!existsSync(shotsDir)) {
    throw new Error(`preflight: screenshots directory is missing: ${shotsDir}`);
  }

  const images = walkFiles(shotsDir).filter((file) =>
    IMAGE_EXTENSIONS.has(extensionOf(file.path)),
  );

  if (images.length < CAPS.shotCountMin || images.length > CAPS.shotCountMax) {
    throw new Error(
      `preflight: screenshots/ holds ${images.length} image files, need ${CAPS.shotCountMin} to ${CAPS.shotCountMax}: ${shotsDir}`,
    );
  }

  for (const image of images) {
    if (image.bytes > CAPS.shotBytes) {
      throw new Error(
        `preflight: screenshot is ${image.bytes} bytes, over the ${CAPS.shotBytes} cap: ${image.path}`,
      );
    }
  }

  return images;
}

// ---------------------------------------------------------------------------
// The hand-in itself
// ---------------------------------------------------------------------------

/**
 * Copy one top-level folder (game or screenshots) into the output dir and
 * report how many files and bytes the copy carried, measured at the source.
 */
function copyFolder(name, sourceDir, outDir, sourceFiles) {
  const target = join(outDir, name);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(sourceDir, target, { recursive: true, force: true });
  return { name, files: sourceFiles.length, bytes: totalBytes(sourceFiles) };
}

/** Build the dossier from the copied tree and write it into the output. */
function writeDossier(outDir) {
  const dossier = buildDossier(outDir, {
    text_max_bytes: CAPS.textBytes,
    screenshots: { max: CAPS.shotCountMax, max_bytes: CAPS.shotBytes },
    game_max_files: CAPS.gameFiles,
    game_max_bytes: CAPS.gameBytes,
    game_path_max_bytes: CAPS.gamePathBytes,
  });
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  return { path: dossierPath, bytes: utf8Length(dossier) };
}

/** Print the run report: one line per folder, then the dossier line. */
function printReport(copies, dossier) {
  let allFiles = 0;
  let allBytes = 0;
  for (const copy of copies) {
    console.log(`  ${copy.name}/: ${copy.files} files, ${copy.bytes} bytes`);
    allFiles += copy.files;
    allBytes += copy.bytes;
  }
  console.log(`  copied in total: ${allFiles} files, ${allBytes} bytes`);
  console.log(`  dossier.json: ${dossier.bytes} bytes -> ${dossier.path}`);
}

function containsPath(parent, candidate) {
  const rel = relative(parent, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function assertSafeOutputDir(outDir, sourceDirs) {
  for (const sourceDir of sourceDirs) {
    if (containsPath(outDir, sourceDir) || containsPath(sourceDir, outDir)) {
      throw new Error(`output directory must not overlap source directory: ${outDir}`);
    }
  }
}

function main() {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  const gameDir = resolve(join(here, 'game'));
  const shotsDir = resolve(join(here, 'screenshots'));
  assertSafeOutputDir(outDir, [gameDir, shotsDir]);

  // Validate first: a bad entry should fail here, loudly, not at the scorer.
  const gameFiles = checkGameTree(gameDir);
  const shotFiles = checkScreenshots(shotsDir);

  mkdirSync(outDir, { recursive: true });
  const copies = [
    copyFolder('game', gameDir, outDir, gameFiles),
    copyFolder('screenshots', shotsDir, outDir, shotFiles),
  ];
  const dossier = writeDossier(outDir);

  console.log(`NEONFALL ARENA handed in to ${outDir}:`);
  printReport(copies, dossier);
}

main();
