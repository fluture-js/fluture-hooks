import pkg from './package.json';

const dependencyNames = Array.prototype.concat.call (
  Object.keys (pkg.dependencies),
  Object.keys (pkg.peerDependencies),
  ['fluture/index.js', 'callgebra/index.js']
);

export default {
  input: 'index.js',
  external: dependencyNames,
  output: {
    format: 'umd',
    file: 'dist/umd.js',
    name: 'flutureHooks',
    exports: 'named',
    interop: false,
    paths: {
      'fluture/index.js': 'fluture',
      'callgebra/index.js': 'callgebra',
    },
    globals: {
      'fluture/index.js': 'Fluture',
      'callgebra/index.js': 'callgebra',
    },
  },
};
