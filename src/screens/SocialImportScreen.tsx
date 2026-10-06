import React, { useState } from 'react';
import { ChevronLeft, Link2, Sparkles, Check } from 'lucide-react';
import { useShoppingStore } from '../store/useShoppingStore';
import { ScreenType } from '../types';

interface SocialImportProps {
  onNavigate: (screen: ScreenType) => void;
}

export const SocialImportScreen: React.FC<SocialImportProps> = ({ onNavigate }) => {
  const { addMultipleItems } = useShoppingStore();
  const [videoUrl, setVideoUrl] = useState<string>('https://tiktok.com/@kitchenbysam/video/7421');
  const [isExtracted, setIsExtracted] = useState<boolean>(true);

  const extractedIngredients = [
    { name: 'Salmon fillets', amount: '2 pcs', inFridge: true },
    { name: 'Short-grain rice', amount: '300 g', inFridge: true },
    { name: 'Gochujang', amount: '2 tbsp', inFridge: false },
    { name: 'Mirin', amount: '1 tbsp', inFridge: false },
    { name: 'Spring onion', amount: '3 stalks', inFridge: true },
    { name: 'Sesame oil', amount: '1 tsp', inFridge: true },
  ];

  const handleAddMissing = () => {
    addMultipleItems([
      { name: 'Gochujang', category: 'PANTRY & SPICE', amount: '1 tub', source: 'From imported recipe' },
      { name: 'Mirin', category: 'PANTRY & SPICE', amount: '250 ml', source: 'From imported recipe' },
    ]);
    onNavigate('shopping');
  };

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#F3F3F1', minHeight: '100%' }}>
      {/* Top Bar Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => onNavigate('home')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} color="#14180F" />
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0B0D0A' }}>Import from a video</h1>
      </div>

      {/* Link Input Card */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '18px', border: '1px solid #DADAD6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em' }}>
          PASTE LINK
        </div>
        <div style={{ backgroundColor: '#F3F3F1', borderRadius: '16px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link2 size={16} color="#8D9187" />
          <input 
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'none', fontSize: '13px', width: '100%', fontFamily: 'inherit', color: '#14180F', fontWeight: '600' }}
          />
        </div>

        {/* Platform Chips */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['TikTok', 'Instagram', 'YouTube', 'Facebook'].map(p => (
            <span key={p} style={{ backgroundColor: '#F3F3F1', padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', color: '#555555' }}>
              {p}
            </span>
          ))}
        </div>

        <button 
          className="pill-btn pill-primary-dark"
          style={{ width: '100%', marginTop: '4px' }}
          onClick={() => setIsExtracted(true)}
        >
          Extract recipe
        </button>
      </div>

      {/* Extracted Result Card */}
      {isExtracted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em' }}>
            EXTRACTED IN 8s
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '18px', border: '1px solid #DADAD6', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '14px' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '14px', backgroundColor: '#EFEADA', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', color: '#8D9187' }}>@kitchenbysam • 2.1M views</div>
                <div style={{ fontWeight: '800', fontSize: '15px', color: '#14180F', lineHeight: '1.25', margin: '4px 0' }}>
                  Crispy gochujang salmon rice bowl
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className="badge-tag badge-lime" style={{ fontSize: '10px' }}>9 ingredients</span>
                  <span className="badge-tag badge-gray" style={{ fontSize: '10px' }}>6 steps</span>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #F3F3F1' }} />

            {/* Extracted Ingredients Status List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {extractedIngredients.map(ing => (
                <div key={ing.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: ing.inFridge ? '#16A34A' : '#D97706' }} />
                    <span style={{ fontWeight: '700', color: '#14180F' }}>{ing.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8D9187' }}>{ing.amount}</span>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: ing.inFridge ? '#16A34A' : '#D97706' }}>
                      {ing.inFridge ? 'IN FRIDGE' : 'MISSING'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Overlap Lime Card */}
          <div style={{ backgroundColor: '#C8F24A', color: '#14180F', borderRadius: '24px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: '800', fontSize: '16px' }}>7 of 9 already in your fridge</div>
            <div style={{ fontSize: '13px', lineHeight: '1.4', opacity: 0.9 }}>
              Missing gochujang and mirin. Fridgr can swap in sriracha + honey and rice vinegar.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
              <button 
                className="pill-btn pill-primary-dark"
                style={{ padding: '10px' }}
                onClick={() => onNavigate('adapt-recipe')}
              >
                Adapt it
              </button>
              <button 
                className="pill-btn pill-white"
                style={{ padding: '10px' }}
                onClick={handleAddMissing}
              >
                Add missing
              </button>
            </div>
          </div>

          <button 
            className="pill-btn pill-white"
            style={{ width: '100%' }}
            onClick={() => onNavigate('saved')}
          >
            Save to my recipes
          </button>
        </div>
      )}
    </div>
  );
};
