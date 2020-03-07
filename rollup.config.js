export default {
  input: 'index.js',
  external: ['fluture/index.js', 'callgebra/index.js'],
  output: {
    format: 'umd',
    name: 'flutureHooks',
    file: 'index.cjs',
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
