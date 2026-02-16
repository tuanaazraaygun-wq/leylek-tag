/**
 * ARAMA STATE STORE - Zustand ile global state
 * Callback problemi çözüldü - direkt state güncelleme
 */
import { create } from 'zustand';

interface CallState {
  // Gelen arama
  hasIncomingCall: boolean;
  incomingCallData: {
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
    roomUrl: string;
    roomName: string;
    tagId: string;
  } | null;
  
  // Aksiyonlar
  setIncomingCall: (data: {
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
    roomUrl: string;
    roomName: string;
    tagId: string;
  }) => void;
  clearIncomingCall: () => void;
  updateRoomUrl: (roomUrl: string, roomName: string) => void;
}

export const useCallStore = create<CallState>((set) => ({
  hasIncomingCall: false,
  incomingCallData: null,
  
  setIncomingCall: (data) => {
    console.log('🔔 [CallStore] GELEN ARAMA SET:', data);
    set({ 
      hasIncomingCall: true, 
      incomingCallData: data 
    });
  },
  
  clearIncomingCall: () => {
    console.log('🔕 [CallStore] ARAMA TEMİZLENDİ');
    set({ 
      hasIncomingCall: false, 
      incomingCallData: null 
    });
  },
  
  updateRoomUrl: (roomUrl, roomName) => {
    console.log('🔗 [CallStore] ROOM URL GÜNCELLENDİ:', roomUrl);
    set((state) => ({
      incomingCallData: state.incomingCallData 
        ? { ...state.incomingCallData, roomUrl, roomName }
        : null
    }));
  },
}));
