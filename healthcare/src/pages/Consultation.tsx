import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { AppUser, Appointment, Message } from '../types';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { Send, Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare, ChevronLeft, User, FileText, ClipboardCheck, Info, Clock, Activity, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import MedicalReports from '../components/MedicalReports';
import { QRCodeSVG } from 'qrcode.react';

export default function Consultation({ user }: { user: AppUser }) {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [prescription, setPrescription] = useState('');
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'reports' | 'prescription'>('chat');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appointmentId) return;

    const fetchApt = async () => {
      try {
        const snap = await getDoc(doc(db, 'appointments', appointmentId));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Appointment;
          setAppointment(data);
          if (data.prescription) setPrescription(data.prescription);
        } else {
          navigate('/');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `appointments/${appointmentId}`);
      }
    };
    fetchApt();

    const q = query(
      collection(db, 'appointments', appointmentId, 'messages')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `appointments/${appointmentId}/messages`);
    });

    return () => unsubscribe();
  }, [appointmentId, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !appointmentId) return;

    try {
      await addDoc(collection(db, 'appointments', appointmentId, 'messages'), {
        appointmentId,
        senderId: user.uid,
        text: newMessage,
        createdAt: new Date().toISOString()
      });
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `appointments/${appointmentId}/messages`);
    }
  };

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const savePrescription = async () => {
    if (!appointmentId || !appointment) return;
    try {
      // 1. Update appointment record for UI summary
      await updateDoc(doc(db, 'appointments', appointmentId), {
        prescription,
        status: 'completed'
      });

      // 2. Create official billable prescription record for dedicated space
      await addDoc(collection(db, 'prescriptions'), {
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        doctorId: appointment.doctorId,
        doctorName: appointment.doctorName,
        medication: prescription.split('\n')[0] || "Medication prescribed", 
        dosage: "As per instructions",
        instructions: prescription,
        isPaid: false,
        amount: 20.00, // Standard fee
        createdAt: new Date().toISOString(),
        appointmentId: appointment.id
      });

      setNotification({ message: 'Prescription saved and session completed!', type: 'success' });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${appointmentId}`);
      setNotification({ message: 'Failed to save record.', type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function initMedia() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        setNotification({ message: 'Media Access Denied. Check camera permissions.', type: 'error' });
        setTimeout(() => setNotification(null), 5000);
      }
    }
    initMedia();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = isVideoOn);
    }
    // Re-attach stream to element when it remounts
    if (isVideoOn && localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [isVideoOn, localStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = isMicOn);
    }
  }, [isMicOn, localStream]);

  if (!appointment) return <div className="h-screen flex items-center justify-center text-slate-400 font-bold italic">Establishing secure connection...</div>;

  const otherUserName = user.role === 'doctor' ? appointment.patientName : `Dr. ${appointment.doctorName}`;

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6">
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
      {/* Video Area */}
      <div className="flex-1 bg-slate-900 rounded-[2.5rem] flex flex-col relative overflow-hidden shadow-2xl">
        <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
           <button 
             onClick={() => navigate('/')}
             className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2.5 rounded-2xl text-white transition-all border border-white/5 flex items-center gap-2 group"
           >
              <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-widest">Dashboard</span>
           </button>
           <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <p className="text-[10px] text-white/50 font-black tracking-widest uppercase mb-0.5">Session with</p>
              <h2 className="text-white font-bold text-sm tracking-tight">{otherUserName}</h2>
           </div>
        </div>

        <div className="flex-1 flex items-center justify-center relative bg-slate-950">
           {/* Remote Video Placeholder (In a real p2p app, this would be the other user's stream) */}
           <div className="text-center space-y-6 z-0">
              <div className="w-32 h-32 bg-slate-900 rounded-full flex items-center justify-center mx-auto shadow-22 relative border-4 border-slate-800">
                 <User className="h-16 w-16 text-slate-700" />
                 <div className="absolute -bottom-2 -right-2 bg-blue-500 p-2 rounded-xl shadow-lg">
                    <Activity className="h-4 w-4 text-white animate-pulse" />
                 </div>
              </div>
              <div className="space-y-2">
                 <p className="text-white font-black tracking-widest uppercase text-xs">Connecting to {otherUserName}...</p>
                 <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3].map(i => (
                       <motion.div 
                         key={i}
                         animate={{ scale: [1, 1.5, 1] }} 
                         transition={{ repeat: Infinity, delay: i * 0.2 }}
                         className="w-1 h-1 bg-blue-500 rounded-full" 
                       />
                    ))}
                 </div>
              </div>
           </div>
           
           {/* Local Video Stream */}
           <motion.div 
             drag
             dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
             className="absolute bottom-6 right-6 w-48 h-64 bg-slate-800 rounded-3xl border-2 border-white/10 shadow-2xl overflow-hidden z-20 group cursor-move"
           >
              {isVideoOn ? (
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                   <VideoOff className="h-10 w-10 text-slate-700" />
                </div>
              )}
              
              <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg">
                 <p className="text-[8px] font-black text-white uppercase tracking-widest">You (Live)</p>
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
           </motion.div>
        </div>

        <div className="p-8 bg-slate-900/50 backdrop-blur-xl border-t border-white/5 flex justify-center gap-5">
           <button onClick={() => setIsMicOn(!isMicOn)} className={`p-4 rounded-3xl transition-all ${isMicOn ? 'bg-white/10 text-white shadow-sm' : 'bg-red-500/20 text-red-500'}`}>
             {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
           </button>
           <button onClick={() => setIsVideoOn(!isVideoOn)} className={`p-4 rounded-3xl transition-all ${isVideoOn ? 'bg-white/10 text-white shadow-sm' : 'bg-red-500/20 text-red-500'}`}>
             {isVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
           </button>
           <button onClick={() => navigate('/')} className="p-4 bg-red-600 text-white rounded-3xl hover:bg-red-700 transition-all shadow-xl shadow-red-900/20">
             <PhoneOff className="h-6 w-6" />
           </button>
        </div>
      </div>

      {/* Toolbox Sidebar */}
      <div className="w-full lg:w-[420px] flex flex-col bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="flex bg-slate-50/80 p-1.5 m-3 rounded-3xl border border-slate-100">
           {[
             { id: 'chat', label: 'Chat', icon: MessageSquare },
             { id: 'reports', label: 'History', icon: FileText },
             { id: 'prescription', label: 'RX Pad', icon: ClipboardCheck }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setSidebarTab(tab.id as any)}
               className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.25rem] text-[10px] uppercase font-black tracking-widest transition-all ${
                 sidebarTab === tab.id ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               <tab.icon className="h-4 w-4" />
               {tab.label}
             </button>
           ))}
        </div>

        <div className="flex-1 overflow-hidden">
           <AnimatePresence mode="wait">
              {sidebarTab === 'chat' && (
                <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
                   <div className="flex-1 overflow-y-auto p-6 space-y-5">
                      <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 mb-2">
                         <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2 font-mono">
                            <Info className="h-3 w-3" /> Triage Summary
                         </div>
                         <p className="text-sm font-medium text-slate-700 italic leading-relaxed">"{appointment.reason}"</p>
                      </div>

                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium shadow-sm leading-relaxed ${
                            msg.senderId === user.uid ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                          }`}>
                            {msg.text}
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                            {format(new Date(msg.createdAt), 'HH:mm')}
                          </span>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                   </div>
                   <form onSubmit={sendMessage} className="p-5 bg-white border-t border-slate-50 flex gap-3">
                      <input 
                        type="text" 
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-50 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                      />
                      <button type="submit" className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">
                        <Send className="h-5 w-5" />
                      </button>
                   </form>
                </motion.div>
              )}

              {sidebarTab === 'reports' && (
                <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6 overflow-y-auto">
                   <MedicalReports patientId={appointment.patientId} isDoctor={true} />
                </motion.div>
              )}

              {sidebarTab === 'prescription' && (
                <motion.div key="rx" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-8 flex flex-col">
                   <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                         <Activity className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-lg">Prescription Pad</h3>
                   </div>
                   
                   {user.role === 'doctor' ? (
                      <div className="flex-1 flex flex-col space-y-5">
                         <div className="relative flex-1">
                            <textarea 
                               className="w-full h-full p-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder:text-slate-400/60"
                               placeholder="Enter medications, dosage, and diagnostic plan..."
                               value={prescription}
                               onChange={(e) => setPrescription(e.target.value)}
                            />
                            <div className="absolute top-4 right-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Official Record</div>
                         </div>
                         <button 
                           onClick={savePrescription}
                           className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-blue-600 shadow-xl shadow-slate-100 transition-all flex items-center justify-center gap-3"
                         >
                            <FileText className="h-5 w-5" />
                            Finalize Digital Record
                         </button>
                      </div>
                   ) : (
                      <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 flex-1 flex flex-col items-center justify-center text-center">
                         {appointment.prescription ? (
                            <div className="text-left w-full space-y-6">
                               <div className="flex justify-between items-start">
                                  <div className="text-[10px] font-black text-blue-600 tracking-widest uppercase bg-blue-50 py-1 px-3 rounded-lg inline-block">Digital RX Verified</div>
                                  <ShieldCheck className="h-5 w-5 text-green-500" />
                               </div>
                               <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap font-mono bg-white p-6 rounded-3xl border border-slate-100 shadow-sm min-h-[120px]">{appointment.prescription}</p>
                               
                               <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-inner flex flex-col items-center gap-4">
                                  <QRCodeSVG value={`prescription:${appointment.id}`} size={120} />
                                  <div className="text-center">
                                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pharmacist Verification</p>
                                     <p className="text-xs font-bold text-slate-800 font-mono">{appointment.id}</p>
                                  </div>
                               </div>
                               <p className="text-[10px] text-slate-400 italic text-center">Issued by Dr. {appointment.doctorName}</p>
                            </div>
                         ) : (
                            <div className="space-y-4">
                               <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-slate-200">
                                  <Clock className="h-8 w-8" />
                               </div>
                               <p className="text-slate-400 text-sm font-medium italic max-w-[200px] mx-auto">Waiting for your doctor to finalize the prescription.</p>
                            </div>
                         )}
                      </div>
                   )}
                </motion.div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
