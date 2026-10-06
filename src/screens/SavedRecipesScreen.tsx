import React, { useState } from 'react';
import { Bookmark, ArrowRight } from 'lucide-react';
import { useRecipeStore } from '../store/useRecipeStore';
import { ScreenType } from '../types';

interface SavedProps {
  onNavigate: (screen: ScreenType) => void;
}

export const SavedRecipesScreen: React.FC<SavedProps> = ({ onNavigate }) => {
  const { recipes, savedRecipeIds, setActiveRecipeId } = useRecipeStore();
  const [selectedFilter, setSelectedFilter] = useState<string>('All');

  const filters = ['All', 'Imported', 'Made before', 'To try'];

  const savedRecipes = recipes.filter(r => savedRecipeIds.includes(r.id));

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0B0D0A' }}>Saved</h1>
        <button 
          onClick={() => onNavigate('collections')}
          style={{ background: 'none', border: 'none', color: '#16A34A', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Collections <ArrowRight size={16} />
        </button>
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
        {filters.map(f => {
          const isSelected = selectedFilter === f;
          return (
            <button
              key={f}
              onClick={() => setSelectedFilter(f)}
              style={{
                padding: '8px 18px',
                borderRadius: '9999px',
                border: isSelected ? 'none' : '1px solid #DADAD6',
                backgroundColor: isSelected ? '#14180F' : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : '#14180F',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* 2-Column Grid of Saved Recipe Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {savedRecipes.map(r => (
          <div
            key={r.id}
            onClick={() => {
              setActiveRecipeId(r.id);
              onNavigate('recipe-detail');
            }}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '12px',
              border: '1px solid #DADAD6',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            {/* Image Placeholder */}
            <div style={{ height: '110px', backgroundColor: '#EFEADA', borderRadius: '14px', position: 'relative', padding: '8px', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bookmark size={14} color="#14180F" fill="#14180F" />
              </div>
              <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#8D9187' }}>
                {r.title.toLowerCase().substring(0, 10)}.jpg
              </span>
            </div>

            <div style={{ marginTop: '10px' }}>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#14180F', lineHeight: '1.25', marginBottom: '4px' }}>
                {r.title}
              </div>
              <div style={{ fontSize: '11px', color: '#8D9187' }}>
                {r.prepTimeMin} min • {r.proteinG}g protein
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
