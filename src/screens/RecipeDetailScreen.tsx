import React from 'react';
import { ChevronLeft, Bookmark, Share2, Plus, Play, ShoppingBag } from 'lucide-react';
import { useRecipeStore } from '../store/useRecipeStore';
import { useCookingStore } from '../store/useCookingStore';
import { useShoppingStore } from '../store/useShoppingStore';
import { ScreenType } from '../types';

interface DetailProps {
  onNavigate: (screen: ScreenType) => void;
}

export const RecipeDetailScreen: React.FC<DetailProps> = ({ onNavigate }) => {
  const { activeRecipeId, getRecipeById, toggleSaveRecipe, savedRecipeIds } = useRecipeStore();
  const { startCooking } = useCookingStore();
  const { addMultipleItems } = useShoppingStore();

  const recipe = getRecipeById(activeRecipeId) || getRecipeById('r1')!;
  const isSaved = savedRecipeIds.includes(recipe.id);

  const handleStartCooking = () => {
    startCooking(recipe.id, recipe.title, recipe.steps.length);
    onNavigate('cooking-mode');
  };

  const handleAddMissingToShopping = () => {
    const missing = recipe.ingredients.filter(i => !i.inFridge);
    addMultipleItems(missing.map(i => ({
      name: i.name,
      category: 'PANTRY & SPICE',
      amount: i.amount,
      source: `Missing • ${recipe.title}`
    })));
    onNavigate('shopping');
  };

  return (
    <div style={{ backgroundColor: '#F3F3F1', minHeight: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Top Hero Media Header */}
      <div style={{ 
        height: '240px', 
        backgroundColor: '#EFEADA', 
        backgroundImage: 'repeating-linear-gradient(45deg, #E7EEDD 0, #E7EEDD 10px, #EFEADA 10px, #EFEADA 20px)',
        padding: '16px 20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        position: 'relative' 
      }}>
        <button 
          onClick={() => onNavigate('home')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        >
          <ChevronLeft size={20} color="#14180F" />
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => toggleSaveRecipe(recipe.id)}
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              border: 'none', 
              backgroundColor: isSaved ? '#C8F24A' : '#FFFFFF', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <Bookmark size={18} color="#14180F" fill={isSaved ? '#14180F' : 'none'} />
          </button>

          <button 
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          >
            <Share2 size={18} color="#14180F" />
          </button>
        </div>
      </div>

      {/* Main Curved Recipe Sheet Container */}
      <div style={{ 
        marginTop: '-30px', 
        backgroundColor: '#FFFFFF', 
        borderTopLeftRadius: '32px', 
        borderTopRightRadius: '32px', 
        padding: '24px 20px 100px 20px', 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px' 
      }}>
        {/* Badges Row */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge-tag badge-lime">{recipe.matchPercent}% match</span>
          <span className="badge-tag badge-gray">High protein</span>
          <span className="badge-tag badge-gray">Dairy free</span>
        </div>

        {/* Title & Author */}
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#14180F', lineHeight: '1.25', marginBottom: '8px' }}>
            {recipe.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E7EEDD' }} />
              <span style={{ fontSize: '13px', color: '#8D9187', fontWeight: '600' }}>
                {recipe.authorName || 'Nadia Benali'} • {recipe.authorRating || '4.8 ★ (312)'}
              </span>
            </div>
            <button style={{ background: 'none', border: 'none', color: '#16A34A', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
              Follow
            </button>
          </div>
        </div>

        {/* Macro Nutrients 4-Box Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
          {[
            { val: recipe.calories, label: 'kcal' },
            { val: `${recipe.proteinG}g`, label: 'protein' },
            { val: `${recipe.carbsG}g`, label: 'carbs' },
            { val: `${recipe.fatG}g`, label: 'fat' },
          ].map((macro, i) => (
            <div key={i} style={{ backgroundColor: '#F3F3F1', borderRadius: '16px', padding: '12px 6px', textAlign: 'center' }}>
              <div style={{ fontWeight: '800', fontSize: '16px', color: '#14180F' }}>{macro.val}</div>
              <div style={{ fontSize: '11px', color: '#8D9187', marginTop: '2px' }}>{macro.label}</div>
            </div>
          ))}
        </div>

        {/* Ingredients Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#14180F' }}>Ingredients</h2>
            <span style={{ fontSize: '12px', color: '#8D9187' }}>7 of 9 in your fridge</span>
          </div>

          <div style={{ backgroundColor: '#F3F3F1', borderRadius: '24px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recipe.ingredients.map(ing => (
              <div key={ing.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ing.inFridge ? '#16A34A' : '#D97706' }} />
                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#14180F' }}>{ing.name}</span>
                </div>
                <span style={{ fontSize: '13px', color: '#8D9187', fontWeight: '600' }}>{ing.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Missing Ingredients Alert Box */}
        <div style={{ backgroundColor: '#FFF2E5', borderRadius: '20px', padding: '16px', border: '1px solid #FDBA74', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '13px', color: '#D97706', fontWeight: '600', paddingRight: '10px' }}>
            Missing harissa paste and lemon — add both to your shopping list
          </div>
          <button 
            onClick={handleAddMissingToShopping}
            style={{ backgroundColor: '#D97706', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '9999px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Add
          </button>
        </div>

        {/* Adapt to my fridge Card */}
        <div 
          onClick={() => onNavigate('adapt-recipe')}
          style={{ backgroundColor: '#14180F', color: '#FFFFFF', borderRadius: '24px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#C8F24A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color="#14180F" />
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '15px' }}>Adapt to my fridge</div>
            <div style={{ fontSize: '12px', color: '#8D9187' }}>Swap missing items • make it higher protein</div>
          </div>
        </div>

        {/* Method Section */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#14180F', marginBottom: '14px' }}>Method</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recipe.steps.map(step => (
              <div key={step.stepNumber} style={{ display: 'flex', gap: '14px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#F3F3F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '13px', color: '#14180F', flexShrink: 0 }}>
                  {step.stepNumber}
                </div>
                <div style={{ fontSize: '14px', color: '#333333', lineHeight: '1.5' }}>
                  {step.instruction}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Primary Lime CTA */}
      <div style={{ position: 'fixed', bottom: '80px', left: '0', right: '0', padding: '0 20px', display: 'flex', justifyContent: 'center', zIndex: 90 }}>
        <button 
          className="pill-btn pill-primary-lime"
          style={{ width: '100%', maxWidth: '390px', boxShadow: '0 8px 30px rgba(200, 242, 74, 0.45)' }}
          onClick={handleStartCooking}
        >
          Start cooking mode <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#14180F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}><Play size={12} color="#C8F24A" fill="#C8F24A" /></div>
        </button>
      </div>
    </div>
  );
};
