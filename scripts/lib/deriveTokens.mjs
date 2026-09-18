import { applyEdits, modify, parse } from 'jsonc-parser';
import { ANCHORS, GENERATED_RAMPS, brandRamps } from './generate.mjs';

const hexToComponents = (hex) =>
  [1, 3, 5].map((offset) =>
    Number((parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(4)),
  );

/* A new step is inserted before the family's next higher step so the ramp
   reads in order; with no higher step it follows the family's last one. */
const insertionIndex = (names, family, step) => {
  const steps = names.map((name) =>
    name.startsWith(`${family}-`) ? Number(name.slice(family.length + 1)) : NaN,
  );
  const next = steps.findIndex((value) => value > Number(step));
  if (next >= 0) return next;
  const last = steps.reduce(
    (found, value, index) => (Number.isNaN(value) ? found : index),
    -1,
  );
  return last >= 0 ? last + 1 : names.length;
};

/**
 * Writes the color ramps derived from the brand seeds into the token source
 * text as ordinary tokens under primitive.color, editing only those entries so
 * the rest of the file keeps its formatting; an anchor step aliases its seed.
 * Applying it again changes nothing.
 */
export const applyBrandRamps = (text) => {
  const source = parse(text);
  const seeds = source?.primitive?.brand;
  if (!seeds || typeof seeds !== 'object') {
    throw new Error('primitive.brand is missing; nothing to derive.');
  }
  const ramps = brandRamps(
    Object.fromEntries(
      Object.entries(seeds)
        .filter(([name]) => !name.startsWith('$'))
        .map(([name, token]) => [name, token.$value]),
    ),
  );
  let result = text;
  for (const family of GENERATED_RAMPS) {
    for (const [step, hex] of Object.entries(ramps[family])) {
      const seedName = ANCHORS[family]?.[step];
      result = applyEdits(
        result,
        modify(
          result,
          ['primitive', 'color', `${family}-${step}`],
          seedName
            ? { $value: `{primitive.brand.${seedName}}` }
            : {
                $value: {
                  colorSpace: 'srgb',
                  components: hexToComponents(hex),
                },
              },
          {
            formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
            getInsertionIndex: (names) => insertionIndex(names, family, step),
          },
        ),
      );
    }
  }
  return result;
};
