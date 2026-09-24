/**
 * Neutral institutional design tokens generated from one DTCG 2025.10 source.
 *
 * @packageDocumentation
 */

/**
 * Resolved, deeply frozen neutral design tokens.
 *
 * Values are generated from the package's DTCG 2025.10 source. Use
 * `modes.light` or `modes.dark` explicitly; the runtime never detects a
 * preferred mode.
 *
 * @public
 */
export declare const designTokens: {
  readonly "modes": {
    readonly "dark": {
      readonly "component": {
        readonly "button": {
          readonly "disabled-background": "#343a40";
          readonly "disabled-foreground": "#a3a5a9";
          readonly "focus-ring": "#004fff";
          readonly "primary-background": "#004fff";
          readonly "primary-background-hover": "#bad0ff";
          readonly "primary-foreground": "#ffffff";
        };
        readonly "dialog": {
          readonly "background": "#1a202d";
          readonly "foreground": "#f8f9fa";
          readonly "overlay": "rgb(0 0 0 / 0.64)";
        };
        readonly "input": {
          readonly "border": "#495057";
        };
        readonly "toast": {
          readonly "negative-background": "#450a0a";
          readonly "negative-foreground": "#fca5a5";
          readonly "neutral-background": "#232730";
          readonly "neutral-foreground": "#ececed";
          readonly "positive-background": "#052e16";
          readonly "positive-foreground": "#86efac";
        };
      };
      readonly "semantic": {
        readonly "color": {
          readonly "accent-background": "#004fff";
          readonly "accent-background-hover": "#bad0ff";
          readonly "accent-foreground": "#ffffff";
          readonly "accent-secondary-background": "#3ddc97";
          readonly "accent-secondary-foreground": "#12161f";
          readonly "accent-subtle": "#243046";
          readonly "accent-subtle-foreground": "#f0f4ff";
          readonly "background-canvas": "#12161f";
          readonly "background-elevated": "#1a202d";
          readonly "background-overlay": "rgb(0 0 0 / 0.64)";
          readonly "background-sidebar": "#1a202d";
          readonly "background-subtle": "#343a40";
          readonly "background-surface": "#1a202d";
          readonly "border-default": "#343a40";
          readonly "border-focus": "#004fff";
          readonly "border-input": "#495057";
          readonly "chart-1": "#004fff";
          readonly "chart-2": "#3ddc97";
          readonly "chart-3": "#f1af32";
          readonly "chart-4": "#6f3dfd";
          readonly "chart-5": "#ff3b3b";
          readonly "foreground-default": "#f8f9fa";
          readonly "foreground-disabled": "#a3a5a9";
          readonly "foreground-muted": "#adb5bd";
          readonly "negative-background": "#450a0a";
          readonly "negative-border": "#fca5a5";
          readonly "negative-foreground": "#fca5a5";
          readonly "negative-solid": "#ff3b3b";
          readonly "negative-solid-foreground": "#ffffff";
          readonly "neutral-background": "#232730";
          readonly "neutral-foreground": "#ececed";
          readonly "positive-background": "#052e16";
          readonly "positive-border": "#86efac";
          readonly "positive-foreground": "#86efac";
          readonly "warning-background": "#451a03";
          readonly "warning-border": "#fde68a";
          readonly "warning-foreground": "#fde68a";
        };
      };
    };
    readonly "light": {
      readonly "component": {
        readonly "button": {
          readonly "disabled-background": "#f8f9fa";
          readonly "disabled-foreground": "#51555c";
          readonly "focus-ring": "#004fff";
          readonly "primary-background": "#004fff";
          readonly "primary-background-hover": "#0042d4";
          readonly "primary-foreground": "#ffffff";
        };
        readonly "dialog": {
          readonly "background": "#ffffff";
          readonly "foreground": "#12161f";
          readonly "overlay": "rgb(0 0 0 / 0.64)";
        };
        readonly "input": {
          readonly "border": "#dee2e6";
        };
        readonly "toast": {
          readonly "negative-background": "#fef2f2";
          readonly "negative-foreground": "#991b1b";
          readonly "neutral-background": "#fafafa";
          readonly "neutral-foreground": "#3b3f48";
          readonly "positive-background": "#ecfdf5";
          readonly "positive-foreground": "#166534";
        };
      };
      readonly "semantic": {
        readonly "color": {
          readonly "accent-background": "#004fff";
          readonly "accent-background-hover": "#0042d4";
          readonly "accent-foreground": "#ffffff";
          readonly "accent-secondary-background": "#3ddc97";
          readonly "accent-secondary-foreground": "#12161f";
          readonly "accent-subtle": "#f0f4ff";
          readonly "accent-subtle-foreground": "#004fff";
          readonly "background-canvas": "#ffffff";
          readonly "background-elevated": "#ffffff";
          readonly "background-overlay": "rgb(0 0 0 / 0.64)";
          readonly "background-sidebar": "#f8f9fa";
          readonly "background-subtle": "#f8f9fa";
          readonly "background-surface": "#ffffff";
          readonly "border-default": "#e9ecef";
          readonly "border-focus": "#004fff";
          readonly "border-input": "#dee2e6";
          readonly "chart-1": "#004fff";
          readonly "chart-2": "#3ddc97";
          readonly "chart-3": "#f1af32";
          readonly "chart-4": "#6f3dfd";
          readonly "chart-5": "#ff3b3b";
          readonly "foreground-default": "#12161f";
          readonly "foreground-disabled": "#51555c";
          readonly "foreground-muted": "#6c757d";
          readonly "negative-background": "#fef2f2";
          readonly "negative-border": "#991b1b";
          readonly "negative-foreground": "#991b1b";
          readonly "negative-solid": "#ff7070";
          readonly "negative-solid-foreground": "#ffffff";
          readonly "neutral-background": "#fafafa";
          readonly "neutral-foreground": "#3b3f48";
          readonly "positive-background": "#ecfdf5";
          readonly "positive-border": "#15803d";
          readonly "positive-foreground": "#166534";
          readonly "warning-background": "#fffbeb";
          readonly "warning-border": "#92400e";
          readonly "warning-foreground": "#92400e";
        };
      };
    };
  };
  readonly "primitive": {
    readonly "brand": {
      readonly "font-sans": "\"Avenir\", \"Avenir Next\", system-ui, \"Segoe UI\", \"Roboto\", \"Helvetica Neue\", \"Arial\", sans-serif";
      readonly "primary": "#004fff";
      readonly "primary-foreground": "#ffffff";
      readonly "radius": "0.5rem";
      readonly "secondary": "#3ddc97";
      readonly "secondary-foreground": "#12161f";
      readonly "surface-dark": "#12161f";
      readonly "surface-light": "#ffffff";
      readonly "tertiary": "#5b55d6";
      readonly "tertiary-foreground": "#ffffff";
    };
    readonly "color": {
      readonly "amber-200": "#fde68a";
      readonly "amber-50": "#fffbeb";
      readonly "amber-800": "#92400e";
      readonly "amber-950": "#451a03";
      readonly "azure-tint-100": "rgb(235 243 255 / 0.34)";
      readonly "azure-tint-200": "rgb(207 219 255 / 0.34)";
      readonly "blue-500": "#3b82f6";
      readonly "charcoal-500": "#333333";
      readonly "chartreuse-500": "#a6cd0c";
      readonly "citrine-300": "#d8d4a5";
      readonly "citrine-50": "#fffdeb";
      readonly "citrine-500": "#eec32d";
      readonly "citrine-800": "#625d21";
      readonly "coral-500": "#ff5252";
      readonly "emerald-500": "#10b981";
      readonly "gold-400": "#ffc24d";
      readonly "gold-50": "#fff7e8";
      readonly "gold-500": "#f1af32";
      readonly "grape-50": "#f8f5ff";
      readonly "grape-500": "#6f3dfd";
      readonly "grape-700": "#5014d0";
      readonly "green-300": "#86efac";
      readonly "green-50": "#ecfdf5";
      readonly "green-700": "#15803d";
      readonly "green-800": "#166534";
      readonly "green-950": "#052e16";
      readonly "grey-100": "#f8f9fa";
      readonly "grey-200": "#e9ecef";
      readonly "grey-300": "#dee2e6";
      readonly "grey-400": "#ced4da";
      readonly "grey-500": "#adb5bd";
      readonly "grey-600": "#6c757d";
      readonly "grey-700": "#495057";
      readonly "grey-800": "#343a40";
      readonly "iris-tint": "rgb(68 79 229 / 0.1255)";
      readonly "jade-100": "#e7f8f1";
      readonly "jade-300": "#a9ddc9";
      readonly "jade-50": "#f1fbf7";
      readonly "jade-500": "#00d395";
      readonly "jade-600": "#2b9b71";
      readonly "jade-700": "#207655";
      readonly "mint-100": "#dff9ee";
      readonly "mint-500": "#3ddc97";
      readonly "mint-600": "#35bf83";
      readonly "navy-800": "#243046";
      readonly "navy-900": "#1a202d";
      readonly "neutral-100": "#ececed";
      readonly "neutral-25": "#ffffff";
      readonly "neutral-400": "#a3a5a9";
      readonly "neutral-450": "#9b9b9b";
      readonly "neutral-50": "#fafafa";
      readonly "neutral-500": "#757575";
      readonly "neutral-600": "#51555c";
      readonly "neutral-700": "#3b3f48";
      readonly "neutral-800": "#232730";
      readonly "neutral-950": "#12161f";
      readonly "overlay": "rgb(0 0 0 / 0.64)";
      readonly "primary-200": "#bad0ff";
      readonly "primary-50": "#f0f4ff";
      readonly "primary-500": "#004fff";
      readonly "primary-600": "#0042d4";
      readonly "primary-foreground": "#ffffff";
      readonly "red-300": "#fca5a5";
      readonly "red-50": "#fef2f2";
      readonly "red-500": "#ef4444";
      readonly "red-800": "#991b1b";
      readonly "red-950": "#450a0a";
      readonly "scarlet-300": "#efb2b2";
      readonly "scarlet-400": "#ff7070";
      readonly "scarlet-50": "#fff1f1";
      readonly "scarlet-500": "#ff3b3b";
      readonly "scarlet-600": "#cf3f3f";
      readonly "scarlet-700": "#c53030";
      readonly "scarlet-800": "#8e2626";
      readonly "scarlet-900": "#842b2b";
      readonly "scrim": "rgb(0 0 0 / 0.3)";
      readonly "secondary-100": "#dff9ee";
      readonly "secondary-50": "#f3fdf9";
      readonly "secondary-500": "#3ddc97";
      readonly "secondary-600": "#35bf83";
      readonly "secondary-foreground": "#12161f";
      readonly "slate-200": "#e2e8f0";
      readonly "slate-950": "#020618";
      readonly "steel-100": "#e2e6ef";
      readonly "steel-200": "#c8cbd0";
      readonly "steel-300": "#8790a1";
      readonly "steel-400": "#7b8495";
      readonly "steel-500": "#6b7589";
      readonly "steel-600": "#5d687d";
      readonly "steel-700": "#17233c";
      readonly "tertiary-100": "#efeefb";
      readonly "tertiary-200": "#deddf7";
      readonly "tertiary-300": "#ceccf3";
      readonly "tertiary-50": "#f5f5fd";
      readonly "tertiary-500": "#5b55d6";
      readonly "tertiary-600": "#524dc1";
      readonly "tertiary-800": "#322f76";
      readonly "tertiary-foreground": "#ffffff";
      readonly "white": "#ffffff";
      readonly "yellow-500": "#eab308";
    };
    readonly "duration": {
      readonly "fast": "120ms";
    };
    readonly "easing": {
      readonly "standard": "cubic-bezier(0.2, 0, 0, 1)";
    };
    readonly "font-family": {
      readonly "sans": "\"Avenir\", \"Avenir Next\", system-ui, \"Segoe UI\", \"Roboto\", \"Helvetica Neue\", \"Arial\", sans-serif";
    };
    readonly "font-size": {
      readonly "sm": "0.875rem";
    };
    readonly "font-weight": {
      readonly "medium": "500";
    };
    readonly "radius": {
      readonly "full": "9999px";
      readonly "md": "0.5rem";
    };
    readonly "shadow": {
      readonly "badge": "0px 2px 4px 0px rgb(0 0 0 / 0.15)";
      readonly "card": "0px 18px 50px 0px rgb(38 49 78 / 0.09)";
      readonly "md": "0px 4px 12px -2px rgb(15 23 42 / 0.12), 0px 2px 4px -1px rgb(15 23 42 / 0.08)";
      readonly "notice": "0px 2px 8px 0px rgb(0 0 0 / 0.1)";
      readonly "row": "0px 2px 5px -5px rgb(18 22 31 / 0.03), 0px 2px 3px -3px rgb(18 22 31 / 0.15)";
      readonly "sheet": "0px 25px 50px -12px rgb(0 0 0 / 0.25)";
      readonly "sm": "0px 1px 2px 0px rgb(15 23 42 / 0.12)";
    };
    readonly "spacing": {
      readonly "1": "0.25rem";
      readonly "2": "0.5rem";
      readonly "3": "0.75rem";
      readonly "4": "1rem";
    };
  };
};

/** The generated design-token object type. @public */
export type ResolvedDesignTokens = typeof designTokens;

/** Supported explicit color modes. @public */
export type DesignTokenMode = keyof ResolvedDesignTokens['modes'];

export default designTokens;
//# sourceMappingURL=index.d.ts.map
