import { useState, useEffect, ReactNode, FormEvent, ChangeEvent } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Search, ArrowLeft, Check, Eye, Settings as SettingsIcon, LogOut, Plus, Edit2, Trash2, Upload, ChevronDown, ChevronUp, X, Maximize2, RotateCcw, Download, MessageCircle, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Rnd } from 'react-rnd';
import { io } from 'socket.io-client';
import { University, Subject, Plan, Settings, useSettings, InfoBox } from './types';
import { cn } from './utils';
import { MapMode } from './components/MapMode';
import { VipMode } from './components/VipMode';

// --- Components ---

export const updateSettings = async (updates: Partial<Settings>) => {
  await fetch('/api/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
};

const UIText = ({ id, defaultText, className, settings }: { id: string, defaultText: string, className?: string, settings: Settings }) => {
  const uiTexts = settings.ui_texts ? JSON.parse(settings.ui_texts) : {};
  return (
    <span className={className}>
      {uiTexts[id] || defaultText}
    </span>
  );
};

const WizardHeader = ({ step, totalSteps = 7, title = "إنشاء مهمة جديدة", transparent = false, hideProgress = false }: { step: number, totalSteps?: number, title?: string, transparent?: boolean, hideProgress?: boolean }) => {
  const progress = (step / totalSteps) * 100;
  const settings = useSettings();
  
  return (
    <div className={cn(
      "pt-8 pb-4 px-5 border-b sticky top-0 z-50 transition-all duration-300",
      transparent ? "bg-transparent border-transparent" : "bg-white border-slate-100"
    )} dir="rtl">
      <div className="flex justify-between items-start mb-4">
        <div className="text-right flex items-center gap-4">
          {settings?.logo_url ? (
            <img 
              src={settings.logo_url} 
              alt="Logo" 
              className="object-contain" 
              style={{ height: `${settings.logo_size || 56}px` }}
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div>
            <h1 className="text-2xl font-black text-slate-800">{title}</h1>
            {!hideProgress && <p className="text-slate-400 text-sm font-bold mt-1">الخطوة {step} من {totalSteps}</p>}
          </div>
        </div>
        {!hideProgress && (
          <div className="text-left">
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">التقدم</p>
            <p className="text-primary font-black text-xl">{Math.round(progress)}%</p>
          </div>
        )}
      </div>
      {!hideProgress && (
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={cn("h-full", transparent ? "bg-gradient-to-r from-primary to-purple-500" : "bg-primary")}
          />
        </div>
      )}
    </div>
  );
};

const StepTitle = ({ title, subtitle, onBack, dark = false, children }: { title: ReactNode, subtitle?: string, onBack?: () => void, dark?: boolean, children?: ReactNode }) => (
  <div className="flex justify-between items-center mt-8 mb-6" dir="rtl">
    <div className="text-right">
      <h2 className={cn("text-2xl font-black", dark ? "text-white" : "text-slate-800")}>{title}</h2>
      {subtitle && <p className={cn("text-sm font-bold mt-0.5", dark ? "text-white/60" : "text-slate-400")}>{subtitle}</p>}
    </div>
    <div className="flex items-center gap-2">
      {children}
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm bg-white shadow-sm active:scale-95 transition-all"
        >
          <ChevronDown size={18} className="rotate-90" />
          <span>رجوع</span>
        </button>
      )}
    </div>
  </div>
);

const Header = ({ title, logoUrl }: { title: string, logoUrl?: string }) => (
  <header className="header-gradient flex flex-col items-center justify-center gap-2 py-8">
    {logoUrl ? (
      <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain mb-1" referrerPolicy="no-referrer" />
    ) : (
      <div className="h-14 w-14 bg-white/20 rounded-full flex items-center justify-center mb-1 backdrop-blur-sm border border-white/10">
        <span className="text-white font-bold text-2xl">{title.charAt(0)}</span>
      </div>
    )}
    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
  </header>
);

const Container = ({ children, className }: { children: ReactNode, className?: string }) => (
  <div className={cn("max-w-[500px] mx-auto px-5 pb-12 w-full", className)}>
    {children}
  </div>
);

// --- Pages ---

const Home = ({ onOpenAdmin, isLoggedIn, showSuccess }: { onOpenAdmin: () => void, isLoggedIn: boolean, showSuccess: (msg: string) => void }) => {
  const [unis, setUnis] = useState<University[]>([]);
  const [infoBoxes, setInfoBoxes] = useState<InfoBox[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingBoxId, setEditingBoxId] = useState<number | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isAddInfoBoxModalOpen, setIsAddInfoBoxModalOpen] = useState(false);
  const [newInfoBoxData, setNewInfoBoxData] = useState({ title: '', text: '' });
  const [whatsappData, setWhatsappData] = useState({ number: '', prefix: '', buttonText: '' });
  const navigate = useNavigate();
  const settings = useSettings();

  const fetchData = () => {
    fetch('/api/universities').then(res => res.json()).then(setUnis);
    fetch('/api/info-boxes').then(res => res.json()).then(setInfoBoxes);
  };

  useEffect(() => {
    fetchData();

    const socket = io();
    socket.on('data_updated', () => {
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (settings) {
      setWhatsappData({
        number: settings.whatsapp_number || '',
        prefix: settings.whatsapp_prefix || '',
        buttonText: settings.whatsapp_button_text || ''
      });
    }
  }, [settings]);

  const handleUpdateSetting = async (key: string, value: string) => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleUpdateUni = async (id: number, field: string, value: string) => {
    const uni = unis.find(u => u.id === id);
    if (!uni) return;
    const updated = { ...uni, [field]: value };
    await fetch(`/api/admin/universities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    setUnis(prev => prev.map(u => u.id === id ? updated : u));
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleReorderUnis = async (direction: 'up' | 'down', index: number) => {
    const newUnis = [...unis];
    if (direction === 'up' && index > 0) {
      [newUnis[index], newUnis[index - 1]] = [newUnis[index - 1], newUnis[index]];
    } else if (direction === 'down' && index < unis.length - 1) {
      [newUnis[index], newUnis[index + 1]] = [newUnis[index + 1], newUnis[index]];
    } else {
      return;
    }
    setUnis(newUnis);
    await fetch('/api/admin/reorder-universities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newUnis.map(u => u.id) })
    });
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleDeleteUni = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الجامعة؟')) {
      await fetch(`/api/admin/universities/${id}`, { method: 'DELETE' });
      setUnis(prev => prev.filter(u => u.id !== id));
      showSuccess('تم حفظ التغييرات بنجاح ✅');
    }
  };

  const handleAddUni = async () => {
    const name = window.prompt('اسم الجامعة الجديدة:');
    if (!name) return;
    await fetch('/api/admin/universities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: 'وصف الجامعة' })
    });
    fetch('/api/universities').then(res => res.json()).then(setUnis);
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleAddInfoBox = () => {
    setNewInfoBoxData({ title: '', text: '' });
    setIsAddInfoBoxModalOpen(true);
  };

  const submitNewInfoBox = async () => {
    if (!newInfoBoxData.text) return;
    const res = await fetch('/api/admin/info-boxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title: newInfoBoxData.title,
        text: newInfoBoxData.text, 
        bg_color: '#ffffff', 
        text_color: '#000000',
        text_size: '24',
        font_family: 'sans',
        shape: '16',
        is_bold: false,
        has_3d_shadow: true,
        width: 300,
        height: 150,
        pos_x: 0,
        pos_y: 0
      })
    });
    const data = await res.json();
    await fetch('/api/info-boxes').then(res => res.json()).then(setInfoBoxes);
    setIsAddInfoBoxModalOpen(false);
    
    // Automatically enter edit mode for the new box
    if (data.success && data.id) {
      setIsEditMode(true);
      setEditingBoxId(data.id);
      showSuccess('تم حفظ التغييرات بنجاح ✅');
    }
  };

  const handleUpdateInfoBox = async (id: number, field: string, value: any) => {
    const box = infoBoxes.find(b => b.id === id);
    if (!box) return;
    const updated = { ...box, [field]: value };
    await fetch(`/api/admin/info-boxes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    setInfoBoxes(prev => prev.map(b => b.id === id ? updated : b));
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleUpdateInfoBoxMultiple = async (id: number, updates: Partial<InfoBox>) => {
    const box = infoBoxes.find(b => b.id === id);
    if (!box) return;
    const updated = { ...box, ...updates };
    await fetch(`/api/admin/info-boxes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    setInfoBoxes(prev => prev.map(b => b.id === id ? updated : b));
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleDeleteInfoBox = async (id: number) => {
    await fetch(`/api/admin/info-boxes/${id}`, {
      method: 'DELETE'
    });
    setInfoBoxes(prev => prev.filter(b => b.id !== id));
    if (editingBoxId === id) setEditingBoxId(null);
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    await fetch('/api/admin/logo', {
      method: 'POST',
      body: formData
    });
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleFileUpload = async (boxId: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      handleUpdateInfoBox(boxId, 'file_url', data.file_url);
    }
  };

  if (!settings) return null;

  const modalsAndPanels = (
    <>
      <AnimatePresence>
        {isAddInfoBoxModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <PlusCircle className="text-[var(--color-primary)]" />
                  إضافة مربع نص جديد
                </h3>
                <button onClick={() => setIsAddInfoBoxModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">العنوان (اختياري)</label>
                  <input 
                    type="text" 
                    value={newInfoBoxData.title}
                    onChange={(e) => setNewInfoBoxData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="أدخل عنوان المربع"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">النص</label>
                  <textarea 
                    value={newInfoBoxData.text}
                    onChange={(e) => setNewInfoBoxData(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="أدخل محتوى المربع"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right outline-none focus:ring-2 focus:ring-[var(--color-primary)] min-h-[100px] resize-none"
                  />
                </div>

                <button 
                  onClick={submitNewInfoBox}
                  disabled={!newInfoBoxData.text.trim()}
                  className="w-full py-4 bg-[var(--color-primary)] hover:bg-[#14b8a6] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl font-black text-lg shadow-lg shadow-[var(--color-primary)]/30 transition-all mt-4"
                >
                  إضافة المربع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isWhatsAppModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <MessageCircle className="text-[#22c55e]" />
                  إعدادات الواتساب
                </h3>
                <button onClick={() => setIsWhatsAppModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">رقم الواتساب الجديد</label>
                  <input 
                    type="text" 
                    value={whatsappData.number}
                    onChange={(e) => setWhatsappData(prev => ({ ...prev, number: e.target.value }))}
                    placeholder="مثال: 96512345678"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right outline-none focus:ring-2 focus:ring-[#22c55e] font-mono text-left"
                    dir="ltr"
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">الرجاء إدخال الرقم مع مفتاح الدولة (بدون + أو أصفار)</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">رسالة الترحيب / البداية</label>
                  <textarea 
                    value={whatsappData.prefix}
                    onChange={(e) => setWhatsappData(prev => ({ ...prev, prefix: e.target.value }))}
                    placeholder="مثال: مرحباً، أود الاستفسار عن..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right outline-none focus:ring-2 focus:ring-[#22c55e] min-h-[100px] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">نص زر الواتساب</label>
                  <input 
                    type="text" 
                    value={whatsappData.buttonText}
                    onChange={(e) => setWhatsappData(prev => ({ ...prev, buttonText: e.target.value }))}
                    placeholder="مثال: اطلب عبر واتساب"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>

                <button 
                  onClick={async () => {
                    await handleUpdateSetting('whatsapp_number', whatsappData.number);
                    await handleUpdateSetting('whatsapp_prefix', whatsappData.prefix);
                    await handleUpdateSetting('whatsapp_button_text', whatsappData.buttonText);
                    setIsWhatsAppModalOpen(false);
                    window.location.reload();
                  }}
                  className="w-full py-4 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-2xl font-black text-lg shadow-lg shadow-[#22c55e]/30 transition-all mt-4"
                >
                  حفظ التعديلات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Box Settings Floating Panel */}
      <AnimatePresence>
        {isEditMode && editingBoxId && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="fixed top-1/2 right-4 -translate-y-1/2 z-[110] w-80 bg-white/90 backdrop-blur-xl p-6 rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-white/50 max-h-[90vh] overflow-y-auto custom-scrollbar" 
            dir="rtl"
          >
            {(() => {
              const box = infoBoxes.find(b => b.id === editingBoxId);
              if (!box) return null;
              
              const fontSize = parseInt(box.text_size) || 18;
              const borderRadius = parseInt(box.shape) || 16;

              return (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-black text-slate-800">إعدادات المربع</h3>
                    <button onClick={() => setEditingBoxId(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">العنوان (اختياري)</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-right outline-none focus:ring-2 focus:ring-primary text-sm mb-3"
                      defaultValue={box.title || ''}
                      onBlur={(e) => handleUpdateInfoBox(box.id, 'title', e.target.value)}
                      placeholder="عنوان المربع"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">النص</label>
                    <textarea
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-right outline-none focus:ring-2 focus:ring-primary min-h-[80px] text-sm"
                      defaultValue={box.text}
                      onBlur={(e) => handleUpdateInfoBox(box.id, 'text', e.target.value)}
                    />
                  </div>

                  {/* Font Size Slider */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase">حجم الخط</label>
                      <span className="text-xs text-slate-500 font-mono">{fontSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" max="72" 
                      value={fontSize}
                      onChange={(e) => handleUpdateInfoBox(box.id, 'text_size', e.target.value)}
                      className="w-full accent-primary"
                    />
                  </div>

                  {/* Border Radius Slider */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase">انحناء الزوايا</label>
                      <span className="text-xs text-slate-500 font-mono">{borderRadius}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={borderRadius}
                      onChange={(e) => handleUpdateInfoBox(box.id, 'shape', e.target.value)}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">لون الخلفية</label>
                      <input
                        type="color"
                        className="w-full h-10 rounded-xl cursor-pointer border-none p-0"
                        value={box.bg_color || '#ffffff'}
                        onChange={(e) => handleUpdateInfoBox(box.id, 'bg_color', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">لون النص</label>
                      <input
                        type="color"
                        className="w-full h-10 rounded-xl cursor-pointer border-none p-0"
                        value={box.text_color || '#000000'}
                        onChange={(e) => handleUpdateInfoBox(box.id, 'text_color', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">الخط</label>
                      <select
                        className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none"
                        defaultValue={box.font_family || 'sans'}
                        onChange={(e) => handleUpdateInfoBox(box.id, 'font_family', e.target.value)}
                      >
                        <option value="sans">Sans</option>
                        <option value="serif">Serif</option>
                        <option value="mono">Mono</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2 justify-center pt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          defaultChecked={box.is_bold} 
                          onChange={(e) => handleUpdateInfoBox(box.id, 'is_bold', e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-bold text-slate-600">عريض</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          defaultChecked={box.has_3d_shadow} 
                          onChange={(e) => handleUpdateInfoBox(box.id, 'has_3d_shadow', e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-bold text-slate-600">ظل 3D</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">إرفاق ملف</label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-white border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-primary hover:text-primary transition-all text-sm font-bold text-slate-600">
                        <Upload size={16} />
                        <span>{box.file_url ? 'تغيير الملف' : 'رفع ملف'}</span>
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(box.id, e)} />
                      </label>
                      {box.file_url && (
                        <button 
                          onClick={() => handleUpdateInfoBox(box.id, 'file_url', '')}
                          className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {box.file_url && (
                      <a href={box.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary mt-1 block truncate" dir="ltr">
                        {box.file_url.split('/').pop()}
                      </a>
                    )}
                  </div>

                  <button 
                    onClick={() => {
                      handleDeleteInfoBox(box.id);
                      setEditingBoxId(null);
                    }}
                    className="w-full py-3 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-4"
                  >
                    <Trash2 size={16} />
                    حذف المربع
                  </button>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (settings.layout_mode === 'vip') {
    return (
      <>
        {modalsAndPanels}
        <VipMode 
          unis={unis} 
          settings={settings} 
          isLoggedIn={isLoggedIn} 
          onOpenAdmin={onOpenAdmin}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          setIsWhatsAppModalOpen={setIsWhatsAppModalOpen}
          infoBoxes={infoBoxes}
          handleAddInfoBox={handleAddInfoBox}
          editingBoxId={editingBoxId}
          setEditingBoxId={setEditingBoxId}
          handleUpdateInfoBox={handleUpdateInfoBox}
          handleUpdateInfoBoxMultiple={handleUpdateInfoBoxMultiple}
          handleDeleteInfoBox={handleDeleteInfoBox}
          handleFileUpload={handleFileUpload}
          handleUpdateUni={handleUpdateUni}
        />
      </>
    );
  }

  if (settings.layout_mode === 'map') {
    return (
      <>
        {modalsAndPanels}
        <MapMode 
          unis={unis} 
          settings={settings} 
          isLoggedIn={isLoggedIn} 
          onOpenAdmin={onOpenAdmin}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          setIsWhatsAppModalOpen={setIsWhatsAppModalOpen}
          infoBoxes={infoBoxes}
          handleAddInfoBox={handleAddInfoBox}
          editingBoxId={editingBoxId}
          setEditingBoxId={setEditingBoxId}
          handleUpdateInfoBox={handleUpdateInfoBox}
          handleUpdateInfoBoxMultiple={handleUpdateInfoBoxMultiple}
          handleDeleteInfoBox={handleDeleteInfoBox}
          handleFileUpload={handleFileUpload}
          handleUpdateUni={handleUpdateUni}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] relative overflow-hidden">
      <style>{`
        :root {
          --primary-color: ${settings.primary_color || '#000000'};
        }
        .react-draggable-dragging {
          border: 2px dashed #60a5fa !important;
          background-color: rgba(239, 246, 255, 0.5) !important;
          opacity: 0.8;
        }
        .react-draggable-dragging > div {
          opacity: 0.5;
        }
      `}</style>
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -left-24 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <WizardHeader step={1} totalSteps={7} title={settings.site_name} transparent hideProgress />
      
      {modalsAndPanels}

      {isLoggedIn && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-wrap gap-2 w-full max-w-md justify-center px-4" dir="rtl">
          <button 
            onClick={() => {
              setIsEditMode(!isEditMode);
              setEditingBoxId(null);
            }}
            className={cn(
              "px-4 md:px-6 py-2.5 rounded-full font-bold text-white shadow-lg transition-all flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap",
              isEditMode ? "bg-red-500 hover:bg-red-600 shadow-red-500/30" : "bg-[#d946ef] hover:bg-[#c026d3] shadow-[#d946ef]/30"
            )}
          >
            {isEditMode ? "إغلاق التعديل" : "تعديل حر"}
          </button>
          <button 
            onClick={handleAddInfoBox}
            className="px-4 md:px-6 py-2.5 rounded-full font-bold text-white bg-[var(--color-primary)] hover:bg-[#14b8a6] shadow-lg shadow-[var(--color-primary)]/30 transition-all flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap"
          >
            إضافة مربع نص
          </button>
          <button 
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="px-4 md:px-6 py-2.5 rounded-full font-bold text-white bg-[#22c55e] hover:bg-[#16a34a] shadow-lg shadow-[#22c55e]/30 transition-all flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap"
          >
            تعديل بيانات الواتس
          </button>
        </div>
      )}

      <Container>
        <div className="text-center py-16 relative z-10" dir="rtl">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/50 backdrop-blur-sm border border-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 shadow-sm"
          >
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            The Best Solution
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl font-black text-slate-900 mb-4 leading-[1.1] tracking-tight"
          >
            {isEditMode ? (
              <div className="space-y-2">
                <input 
                  className="w-full bg-transparent text-center outline-none border-b-2 border-primary/20 focus:border-primary"
                  defaultValue={settings.hero_title || "Yakuwait"}
                  onBlur={(e) => handleUpdateSetting('hero_title', e.target.value)}
                />
                <input 
                  className="w-full bg-transparent text-center outline-none border-b-2 border-primary/20 focus:border-primary text-primary"
                  defaultValue={settings.hero_subtitle || "Top Solver"}
                  onBlur={(e) => handleUpdateSetting('hero_subtitle', e.target.value)}
                />
              </div>
            ) : (
              <>
                {settings.hero_title || "Yakuwait"} <br />
                <span className="text-primary">{settings.hero_subtitle || "Top Solver"}</span>
              </>
            )}
          </motion.h1>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 font-bold text-base max-w-[280px] mx-auto leading-relaxed"
          >
            {isEditMode ? (
              <textarea 
                className="w-full bg-transparent text-center outline-none border-b-2 border-primary/20 focus:border-primary min-h-[80px]"
                defaultValue={settings.hero_description || "الحل الأمثل لجميع مهامك الدراسية بأعلى جودة ودقة متناهية"}
                onBlur={(e) => handleUpdateSetting('hero_description', e.target.value)}
              />
            ) : (
              settings.hero_description || "الحل الأمثل لجميع مهامك الدراسية بأعلى جودة ودقة متناهية"
            )}
          </motion.div>

          {isEditMode && (
            <div className="mt-8 p-6 bg-white/50 backdrop-blur-sm rounded-[32px] border border-slate-100 text-right space-y-4">
              <h4 className="font-black text-slate-800 text-sm mb-2">إعدادات عامة</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">اسم الموقع</label>
                  <input 
                    className="w-full p-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    defaultValue={settings.site_name || "Yakuwait Top Solver"}
                    onBlur={(e) => handleUpdateSetting('site_name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">حجم الشعار (px)</label>
                  <input 
                    type="number"
                    className="w-full p-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    defaultValue={settings.logo_size || "56"}
                    onBlur={(e) => handleUpdateSetting('logo_size', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">اللون الأساسي</label>
                  <input 
                    type="color"
                    className="w-full h-12 p-1 bg-white border border-slate-100 rounded-xl outline-none cursor-pointer"
                    defaultValue={settings.primary_color || "#000000"}
                    onBlur={(e) => handleUpdateSetting('primary_color', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">تغيير الشعار</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 p-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-primary hover:text-primary transition-all">
                      <Upload size={20} />
                      <span className="text-sm font-bold">رفع شعار جديد</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                    {settings.logo_url && (
                      <button 
                        onClick={() => handleUpdateSetting('logo_url', '')}
                        className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10">
          <StepTitle 
            title={<UIText id="choose_uni" defaultText="اختر الجامعة" settings={settings} />}
            subtitle="يرجى اختيار جامعتك للمتابعة" 
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {unis.map((uni, idx) => (
              <motion.div
                key={uni.id}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 + 0.3 }}
                whileHover={!isEditMode ? { y: -4, scale: 1.01 } : {}}
                whileTap={!isEditMode ? { scale: 0.98 } : {}}
                onClick={() => !isEditMode && navigate(`/university/${uni.id}`)}
                className={cn(
                  "bg-white/70 backdrop-blur-md rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 flex items-center justify-between group transition-all",
                  settings.uni_card_size === 'small' ? "p-4" : settings.uni_card_size === 'large' ? "p-8" : "p-6",
                  !isEditMode && "cursor-pointer hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:border-primary/30 hover:bg-white"
                )}
              >
                <div className="flex items-center gap-5 flex-1">
                  <div className="w-14 h-14 bg-slate-50 rounded-[22px] flex items-center justify-center text-primary font-black text-xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-inner">
                    {uni.name.charAt(0)}
                  </div>
                  <div className="text-right flex-1">
                    {isEditMode ? (
                      <div className="space-y-2">
                        <input 
                          className="w-full p-2 border border-slate-100 rounded-lg text-right font-black text-lg"
                          defaultValue={uni.name}
                          onBlur={(e) => handleUpdateUni(uni.id, 'name', e.target.value)}
                        />
                        <input 
                          className="w-full p-2 border border-slate-100 rounded-lg text-right text-xs"
                          defaultValue={uni.description || ''}
                          onBlur={(e) => handleUpdateUni(uni.id, 'description', e.target.value)}
                          placeholder="وصف الجامعة..."
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-black text-slate-800 group-hover:text-primary transition-colors">{uni.name}</h3>
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{uni.description || 'Explore'}</span>
                          <div className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-[10px] text-primary/60 font-black uppercase tracking-widest">Available</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {isEditMode ? (
                  <div className="flex items-center gap-2 mr-4">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleReorderUnis('up', idx)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronUp size={16} /></button>
                      <button onClick={() => handleReorderUnis('down', idx)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronDown size={16} /></button>
                    </div>
                    <button onClick={() => handleDeleteUni(uni.id)} className="p-2.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"><Trash2 size={18} /></button>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
                    <ChevronDown className="text-slate-300 -rotate-90 group-hover:translate-x-0.5 transition-transform" size={20} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Info Boxes Section */}
          <div 
            className="mt-8 relative w-full transition-all duration-300"
            style={{ height: Math.max(400, ...infoBoxes.map(b => (b.pos_y || 0) + (b.height || 100))) + 100 }}
          >
            {infoBoxes.map((box, idx) => {
              const fontSize = parseInt(box.text_size) || 18;
              const borderRadius = parseInt(box.shape) || 16;
              const boxContent = (
                <div
                  onClick={() => {
                    if (isLoggedIn) {
                      setIsEditMode(true);
                      setEditingBoxId(box.id);
                    }
                  }}
                  className={cn(
                    "w-full h-full p-6 shadow-sm relative group overflow-hidden flex items-center justify-center transition-all duration-300",
                    box.has_3d_shadow ? 'shadow-[0_20px_40px_rgba(0,0,0,0.2)] border-b-4 border-black/10' : '',
                    editingBoxId === box.id ? 'ring-4 ring-primary ring-offset-2' : '',
                    isLoggedIn ? 'cursor-pointer' : ''
                  )}
                  style={{ 
                    backgroundColor: box.bg_color || '#ffffff',
                    borderRadius: `${borderRadius}px`
                  }}
                >
                  {isLoggedIn && isEditMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingBoxId(box.id); }}
                      className={cn(
                        "absolute top-4 right-4 z-20 p-2 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-primary hover:bg-white rounded-xl shadow-md transition-all",
                        editingBoxId === box.id ? "bg-primary text-white" : "bg-white/50"
                      )}
                    >
                      <SettingsIcon size={18} className={editingBoxId === box.id ? "animate-[spin_3s_linear_infinite]" : ""} />
                    </button>
                  )}
                  
                  <div 
                    className={cn("text-center relative z-10 leading-relaxed whitespace-pre-wrap w-full h-full flex flex-col items-center justify-center", box.is_bold ? 'font-black' : 'font-bold')}
                    style={{ 
                      color: box.text_color || '#000000', 
                      fontFamily: box.font_family || 'sans',
                      fontSize: `${fontSize}px`
                    }}
                    dir="rtl"
                  >
                    {box.title && (
                      <div className="font-black mb-2 opacity-90" style={{ fontSize: `${fontSize * 1.2}px` }}>
                        {box.title}
                      </div>
                    )}
                    <div>{box.text}</div>
                    {box.file_url && (
                      <a 
                        href={box.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-4 px-4 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={16} />
                        تحميل المرفق
                      </a>
                    )}
                  </div>
                </div>
              );

              if (isLoggedIn && isEditMode) {
                return (
                  <Rnd
                    key={box.id}
                    position={{
                      x: box.pos_x || 0,
                      y: box.pos_y || 0
                    }}
                    size={{
                      width: box.width || 300,
                      height: box.height || 100
                    }}
                    disableDragging={!isEditMode || editingBoxId !== box.id}
                    enableResizing={isEditMode && editingBoxId === box.id}
                    onDragStop={(e, d) => {
                      handleUpdateInfoBoxMultiple(box.id, { pos_x: d.x, pos_y: d.y });
                    }}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      handleUpdateInfoBoxMultiple(box.id, {
                        width: parseInt(ref.style.width),
                        height: parseInt(ref.style.height),
                        pos_x: position.x,
                        pos_y: position.y
                      });
                    }}
                    className={cn("z-10", editingBoxId === box.id ? "z-50" : "")}
                    resizeHandleStyles={{
                      bottomRight: { width: 16, height: 16, background: '#3b82f6', borderRadius: '50%', right: -8, bottom: -8, border: '2px solid white' },
                      bottomLeft: { width: 16, height: 16, background: '#3b82f6', borderRadius: '50%', left: -8, bottom: -8, border: '2px solid white' },
                      topRight: { width: 16, height: 16, background: '#3b82f6', borderRadius: '50%', right: -8, top: -8, border: '2px solid white' },
                      topLeft: { width: 16, height: 16, background: '#3b82f6', borderRadius: '50%', left: -8, top: -8, border: '2px solid white' },
                    }}
                  >
                    {boxContent}
                  </Rnd>
                );
              }

              return (
                <motion.div
                  key={box.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                  style={{
                    position: 'absolute',
                    left: box.pos_x || 0,
                    top: box.pos_y || 0,
                    width: box.width || 300,
                    height: box.height || 100,
                  }}
                >
                  {boxContent}
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-slate-300 text-[10px] font-black tracking-[0.3em] mt-20 py-8 cursor-pointer hover:text-primary transition-all uppercase flex flex-col items-center gap-2 opacity-10 hover:opacity-100"
          onClick={onOpenAdmin}
        >
          <div className="w-8 h-[1px] bg-slate-100" />
          Admin Access
        </motion.div>
      </Container>
    </div>
  );
};

const ActionModal = ({ isOpen, onClose, onNext, onEdit, title, showEdit = false }: { isOpen: boolean, onClose: () => void, onNext: () => void, onEdit: () => void, title: string, showEdit?: boolean }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="bg-white w-full max-w-[500px] rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
          dir="rtl"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={24} className="text-slate-400" />
            </button>
          </div>
          <div className={cn("grid gap-4", showEdit ? "grid-cols-2" : "grid-cols-1")}>
            <button 
              onClick={onNext}
              className="py-5 bg-primary text-white rounded-2xl font-black text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>التالي</span>
              <ArrowLeft size={20} className="rotate-180" />
            </button>
            {showEdit && (
              <button 
                onClick={onEdit}
                className="py-5 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Edit2 size={20} />
                <span>تعديل</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const SubjectSearch = ({ onOpenAdmin, isLoggedIn, showSuccess }: { onOpenAdmin: () => void, isLoggedIn: boolean, showSuccess: (msg: string) => void }) => {
  const { uniId } = useParams();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [uni, setUni] = useState<University | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const settings = useSettings();

  const fetchData = () => {
    fetch(`/api/subjects/${uniId}`).then(res => res.json()).then(setSubjects);
    fetch('/api/universities').then(res => res.json()).then(unis => {
      const found = unis.find((u: any) => u.id === Number(uniId));
      setUni(found);
    });
  };

  useEffect(() => {
    fetchData();

    const socket = io();
    socket.on('data_updated', () => {
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, [uniId]);

  const handleUpdateSubject = async (id: number, field: string, value: string) => {
    const sub = subjects.find(s => s.id === id);
    if (!sub) return;
    const updated = { ...sub, [field]: value };
    await fetch(`/api/admin/subjects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    setSubjects(prev => prev.map(s => s.id === id ? updated : s));
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleAddSubject = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSubject = {
      name: formData.get('name'),
      category: formData.get('category'),
      description: formData.get('description'),
      color: formData.get('color'),
      font: formData.get('font'),
      university_id: Number(uniId)
    };
    
    await fetch('/api/admin/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSubject)
    });
    
    fetch(`/api/subjects/${uniId}`).then(res => res.json()).then(setSubjects);
    setIsAddingSubject(false);
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const filtered = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteSelected = async () => {
    if (window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} مادة؟`)) {
      for (const id of selectedIds) {
        await fetch(`/api/admin/subjects/${id}`, { method: 'DELETE' });
      }
      fetch(`/api/subjects/${uniId}`).then(res => res.json()).then(setSubjects);
      setSelectedIds([]);
      setIsEditMode(false);
      showSuccess('تم حفظ التغييرات بنجاح ✅');
    }
  };

  if (!settings) return null;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <WizardHeader step={2} />
      <Container className="flex-1 flex flex-col overflow-hidden pb-0">
        <div className="flex-none">
          <StepTitle 
            title={<UIText id="choose_subject" defaultText="اختر المادة" settings={settings} />}
            subtitle={uni?.name} 
            onBack={() => navigate('/')} 
          >
            {isLoggedIn && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsAddingSubject(true)}
                  className="px-3 sm:px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1 sm:gap-2"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">إضافة مادة</span>
                </button>
                <button 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={cn(
                    "px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all",
                    isEditMode ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                  )}
                >
                  {isEditMode ? "إلغاء التعديل" : "تعديل"}
                </button>
              </div>
            )}
          </StepTitle>
          
          <div className="relative mb-6" dir="rtl">
            <label className="block text-slate-400 text-sm font-bold mb-2 mr-1">البحث عن المواد</label>
            <div className="relative">
              <input
                type="text"
                placeholder="اكتب اسم أو رمز المادة..."
                className="w-full pl-6 pr-14 py-4.5 rounded-2xl border-2 border-primary/20 focus:border-primary outline-none text-right text-lg font-medium placeholder:text-slate-300 transition-all shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={22} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((sub, idx) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => {
                  if (isEditMode) {
                    setSelectedIds(prev => prev.includes(sub.id) ? prev.filter(id => id !== sub.id) : [...prev, sub.id]);
                  } else if (isLoggedIn) {
                    setSelectedSubject(sub);
                  } else {
                    navigate(`/subject/${sub.id}`);
                  }
                }}
                className={cn(
                  "bg-white text-right border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100",
                  settings.subject_card_size === 'small' ? "p-3 rounded-xl" : settings.subject_card_size === 'large' ? "p-8 rounded-3xl" : "p-5 rounded-2xl",
                  selectedIds.includes(sub.id) && "bg-red-50 border-red-200"
                )}
              >
                <div className="flex justify-between items-center">
                  <div className="text-left flex items-center gap-3">
                    {isEditMode ? (
                      <div className={cn(
                        "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                        selectedIds.includes(sub.id) ? "bg-red-500 border-red-500" : "border-slate-200 bg-white"
                      )}>
                        {selectedIds.includes(sub.id) && <Check size={16} className="text-white" />}
                      </div>
                    ) : (
                      <ChevronDown className="-rotate-90 text-slate-200" size={18} />
                    )}
                  </div>
                  <div className="flex-1">
                    {isEditMode ? (
                      <div className="space-y-2">
                        <input 
                          className="w-full p-2 border border-slate-200 rounded-lg text-right font-bold"
                          value={sub.name}
                          onChange={(e) => handleUpdateSubject(sub.id, 'name', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <input 
                          className="w-full p-2 border border-slate-200 rounded-lg text-right text-xs"
                          value={sub.category}
                          onChange={(e) => handleUpdateSubject(sub.id, 'category', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-lg font-bold text-slate-800 mb-1" style={{ fontFamily: sub.font }}>{sub.name}</h3>
                        <div className="flex items-center justify-end gap-2 text-xs font-bold text-slate-400">
                          <span>{sub.category}</span>
                          <span className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-primary/60">خطة متاحة</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="p-12 text-center text-slate-400 font-bold">
                لا توجد مواد تطابق بحثك
              </div>
            )}
          </div>
        </div>

        {isEditMode && selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[400px] px-5"
          >
            <button 
              onClick={handleDeleteSelected}
              className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-red-500/20 flex items-center justify-center gap-2"
            >
              <Trash2 size={20} />
              <span>حذف {selectedIds.length} مادة</span>
            </button>
          </motion.div>
        )}

        <ActionModal 
          isOpen={!!selectedSubject}
          onClose={() => setSelectedSubject(null)}
          title={selectedSubject?.name || ''}
          showEdit={isLoggedIn}
          onNext={() => {
            navigate(`/subject/${selectedSubject?.id}`);
            setSelectedSubject(null);
          }}
          onEdit={() => {
            onOpenAdmin();
            setSelectedSubject(null);
          }}
        />

        <AnimatePresence>
          {isAddingSubject && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
                dir="rtl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800">إضافة مادة جديدة</h3>
                  <button onClick={() => setIsAddingSubject(false)} className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddSubject} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">اسم المادة</label>
                    <input name="name" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">التصنيف</label>
                    <input name="category" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">الوصف</label>
                    <input name="description" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">اللون</label>
                      <input name="color" type="color" defaultValue="#000000" className="w-full h-12 rounded-2xl cursor-pointer border-none p-0" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">الخط</label>
                      <input name="font" placeholder="Arial, sans-serif" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 mt-4">إضافة المادة</button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </Container>
    </div>
  );
};

const PlanList = ({ onOpenAdmin, isLoggedIn, showSuccess }: { onOpenAdmin: () => void, isLoggedIn: boolean, showSuccess: (msg: string) => void }) => {
  const { subId } = useParams();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const settings = useSettings();

  const fetchData = () => {
    fetch(`/api/plans/${subId}`).then(res => res.json()).then(setPlans);
    fetch('/api/admin/all-subjects').then(res => res.json()).then(subs => {
      const found = subs.find((s: any) => s.id === Number(subId));
      setSubject(found);
    });
  };

  useEffect(() => {
    fetchData();

    const socket = io();
    socket.on('data_updated', () => {
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, [subId]);

  const handleUpdatePlan = async (id: number, field: string, value: string | number) => {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    const updated = { ...plan, [field]: value };
    await fetch(`/api/admin/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    setPlans(prev => prev.map(p => p.id === id ? updated : p));
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleAddPlan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newPlan = {
      name: formData.get('name'),
      price: Number(formData.get('price')),
      features: formData.get('features'),
      outputs: formData.get('outputs'),
      outputs_label: formData.get('outputs_label'),
      delivery_date: formData.get('delivery_date'),
      subject_id: Number(subId)
    };
    
    await fetch('/api/admin/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPlan)
    });
    
    fetch(`/api/plans/${subId}`).then(res => res.json()).then(setPlans);
    setIsAddingPlan(false);
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} خطة؟`)) {
      for (const id of selectedIds) {
        await fetch(`/api/admin/plans/${id}`, { method: 'DELETE' });
      }
      fetch(`/api/plans/${subId}`).then(res => res.json()).then(setPlans);
      setSelectedIds([]);
      setIsEditMode(false);
      showSuccess('تم حفظ التغييرات بنجاح ✅');
    }
  };

  if (!settings) return null;

  return (
    <div className="h-screen flex flex-col bg-slate-50/50 overflow-hidden">
      <WizardHeader step={3} />
      <Container className="flex-1 flex flex-col overflow-hidden pb-0">
        <div className="flex-none">
          <StepTitle 
            title={<UIText id="choose_plan" defaultText="اختر الخطة" settings={settings} />}
            subtitle={subject?.name} 
            onBack={() => window.history.back()} 
          >
            {isLoggedIn && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsAddingPlan(true)}
                  className="px-3 sm:px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1 sm:gap-2"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">إضافة خطة</span>
                </button>
                <button 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={cn(
                    "px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all",
                    isEditMode ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                  )}
                >
                  {isEditMode ? "إلغاء التعديل" : "تعديل"}
                </button>
              </div>
            )}
          </StepTitle>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <motion.div 
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  if (isEditMode) {
                    setSelectedIds(prev => prev.includes(plan.id) ? prev.filter(id => id !== plan.id) : [...prev, plan.id]);
                  } else if (isLoggedIn) {
                    setSelectedPlan(plan);
                  } else {
                    navigate(`/preview/${plan.id}`);
                  }
                }}
                className={cn(
                  "bg-white shadow-sm border border-slate-100 relative overflow-hidden cursor-pointer transition-all",
                  settings.plan_card_size === 'small' ? "rounded-2xl p-4" : settings.plan_card_size === 'large' ? "rounded-[32px] p-8" : "rounded-3xl p-6",
                  selectedIds.includes(plan.id) && "border-red-500 bg-red-50"
                )}
                dir="rtl"
              >
                {isEditMode && (
                  <div className="absolute top-4 left-4">
                    <div className={cn(
                      "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                      selectedIds.includes(plan.id) ? "bg-red-500 border-red-500" : "border-slate-200 bg-white"
                    )}>
                      {selectedIds.includes(plan.id) && <Check size={16} className="text-white" />}
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-start mb-6">
                  <div className="text-right flex-1">
                    {isEditMode ? (
                      <div className="space-y-2">
                        <input 
                          className="w-full p-2 border border-slate-200 rounded-lg text-right font-black text-xl"
                          defaultValue={plan.name}
                          onBlur={(e) => handleUpdatePlan(plan.id, 'name', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <input 
                          className="w-32 p-2 border border-slate-200 rounded-lg text-right text-xs font-bold bg-purple-50 text-purple-600"
                          defaultValue={plan.label || 'مشروع'}
                          onBlur={(e) => handleUpdatePlan(plan.id, 'label', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className={cn("font-black text-slate-800 mb-2", settings.plan_card_size === 'small' ? "text-lg" : "text-xl")} style={{ fontFamily: plan.font }}>{plan.name}</h3>
                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-600 rounded-lg text-xs font-bold">{plan.label || 'مشروع'}</span>
                      </>
                    )}
                  </div>
                  <div className="text-left">
                    {isEditMode ? (
                      <div className="flex items-center gap-1">
                        <input 
                          type="number"
                          className="w-20 p-2 border border-slate-200 rounded-lg text-left font-black text-xl text-emerald-500"
                          defaultValue={plan.price}
                          onBlur={(e) => handleUpdatePlan(plan.id, 'price', Number(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-emerald-500 font-bold text-sm">KWD</span>
                      </div>
                    ) : (
                      <>
                        <span className={cn("font-black text-emerald-500", settings.plan_card_size === 'small' ? "text-xl" : "text-2xl")}>{plan.price}</span>
                        <span className="text-emerald-500 font-bold text-sm mr-1">KWD</span>
                      </>
                    )}
                  </div>
                </div>

                {isEditMode ? (
                  <textarea 
                    className="w-full p-4 border border-slate-200 rounded-2xl text-right text-sm font-medium mb-4 min-h-[100px]"
                    defaultValue={plan.description || ''}
                    onBlur={(e) => handleUpdatePlan(plan.id, 'description', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="وصف الخطة..."
                  />
                ) : (
                  <p className="text-slate-500 text-sm leading-relaxed mb-4 font-medium">
                    {plan.description || subject?.description || `تفاصيل الخطة المتاحة لهذه المادة تشمل كافة المتطلبات و${plan.outputs_label || 'المخرجات'} المتوقعة.`}
                  </p>
                )}

                <div className="flex justify-between items-center mb-8 text-xs text-slate-400">
                  <span>{plan.outputs_label || 'المخرجات'}</span>
                  {isEditMode ? (
                    <input 
                      type="date"
                      className="p-1 border border-slate-200 rounded text-right text-xs"
                      defaultValue={plan.delivery_date || ''}
                      onBlur={(e) => handleUpdatePlan(plan.id, 'delivery_date', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : plan.delivery_date ? (
                    <span>تاريخ التسليم: {new Date(plan.delivery_date).toLocaleDateString('ar-KW')}</span>
                  ) : null}
                </div>

                <button
                  className="w-full py-4 rounded-2xl border-2 border-slate-200 font-black text-slate-600 hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-[0.98]"
                >
                  اختر الخطة
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {isEditMode && selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[400px] px-5"
          >
            <button 
              onClick={handleDeleteSelected}
              className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-red-500/20 flex items-center justify-center gap-2"
            >
              <Trash2 size={20} />
              <span>حذف {selectedIds.length} خطة</span>
            </button>
          </motion.div>
        )}

        <ActionModal 
          isOpen={!!selectedPlan}
          onClose={() => setSelectedPlan(null)}
          title={selectedPlan?.name || ''}
          showEdit={isLoggedIn}
          onNext={() => {
            navigate(`/preview/${selectedPlan?.id}`);
            setSelectedPlan(null);
          }}
          onEdit={() => {
            onOpenAdmin();
            setSelectedPlan(null);
          }}
        />

        <AnimatePresence>
          {isAddingPlan && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
                dir="rtl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800">إضافة خطة جديدة</h3>
                  <button onClick={() => setIsAddingPlan(false)} className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddPlan} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">اسم الخطة</label>
                    <input name="name" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">السعر</label>
                    <input name="price" type="number" step="0.01" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">المميزات (JSON)</label>
                    <input name="features" defaultValue='["ميزة 1", "ميزة 2"]' className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" placeholder='["Item 1", "Item 2"]' />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">المخرجات (JSON)</label>
                    <input name="outputs" defaultValue='["مخرج 1", "مخرج 2"]' className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" placeholder='["Item 1", "Item 2"]' />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">تسمية المخرجات (اختياري)</label>
                    <input name="outputs_label" defaultValue='المخرجات' className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" placeholder='المخرجات' />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">تاريخ التسليم (اختياري)</label>
                    <input name="delivery_date" type="date" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" />
                  </div>
                  <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 mt-4">إضافة الخطة</button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </Container>
    </div>
  );
};

const Preview = ({ onOpenAdmin, isLoggedIn, showSuccess }: { onOpenAdmin: () => void, isLoggedIn: boolean, showSuccess: (msg: string) => void }) => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newOutput, setNewOutput] = useState('');
  const [previewStep, setPreviewStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const settings = useSettings();

  const fetchData = () => {
    fetch(`/api/plan/${planId}`).then(res => res.json()).then(setPlan);
  };

  useEffect(() => {
    fetchData();

    const socket = io();
    socket.on('data_updated', () => {
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, [planId]);

  if (!plan || !settings) return null;

  const outputs = plan.outputs ? JSON.parse(plan.outputs) : ['PD1', 'PD2'];

  const steps = [];
  if (plan.sample || isLoggedIn) steps.push('sample');
  steps.push('delivery');
  if (outputs.length > 0 || isLoggedIn) steps.push('outputs');
  steps.push('confirm');

  const currentStepName = steps[previewStep];
  const wizardStep = 3 + previewStep + 1;
  const totalWizardSteps = 3 + steps.length;

  const handleNext = () => {
    if (previewStep < steps.length - 1) {
      setPreviewStep(prev => prev + 1);
    } else {
      handleApprove();
    }
  };

  const handleBack = () => {
    if (previewStep > 0) {
      setPreviewStep(prev => prev - 1);
    } else {
      window.history.back();
    }
  };

  const handleApprove = () => {
    const outputsText = outputs.length > 0 ? `\n${plan.outputs_label || 'المخرجات'}: ${selectedOutputs.join(', ')}` : '';
    const dateText = selectedDate ? `\nتاريخ التسليم المطلوب: ${selectedDate}` : '';
    const text = `${settings.whatsapp_prefix}\nالمادة: ${plan.subject_name}\nالخطة: ${plan.name}${outputsText}${dateText}`;
    const url = `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleUpdatePlan = async (field: string, value: string | number) => {
    const updated = { ...plan, [field]: value };
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    setPlan(updated);
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const toggleOutput = (out: string) => {
    setSelectedOutputs(prev => 
      prev.includes(out) ? prev.filter(o => o !== out) : [...prev, out]
    );
  };

  const addOutput = async () => {
    if (!newOutput) return;
    const currentOutputs = plan.outputs ? JSON.parse(plan.outputs) : ['PD1', 'PD2'];
    const updated = [...currentOutputs, newOutput];
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...plan, outputs: JSON.stringify(updated) })
    });
    setPlan({ ...plan, outputs: JSON.stringify(updated) });
    setNewOutput('');
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const deleteOutput = async (out: string) => {
    const currentOutputs = plan.outputs ? JSON.parse(plan.outputs) : ['PD1', 'PD2'];
    const updated = currentOutputs.filter((o: string) => o !== out);
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...plan, outputs: JSON.stringify(updated) })
    });
    setPlan({ ...plan, outputs: JSON.stringify(updated) });
    setSelectedOutputs(prev => prev.filter(o => o !== out));
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50/50 overflow-hidden">
      <WizardHeader step={wizardStep} totalSteps={totalWizardSteps} />
      <Container className="flex-1 flex flex-col overflow-hidden pb-0">
        <div className="flex-none">
          <StepTitle 
            title={
              currentStepName === 'sample' ? <UIText id="work_sample" defaultText="نموذج العمل" settings={settings} /> :
              currentStepName === 'delivery' ? <UIText id="delivery_date" defaultText="مدة التسليم" settings={settings} /> :
              currentStepName === 'outputs' ? <UIText id="work_outputs" defaultText={plan.outputs_label || 'المخرجات'} settings={settings} /> :
              <UIText id="confirm_order" defaultText="تأكيد الطلب" settings={settings} />
            } 
            subtitle={plan.subject_name} 
            onBack={handleBack} 
          >
            {isLoggedIn && currentStepName !== 'confirm' && (
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(
                  "px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all",
                  isEditMode ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                )}
              >
                {isEditMode ? "إلغاء التعديل" : "تعديل"}
              </button>
            )}
          </StepTitle>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
          <motion.div 
            key={currentStepName}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={cn(
              "bg-white shadow-sm border border-slate-100 mb-6",
              settings.plan_card_size === 'small' ? "rounded-2xl p-4" : settings.plan_card_size === 'large' ? "rounded-[32px] p-8" : "rounded-3xl p-6"
            )}
            dir="rtl"
          >
            <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
              <div className="text-right flex-1">
                {isEditMode ? (
                  <div className="space-y-2">
                    <input 
                      className="w-full p-2 border border-slate-200 rounded-lg text-right font-black text-xl"
                      defaultValue={plan.name}
                      onBlur={(e) => handleUpdatePlan('name', e.target.value)}
                    />
                    <input 
                      className="w-32 p-2 border border-slate-200 rounded-lg text-right text-xs font-bold bg-purple-50 text-purple-600"
                      defaultValue={plan.label || 'مشروع'}
                      onBlur={(e) => handleUpdatePlan('label', e.target.value)}
                    />
                  </div>
                ) : (
                  <>
                    <h3 className={cn("font-black text-slate-800 mb-1", settings.plan_card_size === 'small' ? "text-lg" : "text-xl")}>{plan.name}</h3>
                    <span className="inline-block px-3 py-1 bg-purple-100 text-purple-600 rounded-lg text-xs font-bold">{plan.label || 'مشروع'}</span>
                  </>
                )}
              </div>
              <div className="text-left">
                {isEditMode ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="number"
                      className="w-20 p-2 border border-slate-200 rounded-lg text-left font-black text-xl text-emerald-500"
                      defaultValue={plan.price}
                      onBlur={(e) => handleUpdatePlan('price', Number(e.target.value))}
                    />
                    <span className="text-emerald-500 font-bold text-sm">KWD</span>
                  </div>
                ) : (
                  <>
                    <span className={cn("font-black text-emerald-500", settings.plan_card_size === 'small' ? "text-xl" : "text-2xl")}>{plan.price}</span>
                    <span className="text-emerald-500 font-bold text-sm mr-1">KWD</span>
                  </>
                )}
              </div>
            </div>

            {currentStepName === 'sample' && (
              <div>
                {isEditMode ? (
                  <textarea 
                    className="w-full p-4 border border-slate-200 rounded-2xl text-right text-sm font-medium mb-6 min-h-[100px]"
                    defaultValue={plan.description || ''}
                    onBlur={(e) => handleUpdatePlan('description', e.target.value)}
                    placeholder="وصف الخطة..."
                  />
                ) : (
                  <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
                    {plan.description || `تأكد من مراجعة عينة الملف قبل الاستمرار.`}
                  </p>
                )}

                <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <Upload size={20} />
                    </div>
                    <div className="text-right flex-1">
                      {isEditMode ? (
                        <div className="space-y-2">
                          <input 
                            className="w-full p-1 border border-slate-200 rounded text-right font-black text-md"
                            defaultValue={plan.sample_title || 'نموذج العمل'}
                            onBlur={(e) => handleUpdatePlan('sample_title', e.target.value)}
                          />
                          <input 
                            className="w-full p-1 border border-slate-200 rounded text-right text-xs font-bold"
                            defaultValue={plan.sample_subtitle || 'استعراض أو تحميل النموذج المعتمد'}
                            onBlur={(e) => handleUpdatePlan('sample_subtitle', e.target.value)}
                          />
                        </div>
                      ) : (
                        <>
                          <h3 className="text-md font-black text-slate-800">{plan.sample_title || 'نموذج العمل'}</h3>
                          <p className="text-slate-400 text-xs font-bold">
                            {isLoggedIn ? "إدارة نموذج العمل (للمشرف)" : (plan.sample_subtitle || 'استعراض أو تحميل النموذج المعتمد')}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {plan.sample && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button 
                          onClick={() => setShowModal(true)}
                          className="flex-1 py-3.5 bg-white border border-slate-200 rounded-xl font-black text-slate-600 text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                        >
                          <Eye size={18} />
                          <span>عرض النموذج</span>
                        </button>
                        <a 
                          href={plan.sample.file_path}
                          download
                          className="flex-1 py-3.5 bg-primary text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/10 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                          <Download size={18} />
                          <span>تحميل الملف</span>
                        </a>
                      </div>
                    )}

                    {isLoggedIn && (
                      <div className={cn("p-4 bg-white rounded-xl border border-dashed border-slate-200", plan.sample && "mt-2")}>
                        <label className="block text-[10px] font-black text-slate-400 mb-2 mr-1 uppercase tracking-wider">
                          {plan.sample ? "تحديث النموذج الحالي:" : "رفع نموذج جديد:"}
                        </label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('plan_id', String(plan.id));
                            const res = await fetch('/api/admin/samples', { method: 'POST', body: formData });
                            if (res.ok) {
                              alert('تم رفع العينة بنجاح!');
                              fetch(`/api/plan/${plan.id}`).then(res => res.json()).then(setPlan);
                            }
                          }}
                          className="w-full text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentStepName === 'delivery' && (
              <div className="py-4">
                <h4 className="font-black text-slate-800 mb-4 text-lg">حدد تاريخ التسليم المطلوب:</h4>
                <p className="text-slate-500 text-sm mb-6">الرجاء اختيار التاريخ الذي ترغب باستلام العمل فيه.</p>
                <input 
                  type="date"
                  className="w-full p-4 border-2 border-slate-200 rounded-2xl text-right font-bold text-slate-700 outline-none focus:border-primary transition-colors"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

            {currentStepName === 'outputs' && (
              <div className="py-2">
                {isEditMode ? (
                  <div className="flex items-center gap-2 mb-6">
                    <span className="font-black text-slate-800">اختر</span>
                    <input
                      defaultValue={plan.outputs_label || 'المخرجات'}
                      onBlur={(e) => handleUpdatePlan('outputs_label', e.target.value)}
                      className="font-black text-slate-800 bg-transparent border-b border-slate-300 outline-none w-32 px-1"
                      placeholder="المخرجات"
                    />
                    <span className="font-black text-slate-800">:</span>
                  </div>
                ) : (
                  <h4 className="font-black text-slate-800 mb-6 text-lg">اختر {plan.outputs_label || 'المخرجات'}:</h4>
                )}
                <div className="space-y-4">
                  {outputs.map((out: string) => (
                    <div key={out} className="flex items-center justify-between group p-4 rounded-2xl border border-slate-100 hover:border-primary/30 transition-all cursor-pointer" onClick={() => !isEditMode && toggleOutput(out)}>
                      <span className="font-bold text-slate-600 group-hover:text-primary transition-colors">{out}</span>
                      <div className="flex items-center gap-2">
                        {isEditMode && (
                          <button onClick={(e) => { e.stopPropagation(); deleteOutput(out); }} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                            <Trash2 size={18} />
                          </button>
                        )}
                        <div 
                          className={cn(
                            "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                            selectedOutputs.includes(out) ? "bg-primary border-primary" : "border-slate-200 bg-white",
                            isEditMode && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {selectedOutputs.includes(out) && <Check size={16} className="text-white" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isEditMode && (
                    <div className="flex gap-2 mt-6">
                      <input 
                        type="text" 
                        placeholder="مخرج جديد..." 
                        className="flex-1 p-4 border border-slate-200 rounded-xl outline-none text-sm font-bold"
                        value={newOutput}
                        onChange={e => setNewOutput(e.target.value)}
                      />
                      <button onClick={addOutput} className="bg-primary text-white px-6 rounded-xl font-bold hover:bg-primary/90 transition-colors">
                        إضافة
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStepName === 'confirm' && (
              <div className="py-2 space-y-4">
                <h4 className="font-black text-slate-800 mb-6 text-lg text-center">ملخص الطلب</h4>
                
                <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold text-sm">الخطة</span>
                    <span className="font-black text-slate-800">{plan.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold text-sm">السعر</span>
                    <span className="font-black text-emerald-500">{plan.price} KWD</span>
                  </div>
                  {selectedDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold text-sm">تاريخ التسليم</span>
                      <span className="font-black text-slate-800">{new Date(selectedDate).toLocaleDateString('ar-KW')}</span>
                    </div>
                  )}
                  {selectedOutputs.length > 0 && (
                    <div className="flex justify-between items-start">
                      <span className="text-slate-500 font-bold text-sm">{plan.outputs_label || 'المخرجات'}</span>
                      <div className="flex flex-col items-end gap-1">
                        {selectedOutputs.map(out => (
                          <span key={out} className="font-black text-slate-800 text-sm bg-white px-2 py-1 rounded-md border border-slate-100">{out}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </motion.div>
        </div>

        <div className="flex-none pt-4 pb-6 bg-slate-50/50">
          <div className="flex gap-3" dir="rtl">
            <button 
              onClick={handleNext}
              disabled={currentStepName === 'outputs' && outputs.length > 0 && selectedOutputs.length === 0}
              className={cn(
                "flex-1 py-5 rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-white",
                (currentStepName !== 'outputs' || outputs.length === 0 || selectedOutputs.length > 0) ? "bg-emerald-500 shadow-emerald-500/20" : "bg-slate-200 shadow-none cursor-not-allowed"
              )}
            >
              {currentStepName === 'confirm' ? (
                <UIText id="whatsapp_btn" defaultText={settings?.whatsapp_button_text || 'اطلب عبر واتساب'} settings={settings} />
              ) : (
                <UIText id="continue_btn" defaultText="استمرار" settings={settings} />
              )}
              {currentStepName !== 'confirm' && <ArrowLeft size={20} className="rotate-180" />}
            </button>
            <div className="bg-primary text-white px-6 py-5 rounded-2xl font-black text-lg flex items-center justify-center shadow-lg shadow-primary/20">
              محدد
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                dir="rtl"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                  <h3 className="text-lg font-black text-slate-800">نموذج {plan.name}</h3>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>
                
                <div className="flex-1 bg-slate-50 relative overflow-hidden flex items-center justify-center min-h-[300px]">
                  {plan.sample ? (
                    plan.sample.file_type === 'pdf' ? (
                      <iframe src={plan.sample.file_path} className="w-full h-full border-none" title="Sample PDF" />
                    ) : (
                      <img src={plan.sample.file_path} alt="Sample" className="max-w-full max-h-full object-contain p-4" referrerPolicy="no-referrer" />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                      <p className="font-bold">جاري تحميل الملف...</p>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-white border-t border-slate-100 text-center">
                  <h4 className="text-xl font-black text-slate-800 mb-2">هل يتطابق هذا النموذج مع مهمتك؟</h4>
                  <button 
                    onClick={() => plan.sample && window.open(plan.sample.file_path, '_blank')}
                    className="text-primary font-bold text-sm underline mb-8 block"
                  >
                    فتح في نافذة جديدة
                  </button>
                  
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowModal(false)}
                      className="flex-1 bg-emerald-500 text-white py-4.5 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                      نعم، أؤكد
                    </button>
                    <button 
                      onClick={() => setShowModal(false)}
                      className="flex-1 bg-white border-2 border-slate-100 text-slate-400 py-4.5 rounded-2xl font-black text-lg active:scale-95 transition-all"
                    >
                      لا، اختر غيرها
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </Container>
    </div>
  );
};

// --- Admin Panel ---

const AdminPanel = ({ onClose, showSuccess }: { onClose: () => void, showSuccess: (msg: string) => void }) => {
  const [activeMenu, setActiveMenu] = useState<'edit' | 'add' | 'map' | 'texts' | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [unis, setUnis] = useState<University[]>([]);
  const [subjects, setSubjects] = useState<(Subject & { university_name: string })[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const navigate = useNavigate();

  const refreshData = () => {
    fetch('/api/settings').then(res => res.json()).then(setSettings);
    fetch('/api/universities').then(res => res.json()).then(setUnis);
    fetch('/api/admin/all-subjects').then(res => res.json()).then(setSubjects);
  };

  useEffect(() => {
    refreshData();

    const socket = io();
    socket.on('data_updated', () => {
      refreshData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const updateSettings = async (updates: Partial<Settings>) => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    setSettings(prev => prev ? { ...prev, ...updates } : null);
    showSuccess('تم حفظ التغييرات بنجاح ✅');
    // Reload to apply primary color if changed
    if (updates.primary_color) window.location.reload();
  };

  const reorderSubjects = async (index: number, direction: 'up' | 'down') => {
    const newSubjects = [...subjects];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSubjects.length) return;
    
    [newSubjects[index], newSubjects[targetIndex]] = [newSubjects[targetIndex], newSubjects[index]];
    setSubjects(newSubjects);
    
    await fetch('/api/admin/reorder-subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newSubjects.map(s => s.id) })
    });
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  const reorderPlans = async (index: number, direction: 'up' | 'down') => {
    const newPlans = [...plans];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPlans.length) return;
    
    [newPlans[index], newPlans[targetIndex]] = [newPlans[targetIndex], newPlans[index]];
    setPlans(newPlans);
    
    await fetch('/api/admin/reorder-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newPlans.map(p => p.id) })
    });
    showSuccess('تم حفظ التغييرات بنجاح ✅');
  };

  return (
    <div className="py-4">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-xl font-bold text-slate-800">لوحة التحكم</h3>
        <button onClick={onClose} className="text-slate-400"><X size={24} /></button>
      </div>

      {settings && (
        <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-800">وضع العرض</h4>
            <p className="text-xs text-slate-500 mt-1">اختر بين الخريطة والبطاقات</p>
          </div>
          <div className="flex bg-slate-200 p-1 rounded-xl">
            <button
              onClick={() => updateSettings({ layout_mode: 'card' })}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", settings.layout_mode !== 'map' && settings.layout_mode !== 'vip' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              بطاقات
            </button>
            <button
              onClick={() => updateSettings({ layout_mode: 'map' })}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", settings.layout_mode === 'map' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              خريطة
            </button>
            <button
              onClick={() => updateSettings({ layout_mode: 'vip' })}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", settings.layout_mode === 'vip' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              VIP
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <button 
          onClick={() => {
            setActiveMenu(activeMenu === 'edit' ? null : 'edit');
            setEditingSubject(null);
          }}
          className={cn("py-4.5 rounded-[20px] font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2", activeMenu === 'edit' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-slate-100 text-slate-600 border border-slate-200")}
        >
          <SettingsIcon size={16} /> ⚙️ إدارة المواد
        </button>
        <button 
          onClick={() => {
            setActiveMenu(activeMenu === 'add' ? null : 'add');
            setEditingSubject(null);
          }}
          className={cn("py-4.5 rounded-[20px] font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2", activeMenu === 'add' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-slate-100 text-slate-600 border border-slate-200")}
        >
          <Plus size={16} /> ➕ إضافة جديد
        </button>
        <button 
          onClick={() => {
            setActiveMenu(activeMenu === 'map' ? null : 'map');
            setEditingSubject(null);
          }}
          className={cn("py-4.5 rounded-[20px] font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2", activeMenu === 'map' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-slate-100 text-slate-600 border border-slate-200")}
        >
          🎨 إعدادات الخريطة
        </button>
        <button 
          onClick={() => {
            setActiveMenu(activeMenu === 'texts' ? null : 'texts');
            setEditingSubject(null);
          }}
          className={cn("py-4.5 rounded-[20px] font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2", activeMenu === 'texts' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-slate-100 text-slate-600 border border-slate-200")}
        >
          📝 نصوص الواجهة
        </button>
      </div>

      <AnimatePresence>
        {activeMenu === 'texts' && settings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-4 mb-8"
          >
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
              <h4 className="font-bold text-sm text-slate-400 mb-4">تعديل نصوص الواجهة</h4>
              
              {[
                { id: 'choose_uni', label: 'عنوان اختيار الجامعة', default: 'اختر الجامعة' },
                { id: 'choose_subject', label: 'عنوان اختيار المادة', default: 'اختر المادة' },
                { id: 'choose_plan', label: 'عنوان اختيار الخطة', default: 'اختر الخطة' },
                { id: 'work_sample', label: 'عنوان نموذج العمل', default: 'نموذج العمل' },
                { id: 'delivery_date', label: 'عنوان مدة التسليم', default: 'مدة التسليم' },
                { id: 'work_outputs', label: 'عنوان مخرجات العمل', default: 'المخرجات' },
                { id: 'confirm_order', label: 'عنوان تأكيد الطلب', default: 'تأكيد الطلب' },
                { id: 'continue_btn', label: 'زر الاستمرار', default: 'استمرار' },
                { id: 'whatsapp_btn', label: 'زر الواتساب', default: settings.whatsapp_button_text || 'اطلب عبر واتساب' }
              ].map(item => {
                const uiTexts = settings.ui_texts ? JSON.parse(settings.ui_texts) : {};
                return (
                  <div key={item.id} className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500">{item.label}</label>
                    <input 
                      type="text"
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary bg-white text-sm"
                      defaultValue={uiTexts[item.id] || item.default}
                      onBlur={(e) => {
                        const newTexts = { ...uiTexts, [item.id]: e.target.value };
                        updateSettings({ ui_texts: JSON.stringify(newTexts) });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeMenu === 'map' && settings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-4 mb-8"
          >
            <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
              <h4 className="font-black text-slate-800 text-sm mb-4">تخصيص الخريطة</h4>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">عنوان الخريطة</label>
                <input 
                  className="w-full p-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  defaultValue={settings.map_title || "Yakuwait Top Solver"}
                  onBlur={(e) => updateSettings({ map_title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">نوع الخط</label>
                <select 
                  className="w-full p-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  defaultValue={settings.map_font_family || "Tajawal"}
                  onChange={(e) => updateSettings({ map_font_family: e.target.value })}
                >
                  <option value="Tajawal">Tajawal</option>
                  <option value="Cairo">Cairo</option>
                  <option value="Inter">Inter</option>
                  <option value="sans-serif">Sans Serif</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">لون حدود الخريطة</label>
                  <input 
                    type="color"
                    className="w-full h-12 rounded-xl cursor-pointer border-none p-0"
                    defaultValue={settings.map_border_color || "#06b6d4"}
                    onBlur={(e) => updateSettings({ map_border_color: e.target.value, primary_color: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">لون تعبئة الخريطة</label>
                  <input 
                    type="text"
                    className="w-full p-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    defaultValue={settings.map_fill_color || "rgba(6, 182, 212, 0.05)"}
                    onBlur={(e) => updateSettings({ map_fill_color: e.target.value })}
                    placeholder="rgba(0,0,0,0.5) أو #hex"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">لون الخلفية</label>
                <input 
                  type="color"
                  className="w-full h-12 rounded-xl cursor-pointer border-none p-0"
                  defaultValue={settings.map_bg_color || "#050510"}
                  onBlur={(e) => updateSettings({ map_bg_color: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="text-sm font-bold text-slate-700">تفعيل وضع 3D</label>
                <button 
                  onClick={() => updateSettings({ map_is_3d: settings.map_is_3d === 'true' ? 'false' : 'true' })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    settings.map_is_3d === 'true' ? "bg-primary" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-white rounded-full absolute top-1 transition-transform",
                    settings.map_is_3d === 'true' ? "left-1" : "right-1"
                  )} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeMenu === 'add' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3 mb-8"
          >
            <button onClick={() => setEditingSubject({ id: 0 } as any)} className="w-full text-right py-4.5 px-6 hover:bg-slate-50 rounded-[22px] text-sm font-bold text-slate-600 border border-slate-100 transition-all active:scale-[0.99] flex items-center justify-between">
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
              <span>إضافة مادة جديدة</span>
            </button>
            <button onClick={() => {
              const val = window.prompt("أدخل اسم الجامعة الجديدة:");
              if(val) {
                fetch('/api/admin/universities', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: val })
                }).then(() => refreshData());
              }
            }} className="w-full text-right py-4.5 px-6 hover:bg-slate-50 rounded-[22px] text-sm font-bold text-slate-600 border border-slate-100 transition-all active:scale-[0.99] flex items-center justify-between">
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
              <span>إضافة جامعة جديدة</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {activeMenu === 'edit' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-sm text-slate-400">إدارة المواد والخطط</h4>
            <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
              {subjects.length} مادة
            </div>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {subjects.map((sub, idx) => (
              <div key={sub.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm hover:border-primary/30 transition-colors">
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => reorderSubjects(idx, 'up')} disabled={idx === 0} className="p-1 hover:bg-white rounded border disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={() => reorderSubjects(idx, 'down')} disabled={idx === subjects.length - 1} className="p-1 hover:bg-white rounded border disabled:opacity-30"><ChevronDown size={14} /></button>
                  </div>
                  <button onClick={() => {
                    setEditingSubject(sub);
                    fetch(`/api/plans/${sub.id}`).then(res => res.json()).then(setPlans);
                  }} className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-primary hover:border-primary transition-all"><Edit2 size={16} /></button>
                  <button onClick={async () => {
                    if(window.confirm('هل أنت متأكد من حذف هذه المادة وجميع خططها؟')) {
                      await fetch(`/api/admin/subjects/${sub.id}`, { method: 'DELETE' });
                      refreshData();
                    }
                  }} className="p-2.5 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-slate-800">{sub.name}</div>
                  <div className="text-[10px] text-slate-400 font-medium">{sub.university_name}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-3">
             <h4 className="font-bold text-sm text-slate-400 text-right mb-2">إعدادات الموقع</h4>
             <button onClick={() => {
              const val = window.prompt("أدخل اسم الموقع الجديد:", settings?.site_name || "");
              if (val !== null) updateSettings({ site_name: val });
            }} className="w-full text-right py-4 px-6 hover:bg-slate-50 rounded-2xl text-sm font-bold text-slate-600 border border-slate-100 flex items-center justify-between">
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
              <span>تعديل اسم الموقع</span>
            </button>
            <button onClick={() => {
              const color = window.prompt("أدخل كود اللون الأساسي (مثال: #2563eb):", settings?.primary_color || "");
              if (color !== null) updateSettings({ primary_color: color });
            }} className="w-full text-right py-4 px-6 hover:bg-slate-50 rounded-2xl text-sm font-bold text-slate-600 border border-slate-100 flex items-center justify-between">
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
              <span>تعديل اللون الأساسي</span>
            </button>
            <button onClick={() => {
              const num = window.prompt("أدخل رقم الواتساب الجديد:", settings?.whatsapp_number || "");
              const msg = window.prompt("أدخل وصف البداية:", settings?.whatsapp_prefix || "");
              const btnText = window.prompt("أدخل نص زر الواتساب:", settings?.whatsapp_button_text || "اطلب عبر واتساب");
              if (num !== null || msg !== null || btnText !== null) {
                updateSettings({ 
                  whatsapp_number: num !== null ? num : (settings?.whatsapp_number || ""), 
                  whatsapp_prefix: msg !== null ? msg : (settings?.whatsapp_prefix || ""),
                  whatsapp_button_text: btnText !== null ? btnText : (settings?.whatsapp_button_text || "")
                });
              }
            }} className="w-full text-right py-4 px-6 hover:bg-slate-50 rounded-2xl text-sm font-bold text-slate-600 border border-slate-100 flex items-center justify-between">
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
              <span>تعديل بيانات التواصل</span>
            </button>
            <button onClick={() => {
              const sizes = ['small', 'medium', 'large'];
              const current = settings?.uni_card_size || 'medium';
              const nextSize = sizes[(sizes.indexOf(current) + 1) % sizes.length];
              updateSettings({ uni_card_size: nextSize });
            }} className="w-full text-right py-4 px-6 hover:bg-slate-50 rounded-2xl text-sm font-bold text-slate-600 border border-slate-100 flex items-center justify-between">
              <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-500">
                {settings?.uni_card_size === 'small' ? 'صغير' : settings?.uni_card_size === 'large' ? 'كبير' : 'متوسط'}
              </span>
              <span>حجم مربعات الجامعات</span>
            </button>
            <button onClick={() => {
              const sizes = ['small', 'medium', 'large'];
              const current = settings?.subject_card_size || 'medium';
              const nextSize = sizes[(sizes.indexOf(current) + 1) % sizes.length];
              updateSettings({ subject_card_size: nextSize });
            }} className="w-full text-right py-4 px-6 hover:bg-slate-50 rounded-2xl text-sm font-bold text-slate-600 border border-slate-100 flex items-center justify-between">
              <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-500">
                {settings?.subject_card_size === 'small' ? 'صغير' : settings?.subject_card_size === 'large' ? 'كبير' : 'متوسط'}
              </span>
              <span>حجم مربعات المواد</span>
            </button>
            <button onClick={() => {
              const sizes = ['small', 'medium', 'large'];
              const current = settings?.plan_card_size || 'medium';
              const nextSize = sizes[(sizes.indexOf(current) + 1) % sizes.length];
              updateSettings({ plan_card_size: nextSize });
            }} className="w-full text-right py-4 px-6 hover:bg-slate-50 rounded-2xl text-sm font-bold text-slate-600 border border-slate-100 flex items-center justify-between">
              <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-500">
                {settings?.plan_card_size === 'small' ? 'صغير' : settings?.plan_card_size === 'large' ? 'كبير' : 'متوسط'}
              </span>
              <span>حجم مربعات الخطط</span>
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingSubject && editingSubject.id >= 0 && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-[110]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-slate-800">{editingSubject.id === 0 ? 'إضافة مادة' : 'تعديل مادة'}</h3>
                <button onClick={() => setEditingSubject(null)} className="text-slate-400"><X size={24} /></button>
              </div>
              <form className="space-y-5" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = Object.fromEntries(formData.entries());
                const method = editingSubject.id === 0 ? 'POST' : 'PUT';
                const url = editingSubject.id === 0 ? '/api/admin/subjects' : `/api/admin/subjects/${editingSubject.id}`;
                await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data)
                });
                refreshData();
                setEditingSubject(null);
                showSuccess('تم حفظ التغييرات بنجاح ✅');
              }}>
                {editingSubject.id === 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">الجامعة</label>
                    <select name="university_id" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50">
                      {unis.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">اسم المادة</label>
                  <input name="name" defaultValue={editingSubject.name} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">التصنيف</label>
                  <input name="category" defaultValue={editingSubject.category} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">الوصف</label>
                  <input name="description" defaultValue={editingSubject.description} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">اللون</label>
                    <input name="color" type="color" defaultValue={editingSubject.color || '#000000'} className="w-full h-12 rounded-2xl cursor-pointer border-none p-0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">الخط</label>
                    <input name="font" defaultValue={editingSubject.font} placeholder="Arial, sans-serif" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20">حفظ التغييرات</button>
              </form>

              {editingSubject.id > 0 && (
                <div className="mt-10 border-t border-slate-100 pt-8">
                  <div className="flex justify-between items-center mb-6">
                    <button onClick={() => setEditingPlan({ id: 0, subject_id: editingSubject.id } as any)} className="bg-emerald-500 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/20"><Plus size={18} /></button>
                    <h4 className="font-bold text-slate-800">الخطط المتاحة لهذه المادة</h4>
                  </div>
                  <div className="space-y-3">
                    {plans.map((p, pIdx) => (
                      <div key={p.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <div className="flex gap-2">
                          <div className="flex flex-col gap-1">
                            <button onClick={() => reorderPlans(pIdx, 'up')} disabled={pIdx === 0} className="p-1 hover:bg-white rounded border disabled:opacity-30"><ChevronUp size={12} /></button>
                            <button onClick={() => reorderPlans(pIdx, 'down')} disabled={pIdx === plans.length - 1} className="p-1 hover:bg-white rounded border disabled:opacity-30"><ChevronDown size={12} /></button>
                          </div>
                          <button onClick={() => setEditingPlan(p)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600"><Edit2 size={14} /></button>
                          <button onClick={async () => {
                            if(window.confirm('حذف الخطة؟')) {
                              await fetch(`/api/admin/plans/${p.id}`, { method: 'DELETE' });
                              fetch(`/api/plans/${editingSubject.id}`).then(res => res.json()).then(setPlans);
                              showSuccess('تم حفظ التغييرات بنجاح ✅');
                            }
                          }} className="p-2 bg-red-50 text-red-500 border border-red-100 rounded-xl"><Trash2 size={14} /></button>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm text-slate-800">{p.name}</div>
                          <div className="text-[10px] text-emerald-500 font-bold">{p.price} KD</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {editingPlan && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-[120]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-slate-800">{editingPlan.id === 0 ? 'إضافة خطة' : 'تعديل خطة'}</h3>
                <button onClick={() => setEditingPlan(null)} className="text-slate-400"><X size={24} /></button>
              </div>
              <form className="space-y-5" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = Object.fromEntries(formData.entries());
                const method = editingPlan.id === 0 ? 'POST' : 'PUT';
                const url = editingPlan.id === 0 ? '/api/admin/plans' : `/api/admin/plans/${editingPlan.id}`;
                await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...data, subject_id: editingPlan.subject_id })
                });
                fetch(`/api/plans/${editingPlan.subject_id}`).then(res => res.json()).then(setPlans);
                setEditingPlan(null);
                showSuccess('تم حفظ التغييرات بنجاح ✅');
              }}>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">اسم الخطة</label>
                  <input name="name" defaultValue={editingPlan.name} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">نوع العمل (مثال: مشروع، واجب)</label>
                  <input name="label" defaultValue={editingPlan.label || 'مشروع'} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">الوصف</label>
                  <textarea name="description" defaultValue={editingPlan.description} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50 min-h-[100px]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">السعر (KD)</label>
                  <input name="price" type="number" step="0.01" defaultValue={editingPlan.price} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">اللون</label>
                    <input name="color" type="color" defaultValue={editingPlan.color || '#000000'} className="w-full h-12 rounded-2xl cursor-pointer border-none p-0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">الخط</label>
                    <input name="font" defaultValue={editingPlan.font} placeholder="Arial, sans-serif" className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">المخرجات (JSON)</label>
                  <input name="outputs" defaultValue={editingPlan.outputs || '["PD1", "PD2"]'} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" placeholder='["Item 1", "Item 2"]' />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">تسمية المخرجات (اختياري)</label>
                  <input name="outputs_label" defaultValue={editingPlan.outputs_label || 'المخرجات'} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" placeholder='المخرجات' />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">تاريخ التسليم (اختياري)</label>
                  <input name="delivery_date" defaultValue={editingPlan.delivery_date || ''} className="w-full p-4 border border-slate-100 rounded-2xl outline-none bg-slate-50" placeholder='مثال: 2024-05-20 أو "خلال يومين"' />
                </div>
                <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20">حفظ الخطة</button>
              </form>

              {editingPlan.id > 0 && (
                <div className="mt-8 border-t border-slate-100 pt-8">
                  <label className="block text-xs font-bold text-slate-400 mb-4 mr-1">رفع عينة (PDF أو صورة)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('plan_id', String(editingPlan.id));
                        await fetch('/api/admin/samples', { method: 'POST', body: formData });
                        showSuccess('تم رفع العينة بنجاح ✅');
                      }}
                      className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isAdmin') === 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const settings = useSettings();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  useEffect(() => {
    if (settings?.primary_color) {
      document.documentElement.style.setProperty('--primary-color', settings.primary_color);
    }
  }, [settings?.primary_color]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success) {
      setIsLoggedIn(true);
      localStorage.setItem('isAdmin', 'true');
    }
    else alert('بيانات خاطئة!');
  };

  return (
    <BrowserRouter>
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-[9999] bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            dir="rtl"
          >
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <Routes>
        <Route path="/" element={<Home onOpenAdmin={() => setIsAdminOpen(true)} isLoggedIn={isLoggedIn} showSuccess={showSuccess} />} />
        <Route path="/university/:uniId" element={<SubjectSearch onOpenAdmin={() => setIsAdminOpen(true)} isLoggedIn={isLoggedIn} showSuccess={showSuccess} />} />
        <Route path="/subject/:subId" element={<PlanList onOpenAdmin={() => setIsAdminOpen(true)} isLoggedIn={isLoggedIn} showSuccess={showSuccess} />} />
        <Route path="/preview/:planId" element={<Preview onOpenAdmin={() => setIsAdminOpen(true)} isLoggedIn={isLoggedIn} showSuccess={showSuccess} />} />
      </Routes>

      <AnimatePresence>
        {isAdminOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="admin-panel-slide w-full max-w-[500px] relative max-h-[90vh] overflow-y-auto custom-scrollbar bg-white rounded-t-[40px] sm:rounded-[40px] p-6 sm:p-8"
              dir="rtl"
            >
              {!isLoggedIn ? (
                <div className="py-4">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-bold text-slate-800">تسجيل دخول المشرف</h3>
                    <button onClick={() => setIsAdminOpen(false)} className="text-slate-400"><X size={24} /></button>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">البريد الإلكتروني</label>
                      <input
                        type="email"
                        className="w-full p-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary bg-slate-50"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">كلمة المرور</label>
                      <input
                        type="password"
                        className="w-full p-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary bg-slate-50"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20">دخول</button>
                  </form>
                </div>
              ) : (
                <AdminPanel onClose={() => setIsAdminOpen(false)} showSuccess={showSuccess} />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </BrowserRouter>
  );
}
