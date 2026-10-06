import React from 'react';
import { Plus, Check } from 'lucide-react';
import { useShoppingStore } from '../store/useShoppingStore';
import { ScreenType } from '../types';

interface ShoppingProps {
  onNavigate: (screen: ScreenType) => void;
}

export const ShoppingListScreen: React.FC<ShoppingProps> = ({ onNavigate }) => {
  const { items, estimatedCost, toggleItemCheck } = useShoppingStore();

  const produceItems = items.filter(i => i.category === 'PRODUCE');
  const pantryItems = items.filter(i => i.category === 'PANTRY & SPICE');

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#F3F3F1', minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0B0D0A' }}>Shopping list</h1>
          <div style={{ fontSize: '13px', color: '#8D9187' }}>
            {items.filter(i => !i.isChecked).length} items left • est. €{estimatedCost.toFixed(2)}
          </div>
        </div>

        <button 
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: '#14180F', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Plus size={20} color="#C8F24A" />
        </button>
      </div>

      {/* Section PRODUCE */}
      {produceItems.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginBottom: '10px' }}>
            PRODUCE
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid #DADAD6' }}>
            {produceItems.map(item => (
              <div 
                key={item.id}
                onClick={() => toggleItemCheck(item.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    border: item.isChecked ? 'none' : '2px solid #DADAD6', 
                    backgroundColor: item.isChecked ? '#14180F' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {item.isChecked && <Check size={14} color="#C8F24A" />}
                  </div>

                  <div>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: item.isChecked ? '#8D9187' : '#14180F', textDecoration: item.isChecked ? 'line-through' : 'none' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8D9187' }}>{item.source}</div>
                  </div>
                </div>

                <span style={{ fontSize: '13px', fontWeight: '700', color: '#8D9187' }}>{item.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section PANTRY & SPICE */}
      {pantryItems.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginBottom: '10px' }}>
            PANTRY & SPICE
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid #DADAD6' }}>
            {pantryItems.map(item => (
              <div 
                key={item.id}
                onClick={() => toggleItemCheck(item.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    border: item.isChecked ? 'none' : '2px solid #DADAD6', 
                    backgroundColor: item.isChecked ? '#14180F' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {item.isChecked && <Check size={14} color="#C8F24A" />}
                  </div>

                  <div>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: item.isChecked ? '#8D9187' : '#14180F', textDecoration: item.isChecked ? 'line-through' : 'none' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8D9187' }}>{item.source}</div>
                  </div>
                </div>

                <span style={{ fontSize: '13px', fontWeight: '700', color: '#8D9187' }}>{item.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-build Promo Banner */}
      <div style={{ backgroundColor: '#E7EEDD', borderRadius: '24px', padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: '800', fontSize: '15px', color: '#14180F' }}>Auto-build from my meal plan</div>
          <div style={{ fontSize: '12px', color: '#555555', marginTop: '2px' }}>Premium • fills the week in one tap</div>
        </div>

        <button 
          onClick={() => onNavigate('premium')}
          style={{ backgroundColor: '#14180F', color: '#FFFFFF', border: 'none', padding: '8px 18px', borderRadius: '9999px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
        >
          Try
        </button>
      </div>
    </div>
  );
};
