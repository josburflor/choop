import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  updateDoc,
  deleteDoc,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Shift, User, Notification } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const SHIFTS_COLLECTION = 'shifts';

export const shiftService = {
  async getHistory(userId: string): Promise<Shift[]> {
    try {
      const q = query(
        collection(db, SHIFTS_COLLECTION),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('startTime', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Shift);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, SHIFTS_COLLECTION);
      return [];
    }
  },

  async saveShift(shift: Shift): Promise<void> {
    try {
      await setDoc(doc(db, SHIFTS_COLLECTION, shift.id), shift);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${SHIFTS_COLLECTION}/${shift.id}`);
    }
  },

  async getActiveShift(userId: string): Promise<Shift | null> {
    try {
      const q = query(
        collection(db, SHIFTS_COLLECTION),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      return querySnapshot.docs[0].data() as Shift;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, SHIFTS_COLLECTION);
      return null;
    }
  },

  subscribeToActiveShift(userId: string, callback: (shift: Shift | null) => void, errorCallback?: (error: any) => void) {
    const q = query(
      collection(db, SHIFTS_COLLECTION),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    
    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
      } else {
        callback(snapshot.docs[0].data() as Shift);
      }
    }, (error) => {
      if (errorCallback) errorCallback(error);
      handleFirestoreError(error, OperationType.GET, SHIFTS_COLLECTION);
    });
  },

  subscribeToHistory(userId: string, callback: (shifts: Shift[]) => void, errorCallback?: (error: any) => void) {
    const q = query(
      collection(db, SHIFTS_COLLECTION),
      where('userId', '==', userId),
      where('status', '==', 'completed'),
      orderBy('startTime', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Shift));
    }, (error) => {
      if (errorCallback) errorCallback(error);
      handleFirestoreError(error, OperationType.LIST, SHIFTS_COLLECTION);
    });
  },

  // Admin Methods
  subscribeToAllShifts(callback: (shifts: Shift[]) => void, errorCallback?: (error: any) => void) {
    const q = query(
      collection(db, SHIFTS_COLLECTION),
      orderBy('startTime', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Shift));
    }, (error) => {
      if (errorCallback) errorCallback(error);
      handleFirestoreError(error, OperationType.LIST, SHIFTS_COLLECTION);
    });
  },

  async getAllUsers(): Promise<User[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      return querySnapshot.docs.map(doc => doc.data() as User);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      return [];
    }
  },

  subscribeToUsers(callback: (users: User[]) => void, errorCallback?: (error: any) => void) {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as User));
    }, (error) => {
      if (errorCallback) errorCallback(error);
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
  },

  async saveUser(user: User): Promise<void> {
    try {
      await setDoc(doc(db, 'users', user.id), user);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
    }
  },

  async deleteUser(userId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  },

  async getUserByCredentials(email: string, accessKey: string): Promise<User | null> {
    try {
      const q = query(
        collection(db, 'users'), 
        where('email', '==', email), 
        where('accessKey', '==', accessKey)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      return querySnapshot.docs[0].data() as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      return null;
    }
  },

  // Notification Methods
  async createNotification(notification: Omit<Notification, 'id'>): Promise<void> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), notification);
      await updateDoc(docRef, { id: docRef.id });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notifications');
    }
  },

  subscribeToNotifications(callback: (notifications: Notification[]) => void, errorCallback?: (error: any) => void) {
    const q = query(
      collection(db, 'notifications'),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Notification));
    }, (error) => {
      if (errorCallback) errorCallback(error);
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  },

  async deleteShiftWithComment(shiftId: string, comment: string, user: User): Promise<void> {
    try {
      const shiftRef = doc(db, SHIFTS_COLLECTION, shiftId);
      await updateDoc(shiftRef, {
        deletedAt: Date.now(),
        deletionComment: comment,
        status: 'deleted' // Cambiamos el estado para que no aparezca en el historial normal
      });

      // Crear notificación para el admin
      await this.createNotification({
        userId: user.id,
        userName: user.name,
        type: 'deletion',
        message: `El trabajador ${user.name} eliminó un turno con el comentario: "${comment}"`,
        timestamp: Date.now(),
        read: false,
        shiftId: shiftId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SHIFTS_COLLECTION}/${shiftId}`);
    }
  },

  async addShiftComment(shiftId: string, comment: string, user: User): Promise<void> {
    try {
      await updateDoc(doc(db, SHIFTS_COLLECTION, shiftId), { comment });

      // Crear notificación para el admin
      await this.createNotification({
        userId: user.id,
        userName: user.name,
        type: 'comment',
        message: `El trabajador ${user.name} añadió un comentario a su turno: "${comment}"`,
        timestamp: Date.now(),
        read: false,
        shiftId: shiftId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SHIFTS_COLLECTION}/${shiftId}`);
    }
  }
};
