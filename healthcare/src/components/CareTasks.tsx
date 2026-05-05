import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { CareTask } from '../types';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { CheckCircle2, Circle, Clock, Trash2, Plus, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CareTasks({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<CareTask['type']>('medication');

  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CareTask)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    return () => unsubscribe();
  }, [userId]);

  const toggleTask = async (task: CareTask) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), { isCompleted: !task.isCompleted });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        userId,
        title: newTitle,
        type: newType,
        isCompleted: false,
        dueDate: new Date().toISOString()
      });
      setNewTitle('');
      setShowAdd(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tasks');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Priority Agenda</h3>
        <button 
          onClick={() => setShowAdd(true)}
          className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        {tasks.sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted)).map(task => (
          <motion.div 
            key={task.id}
            layout
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
              task.isCompleted ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-4">
              <button 
                onClick={() => toggleTask(task)}
                className={`transition-colors ${task.isCompleted ? 'text-green-500' : 'text-slate-300 hover:text-blue-500'}`}
              >
                {task.isCompleted ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
              </button>
              <div>
                <p className={`text-sm font-bold ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                   <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                     task.type === 'medication' ? 'bg-indigo-50 text-indigo-600' : 
                     task.type === 'followup' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                   }`}>
                      {task.type}
                   </span>
                </div>
              </div>
            </div>
            <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-100">
             <Calendar className="h-8 w-8 text-slate-200 mx-auto mb-2" />
             <p className="text-xs font-bold text-slate-400 uppercase">Your agenda is clear</p>
          </div>
        )}
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
                <h3 className="text-xl font-bold text-slate-900 mb-6 font-black uppercase tracking-tight">New Agenda Item</h3>
                <form onSubmit={addTask} className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Description</label>
                      <input 
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Morning insulin check..."
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Task Category</label>
                      <div className="grid grid-cols-3 gap-2">
                         {['medication', 'followup', 'clinical'].map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setNewType(t as any)}
                              className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter border transition-all ${
                                newType === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                               {t}
                            </button>
                         ))}
                      </div>
                   </div>
                   <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">Cancel</button>
                      <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-blue-700 transition-all shadow-xl">Add Task</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
