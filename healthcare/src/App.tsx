/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AppUser } from './types';
import { handleFirestoreError, OperationType } from './lib/utils';
import { Activity } from 'lucide-react';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import Consultation from './pages/Consultation';
import Navbar from './components/Navbar';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as AppUser);
          } else {
            setUser(null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50">
        <div className="relative">
          <Activity className="h-12 w-12 text-blue-600 animate-[pulse_1s_ease-in-out_infinite]" />
          <div className="absolute inset-0 h-12 w-12 border-2 border-blue-100 rounded-full animate-ping opacity-25"></div>
        </div>
        <p className="mt-4 text-blue-600 font-bold text-sm tracking-widest uppercase animate-pulse">eDOC Clinical Setup</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        {user && <Navbar user={user} />}
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route 
              path="/" 
              element={
                !user ? <Navigate to="/login" /> : 
                user.role === 'doctor' ? <Navigate to="/doctor" /> : <Navigate to="/patient" />
              } 
            />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
            
            <Route 
              path="/patient" 
              element={user?.role === 'patient' ? <PatientDashboard user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/doctor" 
              element={user?.role === 'doctor' ? <DoctorDashboard user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/consultation/:appointmentId" 
              element={user ? <Consultation user={user} /> : <Navigate to="/login" />} 
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
