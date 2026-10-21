const fs = require('fs');
const vm = require('vm');
const babel = require('@babel/core');

const cache = new Map();

function loadEsm(filePath) {
  const stat = fs.statSync(filePath);
  const cached = cache.get(filePath);
  if (cached && cached.mtime === stat.mtimeMs) return cached.exports;

  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    filename: filePath,
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
  vm.runInNewContext(transformed.code, sandbox, { filename: filePath });
  cache.set(filePath, { mtime: stat.mtimeMs, exports: module.exports });
  return module.exports;
}

module.exports = { loadEsm };
