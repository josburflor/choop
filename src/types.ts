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

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  startTime: number;
  endTime: number | null;
  totalHours: number;
  extensions: number;
  date: string;
  status: 'active' | 'completed';
  comment?: string;
  deletedAt?: number;
  deletionComment?: string;
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
