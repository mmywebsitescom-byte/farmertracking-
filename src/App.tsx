/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  LayoutDashboard, 
  Users, 
  Truck, 
  History, 
  Settings, 
  LogOut, 
  ChevronRight, 
  IndianRupee, 
  Calendar, 
  Clock, 
  Trash2,
  Menu,
  X,
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  FileText,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Pencil
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  getDocFromServer,
  Timestamp,
  orderBy,
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, startOfMonth, startOfYear, isWithinInterval, parseISO, subDays, eachDayOfInterval } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { auth, db } from './firebase';
import { cn } from './lib/utils';
import { Vehicle, Farmer, WorkType, WorkLog } from './types';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) => {
  const variants = {
    primary: 'bg-zinc-900 text-white hover:bg-black shadow-lg shadow-zinc-200',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
    ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100',
  };

  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white rounded-2xl p-4 shadow-sm border border-zinc-100', className)} {...props}>
    {children}
  </div>
);

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <div className="space-y-1 w-full">
    {label && <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</label>}
    <input 
      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all bg-zinc-50/50 text-sm"
      {...props}
    />
  </div>
);

const Select = ({ label, options, placeholder = "Select Option", ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: { value: string, label: string }[], placeholder?: string | null }) => (
  <div className="space-y-1 w-full">
    {label && <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</label>}
    <select 
      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all bg-zinc-50/50 text-sm appearance-none"
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'work' | 'farmers' | 'vehicles' | 'history' | 'settings'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data State
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);

  function handleFirestoreError(err: any, op: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
      error: err instanceof Error ? err.message : String(err),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType: op,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setError(`Database error: ${errInfo.error}`);
    setTimeout(() => setError(null), 3000);
  }

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const qFarmers = query(collection(db, 'farmers'), where('ownerUid', '==', user.uid));
    const unsubFarmers = onSnapshot(qFarmers, (snap) => {
      setFarmers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Farmer)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'farmers'));

    const qVehicles = query(collection(db, 'vehicles'), where('ownerUid', '==', user.uid));
    const unsubVehicles = onSnapshot(qVehicles, (snap) => {
      setVehicles(snap.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles'));

    const qWorkTypes = query(collection(db, 'workTypes'), where('ownerUid', '==', user.uid));
    const unsubWorkTypes = onSnapshot(qWorkTypes, (snap) => {
      setWorkTypes(snap.docs.map(d => ({ ...d.data(), id: d.id } as WorkType)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'workTypes'));

    const qWorkLogs = query(collection(db, 'workLogs'), where('ownerUid', '==', user.uid));
    const unsubWorkLogs = onSnapshot(qWorkLogs, (snap) => {
      const logs = snap.docs.map(d => ({ ...d.data(), id: d.id } as WorkLog));
      logs.sort((a, b) => b.timestamp - a.timestamp);
      setWorkLogs(logs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'workLogs'));

    return () => {
      unsubFarmers();
      unsubVehicles();
      unsubWorkTypes();
      unsubWorkLogs();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login Error:', error);
      setError(error?.message || 'Login failed');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Calculations ---
  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const month = startOfMonth(now);
    const year = startOfYear(now);

    const daily = workLogs
      .filter(log => parseISO(log.date) >= today)
      .reduce((acc, log) => acc + log.totalAmount, 0);

    const monthly = workLogs
      .filter(log => parseISO(log.date) >= month)
      .reduce((acc, log) => acc + log.totalAmount, 0);

    const yearly = workLogs
      .filter(log => parseISO(log.date) >= year)
      .reduce((acc, log) => acc + log.totalAmount, 0);

    return { daily, monthly, yearly };
  }, [workLogs]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center shadow-xl shadow-green-500/20"
        >
          <Truck className="text-white w-8 h-8" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-green-500/40 mb-8">
          <Truck className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Farming Income Tracker</h1>
        <p className="text-gray-500 mb-8 max-w-xs">Track your tractor work, manage farmers, and see your earnings automatically.</p>
        <Button onClick={handleLogin} className="w-full max-w-xs py-4 text-lg">
          Login with Google
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-30 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-200">
            <Truck className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-zinc-900 leading-tight tracking-tighter text-lg italic">FARMERPRO</h1>
            <p className="text-[8px] text-zinc-400 uppercase tracking-[0.2em] font-black">Income Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">{user.displayName}</p>
            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Pro Account</p>
          </div>
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer relative z-50"
          >
            <Menu className="w-6 h-6 text-zinc-900" />
          </button>
        </div>
      </header>

      {/* Sidebar / Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-72 bg-white z-50 shadow-2xl p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-bold text-lg">Menu</h2>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 space-y-2">
                <MenuButton icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMenuOpen(false); }} />
                <MenuButton icon={Plus} label="Add Work" active={activeTab === 'work'} onClick={() => { setActiveTab('work'); setIsMenuOpen(false); }} />
                <MenuButton icon={Users} label="Farmers" active={activeTab === 'farmers'} onClick={() => { setActiveTab('farmers'); setIsMenuOpen(false); }} />
                <MenuButton icon={Truck} label="Vehicles" active={activeTab === 'vehicles'} onClick={() => { setActiveTab('vehicles'); setIsMenuOpen(false); }} />
                <MenuButton icon={History} label="History" active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setIsMenuOpen(false); }} />
                <MenuButton icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMenuOpen(false); }} />
              </div>

              <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <img src={user.photoURL || ''} className="w-10 h-10 rounded-full" />
                  <div className="overflow-hidden">
                    <p className="font-semibold text-sm truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <Button variant="danger" className="w-full" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" /> Logout
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-20 left-4 right-4 z-50 bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-20 left-4 right-4 z-50 bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-widest">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'dashboard' && <Dashboard stats={stats} workLogs={workLogs} farmers={farmers} vehicles={vehicles} workTypes={workTypes} onNavigate={setActiveTab} />}
        {activeTab === 'work' && <WorkEntry farmers={farmers} vehicles={vehicles} workTypes={workTypes} onComplete={() => { setActiveTab('dashboard'); showSuccess("Work logged successfully!"); }} onNavigate={setActiveTab} onError={handleFirestoreError} />}
        {activeTab === 'farmers' && <FarmerManagement farmers={farmers} workLogs={workLogs} vehicles={vehicles} workTypes={workTypes} onError={handleFirestoreError} onShowSuccess={showSuccess} />}
        {activeTab === 'vehicles' && <VehicleManagement vehicles={vehicles} onError={handleFirestoreError} onShowSuccess={showSuccess} />}
        {activeTab === 'history' && <WorkHistory workLogs={workLogs} farmers={farmers} vehicles={vehicles} workTypes={workTypes} onError={handleFirestoreError} onShowSuccess={showSuccess} />}
        {activeTab === 'settings' && <SettingsPage workTypes={workTypes} onError={handleFirestoreError} onShowSuccess={showSuccess} />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 px-6 py-3 flex items-center justify-between z-30">
        <NavButton icon={LayoutDashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <NavButton icon={History} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <button 
          onClick={() => setActiveTab('work')}
          className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-zinc-400 -mt-10 border-4 border-white active:scale-90 transition-transform"
        >
          <Plus className="text-white w-8 h-8" />
        </button>
        <NavButton icon={Truck} active={activeTab === 'vehicles'} onClick={() => setActiveTab('vehicles')} />
        <NavButton icon={Users} active={activeTab === 'farmers'} onClick={() => setActiveTab('farmers')} />
      </nav>
    </div>
  );
}

// --- Sub-Components ---

function MenuButton({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
        active ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-50'
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="font-semibold">{label}</span>
    </button>
  );
}

function NavButton({ icon: Icon, active, onClick }: { icon: any, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        'p-2 transition-all',
        active ? 'text-green-600' : 'text-gray-400'
      )}
    >
      <Icon className="w-6 h-6" />
    </button>
  );
}

function Dashboard({ stats, workLogs, farmers, vehicles, workTypes, onNavigate }: { stats: any, workLogs: WorkLog[], farmers: Farmer[], vehicles: Vehicle[], workTypes: WorkType[], onNavigate: (tab: any) => void }) {
  const recentLogs = workLogs.slice(0, 3);

  const chartData = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });

    return last7Days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTotal = workLogs
        .filter(log => log.date === dateStr)
        .reduce((sum, log) => sum + log.totalAmount, 0);
      
      return {
        name: format(day, 'EEE'),
        amount: dayTotal,
        fullDate: dateStr
      };
    });
  }, [workLogs]);

  const pendingAmount = useMemo(() => {
    return workLogs
      .filter(log => log.status === 'pending')
      .reduce((sum, log) => sum + log.totalAmount, 0);
  }, [workLogs]);

  return (
    <div className="space-y-6">
      {/* Hero Stats */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="bg-zinc-900 text-white border-none shadow-xl shadow-zinc-200 p-6 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Earnings Today</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter">₹{stats.daily.toLocaleString()}</span>
              {stats.daily > 0 && (
                <div className="flex items-center text-emerald-400 text-xs font-bold">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Active
                </div>
              )}
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <TrendingUp className="w-32 h-32" />
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white border-zinc-100">
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1">Pending Payment</p>
            <p className="text-xl font-black text-orange-600 tracking-tight">₹{pendingAmount.toLocaleString()}</p>
          </Card>
          <Card className="bg-white border-zinc-100">
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1">This Month</p>
            <p className="text-xl font-black text-zinc-900 tracking-tight">₹{stats.monthly.toLocaleString()}</p>
          </Card>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="space-y-3">
        <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          Weekly Performance
        </h3>
        <Card className="p-2 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                dy={10}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorAmount)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-widest">Recent Activity</h3>
        </div>
        
        {recentLogs.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
            <Clock className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-zinc-400 text-sm font-medium">No work logged yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentLogs.map(log => {
              const farmer = farmers.find(f => f.id === log.farmerId);
              const type = workTypes.find(t => t.id === log.workTypeId);
              return (
                <Card key={log.id} className="flex items-center justify-between hover:border-zinc-300 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      log.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                    )}>
                      {log.status === 'paid' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 text-sm">{farmer?.name || 'Unknown'}</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{type?.name} • {log.durationHours}h</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-zinc-900">₹{log.totalAmount}</p>
                    <p className={cn(
                      "text-[8px] font-black uppercase tracking-widest",
                      log.status === 'paid' ? "text-emerald-500" : "text-orange-500"
                    )}>{log.status}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <QuickAction icon={Users} label="Farmers" count={farmers.length} color="bg-zinc-900" onClick={() => onNavigate('farmers')} />
        <QuickAction icon={Truck} label="Vehicles" count={vehicles.length} color="bg-zinc-900" onClick={() => onNavigate('vehicles')} />
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, count, color, onClick }: { icon: any, label: string, count: number, color: string, onClick: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-2 cursor-pointer active:scale-95 transition-transform" onClick={onClick}>
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-black text-gray-900">{count}</p>
      </div>
    </Card>
  );
}

function WorkEntry({ farmers, vehicles, workTypes, onComplete, onNavigate, onError }: { farmers: Farmer[], vehicles: Vehicle[], workTypes: WorkType[], onComplete: () => void, onNavigate: (tab: any) => void, onError: (err: any, op: OperationType, path: string) => void }) {
  const [formData, setFormData] = useState({
    farmerId: '',
    vehicleId: '',
    workTypeId: '',
    hours: '0',
    minutes: '0',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending' as 'pending' | 'paid',
    place: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const isSetupIncomplete = farmers.length === 0 || vehicles.length === 0 || workTypes.length === 0;

  const totalAmount = useMemo(() => {
    const type = workTypes.find(t => t.id === formData.workTypeId);
    const h = parseFloat(formData.hours) || 0;
    const m = parseFloat(formData.minutes) || 0;
    const totalHours = h + (m / 60);
    return type ? type.ratePerHour * totalHours : 0;
  }, [formData.workTypeId, formData.hours, formData.minutes, workTypes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(formData.hours) || 0;
    const m = parseFloat(formData.minutes) || 0;
    const totalHours = h + (m / 60);

    if (!formData.farmerId || !formData.vehicleId || !formData.workTypeId || totalHours <= 0) {
      onError(new Error("Please fill in all required fields and ensure duration is greater than 0"), OperationType.WRITE, 'workLogs');
      return;
    }

    setSubmitting(true);
    try {
      const docRef = doc(collection(db, 'workLogs'));
      const id = docRef.id;
      const { hours, minutes, ...rest } = formData;
      await setDoc(docRef, {
        ...rest,
        id,
        durationHours: totalHours,
        totalAmount,
        timestamp: Date.now(),
        ownerUid: auth.currentUser?.uid
      });
      onComplete();
    } catch (err) {
      onError(err, OperationType.CREATE, 'workLogs');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSetupIncomplete) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Setup Required</h2>
        <Card className="bg-orange-50 border-orange-200 p-6 space-y-4">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
            <p className="text-sm text-orange-800 font-medium">You need to add at least one Farmer, Vehicle, and Work Rate before you can log work.</p>
          </div>
          
          <div className="space-y-2">
            {farmers.length === 0 && (
              <Button onClick={() => onNavigate('farmers')} className="w-full bg-orange-600 hover:bg-orange-700">
                <Users className="w-4 h-4" /> Add Farmer
              </Button>
            )}
            {vehicles.length === 0 && (
              <Button onClick={() => onNavigate('vehicles')} className="w-full bg-orange-600 hover:bg-orange-700">
                <Truck className="w-4 h-4" /> Add Vehicle
              </Button>
            )}
            {workTypes.length === 0 && (
              <Button onClick={() => onNavigate('settings')} className="w-full bg-orange-600 hover:bg-orange-700">
                <Settings className="w-4 h-4" /> Add Work Rate
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Log New Work</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select 
          label="Farmer" 
          options={farmers.map(f => ({ value: f.id, label: `${f.name} (${f.village})` }))}
          value={formData.farmerId}
          onChange={e => setFormData(prev => ({ ...prev, farmerId: e.target.value, place: '' }))}
        />
        {(() => {
          const selectedFarmer = farmers.find(f => f.id === formData.farmerId);
          if (selectedFarmer && selectedFarmer.places) {
            const placesList = selectedFarmer.places.split(',').map(s => s.trim()).filter(Boolean);
            if (placesList.length > 0) {
              return (
                <Select 
                  label="Specific Place / Land" 
                  options={placesList.map(p => ({ value: p, label: p }))}
                  value={formData.place}
                  onChange={e => setFormData(prev => ({ ...prev, place: e.target.value }))}
                  placeholder="Select Place..."
                />
              );
            }
          }
          return null;
        })()}
        <Select 
          label="Vehicle" 
          options={vehicles.map(v => ({ value: v.id, label: v.name }))}
          value={formData.vehicleId}
          onChange={e => setFormData(prev => ({ ...prev, vehicleId: e.target.value }))}
        />
        <Select 
          label="Work Type" 
          options={workTypes.map(t => ({ value: t.id, label: `${t.name} (₹${t.ratePerHour}/hr)` }))}
          value={formData.workTypeId}
          onChange={e => setFormData(prev => ({ ...prev, workTypeId: e.target.value }))}
        />
        <div className="grid grid-cols-3 gap-4">
          <Select 
            label="Hours" 
            placeholder={null}
            options={Array.from({ length: 25 }, (_, i) => ({ value: i.toString(), label: i.toString() }))}
            value={formData.hours}
            onChange={e => setFormData(prev => ({ ...prev, hours: e.target.value }))}
          />
          <Select 
            label="Minutes" 
            placeholder={null}
            options={Array.from({ length: 12 }, (_, i) => ({ value: (i * 5).toString(), label: (i * 5).toString() }))}
            value={formData.minutes}
            onChange={e => setFormData(prev => ({ ...prev, minutes: e.target.value }))}
          />
          <Input 
            label="Date" 
            type="date" 
            value={formData.date}
            onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Payment Status</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, status: 'pending' }))}
              className={cn(
                "py-3 rounded-xl font-bold text-xs uppercase tracking-widest border transition-all",
                formData.status === 'pending' 
                  ? "bg-orange-50 border-orange-200 text-orange-600" 
                  : "bg-white border-zinc-100 text-zinc-400"
              )}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, status: 'paid' }))}
              className={cn(
                "py-3 rounded-xl font-bold text-xs uppercase tracking-widest border transition-all",
                formData.status === 'paid' 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                  : "bg-white border-zinc-100 text-zinc-400"
              )}
            >
              Paid
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Notes (Optional)</label>
          <textarea 
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all bg-zinc-50/50 text-sm min-h-[80px]"
            placeholder="Any extra details..."
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>

        <Card className="bg-zinc-900 border-none flex items-center justify-between py-6">
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Calculated Total</p>
            <p className="text-3xl font-black text-white tracking-tighter">₹{totalAmount.toLocaleString()}</p>
          </div>
          <IndianRupee className="text-zinc-800 w-12 h-12" />
        </Card>

        <Button type="submit" disabled={submitting} className="w-full py-4 text-lg bg-zinc-900 hover:bg-black">
          {submitting ? 'Saving...' : 'Save Entry'}
        </Button>
      </form>
    </div>
  );
}

function FarmerProfile({ 
  farmer, workLogs, vehicles, workTypes, onBack, onShowSuccess, onError
}: { 
  farmer: Farmer; workLogs: WorkLog[]; vehicles: Vehicle[]; workTypes: WorkType[]; onBack: () => void; onShowSuccess: (msg: string) => void; onError: (err: any, op: OperationType, path: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'summary' | 'history' | 'payments'>('summary');

  const farmerLogs = useMemo(() => {
    return workLogs.filter(l => l.farmerId === farmer.id).sort((a, b) => b.timestamp - a.timestamp);
  }, [workLogs, farmer.id]);

  const totalAmount = farmerLogs.reduce((sum, log) => sum + log.totalAmount, 0);
  const totalPaid = farmerLogs.filter(l => l.status === 'paid').reduce((sum, log) => sum + log.totalAmount, 0);
  const totalPending = farmerLogs.filter(l => l.status === 'pending').reduce((sum, log) => sum + log.totalAmount, 0);

  const placesBreakdown = useMemo(() => {
    return farmerLogs.reduce((acc, log) => {
      const place = log.place || 'General Setup';
      if (!acc[place]) acc[place] = 0;
      acc[place] += log.totalAmount;
      return acc;
    }, {} as Record<string, number>);
  }, [farmerLogs]);

  const toggleStatus = async (log: WorkLog) => {
    try {
      const newStatus = log.status === 'pending' ? 'paid' : 'pending';
      await updateDoc(doc(db, 'workLogs', log.id), { status: newStatus });
      onShowSuccess(`Marked as ${newStatus}`);
    } catch (err) {
      onError(err, OperationType.UPDATE, 'workLogs');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-white border border-zinc-200 rounded-xl text-zinc-800 hover:bg-zinc-50 transition-colors shadow-sm">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900">{farmer.name}</h2>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{farmer.village} {farmer.phone && `• ${farmer.phone}`}</p>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 mt-4 hide-scrollbar">
        <FilterButton active={activeTab === 'summary'} label="Summary" onClick={() => setActiveTab('summary')} />
        <FilterButton active={activeTab === 'history'} label="History" onClick={() => setActiveTab('history')} />
        <FilterButton active={activeTab === 'payments'} label="Payments" onClick={() => setActiveTab('payments')} />
      </div>

      <div className="mt-4">
        {activeTab === 'history' && (
          <div className="space-y-3">
            {farmerLogs.map(log => {
              const vehicle = vehicles.find(v => v.id === log.vehicleId);
              const type = workTypes.find(t => t.id === log.workTypeId);
              return (
                <Card key={log.id} className="relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{format(parseISO(log.date), 'MMM d, yyyy')}</p>
                      <p className="text-sm font-bold text-zinc-900 mt-1">{log.place || 'General'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-zinc-900 text-lg">₹{log.totalAmount}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge icon={Truck} label={vehicle?.name || 'Unknown'} />
                    <Badge icon={Clock} label={`${log.durationHours} hrs`} />
                    <Badge icon={Settings} label={type?.name || 'Unknown'} />
                  </div>
                </Card>
              );
            })}
            {farmerLogs.length === 0 && <p className="text-center text-zinc-500 py-10">No history found.</p>}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-3">
            {farmerLogs.map(log => (
              <Card key={log.id} className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-zinc-900">{format(parseISO(log.date), 'MMM d, yyyy')}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{log.place || 'General'} • ₹{log.totalAmount}</p>
                </div>
                <button 
                  onClick={() => toggleStatus(log)}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border transition-colors",
                    log.status === 'paid' ? "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100" : "bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100"
                  )}
                >
                  {log.status}
                </button>
              </Card>
            ))}
            {farmerLogs.length === 0 && <p className="text-center text-zinc-500 py-10">No payments found.</p>}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-emerald-50 border-emerald-100 p-4">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Total Paid</p>
                <p className="text-2xl font-black text-emerald-900 mt-1">₹{totalPaid.toLocaleString()}</p>
              </Card>
              <Card className="bg-orange-50 border-orange-100 p-4">
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Total Pending</p>
                <p className="text-2xl font-black text-orange-900 mt-1">₹{totalPending.toLocaleString()}</p>
              </Card>
            </div>
            <Card className="bg-zinc-900 border-none p-6 text-white text-center shadow-lg">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Earned</p>
              <p className="text-4xl font-black mt-2">₹{totalAmount.toLocaleString()}</p>
            </Card>

            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest mt-8 mb-4">Earnings By Place</h3>
            <div className="space-y-2">
              {Object.entries(placesBreakdown).map(([place, amount]) => (
                <Card key={place} className="flex justify-between items-center py-3">
                  <p className="font-bold text-zinc-700">{place}</p>
                  <p className="font-black text-zinc-900">₹{amount.toLocaleString()}</p>
                </Card>
              ))}
              {Object.keys(placesBreakdown).length === 0 && (
                 <p className="text-center text-zinc-500 py-6 text-sm">No places recorded.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FarmerManagement({ farmers, workLogs, vehicles, workTypes, onError, onShowSuccess }: { farmers: Farmer[], workLogs: WorkLog[], vehicles: Vehicle[], workTypes: WorkType[], onError: (err: any, op: OperationType, path: string) => void, onShowSuccess: (msg: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', village: '', places: '', phone: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);

  if (selectedFarmerId) {
    const farmer = farmers.find(f => f.id === selectedFarmerId);
    if (farmer) {
      return <FarmerProfile farmer={farmer} workLogs={workLogs} vehicles={vehicles} workTypes={workTypes} onBack={() => setSelectedFarmerId(null)} onShowSuccess={onShowSuccess} onError={onError} />;
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.village) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'farmers', editingId), { ...formData });
        onShowSuccess("Farmer updated successfully!");
      } else {
        const docRef = doc(collection(db, 'farmers'));
        await setDoc(docRef, { ...formData, id: docRef.id, ownerUid: auth.currentUser?.uid });
        onShowSuccess("Farmer added successfully!");
      }
      setFormData({ name: '', village: '', places: '', phone: '' });
      setShowAdd(false);
      setEditingId(null);
    } catch (err) {
      onError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'farmers');
    }
  };

  const handleEdit = (farmer: Farmer) => {
    setFormData({ name: farmer.name, village: farmer.village, places: farmer.places || '', phone: farmer.phone || '' });
    setEditingId(farmer.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this farmer?')) return;
    try {
      await deleteDoc(doc(db, 'farmers', id));
      onShowSuccess("Farmer deleted.");
    } catch (err) {
      onError(err, OperationType.DELETE, 'farmers');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Farmers</h2>
        <Button onClick={() => {
          if (showAdd) { setShowAdd(false); setEditingId(null); setFormData({ name: '', village: '', places: '', phone: '' }); }
          else setShowAdd(true);
        }} variant={showAdd ? 'secondary' : 'primary'}>
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? 'Cancel' : 'Add Farmer'}
        </Button>
      </div>

      {showAdd && (
        <Card className="bg-white border-2 border-green-500/20">
          <form onSubmit={handleAdd} className="space-y-4">
            <Input label="Farmer Name" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} />
            <Input label="Village" value={formData.village} onChange={e => setFormData(prev => ({ ...prev, village: e.target.value }))} />
            <Input label="Places / Lands (Comma-separated, Optional)" value={formData.places} onChange={e => setFormData(prev => ({ ...prev, places: e.target.value }))} />
            <Input label="Phone (Optional)" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
            <Button type="submit" className="w-full">{editingId ? 'Update Farmer' : 'Save Farmer'}</Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {farmers.map(farmer => (
          <div key={farmer.id} onClick={() => setSelectedFarmerId(farmer.id)}>
            <Card className="flex items-center justify-between cursor-pointer hover:border-zinc-400 transition-all group border-zinc-200">
              <div className="flex-1">
                <p className="font-bold text-gray-900 group-hover:text-black">{farmer.name}</p>
                <p className="text-xs text-gray-500">{farmer.village}{farmer.places ? ` • Lands: ${farmer.places}` : ''} {farmer.phone && `• ${farmer.phone}`}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); handleEdit(farmer); }} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(farmer.id); }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          </div>
        ))}
        {farmers.length === 0 && !showAdd && (
          <div className="text-center py-12 text-gray-400">No farmers added yet.</div>
        )}
      </div>
    </div>
  );
}

function VehicleManagement({ vehicles, onError, onShowSuccess }: { vehicles: Vehicle[], onError: (err: any, op: OperationType, path: string) => void, onShowSuccess: (msg: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'Tractor' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'vehicles', editingId), { ...formData });
        onShowSuccess("Vehicle updated successfully!");
      } else {
        const docRef = doc(collection(db, 'vehicles'));
        await setDoc(docRef, { ...formData, id: docRef.id, ownerUid: auth.currentUser?.uid });
        onShowSuccess("Vehicle added successfully!");
      }
      setFormData({ name: '', type: 'Tractor' });
      setShowAdd(false);
      setEditingId(null);
    } catch (err) {
      onError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'vehicles');
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setFormData({ name: vehicle.name, type: vehicle.type });
    setEditingId(vehicle.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteDoc(doc(db, 'vehicles', id));
      onShowSuccess("Vehicle deleted.");
    } catch (err) {
      onError(err, OperationType.DELETE, 'vehicles');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Vehicles</h2>
        <Button onClick={() => {
          if (showAdd) { setShowAdd(false); setEditingId(null); setFormData({ name: '', type: 'Tractor' }); }
          else setShowAdd(true);
        }} variant={showAdd ? 'secondary' : 'primary'}>
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? 'Cancel' : 'Add Vehicle'}
        </Button>
      </div>

      {showAdd && (
        <Card className="bg-white border-2 border-green-500/20">
          <form onSubmit={handleAdd} className="space-y-4">
            <Input label="Vehicle Name" placeholder="e.g. Tractor 1" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} />
            <Select 
              label="Type" 
              options={[
                { value: 'Tractor', label: 'Tractor' },
                { value: 'Excavator', label: 'Excavator' },
                { value: 'Truck', label: 'Truck' },
                { value: 'Other', label: 'Other' }
              ]}
              value={formData.type}
              onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
            />
            <Button type="submit" className="w-full">{editingId ? 'Update Vehicle' : 'Save Vehicle'}</Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {vehicles.map(v => (
          <Card key={v.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <Truck className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{v.name}</p>
                <p className="text-xs text-gray-500">{v.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => handleEdit(v)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(v.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkHistory({ workLogs, farmers, vehicles, workTypes, onError, onShowSuccess }: { workLogs: WorkLog[], farmers: Farmer[], vehicles: Vehicle[], workTypes: WorkType[], onError: (err: any, op: OperationType, path: string) => void, onShowSuccess: (msg: string) => void }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');

  const filteredLogs = useMemo(() => {
    return workLogs.filter(log => {
      const farmer = farmers.find(f => f.id === log.farmerId);
      const matchesSearch = search === '' || 
                           farmer?.name.toLowerCase().includes(search.toLowerCase()) || 
                           farmer?.village.toLowerCase().includes(search.toLowerCase()) ||
                           farmer?.places?.toLowerCase().includes(search.toLowerCase()) ||
                           log.place?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [workLogs, farmers, search, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'workLogs', id));
      onShowSuccess("Entry deleted.");
    } catch (err) {
      onError(err, OperationType.DELETE, 'workLogs');
    }
  };

  const toggleStatus = async (log: WorkLog) => {
    const newStatus = log.status === 'paid' ? 'pending' : 'paid';
    try {
      await updateDoc(doc(db, 'workLogs', log.id), { status: newStatus });
      onShowSuccess(`Status updated to ${newStatus}`);
    } catch (err) {
      onError(err, OperationType.UPDATE, 'workLogs');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Work History</h2>
      
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text"
            placeholder="Search farmer or village..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all bg-white text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <FilterButton active={statusFilter === 'all'} label="All" onClick={() => setStatusFilter('all')} />
          <FilterButton active={statusFilter === 'pending'} label="Pending" onClick={() => setStatusFilter('pending')} />
          <FilterButton active={statusFilter === 'paid'} label="Paid" onClick={() => setStatusFilter('paid')} />
        </div>
      </div>

      <div className="space-y-4">
        {filteredLogs.map(log => {
          const farmer = farmers.find(f => f.id === log.farmerId);
          const vehicle = vehicles.find(v => v.id === log.vehicleId);
          const type = workTypes.find(t => t.id === log.workTypeId);

          return (
            <Card key={log.id} className="relative overflow-hidden group border-zinc-100 hover:border-zinc-300 transition-all">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{format(parseISO(log.date), 'MMM d, yyyy')}</p>
                  <h4 className="font-black text-zinc-900 text-lg tracking-tight">{farmer?.name || 'Deleted Farmer'}</h4>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{farmer?.village}{log.place ? ` • ${log.place}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-zinc-900 text-xl">₹{log.totalAmount}</p>
                  <button 
                    onClick={() => toggleStatus(log)}
                    className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border",
                      log.status === 'paid' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-orange-50 border-orange-100 text-orange-600"
                    )}
                  >
                    {log.status}
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge icon={Truck} label={vehicle?.name || 'Unknown'} />
                <Badge icon={Clock} label={`${log.durationHours} hrs`} />
                <Badge icon={Settings} label={type?.name || 'Unknown'} />
              </div>

              {log.notes && (
                <div className="mb-4 p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                  <p className="text-[10px] text-zinc-500 italic">"{log.notes}"</p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-zinc-50">
                <button onClick={() => handleDelete(log.id)} className="text-zinc-300 hover:text-red-500 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors">
                  <Trash2 className="w-3 h-3" /> Delete Entry
                </button>
              </div>
            </Card>
          );
        })}
        {filteredLogs.length === 0 && (
          <div className="text-center py-20 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
            <FileText className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No records found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
        active ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-zinc-200 text-zinc-400 hover:border-zinc-400"
      )}
    >
      {label}
    </button>
  );
}

function Badge({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-50 rounded-lg border border-zinc-100">
      <Icon className="w-3 h-3 text-zinc-400" />
      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function SettingsPage({ workTypes, onError, onShowSuccess }: { workTypes: WorkType[], onError: (err: any, op: OperationType, path: string) => void, onShowSuccess: (msg: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', ratePerHour: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.ratePerHour) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'workTypes', editingId), { name: formData.name, ratePerHour: parseFloat(formData.ratePerHour) });
        onShowSuccess("Work rate updated!");
      } else {
        const docRef = doc(collection(db, 'workTypes'));
        await setDoc(docRef, { id: docRef.id, name: formData.name, ratePerHour: parseFloat(formData.ratePerHour), ownerUid: auth.currentUser?.uid });
        onShowSuccess("Work rate added!");
      }
      setFormData({ name: '', ratePerHour: '' });
      setShowAdd(false);
      setEditingId(null);
    } catch (err) {
      onError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'workTypes');
    }
  };

  const handleEdit = (workType: WorkType) => {
    setFormData({ name: workType.name, ratePerHour: workType.ratePerHour.toString() });
    setEditingId(workType.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this work type?')) return;
    try {
      await deleteDoc(doc(db, 'workTypes', id));
      onShowSuccess("Work rate deleted.");
    } catch (err) {
      onError(err, OperationType.DELETE, 'workTypes');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Work Rates</h2>
        <Button onClick={() => {
          if (showAdd) { setShowAdd(false); setEditingId(null); setFormData({ name: '', ratePerHour: '' }); }
          else setShowAdd(true);
        }} variant={showAdd ? 'secondary' : 'primary'}>
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? 'Cancel' : 'Add Rate'}
        </Button>
      </div>

      {showAdd && (
        <Card className="bg-white border-2 border-green-500/20">
          <form onSubmit={handleAdd} className="space-y-4">
            <Input label="Work Name" placeholder="e.g. Rainy Work" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} />
            <Input label="Rate (₹/hr)" type="number" value={formData.ratePerHour} onChange={e => setFormData(prev => ({ ...prev, ratePerHour: e.target.value }))} />
            <Button type="submit" className="w-full">{editingId ? 'Update Rate' : 'Save Rate'}</Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {workTypes.map(type => (
          <Card key={type.id} className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{type.name}</p>
              <p className="text-xs text-gray-500">₹{type.ratePerHour} per hour</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => handleEdit(type)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(type.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ))}
        {workTypes.length === 0 && !showAdd && (
          <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700 font-medium">Add some work types (like "Rainy Work" or "Harvesting") with their hourly rates to start logging work.</p>
          </div>
        )}
      </div>
    </div>
  );
}

