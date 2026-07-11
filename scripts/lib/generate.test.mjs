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
  REQUIRED_CONTRAST_PAIRS,
  assertRequiredContrast,
  contrastRatio,
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
      `--gt-primitive-${pathSegments.join('-')}`,
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
      '#5eead4',
    );
    expect(runtime.modes.light.semantic.typography['tabular-number']).toEqual(
      expect.objectContaining({
        fontFamily: expect.stringContaining('ui-monospace'),
        fontVariantNumeric: 'tabular-nums',
      }),
    );
  });

  it('supports valid scalar font families and named font weights', () => {
    const input = copySource();
    at(input, ['primitive', 'font-family', 'sans']).$value = 'Inter';
    at(input, ['primitive', 'font-weight', 'regular']).$value = 'normal';

    const { runtime } = validateAndResolveDtcg(input);
    expect(runtime.primitive['font-family'].sans).toBe('"Inter"');
    expect(runtime.primitive['font-weight'].regular).toBe('400');
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
          '{primitive.color.black}';
        at(input, ['primitive', 'color', 'black']).$value =
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
      ['primitive', 'font-weight', 'regular'],
      1001,
      /font weight/u,
    ],
    [
      'number',
      ['primitive', 'line-height', 'normal'],
      Number.NaN,
      /finite number/u,
    ],
    [
      'duration object',
      ['primitive', 'duration', 'normal'],
      180,
      /duration object/u,
    ],
    [
      'duration unit',
      ['primitive', 'duration', 'normal'],
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
    const typographyInput = copySource();
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

    const extensionDrift = copySource();
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
    at(crossType, ['primitive', 'line-height', 'normal']).$value =
      '{primitive.font-weight.medium}';
    expect(() => validateAndResolveDtcg(crossType)).toThrow(
      /declares number but references fontWeight/u,
    );

    const nestedCrossType = copySource();
    at(nestedCrossType, [
      'semantic',
      'light',
      'typography',
      'body',
    ]).$value.lineHeight = '{primitive.font-weight.regular}';
    expect(() => validateAndResolveDtcg(nestedCrossType)).toThrow(
      /lineHeight must reference number, received fontWeight/u,
    );

    const unsafeExtension = copySource();
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

    const duplicateAnimation = copySource();
    duplicateAnimation.primitive.animation.duplicate = structuredClone(
      duplicateAnimation.primitive.animation['fade-in'],
    );
    expect(() => validateAndResolveDtcg(duplicateAnimation)).toThrow(
      /Animation name gt-fade-in is produced/u,
    );

    const unprefixedAnimation = copySource();
    at(unprefixedAnimation, ['primitive', 'animation', 'fade-in']).$extensions[
      'org.global-torque.css'
    ].name = 'fade-in';
    expect(() => validateAndResolveDtcg(unprefixedAnimation)).toThrow(
      /animation name is not output-safe/u,
    );

    const wrongBreakpointType = copySource();
    wrongBreakpointType.primitive.breakpoint.md = {
      $type: 'number',
      $value: 48,
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
    at(invalidOpacity, ['primitive', 'opacity', 'disabled']).$value = 2;
    expect(() => validateAndResolveDtcg(invalidOpacity)).toThrow(
      /opacity must be between 0 and 1/u,
    );

    const wrongAnimationType = copySource();
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

    const literalTypographyField = copySource();
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
    ]).$value = '{primitive.color.teal-700}';
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
        at(input, ['primitive', 'radius', 'md']).$value.value = -1;
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
        at(input, ['primitive', 'font-size', 'base']).$value.value = 0;
      },
      /must be greater than zero/u,
    ],
    [
      'zero breakpoint',
      (input) => {
        at(input, ['primitive', 'breakpoint', 'md']).$value.value = 0;
      },
      /must be greater than zero/u,
    ],
    [
      'zero line height',
      (input) => {
        at(input, ['primitive', 'line-height', 'normal']).$value = 0;
      },
      /must be greater than zero/u,
    ],
    [
      'negative shadow blur',
      (input) => {
        at(input, ['primitive', 'shadow', 'sm']).$value.blur.value = -1;
      },
      /shadow blur must be non-negative/u,
    ],
  ])('rejects invalid CSS-context value: %s', (_label, mutate, expected) => {
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
    expect(first.get('index.css')).toContain(
      '--gt-typography-tabular-number-font-variant-numeric: tabular-nums;',
    );
    expect(first.get('theme.css')).toContain('@theme inline');
    expect(first.get('theme.css')).toContain('--font-weight-gt-semibold:');
    expect(first.get('theme.css')).toContain('--animate-gt-fade-in:');
    expect(first.get('index.d.ts')).not.toContain('Record<string');
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
    expect(sortedObject(parseCssVariables(css, ':root'))).toEqual(
      sortedObject(expectedVariables.base),
    );
    expect(
      sortedObject(parseCssVariables(css, ':is(.dark, [data-theme="dark"])')),
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

describe('contrast requirements', () => {
  it('enforces every documented semantic foreground/background pair in both modes', () => {
    const { runtime } = validateAndResolveDtcg(copySource());
    expect(REQUIRED_CONTRAST_PAIRS).toHaveLength(9);
    expect(() => assertRequiredContrast(runtime)).not.toThrow();

    for (const mode of ['light', 'dark']) {
      const colors = runtime.modes[mode].semantic.color;
      for (const [foreground, background] of REQUIRED_CONTRAST_PAIRS) {
        expect(
          contrastRatio(colors[foreground], colors[background]),
        ).toBeGreaterThanOrEqual(4.5);
      }
      const input = runtime.modes[mode].component.input;
      expect(
        contrastRatio(input.border, input.background),
      ).toBeGreaterThanOrEqual(3);
      const button = runtime.modes[mode].component.button;
      expect(
        contrastRatio(
          button['primary-foreground'],
          button['primary-background'],
        ),
      ).toBeGreaterThanOrEqual(4.5);
      for (const [componentName, foregroundName, backgroundName] of [
        ['input', 'foreground', 'background'],
        ['dialog', 'foreground', 'background'],
        ['toast', 'positive-foreground', 'positive-background'],
        ['toast', 'negative-foreground', 'negative-background'],
        ['toast', 'neutral-foreground', 'neutral-background'],
      ]) {
        const component = runtime.modes[mode].component[componentName];
        expect(
          contrastRatio(component[foregroundName], component[backgroundName]),
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrastRatio(
          button['primary-foreground'],
          button['primary-background-hover'],
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('rejects unsupported color encodings and insufficient contrast', () => {
    expect(() => contrastRatio('rgb(0 0 0)', '#ffffff')).toThrow(/opaque hex/u);
    const { runtime } = validateAndResolveDtcg(copySource());
    runtime.modes.light.semantic.color['foreground-default'] = '#ffffff';
    expect(() => assertRequiredContrast(runtime)).toThrow(
      /contrast .* is below/u,
    );

    const boundaryRuntime = validateAndResolveDtcg(copySource()).runtime;
    boundaryRuntime.modes.dark.component.input.border =
      boundaryRuntime.modes.dark.component.input.background;
    expect(() => assertRequiredContrast(boundaryRuntime)).toThrow(
      /input border\/background contrast .* is below 3/u,
    );

    const focusRuntime = validateAndResolveDtcg(copySource()).runtime;
    focusRuntime.modes.light.semantic.color['border-focus'] =
      focusRuntime.modes.light.semantic.color['background-surface'];
    expect(() => assertRequiredContrast(focusRuntime)).toThrow(
      /border-focus\/background-.* contrast .* is below 3/u,
    );

    const inputFocusRuntime = validateAndResolveDtcg(copySource()).runtime;
    inputFocusRuntime.modes.dark.component.input['border-focus'] =
      inputFocusRuntime.modes.dark.component.input.background;
    expect(() => assertRequiredContrast(inputFocusRuntime)).toThrow(
      /input focus border\/background contrast .* is below 3/u,
    );

    const buttonRuntime = validateAndResolveDtcg(copySource()).runtime;
    buttonRuntime.modes.light.component.button['primary-background'] =
      '#ffffff';
    buttonRuntime.modes.light.component.button['primary-background-hover'] =
      '#ffffff';
    buttonRuntime.modes.light.component.button['primary-foreground'] =
      '#ffffff';
    expect(() => assertRequiredContrast(buttonRuntime)).toThrow(
      /button primary-foreground\/primary-background contrast .* is below/u,
    );

    const buttonFocusRuntime = validateAndResolveDtcg(copySource()).runtime;
    buttonFocusRuntime.modes.dark.component.button['focus-ring'] =
      buttonFocusRuntime.modes.dark.semantic.color['background-surface'];
    expect(() => assertRequiredContrast(buttonFocusRuntime)).toThrow(
      /button focus-ring\/background-.* contrast .* is below 3/u,
    );

    for (const [componentName, foregroundName, backgroundName] of [
      ['input', 'foreground', 'background'],
      ['dialog', 'foreground', 'background'],
      ['toast', 'positive-foreground', 'positive-background'],
      ['toast', 'negative-foreground', 'negative-background'],
      ['toast', 'neutral-foreground', 'neutral-background'],
    ]) {
      const componentRuntime = validateAndResolveDtcg(copySource()).runtime;
      const component = componentRuntime.modes.light.component[componentName];
      component[foregroundName] = component[backgroundName];
      expect(() => assertRequiredContrast(componentRuntime)).toThrow(
        new RegExp(
          `${componentName} ${foregroundName}/${backgroundName} contrast .* is below`,
          'u',
        ),
      );
    }
  });
});
