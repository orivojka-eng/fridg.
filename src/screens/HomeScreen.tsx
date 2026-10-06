import React from 'react';
import { ShoppingCart, Bell, Camera, Plus, ChevronRight, Link2 } from 'lucide-react';
import { useFridgeStore } from '../store/useFridgeStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { useUserStore } from '../store/useUserStore';
import { ScreenType } from '../types';

interface HomeProps {
  onNavigate: (screen: ScreenType) => void;
}

export const HomeScreen: React.FC<HomeProps> = ({ onNavigate }) => {
  const { items, getExpiringCount } = useFridgeStore();
  const { recipes, setActiveRecipeId } = useRecipeStore();
  const { profile } = useUserStore();

  const expiringCount = getExpiringCount();

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '50%', 
            backgroundColor: '#EFEADA', 
            backgroundImage: 'repeating-linear-gradient(45deg, #E7EEDD 0, #E7EEDD 5px, #EFEADA 5px, #EFEADA 10px)' 
          }} />
          <div>
            <div style={{ fontSize: '12px', color: '#8D9187' }}>Good morning</div>
            <div style={{ fontSize: '17px', fontWeight: '800', color: '#0B0D0A' }}>{profile.name}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => onNavigate('shopping')}
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ShoppingCart size={18} color="#0B0D0A" />
          </button>
          <button 
            onClick={() => onNavigate('notifications')}
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}
          >
            <Bell size={18} color="#0B0D0A" />
            <div style={{ width: '8px', height: '8px', backgroundColor: '#E11D48', borderRadius: '50%', position: 'absolute', top: '9px', right: '10px' }} />
          </button>
        </div>
      </div>

      {/* Primary Lime Hero Card: "Your fridge today" */}
      <div 
        onClick={() => onNavigate('fridge')}
        style={{ 
          backgroundColor: '#C8F24A', 
          borderRadius: '28px', 
          padding: '24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(200, 242, 74, 0.3)'
        }}
      >
        <div style={{ flex: 1, paddingRight: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <div style={{ width: '14px', height: '14px', backgroundColor: '#14180F', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '4px', height: '4px', backgroundColor: '#C8F24A', borderRadius: '1px' }} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#14180F' }}>Your fridge today</span>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#14180F', lineHeight: '1.2', marginBottom: '8px' }}>
            {items.length} ingredients,<br />
            7 recipes ready
          </h2>

          <div style={{ fontSize: '13px', fontWeight: '600', color: '#14180F', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '4px' }}>
            {expiringCount} items expire in 2 days →
          </div>
        </div>

        {/* Circular Gauge Ring */}
        <div className="gauge-ring">
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#14180F', lineHeight: '1' }}>86%</div>
          <div style={{ fontSize: '9px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginTop: '2px' }}>USED</div>
        </div>
      </div>

      {/* Action Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div 
          onClick={() => onNavigate('scanner')}
          style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '20px', border: '1px solid #DADAD6', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '110px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontWeight: '800', fontSize: '15px', color: '#14180F' }}>Scan<br />fridge</div>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#E7EEDD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={16} color="#14180F" />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#8D9187' }}>Recognise 30+ items</div>
        </div>

        <div 
          onClick={() => onNavigate('generator')}
          style={{ backgroundColor: '#14180F', color: '#FFFFFF', padding: '16px', borderRadius: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '110px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontWeight: '800', fontSize: '15px', color: '#FFFFFF' }}>AI recipe<br />generator</div>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#C8F24A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={18} color="#14180F" />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#C8F24A' }}>4 of 5 free left</div>
        </div>
      </div>

      {/* Section "Make it tonight" */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0B0D0A' }}>Make it tonight</h2>
          <button onClick={() => onNavigate('results')} style={{ background: 'none', border: 'none', color: '#8D9187', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            See all
          </button>
        </div>

        <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
          {recipes.slice(0, 3).map((r) => (
            <div 
              key={r.id}
              onClick={() => {
                setActiveRecipeId(r.id);
                onNavigate('recipe-detail');
              }}
              style={{ minWidth: '220px', backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '12px', border: '1px solid #DADAD6', cursor: 'pointer' }}
            >
              {/* Recipe Image Placeholder */}
              <div style={{ height: '130px', backgroundColor: '#EFEADA', borderRadius: '14px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', padding: '10px' }}>
                <div className="badge-tag badge-dark" style={{ position: 'absolute', top: '8px', left: '8px' }}>
                  {r.matchPercent}% match
                </div>
                <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#8D9187' }}>
                  {r.title.toLowerCase().replace(/\s+/g, '-')}.jpg
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <div style={{ fontWeight: '800', fontSize: '15px', color: '#14180F', lineHeight: '1.2', marginBottom: '4px' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: '12px', color: '#8D9187' }}>
                  {r.prepTimeMin} min • {r.calories} kcal • {r.proteinG}g P
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Import Link Banner */}
      <div 
        onClick={() => onNavigate('social-import')}
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #DADAD6', borderRadius: '20px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#F3F3F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Link2 size={20} color="#14180F" />
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '14px', color: '#14180F' }}>Paste a food video link</div>
            <div style={{ fontSize: '12px', color: '#8D9187' }}>TikTok, Reels, Shorts → full recipe in 8s</div>
          </div>
        </div>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#C8F24A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={18} color="#14180F" />
        </div>
      </div>
    </div>
  );
};
