import crypto from 'node:crypto';
import {
  GenMapping,
  addSegment,
  setSourceContent,
  toEncodedMap,
} from '@jridgewell/gen-mapping';
import { findNodeAtLocation, parseTree } from 'jsonc-parser';

const TOKEN_REFERENCE = /^\{([^{}]+)\}$/;
const KNOWN_TYPES = new Set([
  'color',
  'cubicBezier',
  'dimension',
  'duration',
  'fontFamily',
  'fontWeight',
  'number',
  'shadow',
  'typography',
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

const validateTypography = (value, label) => {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a DTCG typography object.`);
  }
  const required = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
  ];
  assertObjectKeys(value, required, label);
  for (const field of required) {
    if (!(field in value)) {
      throw new Error(`${label}.${field} is required.`);
    }
  }
  validateTypedValue('fontFamily', value.fontFamily, `${label}.fontFamily`);
  validateTypedValue('dimension', value.fontSize, `${label}.fontSize`);
  validateTypedValue('fontWeight', value.fontWeight, `${label}.fontWeight`);
  validateTypedValue(
    'dimension',
    value.letterSpacing,
    `${label}.letterSpacing`,
  );
  validateTypedValue('number', value.lineHeight, `${label}.lineHeight`);
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
    case 'number':
      assertFiniteNumber(value, label);
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
    case 'typography':
      validateTypography(value, label);
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
    const [sourceLayer, sourceMode] = source.path;
    const [targetLayer, targetMode] = target.path;
    const allowed =
      (sourceLayer === 'primitive' && targetLayer === 'primitive') ||
      (sourceLayer === 'semantic' && targetLayer === 'primitive') ||
      (sourceLayer === 'semantic' &&
        targetLayer === 'semantic' &&
        sourceMode === targetMode) ||
      (sourceLayer === 'component' &&
        (targetLayer === 'semantic' || targetLayer === 'component') &&
        sourceMode === targetMode);
    if (!allowed) {
      throw new Error(
        `${source.path.join('.')} cannot reference ${target.path.join('.')} across token layer or mode boundaries.`,
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

  const assertReferenceType = (value, expectedType, label, source) => {
    const reference =
      typeof value === 'string' ? value.match(TOKEN_REFERENCE)?.[1] : undefined;
    if (!reference) return;
    const target = resolveToken(reference);
    assertReferenceBoundary(source, target);
    if (target.type !== expectedType) {
      throw new Error(
        `${label} must reference ${expectedType}, received ${target.type}.`,
      );
    }
  };

  const assertCompositeReferenceTypes = (type, value, label, source) => {
    if (type === 'typography' && isRecord(value)) {
      const fields = {
        fontFamily: 'fontFamily',
        fontSize: 'dimension',
        fontWeight: 'fontWeight',
        letterSpacing: 'dimension',
        lineHeight: 'number',
      };
      for (const [field, expectedType] of Object.entries(fields)) {
        assertReferenceType(
          value[field],
          expectedType,
          `${label}.${field}`,
          source,
        );
      }
    }
  };

  const resolveToken = (tokenPath) => {
    const cached = resolved.get(tokenPath);
    if (cached) return cached;
    const token = tokens.get(tokenPath);
    if (!token) throw new Error(`Unknown DTCG token reference {${tokenPath}}.`);
    if (
      (token.path[0] === 'semantic' || token.path[0] === 'component') &&
      token.path[1] !== 'light' &&
      token.path[1] !== 'dark'
    ) {
      throw new Error(`${tokenPath} must use an explicit light or dark mode.`);
    }
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
      assertCompositeReferenceTypes(type, token.node.$value, tokenPath, token);
      const fontVariant =
        token.node.$extensions?.['org.global-torque.css']?.fontVariantNumeric;
      if (
        type === 'typography' &&
        fontVariant !== undefined &&
        fontVariant !== 'tabular-nums'
      ) {
        throw new Error(
          `${tokenPath} fontVariantNumeric must be the safe tabular-nums keyword.`,
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

const formatNumber = (value) => (Object.is(value, -0) ? '0' : String(value));

const colorToCss = (value) => {
  const channels = value.components.map((component) =>
    Math.round(component * 255),
  );
  if (value.alpha !== undefined && value.alpha < 1) {
    return `rgb(${channels.join(' ')} / ${formatNumber(value.alpha)})`;
  }
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

const dimensionToCss = (value) =>
  value.value === 0 ? '0px' : `${formatNumber(value.value)}${value.unit}`;

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
      return typeof value === 'number'
        ? formatNumber(value)
        : formatNumber(namedWeights[value]);
    }
    case 'number':
      return typeof value === 'number' ? formatNumber(value) : value;
    case 'duration':
      return `${formatNumber(value.value)}${value.unit}`;
    case 'cubicBezier':
      return `cubic-bezier(${value.map(formatNumber).join(', ')})`;
    case 'shadow':
      return (Array.isArray(value) ? value : [value])
        .map(shadowPartToCss)
        .join(', ');
    default:
      throw new Error(`Cannot represent ${type} as one CSS value.`);
  }
};

const typographyToRuntime = (value, node) => {
  const variant =
    node?.$extensions?.['org.global-torque.css']?.fontVariantNumeric;
  return {
    fontFamily: toCssValue('fontFamily', value.fontFamily),
    fontSize: toCssValue('dimension', value.fontSize),
    fontWeight: toCssValue('fontWeight', value.fontWeight),
    letterSpacing: toCssValue('dimension', value.letterSpacing),
    lineHeight: toCssValue('number', value.lineHeight),
    ...(typeof variant === 'string' ? { fontVariantNumeric: variant } : {}),
  };
};

const toRuntimeValue = (type, value, node) =>
  type === 'typography'
    ? typographyToRuntime(value, node)
    : toCssValue(type, value);

const makeRuntimeTree = (resolved) => {
  const runtime = createDictionary();
  defineData(runtime, 'modes', createDictionary());
  defineData(runtime.modes, 'dark', createDictionary());
  defineData(runtime.modes, 'light', createDictionary());
  defineData(runtime, 'primitive', createDictionary());
  for (const token of [...resolved.values()].sort((left, right) =>
    compareCodePoints(left.path.join('.'), right.path.join('.')),
  )) {
    const [layer, mode, ...rest] = token.path;
    const value = toRuntimeValue(token.type, token.value, token.node);
    if (layer === 'primitive') {
      setPath(runtime.primitive, [mode, ...rest], value);
    } else if (layer === 'semantic' && (mode === 'light' || mode === 'dark')) {
      setPath(runtime.modes[mode], ['semantic', ...rest], value);
    } else if (layer === 'component' && (mode === 'light' || mode === 'dark')) {
      setPath(runtime.modes[mode], ['component', ...rest], value);
    } else {
      throw new Error(
        `Token ${token.path.join('.')} is outside primitive/semantic/component layers.`,
      );
    }
  }
  return runtime;
};

const assertModeParity = (resolved) => {
  for (const layer of ['semantic', 'component']) {
    const values = new Map();
    for (const token of resolved.values()) {
      if (token.path[0] !== layer) continue;
      const mode = token.path[1];
      if (mode !== 'light' && mode !== 'dark') {
        throw new Error(
          `${token.path.join('.')} must use an explicit light or dark mode.`,
        );
      }
      const key = token.path.slice(2).join('.');
      const pair = values.get(key) ?? {};
      const variant =
        token.node.$extensions?.['org.global-torque.css']?.fontVariantNumeric;
      pair[mode] =
        `${token.type}:${typeof variant === 'string' ? variant : ''}`;
      values.set(key, pair);
    }
    for (const [key, pair] of values) {
      if (!pair.light || !pair.dark || pair.light !== pair.dark) {
        throw new Error(
          `${layer}.${key} must have type-matched light and dark values.`,
        );
      }
    }
  }
};

const variableName = (token) => {
  const [layer, mode, ...rest] = token.path;
  if (layer === 'primitive')
    return `--gt-primitive-${[mode, ...rest].join('-')}`;
  if (layer === 'semantic') return `--gt-${rest.join('-')}`;
  return `--gt-component-${rest.join('-')}`;
};

const cssDeclarations = (token) => {
  const name = variableName(token);
  if (token.type !== 'typography') {
    return [[name, toCssValue(token.type, token.value)]];
  }
  const value = typographyToRuntime(token.value, token.node);
  const declarations = sortedEntries(value).map(([property, propertyValue]) => [
    `${name}-${property.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`,
    propertyValue,
  ]);
  return declarations;
};

const assertNoOutputCollisions = (resolved) => {
  const buckets = { base: new Map(), dark: new Map() };
  for (const token of resolved.values()) {
    const bucket =
      token.path[0] === 'primitive' || token.path[1] === 'light'
        ? buckets.base
        : buckets.dark;
    for (const [name] of cssDeclarations(token)) {
      const existing = bucket.get(name);
      const current = token.path.join('.');
      if (existing && existing !== current) {
        throw new Error(
          `CSS output collision ${name} is produced by ${existing} and ${current}.`,
        );
      }
      bucket.set(name, current);
    }
  }
};

const assertPrimitiveOutputTypes = (resolved) => {
  const expectedTypes = {
    animation: 'duration',
    breakpoint: 'dimension',
    color: 'color',
    duration: 'duration',
    easing: 'cubicBezier',
    'font-family': 'fontFamily',
    'font-size': 'dimension',
    'font-weight': 'fontWeight',
    'letter-spacing': 'dimension',
    'line-height': 'number',
    opacity: 'number',
    radius: 'dimension',
    shadow: 'shadow',
    spacing: 'dimension',
  };
  for (const token of resolved.values()) {
    if (token.path[0] !== 'primitive') continue;
    if (token.path.length < 3) {
      throw new Error(
        `${token.path.join('.')} must be a named primitive token below its category.`,
      );
    }
    const category = token.path[1];
    const expected = expectedTypes[category];
    if (!expected) {
      throw new Error(
        `${token.path.join('.')} uses an unsupported primitive output category.`,
      );
    }
    if (token.type !== expected) {
      throw new Error(
        `${token.path.join('.')} must use ${expected} for generated output, received ${token.type}.`,
      );
    }
    if (
      category === 'opacity' &&
      (typeof token.value !== 'number' || token.value < 0 || token.value > 1)
    ) {
      throw new Error(
        `${token.path.join('.')} opacity must be between 0 and 1.`,
      );
    }
    if (['radius', 'spacing'].includes(category) && token.value.value < 0) {
      throw new Error(`${token.path.join('.')} must be non-negative.`);
    }
    if (
      ['breakpoint', 'font-size'].includes(category) &&
      token.value.value <= 0
    ) {
      throw new Error(`${token.path.join('.')} must be greater than zero.`);
    }
    if (category === 'line-height' && token.value <= 0) {
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

const assertLayerOutputTypes = (resolved) => {
  const semanticTypes = {
    color: 'color',
    typography: 'typography',
  };
  const componentGroups = new Set(['button', 'dialog', 'input', 'toast']);

  for (const token of resolved.values()) {
    const [layer, , category] = token.path;
    if (layer === 'semantic') {
      if (token.path.length < 4) {
        throw new Error(
          `${token.path.join('.')} must be a named semantic token below its mode and category.`,
        );
      }
      const expected = semanticTypes[category];
      if (!expected) {
        throw new Error(
          `${token.path.join('.')} uses an unsupported semantic output category.`,
        );
      }
      if (token.type !== expected) {
        throw new Error(
          `${token.path.join('.')} must use ${expected} for generated semantic output, received ${token.type}.`,
        );
      }
    }
    if (layer === 'component') {
      if (token.path.length < 4) {
        throw new Error(
          `${token.path.join('.')} must be a named component token below its mode and group.`,
        );
      }
      if (!componentGroups.has(category)) {
        throw new Error(
          `${token.path.join('.')} uses an unsupported component output group.`,
        );
      }
      if (token.type !== 'color') {
        throw new Error(
          `${token.path.join('.')} must use color for generated component output, received ${token.type}.`,
        );
      }
    }
  }
};

const assertLayerAliasContracts = (resolved) => {
  for (const token of resolved.values()) {
    const [layer] = token.path;
    if (layer !== 'semantic' && layer !== 'component') continue;
    const directReference =
      typeof token.node.$value === 'string' &&
      TOKEN_REFERENCE.test(token.node.$value);
    if (layer === 'component' && !directReference) {
      throw new Error(
        `${token.path.join('.')} component tokens must be direct same-mode aliases.`,
      );
    }
    if (layer === 'semantic') {
      if (token.type === 'typography' && isRecord(token.node.$value)) {
        for (const field of [
          'fontFamily',
          'fontSize',
          'fontWeight',
          'letterSpacing',
          'lineHeight',
        ]) {
          if (
            typeof token.node.$value[field] !== 'string' ||
            !TOKEN_REFERENCE.test(token.node.$value[field])
          ) {
            throw new Error(
              `${token.path.join('.')}.${field} semantic values must be aliases.`,
            );
          }
        }
      } else if (!directReference) {
        throw new Error(
          `${token.path.join('.')} semantic values must be aliases.`,
        );
      }
    }
  }
};

const renderDeclarationBlock = (selector, declarations) =>
  `${selector} {\n${declarations.map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}`;

const makeCss = (resolved) => {
  const all = [...resolved.values()].sort((left, right) =>
    compareCodePoints(left.path.join('.'), right.path.join('.')),
  );
  const primitive = all.filter((token) => token.path[0] === 'primitive');
  const light = all.filter(
    (token) => token.path[0] !== 'primitive' && token.path[1] === 'light',
  );
  const dark = all.filter(
    (token) => token.path[0] !== 'primitive' && token.path[1] === 'dark',
  );
  return [
    '/* Generated from src/tokens.tokens.json. Do not edit. */',
    renderDeclarationBlock(
      ':root',
      [...primitive, ...light].flatMap(cssDeclarations),
    ),
    renderDeclarationBlock(
      ':is(.dark, [data-theme="dark"])',
      dark.flatMap(cssDeclarations),
    ),
    '',
  ].join('\n\n');
};

const animationConfiguration = (token, resolved) => {
  if (token.type !== 'duration') {
    throw new Error(
      `${token.path.join('.')} animation token must be a duration.`,
    );
  }
  const extension = token.node.$extensions?.['org.global-torque.css'];
  if (!isRecord(extension)) {
    throw new Error(
      `${token.path.join('.')} requires an org.global-torque.css extension.`,
    );
  }
  const { name, easing, fillMode, keyframes } = extension;
  if (typeof name !== 'string' || !/^gt-[a-z0-9-]+$/u.test(name)) {
    throw new Error(
      `${token.path.join('.')} animation name is not output-safe.`,
    );
  }
  const easingPath =
    typeof easing === 'string' ? easing.match(TOKEN_REFERENCE)?.[1] : undefined;
  const easingToken = easingPath ? resolved.get(easingPath) : undefined;
  if (!easingToken || easingToken.type !== 'cubicBezier') {
    throw new Error(
      `${token.path.join('.')} animation easing must reference cubicBezier.`,
    );
  }
  if (!['none', 'forwards', 'backwards', 'both'].includes(fillMode)) {
    throw new Error(`${token.path.join('.')} animation fillMode is invalid.`);
  }
  if (!isRecord(keyframes) || Object.keys(keyframes).length === 0) {
    throw new Error(
      `${token.path.join('.')} animation keyframes are required.`,
    );
  }
  const renderedFrames = sortedEntries(keyframes).map(([selector, frame]) => {
    if (!/^(?:from|to|(?:100|\d?\d)%)$/u.test(selector) || !isRecord(frame)) {
      throw new Error(
        `${token.path.join('.')} has an invalid keyframe selector.`,
      );
    }
    const opacity = frame.opacity;
    if (
      Object.keys(frame).length !== 1 ||
      typeof opacity !== 'number' ||
      !Number.isFinite(opacity) ||
      opacity < 0 ||
      opacity > 1
    ) {
      throw new Error(
        `${token.path.join('.')} keyframes support bounded opacity only.`,
      );
    }
    return `  ${selector} { opacity: ${formatNumber(opacity)}; }`;
  });
  return {
    name,
    fillMode,
    easingToken,
    keyframes: `@keyframes ${name} {\n${renderedFrames.join('\n')}\n}`,
  };
};

const assertAnimationNames = (resolved) => {
  const names = new Map();
  for (const token of resolved.values()) {
    if (token.path[0] !== 'primitive' || token.path[1] !== 'animation')
      continue;
    const animation = animationConfiguration(token, resolved);
    const current = token.path.join('.');
    const existing = names.get(animation.name);
    if (existing) {
      throw new Error(
        `Animation name ${animation.name} is produced by ${existing} and ${current}.`,
      );
    }
    names.set(animation.name, current);
  }
};

const tailwindMappings = (resolved) => {
  const mappings = [];
  for (const token of [...resolved.values()].sort((left, right) =>
    compareCodePoints(left.path.join('.'), right.path.join('.')),
  )) {
    const path = token.path;
    if (path[0] === 'semantic' && path[1] === 'light' && path[2] === 'color') {
      mappings.push([
        `--color-gt-${path.slice(3).join('-')}`,
        `var(${variableName(token)})`,
      ]);
    }
    const primitiveNamespaces = {
      breakpoint: 'breakpoint',
      easing: 'ease',
      'font-family': 'font',
      'font-size': 'text',
      'font-weight': 'font-weight',
      'letter-spacing': 'tracking',
      'line-height': 'leading',
      opacity: 'opacity',
      radius: 'radius',
      shadow: 'shadow',
      spacing: 'spacing',
    };
    if (path[0] === 'primitive' && primitiveNamespaces[path[1]]) {
      mappings.push([
        `--${primitiveNamespaces[path[1]]}-gt-${path.slice(2).join('-')}`,
        path[1] === 'breakpoint'
          ? toCssValue(token.type, token.value)
          : `var(${variableName(token)})`,
      ]);
    }
    if (path[0] === 'primitive' && path[1] === 'animation') {
      const animation = animationConfiguration(token, resolved);
      mappings.push([
        `--animate-gt-${path.slice(2).join('-')}`,
        `${animation.name} var(${variableName(token)}) var(${variableName(animation.easingToken)}) ${animation.fillMode}`,
      ]);
    }
  }
  return mappings;
};

const makeThemeCss = (resolved) => {
  const keyframes = [...resolved.values()]
    .filter(
      (token) => token.path[0] === 'primitive' && token.path[1] === 'animation',
    )
    .map((token) => animationConfiguration(token, resolved).keyframes);
  return [
    '/* Generated Tailwind CSS v4 mappings. Import after @global-torque/design-tokens/css. */',
    renderDeclarationBlock('@theme inline', tailwindMappings(resolved)),
    ...keyframes,
    '',
  ].join('\n\n');
};

const literalType = (value, depth = 0) => {
  const indent = '  '.repeat(depth);
  const childIndent = '  '.repeat(depth + 1);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return `readonly [${value.map((item) => literalType(item, depth + 1)).join(', ')}]`;
  }
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
 * Values are generated from the package's DTCG 2025.10 source. Use
 * \`modes.light\` or \`modes.dark\` explicitly; the runtime never detects a
 * preferred mode.
 *
 * @public
 */
export declare const designTokens: ${literalType(runtime)};

/** The generated design-token object type. @public */
export type ResolvedDesignTokens = typeof designTokens;

/** Supported explicit color modes. @public */
export type DesignTokenMode = keyof ResolvedDesignTokens['modes'];

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

const canonicalPath = (runtimePath) => {
  if (runtimePath[0] === 'primitive') return runtimePath;
  if (runtimePath[0] !== 'modes') return [];
  const [, mode, layer, ...rest] = runtimePath;
  return typeof mode === 'string' && typeof layer === 'string'
    ? [layer, mode, ...rest]
    : [];
};

const offsetPosition = (text, offset) => {
  const before = text.slice(0, offset);
  const lines = before.split('\n');
  return { line: lines.length - 1, column: lines.at(-1)?.length ?? 0 };
};

const sourcePosition = (tree, sourceText, runtimePath) => {
  const path = canonicalPath(runtimePath);
  while (path.length > 0) {
    const node = findNodeAtLocation(tree, path);
    if (node) {
      const mappedNode = node.parent?.type === 'property' ? node.parent : node;
      return offsetPosition(sourceText, mappedNode.offset);
    }
    path.pop();
  }
  return { line: 0, column: 0 };
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

const parseHexColor = (value) => {
  const match = /^#([0-9a-f]{6})$/iu.exec(value);
  if (!match)
    throw new Error(
      `Contrast checks require an opaque hex color, received ${value}.`,
    );
  const integer = Number.parseInt(match[1], 16);
  return [(integer >> 16) & 255, (integer >> 8) & 255, integer & 255];
};

const luminance = (color) => {
  const channels = parseHexColor(color).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const contrastRatio = (foreground, background) => {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
};

export const REQUIRED_CONTRAST_PAIRS = Object.freeze([
  ['foreground-default', 'background-surface'],
  ['foreground-muted', 'background-surface'],
  ['foreground-disabled', 'background-surface'],
  ['accent-foreground', 'accent-background'],
  ['positive-foreground', 'positive-background'],
  ['negative-foreground', 'negative-background'],
  ['neutral-foreground', 'neutral-background'],
  ['warning-foreground', 'warning-background'],
  ['info-foreground', 'info-background'],
]);

export const assertRequiredContrast = (runtime, minimum = 4.5) => {
  for (const mode of ['light', 'dark']) {
    const colors = runtime.modes[mode].semantic.color;
    for (const [foregroundName, backgroundName] of REQUIRED_CONTRAST_PAIRS) {
      const ratio = contrastRatio(
        colors[foregroundName],
        colors[backgroundName],
      );
      if (ratio < minimum) {
        throw new Error(
          `${mode} ${foregroundName}/${backgroundName} contrast ${ratio.toFixed(2)} is below ${minimum}.`,
        );
      }
    }
    for (const component of ['button', 'input']) {
      const colors = runtime.modes[mode].component[component];
      const ratio = contrastRatio(
        colors['disabled-foreground'],
        colors['disabled-background'],
      );
      if (ratio < minimum) {
        throw new Error(
          `${mode} ${component} disabled foreground/background contrast ${ratio.toFixed(2)} is below ${minimum}.`,
        );
      }
    }
    const input = runtime.modes[mode].component.input;
    const boundaryRatio = contrastRatio(input.border, input.background);
    if (boundaryRatio < 3) {
      throw new Error(
        `${mode} input border/background contrast ${boundaryRatio.toFixed(2)} is below 3.`,
      );
    }
    const focus = runtime.modes[mode].semantic.color['border-focus'];
    for (const backgroundName of [
      'background-canvas',
      'background-elevated',
      'background-surface',
    ]) {
      const focusRatio = contrastRatio(focus, colors[backgroundName]);
      if (focusRatio < 3) {
        throw new Error(
          `${mode} border-focus/${backgroundName} contrast ${focusRatio.toFixed(2)} is below 3.`,
        );
      }
    }
    const inputFocusRatio = contrastRatio(
      input['border-focus'],
      input.background,
    );
    if (inputFocusRatio < 3) {
      throw new Error(
        `${mode} input focus border/background contrast ${inputFocusRatio.toFixed(2)} is below 3.`,
      );
    }
    const button = runtime.modes[mode].component.button;
    for (const backgroundName of [
      'primary-background',
      'primary-background-hover',
    ]) {
      const buttonRatio = contrastRatio(
        button['primary-foreground'],
        button[backgroundName],
      );
      if (buttonRatio < minimum) {
        throw new Error(
          `${mode} button primary-foreground/${backgroundName} contrast ${buttonRatio.toFixed(2)} is below ${minimum}.`,
        );
      }
    }
    for (const backgroundName of [
      'background-canvas',
      'background-elevated',
      'background-surface',
    ]) {
      const buttonFocusRatio = contrastRatio(
        button['focus-ring'],
        colors[backgroundName],
      );
      if (buttonFocusRatio < 3) {
        throw new Error(
          `${mode} button focus-ring/${backgroundName} contrast ${buttonFocusRatio.toFixed(2)} is below 3.`,
        );
      }
    }
    for (const [componentName, foregroundName, backgroundName] of [
      ['input', 'foreground', 'background'],
      ['dialog', 'foreground', 'background'],
      ['toast', 'positive-foreground', 'positive-background'],
      ['toast', 'negative-foreground', 'negative-background'],
      ['toast', 'neutral-foreground', 'neutral-background'],
    ]) {
      const componentColors = runtime.modes[mode].component[componentName];
      const componentRatio = contrastRatio(
        componentColors[foregroundName],
        componentColors[backgroundName],
      );
      if (componentRatio < minimum) {
        throw new Error(
          `${mode} ${componentName} ${foregroundName}/${backgroundName} contrast ${componentRatio.toFixed(2)} is below ${minimum}.`,
        );
      }
    }
  }
};

export const validateAndResolveDtcg = (source) => {
  const tokens = collectTokens(source);
  const resolved = resolveTokens(tokens);
  assertModeParity(resolved);
  assertNoOutputCollisions(resolved);
  assertPrimitiveOutputTypes(resolved);
  assertLayerOutputTypes(resolved);
  assertLayerAliasContracts(resolved);
  assertAnimationNames(resolved);
  const runtime = makeRuntimeTree(resolved);
  assertRequiredContrast(runtime);
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
  const themeCss = makeThemeCss(resolved);
  const themeDeclaration = makeStylesheetDeclaration('theme');
  const themeModule = makeStylesheetModule('theme.css', 'theme');
  const artifacts = new Map([
    ['css.d.ts', cssDeclaration],
    [
      'css.d.ts.map',
      makeSourceMap('css.d.ts', sourceText, cssDeclaration, runtimeJson),
    ],
    ['css.js', cssModule],
    ['css.js.map', makeSourceMap('css.js', sourceText, cssModule, runtimeJson)],
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
    ['theme.css', themeCss],
    ['theme.d.ts', themeDeclaration],
    [
      'theme.d.ts.map',
      makeSourceMap('theme.d.ts', sourceText, themeDeclaration, runtimeJson),
    ],
    ['theme.js', themeModule],
    [
      'theme.js.map',
      makeSourceMap('theme.js', sourceText, themeModule, runtimeJson),
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
