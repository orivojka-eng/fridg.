import React, { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack, SplashScreen, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserStore } from '../src/store/useUserStore';
import { warmUpServer } from '../src/api/http';
import { useTheme, motion, colors } from '../src/theme';
import { SplashOverlay } from '../src/components/SplashOverlay';

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootStack() {
  const t = useTheme();
  const router = useRouter();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const introSeen = useUserStore((s) => s.introSeen);
  const emailVerified = useUserStore((s) => s.emailVerified);
  const justLoggedIn = useUserStore((s) => s.justLoggedIn);
  const profileReadyPending = useUserStore((s) => s.profileReadyPending);
  const hasOnboarded = useUserStore((s) => s.hasOnboarded);

  // Logging out removes the focused (tabs) route from the navigator. The
  // guards make the auth screens the only routes left; this explicit
  // replace (after that re-render) lands on the welcome screen cleanly
  // instead of leaving the stack to rebuild itself mid-press.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      const timer = setTimeout(() => router.replace('/auth/welcome'), 0);
      wasAuthenticated.current = isAuthenticated;
      return () => clearTimeout(timer);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, router]);

  const modal = {
    presentation: 'modal' as const,
    animation: 'slide_from_bottom' as const,
    animationDuration: motion.slow,
    gestureEnabled: true,
  };
  const fullscreen = {
    presentation: 'fullScreenModal' as const,
    animation: 'fade_from_bottom' as const,
    animationDuration: motion.slow,
  };

  return (
    <>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
          // Native iOS push curve; Android gets the same slide with a tuned duration.
          animation: Platform.OS === 'ios' ? 'ios_from_right' : 'slide_from_right',
          animationDuration: 280,
          animationTypeForReplace: 'push',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        {/*
         * Route availability is declared with guards, in priority order:
         *   signed out            → auth screens only
         *   just logged in        → the one-off "welcome back" screen
         *   signed in + onboarded → the app
         *   signed in             → onboarding (also reopened from Profile → Preferences)
         * The router lands on the first available route, so no imperative
         * redirects are needed while the container is mounting.
         */}
        <Stack.Protected guard={!isAuthenticated && !introSeen}>
          <Stack.Screen name="auth/intro" options={{ animation: "fade", animationDuration: motion.slow, contentStyle: { backgroundColor: colors.bgLight } }} />
        </Stack.Protected>

        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="auth/welcome" options={{ animation: 'fade', animationDuration: motion.slow }} />
          <Stack.Screen name="auth/signup" />
          <Stack.Screen name="auth/login" />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated && !emailVerified}>
          <Stack.Screen name="auth/verify" options={{ animation: "fade", animationDuration: motion.slow }} />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated && emailVerified && justLoggedIn}>
          <Stack.Screen name="auth/welcome-back" options={{ animation: 'fade', animationDuration: motion.slow, contentStyle: { backgroundColor: t.black } }} />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated && emailVerified && hasOnboarded && profileReadyPending}>
          <Stack.Screen name="auth/profile-ready" options={{ animation: "fade", animationDuration: motion.slow, contentStyle: { backgroundColor: colors.primaryLime } }} />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated && emailVerified && hasOnboarded && !justLoggedIn && !profileReadyPending}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade', animationDuration: motion.base }} />
          <Stack.Screen name="scan" options={{ ...fullscreen, contentStyle: { backgroundColor: t.black } }} />
          <Stack.Screen name="fridge/index" />
          <Stack.Screen name="fridge/add-manual" options={modal} />
          <Stack.Screen name="recipe/[id]" />
          <Stack.Screen name="recipe/generate" />
          <Stack.Screen name="recipe/results" options={{ animation: 'fade_from_bottom', animationDuration: motion.slow }} />
          <Stack.Screen name="recipe/adapt" />
          <Stack.Screen name="recipe/create" options={modal} />
          <Stack.Screen name="recipe/cooking/[id]" options={{ ...fullscreen, contentStyle: { backgroundColor: t.black } }} />
          <Stack.Screen name="social/import" />
          <Stack.Screen name="collections/index" />
          <Stack.Screen name="collections/[id]" />
          <Stack.Screen name="shopping/index" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="legal/privacy" />
          <Stack.Screen name="legal/terms" />
          <Stack.Screen name="support" />
          <Stack.Screen name="account/delete" />
          <Stack.Screen name="premium" options={{ ...fullscreen, animation: 'slide_from_bottom', contentStyle: { backgroundColor: t.black } }} />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated && emailVerified}>
          <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', animation: 'fade', animationDuration: motion.slow }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Galdeano is the display face from design folder → "font of the letters".
  const [fontsLoaded, fontError] = useFonts({
    Galdeano: require('../assets/fonts/Galdeano-Regular.ttf'),
  });
  // A stored session (backend mode) is checked while the splash plays so the
  // guards never flash the intro at a signed-in user.
  const sessionChecked = useUserStore((u) => u.sessionChecked);
  const restoreSession = useUserStore((u) => u.restoreSession);
  const ready = !!(fontsLoaded || fontError) && sessionChecked;
  const [splashDone, setSplashDone] = useState(false);
  const setBootDone = useUserStore((u) => u.setBootDone);

  // Hand over from the native splash (same logo, same black) to our animated one.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    warmUpServer();
    restoreSession().catch(() => undefined);
  }, [restoreSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.black }}>
          {ready && <RootStack />}
          {!splashDone && <SplashOverlay ready={ready} onExitStart={setBootDone} onDone={() => setSplashDone(true)} />}
        </View>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
