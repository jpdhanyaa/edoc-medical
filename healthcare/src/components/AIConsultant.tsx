import { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { AppUser } from '../types';
import { Sparkles, Send, Bot, User, Loader2, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

export default function AIConsultant({ user, context }: { user: AppUser, context?: string }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const isDoctor = user.role === 'doctor';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'ai', content: "Error: API Key not configured. Please check your environment variables." }]);
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = isDoctor 
        ? "You are a Clinical Intelligence Copilot. Your goal is to help doctors analyze patient data, suggest potential patterns, and provide medical literature summaries. Be concise, clinical, and objective. Always remind that final decisions are with the HCP."
        : "You are a supportive Health Mentor. Help patients understand their wellness, explain common medical terms simply, and provide healthy lifestyle tips. Never provide a final diagnosis, always suggest consulting their actual doctor for medical decisions.";

      const prompt = context 
        ? `[CONTEXT DATA]: ${context}\n\n[USER QUERY]: ${userMessage}`
        : userMessage;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })), { role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction }
      });

      setMessages(prev => [...prev, { role: 'ai', content: response.text || "I'm having trouble processing that right now." }]);
    } catch (error) {
      // AI handled silently
      setMessages(prev => [...prev, { role: 'ai', content: "Error: AI services are currently heavily loaded. Please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl relative border-4 border-slate-800">
      {/* Header */}
      <div className="p-6 bg-slate-800/50 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-widest">{isDoctor ? 'Clinical Intelligence' : 'Health Mentor'}</h3>
            <div className="flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Gemini 3.0 Processing</span>
            </div>
          </div>
        </div>
        <BrainCircuit className="h-6 w-6 text-slate-600" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-10">
             <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-600">
                <Bot className="h-8 w-8" />
             </div>
             <div>
                <p className="text-slate-300 font-bold">Hello {user.displayName},</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  {isDoctor 
                    ? "Pass me complex case data or ask for medical literature insights. I am your neural clinical extension." 
                    : "I'm here to help you understand your wellness journey. How are you feeling today?"}
                </p>
             </div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
               <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                  {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
               </div>
               <div className={`p-4 rounded-3xl text-sm leading-relaxed ${
                 m.role === 'user' 
                   ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' 
                   : 'bg-slate-800 text-slate-300 border border-slate-700'
               }`}>
                  <div className="markdown-body">
                     <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
               </div>
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
             <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300">
                   <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="bg-slate-800 p-4 rounded-3xl border border-slate-700 flex gap-1">
                   <span className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                   <span className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                   <span className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce"></span>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-6 bg-slate-800/80 backdrop-blur-md border-t border-slate-700">
        <div className="relative">
          <input 
            type="text"
            className="w-full pl-6 pr-14 py-4 bg-slate-900 border border-slate-700 rounded-2xl text-white text-sm outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
            placeholder={isDoctor ? "Ask for case summary or analysis..." : "Type your symptoms or health query..."}
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white disabled:bg-slate-800 disabled:text-slate-600 transition-all hover:bg-indigo-500 shadow-xl shadow-indigo-600/20"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 text-center mt-3 font-bold uppercase tracking-widest">
           AI output is for guidance only • Neural Mesh Status: Optimal
        </p>
      </form>
    </div>
  );
}
