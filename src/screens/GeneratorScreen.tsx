import React, { useState } from 'react';
import { ChevronLeft, Plus, Sparkles } from 'lucide-react';
import { useFridgeStore } from '../store/useFridgeStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { ScreenType } from '../types';

interface GeneratorProps {
  onNavigate: (screen: ScreenType) => void;
}

export const GeneratorScreen: React.FC<GeneratorProps> = ({ onNavigate }) => {
  const { items } = useFridgeStore();
  const { 
    generatorServings, setGeneratorServings,
    generatorEffort, setGeneratorEffort,
    generatorStyle, setGeneratorStyle,
    selectedGeneratorIngredients, toggleGeneratorIngredient
  } = useRecipeStore();

  const [aiPrompt, setAiPrompt] = useState<string>('');

  const quickPrompts = [
    'What can I make tonight?',
    'Make it higher protein',
    'Use up my spinach',
    'Under 20 minutes',
  ];

  const handleGenerate = () => {
    onNavigate('results');
  };

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#F3F3F1', minHeight: '100%' }}>
      {/* Top Bar Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => onNavigate('home')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} color="#14180F" />
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0B0D0A' }}>AI Recipe Generator</h1>
      </div>

      {/* Ask Fridgr AI Card (Dark Container) */}
      <div style={{ backgroundColor: '#14180F', color: '#FFFFFF', borderRadius: '24px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#C8F24A', padding: '4px 10px', borderRadius: '9999px', color: '#14180F', fontSize: '12px', fontWeight: '800' }}>
            <Plus size={14} /> Ask Fridgr AI
          </div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em' }}>4/5 FREE</span>
        </div>

        {/* Input Bar */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#C8F24A" />
          <input 
            type="text"
            placeholder="What can I make with what I have?"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '14px', width: '100%', fontFamily: 'inherit' }}
          />
        </div>

        {/* Quick Prompts Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {quickPrompts.map(p => (
            <button
              key={p}
              onClick={() => setAiPrompt(p)}
              style={{
                backgroundColor: 'rgba(200, 242, 74, 0.12)',
                color: '#C8F24A',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* USING FROM YOUR FRIDGE */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginBottom: '10px' }}>
          USING FROM YOUR FRIDGE
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {items.map(item => {
            const isSelected = selectedGeneratorIngredients.includes(item.name);
            return (
              <button
                key={item.id}
                onClick={() => toggleGeneratorIngredient(item.name)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  border: isSelected ? 'none' : '1px solid #DADAD6',
                  backgroundColor: isSelected ? '#C8F24A' : '#FFFFFF',
                  color: '#14180F',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* FINE TUNE */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginBottom: '10px' }}>
          FINE TUNE
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #DADAD6' }}>
          {/* Servings */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#14180F' }}>Servings</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setGeneratorServings(s)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: generatorServings === s ? '#14180F' : '#F3F3F1',
                    color: generatorServings === s ? '#FFFFFF' : '#14180F',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #F3F3F1' }} />

          {/* Effort */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#14180F' }}>Effort</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['Easy', 'Cheffy'].map(e => (
                <button
                  key={e}
                  onClick={() => setGeneratorEffort(e)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: generatorEffort === e ? '#14180F' : '#F3F3F1',
                    color: generatorEffort === e ? '#FFFFFF' : '#14180F',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #F3F3F1' }} />

          {/* Style */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#14180F' }}>Style</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['Bowl', 'Traybake', 'Salad'].map(st => (
                <button
                  key={st}
                  onClick={() => setGeneratorStyle(st)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: generatorStyle === st ? '#14180F' : '#F3F3F1',
                    color: generatorStyle === st ? '#FFFFFF' : '#14180F',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Primary CTA */}
      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <button 
          className="pill-btn pill-primary-lime" 
          style={{ width: '100%', boxShadow: '0 8px 24px rgba(200, 242, 74, 0.3)' }}
          onClick={handleGenerate}
        >
          Generate 6 recipes
        </button>
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#8D9187', marginTop: '8px' }}>
          Unlimited generations with <span onClick={() => onNavigate('premium')} style={{ color: '#14180F', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}>Fridgr Premium</span>
        </div>
      </div>
    </div>
  );
};
