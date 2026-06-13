# @surfnet/sds-ng

The SURFnet Design System — a React component library built
on [shadcn](https://ui.shadcn.com), [Tailwind CSS v4](https://tailwindcss.com) and [Radix UI](https://www.radix-ui.com).
It provides a complete set of accessible, themeable UI components that reflect SURFnet's visual identity, with design
tokens driven directly from Figma exports.

[![npm version](https://img.shields.io/npm/v/@surfnet/sds-ng)](https://www.npmjs.com/package/@surfnet/sds-ng)
[![license](https://img.shields.io/npm/l/@surfnet/sds-ng)](./LICENSE)

---

## Installation

```bash
npm install @surfnet/sds-ng
```

### Peer dependencies

The following must be installed in the consuming project:

| Package       | Version        |
|---------------|----------------|
| `react`       | `^18` or `^19` |
| `react-dom`   | `^18` or `^19` |
| `tailwindcss` | `^4`           |
| `@tanstack/react-table` | `^8`           |

```bash
yarn install react react-dom tailwindcss @tanstack/react-table
```

---

## Setup

### 1. Import the styles

In your application's root CSS file, import the design system styles. This must come after your Tailwind import so that
the design tokens take effect.

```css
@import "tailwindcss";
@import "@surfnet/sds-ng/styles.css";
```

### 2. Configure Tailwind to scan the package source

Tailwind needs to scan `@surfnet/sds-ng` source files to include the component class names in the output CSS. Add the
following to your Tailwind config or root CSS:

```css
@source "../../node_modules/@surfnet/sds-ng/dist";
```

Or if you are using a `tailwind.config.ts`:

```ts
export default {
    content: [
        './src/**/*.{ts,tsx}',
        './node_modules/@surfnet/sds-ng/dist/**/*.js',
    ],
}
```

### 3. Set up dark mode (optional)

Dark mode is toggled by adding the `.dark` class to the `<html>` element. A library
like [next-themes](https://github.com/pacocoursey/next-themes) handles this automatically.

```tsx
// Wrap your app at the root
import {ThemeProvider} from 'next-themes'

export default function App({children}) {
    return (
        <ThemeProvider attribute="class">
            {children}
        </ThemeProvider>
    )
}
```

---

## Usage

Import any component directly from the package:

```tsx
import {Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle} from '@surfnet/sds-ng'

export function Example() {
    return (
        <div>
            <Input placeholder="Your email"/>
            <Button>Subscribe</Button>
        </div>
    )
}
```

All components are fully typed — TypeScript autocomplete works out of the box.

---

## Theming

Design tokens are driven by Figma. The file `src/figma.css` contains the exported variables for light and dark mode, as
well as the Tailwind `@theme` mapping.

**To update the theme with a new Figma export:**

1. Export the variables from Figma (using the shadcn Variables plugin or equivalent)
2. Replace `src/figma.css` with the new export
3. Run `yarn build`

No other changes are needed. The import order in `src/index.css` ensures `figma.css` always overrides the shadcn
defaults:

```css
@import "shadcn/tailwind.css";
/* shadcn defaults */
@import "./figma.css"; /* Figma tokens — always wins */
```

### Fonts

The design system ships two variable fonts, loaded automatically when you import the styles:

| Font                                                             | Usage                              |
|------------------------------------------------------------------|------------------------------------|
| [Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3) | `--font-sans` — body and UI text   |
| [Geist Mono](https://vercel.com/font)                            | `--font-mono` — code and monospace |

---

## CSS override strategy

shadcn component files in `src/components/ui/` are **owned source code** — they are not managed by a package manager.
Visual customisations should never be made by editing those files directly, because they will be lost the next time a
component is updated from upstream (see [Updating a shadcn component](#updating-a-shadcn-component-from-upstream)).

Instead, use the following layered approach. Each layer has a clear responsibility and a defined priority.

### Layer 1 — Design tokens via Figma (preferred)

The first place to reach for any visual change is Figma. Colors, typography, radii, spacing tokens, and shadows are all
controlled through `src/figma.css`. Export from Figma and drop the file in — no component files need to change.

**Use this for:** brand colors, font families, border radii, shadow tokens, dark mode palette.

### Layer 2 — `@layer components` in `index.css`

For structural CSS changes that design tokens cannot express — padding adjustments, layout tweaks, default box-shadows —
add a `@layer components` block in `src/index.css`:

```css
@layer components {
    /* Increase default button height */
    [data-slot="button"] {
        @apply h-10;
    }

    /* Add focus ring offset to all inputs */
    [data-slot="input"] {
        @apply focus-visible:ring-offset-2;
    }
}
```

shadcn v4 components use `data-slot` attributes on their root elements (`data-slot="button"`, `data-slot="input"`,
`data-slot="checkbox"`, etc.) specifically to support this targeting pattern without needing to edit component source.

This block lives in `index.css`, after the Figma import, so it sits at the top of the cascade:

```css
@import "shadcn/tailwind.css";
/* shadcn base styles        — lowest priority */
@import "./figma.css";
/* design tokens             — overrides shadcn */
/* @layer components below   — highest priority */
@layer components {
    /* SDS structural overrides here */
}
```

**Use this for:** layout or structural changes that apply globally to a component type and cannot be expressed as a
token.

### Layer 3 — `className` prop at the callsite

For one-off overrides at point of use, pass a `className` prop. The `cn()` utility (backed by `tailwind-merge`) ensures
the passed classes win over the component defaults without specificity conflicts:

```tsx
import {Button, cn} from '@surfnet/sds-ng'

// Rounded pill button for a specific CTA
<
Button
className = "rounded-full px-8" > Get
started < /Button>

// Wider input in a specific form
<Input className="w-96"/>
```

**Use this for:** single-use deviations at a specific callsite, not systemic changes.

### What not to do

Do not edit `src/components/ui/*.tsx` for visual changes. The only acceptable direct edits to component files are *
*behavioural or structural** — adding a new prop, fixing an accessibility attribute, changing component composition.
When you do make such an edit, document it with a comment so it can be reapplied after an upstream update:

```tsx
// SDS: added `data-testid` prop support — reapply after upstream updates
function Button({dataTestId, ...props}) {
```

---

## Updating a shadcn component from upstream

shadcn components are copied into `src/components/ui/` at the time they are added. They are not auto-updated — upstream
changes must be pulled in deliberately. Follow this workflow:

### 1. Check what changed upstream

Before updating, review the diff. Check the [shadcn changelog](https://ui.shadcn.com/docs/changelog) or browse the
component source directly on the shadcn registry. Understand what changed structurally before overwriting.

### 2. Commit or stash your current state

```bash
git add src/components/ui/<name>.tsx
git commit -m "chore: snapshot <name> before upstream update"
```

This ensures you have a clean diff after the update.

### 3. Re-run the shadcn CLI with `--overwrite`

```bash
npx shadcn@latest add <component-name> --overwrite
```

This fully replaces the component file with the latest version from the shadcn registry. Any direct edits to the file
will be overwritten — this is expected.

### 4. Review the diff

```bash
git diff src/components/ui/<name>.tsx
```

Read the diff carefully. Look for:

- New props or variants that should be re-exported from `src/index.ts`
- Breaking changes to the component's API that affect consuming code
- Any behavioural edits you had previously documented (see [CSS override strategy](#css-override-strategy))

### 5. Re-apply any SDS behavioural edits

If the component had documented behavioural changes (not visual — those live in `index.css` or `figma.css`), re-apply
them now. This is the only manual step.

### 6. Update `src/index.ts` if needed

If the upstream update added new named exports, add them to `src/index.ts`:

```ts
// Before
export * from './components/ui/button'

// After (if buttonVariants is now a new export)
export * from './components/ui/button'  // already covers it via export *
```

Since `src/index.ts` uses `export *` for each component, new exports are picked up automatically. You only need to act
if a component was **renamed** or **split** into multiple files.

### 7. Build and test

```bash
yarn build
yarn dev
```

Verify the component renders correctly in the showcase (`src/App.tsx`) before publishing.

### Updating all components at once

To update every component in one pass:

```bash
npx shadcn@latest add --all --overwrite
```

Use with caution — review the full diff afterwards with `git diff src/components/ui/`.

---

## Components

All 55 components are available as named exports from `@surfnet/sds-ng`:

| Component       | Import name                                                          |
|-----------------|----------------------------------------------------------------------|
| Accordion       | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| Alert           | `Alert`, `AlertTitle`, `AlertDescription`                            |
| Alert Dialog    | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, …         |
| Aspect Ratio    | `AspectRatio`                                                        |
| Avatar          | `Avatar`, `AvatarImage`, `AvatarFallback`                            |
| Badge           | `Badge`                                                              |
| Breadcrumb      | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, …                  |
| Button          | `Button`                                                             |
| Button Group    | `ButtonGroup`                                                        |
| Calendar        | `Calendar`                                                           |
| Card            | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`       |
| Carousel        | `Carousel`, `CarouselContent`, `CarouselItem`, …                     |
| Chart           | `ChartContainer`, `ChartTooltip`, …                                  |
| Checkbox        | `Checkbox`                                                           |
| Collapsible     | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`            |
| Combobox        | `Combobox`                                                           |
| Command         | `Command`, `CommandInput`, `CommandList`, …                          |
| Context Menu    | `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, …         |
| Dialog          | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, …        |
| Direction       | `DirectionProvider`                                                  |
| Drawer          | `Drawer`, `DrawerTrigger`, `DrawerContent`, …                        |
| Dropdown Menu   | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, …      |
| Empty           | `Empty`                                                              |
| Field           | `Field`                                                              |
| Hover Card      | `HoverCard`, `HoverCardTrigger`, `HoverCardContent`                  |
| Input           | `Input`                                                              |
| Input Group     | `InputGroup`                                                         |
| Input OTP       | `InputOTP`, `InputOTPGroup`, `InputOTPSlot`                          |
| Item            | `Item`                                                               |
| Kbd             | `Kbd`                                                                |
| Label           | `Label`                                                              |
| Menubar         | `Menubar`, `MenubarMenu`, `MenubarTrigger`, …                        |
| Native Select   | `NativeSelect`                                                       |
| Navigation Menu | `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, …      |
| Pagination      | `Pagination`, `PaginationContent`, `PaginationItem`, …               |
| Popover         | `Popover`, `PopoverTrigger`, `PopoverContent`                        |
| Progress        | `Progress`                                                           |
| Radio Group     | `RadioGroup`, `RadioGroupItem`                                       |
| Resizable       | `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`           |
| Scroll Area     | `ScrollArea`, `ScrollBar`                                            |
| Select          | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, …          |
| Separator       | `Separator`                                                          |
| Sheet           | `Sheet`, `SheetTrigger`, `SheetContent`, …                           |
| Sidebar         | `Sidebar`, `SidebarProvider`, `SidebarTrigger`, …                    |
| Skeleton        | `Skeleton`                                                           |
| Slider          | `Slider`                                                             |
| Sonner          | `Toaster`                                                            |
| Spinner         | `Spinner`                                                            |
| Switch          | `Switch`                                                             |
| Table           | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, …      |
| Tabs            | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`                     |
| Textarea        | `Textarea`                                                           |
| Toggle          | `Toggle`                                                             |
| Toggle Group    | `ToggleGroup`, `ToggleGroupItem`                                     |
| Tooltip         | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`     |

### Utilities

```ts
import {cn} from '@surfnet/sds-ng'         // clsx + tailwind-merge helper
import {useIsMobile} from '@surfnet/sds-ng' // responsive mobile detection hook
```

---

## Contributing

### Prerequisites

- Node.js 20+
- npm 10+

### Development

```bash
# Install dependencies
yarn install

# Start the Vite dev server (for testing in a sandbox app)
yarn dev

# Build the library (JS + type declarations)
yarn build

# Build JS only
yarn build:js

# Build type declarations only
yarn build:types

# Lint
yarn lint
```

### Adding a new shadcn component

```bash
npx shadcn@latest add <component-name>
```

Components are written directly to `src/components/ui/` (aliases are configured in `components.json`). After adding,
export the new component from `src/index.ts`.

### Project structure

```
src/
  components/
    ui/          # shadcn components
  hooks/         # shared hooks
  lib/
    utils.ts     # cn() helper
  index.ts       # package entry point — re-exports everything
  index.css      # base styles, font imports, Figma import
  figma.css      # Figma token export — replace to update theme
dist/            # build output (not committed)
  index.js       # ESM bundle
  style.css      # compiled CSS
  types/         # TypeScript declarations
```

---

## Publishing

```bash
# Bump the version in package.json first, then:
yarn build
npm login
npm publish --access public
```

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

## License

MIT — see [LICENSE](./LICENSE)
