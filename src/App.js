import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  serverTimestamp,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  Building2, 
  TrendingUp, 
  Trash2, 
  Briefcase,
  Users,
  Plus, 
  Tag as TagIcon,
  Fuel,
  Package,
  Wrench,
  FileText,
  Banknote,
  Gem,
  PieChart,
  HandCoins,
  RotateCcw,
  Download,
  Upload,
  ShieldCheck,
  LogOut,
  AlertCircle,
  X,
  Search,
  Calendar,
  Edit2,
  Filter
} from 'lucide-react';

// --- TWOJA KONFIGURACJA FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAr_avRX_H4TKcIVQ2g2E57VH42k5KvPb4",
  authDomain: "rozliczenia-bb311.firebaseapp.com",
  projectId: "rozliczenia-bb311",
  storageBucket: "rozliczenia-bb311.firebasestorage.app",
  messagingSenderId: "368403149682",
  appId: "1:368403149682:web:31d02662801b55db7763eb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "finanse-firmowe-v6"; 

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard'); 
  const [activeTab, setActiveTab] = useState('income'); 
  const [transactions, setTransactions] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [authError, setAuthError] = useState(null);
  const fileInputRef = useRef(null);

  // Filtrowanie
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, month, year

  // Edycja
  const [editingTransaction, setEditingTransaction] = useState(null);
  
  const [formData, setFormData] = useState({
    client: '',
    description: '',
    amount: '',
    person: 'Adam',
    isCompanyFunds: true 
  });

  const staff = ['Adam', 'Mateusz'];
  const quickTagsIncome = [{ name: 'Zaliczka', icon: <Banknote size={12} />, color: '#10b981' }];
  const quickTagsExpense = [
    { name: 'Materiały', icon: <Package size={12} />, color: '#3b82f6' }, 
    { name: 'Paliwo', icon: <Fuel size={12} />, color: '#f59e0b' },      
    { name: 'Usługi', icon: <Briefcase size={12} />, color: '#06b6d4' },  
    { name: 'Wypłata', icon: <HandCoins size={12} />, color: '#10b981' }, 
    { name: 'Inwestycja', icon: <Gem size={12} />, color: '#8b5cf6' },    
    { name: 'Akcesoria', icon: <Wrench size={12} />, color: '#64748b' },  
    { name: 'Faktura', icon: <FileText size={12} />, color: '#6366f1' }   
  ];

  const getCategoryIcon = (description) => {
    const allTags = [...quickTagsIncome, ...quickTagsExpense];
    const tag = allTags.find(t => t.name.toLowerCase() === description.toLowerCase());
    if (tag) return React.cloneElement(tag.icon, { color: tag.color });
    return <TagIcon size={12} className="text-slate-300" />;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubTrans = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });
    const unsubClients = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(data.sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => { unsubTrans(); unsubClients(); };
  }, [user]);

  const loginWithGoogle = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (err) { setAuthError("Błąd logowania."); }
  };

  const handleAddOrEdit = async (e) => {
    e.preventDefault();
    if (!user || !formData.client || !formData.amount || !formData.description) return;
    
    const descLower = formData.description.toLowerCase();
    const data = {
      client: formData.client,
      description: formData.description,
      amount: parseFloat(formData.amount),
      type: activeTab,
      timestamp: editingTransaction ? editingTransaction.timestamp : serverTimestamp(),
      userId: user.uid,
      status: (activeTab === 'expense' && !formData.isCompanyFunds && !['inwestycja', 'wypłata'].includes(descLower)) ? 'pending' : 'settled',
      person: (activeTab === 'income') ? 'Firma' : (formData.isCompanyFunds ? 'Firma' : formData.person)
    };

    try {
      if (editingTransaction) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', editingTransaction.id), data);
        setEditingTransaction(null);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), data);
        if (!clients.some(c => c.name.toLowerCase() === formData.client.toLowerCase())) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), { name: formData.client, createdAt: serverTimestamp() });
        }
      }
      setFormData({ client: '', description: '', amount: '', person: 'Adam', isCompanyFunds: true });
      setIsAddingNewClient(false);
    } catch (err) { console.error(err); }
  };

  const startEdit = (item) => {
    setEditingTransaction(item);
    setActiveTab(item.type);
    setFormData({
      client: item.client,
      description: item.description,
      amount: item.amount.toString(),
      person: item.person === 'Firma' ? 'Adam' : item.person,
      isCompanyFunds: item.person === 'Firma'
    });
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Logika filtrowania
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.client.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (dateFilter === 'all') return true;
      const date = t.timestamp?.toDate ? t.timestamp.toDate() : new Date();
      const now = new Date();
      if (dateFilter === 'today') return date.toDateString() === now.toDateString();
      if (dateFilter === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      if (dateFilter === 'year') return date.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, searchTerm, dateFilter]);

  const stats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const settledCashOut = transactions.filter(t => t.type === 'expense' && t.status === 'settled' && t.description.toLowerCase() !== 'inwestycja').reduce((acc, curr) => acc + curr.amount, 0);
    const pendingDebts = { 
      Adam: transactions.filter(t => t.person === 'Adam' && t.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0),
      Mateusz: transactions.filter(t => t.person === 'Mateusz' && t.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0)
    };
    const clientSummary = transactions.reduce((acc, t) => {
      if (!acc[t.client]) acc[t.client] = { income: 0, expense: 0 };
      if (t.type === 'income') acc[t.client].income += t.amount;
      else if (t.description.toLowerCase() !== 'inwestycja') acc[t.client].expense += t.amount;
      return acc;
    }, {});
    const operatingExpenses = transactions.filter(t => t.type === 'expense' && !['inwestycja', 'wypłata'].includes(t.description.toLowerCase())).reduce((acc, curr) => acc + curr.amount, 0);
    
    return { 
      availableBalance: totalIncome - settledCashOut, 
      totalIncome, 
      pendingDebts, 
      clientSummary,
      historicalProfit: totalIncome - operatingExpenses,
      payouts: {
        Adam: transactions.filter(t => t.person === 'Adam' && t.description.toLowerCase() === 'wypłata').reduce((acc, curr) => acc + curr.amount, 0),
        Mateusz: transactions.filter(t => t.person === 'Mateusz' && t.description.toLowerCase() === 'wypłata').reduce((acc, curr) => acc + curr.amount, 0)
      }
    };
  }, [transactions]);

  if (!user && !loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-2xl p-10 text-center space-y-8 border border-slate-100">
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto shadow-indigo-200 shadow-2xl rotate-3"><Building2 size={40} /></div>
          <div><h2 className="text-3xl font-black text-slate-800 tracking-tight">Finanse Firmowe</h2><p className="text-slate-500 mt-2 font-medium">Bezpieczny system rozliczeń.</p></div>
          <button onClick={loginWithGoogle} className="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-3 font-bold text-slate-700 hover:bg-slate-50 transition-all hover:scale-[1.02] active:scale-95 shadow-sm"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="G" />Zaloguj przez Google</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex flex-col items-center justify-center bg-slate-50 font-black text-indigo-600 animate-pulse text-lg tracking-widest"><Building2 size={48} className="mb-4" /> WCZYTYWANIE...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans antialiased text-left">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100"><Building2 size={20} /></div>
            <h1 className="text-xl font-black tracking-tighter uppercase text-slate-800">System <span className="text-indigo-600">Rozliczeń</span></h1>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setView('dashboard')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${view === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Panel Główny</button>
              <button onClick={() => setView('report')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${view === 'report' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Analiza i Raport</button>
            </nav>
            <button onClick={() => signOut(auth)} className="p-2.5 text-slate-400 hover:text-red-500 bg-slate-50 rounded-xl transition-colors"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Lewy Panel - Statystyki i Formularz */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-slate-800 group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-600/30 transition-all"></div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Dostępny kapitał</p>
                <h2 className="text-4xl font-black mb-6 tracking-tight tabular-nums">{stats.availableBalance.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} <span className="text-xs font-medium text-slate-500 ml-1">PLN</span></h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                    <p className="text-[9px] uppercase font-black text-orange-400 mb-1">Mateusz (pend.)</p>
                    <p className="text-lg font-black tabular-nums">{stats.pendingDebts.Mateusz.toFixed(0)}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                    <p className="text-[9px] uppercase font-black text-orange-400 mb-1">Adam (pend.)</p>
                    <p className="text-lg font-black tabular-nums">{stats.pendingDebts.Adam.toFixed(0)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden border-b-4 border-b-indigo-600">
                <div className="flex p-1 bg-slate-50 border-b">
                  <button onClick={() => { setActiveTab('income'); setEditingTransaction(null); }} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>Nowa Wpłata</button>
                  <button onClick={() => { setActiveTab('expense'); setEditingTransaction(null); }} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>Nowy Koszt</button>
                </div>
                <form onSubmit={handleAddOrEdit} className="p-8 space-y-6">
                  {editingTransaction && (
                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2"><Edit2 size={12}/> Tryb Edycji</span>
                      <button onClick={() => {setEditingTransaction(null); setFormData({client:'', description:'', amount:'', person:'Adam', isCompanyFunds:true});}} className="text-indigo-400 hover:text-indigo-600"><X size={14}/></button>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Klient / Projekt</label>
                        <div className="flex gap-2">
                          {isAddingNewClient ? (
                            <input autoFocus className="flex-1 px-4 py-3 text-sm rounded-xl border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Nazwa..." value={formData.client} onChange={(e) => setFormData({...formData, client: e.target.value})} />
                          ) : (
                            <select className="flex-1 px-4 py-3 text-sm rounded-xl border border-slate-200 outline-none bg-white font-bold text-slate-700 focus:border-indigo-500" value={formData.client} onChange={(e) => setFormData({...formData, client: e.target.value})} required>
                              <option value="">Wybierz...</option>
                              {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                          )}
                          <button type="button" onClick={() => setIsAddingNewClient(!isAddingNewClient)} className="p-3 rounded-xl bg-slate-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"><Plus size={18} /></button>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Kto płacił?</label>
                        {activeTab === 'income' ? (
                          <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 font-bold text-xs"><Building2 size={16} /> Przelew na Firmę</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                              <button type="button" onClick={() => setFormData({...formData, isCompanyFunds: true})} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${formData.isCompanyFunds ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>Firmowe</button>
                              <button type="button" onClick={() => setFormData({...formData, isCompanyFunds: false})} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${!formData.isCompanyFunds ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500'}`}>Prywatne</button>
                            </div>
                            {!formData.isCompanyFunds && (
                              <div className="flex gap-1 p-1 bg-orange-50 rounded-xl border border-orange-100 animate-in fade-in zoom-in-95">
                                {staff.map(name => (
                                  <button key={name} type="button" onClick={() => setFormData({...formData, person: name})} className={`flex-1 py-1 rounded-lg text-[10px] font-black ${formData.person === name ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-300'}`}>{name}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Kategoria i Opis</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(activeTab === 'income' ? quickTagsIncome : quickTagsExpense).map(tag => (
                          <button key={tag.name} type="button" onClick={() => setFormData({...formData, description: tag.name})} className={`px-3 py-1.5 rounded-xl text-[10px] font-black border flex items-center gap-2 transition-all ${formData.description === tag.name ? 'bg-slate-800 border-slate-800 text-white scale-105' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}>{tag.icon} {tag.name}</button>
                        ))}
                      </div>
                      <input className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium" placeholder="Szczegóły transakcji..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Wartość</label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <input type="number" step="0.01" className="w-full pl-4 pr-12 py-4 rounded-2xl border-2 border-slate-100 font-black text-2xl bg-slate-50/50 outline-none focus:border-indigo-500 transition-all tracking-tight" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300 text-sm">PLN</span>
                        </div>
                        <button type="submit" className={`px-8 rounded-2xl text-white font-black text-xs uppercase shadow-xl transition-all hover:scale-[1.03] active:scale-95 ${activeTab === 'income' ? 'bg-green-600 shadow-green-100' : 'bg-red-600 shadow-red-100'}`}>
                          {editingTransaction ? 'Zapisz' : 'Dodaj'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Prawy Panel - Filtrowanie i Lista */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl border-none outline-none text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="Szukaj klienta lub opisu..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
                  <button onClick={() => setDateFilter('all')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${dateFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Wszystko</button>
                  <button onClick={() => setDateFilter('today')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${dateFilter === 'today' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Dziś</button>
                  <button onClick={() => setDateFilter('month')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${dateFilter === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Miesiąc</button>
                </div>
              </div>

              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredTransactions.length > 0 ? filteredTransactions.map((item) => (
                  <div key={item.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-5 min-w-0">
                      <div className={`p-4 rounded-2xl shrink-0 transition-transform group-hover:rotate-6 ${item.type === 'income' ? 'bg-green-50 text-green-600' : (item.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-400')}`}>
                        {item.type === 'income' ? <TrendingUp size={22} /> : (item.status === 'pending' ? <RotateCcw size={22} /> : <CheckCircle2 size={22} />)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-sm text-slate-800 truncate">{item.client}</span>
                          <span className={`text-[8px] px-2 py-0.5 rounded-lg font-black uppercase ${item.person === 'Firma' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-700'}`}>{item.person}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate uppercase font-bold">{getCategoryIcon(item.description)} {item.description}</p>
                          <span className="text-[10px] text-slate-300 font-medium flex items-center gap-1"><Calendar size={10}/> {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString('pl-PL') : '...'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className={`font-black text-lg tracking-tight tabular-nums ${item.type === 'income' ? 'text-green-600' : (item.status === 'pending' ? 'text-orange-600' : 'text-slate-400')}`}>
                          {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex gap-2 justify-end mt-1">
                          {item.status === 'pending' && (
                            <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', item.id), { status: 'settled' })} className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-lg uppercase shadow-sm hover:bg-indigo-700 transition-colors">Rozlicz</button>
                          )}
                          <button onClick={() => startEdit(item)} className="p-2 text-slate-300 hover:text-indigo-600 bg-slate-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Edit2 size={14} /></button>
                          <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', item.id))} className="p-2 text-slate-300 hover:text-red-500 bg-slate-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><Search size={32}/></div>
                    <p className="font-bold text-slate-400 uppercase text-xs tracking-widest">Brak wyników dla tych filtrów</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* WIDOK RAPORTU */
          <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-green-100 transition-colors group-hover:text-green-200"><TrendingUp size={48}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Przychody</p>
                <p className="text-3xl font-black text-green-600 tabular-nums">+{stats.totalIncome.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-red-100 transition-colors group-hover:text-red-200"><RotateCcw size={48}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Wydatki</p>
                <p className="text-3xl font-black text-red-500 tabular-nums">-{ (stats.totalIncome - stats.historicalProfit).toLocaleString()}</p>
              </div>
              <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-100 md:col-span-2 flex flex-col justify-center">
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">Zysk Netto Firmy</p>
                <p className="text-4xl font-black tabular-nums">{stats.historicalProfit.toLocaleString('pl-PL')} PLN</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-emerald-600 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-100">
                <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-3"><HandCoins size={20} /> Wypłaty Własne</h3>
                <div className="grid grid-cols-2 gap-6 text-center">
                  <div className="bg-white/10 rounded-2xl p-6 border border-white/10 backdrop-blur-md">
                    <p className="text-[10px] font-black text-emerald-100 uppercase mb-2">Adam</p>
                    <p className="text-3xl font-black tabular-nums">{stats.payouts.Adam.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-6 border border-white/10 backdrop-blur-md">
                    <p className="text-[10px] font-black text-emerald-100 uppercase mb-2">Mateusz</p>
                    <p className="text-3xl font-black tabular-nums">{stats.payouts.Mateusz.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] p-8 flex flex-col justify-center items-center text-center">
                <ShieldCheck size={48} className="text-indigo-600 mb-4" />
                <h3 className="text-lg font-black text-slate-800 mb-2">Zarządzanie Danymi</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mb-6 tracking-wider">Bezpieczna Kopia Zapasowa</p>
                <div className="flex gap-4">
                  <button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase hover:bg-slate-700 transition-all"><Download size={16}/> Eksport JSON</button>
                  <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl font-black text-xs uppercase hover:border-indigo-600 transition-all shadow-sm"><Upload size={16}/> Import danych</button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                </div>
                {importStatus && <p className="mt-4 text-xs font-black text-indigo-600 animate-bounce">{importStatus}</p>}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3"><PieChart size={18} className="text-indigo-600" /> Analiza Rentowności Projektów</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b">
                    <tr>
                      <th className="px-8 py-4">Nazwa Projektu</th>
                      <th className="px-8 py-4 text-center">Całkowity Przychód</th>
                      <th className="px-8 py-4 text-center">Koszty Operacyjne</th>
                      <th className="px-8 py-4 text-right">Zysk z Projektu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(stats.clientSummary).map(([name, data]) => (
                      <tr key={name} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5 font-black text-slate-800">{name}</td>
                        <td className="px-8 py-5 text-center text-green-600 font-bold">+{data.income.toLocaleString()}</td>
                        <td className="px-8 py-5 text-center text-red-400">-{data.expense.toLocaleString()}</td>
                        <td className={`px-8 py-5 text-right font-black tabular-nums ${(data.income - data.expense) >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                          {(data.income - data.expense).toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default App;
