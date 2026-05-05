import { useState, useEffect } from 'react';
import React from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { AppUser, Appointment, Prescription, Vital, CareTask } from '../types';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { Calendar, Clock, MessageSquare, Video, CheckCircle2, XCircle, AlertCircle, Plus, Search, User, FileText, Activity, ShieldAlert, Zap, QrCode, CreditCard, Pill, TrendingUp, Sparkles, LayoutList, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import MedicalReports from '../components/MedicalReports';
import HistoryTimeline from '../components/HistoryTimeline';
import VitalsTracker from '../components/VitalsTracker';
import CareTasks from '../components/CareTasks';
import { QRCodeSVG } from 'qrcode.react';

export default function PatientDashboard({ user }: { user: AppUser }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [doctors, setDoctors] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBooking, setShowBooking] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'appointments' | 'doctors' | 'records' | 'history' | 'prescriptions' | 'vitals' | 'agenda'>('overview');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [activeQR, setActiveQR] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, 'prescriptions'),
      where('patientId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'prescriptions'));
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CareTask)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
        const snapshot = await getDocs(q);
        setDoctors(snapshot.docs.map(doc => doc.data() as AppUser));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    };
    fetchDoctors();

    const q = query(
      collection(db, 'appointments'), 
      where('patientId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(apts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    return () => unsubscribe();
  }, [user.uid]);

  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'alert' } | null>(null);

  const triggerEmergency = async () => {
    // Find most recent approved/completed doctor
    const lastApt = appointments
      .filter(a => a.status === 'approved' || a.status === 'completed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!lastApt) {
      setNotification({ message: 'No linked medical professional found. Contact 911!', type: 'alert' });
      setShowEmergencyConfirm(false);
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    try {
      await addDoc(collection(db, 'emergencies'), {
        patientId: user.uid,
        patientName: user.displayName,
        doctorId: lastApt.doctorId,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      setIsEmergencyActive(true);
      setShowEmergencyConfirm(false);
      
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
        audio.play().catch(() => {});
      } catch (e) {
        // Audio handled silently
      }

      setTimeout(() => setIsEmergencyActive(false), 10000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'emergencies');
    }
  };

  const filteredDoctors = doctors.filter(d => 
    (d.displayName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (d.specialization?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !date || !time) {
      setNotification({ message: 'Please select a doctor, date, and time.', type: 'alert' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setIsBooking(true);
    try {
      const doctor = doctors.find(d => d.uid === selectedDoctor);
      await addDoc(collection(db, 'appointments'), {
        patientId: user.uid,
        patientName: user.displayName,
        doctorId: selectedDoctor,
        doctorName: doctor?.displayName || 'Unknown Doctor',
        status: 'pending',
        date,
        time,
        reason,
        createdAt: new Date().toISOString()
      });
      setBookingSuccess(true);
      setTimeout(() => {
        setShowBooking(false);
        setBookingSuccess(false);
        setReason('');
        setDate('');
        setTime('');
        setActiveView('appointments');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'appointments');
    } finally {
      setIsBooking(false);
    }
  };

  const statusIcons = {
    pending: <AlertCircle className="text-amber-500 h-5 w-5" />,
    approved: <CheckCircle2 className="text-green-500 h-5 w-5" />,
    rejected: <XCircle className="text-red-500 h-5 w-5" />,
    completed: <CheckCircle2 className="text-blue-500 h-5 w-5" />
  };

  const statusColors = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200'
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 z-[500] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-white ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">Global Health Profile</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Patient ID #{user.uid.slice(0, 8)}</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{user.displayName}</h1>
          <p className="text-slate-500 font-bold text-sm">Welcome back to your personalized care portal.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar">
           {[
             { id: 'overview', label: 'Overview', icon: Zap },
             { id: 'appointments', label: 'Visits', icon: Calendar },
             { id: 'doctors', label: 'Find Docs', icon: User },
             { id: 'vitals', label: 'Vitals', icon: TrendingUp },
             { id: 'agenda', label: 'Agenda', icon: LayoutList },
             { id: 'records', label: 'Reports', icon: FileText },
             { id: 'prescriptions', label: 'Scrips', icon: Pill },
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveView(tab.id as any)}
               className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                 activeView === tab.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
               }`}
             >
               <tab.icon className="h-4 w-4" />
               {tab.label}
             </button>
           ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'overview' && (
           <motion.div 
             key="overview"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             className="space-y-8"
           >
              {/* Highlight Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {[
                   { label: 'Upcoming', value: appointments.filter(a => a.status === 'approved').length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
                   { label: 'Smart Vitals', value: 'Live Feed', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                   { label: 'Care Tasks', value: 'Active', icon: LayoutList, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                   { label: 'Unpaid Scripts', value: prescriptions.filter(p => !p.isPaid).length, icon: Pill, color: 'text-amber-600', bg: 'bg-amber-50' },
                 ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2.2rem] border border-slate-100 shadow-sm">
                       <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center ${stat.color} mb-4`}>
                          <stat.icon className="h-6 w-6" />
                       </div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                       <h4 className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</h4>
                    </div>
                 ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* Spotlight: Next Session */}
                 <div className="lg:col-span-2 space-y-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h3 className="text-lg font-bold text-slate-800">Your Next Visit</h3>
                         <button onClick={() => setActiveView('appointments')} className="text-xs font-bold text-blue-600 hover:underline">Manage All</button>
                      </div>
                      
                      {appointments.find(a => a.status === 'approved') ? (
                         (() => {
                            const next = appointments.find(a => a.status === 'approved')!;
                            return (
                               <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-lg shadow-blue-50/50 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
                                  <div className="absolute top-0 right-0 p-10 bg-blue-50/20 rounded-full -mr-10 -mt-10 blur-3xl transition-all group-hover:scale-125" />
                                  <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-100 flex-shrink-0">
                                     <Video className="h-10 w-10" />
                                  </div>
                                  <div className="flex-1 text-center md:text-left">
                                     <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Confirmed Appointment</p>
                                     <h4 className="text-2xl font-black text-slate-900 mb-2">Dr. {next.doctorName}</h4>
                                     <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm bg-slate-50 px-4 py-2 rounded-xl">
                                           <Calendar className="h-4 w-4" />
                                           {next.date}
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm bg-slate-50 px-4 py-2 rounded-xl">
                                           <Clock className="h-4 w-4" />
                                           {next.time}
                                        </div>
                                     </div>
                                  </div>
                                  <button 
                                    onClick={() => navigate(`/consultation/${next.id}`)}
                                    className="w-full md:w-auto px-10 py-5 bg-slate-900 text-white rounded-[1.8rem] font-black uppercase tracking-widest text-[11px] hover:bg-blue-600 transition-all shadow-xl shadow-slate-100 active:scale-95"
                                  >
                                     Fast Pass Entrance
                                  </button>
                               </div>
                            );
                         })()
                      ) : (
                         <div className="bg-slate-50 border-2 border-dashed border-slate-100 rounded-[3rem] p-12 text-center">
                            <Calendar className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No scheduled sessions</p>
                            <button onClick={() => setActiveView('doctors')} className="mt-4 px-6 py-3 bg-white text-blue-600 rounded-2xl font-black text-[10px] uppercase shadow-sm border border-slate-100 hover:bg-blue-50">Schedule Now</button>
                         </div>
                      )}
                    </div>

                    {/* Vitals Summary */}
                    <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-110 transition-all opacity-50" />
                       <div className="flex items-center justify-between mb-8 relative z-10">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                                <TrendingUp className="h-5 w-5" />
                             </div>
                             <h4 className="text-lg font-black uppercase tracking-tight">Active Vitals</h4>
                          </div>
                          <button onClick={() => setActiveView('vitals')} className="text-[10px] font-black text-emerald-400 hover:underline uppercase tracking-widest">Open Tracker</button>
                       </div>
                       <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                          {[
                            { label: 'Heart', value: '72', unit: 'bpm' },
                            { label: 'SpO2', value: '98', unit: '%' },
                            { label: 'Weight', value: '68', unit: 'kg' },
                            { label: 'Sleep', value: '7.5', unit: 'hrs' }
                          ].map((v, i) => (
                             <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-2xl">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{v.label}</p>
                                <div className="flex items-baseline gap-1">
                                   <span className="text-xl font-black">{v.value}</span>
                                   <span className="text-[8px] font-bold text-slate-500">{v.unit}</span>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 space-y-4">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                             <FileText className="h-4 w-4 text-indigo-500" />
                             Latest Record
                          </h4>
                          <div className="p-4 bg-slate-50 rounded-2xl">
                             <p className="text-xs font-bold text-slate-800">General Consultation Report</p>
                             <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">Apr 24, 2026 • Verified</p>
                          </div>
                          <button onClick={() => setActiveView('records')} className="w-full text-center text-xs font-bold text-indigo-600 hover:underline py-1">View All Documents</button>
                       </div>
                       <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 space-y-4">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                             <ShieldAlert className="h-4 w-4 text-red-500" />
                             Emergency Vault
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">Safety is our priority. One-tap alert triggers instant clinical response.</p>
                          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-tighter">
                             <CheckCircle2 className="h-3 w-3" /> Sentinel Active
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* LIVE AGENDA */}
                 <div className="space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6">
                       <div className="flex items-center justify-between">
                          <h3 className="text-lg font-black text-slate-800">Care Agenda</h3>
                          <button onClick={() => setActiveView('agenda')} className="text-[10px] font-black text-blue-600 hover:underline">View All</button>
                       </div>
                       <div className="space-y-4">
                          {tasks.length === 0 ? (
                             <p className="text-[10px] font-bold text-slate-400 uppercase text-center py-4">No pending tasks</p>
                          ) : (
                             tasks.sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted)).slice(0, 5).map((task) => (
                                <div key={task.id} className="flex items-center gap-4 p-4 border border-slate-50 rounded-2xl bg-slate-50/30 group hover:border-blue-100 transition-all">
                                   <div className={`w-2 h-2 rounded-full mt-0.5 ${task.isCompleted ? 'bg-green-400' : 'bg-blue-500'}`} />
                                   <div>
                                      <p className={`text-xs font-black ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{task.type}</p>
                                   </div>
                                </div>
                             ))
                          )}
                       </div>
                    </div>
                 </div>
              </div>
           </motion.div>
        )}

        {/* Existing views logic (doctors, appointments, etc) */}
        
        {activeView === 'vitals' && (
           <motion.div 
             key="vitals"
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -20 }}
             className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm"
           >
              <VitalsTracker patientId={user.uid} isDoctor={false} />
           </motion.div>
        )}

        {activeView === 'agenda' && (
           <motion.div 
             key="agenda"
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -20 }}
             className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm max-w-2xl mx-auto"
           >
              <CareTasks userId={user.uid} />
           </motion.div>
        )}

        {activeView === 'doctors' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input 
                type="text"
                placeholder="Search by name or specialization..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filteredDoctors.length === 0 ? (
                 <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                    <User className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No Doctors Found</p>
                    <p className="text-slate-300 text-xs mt-2">Try searching for a different name or specialization.</p>
                 </div>
               ) : (
                 filteredDoctors.map(doc => (
                 <motion.div 
                   key={doc.uid}
                   className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
                 >
                    <div className="flex items-center gap-4 mb-6">
                       <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                          <User className="h-8 w-8 text-blue-600 group-hover:text-white" />
                       </div>
                       <div>
                          <h3 className="font-bold text-lg text-slate-800">Dr. {doc.displayName}</h3>
                          <p className="text-sm text-blue-600 font-bold">{doc.specialization}</p>
                       </div>
                    </div>
                    <p className="text-slate-500 text-sm mb-6 line-clamp-3">
                       {doc.bio || "Dedicated healthcare professional providing personalized care and advanced medical solutions."}
                    </p>
                    <button 
                      onClick={() => {
                        setSelectedDoctor(doc.uid);
                        setShowBooking(true);
                      }}
                      className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg hover:shadow-blue-200"
                    >
                       Book Appointment
                    </button>
                 </motion.div>
               )))}
            </div>
          </motion.div>
        )}

        {activeView === 'appointments' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
             {appointments.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <Calendar className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No Appointments Found</p>
                    <button onClick={() => setActiveView('doctors')} className="mt-4 text-blue-600 font-bold hover:underline">Find a doctor now</button>
                </div>
             ) : (
                appointments.map(apt => (
                  <div key={apt.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <div className="flex justify-between items-start mb-6">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border flex items-center gap-1.5 ${statusColors[apt.status]}`}>
                           {statusIcons[apt.status]}
                           {apt.status.toUpperCase()}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400">{format(new Date(apt.createdAt), 'MMM d, yyyy')}</p>
                     </div>
                     <h3 className="font-bold text-xl mb-1 text-slate-800">Dr. {apt.doctorName}</h3>
                     <p className="text-sm font-medium text-slate-500 mb-6 italic">" {apt.reason || 'No details provided'} "</p>
                     
                     <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 p-3 rounded-2xl">
                           <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Date</p>
                           <p className="text-sm font-bold text-slate-700">{apt.date}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl">
                           <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Time</p>
                           <p className="text-sm font-bold text-slate-700">{apt.time}</p>
                        </div>
                     </div>

                     {apt.status === 'approved' && (
                        <button 
                          onClick={() => navigate(`/consultation/${apt.id}`)}
                          className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200"
                        >
                           <Video className="h-4 w-4" />
                           Start Consultation
                        </button>
                     )}
                     
                     {apt.prescription && (
                        <div className="mt-4 p-5 bg-green-50 border border-green-100 rounded-2xl relative overflow-hidden">
                           <div className="absolute -top-4 -right-4 bg-green-100/50 w-20 h-20 rounded-full blur-2xl" />
                           <p className="text-[10px] font-bold text-green-700 uppercase mb-2 flex items-center gap-1.5 font-black tracking-widest">
                              <CheckCircle2 className="h-3 w-3" /> Digital Prescription
                           </p>
                           <p className="text-xs text-green-800 font-medium line-clamp-2 leading-relaxed mb-4">{apt.prescription}</p>
                           
                           <div className="flex items-center gap-4 pt-2 border-t border-green-200/50">
                              <div className="bg-white p-2 rounded-xl shadow-sm border border-green-100">
                                 <QRCodeSVG value={`prescription:${apt.id}`} size={48} />
                              </div>
                              <div>
                                 <p className="text-[9px] font-black text-green-600 uppercase tracking-tighter mb-0.5">Verified RX: {apt.id.slice(0,8)}</p>
                                 <button 
                                   onClick={() => navigate(`/consultation/${apt.id}`)}
                                   className="text-[11px] font-bold text-green-700 hover:bg-green-600 hover:text-white px-2 py-1 rounded-lg transition-all flex items-center gap-1"
                                 >
                                   <Search className="h-3 w-3" /> VIEW DETAILS
                                 </button>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
                ))
             )}
          </motion.div>
        )}

        {activeView === 'records' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm"
          >
             <MedicalReports patientId={user.uid} isDoctor={false} />
          </motion.div>
        )}

        {activeView === 'history' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm"
          >
             <HistoryTimeline patientId={user.uid} />
          </motion.div>
        )}

        {activeView === 'prescriptions' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
             <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg">
                   <Pill className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Active Prescriptions</h2>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {prescriptions.length === 0 ? (
                   <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                      <p className="text-slate-400 font-medium">No issued prescriptions found.</p>
                   </div>
                ) : (
                   prescriptions.map((px) => (
                      <motion.div 
                        key={px.id}
                        layout
                        className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col h-full"
                      >
                         <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                               <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600">
                                  <Pill className="h-6 w-6" />
                               </div>
                               <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p>
                                  {px.isPaid ? (
                                     <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-tighter bg-green-50 px-2 py-0.5 rounded-lg">
                                        <CheckCircle2 className="h-3 w-3" /> Paid & Verified
                                     </span>
                                  ) : (
                                     <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase tracking-tighter bg-amber-50 px-2 py-0.5 rounded-lg">
                                        <Clock className="h-3 w-3" /> Payment Pending
                                     </span>
                                  )}
                               </div>
                            </div>
                            <p className="text-xs font-black text-slate-900 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                               ${px.amount.toFixed(2)}
                            </p>
                         </div>

                         <div className="mb-6 flex-1">
                            <h3 className="text-lg font-bold text-slate-800 mb-1">{px.medication}</h3>
                            <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">{px.dosage}</p>
                            <p className="text-sm text-slate-500 leading-relaxed italic">"{px.instructions}"</p>
                         </div>

                         <div className="pt-6 border-t border-slate-50 flex flex-col gap-3">
                            <div className="flex items-center justify-between text-[10px]">
                               <span className="font-bold text-slate-400 uppercase tracking-widest">Doctor</span>
                               <span className="font-bold text-slate-800">Dr. {px.doctorName}</span>
                            </div>

                            {px.patientResponse ? (
                               <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-2">
                                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">My Response</p>
                                  <p className="text-xs font-medium text-slate-700 italic">"{px.patientResponse}"</p>
                               </div>
                            ) : (
                               <div className="flex gap-2 mb-2">
                                  <button 
                                    onClick={async () => {
                                       try {
                                          await updateDoc(doc(db, 'prescriptions', px.id), { patientResponse: 'Okay, I understand.' });
                                       } catch (err) {
                                          handleFirestoreError(err, OperationType.UPDATE, `prescriptions/${px.id}`);
                                       }
                                    }}
                                    className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
                                  >
                                     Say Okay
                                  </button>
                                  <button 
                                    onClick={async () => {
                                       try {
                                          await updateDoc(doc(db, 'prescriptions', px.id), { patientResponse: 'I have some questions.' });
                                       } catch (err) {
                                          handleFirestoreError(err, OperationType.UPDATE, `prescriptions/${px.id}`);
                                       }
                                    }}
                                    className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
                                  >
                                     Questions
                                  </button>
                               </div>
                            )}
                            
                            {!px.isPaid ? (
                               <button 
                                 onClick={async () => {
                                    try {
                                       await updateDoc(doc(db, 'prescriptions', px.id), { isPaid: true });
                                    } catch (err) {
                                       handleFirestoreError(err, OperationType.UPDATE, `prescriptions/${px.id}`);
                                    }
                                 }}
                                 className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                               >
                                  <CreditCard className="h-4 w-4" />
                                  Pay & Authorize
                               </button>
                            ) : (
                               <button 
                                 onClick={() => setActiveQR(px.id)}
                                 className="w-full py-4 bg-white border-2 border-slate-100 text-slate-800 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                               >
                                  <QrCode className="h-4 w-4" />
                                  View Pharmacy QR
                               </button>
                            )}
                         </div>
                      </motion.div>
                   ))
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal Overlay */}
      <AnimatePresence>
         {activeQR && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={() => setActiveQR(null)}>
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.9, opacity: 0 }}
                 className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full text-center flex flex-col items-center"
                 onClick={e => e.stopPropagation()}
               >
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-6">
                     <ShieldAlert className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Pharmacist Verification</h3>
                  <p className="text-slate-500 text-sm mb-10 leading-relaxed px-4">Show this code to your pharmacist to verify and dispense your medication.</p>
                  
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-inner border-2 border-slate-50 mb-10 relative group overflow-hidden">
                     <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-all" />
                     <QRCodeSVG value={`prescription:${activeQR}`} size={200} includeMargin={true} />
                     <div className="mt-4 text-[10px] font-mono text-slate-400 font-bold bg-slate-50 py-1 px-3 rounded-lg inline-block">
                        AUTH_ID: {activeQR.toUpperCase()}
                     </div>
                  </div>

                  <button 
                    onClick={() => setActiveQR(null)}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                     Close Verification
                  </button>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* Emergency Confirmation Modal */}
      <AnimatePresence>
         {showEmergencyConfirm && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4">
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.9, opacity: 0 }}
                 className="bg-white max-w-sm w-full rounded-[3rem] shadow-2xl p-10 text-center"
               >
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
                     <ShieldAlert className="h-10 w-10 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Confirm Emergency?</h3>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed">This will immediately alert your assigned doctor and share your current status for urgent intervention.</p>
                  
                  <div className="space-y-3">
                     <button 
                       onClick={triggerEmergency}
                       className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95"
                     >
                        Confirm Alert
                     </button>
                     <button 
                       onClick={() => setShowEmergencyConfirm(false)}
                       className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                     >
                        Cancel
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* Floating Emergency Button */}
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowEmergencyConfirm(true)}
        className={`fixed bottom-8 right-8 z-50 p-6 rounded-full shadow-2xl flex items-center justify-center group overflow-hidden transition-all duration-500 ${isEmergencyActive ? 'bg-red-600 animate-bounce' : 'bg-slate-900 border-4 border-red-500/20'}`}
      >
         <div className={`absolute inset-0 bg-red-600 transition-transform duration-500 ${isEmergencyActive ? 'scale-100' : 'scale-0'}`}></div>
         <Zap className={`h-8 w-8 relative z-10 transition-colors ${isEmergencyActive ? 'text-white' : 'text-red-500 group-hover:text-red-400'}`} />
         <span className="absolute -top-12 opacity-0 group-hover:top-[-4rem] group-hover:opacity-100 transition-all font-black text-red-600 bg-white px-3 py-1 rounded-full shadow-lg text-[10px] uppercase tracking-tighter whitespace-nowrap whitespace-nowrap">Emergency 1-Tap Help</span>
      </motion.button>

      {/* Booking Modal Overlay */}
      {showBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={() => setShowBooking(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden" 
              onClick={e => e.stopPropagation()}
            >
               <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Request Consultation</h2>
                      <p className="text-slate-500 text-sm font-medium">With Dr. {doctors.find(d => d.uid === selectedDoctor)?.displayName}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                      <Calendar className="h-6 w-6" />
                    </div>
                  </div>
                  
                  {bookingSuccess ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="py-12 text-center space-y-4"
                    >
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">Request Sent!</h3>
                      <p className="text-slate-500">Your consultation request has been forwarded to the doctor. Redirecting...</p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleBooking} className="space-y-6">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Preferred Date</label>
                             <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm" value={date} onChange={e => setDate(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Preferred Time</label>
                             <input type="time" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm" value={time} onChange={e => setTime(e.target.value)} />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Reason for Visit</label>
                          <textarea 
                             placeholder="Briefly describe your symptoms or concern..."
                             required
                             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium h-32 resize-none text-sm"
                             value={reason}
                             onChange={e => setReason(e.target.value)}
                          />
                       </div>
                       <div className="flex gap-4 pt-4">
                          <button type="button" onClick={() => setShowBooking(false)} className="flex-1 py-4 font-bold text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors uppercase tracking-widest text-xs">Cancel</button>
                          <button 
                            type="submit" 
                            disabled={isBooking}
                            className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl shadow-slate-100 hover:bg-blue-600 transition-all disabled:opacity-50"
                          >
                            {isBooking ? 'Processing...' : 'Submit Request'}
                          </button>
                       </div>
                    </form>
                  )}
               </div>
            </motion.div>
        </div>
      )}
    </div>
  );
}
