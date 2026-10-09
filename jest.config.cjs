module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/unit/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.cjs'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }], ['@babel/preset-react', { runtime: 'automatic' }], '@babel/preset-typescript'] }] },
  moduleNameMapper: { '\\.module\\.css$': 'identity-obj-proxy' },
  collectCoverageFrom: ['src/components/*.{ts,tsx}', 'src/pages/*.{ts,tsx}', 'src/context/*.{ts,tsx}', 'src/lib/library.ts', 'src/lib/openLibrary.ts'],
  clearMocks: true,
};
