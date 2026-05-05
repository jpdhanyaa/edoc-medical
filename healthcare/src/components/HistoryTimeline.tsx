import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { Appointment, MedicalReport, AppUser } from '../types';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { Calendar, FileText, CheckCircle2, Clock, ChevronRight, Activity, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';

type TimelineEvent = {
  id: string;
  type: 'appointment' | 'report';
  date: string;
  title: string;
  description: string;
  status?: string;
  icon: any;
};

export default function HistoryTimeline({ patientId }: { patientId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Appointments
        const aptsQ = query(
          collection(db, 'appointments'),
          where('patientId', '==', patientId)
        );
        const aptsSnap = await getDocs(aptsQ);
        const aptEvents: TimelineEvent[] = aptsSnap.docs.map(doc => {
          const data = doc.data() as Appointment;
          return {
            id: doc.id,
            type: 'appointment',
            date: data.date,
            title: `Consultation with Dr. ${data.doctorName || 'Unknown'}`,
            description: data.reason || 'No summary provided',
            status: data.status,
            icon: Calendar
          };
        });

        // Reports
        const reportsQ = query(
          collection(db, 'users', patientId, 'reports')
        );
        const reportsSnap = await getDocs(reportsQ);
        const reportEvents: TimelineEvent[] = reportsSnap.docs.map(doc => {
          const data = doc.data() as MedicalReport;
          return {
            id: doc.id,
            type: 'report',
            date: format(new Date(data.createdAt), 'yyyy-MM-dd'),
            title: data.title,
            description: data.content,
            icon: FileText
          };
        });

        const allEvents = [...aptEvents, ...reportEvents].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setEvents(allEvents);
        setLoading(false);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'history');
      }
    };

    fetchHistory();
  }, [patientId]);

  if (loading) return <div className="p-8 text-center animate-pulse text-slate-400">Tracing health history...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
         <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Activity className="h-6 w-6" />
         </div>
         <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Health History Timeline</h2>
      </div>

      <div className="relative border-l-2 border-slate-100 ml-6 pl-10 space-y-12">
        {events.length === 0 ? (
          <div className="text-slate-400 italic">No health records found in the timeline.</div>
        ) : (
          events.map((event, idx) => (
            <motion.div 
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative"
            >
              <div className={`absolute -left-[3.25rem] top-0 w-10 h-10 rounded-2xl border-4 border-white shadow-md flex items-center justify-center ${event.type === 'appointment' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'}`}>
                 <event.icon className="h-4 w-4" />
              </div>
              
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                       <p className="text-[10px] font-black tracking-widest text-blue-600 uppercase mb-1">{format(new Date(event.date), 'MMMM d, yyyy')}</p>
                       <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{event.title}</h3>
                    </div>
                    {event.status && (
                       <span className="text-[9px] font-black px-2 py-1 bg-slate-100 rounded-full text-slate-500 uppercase tracking-tighter">
                          {event.status}
                       </span>
                    )}
                 </div>
                 <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">{event.description}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
