import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  CheckCircle2,
  UserCircle
} from 'lucide-react';

// --- KONFIGURACJA DOSTĘPU ---
const ALLOWED_EMAILS = ["mateukokaczmarczyk@gmail.com"];

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
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard'); 
  const [activeTab, setActiveTab] = useState('income'); 
  const [transactions, setTransactions] = useState([]);
  const [clients, setClients] = useState([]);
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [authError, setAuthError] = useState(null);
  const fileInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('all'); 
  const [dateFilter, setDateFilter] = useState('all'); 
  const [editingTransaction, setEditingTransaction] = useState(null);
  
  const [formData, setFormData] = useState({
    client: '',
    description: '',
    amount: '',
    person: 'Adam',
    isCompanyFunds: true 
  });

  const staff = ['Adam', 'Mateusz'];
  const quickTagsIncome = [{ name: 'Zaliczka', icon: <Banknote size={18} />, color: '#10b981' }];
  const quickTagsExpense = [
    { name: 'Materiały', icon: <Package size={18} />, color: '#3b82f6' }, 
    { name: 'Paliwo', icon: <Fuel size={18} />, color: '#f59e0b' },      
    { name: 'Usługi', icon: <Briefcase size={18} />, color: '#06b6d4' },  
    { name: 'Wypłata', icon: <HandCoins size={18} />, color: '#10b981' }, 
    { name: 'Inwestycja', icon: <Gem size={18} />, color: '#8b5cf6' },    
    { name: 'Akcesoria', icon: <Wrench size={18} />, color: '#64748b' },  
    { name: 'Faktura', icon: <FileText size={18} />, color: '#6366f1' }   
  ];

  // --- FUNKCJE ---

  const handleExport = useCallback(() => {
    const backupData = {
      appId,
      exportedAt: new Date().toISOString(),
      clients: clients.map(({id, ...rest}) => rest),
      transactions: transactions.map(({id, ...rest}) => rest)
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [clients, transactions]);

  const handleImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setImportStatus("Importowanie...");
        for (const client of data.clients) {
          if (!clients.some(c => c.name === client.name)) {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), { ...client, createdAt: serverTimestamp() });
          }
        }
        for (const trans of data.transactions) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { ...trans, timestamp: serverTimestamp() });
        }
        setImportStatus("Zakończono!");
        setTimeout(() => setImportStatus(null), 3000);
      } catch (err) { setImportStatus("Błąd pliku!"); }
    };
    reader.readAsText(file);
  }, [clients, user]);

  const loginWithGoogle = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try { 
      const result = await signInWithPopup(auth, provider);
      if (!ALLOWED_EMAILS.includes(result.user.email)) {
        await signOut(auth);
        setAuthError(`Adres ${result.user.email} nie posiada uprawnień.`);
      }
    } catch (err) { setAuthError("Błąd logowania przez Google."); }
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

  const getCategoryIcon = (description) => {
    const allTags = [...quickTagsIncome, ...quickTagsExpense];
    const tag = allTags.find(t => t.name.toLowerCase() === description.toLowerCase());
    if (tag) return React.cloneElement(tag.icon, { color: tag.color });
    return <TagIcon size={18} className="text-slate-300" />;
  };

  // --- HOOKI ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { 
      if (u && !ALLOWED_EMAILS.includes(u.email)) {
        signOut(auth);
        setAuthError(`Adres ${u.email} nie ma uprawnień.`);
        setUser(null);
      } else { setUser(u); }
      setLoading(false); 
    });
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.client.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = clientFilter === 'all' || t.client === clientFilter;
      
      if (!matchesSearch || !matchesClient) return false;
      
      if (dateFilter === 'all') return true;
      const date = t.timestamp?.toDate ? t.timestamp.toDate() : new Date();
      const now = new Date();
      if (dateFilter === 'today') return date.toDateString() === now.toDateString();
      if (dateFilter === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, searchTerm, dateFilter, clientFilter]);

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
      totalIncome, pendingDebts, clientSummary, historicalProfit: totalIncome - operatingExpenses,
      payouts: {
        Adam: transactions.filter(t => t.person === 'Adam' && t.description.toLowerCase() === 'wypłata').reduce((acc, curr) => acc + curr.amount, 0),
        Mateusz: transactions.filter(t => t.person === 'Mateusz' && t.description.toLowerCase() === 'wypłata').reduce((acc, curr) => acc + curr.amount, 0)
      }
    };
  }, [transactions]);

  // --- RENDERING ---

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 font-black text-indigo-600 animate-pulse uppercase tracking-widest text-sm">Trwa ładowanie...</div>;

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center space-y-8 border border-slate-100">
          <div className="bg-indigo-600 w-24 h-24 rounded-[1.5rem] flex items-center justify-center text-white mx-auto shadow-indigo-100 shadow-2xl rotate-3"><Building2 size={48} /></div>
          <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">System Finansowy</h2><p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-widest text-indigo-600">Autoryzacja Google</p></div>
          {authError && <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 text-left animate-in fade-in slide-in-from-top-2"><AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} /><p className="text-xs text-red-600 font-bold leading-relaxed">{authError}</p></div>}
          <button onClick={loginWithGoogle} className="w-full py-5 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-4 font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="G" /> Zaloguj się przez Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-10 font-sans antialiased text-left">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/80">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-100"><Building2 size={24} /></div>
            <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-800">System <span className="text-indigo-600">Rozliczeń</span></h1>
          </div>
          <div className="flex items-center gap-8">
            <nav className="flex bg-slate-100 p-1.5 rounded-2xl">
              <button onClick={() => setView('dashboard')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${view === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Panel Główny</button>
              <button onClick={() => setView('report')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${view === 'report' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Raport i Statystyki</button>
            </nav>
            <div className="flex items-center gap-6 pl-8 border-l border-slate-200">
               <div className="hidden xl:block text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Użytkownik:</p>
                 <p className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{user.email}</p>
               </div>
               <button onClick={() => signOut(auth)} className="p-3 text-slate-400 hover:text-red-500 bg-slate-50 rounded-2xl transition-colors"><LogOut size={24} /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 mt-10">
        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 text-left">
            {/* KOLUMNA LEWA: FORMULARZ (4/12) */}
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/20 rounded-full -mr-24 -mt-24 blur-3xl"></div>
                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">Dostępny kapitał (Gotówka)</p>
                <h2 className="text-5xl font-black mb-8 tracking-tight tabular-nums">{stats.availableBalance.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} <span className="text-base font-medium text-slate-500 ml-1">PLN</span></h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/5 backdrop-blur-sm">
                    <p className="text-[10px] uppercase font-black text-orange-400 mb-1">Mateusz (pend.)</p>
                    <p className="text-2xl font-black tabular-nums">{stats.pendingDebts.Mateusz.toFixed(0)} zł</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/5 backdrop-blur-sm">
                    <p className="text-[10px] uppercase font-black text-orange-400 mb-1">Adam (pend.)</p>
                    <p className="text-2xl font-black tabular-nums">{stats.pendingDebts.Adam.toFixed(0)} zł</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden border-b-8 border-b-indigo-600">
                <div className="flex p-2 bg-slate-50 border-b">
                  <button onClick={() => { setActiveTab('income'); setEditingTransaction(null); }} className={`flex-1 py-5 rounded-2xl text-sm font-black uppercase transition-all ${activeTab === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>+ Dodaj Wpłatę</button>
                  <button onClick={() => { setActiveTab('expense'); setEditingTransaction(null); }} className={`flex-1 py-5 rounded-2xl text-sm font-black uppercase transition-all ${activeTab === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>- Dodaj Koszt</button>
                </div>
                <form onSubmit={handleAddOrEdit} className="p-10 space-y-8">
                  {editingTransaction && (
                    <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex items-center justify-between">
                      <span className="text-sm font-black text-indigo-600 uppercase flex items-center gap-3"><Edit2 size={18}/> Tryb Edycji</span>
                      <button type="button" onClick={() => {setEditingTransaction(null); setFormData({client:'', description:'', amount:'', person:'Adam', isCompanyFunds:true});}} className="text-indigo-400 hover:text-indigo-600"><X size={24}/></button>
                    </div>
                  )}
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Klient / Projekt</label>
                      <div className="flex gap-3 items-stretch">
                        {isAddingNewClient ? (
                          <input autoFocus className="flex-1 px-5 py-4 text-lg rounded-2xl border border-indigo-200 outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="Nazwa..." value={formData.client} onChange={(e) => setFormData({...formData, client: e.target.value})} />
                        ) : (
                          <select className="flex-1 px-5 py-4 text-lg rounded-2xl border border-slate-200 outline-none bg-white font-black text-slate-700 focus:ring-4 focus:ring-indigo-500/10 appearance-none cursor-pointer transition-all" value={formData.client} onChange={(e) => setFormData({...formData, client: e.target.value})} required>
                            <option value="">Wybierz klienta...</option>
                            {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        )}
                        <button type="button" onClick={() => setIsAddingNewClient(!isAddingNewClient)} className="px-5 rounded-2xl bg-slate-100 text-indigo-600 border border-slate-200 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><Plus size={28} /></button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Konto / Osoba</label>
                      {activeTab === 'income' ? (
                        <div className="flex items-center gap-5 px-6 py-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 font-black text-sm uppercase shadow-inner w-full"><Building2 size={28} className="shrink-0" /> <span>Konto Firmowe</span></div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                            <button type="button" onClick={() => setFormData({...formData, isCompanyFunds: true})} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all uppercase ${formData.isCompanyFunds ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>Firmowe</button>
                            <button type="button" onClick={() => setFormData({...formData, isCompanyFunds: false})} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all uppercase ${!formData.isCompanyFunds ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500'}`}>Prywatne</button>
                          </div>
                          {!formData.isCompanyFunds && (
                            <div className="flex gap-2 p-1.5 bg-orange-50 rounded-2xl border border-orange-100 animate-in fade-in zoom-in-95">
                              {staff.map(name => (
                                <button key={name} type="button" onClick={() => setFormData({...formData, person: name})} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase ${formData.person === name ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-300'}`}>{name}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Opis transakcji</label>
                      <div className="flex flex-wrap gap-2.5 mb-4">
                        {(activeTab === 'income' ? quickTagsIncome : quickTagsExpense).map(tag => (
                          <button key={tag.name} type="button" onClick={() => setFormData({...formData, description: tag.name})} className={`px-5 py-3 rounded-2xl text-xs font-black border flex items-center gap-3 transition-all ${formData.description === tag.name ? 'bg-slate-800 border-slate-800 text-white scale-105 shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 shadow-sm'}`}>{tag.icon} {tag.name}</button>
                        ))}
                      </div>
                      <input className="w-full px-6 py-5 text-lg rounded-2xl border border-slate-200 outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="Szczegóły operacji..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required />
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Kwota</label>
                      <div className="flex gap-5">
                        <div className="relative flex-1">
                          <input type="number" step="0.01" className="w-full pl-8 pr-16 py-5 rounded-[2rem] border-4 border-slate-50 font-black text-4xl bg-slate-50/50 outline-none focus:border-indigo-500 transition-all tracking-tighter shadow-inner" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                          <span className="absolute right-8 top-1/2 -translate-y-1/2 font-black text-slate-300 text-2xl uppercase">zł</span>
                        </div>
                        <button type="submit" className={`px-10 rounded-[2rem] text-white font-black text-base uppercase shadow-2xl transition-all hover:scale-[1.03] active:scale-95 ${activeTab === 'income' ? 'bg-green-600 shadow-green-100' : 'bg-red-600 shadow-red-100'}`}>
                          {editingTransaction ? 'Zapisz' : 'Dodaj'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* KOLUMNA PRAWA: HISTORIA (8/12) */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full text-left">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                  <input className="w-full pl-16 pr-6 py-4 bg-slate-50 rounded-2xl border-none outline-none text-base font-black placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="Wyszukaj w historii (klient lub opis)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div className="relative w-full md:w-auto text-left">
                  <select 
                    className="w-full md:w-auto pl-6 pr-12 py-4 bg-indigo-50 rounded-2xl border-none outline-none text-xs font-black text-indigo-700 appearance-none cursor-pointer shadow-sm hover:bg-indigo-100 transition-colors"
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                  >
                    <option value="all">Wszyscy Klienci</option>
                    {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <UserCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={20} />
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0">
                  <button onClick={() => setDateFilter('all')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${dateFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Wszystko</button>
                  <button onClick={() => setDateFilter('month')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${dateFilter === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Ten Miesiąc</button>
                </div>
              </div>

              <div className="space-y-4 max-h-[850px] overflow-y-auto pr-3 custom-scrollbar text-left">
                {filteredTransactions.length > 0 ? filteredTransactions.map((item) => (
                  <div key={item.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all shadow-sm hover:shadow-xl">
                    <div className="flex items-center gap-8 min-w-0">
                      <div className={`p-5 rounded-3xl shrink-0 transition-all group-hover:rotate-6 ${item.type === 'income' ? 'bg-green-50 text-green-600' : (item.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400')}`}>
                        {item.type === 'income' ? <TrendingUp size={32} /> : (item.status === 'pending' ? <RotateCcw size={32} /> : <CheckCircle2 size={32} />)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-4 mb-2 font-black text-xl text-slate-800">
                          <span className="truncate">{item.client}</span>
                          <span className={`text-[10px] px-3 py-1.5 rounded-lg uppercase tracking-widest ${item.person === 'Firma' ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'bg-orange-100 text-orange-700 shadow-sm'}`}>{item.person}</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-slate-400 font-bold uppercase tracking-tight">
                          <p className="flex items-center gap-2 truncate">{getCategoryIcon(item.description)} {item.description}</p>
                          <span className="flex items-center gap-2 shrink-0 border-l border-slate-100 pl-6"><Calendar size={18}/> {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString('pl-PL') : '...'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <div className={`font-black text-3xl tracking-tighter tabular-nums ${item.type === 'income' ? 'text-green-600' : (item.status === 'pending' ? 'text-orange-600' : 'text-slate-400')}`}>
                          {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex gap-3 justify-end mt-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {item.status === 'pending' && (
                            <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', item.id), { status: 'settled' })} className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl uppercase shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Rozlicz</button>
                          )}
                          <button onClick={() => startEdit(item)} className="p-3 text-slate-300 hover:text-indigo-600 bg-slate-50 rounded-xl transition-all border border-transparent hover:border-indigo-100 shadow-sm"><Edit2 size={20} /></button>
                          <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', item.id))} className="p-3 text-slate-300 hover:text-red-500 bg-slate-50 rounded-xl transition-all border border-transparent hover:border-red-100 shadow-sm"><Trash2 size={20} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                    <Search className="mx-auto mb-6 text-slate-200" size={64}/>
                    <p className="font-black text-slate-300 uppercase text-sm tracking-[0.3em]">Brak wyników do wyświetlenia</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* WIDOK RAPORTU */
          <div className="space-y-10 animate-in fade-in duration-500 slide-in-from-bottom-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 text-green-50 transition-colors group-hover:text-green-100"><TrendingUp size={64}/></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Przychody Całkowite</p>
                <p className="text-4xl font-black text-green-600 tabular-nums">+{stats.totalIncome.toLocaleString()} zł</p>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 text-red-50 transition-colors group-hover:text-red-100"><RotateCcw size={64}/></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Koszty Operacyjne</p>
                <p className="text-4xl font-black text-red-500 tabular-nums">-{ (stats.totalIncome - stats.historicalProfit).toLocaleString()} zł</p>
              </div>
              <div className="bg-indigo-600 p-10 rounded-[2.5rem] text-white shadow-2xl md:col-span-2 flex flex-col justify-center border border-indigo-500">
                <p className="text-xs font-black text-indigo-200 uppercase tracking-widest mb-3">Zysk Netto Wypracowany (Firma)</p>
                <p className="text-6xl font-black tabular-nums">{stats.historicalProfit.toLocaleString('pl-PL')} PLN</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="bg-emerald-600 rounded-[2.5rem] p-10 text-white shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-widest mb-10 flex items-center gap-4"><HandCoins size={32} /> Rozliczenie Wypłat Własnych</h3>
                <div className="grid grid-cols-2 gap-8 text-center">
                  <div className="bg-white/10 rounded-3xl p-8 border border-white/10 backdrop-blur-md transition-transform hover:scale-105">
                    <p className="text-xs font-black text-emerald-100 uppercase mb-3 text-center">Adam</p>
                    <p className="text-4xl font-black tabular-nums">{stats.payouts.Adam.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/10 rounded-3xl p-8 border border-white/10 backdrop-blur-md transition-transform hover:scale-105">
                    <p className="text-xs font-black text-emerald-100 uppercase mb-3 text-center">Mateusz</p>
                    <p className="text-4xl font-black tabular-nums">{stats.payouts.Mateusz.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-100 border-8 border-dashed border-slate-200 rounded-[2.5rem] p-10 flex flex-col justify-center items-center text-center">
                <ShieldCheck size={64} className="text-indigo-600 mb-6" />
                <h3 className="text-3xl font-black text-slate-800 mb-3">Archiwizacja Systemu</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mb-10 tracking-[0.3em]">Pełna kopia bezpieczeństwa danych</p>
                <div className="flex gap-6">
                  <button onClick={handleExport} className="flex items-center gap-4 px-10 py-5 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase hover:bg-slate-700 transition-all shadow-xl hover:-translate-y-1"><Download size={24}/> Eksportuj bazę</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-4 px-10 py-5 bg-white border-2 border-slate-200 text-slate-800 rounded-2xl font-black text-xs uppercase hover:border-indigo-600 transition-all shadow-md hover:-translate-y-1"><Upload size={24}/> Przywróć kopię</button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                </div>
                {importStatus && <p className="mt-8 text-sm font-black text-indigo-600 animate-bounce uppercase tracking-widest">{importStatus}</p>}
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden text-left">
              <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-[0.3em] flex items-center gap-4"><PieChart size={28} className="text-indigo-600" /> Analiza Rentowności Projektów</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs font-black text-slate-400 border-b uppercase tracking-widest text-left">
                    <tr>
                      <th className="px-12 py-6 text-left">Klient / Projekt</th>
                      <th className="px-12 py-6 text-center">Przychód</th>
                      <th className="px-12 py-6 text-center">Suma Kosztów</th>
                      <th className="px-12 py-6 text-right">Zysk Końcowy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-left">
                    {Object.entries(stats.clientSummary).map(([name, data]) => (
                      <tr key={name} className="hover:bg-slate-50/50 transition-colors group text-left">
                        <td className="px-12 py-8 font-black text-xl text-slate-800">{name}</td>
                        <td className="px-12 py-8 text-center text-green-600 font-black text-xl">+{data.income.toLocaleString()}</td>
                        <td className="px-12 py-8 text-center text-red-400 font-bold text-xl">-{data.expense.toLocaleString()}</td>
                        <td className={`px-12 py-8 text-right font-black tabular-nums text-xl ${(data.income - data.expense) >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                          {(data.income - data.expense).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
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
        .custom-scrollbar::-webkit-scrollbar { width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; border: 2px solid #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default App;
