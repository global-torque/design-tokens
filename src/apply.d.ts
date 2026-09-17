/* Runtime rebrand: the guard rails around a published brand document, and the write onto the page. */

/** A document that passed the rules: the entries to write, and a logo for a later step. */
export interface BrandDocument {
  readonly tokens: ReadonlyMap<string, string>;
  readonly logoUrl: string | null;
}

/**
 * The absolute origins a `logoUrl` may point at, for example
 * `[location.origin, filerOrigin]`. The first is also the base a relative
 * `logoUrl` resolves against; a caller that supplies none allows no logo at all.
 */
export interface ParseOptions {
  readonly origins: readonly string[];
}

/**
 * Returns the entries to write and the validated logo, or `null` when the value
 * is not a brand document at all. An entry that fails the rules is dropped and
 * the rest of the document still applies. Total: it reads no DOM, performs no
 * fetch, reads no environment, and never throws.
 */
export declare function parseBrandDocument(
  value: unknown,
  options: ParseOptions,
): BrandDocument | null;

/**
 * Writes one set of custom properties on `root`, which defaults to
 * `document.documentElement`: every entry of the map, plus the steps
 * `deriveBrand` returns when the map supplies a seed, with an explicit entry
 * beating the derived step it names. Returns whether anything was written, and
 * never throws.
 */
export declare function applyBrandDocument(
  brand: BrandDocument | null,
  root?: HTMLElement,
): boolean;
