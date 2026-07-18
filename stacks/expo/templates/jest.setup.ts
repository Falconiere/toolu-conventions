// Jest setup — native-module mocks that would otherwise crash in the Node test
// environment. Keep this lean: add a mock ONLY when a real test needs the module
// and the default jest-expo behavior isn't enough. These mock native boundaries
// explicitly, not app logic, so tests still exercise real integration paths.

// react-native-gesture-handler ships a jest setup that registers no-op handlers.
// Guarded so a version without this path doesn't fail the whole suite.
try {
  require('react-native-gesture-handler/jestSetup');
} catch {
  // gesture-handler not installed yet — fine for the bare baseline.
}

// react-native-reanimated ships a jest mock. Enable it once Reanimated is
// actually exercised in a test (the mock API differs slightly by major version,
// so follow the installed version's docs):
//
//   require('react-native-reanimated').setUpTests?.();
//
// Leaving it commented keeps the baseline suite green before any animation code.

// Add further mocks below as you introduce native modules
// (e.g. @react-native-async-storage/async-storage, expo-secure-store).
