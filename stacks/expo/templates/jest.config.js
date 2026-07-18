/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  // jest-expo transforms RN/Expo packages; extend the allowlist for any other
  // package that ships untranspiled ESM/Flow. Add libs here as you install them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|react-native-reanimated|react-native-gesture-handler|@tanstack/.*)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  moduleNameMapper: {
    '^@/ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/api/(.*)$': '<rootDir>/src/api/$1',
    '^@/utilities/(.*)$': '<rootDir>/src/utilities/$1',
    '^@/providers/(.*)$': '<rootDir>/src/providers/$1',
    '^@/constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
  },
};
