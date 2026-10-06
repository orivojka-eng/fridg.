import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRecipeStore } from '../store/useRecipeStore';
import { ScreenType } from '../types';

interface ResultsProps {
  onNavigate: (screen: ScreenType) => void;
}

export const ResultsScreen: React.FC<ResultsProps> = ({ onNavigate }) => {
  const { recipes, setActiveRecipeId } = useRecipeStore();

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#F3F3F1', minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => onNavigate('home')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} color="#14180F" />
        </button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0B0D0A' }}>6 recipes for you</h1>
          <div style={{ fontSize: '12px', color: '#8D9187' }}>High protein • under 30 min • no dairy</div>
        </div>
      </div>

      {/* Recipe Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {recipes.map((r) => (
          <div
            key={r.id}
            onClick={() => {
              setActiveRecipeId(r.id);
              onNavigate('recipe-detail');
            }}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '14px',
              border: '1px solid #DADAD6',
              display: 'flex',
              gap: '14px',
              cursor: 'pointer'
            }}
          >
            {/* Left Thumbnail */}
            <div style={{ 
              width: '100px', 
              height: '100px', 
              borderRadius: '16px', 
              backgroundColor: '#EFEADA', 
              display: 'flex', 
              alignItems: 'flex-end', 
              padding: '6px',
              flexShrink: 0 
            }}>
              <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#8D9187' }}>
                {r.title.toLowerCase().substring(0, 10)}.jpg
              </span>
            </div>

            {/* Right Info */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className={`badge-tag ${r.matchPercent >= 90 ? 'badge-lime' : 'badge-gray'}`}>
                  {r.matchPercent}% match
                </span>
                <span style={{ fontSize: '12px', color: '#8D9187' }}>
                  {r.missingCount === 0 ? 'nothing missing' : `${r.missingCount} item missing`}
                </span>
              </div>

              <div style={{ fontWeight: '800', fontSize: '15px', color: '#14180F', lineHeight: '1.25', marginBottom: '6px' }}>
                {r.title}
              </div>

              <div style={{ fontSize: '12px', color: '#8D9187' }}>
                {r.prepTimeMin} min • {r.calories} kcal • {r.proteinG}g protein
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
