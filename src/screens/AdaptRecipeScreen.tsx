import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ScreenType } from '../types';

interface AdaptProps {
  onNavigate: (screen: ScreenType) => void;
}

export const AdaptRecipeScreen: React.FC<AdaptProps> = ({ onNavigate }) => {
  const [toggleSwap1, setToggleSwap1] = useState<boolean>(true);
  const [toggleSwap2, setToggleSwap2] = useState<boolean>(true);
  const [toggleBoost, setToggleBoost] = useState<boolean>(false);

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#F3F3F1', minHeight: '100%' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => onNavigate('recipe-detail')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} color="#14180F" />
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0B0D0A' }}>Adapt recipe</h1>
      </div>

      {/* Fridgr AI Dark Rationale Card */}
      <div style={{ backgroundColor: '#14180F', color: '#FFFFFF', borderRadius: '24px', padding: '18px' }}>
        <div style={{ color: '#C8F24A', fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em', marginBottom: '8px' }}>
          FRIDGR AI
        </div>
        <div style={{ fontSize: '15px', fontWeight: '700', lineHeight: '1.4' }}>
          I rebuilt this around your fridge and your high-protein goal. Two swaps, one addition, +14g protein, still 25 minutes.
        </div>
      </div>

      {/* SUGGESTED CHANGES */}
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em' }}>
        SUGGESTED CHANGES
      </div>

      {/* Card 1 [SWAP] */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '16px', border: '1px solid #DADAD6', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ backgroundColor: '#FFF2E5', color: '#D97706', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800' }}>
            SWAP
          </span>

          {/* Toggle Switch */}
          <div 
            onClick={() => setToggleSwap1(!toggleSwap1)}
            style={{ 
              width: '44px', 
              height: '24px', 
              borderRadius: '9999px', 
              backgroundColor: toggleSwap1 ? '#C8F24A' : '#DADAD6', 
              padding: '2px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: toggleSwap1 ? 'flex-end' : 'flex-start',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
          <span style={{ textDecoration: 'line-through', color: '#8D9187' }}>Gochujang</span>
          <span>→</span>
          <span style={{ fontWeight: '800', color: '#14180F' }}>Sriracha + honey</span>
        </div>

        <div style={{ fontSize: '12px', color: '#8D9187' }}>
          You have both; heat and sweetness land in the same place.
        </div>
      </div>

      {/* Card 2 [SWAP] */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '16px', border: '1px solid #DADAD6', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ backgroundColor: '#FFF2E5', color: '#D97706', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800' }}>
            SWAP
          </span>

          {/* Toggle Switch */}
          <div 
            onClick={() => setToggleSwap2(!toggleSwap2)}
            style={{ 
              width: '44px', 
              height: '24px', 
              borderRadius: '9999px', 
              backgroundColor: toggleSwap2 ? '#C8F24A' : '#DADAD6', 
              padding: '2px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: toggleSwap2 ? 'flex-end' : 'flex-start',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
          <span style={{ textDecoration: 'line-through', color: '#8D9187' }}>Mirin</span>
          <span>→</span>
          <span style={{ fontWeight: '800', color: '#14180F' }}>Rice vinegar + 1 tsp sugar</span>
        </div>

        <div style={{ fontSize: '12px', color: '#8D9187' }}>
          Close enough for the glaze — nobody will taste the difference.
        </div>
      </div>

      {/* Card 3 [BOOST] */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '16px', border: '1px solid #DADAD6', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ backgroundColor: '#E7EEDD', color: '#16A34A', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800' }}>
            BOOST
          </span>

          {/* Toggle Switch */}
          <div 
            onClick={() => setToggleBoost(!toggleBoost)}
            style={{ 
              width: '44px', 
              height: '24px', 
              borderRadius: '9999px', 
              backgroundColor: toggleBoost ? '#C8F24A' : '#DADAD6', 
              padding: '2px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: toggleBoost ? 'flex-end' : 'flex-start',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
          <span style={{ textDecoration: 'line-through', color: '#8D9187' }}>280 g salmon</span>
          <span>→</span>
          <span style={{ fontWeight: '800', color: '#14180F' }}>400 g salmon + edamame</span>
        </div>

        <div style={{ fontSize: '12px', color: '#8D9187' }}>
          Hits your 45g protein target for dinner.
        </div>
      </div>

      {/* Nutrition after adaptation Card */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '16px', border: '1px solid #DADAD6' }}>
        <div style={{ fontWeight: '800', fontSize: '14px', color: '#14180F', marginBottom: '12px' }}>
          Nutrition after adaptation
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
          <div>
            <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>612</div>
            <div style={{ fontSize: '11px', color: '#8D9187' }}>kcal</div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#16A34A' }}>+72</div>
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>51g</div>
            <div style={{ fontSize: '11px', color: '#8D9187' }}>protein</div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#16A34A' }}>+14</div>
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>44g</div>
            <div style={{ fontSize: '11px', color: '#8D9187' }}>carbs</div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#16A34A' }}>-6</div>
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>23g</div>
            <div style={{ fontSize: '11px', color: '#8D9187' }}>fat</div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#16A34A' }}>+2</div>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <button 
          className="pill-btn pill-primary-lime"
          style={{ width: '100%', boxShadow: '0 8px 24px rgba(200, 242, 74, 0.3)' }}
          onClick={() => onNavigate('cooking-mode')}
        >
          Apply & start cooking
        </button>
      </div>
    </div>
  );
};
