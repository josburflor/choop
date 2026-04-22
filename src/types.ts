export type Role = 'worker' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  phone?: string;
  photoURL?: string;
  contractHours: number;
  accessKey: string;
  createdAt: number;
  status?: 'active' | 'inactive';
}

export interface Break {
  startTime: number;
  endTime?: number;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  startTime: number;
  endTime: number | null;
  totalHours: number;
  extensions: number;
  date: string;
  status: 'active' | 'completed' | 'paused';
  breaks?: Break[];
  comment?: string;
  deletedAt?: number;
  deletionComment?: string;
}

export interface Schedule {
  id: string;
  userId: string;
  userName: string;
  date: string;
  startTime: string; // Formato HH:mm
  endTime: string;   // Formato HH:mm
  status: 'planned' | 'completed' | 'missed';
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  userName: string;
  type: 'comment' | 'deletion';
  message: string;
  timestamp: number;
  read: boolean;
  shiftId: string;
}
