import React, { useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { useFridgeStore } from '../store/useFridgeStore';
import { ScreenType } from '../types';

interface ScannerProps {
  onNavigate: (screen: ScreenType) => void;
}

export const ScannerScreen: React.FC<ScannerProps> = ({ onNavigate }) => {
  const { addMultipleItems } = useFridgeStore();
  const [recognizedItems] = useState([
    { name: 'Red peppers', confidence: '98%', category: 'Veg', quantity: '3 pcs', initials: 'R' },
    { name: 'Greek yoghurt', confidence: '96%', category: 'Dairy', quantity: '500 g', initials: 'G' },
    { name: 'Spinach', confidence: '94%', category: 'Veg', quantity: '180 g', initials: 'S' },
    { name: 'Eggs', confidence: '91%', category: 'Protein', quantity: '8 pcs', initials: 'E' },
  ]);

  const handleAddRecognized = () => {
    addMultipleItems(recognizedItems.map(item => ({
      name: item.name,
      category: item.category as any,
      quantity: item.quantity,
      daysToExpiry: 5,
      status: 'Fresh',
      initials: item.initials
    })));
    onNavigate('fridge');
  };

  return (
    <div style={{ backgroundColor: '#0B0D0A', color: '#FFFFFF', minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '16px 20px' }}>
      {/* Top Camera Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button 
          onClick={() => onNavigate('home')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} color="#FFFFFF" />
        </button>

        <span style={{ fontSize: '17px', fontWeight: '800' }}>Scan your fridge</span>

        <div style={{ border: '1px solid #C8F24A', borderRadius: '9999px', padding: '4px 12px', fontSize: '12px', color: '#C8F24A', fontWeight: '700' }}>
          Auto-detect
        </div>
      </div>

      {/* Camera Viewfinder Area with Bounding Box Overlays */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#14180F', 
        borderRadius: '28px', 
        border: '2px dashed rgba(200, 242, 74, 0.4)', 
        position: 'relative', 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '20px'
      }}>
        {/* Reticle Corner Guides */}
        <div style={{ position: 'absolute', top: '20px', left: '20px', width: '30px', height: '30px', borderTop: '4px solid #C8F24A', borderLeft: '4px solid #C8F24A', borderTopLeftRadius: '12px' }} />
        <div style={{ position: 'absolute', top: '20px', right: '20px', width: '30px', height: '30px', borderTop: '4px solid #C8F24A', borderRight: '4px solid #C8F24A', borderTopRightRadius: '12px' }} />
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', width: '30px', height: '30px', borderBottom: '4px solid #C8F24A', borderLeft: '4px solid #C8F24A', borderBottomLeftRadius: '12px' }} />
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '30px', height: '30px', borderBottom: '4px solid #C8F24A', borderRight: '4px solid #C8F24A', borderBottomRightRadius: '12px' }} />

        {/* Bounding Box 1: Red peppers */}
        <div style={{ position: 'absolute', top: '15%', left: '10%', width: '110px', height: '65px', border: '2px solid #C8F24A', borderRadius: '14px', backgroundColor: 'rgba(200, 242, 74, 0.08)' }}>
          <div style={{ position: 'absolute', top: '-14px', left: '8px', backgroundColor: '#C8F24A', color: '#14180F', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: '800' }}>
            Red peppers • 98%
          </div>
        </div>

        {/* Bounding Box 2: Eggs */}
        <div style={{ position: 'absolute', top: '18%', right: '12%', width: '100px', height: '60px', border: '2px solid #C8F24A', borderRadius: '14px', backgroundColor: 'rgba(200, 242, 74, 0.08)' }}>
          <div style={{ position: 'absolute', top: '-14px', left: '8px', backgroundColor: '#C8F24A', color: '#14180F', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: '800' }}>
            Eggs • 91%
          </div>
        </div>

        {/* Bounding Box 3: Greek yoghurt */}
        <div style={{ position: 'absolute', top: '48%', right: '10%', width: '115px', height: '70px', border: '2px solid #C8F24A', borderRadius: '14px', backgroundColor: 'rgba(200, 242, 74, 0.08)' }}>
          <div style={{ position: 'absolute', top: '-14px', left: '8px', backgroundColor: '#C8F24A', color: '#14180F', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: '800' }}>
            Greek yoghurt • 96%
          </div>
        </div>

        {/* Bounding Box 4: Spinach */}
        <div style={{ position: 'absolute', bottom: '18%', left: '16%', width: '105px', height: '65px', border: '2px solid #C8F24A', borderRadius: '14px', backgroundColor: 'rgba(200, 242, 74, 0.08)' }}>
          <div style={{ position: 'absolute', top: '-14px', left: '8px', backgroundColor: '#C8F24A', color: '#14180F', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: '800' }}>
            Spinach • 94%
          </div>
        </div>
      </div>

      {/* Bottom Recognized Items Drawer */}
      <div style={{ backgroundColor: '#252820', borderRadius: '24px', padding: '16px', marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: '800' }}>4 items recognised</span>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#C8F24A', letterSpacing: '0.05em' }}>98% CONF.</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {recognizedItems.map(item => (
            <span key={item.name} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' }}>
              {item.name}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => onNavigate('manual-add')}
            style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Plus size={20} />
          </button>
          <button 
            className="pill-btn pill-primary-lime"
            style={{ flex: 1 }}
            onClick={handleAddRecognized}
          >
            Add 4 to fridge
          </button>
        </div>
      </div>
    </div>
  );
};
