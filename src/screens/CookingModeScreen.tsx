import React, { useEffect } from 'react';
import { X, ChevronLeft, Play, Pause, RotateCcw } from 'lucide-react';
import { useCookingStore } from '../store/useCookingStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { ScreenType } from '../types';

interface CookingProps {
  onNavigate: (screen: ScreenType) => void;
}

export const CookingModeScreen: React.FC<CookingProps> = ({ onNavigate }) => {
  const { 
    recipeTitle, currentStepIndex, totalSteps, 
    nextStep, prevStep, isTimerRunning, timerSecondsRemaining, 
    startTimer, pauseTimer, tickTimer, setTimer,
    isKeepAwake, toggleKeepAwake, isCompleted, resetCooking
  } = useCookingStore();

  const { activeRecipeId, getRecipeById } = useRecipeStore();
  const recipe = getRecipeById(activeRecipeId) || getRecipeById('r1')!;

  const currentStep = recipe.steps[currentStepIndex] || recipe.steps[0];

  // Interactive Live Countdown Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSecondsRemaining > 0) {
      interval = setInterval(() => {
        tickTimer();
      }, 1000);
    } else if (timerSecondsRemaining === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSecondsRemaining, tickTimer]);

  // Set initial timer if current step has timerSec
  useEffect(() => {
    if (currentStep && currentStep.timerSec) {
      setTimer(currentStep.timerSec);
    } else {
      setTimer(0);
    }
  }, [currentStepIndex, currentStep, setTimer]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFinish = () => {
    resetCooking();
    onNavigate('home');
  };

  return (
    <div style={{ backgroundColor: '#0B0D0A', color: '#FFFFFF', minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '16px 20px', position: 'relative' }}>
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button 
          onClick={() => onNavigate('recipe-detail')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={20} color="#FFFFFF" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: '800', fontSize: '15px' }}>{recipeTitle}</div>
          <div style={{ fontSize: '11px', color: '#8D9187', fontWeight: '700', letterSpacing: '0.05em' }}>
            STEP {currentStepIndex + 1} OF {totalSteps}
          </div>
        </div>

        <button 
          onClick={toggleKeepAwake}
          style={{ 
            backgroundColor: isKeepAwake ? 'rgba(200, 242, 74, 0.15)' : 'rgba(255,255,255,0.1)', 
            border: isKeepAwake ? '1px solid #C8F24A' : 'none', 
            borderRadius: '9999px', 
            padding: '6px 14px', 
            fontSize: '11px', 
            fontWeight: '700', 
            color: isKeepAwake ? '#C8F24A' : '#8D9187',
            cursor: 'pointer' 
          }}
        >
          Keep awake
        </button>
      </div>

      {/* Progress Step Bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div 
            key={i}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: i <= currentStepIndex ? '#C8F24A' : 'rgba(255,255,255,0.2)',
              transition: 'background-color 0.2s ease'
            }}
          />
        ))}
      </div>

      {/* STEP CONTENT */}
      {!isCompleted ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Phase Tag */}
          <div style={{ color: '#C8F24A', fontSize: '12px', fontWeight: '800', letterSpacing: '0.08em', marginBottom: '12px' }}>
            {currentStep.phase}
          </div>

          {/* Big Bold Instruction Text */}
          <h1 style={{ fontSize: '24px', fontWeight: '800', lineHeight: '1.3', marginBottom: '24px', color: '#FFFFFF' }}>
            {currentStep.instruction}
          </h1>

          {/* Ingredient Chips used in this step */}
          {currentStep.ingredients && currentStep.ingredients.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {currentStep.ingredients.map(ing => (
                <span 
                  key={ing} 
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: '9999px', fontSize: '13px', fontWeight: '600' }}
                >
                  {ing}
                </span>
              ))}
            </div>
          )}

          {/* Integrated Timer Card if present */}
          {currentStep.timerSec && (
            <div style={{ backgroundColor: '#14180F', borderRadius: '24px', padding: '18px', display: 'flex', alignItems: 'center', gap: '16px', marginTop: 'auto', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
              {/* Circular Timer Graphic */}
              <div style={{ 
                width: '68px', 
                height: '68px', 
                borderRadius: '50%', 
                border: '4px solid #C8F24A', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '18px',
                color: '#FFFFFF',
                boxShadow: isTimerRunning ? '0 0 16px rgba(200, 242, 74, 0.4)' : 'none'
              }}>
                {formatTimer(timerSecondsRemaining)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '800', fontSize: '15px' }}>Step timer • {Math.ceil(currentStep.timerSec / 60)} min</div>
                <div style={{ fontSize: '12px', color: '#8D9187', marginTop: '2px' }}>
                  We'll buzz you and read out the next step.
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {!isTimerRunning ? (
                    <button 
                      onClick={startTimer}
                      style={{ backgroundColor: '#C8F24A', color: '#14180F', border: 'none', padding: '6px 14px', borderRadius: '9999px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Play size={12} fill="#14180F" /> Start timer
                    </button>
                  ) : (
                    <button 
                      onClick={pauseTimer}
                      style={{ backgroundColor: '#D97706', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '9999px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Pause size={12} fill="#FFFFFF" /> Pause
                    </button>
                  )}
                  <button 
                    onClick={() => setTimer(currentStep.timerSec!)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: 'none', padding: '6px 10px', borderRadius: '9999px', cursor: 'pointer' }}
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Navigation Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '20px' }}>
            <button 
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              style={{ 
                width: '52px', 
                height: '52px', 
                borderRadius: '50%', 
                backgroundColor: 'rgba(255,255,255,0.12)', 
                border: 'none', 
                color: '#FFFFFF', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentStepIndex === 0 ? 0.4 : 1
              }}
            >
              <ChevronLeft size={22} />
            </button>

            <button 
              className="pill-btn pill-primary-lime"
              style={{ flex: 1, boxShadow: '0 8px 24px rgba(200, 242, 74, 0.3)' }}
              onClick={nextStep}
            >
              {currentStepIndex === totalSteps - 1 ? 'Finish & rate' : 'Next step'}
            </button>
          </div>
        </div>
      ) : (
        /* COMPLETED SCREEN */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#C8F24A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '36px' }}>🎉</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Dish complete!</h1>
          <p style={{ color: '#8D9187', fontSize: '14px', marginBottom: '32px' }}>
            You saved €4.50 and used up 3 expiring items. High five!
          </p>

          <button 
            className="pill-btn pill-primary-lime"
            style={{ width: '100%', maxWidth: '300px' }}
            onClick={handleFinish}
          >
            Done & return home
          </button>
        </div>
      )}
    </div>
  );
};
