import React, { useState } from 'react';
import { ChevronLeft, Search, Plus, Minus } from 'lucide-react';
import { useFridgeStore } from '../store/useFridgeStore';
import { ScreenType } from '../types';

interface ManualAddProps {
  onNavigate: (screen: ScreenType) => void;
}

interface DraftItem {
  name: string;
  category: 'Protein' | 'Veg' | 'Dairy' | 'Pantry' | 'Produce';
  quantityNum: number;
  unit: string;
  initials: string;
}

export const ManualAddScreen: React.FC<ManualAddProps> = ({ onNavigate }) => {
  const { addMultipleItems } = useFridgeStore();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [addingNow, setAddingNow] = useState<DraftItem[]>([
    { name: 'Avocado', category: 'Produce', quantityNum: 2, unit: 'pcs', initials: 'A' },
    { name: 'Sourdough', category: 'Pantry', quantityNum: 1, unit: 'pcs', initials: 'S' },
  ]);

  const suggestedItems = [
    { name: 'Avocado', category: 'Produce', initials: 'A' },
    { name: 'Sourdough', category: 'Pantry', initials: 'S' },
    { name: 'Salmon fillet', category: 'Protein', initials: 'S' },
    { name: 'Halloumi', category: 'Dairy', initials: 'H' },
    { name: 'Courgette', category: 'Veg', initials: 'C' },
    { name: 'Tahini', category: 'Pantry', initials: 'T' },
    { name: 'Miso', category: 'Pantry', initials: 'M' },
    { name: 'Coriander', category: 'Produce', initials: 'C' },
  ];

  const handleAddSuggested = (s: { name: string; category: any; initials: string }) => {
    if (!addingNow.some(item => item.name === s.name)) {
      setAddingNow([...addingNow, { name: s.name, category: s.category, quantityNum: 1, unit: 'pcs', initials: s.initials }]);
    }
  };

  const updateQuantity = (name: string, delta: number) => {
    setAddingNow(addingNow.map(item => {
      if (item.name === name) {
        const newQty = Math.max(1, item.quantityNum + delta);
        return { ...item, quantityNum: newQty };
      }
      return item;
    }));
  };

  const handleSave = () => {
    addMultipleItems(addingNow.map(item => ({
      name: item.name,
      category: item.category,
      quantity: `${item.quantityNum} ${item.unit}`,
      daysToExpiry: 7,
      status: 'Fresh',
      initials: item.initials
    })));
    onNavigate('fridge');
  };

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%', backgroundColor: '#F3F3F1' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => onNavigate('fridge')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} color="#14180F" />
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0B0D0A' }}>Add food manually</h1>
      </div>

      {/* Search Input Bar */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '9999px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #DADAD6' }}>
        <Search size={18} color="#8D9187" />
        <input 
          type="text" 
          placeholder="Search 4,000+ ingredients"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', fontFamily: 'inherit', color: '#14180F' }}
        />
      </div>

      {/* SUGGESTED FOR YOU */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginBottom: '12px' }}>
          SUGGESTED FOR YOU
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {suggestedItems.map(s => (
            <button
              key={s.name}
              onClick={() => handleAddSuggested(s)}
              style={{
                padding: '8px 14px',
                borderRadius: '9999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #DADAD6',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#14180F',
                cursor: 'pointer'
              }}
            >
              <span style={{ width: '20px', height: '20px', borderRadius: '6px', backgroundColor: '#E7EEDD', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' }}>
                {s.initials}
              </span>
              {s.name} <Plus size={14} color="#8D9187" />
            </button>
          ))}
        </div>
      </div>

      {/* ADDING NOW */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginBottom: '12px' }}>
          ADDING NOW
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #DADAD6' }}>
          {addingNow.map(item => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', backgroundColor: '#F3F3F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '15px' }}>
                  {item.initials}
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: '#14180F' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: '#8D9187' }}>{item.category}</div>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div style={{ backgroundColor: '#F3F3F1', borderRadius: '9999px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => updateQuantity(item.name, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <Minus size={14} color="#8D9187" />
                </button>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#14180F' }}>{item.quantityNum} {item.unit}</span>
                <button onClick={() => updateQuantity(item.name, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <Plus size={14} color="#8D9187" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
        <button 
          className="pill-btn pill-primary-dark" 
          style={{ width: '100%' }}
          onClick={handleSave}
        >
          Save to fridge
        </button>
      </div>
    </div>
  );
};
