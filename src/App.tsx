import React, { useState } from 'react';
import { useUserStore } from './store/useUserStore';
import { ScreenType } from './types';
import { FloatingNavbar } from './components/FloatingNavbar';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { FridgeScreen } from './screens/FridgeScreen';
import { ManualAddScreen } from './screens/ManualAddScreen';
import { ScannerScreen } from './screens/ScannerScreen';
import { GeneratorScreen } from './screens/GeneratorScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { RecipeDetailScreen } from './screens/RecipeDetailScreen';
import { AdaptRecipeScreen } from './screens/AdaptRecipeScreen';
import { CookingModeScreen } from './screens/CookingModeScreen';
import { SocialImportScreen } from './screens/SocialImportScreen';
import { SavedRecipesScreen } from './screens/SavedRecipesScreen';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { ShoppingListScreen } from './screens/ShoppingListScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PremiumScreen } from './screens/PremiumScreen';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const { theme } = useUserStore();
  const isDark = theme === 'dark' || currentScreen === 'cooking-mode' || currentScreen === 'scanner' || currentScreen === 'premium';

  // Hide bottom navbar on full-screen flows like onboarding, cooking mode, camera scanner, and paywall
  const hideNavbar = ['onboarding', 'cooking-mode', 'scanner', 'premium', 'adapt-recipe', 'manual-add'].includes(currentScreen);

  return (
    <div className={`mobile-wrapper ${isDark ? 'dark-mode' : ''}`}>
      {/* Mobile Top Status Bar & Notch */}
      <div className="status-bar" style={{ color: isDark ? '#FFFFFF' : '#0B0D0A' }}>
        <span>9:41</span>
        <div className="notch" />
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px' }}>5G</span>
          <div style={{ width: '18px', height: '10px', border: '1px solid currentColor', borderRadius: '3px', padding: '1px', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%', height: '100%', backgroundColor: 'currentColor' }} />
          </div>
        </div>
      </div>

      {/* Screen Router Body */}
      <div className="app-screen-container">
        {currentScreen === 'onboarding' && <OnboardingScreen onComplete={() => setCurrentScreen('home')} />}
        {currentScreen === 'home' && <HomeScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'fridge' && <FridgeScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'manual-add' && <ManualAddScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'scanner' && <ScannerScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'generator' && <GeneratorScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'results' && <ResultsScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'recipe-detail' && <RecipeDetailScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'adapt-recipe' && <AdaptRecipeScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'cooking-mode' && <CookingModeScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'social-import' && <SocialImportScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'saved' && <SavedRecipesScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'collections' && <CollectionsScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'shopping' && <ShoppingListScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'notifications' && <NotificationsScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'profile' && <ProfileScreen onNavigate={setCurrentScreen} />}
        {currentScreen === 'premium' && <PremiumScreen onNavigate={setCurrentScreen} />}
      </div>

      {/* Floating Capsule Bottom Navbar */}
      {!hideNavbar && (
        <FloatingNavbar 
          currentScreen={currentScreen}
          onNavigate={setCurrentScreen}
        />
      )}
    </div>
  );
};
