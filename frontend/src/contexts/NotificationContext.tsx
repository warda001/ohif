'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  type: 'study_assigned' | 'stat_order' | 'sla_warning' | 'report_finalized' | 'dispute_created' | 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_read: boolean;
  created_at: string;
  actions?: Array<{
    label: string;
    action: () => void;
    type?: 'primary' | 'secondary' | 'danger';
  }>;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  playNotificationSound: (priority: Notification['priority']) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { socket, isConnected } = useSocket();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isConnected || !socket || !isAuthenticated) return;

    // Listen for real-time notifications
    const handleNotification = (notification: Notification) => {
      console.log('Received notification:', notification);
      setNotifications(prev => [notification, ...prev]);
      
      // Play notification sound based on priority
      playNotificationSound(notification.priority);
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: notification.id,
          requireInteraction: notification.priority === 'urgent',
        });
      }
    };

    // Listen for study assignments
    socket.on('notification', handleNotification);

    // Listen for specific events
    socket.on('study_assigned', (data) => {
      handleNotification({
        id: Date.now().toString(),
        type: 'study_assigned',
        title: 'New Study Assignment',
        message: `You have been assigned a ${data.modality} study`,
        data,
        priority: data.priority === 'stat' ? 'urgent' : 'normal',
        is_read: false,
        created_at: new Date().toISOString(),
      });
    });

    socket.on('stat_order', (data) => {
      handleNotification({
        id: Date.now().toString(),
        type: 'stat_order',
        title: 'URGENT: STAT Order',
        message: `STAT order received for ${data.modality} study`,
        data,
        priority: 'urgent',
        is_read: false,
        created_at: new Date().toISOString(),
      });
    });

    socket.on('sla_warning', (data) => {
      handleNotification({
        id: Date.now().toString(),
        type: 'sla_warning',
        title: 'SLA Warning',
        message: `Study due in ${data.minutesRemaining} minutes`,
        data,
        priority: 'high',
        is_read: false,
        created_at: new Date().toISOString(),
      });
    });

    return () => {
      socket.off('notification', handleNotification);
      socket.off('study_assigned');
      socket.off('stat_order');
      socket.off('sla_warning');
    };
  }, [socket, isConnected, isAuthenticated]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      is_read: false,
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    playNotificationSound(notification.priority);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, is_read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const playNotificationSound = (priority: Notification['priority']) => {
    // Create audio context for sound
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Different sounds for different priorities
        switch (priority) {
          case 'urgent':
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            break;
          case 'high':
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            break;
          case 'normal':
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            break;
          default:
            oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        }
        
        oscillator.type = 'sine';
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (error) {
        console.warn('Could not play notification sound:', error);
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    playNotificationSound,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}