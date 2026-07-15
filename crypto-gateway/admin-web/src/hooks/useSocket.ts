import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

let socket: Socket | null = null;

export const useSocket = () => {
  const token = useAuthStore((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    if (!socket) {
      socket = io('/', {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
      });
    }
    socketRef.current = socket;
    return () => { /* keep socket alive across pages */ };
  }, [token]);

  return socketRef.current;
};

export const getSocket = () => socket;
