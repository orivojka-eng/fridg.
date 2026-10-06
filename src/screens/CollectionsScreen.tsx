import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useRecipeStore } from '../store/useRecipeStore';
import { ScreenType } from '../types';

interface CollectionsProps {
  onNavigate: (screen: ScreenType) => void;
}

export const CollectionsScreen: React.FC<CollectionsProps> = ({ onNavigate }) => {
  const { collections } = useRecipeStore();

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#F3F3F1', minHeight: '100%' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => onNavigate('saved')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} color="#14180F" />
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0B0D0A' }}>Collections</h1>
      </div>

      {/* Collections List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {collections.map(col => (
          <div
            key={col.id}
            onClick={() => onNavigate('saved')}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '16px',
              border: '1px solid #DADAD6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* 3-Thumbnail Collage Graphic */}
              <div style={{ width: '64px', height: '64px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                <div style={{ backgroundColor: '#EFEADA', borderRadius: '8px 0 0 8px', gridRow: 'span 2' }} />
                <div style={{ backgroundColor: '#E7EEDD', borderRadius: '0 8px 0 0' }} />
                <div style={{ backgroundColor: '#F0E6E2', borderRadius: '0 0 8px 0' }} />
              </div>

              <div>
                <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>{col.title}</div>
                <div style={{ fontSize: '12px', color: '#8D9187', marginTop: '2px' }}>{col.subtitle}</div>
              </div>
            </div>

            <ChevronRight size={18} color="#8D9187" />
          </div>
        ))}

        {/* Dashed + New collection button */}
        <button 
          style={{
            backgroundColor: 'transparent',
            border: '2px dashed #DADAD6',
            borderRadius: '24px',
            padding: '20px',
            color: '#8D9187',
            fontWeight: '700',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> New collection
        </button>
      </div>
    </div>
  );
};
