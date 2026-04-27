```react
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  addDoc, 
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';

// --- Icons (Inline SVGs für Performance) ---
const IconUtensils = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
const IconTrash = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
const IconLock = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconCloud = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19a5.5 5.5 0 0 0 0-11h-1.2a7 7 0 1 0-12.3 4h.5a5.5 5.5 0 0 0 0 11Z"/></svg>;

// Firebase Konfiguration
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wurst-fruehstueck-v6';

const DEFAULT_LISTE = [
  { name: "Brötchen normal", price: 0.45 },
  { name: "Knacker", price: 1.90 }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('orders'); 
  const [orders, setOrders] = useState([]);
  const [wurstData, setWurstData] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [syncStatus, setSyncStatus] = useState({ type: null, msg: '' });

  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    wurstName: '',
    quantity: 1
  });

  // Auth initialisieren
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Login Fehler:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Daten-Synchronisierung
  useEffect(() => {
    if (!user) return;
    
    const configDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings');
    const ordersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');

    const fetchInitialConfig = async () => {
      try {
        const snap = await getDoc(configDocRef);
        if (snap.exists()) {
          setWurstData(snap.data().wurstList);
        } else {
          setWurstData(DEFAULT_LISTE);
        }
      } catch (e) {
        setWurstData(DEFAULT_LISTE);
      }
      setLoading(false);
    };
    fetchInitialConfig();

    const unsubConfig = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) setWurstData(snap.data().wurstList);
    });

    const unsubOrders = onSnapshot(ordersColRef, (querySnap) => {
      const list = [];
      querySnap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setOrders(list);
    });

    return () => { unsubConfig(); unsubOrders(); };
  }, [user]);

  useEffect(() => {
    if (wurstData.length > 0 && !formData.wurstName) {
      setFormData(prev => ({ ...prev, wurstName: wurstData[0].name }));
    }
  }, [wurstData]);

  const handleCloudSync = async () => {
    setSyncStatus({ type: 'loading', msg: 'Cloud-Sync...' });
    try {
      const configDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings');
      await setDoc(configDocRef, { wurstList: wurstData, lastUpdate: Date.now() });
      setSyncStatus({ type: 'success', msg: 'Erfolgreich gespeichert!' });
      setTimeout(() => setSyncStatus({ type: null, msg: '' }), 3000);
    } catch (err) {
      setSyncStatus({ type: 'error', msg: 'Fehler beim Speichern.' });
    }
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (!user || !formData.name) return;
    try {
      const ordersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
      await addDoc(ordersColRef, { ...formData, createdAt: Date.now() });
      setFormData(prev => ({ ...prev, quantity: 1 }));
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="flex flex-col h-screen items-center justify-center bg-gray-50 p-10 text-center font-sans">
      <div className="w-10 h-10 border-4 border-red-800 border-t-transparent rounded-full animate-spin mb-6"></div>
      <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">WurstCloud wird geladen</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col font-sans select-none overflow-hidden touch-pan-y shadow-inner">
      
      {/* App Header */}
      <header className="bg-red-800 text-white p-5 pt-8 flex justify-between items-center shadow-lg border-b border-red-900/20 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <IconUtensils />
          <h1 className="text-xl font-black uppercase tracking-tight">Wurst-Zentrale</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/20 rounded-full text-[8px] font-black uppercase tracking-widest text-red-100">
          <IconCloud /> Online
        </div>
      </header>

      {/* App Navigation */}
      <nav className="flex bg-white border-b border-gray-100 sticky top-[76px] z-40 shadow-sm">
        <button onClick={() => setView('orders')} className={`flex-1 py-4 text-[10px] font-black tracking-widest transition-all ${view === 'orders' ? 'text-red-700 border-b-4 border-red-700 bg-red-50/10' : 'text-gray-400 opacity-60'}`}>BESTELLEN</button>
        <button onClick={() => setView('admin')} className={`flex-1 py-4 text-[10px] font-black tracking-widest transition-all ${view === 'admin' ? 'text-red-700 border-b-4 border-red-700 bg-red-50/10' : 'text-gray-400 opacity-60'}`}>ADMIN</button>
      </nav>

      {/* App Content */}
      <main className="p-4 flex-1 overflow-y-auto pb-20">
        {view === 'orders' ? (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100">
              <form onSubmit={handleSaveOrder} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Name</label>
                  <input type="text" placeholder="Dein Vorname" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-gray-800 focus:ring-2 focus:ring-red-100 transition-all text-base" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                
                <div className="grid grid-cols-1 space-y-1">
                   <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Lieferdatum</label>
                   <input type="date" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-gray-800 focus:ring-2 focus:ring-red-100 transition-all" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Sorte</label>
                    <select className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-gray-800 appearance-none focus:ring-2 focus:ring-red-100 transition-all" value={formData.wurstName} onChange={e => setFormData({...formData, wurstName: e.target.value})}>
                      {wurstData.map((w, i) => <option key={i} value={w.name}>{w.name} ({w.price.toFixed(2)}€)</option>)}
                    </select>
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest text-center block">Menge</label>
                    <input type="number" min="1" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-center focus:ring-2 focus:ring-red-100 transition-all" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} />
                  </div>
                </div>

                <button type="submit" className="w-full bg-red-700 text-white font-black py-5 rounded-[1.8rem] shadow-xl shadow-red-200 uppercase text-xs tracking-[0.2em] active:scale-95 transition-transform mt-2">Jetzt Bestellen</button>
              </form>
            </div>

            <div className="space-y-3">
               <div className="flex justify-between items-center px-2">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Heutige Liste</h3>
                 <span className="text-[9px] font-bold text-gray-300 uppercase bg-white px-2 py-1 rounded-full">{orders.length} Einträge</span>
               </div>
               {orders.sort((a,b) => b.createdAt - a.createdAt).map(o => (
                 <div key={o.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm active:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-red-50 text-red-700 font-black text-[13px] w-10 h-10 flex items-center justify-center rounded-2xl">{o.quantity}</div>
                      <div>
                        <p className="text-sm font-black text-gray-800 leading-tight">{o.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{o.wurstName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-gray-300 uppercase">{new Date(o.date).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'})}</span>
                      {isAdminUnlocked && (
                        <button onClick={async () => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id))} className="text-gray-200 hover:text-red-500 p-2"><IconTrash /></button>
                      )}
                    </div>
                 </div>
               ))}
               {orders.length === 0 && (
                 <div className="text-center py-12">
                   <p className="text-gray-300 font-black uppercase tracking-[0.3em] text-[10px]">Noch keine Bestellungen</p>
                 </div>
               )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {!isAdminUnlocked ? (
              <div className="bg-white p-12 rounded-[3rem] text-center shadow-sm border border-gray-50 mt-10">
                <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-gray-300">
                  <IconLock />
                </div>
                <h2 className="text-[11px] font-black text-gray-400 uppercase mb-8 tracking-[0.3em]">Administrator</h2>
                <input 
                  type="password" 
                  placeholder="Passwort" 
                  className="w-full p-4 bg-gray-50 rounded-2xl border-none text-center mb-6 focus:ring-2 focus:ring-red-100 font-bold transition-all" 
                  value={passwordInput} 
                  onChange={e => setPasswordInput(e.target.value)} 
                />
                <button onClick={() => { if(passwordInput === "wurst123") setIsAdminUnlocked(true); }} className="w-full bg-gray-900 text-white font-black py-4 rounded-[1.5rem] uppercase text-xs tracking-widest shadow-xl shadow-gray-200 active:scale-95 transition-all">Anmelden</button>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-8 px-2">
                  <h3 className="font-black text-gray-800 uppercase text-[10px] tracking-widest">Konfiguration</h3>
                  <button onClick={() => { setIsAdminUnlocked(false); setPasswordInput(''); }} className="text-[9px] font-black text-white bg-gray-800 px-4 py-2 rounded-full uppercase tracking-tighter">Logout</button>
                </div>

                <div className="space-y-3 mb-8">
                  {wurstData.map((w, i) => (
                    <div key={i} className="flex gap-2 items-center bg-gray-50 p-2 rounded-2xl">
                      <input type="text" value={w.name} className="flex-1 p-2 bg-transparent border-none text-xs font-black text-gray-800 focus:ring-0" onChange={e => {
                        const n = [...wurstData]; n[i].name = e.target.value; setWurstData(n);
                      }} />
                      <div className="flex items-center gap-1 bg-white px-3 py-2 rounded-xl shadow-sm">
                        <input type="number" step="0.05" value={w.price} className="w-12 bg-transparent border-none text-[10px] font-black text-green-700 p-0 text-right focus:ring-0" onChange={e => {
                          const n = [...wurstData]; n[i].price = parseFloat(e.target.value) || 0; setWurstData(n);
                        }} />
                        <span className="text-[10px] font-black text-green-700">€</span>
                      </div>
                      <button onClick={() => setWurstData(wurstData.filter((_, idx) => idx !== i))} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><IconTrash /></button>
                    </div>
                  ))}
                  <button onClick={() => setWurstData([...wurstData, { name: "Neu...", price: 1.00 }])} className="w-full py-4 border-2 border-dashed border-gray-100 rounded-2xl text-[9px] font-black text-gray-300 uppercase hover:text-red-400 hover:border-red-100 transition-all">+ Sorte hinzufügen</button>
                </div>

                <div className="space-y-4">
                  <button onClick={handleCloudSync} disabled={syncStatus.type === 'loading'} className="w-full bg-green-600 text-white font-black py-5 rounded-[1.8rem] uppercase text-xs tracking-widest shadow-lg shadow-green-100 disabled:opacity-50 active:scale-95 transition-all">
                    {syncStatus.type === 'loading' ? 'Wird gespeichert...' : 'Daten synchronisieren'}
                  </button>

                  {syncStatus.msg && (
                    <div className={`p-4 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest animate-pulse ${syncStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {syncStatus.msg}
                    </div>
                  )}
                </div>

                <div className="mt-12 pt-8 border-t border-gray-50 flex flex-col items-center">
                   <p className="text-[9px] text-gray-300 font-black uppercase tracking-[0.4em] mb-6">Wartung</p>
                   <button onClick={async () => {
                     if(confirm("Alle Bestellungen unwiderruflich löschen?")) {
                       for(const o of orders) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id));
                     }
                   }} className="bg-red-50 text-red-400 px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors">Liste leeren</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="fixed bottom-4 left-0 right-0 text-center pointer-events-none">
        <span className="bg-gray-900/5 backdrop-blur-md text-[8px] font-black uppercase tracking-[0.5em] text-gray-400/60 px-4 py-2 rounded-full">Wurst-Planer v6.1 Stable</span>
      </footer>
    </div>
  );
}

```
