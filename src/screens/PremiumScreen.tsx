import React, { useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { ScreenType } from '../types';

interface PremiumProps {
  onNavigate: (screen: ScreenType) => void;
}

export const PremiumScreen: React.FC<PremiumProps> = ({ onNavigate }) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

  const features = [
    { title: 'Unlimited AI generations', desc: 'No 5-a-day cap, ever' },
    { title: 'Advanced food scanning', desc: 'Brands, quantities, expiry dates' },
    { title: 'Unlimited video imports', desc: 'TikTok, Reels, Shorts, Facebook' },
    { title: 'Advanced adaptation', desc: 'Macro targets and full substitutions' },
    { title: 'AI weekly meal planning', desc: 'A week of dinners in one tap' },
    { title: 'Automatic shopping lists', desc: 'Built from your plan and fridge' },
    { title: 'Smart expiry management', desc: 'Alerts before anything turns' },
    { title: 'Personal AI food coach', desc: 'Nutrition insights and photo-to-recipe' },
  ];

  return (
    <div style={{ backgroundColor: '#14180F', color: '#FFFFFF', minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '16px 20px', position: 'relative' }}>
      {/* Close Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
        <button 
          onClick={() => onNavigate('home')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={20} color="#FFFFFF" />
        </button>
      </div>

      {/* Top Badge & Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(200, 242, 74, 0.15)', color: '#C8F24A', padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', marginBottom: '12px' }}>
          <Sparkles size={14} /> FRIDGR PREMIUM
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.2', color: '#FFFFFF', marginBottom: '8px' }}>
          Your kitchen,<br />fully automated.
        </h1>

        <p style={{ color: '#8D9187', fontSize: '14px', lineHeight: '1.4' }}>
          Everything free does, without limits — plus the tools that plan your week for you.
        </p>
      </div>

      {/* Feature Checklist Card */}
      <div style={{ backgroundColor: '#252820', borderRadius: '24px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#C8F24A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px', flexShrink: 0 }}>
              <Check size={14} color="#14180F" strokeWidth={3} />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#FFFFFF' }}>{f.title}</div>
              <div style={{ fontSize: '12px', color: '#8D9187' }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pricing Selector Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div 
          onClick={() => setSelectedPlan('monthly')}
          style={{ 
            backgroundColor: selectedPlan === 'monthly' ? '#C8F24A' : '#252820', 
            color: selectedPlan === 'monthly' ? '#14180F' : '#FFFFFF',
            borderRadius: '20px', 
            padding: '16px', 
            border: selectedPlan === 'monthly' ? 'none' : '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '700', opacity: 0.8 }}>Monthly</div>
          <div style={{ fontSize: '22px', fontWeight: '800', margin: '4px 0' }}>€6.99</div>
          <div style={{ fontSize: '11px', opacity: 0.7 }}>billed monthly</div>
        </div>

        <div 
          onClick={() => setSelectedPlan('yearly')}
          style={{ 
            backgroundColor: selectedPlan === 'yearly' ? '#C8F24A' : '#252820', 
            color: selectedPlan === 'yearly' ? '#14180F' : '#FFFFFF',
            borderRadius: '20px', 
            padding: '16px', 
            border: selectedPlan === 'yearly' ? 'none' : '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '700', opacity: 0.8 }}>Yearly</div>
          <div style={{ fontSize: '22px', fontWeight: '800', margin: '4px 0' }}>€3.50</div>
          <div style={{ fontSize: '11px', opacity: 0.7 }}>per month, billed yearly</div>
        </div>
      </div>

      {/* Primary CTA */}
      <button 
        className="pill-btn pill-primary-lime"
        style={{ width: '100%', boxShadow: '0 8px 24px rgba(200, 242, 74, 0.4)' }}
        onClick={() => onNavigate('home')}
      >
        Start 7-day free trial
      </button>
    </div>
  );
};
