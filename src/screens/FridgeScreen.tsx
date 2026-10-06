import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFridgeStore } from '../store/useFridgeStore';
import { ScreenType } from '../types';

interface FridgeProps {
  onNavigate: (screen: ScreenType) => void;
}

export const FridgeScreen: React.FC<FridgeProps> = ({ onNavigate }) => {
  const { items, selectedCategory, setSelectedCategory, removeItem, getExpiringCount, getFreshCount } = useFridgeStore();

  const categories = ['All', 'Protein', 'Veg', 'Dairy', 'Pantry', 'Produce'];

  const filteredItems = selectedCategory === 'All' 
    ? items 
    : items.filter(item => item.category.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0B0D0A' }}>My Fridge</h1>
          <div style={{ fontSize: '13px', color: '#8D9187' }}>{items.length} items • last scanned 2h ago</div>
        </div>
        <button 
          className="pill-btn pill-primary-dark"
          style={{ padding: '10px 18px', fontSize: '14px' }}
          onClick={() => onNavigate('manual-add')}
        >
          Add <Plus size={16} color="#C8F24A" />
        </button>
      </div>

      {/* Summary Stat Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '18px', border: '1px solid #DADAD6' }}>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#14180F' }}>{getFreshCount()}</div>
          <div style={{ fontSize: '12px', color: '#8D9187', fontWeight: '600' }}>Fresh</div>
        </div>
        <div style={{ backgroundColor: '#FFF2E5', padding: '14px', borderRadius: '18px', border: '1px solid #FDBA74' }}>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#D97706' }}>{getExpiringCount()}</div>
          <div style={{ fontSize: '12px', color: '#D97706', fontWeight: '700' }}>Expiring</div>
        </div>
        <div style={{ backgroundColor: '#14180F', color: '#FFFFFF', padding: '14px', borderRadius: '18px' }}>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#FFFFFF' }}>7</div>
          <div style={{ fontSize: '12px', color: '#C8F24A', fontWeight: '600' }}>Recipes</div>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '8px 18px',
                borderRadius: '9999px',
                border: isSelected ? 'none' : '1px solid #DADAD6',
                backgroundColor: isSelected ? '#14180F' : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : '#14180F',
                fontWeight: '700',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Inventory Item List Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredItems.map(item => {
          const isExpiring = item.daysToExpiry <= 2;
          return (
            <div 
              key={item.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                padding: '14px 16px',
                border: '1px solid #DADAD6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ 
                  width: '42px', 
                  height: '42px', 
                  borderRadius: '14px', 
                  backgroundColor: '#F3F3F1', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: '800', 
                  fontSize: '16px', 
                  color: '#14180F' 
                }}>
                  {item.initials}
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: '#14180F' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: '#8D9187' }}>{item.category} • {item.quantity}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '700', 
                    color: isExpiring ? '#D97706' : '#16A34A' 
                  }}>
                    {isExpiring ? `${item.daysToExpiry} days` : 'Fresh'}
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    style={{ background: 'none', border: 'none', color: '#8D9187', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
