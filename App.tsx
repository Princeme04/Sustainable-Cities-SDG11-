import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MapDashboardScreen from './src/screens/MapDashboardScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <MapDashboardScreen />
    </SafeAreaProvider>
  );
}
