import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { ScreenType } from '../types';

interface NotificationsProps {
  onNavigate: (screen: ScreenType) => void;
}

export const NotificationsScreen: React.FC<NotificationsProps> = ({ onNavigate }) => {
  const { notifications, markNotificationRead } = useUserStore();

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#F3F3F1', minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => onNavigate('home')}
          style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #DADAD6', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} color="#14180F" />
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0B0D0A' }}>Notifications</h1>
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {notifications.map(n => (
          <div
            key={n.id}
            onClick={() => markNotificationRead(n.id)}
            style={{
              backgroundColor: n.isHighlighted ? '#E7EEDD' : '#FFFFFF',
              borderRadius: '24px',
              padding: '16px',
              border: n.isHighlighted ? '1px solid #C8F24A' : '1px solid #DADAD6',
              display: 'flex',
              gap: '14px',
              cursor: 'pointer'
            }}
          >
            {/* Avatar Circle */}
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '14px', 
              backgroundColor: n.isHighlighted ? '#C8F24A' : '#F3F3F1', 
              color: '#14180F', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: '800', 
              fontSize: '16px',
              flexShrink: 0 
            }}>
              {n.avatarLetter}
            </div>

            {/* Notification Content */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: '800', fontSize: '15px', color: '#14180F' }}>{n.title}</div>
                <span style={{ fontSize: '12px', color: '#8D9187' }}>{n.timeAgo}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#555555', marginTop: '4px', lineHeight: '1.4' }}>
                {n.message}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
