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
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  Building2, 
  TrendingDown, 
  TrendingUp, 
  User, 
  Trash2, 
  Briefcase,
  Users,
  LayoutDashboard,
  Plus,
  ArrowRightLeft,
  Tag as TagIcon,
  Fuel,
  Package,
  Wrench,
  FileText,
  Banknote,
  CheckCircle2,
  Clock,
  BarChart3,
  Gem,
  PieChart,
  Square,
  CheckSquare,
  HandCoins,
  RotateCcw,
  Download,
  Upload,
  ShieldCheck,
  LogOut,
  AlertCircle,
  X
} from 'lucide-react';

// --- KONFIGURACJA FIREBASE ---
// UWAGA: Jeśli uruchamiasz to we własnym projekcie (np. Vercel), 
// usuń linię z JSON.parse i wklej tutaj swój obiekt firebaseConfig z konsoli Firebase!
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'finanse-firmowe-v6';

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
  
  const [formData, setFormData] = useState({
    client: '',
    description: '',
    amount: '',
    person: 'Adam',
    isCompanyFunds: true 
  });

  const staff = ['Adam', 'Mateusz'];
  
  const quickTagsIncome = [
    { name: 'Zaliczka', icon: <Banknote size={12} />, color: '#10b981' } 
  ];

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
    if (tag) {
      return React.cloneElement(tag.icon, { color: tag.color });
    }
    return <TagIcon size={12} className="text-slate-300" />;
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Błąd logowania Google:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("Domena nieuprawniona. Musisz dodać obecny adres w Firebase Console (Auth -> Settings -> Authorized domains).");
      } else {
        setAuthError("Wystąpił błąd logowania. Spróbuj ponownie za chwilę.");
      }
    }
  };

  const handleLogout = () => signOut(auth);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) { console.error("Auth error"); }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qTrans = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });

    const qClients = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(data.sort((a, b) => a.name.localeCompare(b.name)));
    });

    return () => { unsubTrans(); unsubClients(); };
  }, [user]);

  const handleExport = () => {
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
    a.download = `backup_finanse_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setImportStatus("Importowanie...");
        for (const client of data.clients) {
          const exists = clients.find(c => c.name.toLowerCase() === client.name.toLowerCase());
          if (!exists) await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), { ...client, createdAt: serverTimestamp() });
        }
        for (const trans of data.transactions) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { ...trans, timestamp: serverTimestamp() });
        }
        setImportStatus("Gotowe!");
        setTimeout(() => setImportStatus(null), 3000);
      } catch (err) {
        setImportStatus("Błąd pliku!");
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!user || !formData.client || !formData.amount || !formData.description) return;
    try {
      const descLower = formData.description.toLowerCase();
      const transData = {
        client: formData.client,
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: activeTab,
        timestamp: serverTimestamp(),
        userId: user.uid,
        status: (activeTab === 'expense' && !formData.isCompanyFunds && !['inwestycja', 'wypłata'].includes(descLower)) ? 'pending' : 'settled',
        person: (activeTab === 'income') ? 'Firma' : (formData.isCompanyFunds ? 'Firma' : formData.person)
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), transData);
      if (!clients.some(c => c.name.toLowerCase() === formData.client.toLowerCase())) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), { name: formData.client, createdAt: serverTimestamp() });
      }
      setFormData({ ...formData, description: '', amount: '', isCompanyFunds: true });
      setIsAddingNewClient(false);
    } catch (err) { console.error(err); }
  };

  const settleTransaction = async (id, newStatus) => {
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id), { status: newStatus }); }
    catch (err) { console.error(err); }
  };

  const handleDelete = async (coll, id) => {
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id)); }
    catch (err) { console.error(err); }
  };

  const selectTag = (tag) => {
    setFormData(prev => ({ ...prev, description: tag }));
  };

  const stats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const operatingExpenses = transactions.filter(t => t.type === 'expense' && !['inwestycja', 'wypłata'].includes(t.description.toLowerCase())).reduce((acc, curr) => acc + curr.amount, 0);
    const settledCashOut = transactions.filter(t => t.type === 'expense' && t.status === 'settled' && t.description.toLowerCase() !== 'inwestycja').reduce((acc, curr) => acc + curr.amount, 0);
    const personalPayouts = { Adam: transactions.filter(t => t.person === 'Adam' && t.description.toLowerCase() === 'wypłata').reduce((acc, curr) => acc + curr.amount, 0), Mateusz: transactions.filter(t => t.person === 'Mateusz' && t.description.toLowerCase() === 'wypłata').reduce((acc, curr) => acc + curr.amount, 0) };
    const investments = { Adam: transactions.filter(t => t.person === 'Adam' && t.description.toLowerCase() === 'inwestycja').reduce((acc, curr) => acc + curr.amount, 0), Mateusz: transactions.filter(t => t.person === 'Mateusz' && t.description.toLowerCase() === 'inwestycja').reduce((acc, curr) => acc + curr.amount, 0) };
    const pendingDebts = { Adam: transactions.filter(t => t.type === 'expense' && t.person === 'Adam' && t.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0), Mateusz: transactions.filter(t => t.type === 'expense' && t.person === 'Mateusz' && t.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0) };
    const clientSummary = transactions.reduce((acc, t) => {
      if (!acc[t.client]) acc[t.client] = { income: 0, expense: 0 };
      if (t.type === 'income') acc[t.client].income += t.amount;
      else if (t.description.toLowerCase() !== 'inwestycja') acc[t.client].expense += t.amount;
      return acc;
    }, {});
    return { availableBalance: totalIncome - settledCashOut, totalIncome, operatingExpenses, clientSummary, pendingDebts, investments, personalPayouts, totalInvestment: investments.Adam + investments.Mateusz, totalPayouts: personalPayouts.Adam + personalPayouts.Mateusz, historicalProfit: totalIncome - operatingExpenses };
  }, [transactions]);

  if (!user && !loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg">
            <Building2 size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">Finanse Firmowe</h2>
            <p className="text-slate-500 text-sm mt-2">Bezpieczne logowanie kontem Google.</p>
          </div>
          {authError && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2 text-left">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] text-red-600 font-bold flex-1 leading-tight">{authError}</p>
              <button onClick={() => setAuthError(null)}><X size={14} className="text-red-400" /></button>
            </div>
          )}
          <button onClick={loginWithGoogle} className="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-3 font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="Google" />
            Zaloguj przez Google
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 font-black text-indigo-600 animate-pulse uppercase tracking-widest">Inicjalizacja...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-6 font-sans antialiased text-left">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1 rounded-lg text-white"><Building2 size={16} /></div>
            <h1 className="text-sm font-black tracking-tight uppercase">Finanse</h1>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex bg-slate-100 p-0.5 rounded-lg">
              <button onClick={() => setView('dashboard')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${view === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Panel</button>
              <button onClick={() => setView('report')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${view === 'report' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Raport</button>
            </nav>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 mt-3">
        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden border border-slate-800">
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Saldo w kasie</p>
                <h2 className="text-2xl font-black mt-0.5 mb-4">{stats.availableBalance.toFixed(2)} <span className="text-[9px] font-medium text-slate-500">PLN</span></h2>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                    <p className="text-[8px] uppercase font-bold text-orange-400 mb-0.5">Mateusz (pend.)</p>
                    <p className="text-sm font-bold">{stats.pendingDebts.Mateusz.toFixed(0)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                    <p className="text-[8px] uppercase font-bold text-orange-400 mb-0.5">Adam (pend.)</p>
                    <p className="text-sm font-bold">{stats.pendingDebts.Adam.toFixed(0)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={12} className="text-indigo-500" /> Saldo Projektów</h3>
                <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
                  {Object.entries(stats.clientSummary).map(([name, data]) => (
                    <div key={name} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 transition-all hover:border-indigo-200">
                      <p className="text-[11px] font-bold text-slate-800 truncate">{name}</p>
                      <span className={`font-black text-[11px] ${(data.income - data.expense) >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{(data.income - data.expense).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex p-0.5 bg-slate-50 border-b">
                  <button onClick={() => setActiveTab('income')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase ${activeTab === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>Wpłata</button>
                  <button onClick={() => setActiveTab('expense')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase ${activeTab === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>Koszt / Wypłata</button>
                </div>
                <form onSubmit={handleAddTransaction} className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Klient</label>
                      <div className="flex gap-1.5">
                        {isAddingNewClient ? (
                          <input autoFocus className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-indigo-100 outline-none" placeholder="Nazwa..." value={formData.client} onChange={(e) => setFormData({...formData, client: e.target.value})} />
                        ) : (
                          <select className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none bg-white font-medium" value={formData.client} onChange={(e) => setFormData({...formData, client: e.target.value})} required>
                            <option value="">Wybierz...</option>
                            {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        )}
                        <button type="button" onClick={() => {setIsAddingNewClient(!isAddingNewClient); setFormData({...formData, client: ''})}} className="p-1.5 rounded-lg bg-slate-50 text-indigo-600 border border-slate-200"><Plus size={14} /></button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Finansowanie</label>
                      {activeTab === 'income' ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-bold text-[9px] uppercase"><Building2 size={13} /> Konto Firmowe</div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex p-0.5 bg-slate-100 rounded-lg gap-0.5">
                            <button type="button" onClick={() => setFormData({...formData, isCompanyFunds: true})} className={`flex-1 py-1 rounded-md text-[8px] font-bold transition-all ${formData.isCompanyFunds ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>Firmowe</button>
                            <button type="button" onClick={() => setFormData({...formData, isCompanyFunds: false})} className={`flex-1 py-1 rounded-md text-[8px] font-bold transition-all ${!formData.isCompanyFunds ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500'}`}>Prywatne</button>
                          </div>
                          {!formData.isCompanyFunds && (
                            <div className="flex gap-1 p-0.5 bg-orange-50 rounded-lg border border-orange-100 animate-in fade-in">
                              {staff.map(name => (
                                <button key={name} type="button" onClick={() => setFormData({...formData, person: name})} className={`flex-1 py-1 rounded-md text-[8px] font-bold transition-all ${formData.person === name ? 'bg-white text-orange-600 shadow-xs' : 'text-orange-300'}`}>{name}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Kategoria</label>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(activeTab === 'income' ? quickTagsIncome : quickTagsExpense).map(tag => (
                          <button key={tag.name} type="button" onClick={() => selectTag(tag.name)} className={`px-2 py-1 rounded-lg text-[9px] font-bold border flex items-center gap-1.5 ${formData.description === tag.name ? 'bg-slate-800 border-slate-800 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-100'}`}>{tag.icon} {tag.name}</button>
                        ))}
                      </div>
                      <input className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200" placeholder="Dodaj opis..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Kwota</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input type="number" step="0.01" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-black text-lg bg-slate-50/50" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xs">zł</span>
                        </div>
                        <button type="submit" className={`px-6 rounded-lg text-white font-black text-[10px] uppercase shadow-md ${activeTab === 'income' ? 'bg-green-600' : 'bg-red-600'}`}>Dodaj</button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {transactions.slice(0, 25).map((item) => (
                  <div key={item.id} className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between group transition-all hover:border-indigo-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${item.type === 'income' ? 'bg-green-50 text-green-600' : (item.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400')}`}>
                        {item.type === 'income' ? <TrendingUp size={15} /> : (item.status === 'pending' ? <Clock size={15} /> : <CheckCircle2 size={15} />)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-[11px]">
                          <span className="text-slate-800 truncate max-w-[120px]">{item.client}</span>
                          <span className={`text-[7px] px-1 py-0.5 rounded-md uppercase shrink-0 ${item.person === 'Firma' ? 'bg-indigo-50 text-indigo-500' : 'bg-orange-100 text-orange-700'}`}>{item.person}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 flex items-center gap-1 truncate uppercase">{getCategoryIcon(item.description)} {item.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className={`font-black text-xs ${item.type === 'income' ? 'text-green-600' : (item.status === 'pending' ? 'text-orange-600' : 'text-slate-500')}`}>{item.type === 'income' ? '+' : '-'}{item.amount.toFixed(2)}</div>
                        {item.status === 'pending' ? (
                          <button onClick={() => settleTransaction(item.id, 'settled')} className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded uppercase shadow-xs">Rozlicz</button>
                        ) : (
                          item.person !== 'Firma' && item.type === 'expense' && !['wypłata', 'inwestycja'].includes(item.description.toLowerCase()) && (
                            <button onClick={() => settleTransaction(item.id, 'pending')} className="px-1.5 py-0.5 bg-slate-50 text-slate-400 text-[7px] font-bold rounded uppercase flex items-center gap-1 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><RotateCcw size={8} /> Cofnij</button>
                          )
                        )}
                      </div>
                      <button onClick={() => handleDelete('transactions', item.id)} className="p-1 text-slate-100 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Przychód</p>
                <p className="text-xl font-black text-green-600">+{stats.totalIncome.toFixed(0)}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Koszty</p>
                <p className="text-xl font-black text-red-500">-{stats.operatingExpenses.toFixed(0)}</p>
              </div>
              <div className="bg-indigo-600 p-4 rounded-2xl text-white border border-indigo-500 md:col-span-2 shadow-md">
                <p className="text-[8px] font-bold text-indigo-200 uppercase mb-1 tracking-widest">Zysk Netto Firmy</p>
                <p className="text-xl font-black">{stats.historicalProfit.toFixed(0)} PLN</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-600 rounded-2xl p-4 text-white">
                <h3 className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-2"><HandCoins size={14} /> Wypłacony Zysk</h3>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white/10 rounded-xl p-2 border border-white/10">
                    <p className="text-[8px] font-bold text-emerald-100 mb-0.5 uppercase">Adam:</p>
                    <p className="text-lg font-black">{stats.personalPayouts.Adam.toFixed(0)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2 border border-white/10">
                    <p className="text-[8px] font-bold text-emerald-100 mb-0.5 uppercase">Mateusz:</p>
                    <p className="text-lg font-black">{stats.personalPayouts.Mateusz.toFixed(0)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col justify-center items-center">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-2"><ShieldCheck size={14} className="text-indigo-600" /> Zarządzanie</h3>
                <div className="flex gap-2">
                  <button onClick={handleExport} className="p-2 bg-slate-800 text-white rounded-lg shadow-sm"><Download size={14} /></button>
                  <button onClick={() => fileInputRef.current.click()} className="p-2 bg-white border border-slate-200 text-slate-800 rounded-lg hover:border-indigo-600 shadow-xs"><Upload size={14} /></button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                </div>
                {importStatus && <p className="text-[8px] font-black uppercase text-center mt-2 text-indigo-600">{importStatus}</p>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 border-b bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><PieChart size={14} className="text-indigo-600" /> Projekty</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] min-w-[400px]">
                  <thead className="bg-slate-50 text-[8px] uppercase font-bold text-slate-400 border-b">
                    <tr>
                      <th className="px-4 py-2">Projekt</th>
                      <th className="px-4 py-2">Wpłaty</th>
                      <th className="px-4 py-2">Koszty/Wypł.</th>
                      <th className="px-4 py-2 text-right">Zysk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(stats.clientSummary).map(([name, data]) => (
                      <tr key={name} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 font-bold text-slate-800 truncate max-w-[120px]">{name}</td>
                        <td className="px-4 py-2 text-green-600 font-bold">+{data.income.toFixed(0)}</td>
                        <td className="px-4 py-2 text-red-400">-{data.expense.toFixed(0)}</td>
                        <td className={`px-4 py-2 text-right font-black ${(data.income - data.expense) >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{(data.income - data.expense).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
