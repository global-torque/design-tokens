import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  brandRamps,
  generateArtifacts,
  toCssValue,
  validateAndResolveDtcg,
} from './generate.mjs';

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const sourcePath = path.join(packageDirectory, 'src', 'tokens.tokens.json');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const source = JSON.parse(sourceText);

const copySource = () => structuredClone(source);
const at = (value, pathSegments) =>
  pathSegments.reduce((current, segment) => current[segment], value);

/* The token source ships no typography or animation tokens any more, while the
   generator still supports both; these add the tokens those checks run on. */
const typographyValue = {
  fontFamily: '{primitive.font-family.sans}',
  fontSize: '{primitive.font-size.sm}',
  fontWeight: '{primitive.font-weight.medium}',
  letterSpacing: '{primitive.spacing.1}',
  lineHeight: '{primitive.line-height.normal}',
};

const withTypography = (input) => {
  input.primitive['line-height'] = { $type: 'number', normal: { $value: 1.5 } };
  for (const mode of ['light', 'dark']) {
    input.semantic[mode].typography = {
      body: { $type: 'typography', $value: structuredClone(typographyValue) },
      'tabular-number': {
        $type: 'typography',
        $value: structuredClone(typographyValue),
        $extensions: {
          'org.global-torque.css': { fontVariantNumeric: 'tabular-nums' },
        },
      },
    };
  }
  return input;
};

const withAnimation = (input) => {
  input.primitive.animation = {
    'fade-in': {
      $type: 'duration',
      $value: { value: 180, unit: 'ms' },
      $extensions: {
        'org.global-torque.css': {
          name: 'gt-fade-in',
          easing: '{primitive.easing.standard}',
          fillMode: 'both',
          keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
        },
      },
    },
  };
  return input;
};

const kebabCase = (value) =>
  value.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

const flattenLeaves = (value, pathSegments = []) =>
  Object.entries(value).flatMap(([key, child]) => {
    const nextPath = [...pathSegments, kebabCase(key)];
    return child !== null && typeof child === 'object'
      ? flattenLeaves(child, nextPath)
      : [[nextPath, child]];
  });

const runtimeCssVariables = (runtime) => {
  const primitive = flattenLeaves(runtime.primitive).map(
    ([pathSegments, value]) => [
      pathSegments[0] === 'brand'
        ? `--brand-${pathSegments.slice(1).join('-')}`
        : `--gt-primitive-${pathSegments.join('-')}`,
      value,
    ],
  );
  const modeVariables = (mode) => [
    ...flattenLeaves(runtime.modes[mode].semantic).map(
      ([pathSegments, value]) => [`--gt-${pathSegments.join('-')}`, value],
    ),
    ...flattenLeaves(runtime.modes[mode].component).map(
      ([pathSegments, value]) => [
        `--gt-component-${pathSegments.join('-')}`,
        value,
      ],
    ),
  ];
  return {
    base: new Map([...primitive, ...modeVariables('light')]),
    dark: new Map(modeVariables('dark')),
  };
};

const parseCssVariables = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing CSS block ${selector}.`);
  const bodyStart = css.indexOf('{', start) + 1;
  const bodyEnd = css.indexOf('}', bodyStart);
  const variables = new Map();
  for (const match of css
    .slice(bodyStart, bodyEnd)
    .matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gu)) {
    variables.set(match[1], match[2].trim());
  }
  return variables;
};

/* The arithmetic of derive's `mix`, so an evaluated `color-mix()` lands on the
   byte the runtime tree holds. */
const mixHex = (color, into, fraction) => {
  const bytes = (hex) =>
    [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const colorBytes = bytes(color);
  return `#${bytes(into)
    .map((channel, index) =>
      Math.round(channel - (channel - colorBytes[index]) * fraction)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

/**
 * Follows `var(--other)` references and evaluates
 * `color-mix(in srgb, <color> <p>%, <color>)` so CSS values can be compared
 * with the resolved runtime literals. The stylesheet keeps the DTCG alias
 * chain, so a semantic variable points at a primitive instead of repeating its
 * value. Throws on a dangling or cyclic reference, which the flat form could
 * not catch.
 */
const resolveCssVariables = (variables, inherited = new Map()) => {
  const scope = new Map([...inherited, ...variables]);
  const resolve = (name, seen) => {
    const value = scope.get(name);
    if (value === undefined)
      throw new Error(`Unresolved CSS variable reference ${name}.`);
    if (seen.has(name))
      throw new Error(`Cyclic CSS variable reference ${name}.`);
    const follow = (part) => {
      const match = part.match(/^var\((--[a-z0-9-]+)\)$/u);
      return match ? resolve(match[1], new Set([...seen, name])) : part;
    };
    const mix = value.match(/^color-mix\(in srgb, (\S+) ([\d.]+)%, (\S+)\)$/u);
    return mix
      ? mixHex(follow(mix[1]), follow(mix[3]), Number(mix[2]) / 100)
      : follow(value);
  };
  return new Map(
    [...variables.keys()].map((name) => [name, resolve(name, new Set())]),
  );
};

const sortedObject = (entries) =>
  Object.fromEntries(
    [...entries].sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );

const literalTypeValue = (node) => {
  if (ts.isTypeLiteralNode(node)) {
    return Object.fromEntries(
      node.members.map((member) => {
        if (
          !ts.isPropertySignature(member) ||
          !member.type ||
          (!ts.isStringLiteral(member.name) &&
            !ts.isIdentifier(member.name) &&
            !ts.isNumericLiteral(member.name))
        ) {
          throw new Error(
            'Generated declaration contains a non-literal member.',
          );
        }
        return [member.name.text, literalTypeValue(member.type)];
      }),
    );
  }
  if (ts.isTupleTypeNode(node)) {
    return node.elements.map(literalTypeValue);
  }
  if (ts.isLiteralTypeNode(node)) {
    if (ts.isStringLiteral(node.literal) || ts.isNumericLiteral(node.literal)) {
      return ts.isNumericLiteral(node.literal)
        ? Number(node.literal.text)
        : node.literal.text;
    }
    if (node.literal.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.literal.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.literal.kind === ts.SyntaxKind.NullKeyword) return null;
  }
  throw new Error(`Unsupported generated declaration node ${node.kind}.`);
};

const declarationDesignTokens = (declaration) => {
  const sourceFile = ts.createSourceFile(
    'index.d.ts',
    declaration,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declarationNode of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declarationNode.name) &&
        declarationNode.name.text === 'designTokens' &&
        declarationNode.type
      ) {
        return literalTypeValue(declarationNode.type);
      }
    }
  }
  throw new Error('Generated declaration is missing designTokens.');
};

describe('DTCG validation and resolution', () => {
  it('passes the pinned official DTCG 2025.10 schema without network loading', async () => {
    const schemaText = fs.readFileSync(
      path.join(packageDirectory, 'schemas', 'dtcg-2025.10-format.schema.json'),
      'utf8',
    );
    expect(crypto.createHash('sha256').update(schemaText).digest('hex')).toBe(
      '32e93b780e4e4bca778d0780cb797a560deedc470c608af16576223f7e42915f',
    );
    let loads = 0;
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      loadSchema: () => {
        loads += 1;
        return Promise.reject(
          new Error('Network schema loading is forbidden.'),
        );
      },
    });
    addFormats(ajv);
    const validate = await ajv.compileAsync(JSON.parse(schemaText));

    expect(validate(source), JSON.stringify(validate.errors)).toBe(true);
    expect(loads).toBe(0);
  });

  it('resolves the canonical primitive, semantic, and component layers without mutation', () => {
    const input = copySource();
    const snapshot = structuredClone(input);
    const { resolved, runtime } = validateAndResolveDtcg(input);

    expect(input).toEqual(snapshot);
    expect(resolved.size).toBeGreaterThan(130);
    expect(runtime.modes.light.semantic.color['background-surface']).toBe(
      '#ffffff',
    );
    expect(runtime.modes.dark.component.button['primary-background']).toBe(
      runtime.primitive.color['primary-500'],
    );
  });

  it('carries the typography font-variant extension into the runtime tree', () => {
    const { runtime } = validateAndResolveDtcg(withTypography(copySource()));

    expect(runtime.modes.light.semantic.typography['tabular-number']).toEqual(
      expect.objectContaining({ fontVariantNumeric: 'tabular-nums' }),
    );
  });

  it('supports valid scalar font families and named font weights', () => {
    const input = copySource();
    at(input, ['primitive', 'font-family', 'sans']).$value = 'Inter';
    at(input, ['primitive', 'font-weight', 'medium']).$value = 'normal';

    const { runtime } = validateAndResolveDtcg(input);
    expect(runtime.primitive['font-family'].sans).toBe('"Inter"');
    expect(runtime.primitive['font-weight'].medium).toBe('400');
  });

  it.each([
    ['null root', () => null, /must be a JSON object/u],
    ['empty root', () => ({}), /contains no tokens/u],
    [
      'unknown root property',
      () => Object.assign(copySource(), { $schema: 'unsupported' }),
      /Unsupported group property/u,
    ],
    [
      'invalid group name',
      () => Object.assign(copySource(), { 'bad.name': {} }),
      /Invalid DTCG token\/group name/u,
    ],
    [
      'scalar group entry',
      () => Object.assign(copySource(), { invalid: 42 }),
      /must be an object/u,
    ],
    [
      'unknown type',
      () => {
        const input = copySource();
        input.primitive.color.$type = 'paint';
        return input;
      },
      /Unknown DTCG type/u,
    ],
    [
      'token child property',
      () => {
        const input = copySource();
        at(input, ['primitive', 'color', 'white']).child = {};
        return input;
      },
      /unsupported property/u,
    ],
    [
      'unknown reference',
      () => {
        const input = copySource();
        at(input, ['semantic', 'light', 'color', 'background-canvas']).$value =
          '{primitive.color.absent}';
        return input;
      },
      /Unknown DTCG token reference/u,
    ],
    [
      'circular reference',
      () => {
        const input = copySource();
        at(input, ['primitive', 'color', 'white']).$value =
          '{primitive.color.grey-100}';
        at(input, ['primitive', 'color', 'grey-100']).$value =
          '{primitive.color.white}';
        return input;
      },
      /Circular DTCG reference/u,
    ],
    [
      'interpolated reference',
      () => {
        const input = copySource();
        at(input, ['semantic', 'light', 'color', 'background-canvas']).$value =
          'prefix {primitive.color.white}';
        return input;
      },
      /Malformed or interpolated/u,
    ],
  ])('rejects %s', (_label, createInput, expected) => {
    expect(() => validateAndResolveDtcg(createInput())).toThrow(expected);
  });

  it.each([
    [
      'color space',
      ['primitive', 'color', 'white'],
      { colorSpace: 'display-p3', components: [1, 1, 1] },
      /sRGB/u,
    ],
    [
      'color channel count',
      ['primitive', 'color', 'white'],
      { colorSpace: 'srgb', components: [1, 1] },
      /three channels/u,
    ],
    [
      'color channel range',
      ['primitive', 'color', 'white'],
      { colorSpace: 'srgb', components: [2, 1, 1] },
      /between 0 and 1/u,
    ],
    [
      'color alpha',
      ['primitive', 'color', 'white'],
      { colorSpace: 'srgb', components: [1, 1, 1], alpha: -1 },
      /alpha must be between/u,
    ],
    [
      'dimension object',
      ['primitive', 'spacing', '1'],
      '1rem',
      /dimension object/u,
    ],
    [
      'dimension unit',
      ['primitive', 'spacing', '1'],
      { value: 1, unit: 'em' },
      /unit must be/u,
    ],
    [
      'dimension field',
      ['primitive', 'spacing', '1'],
      { value: 1, unit: 'rem', unexpected: 1 },
      /unexpected is not supported/u,
    ],
    ['font family', ['primitive', 'font-family', 'sans'], [], /font family/u],
    [
      'font weight',
      ['primitive', 'font-weight', 'medium'],
      1001,
      /font weight/u,
    ],
    [
      'duration object',
      ['primitive', 'duration', 'fast'],
      180,
      /duration object/u,
    ],
    [
      'duration unit',
      ['primitive', 'duration', 'fast'],
      { value: -1, unit: 'minutes' },
      /non-negative ms or s/u,
    ],
    [
      'Bézier length',
      ['primitive', 'easing', 'standard'],
      [0, 1],
      /four cubic/u,
    ],
    [
      'Bézier x range',
      ['primitive', 'easing', 'standard'],
      [-1, 0, 2, 1],
      /x coordinates/u,
    ],
    ['shadow empty', ['primitive', 'shadow', 'sm'], [], /at least one shadow/u],
    [
      'shadow record',
      ['primitive', 'shadow', 'sm'],
      [null],
      /must be an object/u,
    ],
    [
      'shadow inset',
      ['primitive', 'shadow', 'sm'],
      {
        ...structuredClone(at(source, ['primitive', 'shadow', 'sm']).$value),
        inset: 'yes',
      },
      /inset must be a boolean/u,
    ],
    [
      'shadow field',
      ['primitive', 'shadow', 'sm'],
      {
        ...structuredClone(at(source, ['primitive', 'shadow', 'sm']).$value),
        unsupported: true,
      },
      /unsupported is not supported/u,
    ],
  ])('rejects invalid %s values', (_label, tokenPath, value, expected) => {
    const input = copySource();
    at(input, tokenPath).$value = value;
    expect(() => validateAndResolveDtcg(input)).toThrow(expected);
  });

  it('rejects incomplete typography and mode drift', () => {
    const typographyInput = withTypography(copySource());
    delete at(typographyInput, ['semantic', 'light', 'typography', 'body'])
      .$value.fontSize;
    expect(() => validateAndResolveDtcg(typographyInput)).toThrow(
      /fontSize is required/u,
    );

    const missingMode = copySource();
    delete missingMode.component.dark.button['focus-ring'];
    expect(() => validateAndResolveDtcg(missingMode)).toThrow(
      /type-matched light and dark/u,
    );

    const invalidMode = copySource();
    invalidMode.component.system = invalidMode.component.dark;
    delete invalidMode.component.dark;
    expect(() => validateAndResolveDtcg(invalidMode)).toThrow(
      /explicit light or dark/u,
    );

    const extensionDrift = withTypography(copySource());
    delete at(extensionDrift, [
      'semantic',
      'dark',
      'typography',
      'tabular-number',
    ]).$extensions;
    expect(() => validateAndResolveDtcg(extensionDrift)).toThrow(
      /type-matched light and dark/u,
    );
  });

  it('rejects cross-type aliases, output-unsafe names, and CSS collisions', () => {
    const crossType = copySource();
    crossType.primitive['line-height'] = {
      $type: 'number',
      normal: { $value: '{primitive.font-weight.medium}' },
    };
    expect(() => validateAndResolveDtcg(crossType)).toThrow(
      /declares number but references fontWeight/u,
    );

    const nestedCrossType = withTypography(copySource());
    at(nestedCrossType, [
      'semantic',
      'light',
      'typography',
      'body',
    ]).$value.lineHeight = '{primitive.font-weight.medium}';
    expect(() => validateAndResolveDtcg(nestedCrossType)).toThrow(
      /lineHeight must reference number, received fontWeight/u,
    );

    const unsafeExtension = withTypography(copySource());
    at(unsafeExtension, [
      'semantic',
      'light',
      'typography',
      'tabular-number',
    ]).$extensions['org.global-torque.css'].fontVariantNumeric =
      'tabular-nums; color: red';
    expect(() => validateAndResolveDtcg(unsafeExtension)).toThrow(
      /safe tabular-nums keyword/u,
    );

    const fontInjection = copySource();
    at(fontInjection, ['primitive', 'font-family', 'sans']).$value =
      'Inter;color:red';
    const fontRuntime = validateAndResolveDtcg(fontInjection).runtime;
    expect(fontRuntime.primitive['font-family'].sans).toBe('"Inter;color:red"');

    const duplicateAnimation = withAnimation(copySource());
    duplicateAnimation.primitive.animation.duplicate = structuredClone(
      duplicateAnimation.primitive.animation['fade-in'],
    );
    expect(() => validateAndResolveDtcg(duplicateAnimation)).toThrow(
      /Animation name gt-fade-in is produced/u,
    );

    const unprefixedAnimation = withAnimation(copySource());
    at(unprefixedAnimation, ['primitive', 'animation', 'fade-in']).$extensions[
      'org.global-torque.css'
    ].name = 'fade-in';
    expect(() => validateAndResolveDtcg(unprefixedAnimation)).toThrow(
      /animation name is not output-safe/u,
    );

    const wrongBreakpointType = copySource();
    wrongBreakpointType.primitive.breakpoint = {
      md: { $type: 'number', $value: 48 },
    };
    expect(() => validateAndResolveDtcg(wrongBreakpointType)).toThrow(
      /must use dimension for generated output/u,
    );

    const unnamedBreakpoint = copySource();
    unnamedBreakpoint.primitive.breakpoint = {
      $type: 'dimension',
      $value: { value: 48, unit: 'rem' },
    };
    expect(() => validateAndResolveDtcg(unnamedBreakpoint)).toThrow(
      /must be a named primitive token below its category/u,
    );

    const invalidOpacity = copySource();
    invalidOpacity.primitive.opacity = {
      $type: 'number',
      disabled: { $value: 2 },
    };
    expect(() => validateAndResolveDtcg(invalidOpacity)).toThrow(
      /opacity must be between 0 and 1/u,
    );

    const wrongAnimationType = withAnimation(copySource());
    const animation = at(wrongAnimationType, [
      'primitive',
      'animation',
      'fade-in',
    ]);
    animation.$type = 'number';
    animation.$value = 2;
    expect(() => validateAndResolveDtcg(wrongAnimationType)).toThrow(
      /must use duration for generated output/u,
    );

    const wrongSemanticType = copySource();
    for (const mode of ['light', 'dark']) {
      wrongSemanticType.semantic[mode].color['positive-border'] = {
        $type: 'dimension',
        $value: { value: 1, unit: 'rem' },
      };
    }
    expect(() => validateAndResolveDtcg(wrongSemanticType)).toThrow(
      /must use color for generated semantic output/u,
    );

    for (const name of ['', 'not safe']) {
      const unsafe = copySource();
      Object.defineProperty(unsafe.primitive.color, name, {
        configurable: true,
        enumerable: true,
        value: {
          $value: { colorSpace: 'srgb', components: [1, 1, 1] },
        },
      });
      expect(() => validateAndResolveDtcg(unsafe)).toThrow(/Invalid DTCG/u);
    }

    const collision = copySource();
    collision.primitive.color['foo-bar'] = {
      $value: { colorSpace: 'srgb', components: [1, 1, 1] },
    };
    collision.primitive.color.foo = {
      bar: { $value: { colorSpace: 'srgb', components: [0, 0, 0] } },
    };
    expect(() => validateAndResolveDtcg(collision)).toThrow(
      /CSS output collision/u,
    );
  });

  it('enforces primitive-to-semantic-to-component reference direction and mode isolation', () => {
    const crossMode = copySource();
    at(crossMode, ['component', 'dark', 'button', 'focus-ring']).$value =
      '{semantic.light.color.border-focus}';
    expect(() => validateAndResolveDtcg(crossMode)).toThrow(
      /across token layer or mode boundaries/u,
    );

    const reverseLayer = copySource();
    at(reverseLayer, ['primitive', 'spacing', '1']).$value =
      '{semantic.light.color.background-surface}';
    expect(() => validateAndResolveDtcg(reverseLayer)).toThrow(
      /across token layer or mode boundaries/u,
    );

    const literalSemantic = copySource();
    at(literalSemantic, [
      'semantic',
      'light',
      'color',
      'background-canvas',
    ]).$value = { colorSpace: 'srgb', components: [1, 1, 1] };
    expect(() => validateAndResolveDtcg(literalSemantic)).toThrow(
      /semantic values must be aliases/u,
    );

    const literalTypographyField = withTypography(copySource());
    at(literalTypographyField, [
      'semantic',
      'light',
      'typography',
      'body',
    ]).$value.fontFamily = ['Inter', 'sans-serif'];
    expect(() => validateAndResolveDtcg(literalTypographyField)).toThrow(
      /fontFamily semantic values must be aliases/u,
    );

    const literalComponent = copySource();
    at(literalComponent, [
      'component',
      'light',
      'button',
      'focus-ring',
    ]).$value = { colorSpace: 'srgb', components: [0, 0, 0] };
    expect(() => validateAndResolveDtcg(literalComponent)).toThrow(
      /component tokens must be direct same-mode aliases/u,
    );

    const primitiveComponent = copySource();
    at(primitiveComponent, [
      'component',
      'light',
      'button',
      'focus-ring',
    ]).$value = '{primitive.color.grey-500}';
    expect(() => validateAndResolveDtcg(primitiveComponent)).toThrow(
      /across token layer or mode boundaries/u,
    );
  });

  it.each([
    [
      'primitive color type',
      (input) => {
        input.primitive.color['teal-500'] = {
          $type: 'dimension',
          $value: { value: 1, unit: 'rem' },
        };
      },
      /must use color for generated output/u,
    ],
    [
      'unknown primitive category',
      (input) => {
        input.primitive.custom = { value: { $type: 'number', $value: 1 } };
      },
      /unsupported primitive output category/u,
    ],
    [
      'negative radius',
      (input) => {
        at(input, ['primitive', 'brand', 'radius']).$value.value = -1;
      },
      /must be non-negative/u,
    ],
    [
      'negative spacing',
      (input) => {
        at(input, ['primitive', 'spacing', '1']).$value.value = -1;
      },
      /must be non-negative/u,
    ],
    [
      'zero font size',
      (input) => {
        at(input, ['primitive', 'font-size', 'sm']).$value.value = 0;
      },
      /must be greater than zero/u,
    ],
    [
      'zero breakpoint',
      (input) => {
        input.primitive.breakpoint = {
          $type: 'dimension',
          md: { $value: { value: 0, unit: 'rem' } },
        };
      },
      /must be greater than zero/u,
    ],
    [
      'zero line height',
      (input) => {
        input.primitive['line-height'] = {
          $type: 'number',
          normal: { $value: 0 },
        };
      },
      /must be greater than zero/u,
    ],
    [
      'non-finite number',
      (input) => {
        input.primitive['line-height'] = {
          $type: 'number',
          normal: { $value: Number.NaN },
        };
      },
      /finite number/u,
    ],
    [
      'negative shadow blur',
      (input) => {
        at(input, ['primitive', 'shadow', 'sm']).$value.blur.value = -1;
      },
      /shadow blur must be non-negative/u,
    ],
  ])('rejects invalid value: %s', (_label, mutate, expected) => {
    const input = copySource();
    mutate(input);
    expect(() => validateAndResolveDtcg(input)).toThrow(expected);
  });
});

describe('artifact generation', () => {
  it('is byte deterministic and emits every public representation', () => {
    const first = generateArtifacts(copySource(), sourceText);
    const second = generateArtifacts(copySource(), sourceText);

    expect([...first]).toEqual([...second]);
    expect([...first.keys()]).toEqual([
      'css.d.ts',
      'css.d.ts.map',
      'css.js',
      'css.js.map',
      'derive.d.ts',
      'derive.js',
      'index.css',
      'index.d.ts',
      'index.d.ts.map',
      'index.js',
      'index.js.map',
      'theme.css',
      'theme.d.ts',
      'theme.d.ts.map',
      'theme.js',
      'theme.js.map',
      'tokens.json',
      'tokens.tokens.json',
      'build-manifest.json',
    ]);
    expect(first.get('index.css')).toContain(':is(.dark, [data-theme="dark"])');
    expect(first.get('index.css')).toContain('--brand-primary: #004fff;');
    expect(first.get('index.css')).not.toContain('--gt-primitive-brand-');
    expect(first.get('index.css')).toContain(
      '--gt-primitive-color-primary-500: var(--brand-primary);',
    );
    expect(first.get('index.css')).toContain(
      '--gt-primitive-color-secondary-500: var(--brand-secondary);',
    );
    expect(first.get('index.css')).toContain('--brand-tertiary: #5b55d6;');
    expect(first.get('index.css')).toContain(
      '--gt-primitive-color-tertiary-500: var(--brand-tertiary);',
    );
    expect(first.get('index.css')).toContain(
      '--gt-primitive-color-tertiary-800: color-mix(in srgb, #000000 45%, var(--brand-tertiary));',
    );
    expect(first.get('index.css')).toContain(
      '--gt-primitive-color-primary-50: color-mix(in srgb, var(--brand-primary) 6%, var(--brand-surface-light));',
    );
    expect(first.get('index.css')).toContain(
      '--gt-primitive-color-primary-200: color-mix(in srgb, var(--brand-primary) 26.9%, var(--brand-surface-light));',
    );
    expect(first.get('index.css')).toContain(
      '--brand-primary-foreground: var(--brand-surface-light);',
    );
    expect(first.get('index.css')).toContain(
      '--gt-primitive-color-primary-foreground: var(--brand-primary-foreground);',
    );
    expect(
      JSON.parse(first.get('tokens.json')).primitive.color['primary-200'],
    ).toBe('#bad0ff');
    expect(first.get('theme.css')).toContain('@theme inline');
    expect(first.get('theme.css')).toContain('--font-weight-gt-medium:');
    expect(first.get('index.d.ts')).not.toContain('Record<string');
    expect(first.get('derive.js')).toBe(
      fs.readFileSync(path.join(packageDirectory, 'src', 'derive.mjs'), 'utf8'),
    );
    expect(first.get('derive.d.ts')).toBe(
      fs.readFileSync(
        path.join(packageDirectory, 'src', 'derive.d.ts'),
        'utf8',
      ),
    );
    const manifest = JSON.parse(first.get('build-manifest.json'));
    const files = Object.fromEntries(
      [...first]
        .filter(([name]) => name !== 'build-manifest.json')
        .map(([name, contents]) => [
          name,
          crypto.createHash('sha512').update(contents).digest('hex'),
        ])
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    );
    expect(manifest).toEqual({
      schemaVersion: 1,
      sha512: crypto
        .createHash('sha512')
        .update(JSON.stringify(files))
        .digest('hex'),
      files,
    });
  });

  it('emits animation keyframes and the Tailwind animation mapping', () => {
    const input = withAnimation(copySource());
    const themeCss = generateArtifacts(input, JSON.stringify(input)).get(
      'theme.css',
    );

    expect(themeCss).toContain('--animate-gt-fade-in:');
    expect(themeCss).toContain('@keyframes gt-fade-in');
  });

  it('performs an atomic build with no stale temporary output', async () => {
    await import('../build.mjs');
    const expected = generateArtifacts(copySource(), sourceText);
    for (const [name, contents] of expected) {
      expect(
        fs.readFileSync(path.join(packageDirectory, 'dist', name), 'utf8'),
      ).toBe(contents);
    }
    expect(
      fs
        .readdirSync(packageDirectory)
        .filter(
          (name) =>
            name.startsWith('.dist-') || name.startsWith('dist.previous-'),
        ),
    ).toEqual([]);
  });

  it('ships deriveBrand and its mix table as the only exports', async () => {
    const shipped = await import(
      pathToFileURL(path.join(packageDirectory, 'dist', 'derive.js')).href
    );
    expect(Object.keys(shipped)).toEqual(['BRAND_MIXES', 'deriveBrand']);
  });

  it('keeps the built JS, JSON, CSS, declarations, and source maps in parity', async () => {
    const moduleUrl = `${pathToFileURL(path.join(packageDirectory, 'dist', 'index.js')).href}?test=${Date.now()}`;
    const runtimeModule = await import(moduleUrl);
    const json = JSON.parse(
      fs.readFileSync(
        path.join(packageDirectory, 'dist', 'tokens.json'),
        'utf8',
      ),
    );
    const css = fs.readFileSync(
      path.join(packageDirectory, 'dist', 'index.css'),
      'utf8',
    );
    const declaration = fs.readFileSync(
      path.join(packageDirectory, 'dist', 'index.d.ts'),
      'utf8',
    );
    const sourceMap = JSON.parse(
      fs.readFileSync(
        path.join(packageDirectory, 'dist', 'index.js.map'),
        'utf8',
      ),
    );
    const declarationMap = JSON.parse(
      fs.readFileSync(
        path.join(packageDirectory, 'dist', 'index.d.ts.map'),
        'utf8',
      ),
    );

    expect(runtimeModule.designTokens).toEqual(json);
    expect(runtimeModule.default).toBe(runtimeModule.designTokens);
    expect(Object.isFrozen(runtimeModule.designTokens)).toBe(true);
    expect(
      Object.isFrozen(runtimeModule.designTokens.modes.dark.component.toast),
    ).toBe(true);
    const expectedVariables = runtimeCssVariables(json);
    const baseVariables = parseCssVariables(css, ':root');
    expect(sortedObject(resolveCssVariables(baseVariables))).toEqual(
      sortedObject(expectedVariables.base),
    );
    expect(
      sortedObject(
        resolveCssVariables(
          parseCssVariables(css, ':is(.dark, [data-theme="dark"])'),
          baseVariables,
        ),
      ),
    ).toEqual(sortedObject(expectedVariables.dark));
    expect(declarationDesignTokens(declaration)).toEqual(json);
    expect(sourceMap.sources).toEqual(['../src/tokens.tokens.json']);
    expect(sourceMap.sourcesContent).toEqual([sourceText]);
    expect(sourceMap.mappings).not.toBe('');

    const semanticOffset = sourceText.indexOf('"semantic"');
    const darkOffset = sourceText.indexOf('"dark"', semanticOffset);
    const tokenOffset = sourceText.indexOf('"background-surface"', darkOffset);
    const expectedSourceLine = sourceText
      .slice(0, tokenOffset)
      .split('\n').length;
    const declarationLine = declaration
      .split('\n')
      .findIndex((line) => line.includes('"background-surface"'));
    const javascript = fs.readFileSync(
      path.join(packageDirectory, 'dist', 'index.js'),
      'utf8',
    );
    const javascriptLine = javascript
      .split('\n')
      .findIndex((line) => line.includes('\\"background-surface\\"'));
    expect(declarationLine).toBeGreaterThan(0);
    expect(javascriptLine).toBeGreaterThan(0);
    expect(
      originalPositionFor(new TraceMap(declarationMap), {
        line: declarationLine + 1,
        column: 0,
      }).line,
    ).toBe(expectedSourceLine);
    expect(
      originalPositionFor(new TraceMap(sourceMap), {
        line: javascriptLine + 1,
        column: 0,
      }).line,
    ).toBe(expectedSourceLine);
  });

  it('preserves valid prototype-looking names without mutating prototypes', () => {
    const input = copySource();
    Object.defineProperty(input.primitive.color, '__proto__', {
      configurable: true,
      enumerable: true,
      value: {
        $value: { colorSpace: 'srgb', components: [1, 1, 1] },
      },
    });

    const { runtime } = validateAndResolveDtcg(input);
    expect(Object.hasOwn(runtime.primitive.color, '__proto__')).toBe(true);
    expect(runtime.primitive.color.__proto__).toBe('#ffffff');
    expect({}.polluted).toBeUndefined();

    const output = JSON.parse(
      generateArtifacts(input, JSON.stringify(input)).get('tokens.json'),
    );
    expect(Object.hasOwn(output.primitive.color, '__proto__')).toBe(true);
    expect(output.primitive.color.__proto__).toBe('#ffffff');
  });

  it('sorts Unicode token names by code point instead of process locale', () => {
    const input = copySource();
    for (const name of ['å', 'z', 'ä', 'a']) {
      input.primitive.color[name] = {
        $value: { colorSpace: 'srgb', components: [1, 1, 1] },
      };
    }
    const { runtime } = validateAndResolveDtcg(input);
    expect(
      Object.keys(runtime.primitive.color).filter((name) =>
        ['å', 'z', 'ä', 'a'].includes(name),
      ),
    ).toEqual(['a', 'z', 'ä', 'å']);
  });

  it('formats every supported atomic CSS type and rejects composite misuse', () => {
    expect(
      toCssValue('color', { colorSpace: 'srgb', components: [1, 0, 0] }),
    ).toBe('#ff0000');
    expect(toCssValue('dimension', { value: 0, unit: 'rem' })).toBe('0px');
    expect(toCssValue('fontFamily', ['Public Sans', 'sans-serif'])).toBe(
      '"Public Sans", sans-serif',
    );
    expect(toCssValue('fontFamily', ['SANS-SERIF', 'emoji'])).toBe(
      'SANS-SERIF, emoji',
    );
    expect(toCssValue('fontWeight', 'medium')).toBe('500');
    expect(toCssValue('fontWeight', 'extra-black')).toBe('950');
    expect(toCssValue('duration', { value: 0.2, unit: 's' })).toBe('0.2s');
    expect(toCssValue('dimension', { value: 0.00001, unit: 'rem' })).toBe(
      '0.00001rem',
    );
    expect(toCssValue('number', -0)).toBe('0');
    expect(toCssValue('cubicBezier', [0.123456, 0, 0.987654, 1])).toBe(
      'cubic-bezier(0.123456, 0, 0.987654, 1)',
    );
    expect(toCssValue('cubicBezier', [0, 0, 1, 1])).toBe(
      'cubic-bezier(0, 0, 1, 1)',
    );
    const insetShadow = structuredClone(
      at(source, ['primitive', 'shadow', 'sm']).$value,
    );
    insetShadow.inset = true;
    expect(toCssValue('shadow', insetShadow)).toMatch(/^inset /u);
    const insetSource = copySource();
    at(insetSource, ['primitive', 'shadow', 'sm']).$value.inset = true;
    const insetArtifacts = generateArtifacts(
      insetSource,
      JSON.stringify(insetSource),
    );
    expect(
      JSON.parse(insetArtifacts.get('tokens.json')).primitive.shadow.sm,
    ).toMatch(/^inset /u);
    expect(insetArtifacts.get('index.css')).toContain(
      '--gt-primitive-shadow-sm: inset ',
    );
    expect(() => toCssValue('typography', {})).toThrow(/Cannot represent/u);
  });
});

describe('brand ramps', () => {
  it('names the seed that is missing or not a literal color', () => {
    expect(() => brandRamps({})).toThrow('primitive.brand.primary is missing.');
    expect(() => brandRamps({ primary: '#004fff' })).toThrow(
      'primitive.brand.primary must be a literal color.',
    );
  });

  it('rejects a brand seed written as an alias', () => {
    const input = copySource();
    input.primitive.brand.primary = {
      $type: 'color',
      $value: '{primitive.color.primary-600}',
    };
    expect(() => validateAndResolveDtcg(input)).toThrow(
      /primary must be a literal color/u,
    );
  });

  it('rejects a brand seed of an unsupported type', () => {
    const input = copySource();
    input.primitive.brand.pause = {
      $type: 'duration',
      $value: { value: 1, unit: 'ms' },
    };
    expect(() => validateAndResolveDtcg(input)).toThrow(
      /must be a color, dimension or fontFamily brand seed/u,
    );
  });

  it('rejects a generated step that drifted from its seeds', () => {
    const input = copySource();
    input.primitive.color['primary-600'].$value.components = [0, 0, 0];
    expect(() => validateAndResolveDtcg(input)).toThrow(/tokens:derive/u);
  });

  it('rejects a missing generated step', () => {
    const input = copySource();
    delete input.primitive.color['secondary-50'];
    expect(() => validateAndResolveDtcg(input)).toThrow(
      /secondary-50 is missing/u,
    );
  });

  it('rejects an anchor step written as a literal', () => {
    const input = copySource();
    input.primitive.color['primary-500'] = {
      $value: { colorSpace: 'srgb', components: [0, 0.3098, 1] },
    };
    expect(() => validateAndResolveDtcg(input)).toThrow(
      /primary-500 must alias \{primitive\.brand\.primary\}/u,
    );
  });
});
