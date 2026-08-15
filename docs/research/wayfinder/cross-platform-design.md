# Cross-Platform Design System and Component Strategy

- Status: resolved research for [GitHub issue 8](https://github.com/ralonsodeniz/personal-finance/issues/8)
- Date checked: 2026-08-15
- Scope: architecture research only; no application code is changed by this note.

## Question

How should the design system support a shadcn/ui-based Next.js web/PWA and a future React Native/Expo app? The comparison must cover shadcn/ui, NativeWind, Tamagui, gluestack-ui, React Native Reusables, and other worthwhile native or cross-platform options, including tokens, theming, accessibility, ownership, code generation/copying, styling performance, web/native parity, Expo compatibility, and maintenance. The decision must distinguish what is shared from what should be implemented separately.

## Assumptions and boundary

The parent Wayfinder map establishes these constraints:

- The TypeScript monorepo ships a mobile-first installable Next.js web/PWA first; an Expo/React Native app is later work.
- Shared packages should contain domain logic, contracts, validation, network/auth primitives, and design tokens. Web and native UI components may be platform-specific.
- This is a personal-finance product. Accessibility, readable dense data, forms, responsive layouts, light/dark themes, charts/tables, and safe keyboard/touch interactions matter more than pixel-identical rendering.
- No application implementation or native prototype exists yet. This note therefore recommends a durable boundary and a default path, not a final native dependency lockfile.
- Vendor performance claims are reported as vendor claims, not independent benchmarks. Version and support statements are snapshots and must be rechecked before the native app starts.

## Compared options

| Option | Web-first fit | Native/Expo fit | Ownership and generation | Parity and maintenance assessment |
| --- | --- | --- | --- | --- |
| [shadcn/ui](https://ui.shadcn.com/docs) | Strong. Its current installation flow explicitly supports Next.js, and its model is code distribution rather than a runtime component package. | Not a React Native component system. | Strong ownership: the CLI or copy/paste flow puts component source in the project; the CLI also has monorepo support and registries. | Best default for the Next.js app. Its CSS-variable themes and accessible web primitives are useful references, but its DOM/component contracts should not be forced onto native. |
| [NativeWind](https://www.nativewind.dev/docs) | Useful only when a Next.js app is already configured around React Native Web; its Next.js guide says RSC support is still in progress. | Good Expo path in the v4 documentation. NativeWind is a styling library, not a component library. | Shares a `className`/Tailwind authoring language and compiles native styles, but it does not provide component ownership or accessible behavior. | A practical native styling engine, not the design-system decision. The v5 documentation is explicitly pre-release and not for production; do not make v5 a current foundation. |
| [Tamagui](https://tamagui.dev/docs/intro/introduction) | Viable. It has a Next.js guide, SSR theme support, a web runtime, and an optional optimizing compiler. | Strong. It has an Expo Native + Web guide and is designed around universal React. | A shared component/design-system package can be owned by the application, but it depends on Tamagui conventions, configuration, compiler/bundler integration, and optional native integrations. | Highest potential code sharing. It also introduces the most up-front universal-stack complexity for a product whose native app is not yet being built. |
| [gluestack-ui](https://gluestack.io/ui/docs/home/overview/introduction) | Mixed. The introduction describes React, Next.js, and React Native components, but the current v5 installation page says v5 does not support Next.js and points Next.js users to v4. | Strong in its current v5 installation path for Expo/React Native, using NativeWind v5 or UniWind. | Copy/paste ownership, a CLI, semantic tokens, and accessibility guidance are attractive. | Not a safe default while the official docs have a material v5/Next.js contradiction and v5 depends on a NativeWind v5 track that is documented as pre-release. Re-evaluate only after both support claims are reconciled. |
| [React Native Reusables](https://reactnativereusables.com/docs) | Web support exists through React Native Web, but the project is native-first and documents native-specific constraints. | Strong. The CLI scaffolds Expo projects and supports NativeWind or UniWind. | Excellent ownership fit: it brings the shadcn copy/paste model to React Native, uses a registry/CLI, and is built on accessible, style-agnostic RN primitives. | Best native starting point for this map, provided the team accepts a separate native component package and maintains token/theme adapters. Its docs explicitly call out portals, no cascading styles, and no data attributes as parity limits. |
| [Uniwind](https://docs.uniwind.dev/) | A styling engine, not a full component system. Its value is strongest in the future Expo app. | Promising Expo/React Native/Tailwind v4 option; Expo’s own Tailwind guide lists it as a universal-support option. | Similar `className` vocabulary and CSS-first theme direction can reduce adapter work, but it is younger than the conservative NativeWind v4 path and its performance comparisons are vendor benchmarks. | Keep as a native-start candidate, especially if Tailwind v4 alignment is important. Do not make its claims the reason to share component code. |
| [@expo/ui universal components](https://docs.expo.dev/versions/latest/sdk/ui/universal/) | Not a Next.js design-system foundation; it is an Expo package with web implementations/fallbacks. | Useful for a limited set of native-feeling controls: buttons, inputs, pickers, lists, sheets, and similar primitives. | First-party Expo integration and native platform delegation, but not a full branded component library. | A good escape hatch for platform-native controls, not the base system for a custom finance UI that must also serve a Next.js web product. |
| [React Native Paper](https://callstack.github.io/react-native-paper/docs/) | Native-first and not a natural source for the Next.js web UI. | Mature Expo-compatible native option. | Provider-based theming and a ready-made component kit; ownership is library-mediated rather than shadcn-style copied source. | Worth considering only if Material Design 3 is the product direction. Its theme model and visual language create unnecessary constraints for this web-first, custom system. |
| [React Native Web](https://necolas.github.io/react-native-web/docs/) | A compatibility layer that can be incrementally adopted in a web app. | The web side of a universal RN stack, not a design system by itself. | Gives a common React Native component API and semantic/ARIA mappings, but its compatibility table documents platform gaps. | Useful infrastructure for Expo and native components that also render on web; it does not eliminate the need for platform-specific components or accessibility tests. |

## Findings by decision criterion

### Shared tokens should be the durable seam

Use a vendor-neutral token source in a shared package. The [Design Tokens Community Group’s 2025.10 format](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/) is a stable exchange format, although the report correctly states that it is not a W3C Standard. It gives the monorepo a portable representation without making Tailwind, NativeWind, Tamagui, or gluestack the owner of the product’s visual vocabulary.

The token source should distinguish:

- Primitive values: raw color palette, typefaces, font sizes, spacing, radii, elevations, motion durations, and breakpoints.
- Semantic roles: `background`, `foreground`, `surface`, `surface-foreground`, `primary`, `primary-foreground`, `muted`, `muted-foreground`, `destructive`, `border`, `input`, and `focus-ring`.
- Component decisions: button height, input density, table row height, chart palette, and interaction states. These are recipes consumed by each platform package, not universal raw tokens.

This naming is intentionally compatible with the semantic conventions documented by [shadcn/ui](https://ui.shadcn.com/docs/theming), [gluestack-ui](https://gluestack.io/ui/docs/home/theme-configuration/default-tokens), and [React Native Reusables](https://reactnativereusables.com/docs/customization), but the shared source must remain independent of their file formats.

Generate platform adapters from that source:

- Web: CSS custom properties and Tailwind theme exposure for the owned shadcn components.
- Native: a typed theme object and the chosen styling engine’s variables/configuration. If React Native Reusables is selected, generate both its CSS-variable input and its `theme.ts` equivalent rather than editing two values by hand; its documentation currently says those files must otherwise be kept in sync manually.
- Optional future universal path: a Tamagui token/theme adapter, only if the native spike selects Tamagui.

Do not put Tailwind class strings, DOM selectors, React Native props, or vendor-specific component APIs in the canonical token file. Those are platform adapters and recipes.

### Theming is portable; theme mechanics are not

The web and native apps should share theme names and semantic intent—at minimum `light`, `dark`, and `system`—but not assume the same mechanism. shadcn/ui recommends semantic CSS variables and overrides the same variables under `.dark`. NativeWind maps system appearance to native appearance APIs and web `prefers-color-scheme`; its docs also document a manual selection API. Tamagui maps themes to CSS variables on web and nested runtime themes across its tree. These are compatible concepts, not interchangeable implementations.

The shared contract should therefore define:

- theme mode and persistence behavior;
- semantic role names and required contrast relationships;
- state names such as default, hover, focus, pressed, disabled, selected, invalid, loading, and destructive;
- a small set of component variant names.

Each platform maps those states to its own interaction model. For example, hover is meaningful on web and some pointer-capable native surfaces, while press, focus, safe-area behavior, keyboard avoidance, and system back are native concerns.

### Accessibility argues for separate primitives

The web and native accessibility trees are not the same. Radix’s [accessibility guidance](https://www.radix-ui.com/primitives/docs/overview/accessibility) and shadcn’s use of accessible web primitives are a good web baseline, but the product still has to test semantic HTML, keyboard order, focus restoration, announcements, and screen-reader behavior in the actual Next.js UI.

React Native’s [accessibility documentation](https://reactnative.dev/docs/accessibility) explicitly notes that Android and iOS differ. React Native Web adds ARIA and semantic HTML mappings, but its [compatibility table](https://necolas.github.io/react-native-web/docs/react-native-compatibility/) lists APIs that are partial or unavailable on web. React Native Reusables likewise documents that native portals need a `PortalHost`, child text does not inherit styles like web text, and native does not have data attributes.

These differences make a single JSX component source a poor default for dialogs, menus, popovers, date pickers, tables, charts, focus traps, navigation, and keyboard/gesture interactions. Share the semantic contract and test intent; implement and test the platform primitive separately.

### Code ownership favors shadcn/ui plus React Native Reusables

For a product-specific finance UI, copied source is valuable: the team can change behavior, audit accessibility, remove dependencies, and keep a stable API when an upstream library changes. shadcn/ui describes this as “open code” and provides a CLI/registry model; React Native Reusables follows the same approach and its CLI is built around the shadcn distribution model. gluestack-ui also offers copy/paste ownership, but its current v5 support boundary is not suitable as the default here.

The cost is deliberate ownership: upstream updates become diffs to review, and the two platform packages can drift. That cost is preferable to pretending that DOM and native primitives have the same semantics when the product’s accessibility and data-entry behavior depend on the difference.

### Styling performance is not a reason to share components

NativeWind documents build-time compilation to native `StyleSheet.create` objects and a web path that reuses Tailwind CSS. It also documents real differences: web/native units, flex defaults, text inheritance, and platform modifiers. NativeWind v5’s official documentation is marked pre-release and “not intended for production use,” so the current recommendation cannot depend on it.

Tamagui’s compiler can extract and flatten styles for web and native, and its documentation provides both Next.js and Expo setups. That is a real advantage if one universal component tree is a measured requirement, but it also adds compiler, configuration, SSR, and bundler integration to the first web app.

Uniwind is a credible future Tailwind v4 candidate, but its speed comparisons are vendor-produced benchmarks and it remains a styling layer rather than a component/accessibility system. Performance must be verified in the native spike with representative finance screens; it must not dictate the shared API boundary.

## Recommendation

Adopt a split design system with one token contract and two owned UI implementations:

1. **Web now: shadcn/ui in an owned `ui-web` package.** Use the Next.js setup, CSS-variable semantic themes, and the CLI/monorepo support. Copy the needed components into the repository, then treat them as product code. Keep DOM semantics, RSC boundaries, keyboard behavior, focus management, tables, charts, and web navigation native to the web app.

2. **Shared now: a vendor-neutral `design-tokens` package.** Store DTCG-compatible source tokens and generate web CSS/Tailwind variables plus a typed native theme adapter. Share semantic names, theme modes, state vocabulary, variant intent, typography decisions, and contrast/accessibility requirements—not component JSX or Tailwind class strings.

3. **Native later: default to React Native Reusables plus accessible RN primitives.** It matches the desired code-ownership model, is Expo-oriented, has a familiar shadcn-like workflow, and explicitly exposes the native differences that the architecture should acknowledge. At the native-start checkpoint, use NativeWind v4 as the conservative baseline, or run a bounded comparison with Uniwind if Tailwind v4 alignment matters more than the lower-risk established setup. Do not use NativeWind v5 as a production assumption while its official docs still label it pre-release.

4. **Keep Tamagui as the alternative for a universal-component requirement.** Select it only if the native spike demonstrates that the team truly needs one component implementation across web and native and accepts its compiler/configuration model. It is the strongest candidate for that requirement, but not the best default for a web-first product whose native app is deferred.

5. **Do not choose gluestack-ui v5 as the current backbone.** Reconsider it after its official Next.js support statement and NativeWind v5 dependency are resolved. The current official pages make incompatible claims about v5’s Next.js support, which is itself a maintenance risk.

6. **Use `@expo/ui` selectively** for controls where native platform behavior is more valuable than brand parity—such as a native picker or date/time control. It is not a replacement for the product’s branded web/native component packages.

Recommended ownership shape:

```text
packages/design-tokens/   # canonical tokens, semantic roles, generated adapters
packages/ui-web/          # copied shadcn components and web-only recipes
apps/web/                 # Next.js/PWA pages and web composition
packages/ui-native/       # future copied RN Reusables components and native recipes
apps/mobile/              # future Expo app
```

The shared package may also hold component-state fixtures and cross-platform visual/accessibility acceptance data. It should not export a fake universal `Button` whose prop contract hides platform-specific behavior; `ui-web/Button` and `ui-native/Button` can have aligned intent and different implementation contracts.

## Tradeoffs

### Benefits

- The first app uses a mature web-native component model without paying for a native runtime or universal compiler prematurely.
- Accessibility follows the platform’s actual semantics instead of a lowest-common-denominator abstraction.
- The product owns high-value components and can remove or replace vendors without rewriting the domain layer.
- Token parity, theme parity, and state vocabulary are explicit and testable.
- The native app can still choose Tamagui, NativeWind, or Uniwind at a measured checkpoint without invalidating domain packages or the visual vocabulary.

### Costs

- Buttons, dialogs, forms, navigation, tables, charts, and overlays will be implemented and tested twice.
- Token adapters need generation and drift checks, especially if the web and native styling engines use different Tailwind generations.
- “Same component” cannot mean “same pixels”; it means same intent, content, state, and accessibility outcome where the platforms support that outcome.
- A future switch to Tamagui would require an adapter and component migration rather than a drop-in replacement.

## Unresolved follow-ups

These do not block closing the research ticket, but they should be resolved before native implementation begins:

1. Run a small Expo spike comparing React Native Reusables + NativeWind v4, React Native Reusables + Uniwind, and Tamagui. Use representative finance flows: form validation, currency input, modal/menu, settings, dense list/table, chart, dark mode, keyboard navigation/focus, VoiceOver/TalkBack, and web rendering.
2. Choose and pin the native styling engine after the Expo SDK and React Native versions are known. Re-check NativeWind v5 and gluestack-ui v5 support at that time.
3. Define the generated token pipeline and drift checks. Decide whether the repository should emit DTCG JSON only, or also commit generated CSS/TypeScript artifacts.
4. Define the platform component inventory and the explicit exceptions to parity: tables, charts, date/time controls, menus, dialogs, navigation, safe-area layouts, keyboard avoidance, and gestures.
5. Establish the accessibility matrix and CI gates for web keyboard/screen readers plus iOS VoiceOver and Android TalkBack.
6. Decide which controls, if any, should use `@expo/ui` native implementations instead of the custom native package.

## Direct sources checked

All sources below are first-party documentation, specifications, or the project’s own official repository. Checked 2026-08-15.

### Project context

- [Wayfinder map issue 1](https://github.com/ralonsodeniz/personal-finance/issues/1)
- [Research issue 8](https://github.com/ralonsodeniz/personal-finance/issues/8)

### Tokens and web

- [Design Tokens Format Module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)
- [shadcn/ui introduction](https://ui.shadcn.com/docs)
- [shadcn/ui installation and supported frameworks](https://ui.shadcn.com/docs/installation)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui components.json](https://ui.shadcn.com/docs/components-json)
- [shadcn/ui monorepo support](https://ui.shadcn.com/docs/monorepo)
- [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)

### Native and universal styling

- [NativeWind overview](https://www.nativewind.dev/docs)
- [NativeWind Expo installation](https://www.nativewind.dev/docs/getting-started/installation)
- [NativeWind Next.js installation](https://www.nativewind.dev/docs/getting-started/installation/nextjs)
- [NativeWind platform differences](https://www.nativewind.dev/docs/core-concepts/differences)
- [NativeWind states and pseudo-classes](https://www.nativewind.dev/docs/core-concepts/states)
- [NativeWind dark mode](https://www.nativewind.dev/docs/core-concepts/dark-mode)
- [NativeWind v5 pre-release overview](https://www.nativewind.dev/v5)
- [Tamagui introduction](https://tamagui.dev/docs/intro/introduction)
- [Tamagui compiler](https://tamagui.dev/docs/intro/compiler-install)
- [Tamagui themes](https://tamagui.dev/docs/intro/themes)
- [Tamagui Next.js guide](https://tamagui.dev/docs/guides/next-js)
- [Tamagui Expo guide](https://tamagui.dev/docs/guides/expo)
- [Tamagui design systems](https://tamagui.dev/docs/guides/design-systems)
- [Uniwind introduction](https://docs.uniwind.dev/)
- [Expo Tailwind guide](https://docs.expo.dev/guides/tailwind/)

### Native component systems and platform constraints

- [React Native Reusables introduction](https://reactnativereusables.com/docs)
- [React Native Reusables customization and theme mirroring](https://reactnativereusables.com/docs/customization)
- [React Native Reusables manual Expo installation](https://reactnativereusables.com/docs/installation/manual)
- [React Native Reusables custom registries](https://reactnativereusables.com/docs/create-your-own-registry)
- [RN Primitives official repository](https://github.com/roninoss/rn-primitives)
- [gluestack-ui introduction](https://gluestack.io/ui/docs/home/overview/introduction)
- [gluestack-ui v5 installation and Next.js support note](https://gluestack.io/ui/docs/home/getting-started/installation)
- [gluestack-ui universal components](https://gluestack.io/ui/docs/home/core-concepts/universal)
- [gluestack-ui accessibility](https://gluestack.io/ui/docs/home/core-concepts/accessibility)
- [gluestack-ui default tokens](https://gluestack.io/ui/docs/home/theme-configuration/default-tokens)
- [Expo universal UI](https://docs.expo.dev/versions/latest/sdk/ui/universal/)
- [Expo web development](https://docs.expo.dev/workflow/web/)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
- [React Native platform-specific code](https://reactnative.dev/docs/platform-specific-code)
- [React Native Web accessibility](https://necolas.github.io/react-native-web/docs/accessibility/)
- [React Native Web compatibility](https://necolas.github.io/react-native-web/docs/react-native-compatibility/)
- [React Native Web multi-platform setup](https://necolas.github.io/react-native-web/docs/multi-platform/)
- [React Native Paper theming](https://callstack.github.io/react-native-paper/docs/guides/theming-with-react-navigation)

