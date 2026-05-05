import { BookOpen, ExternalLink, ShieldCheck, Heart, User } from 'lucide-react';
import { motion } from 'motion/react';

const RESOURCES = [
  {
    title: "Understanding Hypertension",
    category: "Cardiology",
    description: "A complete guide to managing blood pressure through lifestyle and diet.",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400",
    readTime: "5 min read"
  },
  {
    title: "Diabetes Care Basics",
    category: "Endocrinology",
    description: "Modern approaches to insulin management and continuous monitoring.",
    image: "https://images.unsplash.com/photo-1505751172107-1606d1565451?auto=format&fit=crop&q=80&w=400",
    readTime: "8 min read"
  },
  {
    title: "Mental Health in Recovery",
    category: "Wellness",
    description: "Strategies for emotional balance during long-term medical treatments.",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400",
    readTime: "6 min read"
  },
  {
    title: "Vaccination Knowledge",
    category: "Prevention",
    description: "Clearing misconceptions and staying up to date with global health standards.",
    image: "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&q=80&w=400",
    readTime: "4 min read"
  }
];

export default function HealthLibrary() {
  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-px bg-slate-200"></span>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Medical Insights</span>
           </div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Curated Health Library</h2>
           <p className="text-slate-500 font-bold text-sm mt-1">Sourced from global medical journals and clinical guides.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
           <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                 <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="Expert" className="w-full h-full object-cover" />
                 </div>
              ))}
           </div>
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Verified by 12 Experts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {RESOURCES.map((res, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group cursor-pointer"
          >
            <div className="relative h-64 rounded-[2.5rem] overflow-hidden mb-6 shadow-lg group-hover:shadow-2xl transition-all">
               <img src={res.image} alt={res.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
               <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent text-white p-8 flex flex-col justify-end">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-blue-600/90 backdrop-blur-md px-3 py-1 rounded-lg w-fit mb-3">
                     {res.category}
                  </span>
                  <h3 className="text-xl font-bold mb-1 group-hover:text-blue-400 transition-colors">{res.title}</h3>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-300">
                     <div className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {res.readTime}
                     </div>
                     <div className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Certified
                     </div>
                  </div>
               </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed px-2">{res.description}</p>
            <div className="flex items-center gap-2 mt-4 px-2 text-[10px] font-black text-slate-900 uppercase tracking-widest group-hover:gap-4 transition-all">
               Read Full Article
               <ExternalLink className="h-3 w-3" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-[3rem] p-12 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-20 bg-blue-600/20 rounded-full blur-3xl -mr-10 -mt-10" />
         <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
            <Heart className="h-10 w-10 text-red-500 mb-6 fill-red-500 animate-pulse" />
            <h3 className="text-2xl font-black text-white mb-4">Personalized Recommendations</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">Connect your health vitals to receive articles specifically tailored to your current biometric trends.</p>
            <button className="px-10 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-blue-600 hover:text-white transition-all shadow-xl">
               Sync My Profile
            </button>
         </div>
      </div>
    </div>
  );
}
