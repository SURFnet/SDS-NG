#!/usr/bin/env node
/**
 * build-tokens.mjs
 *
 * Fetches design tokens from the Figma Variables API and generates
 * src/new-figma.css using Style Dictionary.
 *
 * Output structure:
 *   @theme inline { … }          — Tailwind v4 bridges
 *   :root { … }                  — default theme (SURF Blue), light mode
 *   .dark { … }                  — dark mode overrides
 *   .theme-surf-green { … }      — per-theme light overrides (only differing vars)
 *   .dark.theme-surf-green { … } — per-theme dark overrides
 *   … (one block pair per theme)
 *
 * Switch themes by adding a class to <html>:
 *   <html class="theme-surf-green">
 *   <html class="dark theme-surf-green">
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

const DEFAULT_THEME  = args.theme;
const OUTPUT_PATH    = args.output;
const FIGMA_TOKEN    = process.env.FIGMA_TOKEN;
const FIGMA_FILE_ID  = process.env.FIGMA_FILE_ID;

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

// "2. Theme" — per-brand palette + typography + spacing
const themeEntry = findCollection('2. Theme', [DEFAULT_THEME]);
if (!themeEntry) {
  const available = Object.values(collections)
    .filter((c) => c.name.includes('Theme'))
    .flatMap((c) => c.modes.map((m) => m.name))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
  console.error(`Theme "${DEFAULT_THEME}" not found. Available themes: ${available}`);
  process.exit(1);
}
const { col: themeCol } = themeEntry;

// All theme modes available in this collection
const allThemeModes = themeCol.modes; // [{ modeId, name }, …]
const defaultThemeModeId = themeCol.modes.find((m) => m.name === DEFAULT_THEME).modeId;
console.log(`Default theme: "${DEFAULT_THEME}" — generating ${allThemeModes.length} theme override blocks`);

// "1. TailwindCSS" — border-radius tokens (px values)
const twEntry  = findCollection('1. TailwindCSS');
const twModeId = twEntry ? twEntry.col.modes[0].modeId : null;

// ---------------------------------------------------------------------------
// Step 3: Alias resolution helpers
// ---------------------------------------------------------------------------

/** Recursively resolve VARIABLE_ALIAS chains to a concrete value.
 *  `preferredModeId` is tried first; on miss falls back to the first mode.
 *
 *  `stopAtModes` — if provided, the resolver stops and returns the alias
 *  object (without following it) when the alias target's valuesByMode keys
 *  are all contained within this set.  Used to stop at the 2.Theme boundary
 *  so that a second resolve pass can apply the correct theme mode ID.
 */
function resolveAlias(value, preferredModeId, stopAtModes = null, depth = 0) {
  if (depth > 10) return value;
  if (typeof value !== 'object' || value === null) return value;
  if (value.type !== 'VARIABLE_ALIAS') return value;

  const refVar = variables[value.id];
  if (!refVar) return value; // external / library variable — leave as-is

  // If this target's modes are all theme-collection modes (not semantic modes),
  // stop here and let the caller resolve with the theme mode ID.
  if (stopAtModes) {
    const refModes = Object.keys(refVar.valuesByMode);
    const allInTheme = refModes.every((m) => stopAtModes.has(m));
    if (allInTheme) return value; // return the alias, not the resolved value
  }

  const modeVal =
    refVar.valuesByMode[preferredModeId] ??
    Object.values(refVar.valuesByMode)[0];

  return resolveAlias(modeVal, preferredModeId, stopAtModes, depth + 1);
}

/** Convert a Figma {r,g,b,a} (0–1 floats) to a CSS `rgba()` string. */
function figmaColorToRgba({ r, g, b, a = 1 }) {
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  const ai = parseFloat(a.toFixed(2));
  return `rgba(${ri}, ${gi}, ${bi}, ${ai})`;
}

// All mode IDs that belong to the "2. Theme" collection — used as a stop
// boundary so that resolveAlias doesn't cross into the theme layer with the
// wrong (semantic) mode ID.
const themeModeIds = new Set(themeCol.modes.map((m) => m.modeId));

/** Resolve a colour variable through the semantic mode → a specific theme palette.
 *  Two-pass approach:
 *   1. Follow the alias chain within "3. Mode" using semanticModeId, stopping
 *      when the next target lives in "2. Theme" (detected via themeModeIds).
 *   2. Follow the remaining alias into "2. Theme" using the correct themeModeId.
 */
function resolveColor(varId, semanticModeId, themeModeId) {
  const v = variables[varId];
  if (!v) return null;
  const raw = v.valuesByMode[semanticModeId];
  if (raw === undefined) return null;

  // Pass 1: resolve within the semantic layer, stop at the theme boundary
  const atBoundary = resolveAlias(raw, semanticModeId, themeModeIds);
  // Pass 2: follow into the theme layer with the correct theme mode ID
  const resolved   = resolveAlias(atBoundary, themeModeId);

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

/** Convert a Figma theme name to a CSS class name.
 *  "SURF Blue" → "theme-surf-blue"
 *  "Groenvermogen / NKPH2" → "theme-groenvermogen-nkph2"  */
function themeNameToClass(name) {
  return 'theme-' + name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Step 4: CSS variable name derivation
// ---------------------------------------------------------------------------

/**
 * Derives a CSS custom property name from a Figma variable name.
 *
 *   base/foo                         → --foo
 *   base/sidebar-ring                → --sidebar-ring
 *   alpha/50                         → --alpha-50
 *   custom/outline                   → --custom-outline
 *   custom/input\30 dark:transparent → --custom-input-30-dark-transparent
 */
function figmaNameToCssProp(name) {
  const segments = name.split('/');
  const prefix   = segments[0];
  const relevant = prefix === 'base' ? segments.slice(1) : segments;

  const sanitised = relevant
    .join('-')
    .replace(/\\/g, '')
    .replace(/[^a-zA-Z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `--${sanitised}`;
}

// ---------------------------------------------------------------------------
// Step 5: Collect colour tokens for all themes
// ---------------------------------------------------------------------------

/** Build { cssProp → rgbaString } for all colour vars in "3. Mode"
 *  resolved through the given theme mode. */
function collectColorTokens(semanticModeId, themeModeId) {
  const tokens = {};
  for (const varId of modeCol.variableIds) {
    const v = variables[varId];
    if (!v || v.resolvedType !== 'COLOR') continue;
    const val = resolveColor(varId, semanticModeId, themeModeId);
    if (val) tokens[figmaNameToCssProp(v.name)] = val;
  }
  return tokens;
}

// Default theme tokens
const lightTokens = collectColorTokens(lightModeId, defaultThemeModeId);
const darkTokens  = collectColorTokens(darkModeId,  defaultThemeModeId);

// ---------------------------------------------------------------------------
// Step 6: Collect radius tokens from "1. TailwindCSS"
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
      const rawStep = v.name.slice('border-radius/'.length);
      const cssStep = rawStep.replace(/^rounded-/, '');
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
// Step 7: Collect all non-color tokens from "2. Theme" (default theme)
// ---------------------------------------------------------------------------

const themeNonColorTokens = {};

for (const varId of themeCol.variableIds) {
  const v = variables[varId];
  if (!v || v.resolvedType === 'COLOR') continue;

  const raw = v.valuesByMode[defaultThemeModeId];
  if (raw === undefined) continue;
  const val = resolveAlias(raw, defaultThemeModeId);

  const name  = v.name;
  const parts = name.split('/');
  const top   = parts[0];

  if (top === 'text' && parts.length === 3 && typeof val === 'number') {
    const prop = parts[2];
    if (prop === 'font-size' || prop === 'line-height') {
      themeNonColorTokens[`--text-${parts[1]}-${prop}`] = pxToRem(val);
    }
  }
  if (top === 'font' && parts.length === 2 && typeof val === 'string') {
    themeNonColorTokens[`--font-${parts[1]}`] = val;
  }
  if (top === 'font-weight' && parts.length === 2 && typeof val === 'number') {
    themeNonColorTokens[`--font-weight-${parts[1]}`] = String(val);
  }
  if (top === 'radius' && parts.length === 2 && typeof val === 'number') {
    themeNonColorTokens[`--radius-${parts[1]}`] = pxToRem(val);
  }
  if (top === 'blur' && parts.length === 2 && typeof val === 'number') {
    themeNonColorTokens[`--blur-${parts[1]}`] = `${val}px`;
  }
  if (top === 'breakpoint' && parts.length === 2 && typeof val === 'number') {
    themeNonColorTokens[`--breakpoint-${parts[1]}`] = `${val}px`;
  }
  if (top === 'container' && parts.length === 2 && typeof val === 'number') {
    themeNonColorTokens[`--container-${parts[1]}`] = `${val}px`;
  }
  if ((top === 'shadow' || top === 'drop-shadow' || top === 'inset-shadow') && typeof val === 'number') {
    themeNonColorTokens[figmaNameToCssProp(name)] = `${val}px`;
  }
}

// ---------------------------------------------------------------------------
// Step 8: Build font stacks and final :root / .dark maps
// ---------------------------------------------------------------------------

const FONT_STACKS = {
  '--font-sans': `${themeNonColorTokens['--font-font-sans'] ?? 'Source Sans 3'}, sans-serif`,
  '--font-mono': `${themeNonColorTokens['--font-font-mono'] ?? 'Geist Mono'}, monospace`,
  ...fontTokens,
};

const lightMap = { ...lightTokens, ...themeNonColorTokens, ...FONT_STACKS };
delete lightMap['--font-font-sans'];
delete lightMap['--font-font-serif'];
delete lightMap['--font-font-mono'];

const darkDiff = {};
for (const [prop, val] of Object.entries(darkTokens)) {
  if (val !== lightTokens[prop]) darkDiff[prop] = val;
}

// ---------------------------------------------------------------------------
// Step 9: Compute per-theme overrides (light and dark diffs vs default)
// ---------------------------------------------------------------------------

/**
 * For each non-default theme, resolve its colour tokens and compute the diff
 * against the default theme. Returns an array of:
 *   { name, className, lightDiff, darkDiff }
 */
const themeOverrides = [];

for (const { modeId, name } of allThemeModes) {
  if (name === DEFAULT_THEME) continue;

  const themeLight = collectColorTokens(lightModeId, modeId);
  const themeDark  = collectColorTokens(darkModeId,  modeId);

  // Only emit vars that differ from the default theme
  const lightDiff = {};
  for (const [prop, val] of Object.entries(themeLight)) {
    if (val !== lightTokens[prop]) lightDiff[prop] = val;
  }

  const themeDarkDiff = {};
  for (const [prop, val] of Object.entries(themeDark)) {
    if (val !== darkTokens[prop]) themeDarkDiff[prop] = val;
  }

  // Also check font stacks (font-family can differ per theme)
  const themeFontSans = (() => {
    const raw = themeCol.variableIds
      .map((id) => variables[id])
      .find((v) => v?.name === 'font/font-sans');
    if (!raw) return null;
    const val = resolveAlias(raw.valuesByMode[modeId], modeId);
    return typeof val === 'string' ? `${val}, sans-serif` : null;
  })();
  const themeFontMono = (() => {
    const raw = themeCol.variableIds
      .map((id) => variables[id])
      .find((v) => v?.name === 'font/font-mono');
    if (!raw) return null;
    const val = resolveAlias(raw.valuesByMode[modeId], modeId);
    return typeof val === 'string' ? `${val}, monospace` : null;
  })();

  if (themeFontSans && themeFontSans !== FONT_STACKS['--font-sans']) {
    lightDiff['--font-sans'] = themeFontSans;
  }
  if (themeFontMono && themeFontMono !== FONT_STACKS['--font-mono']) {
    lightDiff['--font-mono'] = themeFontMono;
  }

  if (Object.keys(lightDiff).length === 0 && Object.keys(themeDarkDiff).length === 0) continue;

  themeOverrides.push({
    name,
    className: themeNameToClass(name),
    lightDiff,
    darkDiff: themeDarkDiff,
  });
}

console.log('\nTokens collected:');
console.log(`  :root properties     : ${Object.keys(lightMap).length}`);
console.log(`  .dark overrides      : ${Object.keys(darkDiff).length}`);
console.log(`  @theme radius tokens : ${Object.keys(radiusTokens).length}`);
console.log(`  theme non-color vars : ${Object.keys(themeNonColorTokens).length}`);
console.log(`  theme override sets  : ${themeOverrides.length}`);
themeOverrides.forEach(({ name, lightDiff, darkDiff }) => {
  console.log(`    .${themeNameToClass(name)}: ${Object.keys(lightDiff).length} light, ${Object.keys(darkDiff).length} dark`);
});

// ---------------------------------------------------------------------------
// Step 10: CSS block builders
// ---------------------------------------------------------------------------

function buildThemeBlock(radius) {
  const lines = [];

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

  const colorProps = Object.keys(lightTokens);
  const emitted    = new Set();

  for (const prop of COLOR_ORDER) {
    if (colorProps.includes(prop)) {
      lines.push(`    --color-${prop.slice(2)}: var(${prop});`);
      emitted.add(prop);
    }
  }
  for (const prop of colorProps) {
    if (!emitted.has(prop)) lines.push(`    --color-${prop.slice(2)}: var(${prop});`);
  }

  for (const prop of Object.keys(FONT_STACKS)) {
    lines.push(`    ${prop}: var(${prop});`);
  }

  const SCALE_ORDER = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
  const textScales = [...new Set(
    Object.keys(themeNonColorTokens)
      .filter((p) => p.startsWith('--text-') && p.endsWith('-font-size'))
      .map((p) => p.replace(/^--text-/, '').replace(/-font-size$/, '')),
  )].sort((a, b) => {
    const ai = SCALE_ORDER.indexOf(a), bi = SCALE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  for (const scale of textScales) {
    lines.push(`    --text-${scale}: var(--text-${scale}-font-size);`);
    if (themeNonColorTokens[`--text-${scale}-line-height`]) {
      lines.push(`    --text-${scale}--line-height: var(--text-${scale}-line-height);`);
    }
  }

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

function buildBlock(selector, props) {
  const lines = Object.entries(props).map(([p, v]) => `    ${p}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

// ---------------------------------------------------------------------------
// Step 11: Run Style Dictionary with a custom format
// ---------------------------------------------------------------------------

StyleDictionary.registerFormat({
  name: 'css/figma-shadcn',
  format({ options }) {
    const { lightMap, darkDiff, radius, themeOverrides } = options;
    const blocks = [
      buildThemeBlock(radius),
      buildBlock(':root', lightMap),
      buildBlock('.dark', darkDiff),
    ];

    for (const { className, lightDiff, darkDiff: tDarkDiff } of themeOverrides) {
      if (Object.keys(lightDiff).length > 0) {
        blocks.push(`/* ${className} */`);
        blocks.push(buildBlock(`.${className}`, lightDiff));
      }
      if (Object.keys(tDarkDiff).length > 0) {
        blocks.push(buildBlock(`.dark.${className}`, tDarkDiff));
      }
    }

    return blocks.join('\n\n') + '\n';
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
          options: { lightMap, darkDiff, radius: radiusTokens, themeOverrides },
        },
      ],
    },
  },
  log: { verbosity: 'silent' },
});

await sd.buildAllPlatforms();
console.log(`\nGenerated: ${outputFile}`);
