import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, orderBy } from 'firebase/firestore';
import { Vital } from '../types';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Plus, TrendingUp, Droplet, Weight, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export default function VitalsTracker({ patientId, isDoctor }: { patientId: string, isDoctor: boolean }) {
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<Vital['type']>('Heart Rate');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('bpm');

  useEffect(() => {
    const q = query(
      collection(db, 'vitals'),
      where('patientId', '==', patientId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vital));
      setVitals(data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vitals'));

    return () => unsubscribe();
  }, [patientId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'vitals'), {
        patientId,
        type,
        value: Number(value),
        unit,
        createdAt: new Date().toISOString()
      });
      setShowAdd(false);
      setValue('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'vitals');
    }
  };

  const getChartData = (type: string) => {
    return vitals
      .filter(v => v.type === type)
      .map(v => ({
        date: format(new Date(v.createdAt), 'MMM d'),
        value: v.value,
        fullDate: format(new Date(v.createdAt), 'PPp')
      }));
  };

  const vitalTypes = [
    { name: 'Heart Rate', icon: Heart, unit: 'bpm', color: '#ef4444' },
    { name: 'Blood Pressure', icon: Activity, unit: 'mmHg', color: '#3b82f6' },
    { name: 'Glucose', icon: Droplet, unit: 'mg/dL', color: '#f59e0b' },
    { name: 'Temperature', icon: Activity, unit: '°C', color: '#f97316' },
    { name: 'Resp. Rate', icon: Activity, unit: 'bpm', color: '#8b5cf6' },
    { name: 'Weight', icon: Weight, unit: 'kg', color: '#10b981' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Biometric Trends</h3>
        </div>
        {!isDoctor && (
          <button 
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all"
          >
            <Plus className="h-4 w-4" />
            Log Reading
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {vitalTypes.map(vt => {
          const data = getChartData(vt.name);
          return (
            <motion.div 
              key={vt.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-slate-50 text-slate-400`}>
                    <vt.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{vt.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Last read: {data.length > 0 ? data[data.length-1].date : 'N/A'}</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-2xl font-black text-slate-900">{data.length > 0 ? data[data.length-1].value : '--'}</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase">{vt.unit}</p>
                </div>
              </div>

              <div className="h-48 w-full">
                {data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id={`color${vt.name.replace(' ', '')}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={vt.color} stopOpacity={0.1}/>
                          <stop offset="95%" stopColor={vt.color} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={vt.color} 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill={`url(#color${vt.name.replace(' ', '')})`} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-100">
                    <p className="text-[10px] font-bold text-slate-300 uppercase">No history detected</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6 font-black uppercase tracking-tight">Manual Log Entry</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Metric Type</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={type}
                    onChange={(e) => {
                      const nt = e.target.value as Vital['type'];
                      setType(nt);
                      setUnit(vitalTypes.find(v => v.name === nt)?.unit || '');
                    }}
                  >
                    {vitalTypes.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Reading Value ({unit})</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Enter ${type}...`}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">Discard</button>
                  <button type="submit" className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-600 transition-all shadow-xl">Commit</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
