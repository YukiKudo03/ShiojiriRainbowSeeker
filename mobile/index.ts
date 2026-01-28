import { registerRootComponent } from 'expo';

import App from './App';
import { setE2ETestMode } from './src/utils/testMode';

// Set E2E test mode flag if running under Detox
// This must run before App renders to disable animations properly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny = global as any;
if (globalAny.__DETOX_TESTING) {
  setE2ETestMode(true);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
