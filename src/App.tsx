import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  Users, 
  Mail, 
  Plus, 
  Search, 
  MoreVertical, 
  ChevronRight, 
  MapPin, 
  Briefcase, 
  Calendar, 
  FileText, 
  LogOut,
  Settings,
  X,
  Menu,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Send,
  Copy,
  Check,
  ArrowRight,
  LayoutGrid
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { cn } from './lib/utils';

// --- Types ---

type LeadStage = 'New Lead' | 'First Contact' | 'Second Outreach' | 'Third Outreach' | 'Follow Up' | 'Closed';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  company?: string;
  email: string;
  officePhone?: string;
  city?: string;
  state?: string;
  streetAddress?: string;
  notes?: string;
  stage: LeadStage;
  uid: string;
  createdAt: string;
  lastContactDate?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  uid: string;
}

// --- Context ---

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- Components ---

const InlineEditor: React.FC<{
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  type?: 'text' | 'select';
  options?: string[];
}> = ({ value, onSave, onCancel, type = 'text', options = [] }) => {
  const [val, setVal] = useState(value);
  const inputRef = React.useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave(val);
    if (e.key === 'Escape') onCancel();
  };

  if (type === 'select') {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => onSave(val)}
        onKeyDown={handleKeyDown}
        className="w-full bg-white border-none focus:ring-2 focus:ring-primary/20 rounded px-1 py-0.5 text-sm font-medium outline-none"
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={handleKeyDown}
      className="w-full bg-white border-none focus:ring-2 focus:ring-primary/20 rounded px-1 py-0.5 text-sm font-medium outline-none"
    />
  );
};

const StageBadge: React.FC<{ stage: LeadStage }> = ({ stage }) => {
  const colors: Record<LeadStage, string> = {
    'New Lead': 'bg-slate-100 text-slate-600',
    'First Contact': 'bg-sky-100 text-sky-600',
    'Second Outreach': 'bg-orange-100 text-orange-600',
    'Third Outreach': 'bg-red-100 text-red-600',
    'Follow Up': 'bg-emerald-100 text-emerald-600',
    'Closed': 'bg-indigo-100 text-indigo-600',
  };

  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-[11px] font-medium w-fit transition-colors",
      colors[stage]
    )}>
      {stage}
    </span>
  );
};

const Modal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
  maxWidth?: string;
  contentBg?: string;
}> = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl", contentBg = "bg-white" }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn("w-full overflow-hidden apple-card", maxWidth)}
          >
            <div className="flex items-center justify-between p-8 border-b border-gray-50 bg-white">
              <h2 className="text-xl font-bold text-[#1D1D1F]">{title}</h2>
              <button onClick={onClose} className="p-2 transition-colors rounded-full hover:bg-gray-100 bg-gray-50">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className={cn("p-8 max-h-[80vh] overflow-y-auto", contentBg)}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Main App ---

export default function App() {
  return (
    <AuthProvider>
      <CRMContent />
    </AuthProvider>
  );
}

function CRMContent() {
  const { user, loading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'leads' | 'pipeline' | 'templates'>('leads');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Modals
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState<Lead | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Lead; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof Lead | 'fullName' } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');

  const handleInlineSave = async (lead: Lead, field: keyof Lead | 'fullName', value: string) => {
    if (editingCell?.id !== lead.id) return;
    
    try {
      if (field === 'fullName') {
        const parts = value.trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        if (!firstName) {
          setEditingCell(null);
          return;
        }
        await updateDoc(doc(db, 'leads', lead.id), { firstName, lastName });
      } else {
        if (field === 'email' && value && !value.includes('@')) {
          setEditingCell(null);
          return;
        }
        await updateDoc(doc(db, 'leads', lead.id), { [field]: value });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${lead.id}`);
    }
    setEditingCell(null);
  };

  const renderGridCell = (field: keyof Lead | 'fullName', label: string, content: React.ReactNode, value: string, lead: Lead) => {
    const isEditing = editingCell?.id === lead.id && editingCell?.field === field;
    
    return (
      <div 
        className={cn(
          "flex flex-col gap-1 transition-all duration-200 relative",
          isEditing ? "bg-primary/5 ring-1 ring-inset ring-primary/20 z-20 p-1 rounded" : ""
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (!isEditing) {
            setEditingCell({ id: lead.id, field });
          }
        }}
      >
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        {isEditing ? (
          <InlineEditor 
            value={value} 
            onSave={(val) => handleInlineSave(lead, field, val)} 
            onCancel={() => setEditingCell(null)}
            type={field === 'stage' ? 'select' : 'text'}
            options={field === 'stage' ? ['New Lead', 'First Contact', 'Second Outreach', 'Third Outreach', 'Follow Up', 'Closed'] : []}
          />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="truncate">{content}</div>
            <div className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0">
              <Edit2 size={10} className="text-gray-400" />
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleSort = (key: keyof Lead) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIndicator: React.FC<{ columnKey: keyof Lead }> = ({ columnKey }) => {
    if (sortConfig?.key !== columnKey) return <ChevronRight size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronRight size={12} className="-rotate-90 text-primary" /> 
      : <ChevronRight size={12} className="rotate-90 text-primary" />;
  };

  useEffect(() => {
    if (!user) return;

    const leadsQuery = query(
      collection(db, 'leads'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
      setLeads(leadsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'leads'));

    const templatesQuery = query(
      collection(db, 'templates'),
      where('uid', '==', user.uid)
    );

    const unsubscribeTemplates = onSnapshot(templatesQuery, (snapshot) => {
      const templatesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate));
      setTemplates(templatesData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'templates'));

    return () => {
      unsubscribeLeads();
      unsubscribeTemplates();
    };
  }, [user]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const filteredLeads = leads
    .filter(lead => 
      `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      
      let aValue: any = a[key] || '';
      let bValue: any = b[key] || '';

      if (key === 'firstName') {
        aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
        bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
      } else if (key === 'stage') {
        const stageOrder: Record<LeadStage, number> = {
          'New Lead': 1,
          'First Contact': 2,
          'Second Outreach': 3,
          'Third Outreach': 4,
          'Follow Up': 5,
          'Closed': 6
        };
        aValue = stageOrder[a.stage];
        bValue = stageOrder[b.stage];
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-white to-gray-100">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-10 text-center apple-card"
        >
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10">
            <Users className="text-primary" size={32} />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-secondary">LeadFlow CRM</h1>
          <p className="mb-8 text-gray-500">Manage your leads and outreach with elegance.</p>
          <button
            onClick={handleLogin}
            className="flex items-center justify-center w-full gap-3 py-4 text-white apple-button bg-primary hover:bg-primary/90"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  const NavItem: React.FC<{ id: typeof activeTab; icon: React.ReactNode; label: string }> = ({ id, icon, label }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setIsSidebarOpen(false);
      }}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[14px] font-bold transition-all",
        activeTab === id 
          ? "bg-[#2da9e0] text-white shadow-lg shadow-[#2da9e0]/20" 
          : "text-[#94A3B8] hover:text-white hover:bg-white/5"
      )}
    >
      <span className={cn(activeTab === id ? "text-white" : "text-[#94A3B8]")}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[#F8F9FB]">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-secondary text-white transition-transform duration-300 md:translate-x-0 flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-8 flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold tracking-tight text-white">Lead</span>
            <span className="text-2xl font-bold tracking-tight text-[#2da9e0]">Flow</span>
          </div>
          <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-[0.25em]">Sales CRM</p>
        </div>

        <nav className="flex-1 px-4 space-y-8">
          <div>
            <p className="px-4 mb-4 text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em]">Main</p>
            <div className="space-y-1">
              <NavItem id="leads" icon={<Users size={18} />} label="All Leads" />
              <NavItem id="pipeline" icon={<LayoutGrid size={18} />} label="Pipeline" />
            </div>
          </div>

          <div>
            <p className="px-4 mb-4 text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em]">Tools</p>
            <div className="space-y-1">
              <NavItem id="templates" icon={<Mail size={18} />} label="Email Templates" />
            </div>
          </div>
        </nav>

        <div className="p-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-white/20" alt="Avatar" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 min-h-screen pt-24">
        <header className="fixed top-0 right-0 left-0 md:left-64 z-40 flex items-center justify-between h-20 px-8 bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-2xl font-bold text-[#1D1D1F]">
              {activeTab === 'leads' ? 'All Leads' : activeTab === 'pipeline' ? 'Pipeline' : 'Email Templates'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute text-gray-400 left-3 top-1/2 -translate-y-1/2" size={16} />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="py-2.5 pl-10 pr-4 text-sm bg-[#F2F2F7] border-none rounded-lg w-72 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button
              onClick={() => activeTab === 'templates' ? setIsTemplateModalOpen(true) : setIsLeadModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 text-white font-bold rounded-xl bg-[#2da9e0] hover:bg-[#2da9e0]/90 transition-all shadow-lg shadow-[#2da9e0]/20"
            >
              <Plus size={18} />
              <span>{activeTab === 'templates' ? 'New Template' : 'New Lead'}</span>
            </button>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'leads' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[1200px]">
                  {/* Sorting Header Row */}
                  <div className="sticky top-[80px] z-30 grid grid-cols-9 gap-4 px-6 py-4 bg-white border-b border-gray-100 items-start shadow-sm">
                    <button onClick={() => handleSort('company')} className="flex items-center gap-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-primary transition-colors group">
                      Company <SortIndicator columnKey="company" />
                    </button>
                    <button onClick={() => handleSort('firstName')} className="flex items-center gap-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-primary transition-colors group">
                      Contact Name <SortIndicator columnKey="firstName" />
                    </button>
                    <button onClick={() => handleSort('title')} className="flex items-center gap-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-primary transition-colors group">
                      Title/Role <SortIndicator columnKey="title" />
                    </button>
                    <button onClick={() => handleSort('email')} className="flex items-center gap-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-primary transition-colors group">
                      Email <SortIndicator columnKey="email" />
                    </button>
                    <button onClick={() => handleSort('officePhone')} className="flex items-center gap-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-primary transition-colors group">
                      Office Phone <SortIndicator columnKey="officePhone" />
                    </button>
                    <button onClick={() => handleSort('city')} className="flex items-center gap-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-primary transition-colors group">
                      City/Location <SortIndicator columnKey="city" />
                    </button>
                    <button onClick={() => handleSort('stage')} className="flex items-center gap-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-primary transition-colors group">
                      Lead Status <SortIndicator columnKey="stage" />
                    </button>
                    <button onClick={() => handleSort('createdAt')} className="flex items-center gap-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider hover:text-primary transition-colors group">
                      Date Added <SortIndicator columnKey="createdAt" />
                    </button>
                    <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider text-right">Actions</div>
                  </div>

                  <div className="divide-y divide-slate-100 pt-2">
                    <AnimatePresence mode="popLayout">
                      {filteredLeads.map((lead) => (
                        <motion.div
                          key={lead.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => { setEditingLead(lead); setIsLeadModalOpen(true); }}
                          className="group bg-white hover:bg-slate-50 border-b border-slate-100 transition-colors cursor-pointer"
                        >
                          <div className="grid grid-cols-9 gap-4 px-6 py-6 items-start">
                            {/* Company Column */}
                            {renderGridCell('company', 'Company', <span className="text-sm font-semibold text-slate-800">{lead.company || '—'}</span>, lead.company || '', lead)}
                            
                            {/* Contact Name Column */}
                            {renderGridCell('fullName', 'Contact Name', (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-sky-100 text-sky-600 flex items-center justify-center text-[10px] font-bold uppercase">
                                  {lead.firstName[0]}{lead.lastName[0]}
                                </div>
                                <span className="text-sm text-slate-700 font-medium">{lead.firstName} {lead.lastName}</span>
                              </div>
                            ), `${lead.firstName} ${lead.lastName}`, lead)}

                            {/* Title/Role Column */}
                            {renderGridCell('title', 'Title/Role', <span className="text-sm text-slate-600">{lead.title || '—'}</span>, lead.title || '', lead)}

                            {/* Email Column */}
                            {renderGridCell('email', 'Email', (
                              <a 
                                href={`mailto:${lead.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm text-sky-500 truncate hover:underline"
                              >
                                {lead.email}
                              </a>
                            ), lead.email, lead)}

                            {/* Office Phone Column */}
                            {renderGridCell('officePhone', 'Office Phone', <span className="text-sm text-slate-400">{lead.officePhone || '—'}</span>, lead.officePhone || '', lead)}

                            {/* City/Location Column */}
                            {renderGridCell('city', 'City/Location', (
                              <div className="flex items-center gap-1 text-slate-600">
                                <span className="text-sm">
                                  {lead.city}{lead.city && lead.state ? ', ' : ''}{lead.state}
                                  {!lead.city && !lead.state && '—'}
                                </span>
                              </div>
                            ), lead.city || '', lead)}

                            {/* Lead Status Column */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead Status</span>
                              <StageBadge stage={lead.stage} />
                            </div>

                            {/* Date Added Column */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Added</span>
                              <span className="text-sm text-slate-500">{format(new Date(lead.createdAt), 'MMM d, yyyy')}</span>
                            </div>

                            {/* Actions Column */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</span>
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSelectedLeadForEmail(lead);
                                    setIsComposeModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded transition-all"
                                  title="Send Email"
                                >
                                  <Mail size={14} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditingLead(lead); setIsLeadModalOpen(true); }}
                                  className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded transition-all"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete this lead?')) {
                                      try {
                                        await deleteDoc(doc(db, 'leads', lead.id));
                                      } catch (error) {
                                        handleFirestoreError(error, OperationType.DELETE, `leads/${lead.id}`);
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
                {filteredLeads.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 bg-white">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                      <Search size={24} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">No leads found matching your search</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or search query</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="flex gap-6 overflow-x-auto pb-8 min-h-[calc(100vh-200px)]">
              {(['New Lead', 'First Contact', 'Second Outreach', 'Third Outreach'] as LeadStage[]).map(stage => {
                const stageLeads = leads.filter(l => l.stage === stage);
                const stageColors: Record<LeadStage, { dot: string, bg: string, text: string }> = {
                  'New Lead': { dot: 'bg-[#8E8E93]', bg: 'bg-[#F2F2F7]', text: 'text-[#1D1D1F]' },
                  'First Contact': { dot: 'bg-[#2da9e0]', bg: 'bg-[#E5F1FF]', text: 'text-[#2da9e0]' },
                  'Second Outreach': { dot: 'bg-[#FF9500]', bg: 'bg-[#FFF4E5]', text: 'text-[#FF9500]' },
                  'Third Outreach': { dot: 'bg-[#FF3B30]', bg: 'bg-[#FFEBEA]', text: 'text-[#FF3B30]' },
                  'Follow Up': { dot: 'bg-[#34C759]', bg: 'bg-[#EBF9EE]', text: 'text-[#34C759]' },
                  'Closed': { dot: 'bg-[#5856D6]', bg: 'bg-[#EFEFF9]', text: 'text-[#5856D6]' },
                };

                return (
                  <div key={stage} className="flex flex-col gap-4 min-w-[300px] flex-1">
                    <div className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl transition-all",
                      stageColors[stage].bg
                    )}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", stageColors[stage].dot)} />
                        <h3 className={cn("text-[14px] font-bold", stageColors[stage].text)}>{stage}</h3>
                      </div>
                      <span className="text-[13px] font-bold opacity-20">
                        {stageLeads.length}
                      </span>
                    </div>

                    <div className="space-y-4 flex-1">
                      {stageLeads.length === 0 ? (
                        <div className="h-32 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 text-[14px] font-semibold bg-gray-50/50">
                          No leads
                        </div>
                      ) : (
                        stageLeads.map(lead => (
                          <motion.div
                            key={lead.id}
                            layoutId={lead.id}
                            className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm cursor-pointer hover:border-primary/30 transition-all group"
                            onClick={() => { setEditingLead(lead); setIsLeadModalOpen(true); }}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <p className="font-bold text-[#1D1D1F] text-[15px]">
                                {lead.firstName} {lead.lastName}
                              </p>
                              <ChevronRight size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex flex-col gap-0.5 mb-4">
                              <p className="text-[13px] text-gray-500 truncate">{lead.title || 'No Title'}</p>
                              {lead.company && (
                                <p className="text-[11px] text-primary font-bold uppercase tracking-wider">{lead.company}</p>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                              <span className="text-[12px] text-gray-400 font-semibold">
                                {lead.city}{lead.city && lead.state ? ', ' : ''}{lead.state}
                                {!lead.city && !lead.state && 'Remote'}
                              </span>
                              <div className="w-7 h-7 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[11px] font-bold text-[#8E8E93]">
                                {lead.firstName[0]}
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="grid gap-8 lg:grid-cols-2">
              {templates.map((template) => {
                const stageName = template.name.split(' — ')[0] || 'New Lead';
                const stageColors: Record<string, { dot: string, bg: string, text: string }> = {
                  'New Lead': { dot: 'bg-[#8E8E93]', bg: 'bg-[#F2F2F7]', text: 'text-[#1D1D1F]' },
                  'First Contact': { dot: 'bg-[#2da9e0]', bg: 'bg-[#E5F1FF]', text: 'text-[#2da9e0]' },
                  'Second Outreach': { dot: 'bg-[#FF9500]', bg: 'bg-[#FFF4E5]', text: 'text-[#FF9500]' },
                  'Third Outreach': { dot: 'bg-[#FF3B30]', bg: 'bg-[#FFEBEA]', text: 'text-[#FF3B30]' },
                };
                const colors = stageColors[stageName] || stageColors['New Lead'];

                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[32px] overflow-hidden flex flex-col border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="p-8 flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-xl font-bold text-[#1D1D1F]">
                          {template.name}
                        </h3>
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold", colors.bg, colors.text)}>
                          <div className={cn("w-2 h-2 rounded-full", colors.dot)} />
                          {stageName}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-[14px] text-gray-400 font-medium mb-6">
                        <Mail size={14} className="text-gray-300" />
                        <span className="truncate">{template.subject}</span>
                      </div>
                      
                      <div className="mt-4">
                        <div 
                          className="text-gray-400 text-[15px] leading-relaxed line-clamp-3 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: template.body }}
                        />
                      </div>
                    </div>
                    
                    <div className="px-8 pb-8 flex items-center gap-3">
                      <button 
                        onClick={() => { setEditingTemplate(template); setIsTemplateModalOpen(true); }}
                        className="px-6 py-2 rounded-xl bg-[#F2F2F7] text-[14px] font-bold text-[#1D1D1F] hover:bg-[#E5E5EA] transition-all"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('Delete this template?')) {
                            try {
                              await deleteDoc(doc(db, 'templates', template.id));
                            } catch (error) {
                              handleFirestoreError(error, OperationType.DELETE, `templates/${template.id}`);
                            }
                          }
                        }}
                        className="px-6 py-2 rounded-xl bg-[#FFEBEA] text-[14px] font-bold text-[#FF3B30] hover:bg-[#FFD6D4] transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white/80 backdrop-blur-xl border-t border-gray-200 p-2 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('leads')} className={cn("p-3 rounded-2xl", activeTab === 'leads' ? "bg-primary text-white" : "text-gray-400")}>
          <Users size={20} />
        </button>
        <button onClick={() => setActiveTab('pipeline')} className={cn("p-3 rounded-2xl", activeTab === 'pipeline' ? "bg-primary text-white" : "text-gray-400")}>
          <LayoutGrid size={20} />
        </button>
        <button onClick={() => setActiveTab('templates')} className={cn("p-3 rounded-2xl", activeTab === 'templates' ? "bg-primary text-white" : "text-gray-400")}>
          <Mail size={20} />
        </button>
      </div>
      {/* Lead Modal */}
      <Modal 
        isOpen={isLeadModalOpen} 
        onClose={() => { setIsLeadModalOpen(false); setEditingLead(null); }}
        title={editingLead ? 'Edit Lead' : 'Add New Lead'}
        maxWidth="max-w-3xl"
      >
        <LeadForm 
          initialData={editingLead} 
          onClose={() => { setIsLeadModalOpen(false); setEditingLead(null); }} 
          uid={user.uid}
        />
      </Modal>

      {/* Template Modal */}
      <Modal 
        isOpen={isTemplateModalOpen} 
        onClose={() => { setIsTemplateModalOpen(false); setEditingTemplate(null); }}
        title={editingTemplate ? 'Edit Template' : 'Add New Template'}
        maxWidth="max-w-6xl"
        contentBg="bg-[#F2F2F7]/50"
      >
        <TemplateForm 
          initialData={editingTemplate} 
          onClose={() => { setIsTemplateModalOpen(false); setEditingTemplate(null); }} 
          uid={user.uid}
        />
      </Modal>

      {/* Compose Email Modal */}
      <Modal
        isOpen={isComposeModalOpen}
        onClose={() => { setIsComposeModalOpen(false); setSelectedLeadForEmail(null); }}
        title={selectedLeadForEmail ? `Compose Email to ${selectedLeadForEmail.firstName} ${selectedLeadForEmail.lastName}` : 'Compose Email'}
        maxWidth="max-w-2xl"
      >
        {selectedLeadForEmail && (
          <ComposeEmailForm
            lead={selectedLeadForEmail}
            templates={templates}
            onClose={() => { setIsComposeModalOpen(false); setSelectedLeadForEmail(null); }}
            onSent={(msg) => setToast({ message: msg, type: 'success' })}
          />
        )}
      </Modal>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-[100] px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Form Components ---

const ComposeEmailForm: React.FC<{
  lead: Lead;
  templates: EmailTemplate[];
  onClose: () => void;
  onSent: (msg: string) => void;
}> = ({ lead, templates, onClose, onSent }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Mail Merge Logic: replace {{name}} with lead's first name
      const mergedBody = template.body.replace(/\{\{name\}\}/g, lead.firstName);
      const mergedSubject = template.subject.replace(/\{\{name\}\}/g, lead.firstName);
      setBody(mergedBody);
      setSubject(mergedSubject);
    } else {
      setBody('');
      setSubject('');
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    onSent(`Email sent to ${lead.email}`);
    onClose();
  };

  return (
    <form onSubmit={handleSend} className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Select Template</label>
        <div className="relative">
          <select
            className="apple-input appearance-none pr-10"
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronRight size={16} className="text-gray-400 rotate-90" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Subject</label>
        <input
          required
          placeholder="Email Subject"
          className="apple-input"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Message</label>
        <div className="quill-wrapper shadow-sm border border-gray-100 rounded-xl overflow-hidden">
          <ReactQuill
            theme="snow"
            value={body}
            onChange={setBody}
            placeholder="Write your message here..."
            modules={{
              toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'clean']
              ],
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl font-bold text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white bg-sky-500 hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/20"
        >
          <Send size={18} />
          <span>Send Email</span>
        </button>
      </div>
    </form>
  );
};

const LeadForm: React.FC<{ initialData: Lead | null; onClose: () => void; uid: string }> = ({ initialData, onClose, uid }) => {
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    title: initialData?.title || '',
    company: initialData?.company || '',
    officePhone: initialData?.officePhone || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    streetAddress: initialData?.streetAddress || '',
    notes: initialData?.notes || '',
    stage: initialData?.stage || 'New Lead' as LeadStage,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (initialData) {
        const updateData: any = { ...formData };
        if (formData.stage !== initialData.stage) {
          updateData.lastContactDate = new Date().toISOString();
        } else if (initialData.lastContactDate) {
          updateData.lastContactDate = initialData.lastContactDate;
        }
        
        await updateDoc(doc(db, 'leads', initialData.id), updateData);
      } else {
        await addDoc(collection(db, 'leads'), {
          ...formData,
          uid,
          createdAt: new Date().toISOString(),
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save lead. Please check your information and try again.');
      try {
        handleFirestoreError(err, initialData ? OperationType.UPDATE : OperationType.CREATE, 'leads');
      } catch (e) {
        // Error already logged by handleFirestoreError
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">First Name</label>
          <input
            required
            placeholder="John"
            className="apple-input"
            value={formData.firstName}
            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Last Name</label>
          <input
            required
            placeholder="Smith"
            className="apple-input"
            value={formData.lastName}
            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Title / Position</label>
          <input
            placeholder="VP of Marketing"
            className="apple-input"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Company</label>
          <input
            placeholder="Acme Corp"
            className="apple-input"
            value={formData.company}
            onChange={e => setFormData({ ...formData, company: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Email Address</label>
          <input
            required
            type="email"
            placeholder="john@company.com"
            className="apple-input"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Office Phone</label>
          <input
            placeholder="(555) 000-0000"
            className="apple-input"
            value={formData.officePhone}
            onChange={e => setFormData({ ...formData, officePhone: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-1.5">
          <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">City</label>
          <input
            placeholder="San Francisco"
            className="apple-input"
            value={formData.city}
            onChange={e => setFormData({ ...formData, city: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">State</label>
          <input
            placeholder="CA"
            className="apple-input"
            value={formData.state}
            onChange={e => setFormData({ ...formData, state: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Stage</label>
        <div className="relative">
          <select
            className="apple-input appearance-none pr-10"
            value={formData.stage}
            onChange={e => setFormData({ ...formData, stage: e.target.value as LeadStage })}
          >
            <option value="New Lead">New Lead</option>
            <option value="First Contact">First Contact</option>
            <option value="Second Outreach">Second Outreach</option>
            <option value="Third Outreach">Third Outreach</option>
            <option value="Follow Up">Follow Up</option>
            <option value="Closed">Closed</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronRight size={16} className="text-gray-400 rotate-90" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Street Address</label>
        <input
          placeholder="123 Main Street, Suite 100"
          className="apple-input"
          value={formData.streetAddress}
          onChange={e => setFormData({ ...formData, streetAddress: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Notes</label>
        <textarea
          rows={4}
          placeholder="Add notes about this lead..."
          className="apple-input resize-none"
          value={formData.notes}
          onChange={e => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl font-bold text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-all"
        >
          Cancel
        </button>
        <button
          disabled={loading}
          type="submit"
          className="px-6 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {loading ? 'Saving...' : initialData ? 'Update Lead' : 'Add Lead'}
        </button>
      </div>
    </form>
  );
};

const TemplateForm: React.FC<{ initialData: EmailTemplate | null; onClose: () => void; uid: string }> = ({ initialData, onClose, uid }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    subject: initialData?.subject || '',
    body: initialData?.body || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (initialData) {
        await updateDoc(doc(db, 'templates', initialData.id), formData);
      } else {
        await addDoc(collection(db, 'templates'), {
          ...formData,
          uid,
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, initialData ? OperationType.UPDATE : OperationType.CREATE, 'templates');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Template Name</label>
        <input
          required
          placeholder="e.g., First Contact"
          className="apple-input"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Email Subject</label>
        <input
          required
          placeholder="e.g., Quick question regarding {{title}}"
          className="apple-input"
          value={formData.subject}
          onChange={e => setFormData({ ...formData, subject: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider ml-1">Email Body</label>
        <div className="quill-wrapper shadow-sm">
          <ReactQuill
            theme="snow"
            value={formData.body}
            onChange={value => setFormData({ ...formData, body: value })}
            placeholder="Write your template here..."
            modules={{
              toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'clean']
              ],
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl font-bold text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-all"
        >
          Cancel
        </button>
        <button
          disabled={loading}
          type="submit"
          className="px-6 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {loading ? 'Saving...' : initialData ? 'Update Template' : 'Add Template'}
        </button>
      </div>
    </form>
  );
};
