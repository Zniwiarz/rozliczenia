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
    } catch (err) { setAuthError("Błąd logowania."); }
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
    return <TagIcon size={12} className="text-slate-300" />;
  };

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

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 font-black text-indigo-600 animate-pulse text-xs tracking-widest">WCZYTYWANIE...</div>;

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="bg-indigo-600 w-16 h-16 rounded-xl flex items-center justify-center text-white mx-auto shadow-md"><Building2 size={32} /></div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">System Finansowy</h2>
          {authError && <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-[10px] text-red-600 font-bold">{authError}</div>}
          <button onClick={loginWithGoogle} className="w-full py-3 bg-slate-900 text-white rounded-lg flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="14" alt="G" /> Zaloguj się przez Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-6 font-sans antialiased text-left text-xs">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1300px] mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="bg-indigo-600 p-1 rounded-md text-white"><Building2 size={16} /></div>
            <h1 className="text-base font-black tracking-tighter uppercase text-slate-800">System <span className="text-indigo-600">Rozliczeń</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex bg-slate-100 p-0.5 rounded-lg">
              <button onClick={() => setView('dashboard')} className={`px-4 py-1 rounded-md text-[9px] font-black uppercase transition-all ${view === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Panel</button>
              <button onClick={() => setView('report')} className={`px-4 py-1 rounded-md text-[9px] font-black uppercase transition-all ${view === 'report' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Raport</button>
            </nav>
            <button onClick={() => signOut(auth)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-[1300px] mx-auto px-4 mt-4">
        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-0.5">Dostępny kapitał</p>
                <h2 className="text-2xl font-black mb-4 tracking-tight tabular-nums">{stats.availableBalance.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} <span className="text-[10px] font-medium text-slate-500 ml-1">PLN</span></h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/5 backdrop-blur-sm">
                    <p className="text-[8px] uppercase font-black text-orange-400 mb-0.5">Mateusz (do zwrotu)</p>
                    <p className="text-lg font-black tabular-nums">{stats.pendingDebts.Mateusz.toFixed(0)} zł</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/5 backdrop-blur-sm">
                    <p className="text-[8px] uppercase font-black text-orange-400 mb-0.5">Adam (do zwrotu)</p>
                    <p className="text-lg font-black tabular-nums">{stats.pendingDebts.Adam.toFixed(0)} zł</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden border-b-2 border-b-indigo-600">
                <div className="flex p-1 bg-slate-50 border-b">
                  <button onClick={() => { setActiveTab('income'); setEditingTransaction(null); }} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>Wpłata</button>
                  <button onClick={() => { setActiveTab('expense'); setEditingTransaction(null); }} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>Koszt</button>
                </div>
                <form onSubmit={handleAddOrEdit} className="p-4 space-y-4">
                  {editingTransaction && (
                    <div className="bg-indigo-50 border border-indigo-100 p-2 rounded-lg flex items-center justify-between">
                      <span className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1.5"><Edit2 size={12}/> Tryb Edycji</span>
                      <button type="button" onClick={() => {setEditingTransaction(null); setFormData({client:'', description:'', amount:'', person:'Adam', isCompanyFunds:true});}} className="text-indigo-400 hover:text-indigo-600"><X size={16}/></button>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Klient / Projekt</label>
                      <div className="flex gap-1.5 items-stretch">
                        {isAddingNewClient ? (
                          <input autoFocus className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-indigo-200 outline-none font-bold" placeholder="Nazwa klienta..." value={formData.client} onChange={(e) => setFormData({...formData, client: e.target.value})} />
                        ) : (
                          <select className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none bg-white font-black text-slate-700" value={formData.client} onChange={(e) => setFormData({...formData, client: e.target.value})} required>
                            <option value="">Wybierz...</option>
                            {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        )}
                        <button type="button" onClick={() => setIsAddingNewClient(!isAddingNewClient)} className="px-2 rounded-lg bg-slate-50 text-indigo-600 border border-slate-200 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><Plus size={16} /></button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Konto / Osoba</label>
                      {activeTab === 'income' ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-black text-[9px] uppercase shadow-inner"><Building2 size={16} /> Konto Firmowe</div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex p-0.5 bg-slate-100 rounded-lg">
                            <button type="button" onClick={() => setFormData({...formData, isCompanyFunds: true})} className={`flex-1 py-1.5 rounded-md text-[9px] font-black transition-all ${formData.isCompanyFunds ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>Firmowe</button>
                            <button type="button" onClick={() => setFormData({...formData, isCompanyFunds: false})} className={`flex-1 py-1.5 rounded-md text-[9px] font-black transition-all ${!formData.isCompanyFunds ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500'}`}>Prywatne</button>
                          </div>
                          {!formData.isCompanyFunds && (
                            <div className="flex gap-1 p-0.5 bg-orange-50 rounded-lg border border-orange-100 animate-in fade-in zoom-in-95">
                              {staff.map(name => (
                                <button key={name} type="button" onClick={() => setFormData({...formData, person: name})} className={`flex-1 py-1 rounded-md text-[9px] font-black ${formData.person === name ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-300'}`}>{name}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Kategoria i Opis</label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(activeTab === 'income' ? quickTagsIncome : quickTagsExpense).map(tag => (
                          <button key={tag.name} type="button" onClick={() => setFormData({...formData, description: tag.name})} className={`px-2 py-1 rounded-lg text-[9px] font-black border flex items-center gap-1.5 transition-all ${formData.description === tag.name ? 'bg-slate-800 border-slate-800 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}>{tag.icon} {tag.name}</button>
                        ))}
                      </div>
                      <input className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none font-bold" placeholder="Opis..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Kwota</label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <input type="number" step="0.01" className="w-full pl-4 pr-10 py-2.5 rounded-xl border-2 border-slate-50 font-black text-xl bg-slate-50/50 outline-none focus:border-indigo-500 transition-all tracking-tighter" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-slate-300 text-[10px]">zł</span>
                        </div>
                        <button type="submit" className={`px-6 rounded-xl text-white font-black text-[10px] uppercase shadow-md transition-all active:scale-95 ${activeTab === 'income' ? 'bg-green-600' : 'bg-red-600'}`}>
                          {editingTransaction ? 'Zapisz' : 'Dodaj'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4 text-left">
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full text-left">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-lg border-none outline-none text-xs font-black placeholder:text-slate-300" placeholder="Szukaj..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div className="relative w-full md:w-auto text-left">
                  <select 
                    className="w-full md:w-auto pl-3 pr-8 py-2 bg-indigo-50 rounded-lg border-none outline-none text-[9px] font-black text-indigo-700 appearance-none cursor-pointer"
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                  >
                    <option value="all">Wszyscy</option>
                    {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <UserCircle className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={12} />
                </div>

                <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                  <button onClick={() => setDateFilter('all')} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${dateFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Dziś</button>
                  <button onClick={() => setDateFilter('month')} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${dateFilter === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>MC</button>
                </div>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar text-left">
                {filteredTransactions.length > 0 ? filteredTransactions.map((item) => (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${item.type === 'income' ? 'bg-green-50 text-green-600' : (item.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400')}`}>
                        {item.type === 'income' ? <TrendingUp size={16} /> : (item.status === 'pending' ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 font-black text-xs text-slate-800">
                          <span className="truncate">{item.client}</span>
                          <span className={`text-[7px] px-1 py-0.5 rounded-md uppercase tracking-widest ${item.person === 'Firma' ? 'bg-indigo-50 text-indigo-500 shadow-xs' : 'bg-orange-100 text-orange-700 shadow-xs'}`}>{item.person}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                          <p className="flex items-center gap-1 truncate">{getCategoryIcon(item.description)} {item.description}</p>
                          <span className="flex items-center gap-1 shrink-0"><Calendar size={10}/> {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString('pl-PL') : '...'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className={`font-black text-sm tracking-tighter tabular-nums ${item.type === 'income' ? 'text-green-600' : (item.status === 'pending' ? 'text-orange-600' : 'text-slate-400')}`}>
                          {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex gap-1.5 justify-end mt-1 opacity-0 group-hover:opacity-100 transition-all">
                          {item.status === 'pending' && (
                            <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', item.id), { status: 'settled' })} className="px-1.5 py-0.5 bg-indigo-600 text-white text-[7px] font-black rounded uppercase shadow-sm">Rozlicz</button>
                          )}
                          <button onClick={() => startEdit(item)} className="p-1 text-slate-300 hover:text-indigo-600 bg-slate-50 rounded-lg transition-all"><Edit2 size={12} /></button>
                          <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', item.id))} className="p-1 text-slate-300 hover:text-red-500 bg-slate-50 rounded-lg transition-all"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
                    <p className="font-black text-slate-200 uppercase text-[9px] tracking-widest">Brak wyników</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* WIDOK RAPORTU */
          <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Przychody</p>
                <p className="text-xl font-black text-green-600 tabular-nums">+{stats.totalIncome.toLocaleString()} zł</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Koszty</p>
                <p className="text-xl font-black text-red-500 tabular-nums">-{ (stats.totalIncome - stats.historicalProfit).toLocaleString()} zł</p>
              </div>
              <div className="bg-indigo-600 p-4 rounded-xl text-white shadow-lg md:col-span-2 flex flex-col justify-center border border-indigo-500">
                <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-0.5">Zysk Netto Wypracowany</p>
                <p className="text-3xl font-black tabular-nums">{stats.historicalProfit.toLocaleString('pl-PL')} PLN</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="bg-emerald-600 rounded-xl p-6 text-white shadow-lg">
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2"><HandCoins size={18} /> Wypłaty Własne</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-white/10 rounded-xl p-3 border border-white/10 backdrop-blur-md">
                    <p className="text-[9px] font-black text-emerald-100 uppercase mb-1">Adam</p>
                    <p className="text-xl font-black tabular-nums">{stats.payouts.Adam.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 border border-white/10 backdrop-blur-md">
                    <p className="text-[9px] font-black text-emerald-100 uppercase mb-1">Mateusz</p>
                    <p className="text-xl font-black tabular-nums">{stats.payouts.Mateusz.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-100 border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col justify-center items-center text-center">
                <ShieldCheck size={32} className="text-indigo-600 mb-3" />
                <h3 className="text-lg font-black text-slate-800 mb-0.5">Kopia Bezpieczeństwa</h3>
                <div className="flex gap-3 mt-4">
                  <button onClick={handleExport} className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-lg font-black text-[9px] uppercase hover:bg-slate-700 shadow-md transition-all"><Download size={14}/> Eksport</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg font-black text-[9px] uppercase hover:border-indigo-600 shadow-sm transition-all"><Upload size={14}/> Import</button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                </div>
                {importStatus && <p className="mt-3 text-[9px] font-black text-indigo-600 animate-bounce">{importStatus}</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
              <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-2 text-left"><PieChart size={18} className="text-indigo-600" /> Analiza Projektów</h3>
              </div>
              <div className="overflow-x-auto text-left">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] font-black text-slate-400 border-b uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-3 text-left">Klient / Projekt</th>
                      <th className="px-6 py-3 text-center">Przychód</th>
                      <th className="px-6 py-3 text-center">Suma Kosztów</th>
                      <th className="px-6 py-3 text-right">Zysk Końcowy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(stats.clientSummary).map(([name, data]) => (
                      <tr key={name} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-3 font-black text-sm text-slate-800">{name}</td>
                        <td className="px-6 py-3 text-center text-green-600 font-black text-sm">+{data.income.toLocaleString()}</td>
                        <td className="px-6 py-3 text-center text-red-400 font-bold text-sm">-{data.expense.toLocaleString()}</td>
                        <td className={`px-6 py-3 text-right font-black tabular-nums text-sm ${(data.income - data.expense) >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
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
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default App;
