import React from 'react';
import { Sun, Moon, ChevronRight, Plus, Heart, ShoppingBag, Sliders, Bell } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { ScreenType } from '../types';

interface ProfileProps {
  onNavigate: (screen: ScreenType) => void;
}

export const ProfileScreen: React.FC<ProfileProps> = ({ onNavigate }) => {
  const { profile, theme, toggleTheme } = useUserStore();

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0B0D0A' }}>Profile</h1>
        <button 
          onClick={toggleTheme}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {theme === 'light' ? <Sun size={18} color="#14180F" /> : <Moon size={18} color="#C8F24A" />}
        </button>
      </div>

      {/* User Info Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          backgroundColor: '#EFEADA',
          backgroundImage: 'repeating-linear-gradient(45deg, #E7EEDD 0, #E7EEDD 8px, #EFEADA 8px, #EFEADA 16px)'
        }} />
        <div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#14180F' }}>{profile.name}</div>
          <div style={{ fontSize: '13px', color: '#8D9187' }}>{profile.handle} • {profile.bio}</div>
        </div>
      </div>

      {/* 4 Stats Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '12px 4px', borderRadius: '18px', border: '1px solid #DADAD6' }}>
          <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>{profile.savedCount}</div>
          <div style={{ fontSize: '11px', color: '#8D9187' }}>Saved</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '12px 4px', borderRadius: '18px', border: '1px solid #DADAD6' }}>
          <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>{profile.publishedCount}</div>
          <div style={{ fontSize: '11px', color: '#8D9187' }}>Published</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '12px 4px', borderRadius: '18px', border: '1px solid #DADAD6' }}>
          <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>{profile.followersCount}</div>
          <div style={{ fontSize: '11px', color: '#8D9187' }}>Followers</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '12px 4px', borderRadius: '18px', border: '1px solid #DADAD6' }}>
          <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>{profile.streakDays}</div>
          <div style={{ fontSize: '11px', color: '#8D9187' }}>Day streak</div>
        </div>
      </div>

      {/* Fridgr Premium Trial Banner */}
      <div 
        onClick={() => onNavigate('premium')}
        style={{ backgroundColor: '#14180F', color: '#FFFFFF', borderRadius: '24px', padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#C8F24A', fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em' }}>
          <Plus size={14} /> FRIDGR PREMIUM
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: '800', lineHeight: '1.2' }}>
          Unlimited AI, weekly meal plans, smarter scanning
        </h2>

        <button className="pill-btn pill-primary-lime" style={{ alignSelf: 'flex-start' }}>
          Start 7-day free trial
        </button>
      </div>

      {/* Settings Links List Card */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '16px', border: '1px solid #DADAD6', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[
          { label: 'Create a recipe', meta: '12 published', screen: 'home', icon: 'C' },
          { label: 'My fridge', meta: '12 items', screen: 'fridge', icon: 'F' },
          { label: 'Shopping list', meta: '6 items', screen: 'shopping', icon: 'L' },
          { label: 'Preferences', meta: 'Fitness • high protein', screen: 'onboarding', icon: 'P' },
          { label: 'Notifications', meta: 'All on', screen: 'notifications', icon: 'N' },
        ].map((item, index) => (
          <div 
            key={item.label}
            onClick={() => onNavigate(item.screen as any)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#F3F3F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px', color: '#14180F' }}>
                {item.icon}
              </div>
              <span style={{ fontWeight: '700', fontSize: '15px', color: '#14180F' }}>{item.label}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#8D9187' }}>{item.meta}</span>
              <ChevronRight size={16} color="#8D9187" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
