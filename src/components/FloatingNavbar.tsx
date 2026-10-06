import React from 'react';
import { Home, Compass, Scan, Bookmark, User } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { ScreenType } from '../types';

interface NavbarProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
}

export const FloatingNavbar: React.FC<NavbarProps> = ({ currentScreen, onNavigate }) => {
  const { theme } = useUserStore();
  const isDark = theme === 'dark';

  return (
    <div className={`floating-navbar-container ${isDark ? 'dark-mode' : ''}`}>
      <button 
        className={`nav-item ${currentScreen === 'home' ? 'active' : ''}`}
        onClick={() => onNavigate('home')}
      >
        <Home size={22} strokeWidth={currentScreen === 'home' ? 2.5 : 1.8} />
        <span>Home</span>
      </button>

      <button 
        className={`nav-item ${currentScreen === 'social-import' || currentScreen === 'collections' ? 'active' : ''}`}
        onClick={() => onNavigate('social-import')}
      >
        <Compass size={22} strokeWidth={currentScreen === 'social-import' ? 2.5 : 1.8} />
        <span>Discover</span>
      </button>

      <button 
        className="fab-scanner"
        title="Scan Fridge"
        onClick={() => onNavigate('scanner')}
      >
        <Scan size={24} strokeWidth={2.5} />
      </button>

      <button 
        className={`nav-item ${currentScreen === 'saved' ? 'active' : ''}`}
        onClick={() => onNavigate('saved')}
      >
        <Bookmark size={22} strokeWidth={currentScreen === 'saved' ? 2.5 : 1.8} />
        <span>Saved</span>
      </button>

      <button 
        className={`nav-item ${currentScreen === 'profile' ? 'active' : ''}`}
        onClick={() => onNavigate('profile')}
      >
        <User size={22} strokeWidth={currentScreen === 'profile' ? 2.5 : 1.8} />
        <span>Profile</span>
      </button>
    </div>
  );
};
