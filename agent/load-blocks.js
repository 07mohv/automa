const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const SHARED_PATH = path.join(__dirname, '../src/utils/shared.js');

let cached = null;
let cachedMtime = 0;

function loadSharedModule() {
  const stat = fs.statSync(SHARED_PATH);
  if (cached && cachedMtime === stat.mtimeMs) return cached;

  const source = fs.readFileSync(SHARED_PATH, 'utf8');
  const transformed = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    filename: SHARED_PATH,
    sourceMaps: false,
    presets: [
      [
        '@babel/preset-env',
        {
          modules: 'commonjs',
          targets: { node: '18' },
        },
      ],
    ],
  });

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    console,
  };
  vm.runInNewContext(transformed.code, sandbox, { filename: SHARED_PATH });
  cached = module.exports;
  cachedMtime = stat.mtimeMs;
  return cached;
}

function loadBlocks() {
  const shared = loadSharedModule();
  return {
    tasks: shared.tasks,
    categories: shared.categories,
    excludeOnError: shared.excludeOnError,
    contentTypes: shared.contentTypes,
    conditionBuilder: shared.conditionBuilder,
  };
}

module.exports = {
  SHARED_PATH,
  loadBlocks,
  loadSharedModule,
};
