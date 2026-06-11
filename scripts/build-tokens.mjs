#!/usr/bin/env node
/**
 * build-tokens.mjs
 *
 * Fetches design tokens from the Figma Variables API and generates
 * src/new-figma.css using Style Dictionary — a drop-in replacement
 * for src/figma.css (Tailwind v4 @theme bridge + :root + .dark blocks).
 *
 * Usage:
 *   node scripts/build-tokens.mjs [--theme "SURF Blue"] [--output src/new-figma.css]
 *
 * Environment variables (loaded from .env):
 *   FIGMA_TOKEN   — Figma personal access token
 *   FIGMA_FILE_ID — Figma file key (from the file URL)
 */

import 'dotenv/config';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import StyleDictionary from 'style-dictionary';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const { values: args } = parseArgs({
  options: {
    theme:  { type: 'string', default: 'SURF Blue' },
    output: { type: 'string', default: 'src/new-figma.css' },
  },
  strict: false,
});

const THEME_NAME    = args.theme;
const OUTPUT_PATH   = args.output;
const FIGMA_TOKEN   = process.env.FIGMA_TOKEN;
const FIGMA_FILE_ID = process.env.FIGMA_FILE_ID;

if (!FIGMA_TOKEN)   { console.error('ERROR: FIGMA_TOKEN is not set. Add it to .env'); process.exit(1); }
if (!FIGMA_FILE_ID) { console.error('ERROR: FIGMA_FILE_ID is not set. Add it to .env'); process.exit(1); }

const repoRoot   = resolve(fileURLToPath(import.meta.url), '..', '..');
const outputFile = resolve(repoRoot, OUTPUT_PATH);

// ---------------------------------------------------------------------------
// Step 1: Fetch Figma Variables API
// ---------------------------------------------------------------------------
console.log(`\nFetching variables from Figma file ${FIGMA_FILE_ID}…`);

const resp = await fetch(
  `https://api.figma.com/v1/files/${FIGMA_FILE_ID}/variables/local`,
  { headers: { 'X-Figma-Token': FIGMA_TOKEN } },
);

if (!resp.ok) {
  const body = await resp.text();
  console.error(`Figma API error ${resp.status}: ${body}`);
  process.exit(1);
}

const { meta } = await resp.json();
const { variableCollections: collections, variables } = meta;

// ---------------------------------------------------------------------------
// Step 2: Locate the collections we need
// ---------------------------------------------------------------------------

/** Find the largest collection (by variableIds count) whose name contains
 *  `namePart` and whose modes include every name in `requiredModes`.
 *  "Largest" avoids picking small external-library shadow copies. */
function findCollection(namePart, requiredModes = []) {
  let best = null;
  for (const [id, col] of Object.entries(collections)) {
    const modeNames = col.modes.map((m) => m.name);
    if (
      col.name.includes(namePart) &&
      requiredModes.every((m) => modeNames.includes(m))
    ) {
      if (!best || col.variableIds.length > best.col.variableIds.length) {
        best = { id, col };
      }
    }
  }
  return best;
}

// "3. Mode" — semantic tokens with Light / Dark modes
const modeEntry = findCollection('3. Mode', ['Light', 'Dark']);
if (!modeEntry) {
  console.error('Could not find "3. Mode" collection with Light/Dark modes');
  process.exit(1);
}
const { col: modeCol } = modeEntry;
const lightModeId = modeCol.modes.find((m) => m.name === 'Light').modeId;
const darkModeId  = modeCol.modes.find((m) => m.name === 'Dark').modeId;

// "2. Theme" — per-brand palette + typography + spacing; must contain the requested theme
const themeEntry = findCollection('2. Theme', [THEME_NAME]);
if (!themeEntry) {
  const available = Object.values(collections)
    .filter((c) => c.name.includes('Theme'))
    .flatMap((c) => c.modes.map((m) => m.name))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
  console.error(`Theme "${THEME_NAME}" not found. Available themes: ${available}`);
  process.exit(1);
}
const { col: themeCol } = themeEntry;
const themeModeId = themeCol.modes.find((m) => m.name === THEME_NAME).modeId;
console.log(`Using theme: "${THEME_NAME}" (mode ID: ${themeModeId})`);

// "1. TailwindCSS" — border-radius tokens (px values)
const twEntry  = findCollection('1. TailwindCSS');
const twModeId = twEntry ? twEntry.col.modes[0].modeId : null;

// ---------------------------------------------------------------------------
// Step 3: Alias resolution helpers
// ---------------------------------------------------------------------------

/** Recursively resolve VARIABLE_ALIAS chains to a concrete value.
 *  `preferredModeId` is tried first; on miss falls back to the first mode. */
function resolveAlias(value, preferredModeId, depth = 0) {
  if (depth > 10) return value;
  if (typeof value !== 'object' || value === null) return value;
  if (value.type !== 'VARIABLE_ALIAS') return value;

  const refVar = variables[value.id];
  if (!refVar) return value; // external / library variable — leave as-is

  const modeVal =
    refVar.valuesByMode[preferredModeId] ??
    Object.values(refVar.valuesByMode)[0];

  return resolveAlias(modeVal, preferredModeId, depth + 1);
}

/** Convert a Figma {r,g,b,a} (0–1 floats) to a CSS `rgba()` string. */
function figmaColorToRgba({ r, g, b, a = 1 }) {
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  const ai = parseFloat(a.toFixed(2));
  return `rgba(${ri}, ${gi}, ${bi}, ${ai})`;
}

/** Fully resolve a colour variable (through semantic mode → theme palette). */
function resolveColor(varId, semanticModeId) {
  const v = variables[varId];
  if (!v) return null;
  const raw = v.valuesByMode[semanticModeId];
  if (raw === undefined) return null;

  const afterSemantic = resolveAlias(raw, semanticModeId);
  const resolved      = resolveAlias(afterSemantic, themeModeId);

  if (typeof resolved === 'object' && resolved !== null && 'r' in resolved) {
    return figmaColorToRgba(resolved);
  }
  return null;
}

/** Convert a px number to a rem string (base 16). */
function pxToRem(px) {
  const r = px / 16;
  return `${parseFloat(r.toFixed(4).replace(/\.?0+$/, ''))}rem`;
}

// ---------------------------------------------------------------------------
// Step 4: CSS variable name derivation
// ---------------------------------------------------------------------------

/**
 * Derives a CSS custom property name from a Figma variable name.
 *
 *   base/foo                         → --foo        (strips "base" prefix)
 *   base/sidebar-ring                → --sidebar-ring
 *   alpha/50                         → --alpha-50
 *   custom/outline                   → --custom-outline
 *   custom/input\30 dark:transparent → --custom-input-30-dark-transparent
 */
function figmaNameToCssProp(name) {
  const segments = name.split('/');
  const prefix   = segments[0];

  // Strip the "base" prefix — these are top-level shadcn semantic tokens
  const relevant = prefix === 'base' ? segments.slice(1) : segments;

  const sanitised = relevant
    .join('-')
    .replace(/\\/g, '')               // \30 → 30
    .replace(/[^a-zA-Z0-9\-]/g, '-') // any odd char → hyphen
    .replace(/-+/g, '-')              // collapse runs
    .replace(/^-|-$/g, '');           // trim edges

  return `--${sanitised}`;
}

// ---------------------------------------------------------------------------
// Step 5: Collect all colour tokens from "3. Mode"
// ---------------------------------------------------------------------------

const lightTokens = {};
const darkTokens  = {};

for (const varId of modeCol.variableIds) {
  const v = variables[varId];
  if (!v || v.resolvedType !== 'COLOR') continue;

  const cssProp  = figmaNameToCssProp(v.name);
  const lightVal = resolveColor(varId, lightModeId);
  const darkVal  = resolveColor(varId, darkModeId);

  if (lightVal) lightTokens[cssProp] = lightVal;
  if (darkVal)  darkTokens[cssProp]  = darkVal;
}

// ---------------------------------------------------------------------------
// Step 6: Collect radius tokens from "1. TailwindCSS"
//   "border-radius/rounded-sm" → "--radius-sm" (strips "rounded-" prefix)
// ---------------------------------------------------------------------------

const radiusTokens = {};
const fontTokens   = {};

if (twEntry && twModeId) {
  for (const varId of twEntry.col.variableIds) {
    const v = variables[varId];
    if (!v) continue;

    const raw = v.valuesByMode[twModeId];
    if (raw === undefined) continue;

    if (v.resolvedType === 'FLOAT' && v.name.startsWith('border-radius/')) {
      const rawStep = v.name.slice('border-radius/'.length); // "rounded-sm"
      const cssStep = rawStep.replace(/^rounded-/, '');       // "sm"
      const val     = resolveAlias(raw, twModeId);
      if (typeof val === 'number') {
        const remVal = val === 9999 ? '624.9375rem' : `${(val / 16).toFixed(4).replace(/\.?0+$/, '')}rem`;
        radiusTokens[`--radius-${cssStep}`] = remVal;
      }
    }

    if (v.resolvedType === 'STRING' && v.name.startsWith('font-family/')) {
      const step = v.name.slice('font-family/'.length);
      const val  = resolveAlias(raw, twModeId);
      if (typeof val === 'string') fontTokens[`--font-${step}`] = val;
    }
  }
}

// ---------------------------------------------------------------------------
// Step 7: Collect all non-color tokens from "2. Theme"
//   text/*/font-size       → --text-{scale}-font-size   (rem)
//   text/*/line-height     → --text-{scale}-line-height  (rem)
//   font/font-*            → resolved string (used for FONT_STACKS below)
//   font-weight/*          → --font-weight-{name}        (unitless)
//   radius/*               → --radius-{step}             (rem)
//   blur/*                 → --blur-{step}               (px)
//   breakpoint/*           → --breakpoint-{step}         (px)
//   container/*            → --container-{step}          (px)
//   shadow/*, drop-shadow/*, inset-shadow/* → component px values
// ---------------------------------------------------------------------------

const themeNonColorTokens = {};

if (themeEntry && themeModeId) {
  for (const varId of themeCol.variableIds) {
    const v = variables[varId];
    if (!v || v.resolvedType === 'COLOR') continue;

    const raw = v.valuesByMode[themeModeId];
    if (raw === undefined) continue;
    const val = resolveAlias(raw, themeModeId);

    const name  = v.name;
    const parts = name.split('/');
    const top   = parts[0];

    // text scale: font-size and line-height
    if (top === 'text' && parts.length === 3 && typeof val === 'number') {
      const scale = parts[1]; // "xs", "sm", "base", …
      const prop  = parts[2]; // "font-size" | "line-height"
      if (prop === 'font-size' || prop === 'line-height') {
        themeNonColorTokens[`--text-${scale}-${prop}`] = pxToRem(val);
      }
    }

    // font family strings (stored as intermediate values for FONT_STACKS)
    if (top === 'font' && parts.length === 2 && typeof val === 'string') {
      themeNonColorTokens[`--font-${parts[1]}`] = val;
    }

    // font weight
    if (top === 'font-weight' && parts.length === 2 && typeof val === 'number') {
      themeNonColorTokens[`--font-weight-${parts[1]}`] = String(val);
    }

    // radius (from theme collection — same px values as TailwindCSS border-radius/*)
    if (top === 'radius' && parts.length === 2 && typeof val === 'number') {
      themeNonColorTokens[`--radius-${parts[1]}`] = pxToRem(val);
    }

    // blur
    if (top === 'blur' && parts.length === 2 && typeof val === 'number') {
      themeNonColorTokens[`--blur-${parts[1]}`] = `${val}px`;
    }

    // breakpoints
    if (top === 'breakpoint' && parts.length === 2 && typeof val === 'number') {
      themeNonColorTokens[`--breakpoint-${parts[1]}`] = `${val}px`;
    }

    // containers
    if (top === 'container' && parts.length === 2 && typeof val === 'number') {
      themeNonColorTokens[`--container-${parts[1]}`] = `${val}px`;
    }

    // shadow components
    if ((top === 'shadow' || top === 'drop-shadow' || top === 'inset-shadow') && typeof val === 'number') {
      themeNonColorTokens[figmaNameToCssProp(name)] = `${val}px`;
    }
  }
}

// ---------------------------------------------------------------------------
// Step 8: Build font stacks from Figma font-family + CSS generic fallback
// ---------------------------------------------------------------------------

const FONT_STACKS = {
  '--font-sans': `${themeNonColorTokens['--font-font-sans'] ?? 'Source Sans 3'}, sans-serif`,
  '--font-mono': `${themeNonColorTokens['--font-font-mono'] ?? 'Geist Mono'}, monospace`,
  ...fontTokens,
};

// ---------------------------------------------------------------------------
// Step 9: Build final token maps
// ---------------------------------------------------------------------------

// :root = light colour tokens + theme non-color tokens + font stacks
const lightMap = { ...lightTokens, ...themeNonColorTokens, ...FONT_STACKS };

// Remove the intermediate "--font-font-*" keys (only needed for FONT_STACKS)
delete lightMap['--font-font-sans'];
delete lightMap['--font-font-serif'];
delete lightMap['--font-font-mono'];

// .dark = only properties that actually differ from light
const darkDiff = {};
for (const [prop, val] of Object.entries(darkTokens)) {
  if (val !== lightTokens[prop]) darkDiff[prop] = val;
}

console.log('\nTokens collected:');
console.log(`  :root properties     : ${Object.keys(lightMap).length}`);
console.log(`  .dark overrides      : ${Object.keys(darkDiff).length}`);
console.log(`  @theme radius tokens : ${Object.keys(radiusTokens).length}`);
console.log(`  theme non-color vars : ${Object.keys(themeNonColorTokens).length}`);

// ---------------------------------------------------------------------------
// Step 10: CSS block builders
// ---------------------------------------------------------------------------

/**
 * @theme inline block — Tailwind v4 bridge.
 *
 * Colour tokens → --color-* aliases.
 * Font stacks   → self-referential var() (required by Tailwind v4).
 * Text scale    → --text-{scale} self-referential bridges.
 * Radius        → concrete rem values.
 */
function buildThemeBlock(radius) {
  const lines = [];

  // Preferred output order for colour bridges (mirrors original figma.css)
  const COLOR_ORDER = [
    '--background', '--foreground',
    '--font-sans', '--font-mono',
    '--sidebar-ring', '--sidebar-border',
    '--sidebar-accent-foreground', '--sidebar-accent',
    '--sidebar-primary-foreground', '--sidebar-primary',
    '--sidebar-foreground', '--sidebar',
    '--chart-5', '--chart-4', '--chart-3', '--chart-2', '--chart-1',
    '--ring', '--input', '--border', '--destructive',
    '--accent-foreground', '--accent',
    '--muted-foreground', '--muted',
    '--secondary-foreground', '--secondary',
    '--primary-foreground', '--primary',
    '--popover-foreground', '--popover',
    '--card-foreground', '--card',
  ];

  // Only actual colour tokens get --color-* bridges
  const colorProps = Object.keys(lightTokens);
  const emitted    = new Set();

  for (const prop of COLOR_ORDER) {
    if (colorProps.includes(prop)) {
      lines.push(`    --color-${prop.slice(2)}: var(${prop});`);
      emitted.add(prop);
    }
  }
  for (const prop of colorProps) {
    if (!emitted.has(prop)) {
      lines.push(`    --color-${prop.slice(2)}: var(${prop});`);
    }
  }

  // Font bridges (self-referential — required by Tailwind v4)
  for (const prop of Object.keys(FONT_STACKS)) {
    lines.push(`    ${prop}: var(${prop});`);
  }

  // Text-scale bridges: Tailwind v4 --text-{scale} = font-size,
  // --text-{scale}--line-height = line-height
  const textScales = [...new Set(
    Object.keys(themeNonColorTokens)
      .filter((p) => p.startsWith('--text-') && p.endsWith('-font-size'))
      .map((p) => p.replace(/^--text-/, '').replace(/-font-size$/, '')),
  )];
  // Sort by Tailwind scale order
  const SCALE_ORDER = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
  textScales.sort((a, b) => {
    const ai = SCALE_ORDER.indexOf(a);
    const bi = SCALE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  for (const scale of textScales) {
    lines.push(`    --text-${scale}: var(--text-${scale}-font-size);`);
    if (themeNonColorTokens[`--text-${scale}-line-height`]) {
      lines.push(`    --text-${scale}--line-height: var(--text-${scale}-line-height);`);
    }
  }

  // Radius values
  const RADIUS_ORDER = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'];
  const emittedR = new Set();
  for (const step of RADIUS_ORDER) {
    const key = `--radius-${step}`;
    if (radius[key]) { lines.push(`    ${key}: ${radius[key]};`); emittedR.add(key); }
  }
  for (const [key, val] of Object.entries(radius)) {
    if (!emittedR.has(key)) lines.push(`    ${key}: ${val};`);
  }

  return `@theme inline {\n${lines.join('\n')}\n}`;
}

function buildRootBlock(props) {
  return `:root {\n${Object.entries(props).map(([p, v]) => `    ${p}: ${v};`).join('\n')}\n}`;
}

function buildDarkBlock(props) {
  return `.dark {\n${Object.entries(props).map(([p, v]) => `    ${p}: ${v};`).join('\n')}\n}`;
}

// ---------------------------------------------------------------------------
// Step 11: Run Style Dictionary with a custom format
// ---------------------------------------------------------------------------

StyleDictionary.registerFormat({
  name: 'css/figma-shadcn',
  format({ options }) {
    const { lightMap, darkDiff, radius } = options;
    const themeBlock = buildThemeBlock(radius);
    const rootBlock  = buildRootBlock(lightMap);
    const darkBlock  = buildDarkBlock(darkDiff);
    return [themeBlock, rootBlock, darkBlock].join('\n\n') + '\n';
  },
});

const sd = new StyleDictionary({
  tokens: {
    placeholder: { token: { $value: 'unused', $type: 'other' } },
  },
  platforms: {
    css: {
      files: [
        {
          destination: outputFile,
          format: 'css/figma-shadcn',
          options: { lightMap, darkDiff, radius: radiusTokens },
        },
      ],
    },
  },
  log: { verbosity: 'silent' },
});

await sd.buildAllPlatforms();
console.log(`\nGenerated: ${outputFile}`);
