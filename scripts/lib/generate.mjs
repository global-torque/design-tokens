import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  GenMapping,
  addSegment,
  setSourceContent,
  toEncodedMap,
} from '@jridgewell/gen-mapping';
import { findNodeAtLocation, parseTree } from 'jsonc-parser';
import { BRAND_MIXES, deriveBrand } from '../../src/derive.mjs';

/* The derivation ships verbatim, so a runtime rebrand computes the same ramps. */
const deriveModule = fs.readFileSync(
  new URL('../../src/derive.mjs', import.meta.url),
  'utf8',
);
const deriveDeclaration = fs.readFileSync(
  new URL('../../src/derive.d.ts', import.meta.url),
  'utf8',
);

const TOKEN_REFERENCE = /^\{([^{}]+)\}$/;
const KNOWN_TYPES = new Set([
  'color',
  'cubicBezier',
  'dimension',
  'duration',
  'fontFamily',
  'fontWeight',
  'shadow',
]);
const GROUP_PROPERTIES = new Set([
  '$deprecated',
  '$description',
  '$extensions',
  '$type',
]);
const TOKEN_PROPERTIES = new Set([
  '$deprecated',
  '$description',
  '$extensions',
  '$type',
  '$value',
]);

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const clone = (value) => {
  if (Array.isArray(value)) {
    return value.map(clone);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, clone(child)]),
    );
  }
  return value;
};

const compareCodePoints = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

const sortedEntries = (value) =>
  Object.entries(value).sort(([left], [right]) =>
    compareCodePoints(left, right),
  );

const createDictionary = () => Object.create(null);

const defineData = (target, key, value) => {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
};

const setPath = (root, path, value) => {
  let current = root;
  for (const segment of path.slice(0, -1)) {
    const next = Object.hasOwn(current, segment) ? current[segment] : undefined;
    if (!isRecord(next)) {
      defineData(current, segment, createDictionary());
    }
    current = current[segment];
  }
  defineData(current, path.at(-1), value);
};

const validateName = (name, path) => {
  if (
    name.length === 0 ||
    name.startsWith('$') ||
    /[.{}]/u.test(name) ||
    !/^[\p{L}\p{N}_-]+$/u.test(name)
  ) {
    throw new Error(
      `Invalid DTCG token/group name ${JSON.stringify(name)} at ${path || '<root>'}.`,
    );
  }
};

const assertFiniteNumber = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
};

const assertObjectKeys = (value, allowedKeys, label) => {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label}.${key} is not supported.`);
    }
  }
};

const validateDimension = (value, label) => {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a DTCG dimension object.`);
  }
  assertObjectKeys(value, ['unit', 'value'], label);
  assertFiniteNumber(value.value, `${label}.value`);
  if (!['px', 'rem'].includes(value.unit)) {
    throw new Error(`${label}.unit must be px or rem.`);
  }
};

const validateColor = (value, label) => {
  if (!isRecord(value) || value.colorSpace !== 'srgb') {
    throw new Error(`${label} must be an sRGB DTCG color object.`);
  }
  assertObjectKeys(value, ['alpha', 'colorSpace', 'components'], label);
  if (!Array.isArray(value.components) || value.components.length !== 3) {
    throw new Error(`${label}.components must contain three channels.`);
  }
  for (const [index, component] of value.components.entries()) {
    assertFiniteNumber(component, `${label}.components[${index}]`);
    if (component < 0 || component > 1) {
      throw new Error(`${label}.components[${index}] must be between 0 and 1.`);
    }
  }
  if (value.alpha !== undefined) {
    assertFiniteNumber(value.alpha, `${label}.alpha`);
    if (value.alpha < 0 || value.alpha > 1) {
      throw new Error(`${label}.alpha must be between 0 and 1.`);
    }
  }
};

const validateShadow = (value, label) => {
  const shadows = Array.isArray(value) ? value : [value];
  if (shadows.length === 0) {
    throw new Error(`${label} must contain at least one shadow.`);
  }
  for (const [index, shadow] of shadows.entries()) {
    const shadowLabel = `${label}[${index}]`;
    if (!isRecord(shadow)) {
      throw new Error(`${shadowLabel} must be an object.`);
    }
    const allowedFields = [
      'blur',
      'color',
      'inset',
      'offsetX',
      'offsetY',
      'spread',
    ];
    assertObjectKeys(shadow, allowedFields, shadowLabel);
    if (shadow.inset !== undefined && typeof shadow.inset !== 'boolean') {
      throw new Error(`${shadowLabel}.inset must be a boolean.`);
    }
    validateColor(shadow.color, `${shadowLabel}.color`);
    for (const field of ['offsetX', 'offsetY', 'blur', 'spread']) {
      validateDimension(shadow[field], `${shadowLabel}.${field}`);
    }
  }
};

const validateTypedValue = (type, value, label) => {
  switch (type) {
    case 'color':
      validateColor(value, label);
      return;
    case 'dimension':
      validateDimension(value, label);
      return;
    case 'fontFamily':
      if (!(
        (typeof value === 'string' && value.length > 0) ||
        (Array.isArray(value) &&
          value.length > 0 &&
          value.every((item) => typeof item === 'string' && item.length > 0))
      )) {
        throw new Error(`${label} must be a non-empty font family value.`);
      }
      return;
    case 'fontWeight':
      if (!(
        (typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 1000) ||
        [
          'thin',
          'hairline',
          'extra-light',
          'ultra-light',
          'light',
          'normal',
          'regular',
          'book',
          'medium',
          'semi-bold',
          'demi-bold',
          'bold',
          'extra-bold',
          'ultra-bold',
          'black',
          'heavy',
          'extra-black',
          'ultra-black',
        ].includes(value)
      )) {
        throw new Error(`${label} must be a valid DTCG font weight.`);
      }
      return;
    case 'duration':
      if (!isRecord(value)) {
        throw new Error(`${label} must be a DTCG duration object.`);
      }
      assertObjectKeys(value, ['unit', 'value'], label);
      assertFiniteNumber(value.value, `${label}.value`);
      if (value.value < 0 || !['ms', 's'].includes(value.unit)) {
        throw new Error(`${label} must use a non-negative ms or s duration.`);
      }
      return;
    case 'cubicBezier':
      if (!Array.isArray(value) || value.length !== 4) {
        throw new Error(`${label} must contain four cubic Bézier coordinates.`);
      }
      value.forEach((coordinate, index) =>
        assertFiniteNumber(coordinate, `${label}[${index}]`),
      );
      if (value[0] < 0 || value[0] > 1 || value[2] < 0 || value[2] > 1) {
        throw new Error(`${label} x coordinates must be between 0 and 1.`);
      }
      return;
    case 'shadow':
      validateShadow(value, label);
      return;
    default:
      throw new Error(`Unsupported DTCG type ${String(type)} at ${label}.`);
  }
};

const collectTokens = (source) => {
  if (!isRecord(source)) {
    throw new Error('The DTCG source must be a JSON object.');
  }

  const tokens = new Map();
  const visitGroup = (group, path, inheritedType) => {
    if (!isRecord(group) || '$value' in group) {
      throw new Error(
        `Expected a DTCG group at ${path.join('.') || '<root>'}.`,
      );
    }
    for (const property of Object.keys(group).filter((key) =>
      key.startsWith('$'),
    )) {
      if (!GROUP_PROPERTIES.has(property)) {
        throw new Error(
          `Unsupported group property ${property} at ${path.join('.') || '<root>'}.`,
        );
      }
    }
    const groupType = group.$type ?? inheritedType;
    if (groupType !== undefined && !KNOWN_TYPES.has(groupType)) {
      throw new Error(
        `Unknown DTCG type ${String(groupType)} at ${path.join('.') || '<root>'}.`,
      );
    }

    for (const [name, child] of sortedEntries(group)) {
      if (name.startsWith('$')) continue;
      validateName(name, path.join('.'));
      const childPath = [...path, name];
      if (!isRecord(child)) {
        throw new Error(`DTCG entry ${childPath.join('.')} must be an object.`);
      }
      if ('$value' in child) {
        for (const property of Object.keys(child)) {
          if (!property.startsWith('$') || !TOKEN_PROPERTIES.has(property)) {
            throw new Error(
              `Token ${childPath.join('.')} contains unsupported property ${property}.`,
            );
          }
        }
        const declaredType = child.$type ?? groupType;
        if (declaredType !== undefined && !KNOWN_TYPES.has(declaredType)) {
          throw new Error(
            `Unknown DTCG type ${String(declaredType)} at ${childPath.join('.')}.`,
          );
        }
        tokens.set(childPath.join('.'), {
          declaredType,
          node: child,
          path: childPath,
        });
      } else {
        visitGroup(child, childPath, groupType);
      }
    }
  };

  visitGroup(source, [], undefined);
  if (tokens.size === 0) {
    throw new Error('The DTCG source contains no tokens.');
  }
  return tokens;
};

const resolveTokens = (tokens) => {
  const resolved = new Map();
  const resolving = [];

  const assertReferenceBoundary = (source, target) => {
    const [sourceLayer] = source.path;
    const [targetLayer] = target.path;
    const allowed =
      targetLayer === 'primitive' &&
      (sourceLayer === 'primitive' || sourceLayer === 'semantic');
    if (!allowed) {
      throw new Error(
        `${source.path.join('.')} cannot reference ${target.path.join('.')} across token layer boundaries.`,
      );
    }
  };

  const resolveValue = (value, source) => {
    if (typeof value === 'string') {
      const match = value.match(TOKEN_REFERENCE);
      if (match) {
        const target = resolveToken(match[1]);
        assertReferenceBoundary(source, target);
        return clone(target.value);
      }
      if (/[{}]/u.test(value)) {
        throw new Error(
          `Malformed or interpolated token reference ${JSON.stringify(value)}.`,
        );
      }
      return value;
    }
    if (Array.isArray(value))
      return value.map((child) => resolveValue(child, source));
    if (isRecord(value)) {
      return Object.fromEntries(
        sortedEntries(value).map(([key, child]) => [
          key,
          resolveValue(child, source),
        ]),
      );
    }
    return value;
  };

  const resolveToken = (tokenPath) => {
    const cached = resolved.get(tokenPath);
    if (cached) return cached;
    const token = tokens.get(tokenPath);
    if (!token) throw new Error(`Unknown DTCG token reference {${tokenPath}}.`);
    if (resolving.includes(tokenPath)) {
      throw new Error(
        `Circular DTCG reference: ${[...resolving, tokenPath].join(' -> ')}.`,
      );
    }
    resolving.push(tokenPath);
    try {
      const reference =
        typeof token.node.$value === 'string'
          ? token.node.$value.match(TOKEN_REFERENCE)?.[1]
          : undefined;
      const referenced = reference ? resolveToken(reference) : undefined;
      if (referenced) assertReferenceBoundary(token, referenced);
      const type = token.declaredType ?? referenced?.type;
      if (!type) {
        throw new Error(
          `Token ${tokenPath} has no declared or referenced type.`,
        );
      }
      if (
        referenced &&
        token.declaredType &&
        token.declaredType !== referenced.type
      ) {
        throw new Error(
          `Token ${tokenPath} declares ${token.declaredType} but references ${referenced.type}.`,
        );
      }
      const value = resolveValue(token.node.$value, token);
      validateTypedValue(type, value, tokenPath);
      const result = { ...token, type, value };
      resolved.set(tokenPath, result);
      return result;
    } finally {
      resolving.pop();
    }
  };

  for (const tokenPath of [...tokens.keys()].sort()) resolveToken(tokenPath);
  return resolved;
};

/* The byte channels the stylesheet writes for a DTCG sRGB color. */
const colorChannels = (value) =>
  value.components.map((component) => Math.round(component * 255));

const colorToCss = (value) => {
  const channels = colorChannels(value);
  if (value.alpha !== undefined && value.alpha < 1) {
    return `rgb(${channels.join(' ')} / ${value.alpha})`;
  }
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

const dimensionToCss = (value) =>
  value.value === 0 ? '0px' : `${value.value}${value.unit}`;

const fontFamilyToCss = (value) => {
  const families = Array.isArray(value) ? value : [value];
  const generic =
    /^(?:serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-(?:serif|sans-serif|monospace|rounded)|math|fangsong|emoji)$/iu;
  return families
    .map((family) => (generic.test(family) ? family : JSON.stringify(family)))
    .join(', ');
};

const shadowPartToCss = (shadow) =>
  [
    shadow.inset === true ? 'inset' : undefined,
    dimensionToCss(shadow.offsetX),
    dimensionToCss(shadow.offsetY),
    dimensionToCss(shadow.blur),
    dimensionToCss(shadow.spread),
    colorToCss(shadow.color),
  ]
    .filter((part) => part !== undefined)
    .join(' ');

export const toCssValue = (type, value) => {
  switch (type) {
    case 'color':
      return colorToCss(value);
    case 'dimension':
      return dimensionToCss(value);
    case 'fontFamily':
      return fontFamilyToCss(value);
    case 'fontWeight': {
      const namedWeights = {
        thin: 100,
        hairline: 100,
        'extra-light': 200,
        'ultra-light': 200,
        light: 300,
        normal: 400,
        regular: 400,
        book: 400,
        medium: 500,
        'semi-bold': 600,
        'demi-bold': 600,
        bold: 700,
        'extra-bold': 800,
        'ultra-bold': 800,
        black: 900,
        heavy: 900,
        'extra-black': 950,
        'ultra-black': 950,
      };
      return String(typeof value === 'number' ? value : namedWeights[value]);
    }
    case 'duration':
      return `${value.value}${value.unit}`;
    case 'cubicBezier':
      return `cubic-bezier(${value.join(', ')})`;
    case 'shadow':
      return (Array.isArray(value) ? value : [value])
        .map(shadowPartToCss)
        .join(', ');
    default:
      throw new Error(`Cannot represent ${type} as one CSS value.`);
  }
};

const makeRuntimeTree = (resolved) => {
  const runtime = createDictionary();
  defineData(runtime, 'primitive', createDictionary());
  defineData(runtime, 'semantic', createDictionary());
  for (const token of [...resolved.values()].sort((left, right) =>
    compareCodePoints(left.path.join('.'), right.path.join('.')),
  )) {
    const [layer, ...rest] = token.path;
    if (layer !== 'primitive' && layer !== 'semantic') {
      throw new Error(
        `Token ${token.path.join('.')} is outside primitive/semantic layers.`,
      );
    }
    setPath(runtime[layer], rest, toCssValue(token.type, token.value));
  }
  return runtime;
};

const variableName = (token) => {
  const [layer, category, ...rest] = token.path;
  if (layer === 'primitive' && category === 'brand')
    return `--brand-${rest.join('-')}`;
  if (layer === 'primitive')
    return `--gt-primitive-${[category, ...rest].join('-')}`;
  return `--${[category, ...rest].join('-')}`;
};

/**
 * Renders a DTCG alias as a CSS `var()` reference to the token it points at, so
 * the primitive -> semantic chain survives into the stylesheet.
 * Returns undefined for literal values, which are emitted as-is.
 */
const aliasReference = (rawValue) => {
  const match =
    typeof rawValue === 'string' ? rawValue.match(TOKEN_REFERENCE) : null;
  return match
    ? `var(${variableName({ path: match[1].split('.') })})`
    : undefined;
};

/* `0.269` -> `26.9`: a percentage the stylesheet holds without float noise. */
const percent = (fraction) => Math.round(fraction * 1000) / 10;

/**
 * Renders a derived accent step as the `color-mix()` of its seeds, so a
 * stylesheet that redeclares `--brand-*` after the generated one moves the
 * step too. Returns undefined for every other token.
 */
const brandMix = (token) => {
  const [layer, category, name] = token.path;
  if (layer !== 'primitive' || category !== 'color' || token.path.length !== 3)
    return undefined;
  const [family, step] = name.split('-');
  const entry = BRAND_MIXES[family]?.[step];
  if (!entry) return undefined;
  return entry.tint === undefined
    ? `color-mix(in srgb, #000000 ${percent(entry.shade)}%, var(--brand-${family}))`
    : `color-mix(in srgb, var(--brand-${family}) ${percent(entry.tint)}%, var(--brand-surface-light))`;
};

const tokenDeclaration = (token) => [
  variableName(token),
  aliasReference(token.node.$value) ??
    brandMix(token) ??
    toCssValue(token.type, token.value),
];

const assertNoOutputCollisions = (resolved) => {
  const names = new Map();
  for (const token of resolved.values()) {
    const name = variableName(token);
    const current = token.path.join('.');
    const existing = names.get(name);
    if (existing) {
      throw new Error(
        `CSS output collision ${name} is produced by ${existing} and ${current}.`,
      );
    }
    names.set(name, current);
  }
};

const assertPrimitiveOutputTypes = (resolved) => {
  const expectedTypes = {
    color: 'color',
    duration: 'duration',
    easing: 'cubicBezier',
    'font-family': 'fontFamily',
    'font-size': 'dimension',
    'font-weight': 'fontWeight',
    radius: 'dimension',
    shadow: 'shadow',
    spacing: 'dimension',
  };
  // The brand group mixes types; a seed may be any of these.
  const brandSeedTypes = new Set(['color', 'dimension', 'fontFamily']);
  for (const token of resolved.values()) {
    if (token.path[0] !== 'primitive') continue;
    if (token.path.length < 3) {
      throw new Error(
        `${token.path.join('.')} must be a named primitive token below its category.`,
      );
    }
    const category = token.path[1];
    const expected =
      category === 'brand'
        ? brandSeedTypes.has(token.type)
          ? token.type
          : undefined
        : expectedTypes[category];
    if (!expected) {
      throw new Error(
        category === 'brand'
          ? `${token.path.join('.')} must be a color, dimension or fontFamily brand seed.`
          : `${token.path.join('.')} uses an unsupported primitive output category.`,
      );
    }
    if (token.type !== expected) {
      throw new Error(
        `${token.path.join('.')} must use ${expected} for generated output, received ${token.type}.`,
      );
    }
    if (['radius', 'spacing'].includes(category) && token.value.value < 0) {
      throw new Error(`${token.path.join('.')} must be non-negative.`);
    }
    if (category === 'font-size' && token.value.value <= 0) {
      throw new Error(`${token.path.join('.')} must be greater than zero.`);
    }
    if (category === 'shadow') {
      for (const shadow of Array.isArray(token.value)
        ? token.value
        : [token.value]) {
        if (shadow.blur.value < 0) {
          throw new Error(
            `${token.path.join('.')} shadow blur must be non-negative.`,
          );
        }
      }
    }
  }
};

/* The semantic group is flat: each token is one shadcn or status variable,
   named as its CSS custom property without the leading dashes. */
const assertLayerOutputTypes = (resolved) => {
  const semanticTypes = new Set(['color', 'dimension', 'fontFamily']);

  for (const token of resolved.values()) {
    if (token.path[0] !== 'semantic') continue;
    if (token.path.length !== 2) {
      throw new Error(
        `${token.path.join('.')} must be a named semantic token directly below semantic.`,
      );
    }
    if (!semanticTypes.has(token.type)) {
      throw new Error(
        `${token.path.join('.')} must use color, dimension or fontFamily for generated semantic output, received ${token.type}.`,
      );
    }
  }
};

const assertLayerAliasContracts = (resolved) => {
  for (const token of resolved.values()) {
    if (token.path[0] !== 'semantic') continue;
    if (
      typeof token.node.$value !== 'string' ||
      !TOKEN_REFERENCE.test(token.node.$value)
    ) {
      throw new Error(
        `${token.path.join('.')} semantic values must be aliases.`,
      );
    }
  }
};

const renderDeclarationBlock = (selector, declarations) =>
  `${selector} {\n${declarations.map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}`;

/* The neutral steps by the surface seed each one follows: steps at CIE L* 40
   and above follow the light seed, the darker ones the dark seed. neutral-25
   and neutral-950 alias the seeds themselves. */
const NEUTRAL_ANCHORS = {
  'surface-light': [
    'grey-100',
    'grey-200',
    'grey-300',
    'grey-400',
    'grey-500',
    'grey-600',
    'neutral-50',
    'neutral-100',
    'neutral-400',
    'neutral-450',
    'neutral-500',
    'slate-200',
    'steel-100',
    'steel-200',
    'steel-300',
    'steel-400',
    'steel-500',
    'steel-600',
  ],
  'surface-dark': [
    'charcoal-500',
    'grey-700',
    'grey-800',
    'navy-800',
    'navy-900',
    'neutral-600',
    'neutral-700',
    'neutral-800',
    'slate-950',
    'steel-700',
  ],
};

const NEUTRAL_FAMILIES = new Set([
  'charcoal',
  'grey',
  'navy',
  'neutral',
  'slate',
  'steel',
]);

const assertNeutralAnchors = (resolved) => {
  const listed = Object.values(NEUTRAL_ANCHORS).flat();
  const steps = [...resolved.values()]
    .map((token) => token.path)
    .filter(
      ([layer, category, name]) =>
        layer === 'primitive' &&
        category === 'color' &&
        NEUTRAL_FAMILIES.has(name.split('-')[0]) &&
        name !== 'neutral-25' &&
        name !== 'neutral-950',
    )
    .map(([, , name]) => name);
  for (const name of new Set([...listed, ...steps])) {
    if (
      !steps.includes(name) ||
      listed.filter((entry) => entry === name).length !== 1
    ) {
      throw new Error(
        `NEUTRAL_ANCHORS must list each neutral step except neutral-25 and neutral-950 exactly once: ${name}.`,
      );
    }
  }
};

/* Where relative color syntax and round() both parse; other browsers keep the
   hex values of the default seeds. */
const NEUTRAL_SUPPORTS =
  '(color: rgb(from red calc(r - 1) g b)) and (width: round(1px, 1px))';

const shift = (channel, offset) =>
  `calc(${channel} ${offset < 0 ? '-' : '+'} ${Math.abs(offset)})`;

/**
 * Re-declares each neutral step as its surface seed shifted by the step's
 * per-channel offset from the default seed, so a stylesheet that redeclares
 * `--brand-surface-*` moves the neutrals too, while the default seeds give
 * back the hex values exactly.
 */
const renderNeutralBlock = (primitive, resolved) => {
  const seeds = new Map(
    Object.entries(NEUTRAL_ANCHORS).flatMap(([seed, names]) =>
      names.map((name) => [name, resolved.get(`primitive.brand.${seed}`)]),
    ),
  );
  const declarations = primitive
    .filter((token) => token.path[1] === 'color' && seeds.has(token.path[2]))
    .map((token) => {
      const seed = seeds.get(token.path[2]);
      const seedChannels = colorChannels(seed.value);
      const [r, g, b] = colorChannels(token.value).map(
        (channel, index) => channel - seedChannels[index],
      );
      return [
        variableName(token),
        `rgb(from var(${variableName(seed)}) ${shift('r', r)} ${shift('g', g)} ${shift('b', b)})`,
      ];
    });
  const block = renderDeclarationBlock(':root', declarations);
  return `@supports ${NEUTRAL_SUPPORTS} {\n  ${block.replaceAll('\n', '\n  ')}\n}`;
};

const makeCss = (resolved) => {
  const all = [...resolved.values()].sort((left, right) =>
    compareCodePoints(left.path.join('.'), right.path.join('.')),
  );
  const primitive = all.filter((token) => token.path[0] === 'primitive');
  const semantic = all.filter((token) => token.path[0] === 'semantic');
  return [
    '/* Generated from src/tokens.tokens.json. Do not edit. */',
    renderDeclarationBlock(
      ':root',
      [...primitive, ...semantic].map(tokenDeclaration),
    ),
    renderNeutralBlock(primitive, resolved),
    '',
  ].join('\n\n');
};

const literalType = (value, depth = 0) => {
  const indent = '  '.repeat(depth);
  const childIndent = '  '.repeat(depth + 1);
  if (typeof value === 'string') return JSON.stringify(value);
  return `{\n${sortedEntries(value)
    .map(
      ([key, child]) =>
        `${childIndent}readonly ${JSON.stringify(key)}: ${literalType(child, depth + 1)};`,
    )
    .join('\n')}\n${indent}}`;
};

const sourceMapDirective = ['//', '# sourceMappingURL='].join('');

const makeDeclaration = (runtime) => `/**
 * Neutral institutional design tokens generated from one DTCG 2025.10 source.
 *
 * @packageDocumentation
 */

/**
 * Resolved, deeply frozen neutral design tokens.
 *
 * Values are generated from the package's DTCG 2025.10 source. \`primitive\`
 * holds the palette and scales; \`semantic\` holds the shadcn variables and the
 * success, warning and info pairs, keyed by their CSS custom property names
 * without the leading dashes.
 *
 * @public
 */
export declare const designTokens: ${literalType(runtime)};

/** The generated design-token object type. @public */
export type ResolvedDesignTokens = typeof designTokens;

export default designTokens;
${sourceMapDirective}index.d.ts.map
`;

const makeJavaScript = (runtime) => {
  const runtimeLines = JSON.stringify(runtime, null, 2)
    .split('\n')
    .map((line) => `  ${JSON.stringify(line)},`)
    .join('\n');
  return `const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const resolvedJson = [
${runtimeLines}
].join('\\n');

/** Resolved, deeply frozen neutral design tokens. */
export const designTokens = deepFreeze(JSON.parse(resolvedJson));

export default designTokens;
${sourceMapDirective}index.js.map
`;
};

const makeStylesheetModule = (
  cssFile,
  moduleName,
) => `/** URL of the generated ${moduleName} stylesheet. */
export const stylesheet = new URL(${JSON.stringify(`./${cssFile}`)}, import.meta.url).href;
export default stylesheet;
${sourceMapDirective}${moduleName}.js.map
`;

const makeStylesheetDeclaration = (moduleName) => `/**
 * JavaScript URL facade for the generated ${moduleName} stylesheet.
 *
 * @packageDocumentation
 */

/** URL of the generated ${moduleName} stylesheet. @public */
export declare const stylesheet: string;
export default stylesheet;
${sourceMapDirective}${moduleName}.d.ts.map
`;

const propertyPathsByLine = (text, expression) => {
  const paths = new Map();
  const stack = [];
  for (const [lineIndex, line] of text.split('\n').entries()) {
    const match = expression.exec(line);
    if (!match) continue;
    const indentation = match.groups?.indentation ?? '';
    const encodedKey = match.groups?.key;
    if (encodedKey === undefined) continue;
    const level = Math.floor(indentation.length / 2);
    stack.splice(Math.max(0, level - 1));
    stack.push(JSON.parse(`"${encodedKey}"`));
    paths.set(lineIndex, [...stack]);
  }
  return paths;
};

const runtimeJsonPaths = (runtimeJson) =>
  propertyPathsByLine(
    runtimeJson,
    /^(?<indentation>\s*)"(?<key>(?:\\.|[^"\\])+)"\s*:/u,
  );

const declarationPaths = (declaration) =>
  propertyPathsByLine(
    declaration,
    /^(?<indentation>\s*)readonly\s+"(?<key>(?:\\.|[^"\\])+)"\s*:/u,
  );

const javascriptPaths = (javascript, runtimeJson) => {
  const result = new Map();
  const generatedLines = javascript.split('\n');
  const sourcePaths = runtimeJsonPaths(runtimeJson);
  let cursor = 0;
  for (const [runtimeLine, path] of sourcePaths) {
    const encodedLine = JSON.stringify(runtimeJson.split('\n')[runtimeLine]);
    const generatedLine = generatedLines.findIndex(
      (line, index) => index >= cursor && line.includes(encodedLine),
    );
    if (generatedLine >= 0) {
      result.set(generatedLine, path);
      cursor = generatedLine + 1;
    }
  }
  return result;
};

const offsetPosition = (text, offset) => {
  const before = text.slice(0, offset);
  const lines = before.split('\n');
  return { line: lines.length - 1, column: lines.at(-1)?.length ?? 0 };
};

/* The runtime tree keeps the source's primitive/semantic paths, so every path
   names a source node; a line without a path maps to the root. */
const sourcePosition = (tree, sourceText, runtimePath) => {
  const node = findNodeAtLocation(tree, runtimePath);
  const mappedNode = node.parent?.type === 'property' ? node.parent : node;
  return offsetPosition(sourceText, mappedNode.offset);
};

const makeSourceMap = (
  file,
  sourceText,
  generatedText,
  runtimeJson,
  kind = 'root',
) => {
  const sourceName = '../src/tokens.tokens.json';
  const tree = parseTree(sourceText);
  if (!tree)
    throw new Error('Cannot build source maps from invalid canonical JSON.');
  const linePaths =
    kind === 'javascript'
      ? javascriptPaths(generatedText, runtimeJson)
      : kind === 'declaration'
        ? declarationPaths(generatedText)
        : new Map();
  const mapping = new GenMapping({ file });
  setSourceContent(mapping, sourceName, sourceText);
  const generatedLines = Math.max(1, generatedText.split('\n').length - 1);
  for (let line = 0; line < generatedLines; line += 1) {
    const position = sourcePosition(
      tree,
      sourceText,
      linePaths.get(line) ?? [],
    );
    addSegment(mapping, line, 0, sourceName, position.line, position.column);
  }
  return `${JSON.stringify(toEncodedMap(mapping), null, 2)}\n`;
};

/** Color families whose steps are derived from the brand seeds. */
export const GENERATED_RAMPS = ['primary', 'secondary', 'tertiary'];

/* Generated steps that alias a brand seed instead of holding a derived value:
   step 500 is the seed itself, and `foreground` is the foreground seed under
   `primitive.brand`, which records the surface the luminance split picks by
   aliasing it. The build still compares its resolved hex with `deriveBrand`. */
export const ANCHORS = {
  primary: { 500: 'primary', foreground: 'primary-foreground' },
  secondary: { 500: 'secondary', foreground: 'secondary-foreground' },
  tertiary: { 500: 'tertiary', foreground: 'tertiary-foreground' },
};

/**
 * Derives the generated ramps from the brand seed values, given as DTCG color
 * objects keyed by seed name.
 */
export const brandRamps = (seeds) => {
  const hexOf = (name) => {
    if (seeds[name] === undefined) {
      throw new Error(`primitive.brand.${name} is missing.`);
    }
    if (!isRecord(seeds[name])) {
      throw new Error(`primitive.brand.${name} must be a literal color.`);
    }
    return colorToCss(seeds[name]);
  };
  return deriveBrand({
    primary: hexOf('primary'),
    secondary: hexOf('secondary'),
    tertiary: hexOf('tertiary'),
    surfaceLight: hexOf('surface-light'),
    surfaceDark: hexOf('surface-dark'),
  });
};

/* The generated ramp steps are committed to the source like any other token;
   the build only checks that they still match what the seeds derive. */
const assertBrandRamps = (resolved) => {
  const seedNames = [
    'primary',
    'secondary',
    'tertiary',
    'surface-light',
    'surface-dark',
  ];
  if (!seedNames.some((name) => resolved.has(`primitive.brand.${name}`))) {
    return;
  }
  const seeds = Object.fromEntries(
    seedNames.map((name) => {
      const token = resolved.get(`primitive.brand.${name}`);
      if (!token) {
        throw new Error(`primitive.brand.${name} is missing.`);
      }
      if (!isRecord(token.node.$value)) {
        throw new Error(`primitive.brand.${name} must be a literal color.`);
      }
      return [name, token.value];
    }),
  );
  const ramps = brandRamps(seeds);
  for (const family of GENERATED_RAMPS) {
    for (const [step, expected] of Object.entries(ramps[family])) {
      const tokenPath = `primitive.color.${family}-${step}`;
      const token = resolved.get(tokenPath);
      if (!token) {
        throw new Error(`${tokenPath} is missing; run pnpm run tokens:derive.`);
      }
      const seedName = ANCHORS[family]?.[step];
      if (seedName && token.node.$value !== `{primitive.brand.${seedName}}`) {
        throw new Error(
          `${tokenPath} must alias {primitive.brand.${seedName}}; run pnpm run tokens:derive.`,
        );
      }
      const actual = colorToCss(token.value);
      if (actual !== expected) {
        throw new Error(
          `${tokenPath} is ${actual} but the brand seeds derive ${expected}; run pnpm run tokens:derive.`,
        );
      }
    }
  }
};

export const validateAndResolveDtcg = (source) => {
  const tokens = collectTokens(source);
  const resolved = resolveTokens(tokens);
  assertNoOutputCollisions(resolved);
  assertPrimitiveOutputTypes(resolved);
  assertBrandRamps(resolved);
  assertNeutralAnchors(resolved);
  assertLayerOutputTypes(resolved);
  assertLayerAliasContracts(resolved);
  const runtime = makeRuntimeTree(resolved);
  return { resolved, runtime };
};

export const generateArtifacts = (source, sourceText) => {
  const { resolved, runtime } = validateAndResolveDtcg(source);
  const canonical = `${JSON.stringify(source, null, 2)}\n`;
  const runtimeJson = `${JSON.stringify(runtime, null, 2)}\n`;
  const javascript = makeJavaScript(runtime);
  const declaration = makeDeclaration(runtime);
  const cssDeclaration = makeStylesheetDeclaration('css');
  const cssModule = makeStylesheetModule('index.css', 'css');
  const indexCss = makeCss(resolved);
  const artifacts = new Map([
    ['css.d.ts', cssDeclaration],
    [
      'css.d.ts.map',
      makeSourceMap('css.d.ts', sourceText, cssDeclaration, runtimeJson),
    ],
    ['css.js', cssModule],
    ['css.js.map', makeSourceMap('css.js', sourceText, cssModule, runtimeJson)],
    ['derive.d.ts', deriveDeclaration],
    ['derive.js', deriveModule],
    ['index.css', indexCss],
    ['index.d.ts', declaration],
    [
      'index.d.ts.map',
      makeSourceMap(
        'index.d.ts',
        sourceText,
        declaration,
        runtimeJson,
        'declaration',
      ),
    ],
    ['index.js', javascript],
    [
      'index.js.map',
      makeSourceMap(
        'index.js',
        sourceText,
        javascript,
        runtimeJson,
        'javascript',
      ),
    ],
    ['tokens.json', runtimeJson],
    ['tokens.tokens.json', canonical],
  ]);
  const files = Object.fromEntries(
    [...artifacts]
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([name, contents]) => [
        name,
        crypto.createHash('sha512').update(contents).digest('hex'),
      ]),
  );
  const digest = crypto
    .createHash('sha512')
    .update(JSON.stringify(files))
    .digest('hex');
  artifacts.set(
    'build-manifest.json',
    `${JSON.stringify({ schemaVersion: 1, sha512: digest, files }, null, 2)}\n`,
  );
  return artifacts;
};
