import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, addDoc, getDocs, where, deleteDoc, doc } from 'firebase/firestore';
import { MedicalReport, Appointment } from '../types';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { FileText, Plus, Trash2, Clock, AlertCircle, Paperclip, ShieldCheck, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function MedicalReports({ patientId, isDoctor, doctorName }: { patientId: string, isDoctor: boolean, doctorName?: string }) {
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(!isDoctor);

  useEffect(() => {
    if (isDoctor && auth.currentUser) {
      const checkAccess = async () => {
        const q = query(
          collection(db, 'appointments'),
          where('doctorId', '==', auth.currentUser?.uid),
          where('patientId', '==', patientId),
          where('status', 'in', ['approved', 'completed'])
        );
        const snap = await getDocs(q);
        setHasAccess(!snap.empty);
      };
      checkAccess();
    }
  }, [isDoctor, patientId]);

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'users', patientId, 'reports')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalReport));
      setReports(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${patientId}/reports`);
    });

    return () => unsubscribe();
  }, [patientId, hasAccess]);

  const addReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      await addDoc(collection(db, 'users', patientId, 'reports'), {
        title,
        content,
        patientId,
        fileName: fileName || undefined,
        issuedBy: doctorName || (isDoctor ? "Specialist" : "Patient"),
        createdAt: new Date().toISOString()
      });
      setTitle('');
      setContent('');
      setFileName(null);
      setShowAdd(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${patientId}/reports`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await deleteDoc(doc(db, 'users', patientId, 'reports', reportId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${patientId}/reports/${reportId}`);
    }
  };

  if (isDoctor && !hasAccess) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-200">
         <Lock className="h-10 w-10 text-slate-300 mx-auto mb-4" />
         <h4 className="font-bold text-slate-800 mb-2">Access Restricted</h4>
         <p className="text-sm text-slate-500 max-w-xs mx-auto">You can only view this patient's medical reports once they have an approved appointment with you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Medical Reports & Records
        </h3>
        <button 
          onClick={() => setShowAdd(true)}
          className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          {isDoctor ? 'Issue New Report' : 'Add My Record'}
        </button>
      </div>

      {showAdd && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm space-y-3"
        >
          <input 
            type="text" 
            placeholder="Report Title (e.g. Blood Test - May 2024)"
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea 
            placeholder="Details, results, or clinical notes..."
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 h-24"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex items-center gap-4">
             <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-all border border-slate-200">
                <Paperclip className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">
                   {fileName || 'Attach File'}
                </span>
                <input type="file" className="hidden" onChange={handleFileChange} />
             </label>
             {fileName && (
                <button onClick={() => setFileName(null)} className="text-[10px] font-bold text-red-500 uppercase">Remove</button>
             )}
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setShowAdd(false)}
              className="text-xs font-bold text-slate-500 px-2 py-1"
            >
              Cancel
            </button>
            <button 
              onClick={addReport}
              className="text-xs font-bold bg-blue-600 text-white px-3 py-1 rounded-lg"
            >
              Save Report
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm italic tracking-wide">Syncing records...</div>
        ) : reports.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
             <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
             <p className="text-slate-500 text-sm">No medical records uploaded.</p>
          </div>
        ) : (
          reports.map(report => (
            <div key={report.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-700 text-sm">{report.title}</h4>
                {!isDoctor && (
                  <button 
                    onClick={() => deleteReport(report.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-600 whitespace-pre-wrap mb-3 leading-relaxed">{report.content}</p>
              
              {report.fileName && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50/50 rounded-lg border border-blue-100/50">
                   <Paperclip className="h-3 w-3 text-blue-500" />
                   <span className="text-[10px] font-bold text-blue-600">{report.fileName}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                   <Clock className="h-3 w-3" />
                   {new Date(report.createdAt).toLocaleDateString()}
                </div>
                {report.issuedBy && (
                   <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter flex items-center gap-1">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Issuer: {report.issuedBy}
                   </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
