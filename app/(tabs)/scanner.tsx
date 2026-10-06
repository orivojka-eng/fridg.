import { Redirect } from 'expo-router';

/**
 * The scanner lives at the root stack as a full-screen modal so the tab bar
 * never overlays the viewfinder. This tab route only exists so the centre
 * tab button has a slot; anything that lands here is forwarded.
 */
export default function ScannerTabRedirect() {
  return <Redirect href="/scan" />;
}
