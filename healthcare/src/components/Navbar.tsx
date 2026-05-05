import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { AppUser } from '../types';
import { LogOut, User, Activity } from 'lucide-react';

export default function Navbar({ user }: { user: AppUser }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-blue-100 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-blue-600">
          <Activity className="h-6 w-6" />
          <span className="font-bold text-xl tracking-tight">eDOC</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link 
            to="/" 
            className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-all flex items-center gap-2"
          >
             <Activity className="h-4 w-4" />
             Dashboard
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-600 border-l border-slate-100 pl-6">
            <User className="h-4 w-4" />
            <span>{user.displayName} ({user.role})</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
