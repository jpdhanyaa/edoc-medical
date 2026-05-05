import { useState, useEffect } from 'react';
import React from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs, addDoc } from 'firebase/firestore';
import { AppUser, Appointment, Prescription, Emergency } from '../types';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { Calendar, Clock, MessageSquare, Video, CheckCircle2, XCircle, User, Users, ClipboardList, Search, ShieldAlert, Activity, Bell, FileText, ChevronRight, Plus, Send, Pill, Zap, Sparkles, LayoutList, BookOpen, TrendingUp, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import MedicalReports from '../components/MedicalReports';
import VitalsTracker from '../components/VitalsTracker';
import CareTasks from '../components/CareTasks';
import HistoryTimeline from '../components/HistoryTimeline';
import { format } from 'date-fns';

export default function DoctorDashboard({ user }: { user: AppUser }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'patients' | 'history' | 'prescriptions' | 'agenda'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEmergency, setActiveEmergency] = useState<Emergency | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user.uid) return;
    const q = query(
      collection(db, 'prescriptions'),
      where('doctorId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'prescriptions'));
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'appointments'), 
      where('doctorId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      // Sort client-side by createdAt desc
      setAppointments(apts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);

      const patientIds = Array.from(new Set(apts.map(a => a.patientId)));
      if (patientIds.length > 0) fetchPatients(patientIds);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    // Monitor emergencies - show ALL active emergencies for this doctor
    const q = query(
      collection(db, 'emergencies'),
      where('doctorId', '==', user.uid),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Find most recent active emergency
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Emergency));
        const emergency = docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        setActiveEmergency(emergency);
        
        // Play alert sound logic
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {});
        } catch (e) {
          // Audio handled silently
        }
      } else {
        setActiveEmergency(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'emergencies');
    });

    return () => unsubscribe();
  }, [user.uid]);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'alert' } | null>(null);

  const resolveEmergency = async (id: string) => {
    try {
      await updateDoc(doc(db, 'emergencies', id), { status: 'resolved' });
      setActiveEmergency(null);
      setNotification({ message: 'Emergency signal cleared.', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `emergencies/${id}`);
    }
  };

  const fetchPatients = async (ids: string[]) => {
    try {
      const q = query(collection(db, 'users'), where('uid', 'in', ids.slice(0, 30)));
      const snap = await getDocs(q);
      setPatients(snap.docs.map(d => d.data() as AppUser));
    } catch (err) {
      // Silent error handler
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'appointments', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const statusColors = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200'
  };

  const filteredPatients = patients.filter(p => 
    p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">Medical Portal</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Live System</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dr. {user.displayName}</h1>
          <p className="text-slate-500 font-bold text-sm">{user.specialization} & Clinical Lead</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar">
           {[
             { id: 'overview', label: 'Overview', icon: Zap },
             { id: 'appointments', label: 'Queue', icon: ClipboardList },
             { id: 'patients', label: 'Patients', icon: Users },
             { id: 'prescriptions', label: 'Prescription', icon: Pill },
             { id: 'agenda', label: 'Agenda', icon: LayoutList },
             { id: 'history', label: 'History', icon: Activity },
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                 activeTab === tab.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
               }`}
             >
               <tab.icon className="h-4 w-4" />
               {tab.label}
             </button>
           ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
           <motion.div 
             key="overview"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             className="space-y-8"
           >
              {/* Active Emergency Banner */}
              {activeEmergency && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-600 text-white p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-red-200 border-b-4 border-red-800"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                      <ShieldAlert className="h-8 w-8 text-white animate-pulse" />
                    </div>
                    <div className="text-center md:text-left">
                      <h4 className="text-lg font-black uppercase tracking-tight">Priority One Alert</h4>
                      <p className="text-red-100 font-bold text-sm tracking-tight">{activeEmergency.patientName} is requesting immediate assistance.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => {
                        const apt = appointments.find(a => a.patientId === activeEmergency.patientId);
                        if (apt) navigate(`/consultation/${apt.id}`);
                        resolveEmergency(activeEmergency.id);
                      }}
                      className="flex-1 md:flex-none px-6 py-3 bg-white text-red-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-50 transition-all shadow-xl"
                    >
                      Intercept
                    </button>
                    <button 
                       onClick={() => resolveEmergency(activeEmergency.id)}
                       className="flex-1 md:flex-none px-6 py-3 bg-red-800 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-red-900 transition-all"
                    >
                       Dismiss
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Analytics Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {[
                   { label: 'Total Patients', value: patients.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                   { label: 'New Requests', value: appointments.filter(a => a.status === 'pending').length, icon: Bell, color: 'text-amber-600', bg: 'bg-amber-50' },
                   { label: 'History', value: appointments.length, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                   { label: 'Active Scrips', value: prescriptions.filter(p => !p.isPaid).length, icon: Pill, color: 'text-emerald-600', bg: 'bg-emerald-50' }
                 ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                       <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center ${stat.color} mb-4`}>
                          <stat.icon className="h-6 w-6" />
                       </div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                       <h4 className="text-3xl font-black text-slate-900 mt-1">{stat.value}</h4>
                    </div>
                  ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* Upcoming Spotlight */}
                 <div className="lg:col-span-2 space-y-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h3 className="text-lg font-bold text-slate-800">Priority Queue</h3>
                         <button onClick={() => setActiveTab('appointments')} className="text-xs font-bold text-blue-600 hover:underline">View Full Schedule</button>
                      </div>
                      <div className="grid gap-4">
                         {appointments.filter(a => a.status === 'approved').slice(0, 3).map(apt => (
                            <div key={apt.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                               <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-slate-50 group-hover:bg-blue-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 font-black transition-all">
                                     {apt.patientName[0]}
                                  </div>
                                  <div>
                                     <p className="font-bold text-slate-800">{apt.patientName}</p>
                                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{apt.time} • {apt.date}</p>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => navigate(`/consultation/${apt.id}`)}
                                 className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all"
                               >
                                  Join
                               </button>
                            </div>
                         ))}
                         {appointments.filter(a => a.status === 'approved').length === 0 && (
                            <div className="bg-slate-50/50 rounded-3xl p-10 text-center border border-dashed border-slate-100">
                               <Calendar className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                               <p className="text-xs font-bold text-slate-400 uppercase">No upcoming sessions today</p>
                            </div>
                         )}
                      </div>
                    </div>

                    {/* Practice Summary Card */}
                    <div className="bg-blue-600 rounded-[3rem] p-10 text-white relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
                       <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
                       <div className="w-24 h-24 bg-white/20 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl flex-shrink-0">
                          <Activity className="h-10 w-10" />
                       </div>
                       <div className="flex-1 text-center md:text-left relative z-10">
                          <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2 font-black">Practice Metrics</p>
                          <h4 className="text-xl font-bold mb-4">Clinic Efficiency Update</h4>
                          <p className="text-blue-100 text-sm leading-relaxed mb-6">You have handled {appointments.filter(a => a.status === 'completed').length} consultations this period. Overall patient satisfaction is at optimal levels.</p>
                          <button 
                            onClick={() => setActiveTab('history')}
                            className="px-8 py-3 bg-white text-blue-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-blue-50 transition-all shadow-xl"
                          >
                             Review History
                          </button>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-800">Clinical Agenda</h3>
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6">
                       <CareTasks userId={user.uid} />
                    </div>
                 </div>
              </div>
           </motion.div>
        ) : activeTab === 'appointments' ? (
          <motion.div 
            key="apts"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
          >
            {loading ? (
              <div className="col-span-full py-20 text-center animate-pulse text-slate-400 font-bold">Syncing medical queue...</div>
            ) : appointments.length === 0 ? (
               <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                  <ClipboardList className="h-16 w-16 text-slate-100 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No Appointments Found</p>
               </div>
            ) : (
               appointments.map(apt => (
                 <div key={apt.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-6">
                       <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-extrabold shadow-sm">
                             {apt.patientName?.[0]}
                          </div>
                          <div>
                             <h3 className="font-bold text-slate-800">{apt.patientName}</h3>
                             <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">ID: {apt.id.slice(0, 8)}</p>
                          </div>
                       </div>
                       <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${statusColors[apt.status]}`}>
                         {apt.status.toUpperCase()}
                       </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl mb-6">
                       <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1 uppercase tracking-tighter">
                          <ClipboardList className="h-3.5 w-3.5" /> Complaint
                       </p>
                       <p className="text-sm font-medium text-slate-700 italic">"{apt.reason || 'No description provided'}"</p>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-bold mb-6 px-1">
                       <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{apt.date}</span>
                       </div>
                       <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{apt.time}</span>
                       </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-50 flex gap-3">
                       {apt.status === 'pending' ? (
                         <>
                            <button 
                              onClick={() => updateStatus(apt.id, 'rejected')}
                              className="flex-1 py-3 text-red-600 font-bold hover:bg-red-50 rounded-2xl transition-all"
                            >
                              Reject
                            </button>
                            <button 
                              onClick={() => updateStatus(apt.id, 'approved')}
                              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                            >
                              Approve
                            </button>
                         </>
                       ) : apt.status === 'approved' ? (
                          <button 
                             onClick={() => navigate(`/consultation/${apt.id}`)}
                             className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-xl shadow-slate-100"
                          >
                             <Video className="h-5 w-5" />
                             Start Session
                          </button>
                       ) : (
                          <div className="w-full py-3 bg-slate-50 text-slate-400 text-center rounded-2xl text-xs font-bold uppercase tracking-widest">Closed</div>
                       )}
                    </div>
                 </div>
               ))
            )}
          </motion.div>
        ) : activeTab === 'prescriptions' ? (
          <motion.div 
            key="prescriptions-list"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8"
          >
             <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                   <Plus className="h-5 w-5 text-blue-600" />
                   Issue New Prescription
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Select Patient</label>
                      <select 
                        id="px-patient-select" 
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => setViewingProfile(e.target.value)}
                      >
                         <option value="">Choose a patient...</option>
                         {patients.map(p => <option key={p.uid} value={p.uid}>{p.displayName}</option>)}
                      </select>
                   </div>
                   <div className="flex items-end">
                      <p className="text-xs text-slate-500 italic pb-4">Selecting a patient will open their medical record to review before prescribing.</p>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                   <div>
                      <h3 className="text-xl font-bold text-slate-800">Review Issued Prescriptions</h3>
                      <p className="text-sm text-slate-400">View status and patient responses.</p>
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                         <tr className="bg-slate-50/50">
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Medication</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Response</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Payment</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {prescriptions.map(px => (
                            <tr key={px.id} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-8 py-5">
                                  <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold">
                                        {px.patientName[0]}
                                     </div>
                                     <span className="text-sm font-bold text-slate-700">{px.patientName}</span>
                                  </div>
                               </td>
                               <td className="px-8 py-5">
                                  <div className="flex flex-col">
                                     <span className="text-sm font-bold text-slate-800">{px.medication}</span>
                                     <span className="text-[10px] text-slate-400 font-bold uppercase">{px.dosage}</span>
                                  </div>
                               </td>
                               <td className="px-8 py-5 text-center">
                                  {px.patientResponse ? (
                                     <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100">Patient said: {px.patientResponse}</span>
                                  ) : (
                                     <span className="text-xs text-slate-400 italic">No response yet</span>
                                  )}
                               </td>
                               <td className="px-8 py-5 text-right">
                                  {px.isPaid ? (
                                     <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase">
                                        <CheckCircle2 className="h-3 w-3" /> Paid
                                     </span>
                                  ) : (
                                     <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase">
                                        <Clock className="h-3 w-3" /> Pending
                                     </span>
                                  )}
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </motion.div>
        ) : activeTab === 'patients' ? (
          <motion.div 
            key="patients"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                   type="text"
                   placeholder="Filter your patient list..."
                   className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
             
             <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                      <tr>
                         <th className="px-8 py-5">Patient Identity</th>
                         <th className="px-8 py-5 text-center">Interactions</th>
                         <th className="px-8 py-5 text-center">Last Appointment</th>
                         <th className="px-8 py-5 text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {filteredPatients.map(p => (
                        <tr key={p.uid} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-extrabold shadow-sm">
                                    {p.displayName[0]}
                                 </div>
                                 <div>
                                    <p className="font-bold text-slate-800">{p.displayName}</p>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">{p.email}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-8 py-5 text-center">
                              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[11px] font-black italic">
                                 {appointments.filter(a => a.patientId === p.uid).length} RECORD(S)
                              </span>
                           </td>
                           <td className="px-8 py-5 text-center">
                              <span className="text-xs font-bold text-slate-500">
                                 {appointments.find(a => a.patientId === p.uid)?.date || 'NEW PATIENT'}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-right flex items-center justify-end gap-3">
                              <button 
                                onClick={() => setViewingProfile(p.uid)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              >
                                 <User className="h-4 w-4" />
                                 View Record
                              </button>
                              <button 
                                onClick={() => {
                                  const latest = appointments.find(a => a.patientId === p.uid);
                                  if (latest) navigate(`/consultation/${latest.id}`);
                                }}
                                className="p-2 text-slate-300 hover:text-blue-600 rounded-lg transition-all"
                                title="Message"
                              >
                                 <MessageSquare className="h-5 w-5" />
                              </button>
                           </td>
                        </tr>
                      ))}
                      {filteredPatients.length === 0 && (
                        <tr>
                           <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold">No patients matching your search criteria.</td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </motion.div>
        ) : activeTab === 'agenda' ? (
          <motion.div 
            key="doc-agenda"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm max-w-2xl mx-auto"
          >
             <CareTasks userId={user.uid} />
          </motion.div>
        ) : (
          <motion.div 
            key="history-tab"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
             <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50">
                   <h3 className="text-xl font-bold text-slate-800">Visit History</h3>
                   <p className="text-sm text-slate-400">Complete archive of all patient consultations.</p>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         <tr>
                            <th className="px-8 py-4">Patient</th>
                            <th className="px-8 py-4">Date & Time</th>
                            <th className="px-8 py-4">Reason</th>
                            <th className="px-8 py-4 text-right">Status</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {appointments.map(apt => (
                            <tr key={apt.id} className="hover:bg-slate-50/50 transition-all group">
                               <td className="px-8 py-5">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                        {apt.patientName?.[0]}
                                     </div>
                                     <span className="text-sm font-bold text-slate-700">{apt.patientName}</span>
                                  </div>
                               </td>
                               <td className="px-8 py-5 text-sm text-slate-500 font-medium">
                                  {apt.date} at {apt.time}
                               </td>
                               <td className="px-8 py-5 text-sm text-slate-500 italic max-w-xs truncate">
                                  "{apt.reason}"
                               </td>
                               <td className="px-8 py-5 text-right">
                                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusColors[apt.status]}`}>
                                     {apt.status}
                                  </span>
                               </td>
                            </tr>
                         ))}
                         {appointments.length === 0 && (
                            <tr>
                               <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold italic">No visits recorded in system.</td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Alert Modal */}
      <AnimatePresence>
        {activeEmergency && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-600/90 backdrop-blur-xl p-4">
             <motion.div 
               initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
               animate={{ scale: 1, rotate: 0, opacity: 1 }}
               exit={{ scale: 1.1, opacity: 0 }}
               className="bg-white max-w-lg w-full rounded-[3rem] shadow-[0_0_100px_rgba(220,38,38,0.5)] overflow-hidden"
             >
                <div className="p-10 text-center">
                   <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-ping absolute left-1/2 -translate-x-1/2 opacity-20" />
                   <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-8 relative shadow-2xl">
                      <ShieldAlert className="h-12 w-12 text-white animate-pulse" />
                   </div>
                   
                   <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">Emergency Alert</h2>
                   <p className="text-slate-500 font-bold mb-8 italic">"{activeEmergency.patientName} has triggered a priority one help signal."</p>
                   
                   <div className="flex flex-col gap-4">
                      <button 
                        onClick={() => {
                           const apt = appointments.find(a => a.patientId === activeEmergency.patientId);
                           if (apt) navigate(`/consultation/${apt.id}`);
                           resolveEmergency(activeEmergency.id);
                        }}
                        className="w-full py-5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-red-600 transition-all flex items-center justify-center gap-3 shadow-xl"
                      >
                         <Video className="h-6 w-6" />
                         Intercept Call Immediately
                      </button>
                      <button 
                        onClick={() => resolveEmergency(activeEmergency.id)}
                        className="w-full py-5 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                      >
                         False Alarm / Resolved
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Patient Profile / Reports Modal */}
      <AnimatePresence>
        {viewingProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6" onClick={() => setViewingProfile(null)}>
             <motion.div 
               initial={{ y: 50, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 50, opacity: 0 }}
               className="bg-white w-full max-w-4xl h-[85vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100"
               onClick={e => e.stopPropagation()}
             >
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
                          <User className="h-7 w-7" />
                       </div>
                       <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            {patients.find(p => p.uid === viewingProfile)?.displayName}
                          </h3>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest bg-blue-50 px-2 py-0.5 rounded-lg">Verified Patient</span>
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">UID: {viewingProfile.slice(0, 12)}</span>
                          </div>
                       </div>
                    </div>
                    <button onClick={() => setViewingProfile(null)} className="p-3 bg-white hover:bg-slate-100 rounded-2xl shadow-sm transition-all border border-slate-100">
                       <XCircle className="h-6 w-6 text-slate-400" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                   <div className="w-full md:w-80 bg-slate-50/50 border-r border-slate-50 p-8 overflow-y-auto space-y-8">
                      <div>
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Patient Actions</h4>
                         <button 
                           onClick={() => {
                              const latest = appointments.find(a => a.patientId === viewingProfile);
                              if (latest) navigate(`/consultation/${latest.id}`);
                           }}
                           className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-lg"
                         >
                            <Video className="h-4 w-4" />
                            Launch Session
                         </button>
                      </div>
                      <div className="pt-8 border-t border-slate-100">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Patient Biometrics</h4>
                         <VitalsTracker patientId={viewingProfile} isDoctor={true} />
                      </div>
                      <div className="pt-8 border-t border-slate-100">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Clinical History</h4>
                         <HistoryTimeline patientId={viewingProfile} />
                      </div>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-10 bg-white">
                      <div className="mb-10 p-8 bg-blue-50/30 rounded-[2.5rem] border border-blue-100/50">
                         <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Issue Digital Prescription
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <input 
                              type="text" 
                              placeholder="Medication Name" 
                              id="med-name"
                              className="px-5 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
                            />
                            <input 
                              type="text" 
                              placeholder="Dosage (e.g. 500mg, 2x daily)" 
                              id="med-dosage"
                              className="px-5 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
                            />
                         </div>
                         <textarea 
                           placeholder="Usage Instructions & Notes" 
                           id="med-notes"
                           rows={3}
                           className="w-full px-5 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all mb-4"
                         />
                         <div className="flex justify-end">
                            <button 
                              onClick={async () => {
                                 const med = (document.getElementById('med-name') as HTMLInputElement).value;
                                 const dosage = (document.getElementById('med-dosage') as HTMLInputElement).value;
                                 const notes = (document.getElementById('med-notes') as HTMLTextAreaElement).value;
                                 if (!med) {
                                    setNotification({ message: 'Medication name is required', type: 'alert' });
                                    setTimeout(() => setNotification(null), 3000);
                                    return;
                                 }
                                 
                                 const p = patients.find(p => p.uid === viewingProfile);
                                 try {
                                    await addDoc(collection(db, 'prescriptions'), {
                                       patientId: viewingProfile,
                                       patientName: p?.displayName,
                                       doctorId: user.uid,
                                       doctorName: user.displayName,
                                       medication: med,
                                       dosage,
                                       instructions: notes,
                                       isPaid: false,
                                       amount: 25.00, // Mock amount
                                       createdAt: new Date().toISOString()
                                    });
                                    setNotification({ message: 'Prescription issued successfully!', type: 'success' });
                                    setTimeout(() => setNotification(null), 5000);
                                    (document.getElementById('med-name') as HTMLInputElement).value = '';
                                    (document.getElementById('med-dosage') as HTMLInputElement).value = '';
                                    (document.getElementById('med-notes') as HTMLTextAreaElement).value = '';
                                 } catch (err) {
                                    handleFirestoreError(err, OperationType.WRITE, 'prescriptions');
                                 }
                              }}
                              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
                            >
                               <Send className="h-4 w-4" />
                               Issue & Send
                            </button>
                         </div>
                      </div>
                      <MedicalReports patientId={viewingProfile} isDoctor={true} doctorName={user.displayName} />
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
