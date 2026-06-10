# Changelog

All notable changes to `@surfnet/sds-ng` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-06-10

### Added

- Initial release of the SURFnet Design System (`@surfnet/sds-ng`)
- React + TypeScript + Vite project scaffold
- All 55 shadcn components (radix-vega style, Tabler icons) in `src/components/ui/`
  - accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb,
    button, button-group, calendar, card, carousel, chart, checkbox, collapsible,
    combobox, command, context-menu, dialog, direction, drawer, dropdown-menu,
    empty, field, hover-card, input, input-group, input-otp, item, kbd, label,
    menubar, native-select, navigation-menu, pagination, popover, progress,
    radio-group, resizable, scroll-area, select, separator, sheet, sidebar,
    skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle,
    toggle-group, tooltip
- `use-mobile` hook in `src/hooks/`
- `cn()` utility helper in `src/lib/utils.ts`
- Single package entry point at `src/index.ts` — re-exports all components, hooks and utilities
- Tailwind CSS v4 configured via `@tailwindcss/vite` plugin
- Figma-driven token workflow: drop a new `src/figma.css` export to update the entire theme
- Light and dark mode tokens (`.dark` class-based)
- Source Sans 3 variable font (`@fontsource-variable/source-sans-3`)
- Geist Mono variable font (`@fontsource-variable/geist-mono`)
- Vite library mode build outputting `dist/index.js` (ESM, all dependencies externalized)
- TypeScript declarations emitted to `dist/types/` via `tsconfig.build.json`
- CSS theme exported as `@surfnet/sds-ng/styles.css`
- `package.json` configured with `exports`, `peerDependencies` (react, react-dom, tailwindcss) and `files`
