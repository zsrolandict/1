
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, FileText, Loader2, Sparkles, Eraser } from 'lucide-react';
import { GoogleGenAI, Chat } from "@google/genai";
import { ScannedFile } from '../types.ts';
import { fileToBase64, getGeminiMimeType } from '../utils/helpers.ts';

interface DocumentChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: ScannedFile;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

const DocumentChatModal: React.FC<DocumentChatModalProps> = ({ isOpen, onClose, file }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && file) {
      initializeChat();
    }
    return () => {
      chatSessionRef.current = null;
      setMessages([]);
    };
  }, [isOpen, file]);

  const initializeChat = async () => {
    setIsInitializing(true);
    try {
      const base64Data = await fileToBase64(file.file);
      const mimeType = getGeminiMimeType(file.file);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Létrehozzuk a chat munkamenetet
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: `Ön egy segítőkész jogi és adminisztratív asszisztens. 
          A felhasználó egy konkrét dokumentumról fog kérdezni.
          Válaszai legyenek tömörek, lényegretörőek és szakmailag pontosak.
          Mindig magyarul válaszoljon.
          Hivatkozzon a dokumentum konkrét részeire, ha lehetséges.`,
        },
      });

      // Elküldjük a dokumentumot az első üzenetben ("priming")
      // A @google/genai SDK szerint a 'message' paraméterben kell átadni a tartalmat
      await chat.sendMessage({
        message: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Elemezd ezt a dokumentumot és állj készen a kérdésekre." }
        ]
      });

      chatSessionRef.current = chat;
      
      setMessages([
        {
          id: 'init',
          role: 'model',
          text: `Szia! Átnéztem a(z) "${file.originalName}" dokumentumot. Miben segíthetek? Kérdezhetsz határidőkről, összegekről vagy jogi kitételekről.`
        }
      ]);
    } catch (error) {
      console.error("Chat init error:", error);
      setMessages([{ id: 'err', role: 'model', text: "Hiba történt a dokumentum betöltésekor. Kérlek próbáld újra később.", isError: true }]);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !chatSessionRef.current || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMsg.text });
      const responseText = result.text;
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText
      }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sajnálom, hiba történt a válasz generálása közben.",
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-[80vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 border border-slate-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
                Dokumentum Asszisztens <Sparkles className="w-3 h-3 text-amber-500" />
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold max-w-[200px] truncate">
                <FileText className="w-3 h-3" /> {file.originalName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={initializeChat} 
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-indigo-600 transition-colors"
                title="Beszélgetés újrakezdése"
            >
                <Eraser className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-rose-600 transition-colors">
                <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-100/50 custom-scrollbar">
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-black uppercase tracking-widest">Dokumentum elemzése...</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-white text-slate-800 rounded-tr-none' 
                      : (msg.isError ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-none' : 'bg-indigo-600 text-white rounded-tl-none shadow-indigo-200')
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-indigo-50 text-indigo-800 px-4 py-3 rounded-2xl rounded-tl-none text-xs font-bold flex items-center gap-2">
                    Írás folyamatban...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tegyél fel egy kérdést a dokumentummal kapcsolatban..."
              className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2.5 px-3 text-sm font-medium text-slate-800 placeholder:text-slate-400"
              rows={1}
              style={{ minHeight: '44px' }}
              disabled={isInitializing}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isInitializing}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 mb-0.5"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest mt-3">
             A válaszokat a Gemini AI generálja. Ellenőrizze a pontosságot.
          </p>
        </div>

      </div>
    </div>
  );
};

export default DocumentChatModal;
