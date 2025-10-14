/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(spec|test).ts'],

  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tsconfig.json',
      isolatedModules: true, // 👈 fixes duplicate identifier bug
    }],
  },

  // Needed to handle Solana + Anchor ESM packages
  transformIgnorePatterns: ['node_modules/(?!(@solana|@coral-xyz)/)'],

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  globals: {
    'ts-jest': {
      useESM: false,
    },
  },
};
