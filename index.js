import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(() => <GestureHandlerRootView style={{ flex: 1 }}><ExpoRoot /></GestureHandlerRootView>);
