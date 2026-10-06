import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';

interface OnboardingProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['Fitness', 'Quick & easy']);
  const [selectedDiet, setSelectedDiet] = useState<string[]>(['High protein']);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(['Dairy']);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(['Japanese', 'Levantine']);
  const [cookingTime, setCookingTime] = useState<number>(30);
  const { updatePreferences } = useUserStore();

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter(g => g !== goal));
    } else if (selectedGoals.length < 3) {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const toggleChip = (list: string[], setList: (val: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleFinish = () => {
    updatePreferences({
      goals: selectedGoals,
      diet: selectedDiet,
      allergies: selectedAllergies,
      cuisines: selectedCuisines,
      cookingTimeMin: cookingTime,
    });
    onComplete();
  };

  return (
    <div style={{ padding: '24px 20px', minHeight: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFFF' }}>
      {/* Top Bar Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '24px', height: '24px', backgroundColor: '#C8F24A', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#14180F', borderRadius: '2px' }} />
          </div>
          <span style={{ fontWeight: '800', fontSize: '18px', letterSpacing: '-0.02em' }}>FRIDGR</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Dash Progress Bar */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3, 4].map(s => (
              <div 
                key={s} 
                style={{ 
                  width: s === step ? '20px' : '8px', 
                  height: '4px', 
                  borderRadius: '2px', 
                  backgroundColor: s <= step ? '#14180F' : '#DADAD6',
                  transition: 'all 0.2s ease'
                }} 
              />
            ))}
          </div>
          <button onClick={onComplete} style={{ background: 'none', border: 'none', color: '#8D9187', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            Skip
          </button>
        </div>
      </div>

      {/* STEP 1: INTRO */}
      {step === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1.15', marginBottom: '16px', color: '#0B0D0A' }}>
            Cook smarter<br />
            with what's<br />
            already in your<br />
            fridge<span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#C8F24A', borderRadius: '3px', marginLeft: '6px' }} />
          </h1>
          <p style={{ color: '#8D9187', fontSize: '15px', lineHeight: '1.5', marginBottom: '32px' }}>
            Scan your shelves, get recipes tuned to your taste, your macros and your Tuesday-night energy.
          </p>

          {/* Hero Card Graphic */}
          <div style={{ 
            flex: 1, 
            backgroundColor: '#F3F3F1', 
            borderRadius: '24px', 
            padding: '24px', 
            position: 'relative', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            backgroundImage: 'repeating-linear-gradient(45deg, #EBEBE9 0, #EBEBE9 10px, transparent 10px, transparent 20px)'
          }}>
            <div style={{ position: 'absolute', top: '30px', left: '20px', backgroundColor: '#FFFFFF', padding: '8px 16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>504 kcal</div>
              <div style={{ fontSize: '11px', color: '#8D9187' }}>in fridge</div>
            </div>

            <div style={{ position: 'absolute', top: '15px', right: '40px', backgroundColor: '#FFFFFF', padding: '8px 16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>12 items</div>
              <div style={{ fontSize: '11px', color: '#8D9187' }}>tracked</div>
            </div>

            <div style={{ position: 'absolute', bottom: '40px', right: '20px', backgroundColor: '#C8F24A', padding: '8px 16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#14180F' }}>7 recipes</div>
              <div style={{ fontSize: '11px', color: '#14180F', opacity: 0.8 }}>ready now</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button className="pill-btn pill-primary-dark" style={{ flex: 1 }} onClick={() => setStep(2)}>
              Get started <ChevronRight size={18} style={{ backgroundColor: '#C8F24A', borderRadius: '50%', color: '#14180F', padding: '2px' }} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: GOALS */}
      {step === 2 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginBottom: '8px' }}>
            STEP 02 • GOALS
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>What are you cooking for?</h1>
          <p style={{ color: '#8D9187', fontSize: '14px', marginBottom: '24px' }}>
            Pick up to three. It shapes every recipe we generate.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1 }}>
            {[
              { id: 'Fitness', icon: 'F', desc: 'Macros & protein first' },
              { id: 'Foodie', icon: 'F', desc: 'Chef-level, ambitious' },
              { id: 'Quick & easy', icon: 'Q', desc: 'Under 20 minutes' },
              { id: 'Healthy', icon: 'H', desc: 'Balanced whole foods' },
              { id: 'Budget', icon: 'B', desc: 'Cheap, nothing wasted' },
              { id: 'Meal prep', icon: 'M', desc: 'Cook once, eat five' },
            ].map((item) => {
              const isSelected = selectedGoals.includes(item.id);
              return (
                <div 
                  key={item.id}
                  onClick={() => toggleGoal(item.id)}
                  style={{ 
                    padding: '16px', 
                    borderRadius: '20px', 
                    border: isSelected ? '2px solid #C8F24A' : '1px solid #DADAD6',
                    backgroundColor: isSelected ? '#F7FCEB' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: isSelected ? '#E7EEDD' : '#F3F3F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', color: '#14180F' }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#14180F' }}>{item.id}</div>
                    <div style={{ fontSize: '12px', color: '#8D9187', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button className="pill-btn pill-white" style={{ width: '52px', padding: 0 }} onClick={() => setStep(1)}>
              <ChevronLeft size={20} />
            </button>
            <button className="pill-btn pill-primary-dark" style={{ flex: 1 }} onClick={() => setStep(3)}>
              Continue <ChevronRight size={18} style={{ backgroundColor: '#C8F24A', borderRadius: '50%', color: '#14180F', padding: '2px' }} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DIET & ALLERGIES */}
      {step === 3 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginBottom: '8px' }}>
            STEP 03 • DIET & ALLERGIES
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '24px' }}>Anything we should avoid?</h1>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>Diet</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['No restrictions', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Low carb', 'High protein'].map(d => {
                const isSelected = selectedDiet.includes(d);
                return (
                  <button 
                    key={d}
                    onClick={() => toggleChip(selectedDiet, setSelectedDiet, d)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      border: isSelected ? 'none' : '1px solid #DADAD6',
                      backgroundColor: isSelected ? '#C8F24A' : '#FFFFFF',
                      color: '#14180F',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>Allergies</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['Dairy', 'Gluten', 'Peanuts', 'Tree nuts', 'Shellfish', 'Eggs', 'Soy'].map(a => {
                const isSelected = selectedAllergies.includes(a);
                return (
                  <button 
                    key={a}
                    onClick={() => toggleChip(selectedAllergies, setSelectedAllergies, a)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      border: isSelected ? 'none' : '1px solid #DADAD6',
                      backgroundColor: isSelected ? '#C8F24A' : '#FFFFFF',
                      color: '#14180F',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hard Filter Warning Card */}
          <div style={{ backgroundColor: '#F3F3F1', padding: '16px', borderRadius: '16px', color: '#555555', fontSize: '13px', lineHeight: '1.4' }}>
            <span style={{ color: '#C8F24A', fontWeight: '800' }}>•</span> Allergens are hard filters — we'll never suggest a recipe or substitution containing them.
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '24px' }}>
            <button className="pill-btn pill-white" style={{ width: '52px', padding: 0 }} onClick={() => setStep(2)}>
              <ChevronLeft size={20} />
            </button>
            <button className="pill-btn pill-primary-dark" style={{ flex: 1 }} onClick={() => setStep(4)}>
              Continue <ChevronRight size={18} style={{ backgroundColor: '#C8F24A', borderRadius: '50%', color: '#14180F', padding: '2px' }} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PREFERENCES & TIME */}
      {step === 4 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#8D9187', letterSpacing: '0.05em', marginBottom: '8px' }}>
            STEP 04 • TASTE & TIME
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '20px' }}>Last thing — how do you eat?</h1>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '10px' }}>Favourite cuisines</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['Italian', 'Japanese', 'Mexican', 'Levantine', 'Thai', 'Indian', 'Korean', 'Greek'].map(c => {
                const isSelected = selectedCuisines.includes(c);
                return (
                  <button 
                    key={c}
                    onClick={() => toggleChip(selectedCuisines, setSelectedCuisines, c)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      border: isSelected ? 'none' : '1px solid #DADAD6',
                      backgroundColor: isSelected ? '#C8F24A' : '#FFFFFF',
                      color: '#14180F',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '10px' }}>Weeknight cooking time</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {[
                { time: 15, label: 'Rushed' },
                { time: 30, label: 'Normal' },
                { time: 60, label: 'All in' },
              ].map(t => {
                const isSelected = cookingTime === t.time;
                return (
                  <div
                    key={t.time}
                    onClick={() => setCookingTime(t.time)}
                    style={{
                      padding: '12px 8px',
                      borderRadius: '16px',
                      textAlign: 'center',
                      backgroundColor: isSelected ? '#14180F' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#14180F',
                      border: isSelected ? 'none' : '1px solid #DADAD6',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: '800', fontSize: '16px' }}>{t.time} min</div>
                    <div style={{ fontSize: '11px', color: isSelected ? '#8D9187' : '#8D9187' }}>{t.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Profile Summary Card */}
          <div style={{ backgroundColor: '#14180F', color: '#FFFFFF', padding: '16px', borderRadius: '20px', marginBottom: '20px' }}>
            <div style={{ color: '#C8F24A', fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em', marginBottom: '6px' }}>
              YOUR PROFILE
            </div>
            <div style={{ fontSize: '15px', fontWeight: '700', lineHeight: '1.4' }}>
              Fitness • High protein • no dairy • {cookingTime} min weeknights
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
            <button className="pill-btn pill-white" style={{ width: '52px', padding: 0 }} onClick={() => setStep(3)}>
              <ChevronLeft size={20} />
            </button>
            <button className="pill-btn pill-primary-dark" style={{ flex: 1 }} onClick={handleFinish}>
              Finish setup <ChevronRight size={18} style={{ backgroundColor: '#C8F24A', borderRadius: '50%', color: '#14180F', padding: '2px' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
