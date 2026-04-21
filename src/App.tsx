import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  History as HistoryIcon, 
  Play, 
  Square, 
  Plus, 
  AlertCircle, 
  ChevronRight, 
  LogOut, 
  Settings,
  LayoutDashboard,
  Calendar,
  Filter,
  User as UserIcon,
  LogIn,
  Shield,
  Users as UsersIcon,
  UserPlus,
  Trash2,
  Key,
  Briefcase,
  Phone,
  Camera,
  Edit2,
  CheckCircle2,
  XCircle,
  Sun,
  Moon,
  Info,
  FileText,
  ExternalLink,
  MessageSquare,
  Bell,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Input } from './components/ui/Input';
import { Modal } from './components/ui/Modal';
import { Timer } from './components/Timer';
import { Shift, User, Notification } from './types';
import { shiftService } from './services/shiftService';
import { cn } from './lib/utils';
import { auth, db } from './firebase';
import { GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [view, setView] = useState<'dashboard' | 'history' | 'admin' | 'settings'>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [inputHours, setInputHours] = useState<string>('');
  const [inputMinutes, setInputMinutes] = useState<string>('0');
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [extensionHours, setExtensionHours] = useState<string>('');
  const [extensionMinutes, setExtensionMinutes] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(true);
  const [adminFilterUser, setAdminFilterUser] = useState<string>('all');
  const [adminFilterMonth, setAdminFilterMonth] = useState<string>('all');
  const [adminFilterYear, setAdminFilterYear] = useState<string>(new Date().getFullYear().toString());
  
  // Notifications & Comments State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isShiftDetailOpen, setIsShiftDetailOpen] = useState(false);
  const [shiftComment, setShiftComment] = useState('');
  const [deletionComment, setDeletionComment] = useState('');
  const [isDeletingShift, setIsDeletingShift] = useState(false);
  
  // Login State
  const [loginData, setLoginData] = useState({ email: '', accessKey: '' });
  const [loginError, setLoginError] = useState('');

  // Admin User Management State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userDataForm, setUserDataForm] = useState({
    email: '',
    name: '',
    role: 'worker',
    contractHours: '40',
    accessKey: '',
    phone: '',
    photoURL: '',
    status: 'active' as 'active' | 'inactive'
  });

  const isAdmin = user?.role === 'admin' || user?.email === 'josburflor@gmail.com';

  // Session Persistence & Auth Initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('choop_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('light-theme', savedTheme === 'light');
    }

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Siempre intentamos una sesión anónima para Firestore
      if (!firebaseUser) {
        signInAnonymously(auth).catch(err => {
          // Ignoramos el error de operación restringida para evitar el log spam 
          // pero permitimos que el flujo continúe
          if (err.code !== 'auth/admin-restricted-operation') {
            console.warn("Auth initialization note:", err.code);
          }
        });
      }
    });

    const savedUser = localStorage.getItem('choop_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      // Re-verify with DB
      getDoc(doc(db, 'users', parsedUser.id)).then(docSnap => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as User;
          setUser(userData);
          if (userData.role === 'admin' || userData.email === 'josburflor@gmail.com') {
            setView('admin');
          }
        } else {
          localStorage.removeItem('choop_user');
        }
        setIsLoading(false);
      }).catch(() => {
        // Si hay error de permisos al verificar sesión antigua, esperamos a que la sesión anónima se establezca
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => unsubAuth();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) return;

    const unsubActive = shiftService.subscribeToActiveShift(user.id, (shift) => {
      setActiveShift(shift);
    });

    const unsubHistory = shiftService.subscribeToHistory(user.id, (shifts) => {
      setHistory(shifts);
    });

    let unsubAll: (() => void) | undefined;
    let unsubNotifications: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;

    if (isAdmin) {
      unsubAll = shiftService.subscribeToAllShifts((shifts) => {
        setAllShifts(shifts);
      });
      unsubNotifications = shiftService.subscribeToNotifications((notifs) => {
        setNotifications(notifs);
      });
      unsubUsers = shiftService.subscribeToUsers((users) => {
        setAllUsers(users);
      });
    }

    return () => {
      unsubActive();
      unsubHistory();
      if (unsubAll) unsubAll();
      if (unsubNotifications) unsubNotifications();
      if (unsubUsers) unsubUsers();
    };
  }, [user, isAdmin]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('choop_theme', newTheme);
    // Usamos una clase en el body para mayor control
    if (newTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    if (!loginData.email || !loginData.accessKey) {
      setLoginError('Por favor, completa todos los campos.');
      return;
    }

    // Special case for owner if not registered yet
    if (loginData.email === 'josburflor@gmail.com' && loginData.accessKey === 'ADMIN123') {
      const ownerData: User = {
        id: 'owner_admin',
        email: 'josburflor@gmail.com',
        name: 'Administrador Principal',
        role: 'admin',
        contractHours: 0,
        accessKey: 'ADMIN123',
        createdAt: Date.now()
      };
      
      try {
        // First try to get it to see if it exists
        const docRef = doc(db, 'users', 'owner_admin');
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await shiftService.saveUser(ownerData);
        }
      } catch (err) {
        console.warn("Could not sync owner profile, but continuing login", err);
      }
      
      setUser(ownerData);
      localStorage.setItem('choop_user', JSON.stringify(ownerData));
      setView('admin'); // Forzar vista admin
      return;
    }

    const foundUser = await shiftService.getUserByCredentials(loginData.email, loginData.accessKey);
    if (foundUser) {
      if (foundUser.status === 'inactive') {
        setLoginError('Tu cuenta está desactivada temporalmente. Contacta con el administrador.');
        return;
      }
      setUser(foundUser);
      localStorage.setItem('choop_user', JSON.stringify(foundUser));
      if (foundUser.role === 'admin' || foundUser.email === 'josburflor@gmail.com') {
        setView('admin');
      } else {
        setView('dashboard');
      }
    } else {
      setLoginError('Credenciales incorrectas. Verifica tu email y clave.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('choop_user');
    setView('dashboard');
  };

  const handleOpenUserModal = (u: User | null = null) => {
    if (u) {
      setEditingUser(u);
      setUserDataForm({
        email: u.email,
        name: u.name,
        role: u.role,
        contractHours: u.contractHours.toString(),
        accessKey: u.accessKey,
        phone: u.phone || '',
        photoURL: u.photoURL || '',
        status: u.status || 'active'
      });
    } else {
      setEditingUser(null);
      setUserDataForm({
        email: '',
        name: '',
        role: 'worker',
        contractHours: '40',
        accessKey: Math.random().toString(36).substring(2, 8).toUpperCase(),
        phone: '',
        photoURL: '',
        status: 'active'
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userDataForm.email || !userDataForm.name) {
      alert("Por favor, completa el nombre y el correo electrónico.");
      return;
    }
    
    const userData: User = {
      id: editingUser?.id || `user_${Date.now()}`,
      email: userDataForm.email,
      name: userDataForm.name,
      role: userDataForm.role as 'admin' | 'worker',
      contractHours: parseFloat(userDataForm.contractHours) || 0,
      accessKey: userDataForm.accessKey || Math.random().toString(36).substring(2, 8).toUpperCase(),
      phone: userDataForm.phone,
      photoURL: userDataForm.photoURL,
      status: userDataForm.status,
      createdAt: editingUser?.createdAt || Date.now()
    };

    try {
      await shiftService.saveUser(userData);
      setIsUserModalOpen(false);
      // Reset form
      setUserDataForm({
        email: '',
        name: '',
        role: 'worker',
        contractHours: '40',
        accessKey: '',
        phone: '',
        photoURL: '',
        status: 'active'
      });
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Hubo un error al guardar el empleado.");
    }
  };

  const toggleUserStatus = async (targetUser: User) => {
    const newStatus = targetUser.status === 'inactive' ? 'active' : 'inactive';
    const updatedUser: User = { ...targetUser, status: newStatus };
    
    try {
      await shiftService.saveUser(updatedUser);
    } catch (error) {
      console.error("Error toggling user status:", error);
      alert("No se pudo cambiar el estado del usuario.");
    }
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      await shiftService.deleteUser(userToDelete);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleAddComment = async () => {
    if (!selectedShift || !shiftComment.trim() || !user) return;
    await shiftService.addShiftComment(selectedShift.id, shiftComment, user);
    setShiftComment('');
    setIsShiftDetailOpen(false);
    setView('dashboard');
  };

  const handleDeleteShift = async () => {
    if (!selectedShift || !deletionComment.trim() || !user) return;
    await shiftService.deleteShiftWithComment(selectedShift.id, deletionComment, user);
    setDeletionComment('');
    setIsDeletingShift(false);
    setIsShiftDetailOpen(false);
    setView('dashboard');
  };

  const handleMarkNotificationRead = async (id: string) => {
    await shiftService.markNotificationAsRead(id);
  };

  const formatRemainingTime = (totalHours: number, doneHours: number) => {
    const remaining = Math.max(0, totalHours - doneHours);
    const h = Math.floor(remaining);
    const m = Math.round((remaining - h) * 60);
    return `${h}h ${m}m`;
  };

  const confirmDeleteUser = (userId: string) => {
    setUserToDelete(userId);
    setIsDeleteModalOpen(true);
  };

  const compressImage = (base64Str: string, maxWidth = 400, maxHeight = 400): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Comprimir al 70% de calidad
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("La imagen es demasiado grande. Por favor selecciona una menor a 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64);
        setUserDataForm(prev => ({ ...prev, photoURL: compressed }));
      };
      reader.readAsDataURL(file);
    }
  };

  const viewEmployeeHistory = (userId: string) => {
    setAdminFilterUser(userId);
    const element = document.getElementById('recent-records');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const downloadEmployeeHistory = (targetUser: User) => {
    const userShifts = allShifts.filter(s => s.userId === targetUser.id);
    if (userShifts.length === 0) {
      alert("No hay registros para este empleado.");
      return;
    }

    // Preparar los datos para Excel
    const data = userShifts.map(s => ({
      "Empleado": targetUser.name,
      "Email": targetUser.email,
      "Fecha": s.date,
      "Hora Inicio": new Date(s.startTime).toLocaleTimeString(),
      "Hora Fin": s.endTime ? new Date(s.endTime).toLocaleTimeString() : 'En curso',
      "Horas Totales": parseFloat(s.totalHours.toFixed(2)),
      "Extensiones": s.extensions,
      "Estado": s.status === 'deleted' ? 'ELIMINADO' : 'COMPLETADO',
      "Comentario": s.comment || '',
      "Motivo Eliminación": s.deletionComment || ''
    }));

    // Crear el libro de trabajo (Workbook)
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial");

    // Ajustar anchos de columna automáticamente
    const wscols = [
      { wch: 25 }, // Empleado
      { wch: 30 }, // Email
      { wch: 15 }, // Fecha
      { wch: 15 }, // Hora Inicio
      { wch: 15 }, // Hora Fin
      { wch: 15 }, // Horas Totales
      { wch: 12 }, // Extensiones
      { wch: 15 }, // Estado
      { wch: 40 }, // Comentario
      { wch: 40 }, // Motivo Eliminación
    ];
    worksheet['!cols'] = wscols;

    // Descargar el archivo
    XLSX.writeFile(workbook, `Reporte_${targetUser.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
  };

  const downloadMonthlySummary = () => {
    if (adminFilterMonth === 'all') {
      alert("Por favor, selecciona un mes específico para descargar el resumen.");
      return;
    }

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const selectedMonthName = monthNames[parseInt(adminFilterMonth)];

    // Filtrar turnos por mes y año (solo completados)
    const monthlyShifts = allShifts.filter(s => {
      const date = new Date(s.startTime);
      return date.getMonth().toString() === adminFilterMonth && 
             date.getFullYear().toString() === adminFilterYear &&
             s.status === 'completed';
    });

    if (monthlyShifts.length === 0) {
      alert(`No hay turnos finalizados en ${selectedMonthName} de ${adminFilterYear}.`);
      return;
    }

    // Agrupar por empleado
    const summaryData = allUsers.map(u => {
      const userShifts = monthlyShifts.filter(s => s.userId === u.id);
      const totalHours = userShifts.reduce((acc, s) => acc + s.totalHours, 0);
      const totalExtensions = userShifts.reduce((acc, s) => acc + s.extensions, 0);
      
      // Definimos "Horas Extras" como las horas añadidas mediante extensiones
      // (Asumiendo que cada extensión añade tiempo extra al turno original)
      // O simplemente reportamos el total de horas y el conteo de extensiones.
      
      return {
        "Nombre del Trabajador": u.name,
        "Email": u.email,
        "Mes": selectedMonthName,
        "Año": adminFilterYear,
        "Turnos Finalizados": userShifts.length,
        "Horas Realizadas": parseFloat(totalHours.toFixed(2)),
        "Extensiones Realizadas": totalExtensions,
        "Estado del Mes": "Finalizado"
      };
    }).filter(row => row["Turnos Finalizados"] > 0);

    if (summaryData.length === 0) {
      alert("No hay datos de actividad para los empleados en este periodo.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(summaryData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen Mensual");

    const wscols = [
      { wch: 30 }, // Nombre
      { wch: 30 }, // Email
      { wch: 15 }, // Mes
      { wch: 10 }, // Año
      { wch: 20 }, // Turnos
      { wch: 20 }, // Horas
      { wch: 25 }, // Extensiones
      { wch: 15 }, // Estado
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Resumen_${selectedMonthName}_${adminFilterYear}.xlsx`);
  };

  const playAlertSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // La
    oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 1);
  };

  const handleStartShift = async () => {
    if (!user) return;
    const hours = parseFloat(inputHours) || 0;
    const minutes = parseFloat(inputMinutes) || 0;
    
    if ((hours <= 0 && minutes <= 0) || isNaN(hours) || isNaN(minutes)) {
      alert("Por favor, ingresa un tiempo válido.");
      return;
    }

    const totalDecimalHours = hours + (minutes / 60);

    const newShift: Shift = {
      id: `shift_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      userName: user.name,
      startTime: Date.now(),
      endTime: null,
      totalHours: totalDecimalHours,
      extensions: 0,
      date: new Date().toLocaleDateString(),
      status: 'active'
    };

    try {
      await shiftService.saveShift(newShift);
      setInputHours('');
      setInputMinutes('0');
    } catch (error) {
      console.error("Error starting shift:", error);
      alert("No se pudo iniciar el turno. Inténtalo de nuevo.");
    }
  };

  const handleExtendShift = async () => {
    const extraHours = parseFloat(extensionHours) || 0;
    const extraMinutes = parseFloat(extensionMinutes) || 0;
    
    if ((extraHours <= 0 && extraMinutes <= 0) || isNaN(extraHours) || isNaN(extraMinutes) || !activeShift) return;

    const totalExtraDecimal = extraHours + (extraMinutes / 60);

    const updatedShift: Shift = {
      ...activeShift,
      totalHours: activeShift.totalHours + totalExtraDecimal,
      extensions: activeShift.extensions + 1
    };

    await shiftService.saveShift(updatedShift);
    setExtensionHours('');
    setExtensionMinutes('0');
    setIsExtendOpen(false);
    setIsAlertOpen(false);
  };

  const handleFinishShift = async () => {
    if (!activeShift) return;

    const finishedShift: Shift = {
      ...activeShift,
      endTime: Date.now(),
      status: 'completed'
    };

    await shiftService.saveShift(finishedShift);
    setIsAlertOpen(false);
    setView('history');
  };

  const handleAutoFinish = React.useCallback(async () => {
    if (activeShift) {
      await handleFinishShift();
      playAlertSound();
    }
  }, [activeShift]);

  const handleAlert10Min = React.useCallback(() => {
    setIsAlertOpen(true);
    playAlertSound();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#F97316]/20 border-t-[#F97316] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center space-y-8 py-12">
          <div className="w-20 h-20 bg-[#F97316] rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-[#F97316]/20">
            <Clock className="text-white" size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter">CHOOP</h1>
            <p className="text-neutral-400 font-medium">Acceso al Sistema de Turnos</p>
          </div>
          
          <div className="space-y-4 text-left">
            <Input 
              label="Correo Electrónico"
              placeholder="ejemplo@correo.com"
              value={loginData.email}
              onChange={(e) => setLoginData({...loginData, email: e.target.value})}
            />
            <Input 
              label="Clave de Acceso"
              type="password"
              placeholder="••••••"
              value={loginData.accessKey}
              onChange={(e) => setLoginData({...loginData, accessKey: e.target.value})}
            />
            {loginError && (
              <p className="text-rose-500 text-xs font-bold flex items-center gap-1">
                <AlertCircle size={14} />
                {loginError}
              </p>
            )}
          </div>

          <Button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 py-4 text-lg font-bold">
            <LogIn size={20} />
            Entrar al Programa
          </Button>

          <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold">
            Solicita tu clave al administrador de la empresa
          </p>
        </Card>
      </div>
    );
  }

  const filteredShifts = allShifts.filter(s => {
    const date = new Date(s.startTime);
    const matchesUser = adminFilterUser === 'all' || s.userId === adminFilterUser;
    const matchesMonth = adminFilterMonth === 'all' || date.getMonth().toString() === adminFilterMonth;
    const matchesYear = adminFilterYear === 'all' || date.getFullYear().toString() === adminFilterYear;
    return matchesUser && matchesMonth && matchesYear;
  });

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white flex font-sans">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-[#1A1A1A] border-r border-neutral-800 flex flex-col p-4 md:p-6">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-[#F97316] rounded-xl flex items-center justify-center shadow-lg shadow-[#F97316]/20">
            <Clock className="text-white" size={24} />
          </div>
          <span className="text-2xl font-black tracking-tighter hidden md:block">CHOOP</span>
        </div>

        <nav className="flex-1 space-y-2">
          {!isAdmin && (
            <>
              <button 
                onClick={() => setView('dashboard')}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl transition-all group",
                  view === 'dashboard' ? "bg-[#F97316] text-white" : "text-neutral-500 hover:bg-neutral-800 hover:text-white"
                )}
              >
                <LayoutDashboard size={20} />
                <span className="font-semibold hidden md:block">Dashboard</span>
              </button>
              <button 
                onClick={() => setView('history')}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl transition-all group",
                  view === 'history' ? "bg-[#F97316] text-white" : "text-neutral-500 hover:bg-neutral-800 hover:text-white"
                )}
              >
                <HistoryIcon size={20} />
                <span className="font-semibold hidden md:block">Mi Historial</span>
              </button>
            </>
          )}
          
          {isAdmin && (
            <button 
              onClick={() => setView('admin')}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-all group",
                view === 'admin' ? "bg-purple-600 text-white" : "text-neutral-500 hover:bg-neutral-800 hover:text-white"
              )}
            >
              <Shield size={20} />
              <span className="font-semibold hidden md:block">Panel Admin</span>
            </button>
          )}
          {view === 'history' && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex items-center gap-2">
                <Filter size={14} />
                Este Mes
              </Button>
            </div>
          )}
        </nav>

        <div className="pt-6 border-t border-neutral-800 space-y-2">
          <div className="px-4 py-3 bg-[#262626] rounded-xl mb-4 hidden md:block">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-neutral-700 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon size={16} className="m-auto mt-2 text-neutral-500" />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold truncate">{user.name}</p>
                <p className={cn(
                  "text-[8px] font-black uppercase tracking-widest",
                  isAdmin ? "text-purple-500" : "text-[#F97316]"
                )}>
                  {isAdmin ? 'Administrador' : 'Trabajador'}
                </p>
              </div>
            </div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Tu Clave</p>
            <div className="flex items-center gap-2 text-[#F97316] font-mono font-bold text-sm">
              <Key size={12} />
              {user.accessKey}
            </div>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setView('settings')}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-all group",
                view === 'settings' ? "bg-blue-600 text-white" : "text-neutral-500 hover:bg-neutral-800 hover:text-white"
              )}
            >
              <Settings size={20} />
              <span className="font-semibold hidden md:block">Ajustes</span>
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 rounded-xl text-neutral-500 hover:bg-rose-500/10 hover:text-rose-500 transition-all"
          >
            <LogOut size={20} />
            <span className="font-semibold hidden md:block">Salir</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <header className="mb-12">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-4xl font-bold mb-2">¡Hola, {user.name.split(' ')[0]}! 👋</h2>
                    <p className="text-neutral-500">Gestiona tu jornada laboral de forma eficiente.</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Contrato Semanal</p>
                    <p className="text-xl font-black text-[#F97316]">{user.contractHours}h / semana</p>
                  </div>
                </div>

                {/* Progreso Semanal */}
                <Card padding="sm" className="bg-[#1A1A1A] border-neutral-800">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                      <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Horas Restantes de Contrato</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {history.filter(s => s.status !== 'deleted').reduce((acc, curr) => acc + curr.totalHours, 0) > user.contractHours && (
                        <span className="text-[10px] font-black bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded uppercase tracking-tighter">
                          Horas Extras Activas
                        </span>
                      )}
                      <span className="text-sm font-black text-purple-500">
                        {formatRemainingTime(user.contractHours, history.filter(s => s.status !== 'deleted').reduce((acc, curr) => acc + curr.totalHours, 0))} restantes
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 transition-all duration-1000"
                      style={{ width: `${Math.min(100, (history.filter(s => s.status !== 'deleted').reduce((acc, curr) => acc + curr.totalHours, 0) / user.contractHours) * 100)}%` }}
                    />
                  </div>
                </Card>
              </header>

              {!activeShift ? (
                <Card className="text-center py-16">
                  <div className="w-20 h-20 bg-[#262626] rounded-3xl flex items-center justify-center mx-auto mb-8">
                    <Play size={40} className="text-[#F97316] ml-1" fill="currentColor" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">¿Listo para empezar?</h3>
                  <p className="text-neutral-400 mb-10 max-w-sm mx-auto">
                    Indica cuántas horas planeas trabajar hoy para iniciar tu cronómetro.
                  </p>
                  
                  <div className="space-y-6 max-w-md mx-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <Input 
                        label="Horas"
                        type="number"
                        placeholder="0"
                        value={inputHours}
                        onChange={(e) => setInputHours(e.target.value)}
                      />
                      <Input 
                        label="Minutos"
                        type="number"
                        placeholder="0"
                        value={inputMinutes}
                        onChange={(e) => setInputMinutes(e.target.value)}
                      />
                    </div>
                    
                    <Button onClick={handleStartShift} className="w-full py-4 text-lg">
                      Iniciar Turno
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#F97316] to-rose-500" />
                  
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {history.filter(s => s.status !== 'deleted').reduce((acc, curr) => acc + curr.totalHours, 0) >= user.contractHours ? (
                          <>
                            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                            <span className="text-xs font-bold uppercase tracking-widest text-rose-500">Horas Extras</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">Turno en curso</span>
                          </>
                        )}
                      </div>
                      <p className="text-neutral-400 text-sm">Iniciado a las {new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {activeShift.extensions > 0 && (
                      <div className="bg-[#262626] px-4 py-2 rounded-full text-xs font-bold text-[#F97316]">
                        {activeShift.extensions} Extensiones
                      </div>
                    )}
                  </div>

                  <Timer 
                    startTime={activeShift.startTime}
                    totalHours={activeShift.totalHours}
                    onAlert={handleAlert10Min}
                    onFinish={handleAutoFinish}
                    weeklyHoursDone={history.filter(s => s.status !== 'deleted').reduce((acc, curr) => acc + curr.totalHours, 0)}
                    contractHours={user.contractHours}
                  />

                  <div className="grid grid-cols-2 gap-4 mt-12">
                    <Button variant="primary" onClick={() => setIsExtendOpen(true)} className="flex items-center justify-center gap-2">
                      <Plus size={20} />
                      Extender Turno
                    </Button>
                    <Button variant="secondary" onClick={handleFinishShift} className="flex items-center justify-center gap-2">
                      <Square size={18} fill="currentColor" />
                      Finalizar Turno
                    </Button>
                  </div>
                </Card>
              )}

              {/* Stats Rápidas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <Card padding="sm" className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-bold uppercase">Hoy</p>
                    <p className="text-xl font-bold">{new Date().toLocaleDateString('es-ES', { weekday: 'long' })}</p>
                  </div>
                </Card>
                <Card padding="sm" className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-bold uppercase">Total Hoy</p>
                    <p className="text-xl font-bold">
                      {history.filter(s => s.date === new Date().toLocaleDateString()).reduce((acc, curr) => acc + curr.totalHours, 0).toFixed(1)}h
                    </p>
                  </div>
                </Card>
                <Card padding="sm" className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                    <Plus size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-bold uppercase">Horas Extras</p>
                    <p className="text-xl font-bold">
                      {Math.max(0, history.reduce((acc, curr) => acc + curr.totalHours, 0) - user.contractHours).toFixed(1)}h
                    </p>
                  </div>
                </Card>
              </div>
            </motion.div>
          ) : view === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto"
            >
              <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-bold mb-2">Mi Historial</h2>
                  <p className="text-neutral-500">Revisa tus misiones pasadas.</p>
                </div>
                <div className="flex gap-4">
                  <Button variant="secondary" size="sm" className="flex items-center gap-2">
                    <Filter size={18} />
                    Filtrar
                  </Button>
                  <Button variant="secondary" size="sm" className="flex items-center gap-2">
                    <Calendar size={18} />
                    Este mes
                  </Button>
                </div>
              </header>

              <div className="space-y-4">
                {history.filter(s => s.status !== 'deleted').length === 0 ? (
                  <Card className="text-center py-20 text-neutral-500 italic">
                    Aún no tienes turnos registrados.
                  </Card>
                ) : (
                  history.filter(s => s.status !== 'deleted').map((shift) => (
                    <Card 
                      key={shift.id} 
                      padding="sm" 
                      className="flex flex-wrap items-center justify-between gap-6 hover:border-[#F97316]/50 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedShift(shift);
                        setShiftComment(shift.comment || '');
                        setIsShiftDetailOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-[#262626] rounded-2xl flex items-center justify-center text-[#F97316] group-hover:scale-110 transition-transform">
                          <Clock size={28} />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{shift.date}</p>
                          <p className="text-sm text-neutral-500">
                            {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                            {shift.endTime ? new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'En curso'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-12">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Horas</p>
                          <p className="text-xl font-black text-[#F97316]">{shift.totalHours.toFixed(1)}h</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Ext.</p>
                          <p className="text-xl font-bold">{shift.extensions}</p>
                        </div>
                        <div className="p-2 text-neutral-700 group-hover:text-white transition-colors">
                          <ChevronRight size={24} />
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </motion.div>
          ) : view === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <header className="mb-12">
                <h2 className="text-4xl font-bold mb-2">Ajustes</h2>
                <p className="text-neutral-500">Personaliza tu experiencia y conoce más sobre CHOOP.</p>
              </header>

              <div className="space-y-8">
                {/* Tema */}
                <Card>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                        {theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Apariencia</h3>
                        <p className="text-sm text-neutral-500">Cambia entre modo claro y oscuro.</p>
                      </div>
                    </div>
                    <button 
                      onClick={toggleTheme}
                      className="flex items-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-bold transition-all border border-neutral-700"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun size={18} className="text-amber-400" />
                          Modo Claro
                        </>
                      ) : (
                        <>
                          <Moon size={18} className="text-blue-400" />
                          Modo Oscuro
                        </>
                      )}
                    </button>
                  </div>
                </Card>

                {/* Diseñador */}
                <Card>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                      <Info size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Información del Diseñador</h3>
                      <p className="text-sm text-neutral-500">Créditos de desarrollo y diseño.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-800">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Desarrollado por</p>
                      <p className="font-bold text-lg">Burgos Diseño</p>
                    </div>
                    <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-800">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Contacto Soporte</p>
                      <div className="flex items-center gap-2 font-bold text-lg text-[#F97316]">
                        <Phone size={16} />
                        +34 6413476049
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Términos y Condiciones */}
                <Card>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Términos y Condiciones</h3>
                      <p className="text-sm text-neutral-500">Aspectos legales y privacidad.</p>
                    </div>
                  </div>
                  <div className="p-6 bg-neutral-800/30 rounded-xl border border-neutral-800 text-sm text-neutral-400 leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                    <h4 className="font-bold text-white mb-2">1. Uso del Servicio</h4>
                    <p className="mb-4">CHOOP es una herramienta de gestión de turnos. El usuario es responsable de la veracidad de los datos introducidos.</p>
                    
                    <h4 className="font-bold text-white mb-2">2. Privacidad</h4>
                    <p className="mb-4">Sus datos personales y registros de turnos se almacenan de forma segura en Firebase. No compartimos información con terceros.</p>
                    
                    <h4 className="font-bold text-white mb-2">3. Responsabilidad</h4>
                    <p className="mb-4">La empresa no se hace responsable de pérdidas de datos debidas a un mal uso de las claves de acceso personales.</p>
                    
                    <h4 className="font-bold text-white mb-2">4. Propiedad Intelectual</h4>
                    <p>El diseño y código de esta aplicación son propiedad de sus respectivos creadores bajo licencia de uso corporativo.</p>
                  </div>
                </Card>

                <div className="text-center pt-8">
                  <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-[0.2em]">CHOOP v4.0.0 • 2026</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="admin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-6xl mx-auto"
            >
              <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="text-purple-500" size={32} />
                    <h2 className="text-4xl font-bold">Panel de Control</h2>
                  </div>
                  <p className="text-neutral-500">Supervisión global de turnos y empleados.</p>
                </div>
                
                <div className="flex flex-wrap gap-4">
                  <div className="relative">
                    <Button 
                      variant="secondary" 
                      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                      className="relative p-3"
                    >
                      <Bell size={20} />
                      {notifications.filter(n => !n.read).length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0F0F0F]">
                          {notifications.filter(n => !n.read).length}
                        </span>
                      )}
                    </Button>
                    
                    <AnimatePresence>
                      {isNotificationsOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-2 w-80 bg-[#1A1A1A] border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                        >
                          <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
                            <h4 className="font-bold">Notificaciones</h4>
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Recientes</span>
                          </div>
                          <div className="max-h-96 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                              <div className="p-8 text-center text-neutral-500 text-sm italic">
                                No hay notificaciones.
                              </div>
                            ) : (
                              notifications.slice(0, 3).map(n => (
                                <div 
                                  key={n.id} 
                                  className={cn(
                                    "p-4 border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors cursor-pointer",
                                    !n.read && "bg-purple-500/5"
                                  )}
                                  onClick={() => {
                                    handleMarkNotificationRead(n.id);
                                    viewEmployeeHistory(n.userId);
                                    setIsNotificationsOpen(false);
                                  }}
                                >
                                  <div className="flex gap-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                      n.type === 'comment' ? "bg-blue-500/10 text-blue-500" : "bg-rose-500/10 text-rose-500"
                                    )}>
                                      {n.type === 'comment' ? <MessageSquare size={16} /> : <Trash2 size={16} />}
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-xs font-bold leading-tight">{n.message}</p>
                                      <p className="text-[10px] text-neutral-500">
                                        {new Date(n.timestamp).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Button onClick={() => handleOpenUserModal()} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
                    <UserPlus size={18} />
                    Nuevo Empleado
                  </Button>
                  <div className="relative">
                    <UsersIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <select 
                      value={adminFilterUser}
                      onChange={(e) => setAdminFilterUser(e.target.value)}
                      className="bg-[#1A1A1A] border border-neutral-800 rounded-xl pl-12 pr-6 py-3 text-white outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="all">Todos los empleados</option>
                      {allUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-purple-500 transition-colors" size={20} />
                    <select 
                      value={adminFilterMonth} 
                      onChange={(e) => setAdminFilterMonth(e.target.value)}
                      className="bg-[#1A1A1A] border border-neutral-800 rounded-xl pl-12 pr-6 py-3 text-white outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="all">Todos los meses</option>
                      <option value="0">Enero</option>
                      <option value="1">Febrero</option>
                      <option value="2">Marzo</option>
                      <option value="3">Abril</option>
                      <option value="4">Mayo</option>
                      <option value="5">Junio</option>
                      <option value="6">Julio</option>
                      <option value="7">Agosto</option>
                      <option value="8">Septiembre</option>
                      <option value="9">Octubre</option>
                      <option value="10">Noviembre</option>
                      <option value="11">Diciembre</option>
                    </select>
                  </div>

                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-purple-500 transition-colors" size={20} />
                    <select 
                      value={adminFilterYear} 
                      onChange={(e) => setAdminFilterYear(e.target.value)}
                      className="bg-[#1A1A1A] border border-neutral-800 rounded-xl pl-12 pr-6 py-3 text-white outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                  </div>

                  {adminFilterMonth !== 'all' && (
                    <Button 
                      onClick={downloadMonthlySummary}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Download size={18} />
                      Descargar Resumen Mensual
                    </Button>
                  )}
                </div>
              </header>

              {/* Gestión de Empleados */}
              <section className="mb-12 space-y-12">
                {/* Administradores */}
                <div>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Shield size={20} className="text-purple-500" />
                    Administradores
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allUsers.filter(u => u.role === 'admin').map(u => (
                      <Card 
                        key={u.id} 
                        padding="sm" 
                        className="border-neutral-800/50 transition-all hover:border-purple-500/30 group cursor-pointer"
                        onClick={() => handleOpenUserModal(u)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="relative">
                            <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-400 overflow-hidden">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <UserIcon size={24} />
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleOpenUserModal(u); }}
                              className="p-2 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); confirmDeleteUser(u.id); }}
                              className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-lg">{u.name}</h4>
                        <p className="text-sm text-neutral-500 mb-4">{u.email}</p>
                        
                        <div className="space-y-3 pt-4 border-t border-neutral-800/50">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                              <Key size={14} />
                              Clave Acceso
                            </div>
                            <span className="text-sm font-mono font-bold text-[#F97316]">{u.accessKey}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Trabajadores */}
                <div>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <UsersIcon size={20} className="text-[#F97316]" />
                    Trabajadores
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allUsers.filter(u => u.role === 'worker').map(u => (
                      <Card 
                        key={u.id} 
                        padding="sm" 
                        className="border-neutral-800/50 transition-all hover:border-purple-500/30 group cursor-pointer"
                        onClick={() => handleOpenUserModal(u)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="relative">
                            <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-400 overflow-hidden">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <UserIcon size={24} />
                              )}
                            </div>
                            {u.role !== 'admin' && (
                              <div className={cn(
                                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0F0F0F]",
                                u.status === 'inactive' ? "bg-rose-500" : "bg-emerald-500"
                              )} />
                            )}
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {u.role !== 'admin' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleUserStatus(u); }}
                                className={cn(
                                  "p-2 rounded-lg transition-colors",
                                  u.status === 'inactive' ? "text-emerald-500 hover:bg-emerald-500/10" : "text-rose-500 hover:bg-rose-500/10"
                                )}
                                title={u.status === 'inactive' ? "Dar de Alta" : "Dar de Baja"}
                              >
                                {u.status === 'inactive' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                              </button>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); downloadEmployeeHistory(u); }}
                              className="p-2 rounded-lg text-blue-400 hover:bg-blue-400/10 transition-colors"
                              title="Descargar Historial"
                            >
                              <Download size={18} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); viewEmployeeHistory(u.id); }}
                              className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                              title="Ver Historial"
                            >
                              <HistoryIcon size={18} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleOpenUserModal(u); }}
                              className="p-2 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); confirmDeleteUser(u.id); }}
                              className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-lg flex items-center gap-2">
                          {u.name}
                          {u.role !== 'admin' && u.status === 'inactive' && (
                            <span className="text-[8px] font-black bg-rose-500/20 text-rose-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                              Baja
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-neutral-500 mb-4">{u.email}</p>
                        
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="w-full mb-4 flex items-center justify-center gap-2 border-neutral-800 hover:border-emerald-500/50 hover:text-emerald-500"
                          onClick={(e) => { e.stopPropagation(); viewEmployeeHistory(u.id); }}
                        >
                          <HistoryIcon size={16} />
                          Ver Historial de Horas
                        </Button>

                        <div className="space-y-3 pt-4 border-t border-neutral-800/50">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                              <Briefcase size={14} />
                              Contrato
                            </div>
                            <span className="text-sm font-bold text-purple-500">{u.contractHours}h / sem</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                              <Key size={14} />
                              Clave Acceso
                            </div>
                            <span className="text-sm font-mono font-bold text-[#F97316]">{u.accessKey}</span>
                          </div>
                          {u.phone && (
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2 text-xs text-neutral-400">
                                <Phone size={14} />
                                Teléfono
                              </div>
                              <span className="text-sm font-bold text-neutral-300">{u.phone}</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <Card padding="sm" className="bg-purple-500/5 border-purple-500/20">
                  <p className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-2">Total Turnos</p>
                  <p className="text-3xl font-black">{allShifts.length}</p>
                </Card>
                <Card padding="sm" className="bg-emerald-500/5 border-emerald-500/20">
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Activos Ahora</p>
                  <p className="text-3xl font-black">{allShifts.filter(s => s.status === 'active').length}</p>
                </Card>
                <Card padding="sm" className="bg-blue-500/5 border-blue-500/20">
                  <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">Total Horas</p>
                  <p className="text-3xl font-black">{allShifts.reduce((acc, curr) => acc + curr.totalHours, 0).toFixed(1)}h</p>
                </Card>
                <Card padding="sm" className="bg-orange-500/5 border-orange-500/20">
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-2">Horas Extras Totales</p>
                  <p className="text-3xl font-black">
                    {allUsers.reduce((acc, u) => {
                      const userShifts = allShifts.filter(s => s.userId === u.id);
                      const totalHours = userShifts.reduce((sum, s) => sum + s.totalHours, 0);
                      return acc + Math.max(0, totalHours - u.contractHours);
                    }, 0).toFixed(1)}h
                  </p>
                </Card>
              </div>

              <div id="recent-records" className="space-y-4">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <HistoryIcon size={20} />
                  Registros Recientes {adminFilterUser !== 'all' && ` - ${allUsers.find(u => u.id === adminFilterUser)?.name}`}
                </h3>
                
                {filteredShifts.length === 0 ? (
                  <Card className="text-center py-20 text-neutral-500 italic">
                    No se encontraron registros para este filtro.
                  </Card>
                ) : (
                  filteredShifts.map((shift) => (
                    <Card key={shift.id} padding="sm" className="flex flex-wrap items-center justify-between gap-6 hover:bg-neutral-800/30 transition-all border-neutral-800/50">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-400">
                          <UserIcon size={24} />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{shift.userName}</p>
                          <div className="flex items-center gap-2 text-sm text-neutral-500">
                            <Calendar size={14} />
                            {shift.date}
                            <span className="mx-1">•</span>
                            <Clock size={14} />
                            {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-12">
                        <div className={cn(
                          "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                          shift.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : 
                          shift.status === 'deleted' ? "bg-rose-500/10 text-rose-500" : "bg-neutral-800 text-neutral-500"
                        )}>
                          {shift.status === 'active' ? 'En curso' : 
                           shift.status === 'deleted' ? 'Eliminado' : 'Completado'}
                        </div>
                        <div className="text-center min-w-[80px]">
                          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Horas</p>
                          <p className="text-xl font-black text-purple-500">{shift.totalHours.toFixed(1)}h</p>
                        </div>
                        <div className="text-center min-w-[60px]">
                          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Ext.</p>
                          <p className="text-xl font-bold">{shift.extensions}</p>
                        </div>
                      </div>
                      
                      {/* Mostrar Comentarios en el Panel Admin */}
                      {(shift.comment || shift.deletionComment) && (
                        <div className="w-full mt-4 p-4 bg-neutral-900/50 rounded-xl border border-neutral-800/50">
                          <div className="flex items-start gap-3">
                            <MessageSquare size={16} className={cn(
                              "mt-1",
                              shift.status === 'deleted' ? "text-rose-500" : "text-blue-500"
                            )} />
                            <div>
                              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                {shift.status === 'deleted' ? 'Motivo de Eliminación' : 'Comentario del Trabajador'}
                              </p>
                              <p className="text-sm text-neutral-300 italic">
                                "{shift.status === 'deleted' ? shift.deletionComment : shift.comment}"
                              </p>
                              {shift.deletedAt && (
                                <p className="text-[10px] text-rose-500/50 mt-2 font-bold uppercase">
                                  Eliminado el: {new Date(shift.deletedAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Alerta de Finalización */}
      <Modal 
        isOpen={isAlertOpen} 
        onClose={() => setIsAlertOpen(false)}
        title="¡Turno por finalizar!"
      >
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <AlertCircle size={40} className="text-rose-500" />
          </div>
          <p className="text-neutral-400">
            Tu tiempo de jornada está llegando a su fin. ¿Deseas extender tu turno o finalizarlo ahora?
          </p>
          <div className="grid grid-cols-1 gap-3 pt-4">
            <Button onClick={() => { setIsAlertOpen(false); setIsExtendOpen(true); }}>
              Extender Turno
            </Button>
            <Button variant="secondary" onClick={handleFinishShift}>
              Finalizar Turno
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Extensión */}
      <Modal 
        isOpen={isExtendOpen} 
        onClose={() => setIsExtendOpen(false)}
        title="Extender Jornada"
      >
        <div className="space-y-6">
          <p className="text-neutral-400 text-sm">
            Indica cuántas horas adicionales deseas añadir a tu turno actual.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Horas"
              type="number"
              placeholder="0"
              value={extensionHours}
              onChange={(e) => setExtensionHours(e.target.value)}
              autoFocus
            />
            <Input 
              label="Minutos"
              type="number"
              placeholder="0"
              value={extensionMinutes}
              onChange={(e) => setExtensionMinutes(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setIsExtendOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleExtendShift}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Usuario (Crear/Editar) */}
      <Modal 
        isOpen={isUserModalOpen} 
        onClose={() => setIsUserModalOpen(false)}
        title={editingUser ? "Editar Empleado" : "Nuevo Empleado"}
        className="max-w-xl"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar pb-4">
          <div className="space-y-4">
            <Input 
              label="Nombre Completo"
              placeholder="Ej: Juan Pérez"
              value={userDataForm.name}
              onChange={(e) => setUserDataForm({...userDataForm, name: e.target.value})}
            />
            <Input 
              label="Correo Electrónico"
              type="email"
              placeholder="ejemplo@correo.com"
              value={userDataForm.email}
              onChange={(e) => setUserDataForm({...userDataForm, email: e.target.value})}
              disabled={!!editingUser}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Rol del Usuario</label>
                <select 
                  value={userDataForm.role}
                  onChange={(e) => setUserDataForm({...userDataForm, role: e.target.value})}
                  className="w-full bg-[#1A1A1A] border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all"
                >
                  <option value="worker">Trabajador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <Input 
                label="Horas Contrato (Sem)"
                type="number"
                value={userDataForm.contractHours}
                onChange={(e) => setUserDataForm({...userDataForm, contractHours: e.target.value})}
              />
            </div>
            
            {userDataForm.role !== 'admin' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Estado del Empleado</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setUserDataForm({...userDataForm, status: 'active'})}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-xl border font-bold transition-all",
                      userDataForm.status === 'active' 
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                        : "bg-neutral-800 border-neutral-700 text-neutral-500 hover:border-neutral-600"
                    )}
                  >
                    <CheckCircle2 size={18} />
                    Alta / Activo
                  </button>
                  <button
                    onClick={() => setUserDataForm({...userDataForm, status: 'inactive'})}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-xl border font-bold transition-all",
                      userDataForm.status === 'inactive' 
                        ? "bg-rose-500/10 border-rose-500 text-rose-500" 
                        : "bg-neutral-800 border-neutral-700 text-neutral-500 hover:border-neutral-600"
                    )}
                  >
                    <XCircle size={18} />
                    Baja / Inactivo
                  </button>
                </div>
              </div>
            )}

            <Input 
              label="Clave Acceso"
              placeholder="AUTO"
              value={userDataForm.accessKey}
              onChange={(e) => setUserDataForm({...userDataForm, accessKey: e.target.value})}
            />
            <Input 
              label="Número de Teléfono"
              placeholder="Ej: +34 600 000 000"
              value={userDataForm.phone}
              onChange={(e) => setUserDataForm({...userDataForm, phone: e.target.value})}
            />
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                Foto del Empleado
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-400 overflow-hidden border border-neutral-700">
                  {userDataForm.photoURL ? (
                    <img src={userDataForm.photoURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Camera size={24} />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input 
                    type="file" 
                    accept="image/jpeg,image/png"
                    onChange={handleFileChange}
                    className="hidden" 
                    id="photo-upload"
                  />
                  <label 
                    htmlFor="photo-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-bold cursor-pointer transition-colors border border-neutral-700"
                  >
                    <Plus size={16} />
                    Subir Foto (JPG/PNG)
                  </label>
                  <p className="text-[10px] text-neutral-500">
                    Selecciona una imagen de tu dispositivo.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6 sticky bottom-0 bg-[#1A1A1A] py-2 border-t border-neutral-800">
            <Button variant="secondary" className="flex-1" onClick={() => setIsUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className={cn(
                "flex-1 bg-purple-600 hover:bg-purple-700 transition-all",
                (!userDataForm.name || !userDataForm.email) && "opacity-50 cursor-not-allowed"
              )} 
              onClick={handleSaveUser}
              disabled={!userDataForm.name || !userDataForm.email}
            >
              {editingUser ? "Guardar Cambios" : "Crear"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Detalles del Turno (Trabajador) */}
      <Modal
        isOpen={isShiftDetailOpen}
        onClose={() => {
          setIsShiftDetailOpen(false);
          setIsDeletingShift(false);
        }}
        title="Detalles del Turno"
        className="max-w-lg"
      >
        {selectedShift && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-800">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Fecha</p>
                <p className="font-bold">{selectedShift.date}</p>
              </div>
              <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-800">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Total Horas</p>
                <p className="font-bold text-[#F97316]">{selectedShift.totalHours.toFixed(1)}h</p>
              </div>
            </div>

            {!isDeletingShift ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Comentario / Observación</label>
                  <textarea 
                    value={shiftComment}
                    onChange={(e) => setShiftComment(e.target.value)}
                    placeholder="Escribe aquí si tuviste algún inconveniente..."
                    className="w-full bg-[#1A1A1A] border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-[#F97316] transition-all min-h-[100px] resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="secondary" 
                    className="flex-1 border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                    onClick={() => setIsDeletingShift(true)}
                  >
                    <Trash2 size={18} className="mr-2" />
                    Eliminar Turno
                  </Button>
                  <Button className="flex-1" onClick={handleAddComment}>
                    Enviar Comentario
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <p className="text-rose-500 text-sm font-bold flex items-center gap-2">
                    <AlertCircle size={16} />
                    ¿Por qué deseas eliminar este registro?
                  </p>
                </div>
                <textarea 
                  value={deletionComment}
                  onChange={(e) => setDeletionComment(e.target.value)}
                  placeholder="Explica el error o motivo de la eliminación..."
                  className="w-full bg-[#1A1A1A] border border-rose-500/30 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500 transition-all min-h-[100px] resize-none"
                />
                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1" onClick={() => setIsDeletingShift(false)}>
                    Atrás
                  </Button>
                  <Button 
                    className="flex-1 bg-rose-600 hover:bg-rose-700"
                    onClick={handleDeleteShift}
                    disabled={!deletionComment.trim()}
                  >
                    Confirmar Eliminación
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de Confirmación de Eliminación */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Empleado"
      >
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <Trash2 size={40} className="text-rose-500" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-bold">¿Estás completamente seguro?</p>
            <p className="text-neutral-400 text-sm">
              Esta acción eliminará permanentemente al empleado y todos sus registros asociados. No se puede deshacer.
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-rose-600 hover:bg-rose-700" onClick={handleDeleteUser}>
              Eliminar Definitivamente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
