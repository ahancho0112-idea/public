import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Map, BookOpen, Heart, Plus, CheckCircle, Circle,
  Image as ImageIcon, Video, Type, X, ChevronRight, ChevronLeft,
  Send, User, Settings, Calendar, Pencil, Check, Lock, Key, Shield, List,
  ImagePlus
} from 'lucide-react';

// ================== Firebase 云端同步配置 ==================
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// 工具函数
const formatYMD = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export default function App() {
  // ============== 门禁鉴权与用户状态 ==============
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('couple_app_logged_in') === 'true');
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem('couple_app_room_code') || '');
  
  // App 初始化鉴权
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch(e) { console.error('鉴权初始化失败:', e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // ============== 主题与个人档案 ==============
  const [activeTab, setActiveTab] = useState('home');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('couple_app_profile');
    return saved ? JSON.parse(saved) : {
      nickname: '我',
      gender: 'female', 
      birthday: '1996-01-01'
    };
  });
  const [editProfile, setEditProfile] = useState({...userProfile});

  const themeColors = {
    female: {
      text: 'text-rose-500', bg: 'bg-rose-500', bgHover: 'hover:bg-rose-600',
      bgLight: 'bg-rose-100', bgSoft: 'bg-rose-50', gradient: 'from-rose-400 to-pink-500',
      shadow: 'shadow-rose-200', border: 'border-rose-100', borderHeart: 'border-rose-400',
      iconText: 'text-rose-400', tagBg: 'bg-rose-100 text-rose-600'
    },
    male: {
      text: 'text-blue-500', bg: 'bg-blue-500', bgHover: 'hover:bg-blue-600',
      bgLight: 'bg-blue-100', bgSoft: 'bg-blue-50', gradient: 'from-blue-400 to-cyan-500',
      shadow: 'shadow-blue-200', border: 'border-blue-100', borderHeart: 'border-blue-400',
      iconText: 'text-blue-400', tagBg: 'bg-blue-100 text-blue-600'
    }
  };
  const c = themeColors[userProfile.gender] || themeColors.female;

  // ============== 核心日期与纪念日逻辑 ==============
  const [todayStr] = useState(formatYMD(new Date()));
  const [currentMonthView, setCurrentMonthView] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const getDaysInMonth = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); 
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };
  const handlePrevMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));

  // ============== 动态数据状态 (从云端同步) ==============
  const [messages, setMessages] = useState([]);
  const [plans, setPlans] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);

  // Firestore DB 获取集合的快捷方法
  const getCol = (name) => collection(db, 'artifacts', appId, 'public', 'data', `${name}_${roomCode}`);
  
  useEffect(() => {
    if (!user || !isLoggedIn || !roomCode) return;

    const unsubMsgs = onSnapshot(getCol('messages'), (snap) => {
      const data = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
      data.sort((a,b) => b.id - a.id);
      setMessages(data);
    }, console.error);

    const unsubPlans = onSnapshot(getCol('plans'), (snap) => {
      const data = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
      data.sort((a,b) => b.id - a.id);
      setPlans(data);
    }, console.error);

    const unsubAnniv = onSnapshot(getCol('anniversaries'), (snap) => {
      const data = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
      setAnniversaries(data);
    }, console.error);

    return () => { unsubMsgs(); unsubPlans(); unsubAnniv(); };
  }, [user, isLoggedIn, roomCode]);

  // 保证弹窗数据实时刷新
  useEffect(() => {
    if (selectedNote) {
      const updated = messages.find(m => m.id === selectedNote.id);
      if (updated) setSelectedNote(updated);
    }
  }, [messages]);
  useEffect(() => {
    if (selectedPlan) {
      const updated = plans.find(p => p.id === selectedPlan.id);
      if (updated) setSelectedPlan(updated);
    }
  }, [plans]);

  // UI 模态框状态
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(null); // 'text', 'photo', 'video'
  const [newNoteText, setNewNoteText] = useState("");
  const [mediaPreview, setMediaPreview] = useState(null); // 新增：保存媒体预览数据
  const [selectedNote, setSelectedNote] = useState(null);
  const [replyText, setReplyText] = useState("");
  
  const [planType, setPlanType] = useState('small');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [newPlan, setNewPlan] = useState({ text: '', type: 'small', creatorRole: userProfile.gender, deadline: '', details: '' });
  const [showAddAnniversary, setShowAddAnniversary] = useState(false);
  const [newAnni, setNewAnni] = useState({ title: '', date: '' });

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState("");
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editPlanData, setEditPlanData] = useState(null);

  // ============== 登录与持久化处理 ==============
  const handleLogin = () => {
    setUserProfile(editProfile);
    setIsLoggedIn(true);
    localStorage.setItem('couple_app_logged_in', 'true');
    localStorage.setItem('couple_app_room_code', roomCode);
    localStorage.setItem('couple_app_profile', JSON.stringify(editProfile));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('couple_app_logged_in');
    setShowProfileModal(false);
  };

  const handleSaveProfile = () => {
    setUserProfile(editProfile);
    setShowProfileModal(false);
    localStorage.setItem('couple_app_profile', JSON.stringify(editProfile));
  };

  // ============== 交互处理 (保存至云端) ==============

  const handleSaveNewNote = async () => {
    if (!newNoteText.trim() && showAddNoteModal === 'text' && !mediaPreview) return;
    const now = new Date();
    const bgColors = ['bg-yellow-100', 'bg-orange-50', 'bg-emerald-50', 'bg-blue-50', 'bg-rose-50'];
    const randomBg = bgColors[Math.floor(Math.random() * bgColors.length)];
    const rotations = ['rotate-1', 'rotate-2', '-rotate-1', '-rotate-2'];
    const randomRot = rotations[Math.floor(Math.random() * rotations.length)];

    const newMsg = {
      id: Date.now(),
      type: showAddNoteModal,
      text: newNoteText || (showAddNoteModal === 'photo' ? '分享了一张照片 📷' : '分享了一段视频 🎥'),
      mediaUrl: mediaPreview || null, // 将图片或视频数据存入纸条
      date: todayStr,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      bg: randomBg,
      rotation: randomRot,
      creatorRole: userProfile.gender,
      replies: []
    };
    
    await setDoc(doc(getCol('messages'), newMsg.id.toString()), newMsg);
    
    // 清空状态
    setShowAddNoteModal(null);
    setNewNoteText("");
    setMediaPreview(null);
  };

  const handleReplyNote = async () => {
    if (!replyText.trim() || !selectedNote) return;
    const now = new Date();
    const newReply = { 
      creatorRole: userProfile.gender,
      text: replyText, 
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    const updatedReplies = [...(selectedNote.replies || []), newReply];
    await setDoc(doc(getCol('messages'), selectedNote._docId), { replies: updatedReplies }, { merge: true });
    setReplyText("");
  };

  const togglePlanCompletion = async (id) => {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    const isNowCompleted = !plan.completed;
    const updatedFields = { 
      completed: isNowCompleted, 
      completedAt: isNowCompleted ? todayStr : null 
    };
    await setDoc(doc(getCol('plans'), plan._docId), updatedFields, { merge: true });
  };

  const handleSavePlan = async () => {
    if (!newPlan.text.trim()) return;
    const planToAdd = {
      ...newPlan,
      id: Date.now(),
      completed: false,
      images: [],
      createdAt: todayStr,
      completedAt: null
    };
    await setDoc(doc(getCol('plans'), planToAdd.id.toString()), planToAdd);
    setShowAddPlanModal(false);
    setNewPlan({ text: '', type: 'small', creatorRole: userProfile.gender, deadline: '', details: '' });
  };

  const handleAddPlanImage = async () => {
    if (!selectedPlan) return;
    const newImages = [...(selectedPlan.images || []), `mock-new-${Date.now()}`];
    await setDoc(doc(getCol('plans'), selectedPlan._docId), { images: newImages }, { merge: true });
  };

  const handleSaveAnniversary = async () => {
    if (!newAnni.title || !newAnni.date) return;
    const anniData = { id: Date.now(), ...newAnni, type: 'love' };
    await setDoc(doc(getCol('anniversaries'), anniData.id.toString()), anniData);
    setShowAddAnniversary(false);
    setNewAnni({ title: '', date: '' });
  };

  const calculateDaysLeft = (targetDateStr) => {
    const target = new Date(targetDateStr);
    const today = new Date(todayStr);
    if (target < today) target.setFullYear(today.getFullYear() + 1);
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isMe = (role) => role === userProfile.gender;

  // ========================================================
  // ================== 门禁登录页面 ==================
  // ========================================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-[100dvh] bg-[#FDFCF8] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-72 h-72 bg-rose-200/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-72 h-72 bg-blue-200/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>

        <div className="bg-white w-full max-w-[360px] rounded-[32px] shadow-2xl p-8 relative z-10 border border-white/50 backdrop-blur-sm">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center shadow-inner border border-gray-100">
              <Shield size={32} className="text-gray-300" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-gray-800 text-center tracking-tight mb-2">数字小窝门禁</h1>
          <p className="text-sm text-gray-400 text-center mb-8">云端加密实时同步，只属于你们的私密空间</p>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-2 flex items-center tracking-wider uppercase"><Key size={14} className="mr-1.5"/>专属配对暗号</label>
              <input 
                type="text" 
                value={roomCode}
                onChange={e => setRoomCode(e.target.value)}
                placeholder="输入约定的房间暗号 (如: 0520)"
                className="w-full bg-gray-50 p-4 rounded-2xl text-center font-bold text-lg text-gray-800 tracking-widest outline-none border-2 border-transparent focus:border-gray-200 transition-colors placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal"
              />
            </div>

            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
              <label className="text-xs font-bold text-gray-500 mb-3 flex items-center tracking-wider uppercase"><User size={14} className="mr-1.5"/>我的档案身份</label>
              
              <div className="flex space-x-3 mb-4">
                <button 
                  onClick={() => setEditProfile({...editProfile, gender: 'female'})} 
                  className={`flex-1 py-3.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center ${editProfile.gender === 'female' ? 'border-rose-400 text-rose-500 bg-rose-50 shadow-sm' : 'border-gray-100 text-gray-400 bg-white hover:bg-gray-50'}`}
                >
                  <span className="text-lg mr-1.5">👩</span> 女生
                </button>
                <button 
                  onClick={() => setEditProfile({...editProfile, gender: 'male'})} 
                  className={`flex-1 py-3.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center ${editProfile.gender === 'male' ? 'border-blue-400 text-blue-500 bg-blue-50 shadow-sm' : 'border-gray-100 text-gray-400 bg-white hover:bg-gray-50'}`}
                >
                  <span className="text-lg mr-1.5">👨</span> 男生
                </button>
              </div>

              <input 
                type="text" 
                value={editProfile.nickname}
                onChange={e => setEditProfile({...editProfile, nickname: e.target.value})}
                placeholder="我在小窝里的昵称"
                className="w-full bg-white p-3.5 rounded-xl text-sm font-medium text-gray-700 outline-none border border-gray-100 focus:border-gray-300 transition-colors text-center"
              />
            </div>

            <button 
              disabled={!roomCode.trim() || !editProfile.nickname.trim()}
              onClick={handleLogin}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-base shadow-xl shadow-gray-900/20 disabled:opacity-30 transition-all hover:scale-[1.02] flex items-center justify-center"
            >
              <Lock size={18} className="mr-2" strokeWidth={3} /> 推门进入
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // ================== Main App Rendering ==================
  // ========================================================

  const TabBar = () => (
    <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 flex justify-around pb-6 pt-3 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl z-40">
      <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center transition-colors ${activeTab === 'home' ? c.text : 'text-gray-400'}`}>
        <MessageSquare className="w-6 h-6 mb-1" />
        <span className="text-xs font-medium">小纸条</span>
      </button>
      <button onClick={() => setActiveTab('plan')} className={`flex flex-col items-center transition-colors ${activeTab === 'plan' ? c.text : 'text-gray-400'}`}>
        <Map className="w-6 h-6 mb-1" />
        <span className="text-xs font-medium">备忘录</span>
      </button>
      <button onClick={() => setActiveTab('memory')} className={`flex flex-col items-center transition-colors ${activeTab === 'memory' ? c.text : 'text-gray-400'}`}>
        <BookOpen className="w-6 h-6 mb-1" />
        <span className="text-xs font-medium">日记本</span>
      </button>
    </div>
  );

  // Tab 1: 小纸条 (自动清空，只展示今日)
  const HomeTab = () => {
    const todayMessages = messages.filter(m => m.date === todayStr);

    return (
      <div className="p-5 pb-32 h-full overflow-y-auto bg-gray-50/50 space-y-6">
        <div className="flex justify-between items-center mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">小纸条</h1>
            <p className="text-sm text-gray-500 mt-1">Hello {userProfile.nickname}，今天想说点什么？</p>
          </div>
          <div onClick={() => setShowProfileModal(true)} className={`w-10 h-10 ${c.bgLight} rounded-full flex items-center justify-center ${c.text} shadow-inner cursor-pointer relative hover:scale-105 transition-transform`}>
            <User size={20} />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full"></div>
          </div>
        </div>

        <div onClick={() => setShowCalendarModal(true)} className={`bg-gradient-to-r ${c.gradient} rounded-2xl p-5 text-white shadow-lg ${c.shadow} cursor-pointer transform transition-transform hover:scale-[1.02]`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                <Calendar size={24} className="text-white" />
              </div>
              <div>
                <div className="text-sm opacity-90 mb-0.5">今日</div>
                <div className="text-2xl font-black tracking-wide">{todayStr}</div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="text-sm font-medium opacity-90">{['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][new Date().getDay()]}</div>
              <ChevronRight size={18} className="opacity-70 mt-1" />
            </div>
          </div>
        </div>

        <div className="relative min-h-[300px]">
          {todayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 opacity-50 mt-10">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-gray-400" />
              </div>
              <p className="text-sm font-bold text-gray-500">今天的客厅空空如也</p>
              <p className="text-xs text-gray-400 mt-1">昨日的纸条已被收纳进日记本，留个新纸条吧</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pb-12">
              {todayMessages.map((msg) => (
                <div key={msg.id} onClick={() => setSelectedNote(msg)} className={`${msg.bg} p-4 rounded-xl shadow-sm transform ${msg.rotation} transition-transform hover:rotate-0 flex flex-col cursor-pointer border border-black/5`}>
                  <div className="w-8 h-3 bg-black/10 absolute -top-1 left-1/2 -translate-x-1/2 rounded-full"></div>
                  {/* 显示实际上传的图片或视频 */}
                  {msg.type === 'photo' && (
                    <div className="w-full h-20 bg-black/5 rounded-lg mb-2 flex items-center justify-center text-gray-500 overflow-hidden">
                      {msg.mediaUrl ? <img src={msg.mediaUrl} className="w-full h-full object-cover" alt="photo" /> : <ImageIcon size={20} />}
                    </div>
                  )}
                  {msg.type === 'video' && (
                    <div className="w-full h-20 bg-black/5 rounded-lg mb-2 flex items-center justify-center text-gray-500 relative overflow-hidden">
                      {msg.mediaUrl ? <video src={msg.mediaUrl} className="w-full h-full object-cover" /> : <Video size={20} />}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <div className="w-6 h-6 bg-white/60 rounded-full flex items-center justify-center backdrop-blur-sm pl-0.5"><div className="w-0 h-0 border-t-4 border-t-transparent border-l-6 border-l-gray-700 border-b-4 border-b-transparent"></div></div>
                      </div>
                    </div>
                  )}
                  <p className="text-gray-800 text-sm font-medium leading-relaxed flex-1 line-clamp-3">{msg.text}</p>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-[10px] text-gray-500/70 flex items-center">
                      {msg.replies && msg.replies.length > 0 && <MessageSquare size={10} className="mr-1"/>}
                      {msg.replies && msg.replies.length > 0 ? msg.replies.length : ''}
                    </span>
                    <p className="text-right text-xs text-gray-500">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Tab 2: 备忘录
  const PlanTab = () => {
    const currentPlans = plans.filter(p => p.type === planType);
    const pendingPlans = currentPlans.filter(p => !p.completed);
    const completedPlans = currentPlans.filter(p => p.completed);

    const renderPlanCard = (plan) => (
      <div key={plan.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-3 relative overflow-hidden">
        <button onClick={(e) => { e.stopPropagation(); togglePlanCompletion(plan.id); }} className="mt-0.5 z-10 relative">
          {plan.completed ? (
            <CheckCircle className={`w-6 h-6 ${c.iconText} flex-shrink-0 transition-all`} />
          ) : (
            <Circle className={`w-6 h-6 text-gray-300 hover:${c.text} transition-colors flex-shrink-0`} />
          )}
        </button>

        <div className={`flex-1 cursor-pointer z-10 ${plan.completed ? 'opacity-60' : ''}`} onClick={() => setSelectedPlan(plan)}>
          <p className={`text-gray-800 font-medium text-sm leading-snug ${plan.completed ? 'line-through' : ''}`}>{plan.text}</p>
          <div className="flex items-center mt-2 space-x-2">
            <span className={`flex items-center text-[10px] px-1.5 py-0.5 rounded ${isMe(plan.creatorRole) ? c.tagBg : 'bg-gray-100 text-gray-500'}`}>
              <User size={10} className="mr-1" />
              {isMe(plan.creatorRole) ? userProfile.nickname : 'Ta'} 发起
            </span>
            {plan.deadline && (
              <span className="flex items-center text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-100">
                <Calendar size={10} className="mr-1 opacity-70" />
                {plan.deadline}
              </span>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <div className="p-5 pb-32 h-full overflow-y-auto bg-stone-50">
        <div className="mt-2 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">备忘录</h1>
          <p className="text-sm text-gray-500 mt-1">记录那些我们要一起奔赴的长远目标。</p>
        </div>

        <div className="flex bg-gray-200/60 rounded-xl p-1 mb-6">
          <button onClick={() => setPlanType('small')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${planType === 'small' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>小计划</button>
          <button onClick={() => setPlanType('big')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${planType === 'big' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>大目标</button>
        </div>

        <div className="space-y-3">
          {pendingPlans.map(renderPlanCard)}
          <button 
            onClick={() => {
              setNewPlan({ text: '', type: planType, creatorRole: userProfile.gender, deadline: '', details: '' });
              setShowAddPlanModal(true);
            }}
            className="w-full py-4 border-2 border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-500 rounded-2xl flex items-center justify-center font-medium transition-colors text-sm mt-4"
          >
            <Plus size={18} className="mr-2" /> 
            {planType === 'small' ? '添加一个小计划' : '设立一个大目标'}
          </button>
          {completedPlans.length > 0 && (
            <div className="flex items-center gap-4 py-4 opacity-50 mt-4">
              <div className="h-px bg-gray-300 flex-1"></div>
              <span className="text-xs font-medium text-gray-500">已打卡完成</span>
              <div className="h-px bg-gray-300 flex-1"></div>
            </div>
          )}
          {completedPlans.map(renderPlanCard)}
        </div>
      </div>
    );
  };

  // Tab 3: 日记本 (数据盘点总结 + 纸条归档查阅)
  const MemoryTab = () => {
    const currentYear = currentMonthView.getFullYear();
    const currentMonth = currentMonthView.getMonth();
    const daysArray = getDaysInMonth(currentYear, currentMonth);

    let selectedDateWeek = "";
    if (selectedDate) {
      const d = new Date(selectedDate);
      selectedDateWeek = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()];
    }

    const dayMessages = messages.filter(m => m.date === selectedDate);
    const dayMessagesMe = dayMessages.filter(m => isMe(m.creatorRole));
    const dayMessagesPartner = dayMessages.filter(m => !isMe(m.creatorRole));
    
    const dayPlansCreated = plans.filter(p => p.createdAt === selectedDate);
    const dayPlansCompleted = plans.filter(p => p.completedAt === selectedDate);
    
    const hasAnyActivity = dayMessages.length > 0 || dayPlansCreated.length > 0 || dayPlansCompleted.length > 0;

    return (
      <div className="p-0 h-full flex flex-col bg-stone-100">
        <div className="bg-white pt-8 pb-3 shadow-sm z-10 rounded-b-3xl shrink-0">
          <div className="flex justify-between items-center px-6 mb-2">
            <h1 className="text-xl font-bold text-gray-800">日记本</h1>
            <div className="flex items-center bg-gray-50 rounded-full p-0.5">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded-full text-gray-500"><ChevronLeft size={16}/></button>
              <span className="px-2 text-xs font-bold text-gray-700 w-16 text-center">{currentMonth + 1}月</span>
              <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded-full text-gray-500"><ChevronRight size={16}/></button>
            </div>
          </div>
          <div className="px-4">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 font-bold mb-1">
              <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
            </div>
            <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center px-1">
              {daysArray.map((d, idx) => {
                if (!d) return <div key={`empty-${idx}`} className="h-7"></div>;
                const fDate = formatYMD(d);
                const isSelected = fDate === selectedDate;
                const hasRecord = messages.some(m => m.date === fDate) || plans.some(p => p.createdAt === fDate || p.completedAt === fDate);
                
                return (
                  <button 
                    key={idx} onClick={() => setSelectedDate(fDate)}
                    className={`relative h-8 w-full rounded-lg flex flex-col items-center justify-center ${isSelected ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <span className="font-semibold text-xs">{d.getDate()}</span>
                    {hasRecord && <Heart size={6} className={`absolute bottom-0.5 ${isSelected ? 'text-gray-300' : c.text} fill-current`} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-32">
          <div className="bg-[#fcfaf5] min-h-[300px] rounded-sm shadow-sm border border-stone-200 relative p-6">
            <div className="text-center mb-6">
              <p className="text-stone-400 text-xs tracking-widest">{selectedDate} · {selectedDateWeek}</p>
              <div className="w-12 h-px bg-stone-300 mx-auto mt-2"></div>
            </div>
            
            {hasAnyActivity ? (
              <div className="space-y-5">
                <h3 className="text-base font-bold text-gray-800 text-center tracking-widest mb-4">今日动态盘点</h3>
                <div className="space-y-4">
                  {(dayMessagesMe.length > 0 || dayMessagesPartner.length > 0) && (
                    <div className="bg-white/60 p-4 rounded-2xl border border-stone-100 shadow-sm">
                      <h4 className="text-xs font-bold text-stone-400 mb-3 flex items-center"><MessageSquare size={14} className="mr-1.5"/> 留言互动</h4>
                      <div className="space-y-2">
                        {dayMessagesMe.length > 0 && (
                          <div className="flex items-center text-sm text-stone-700">
                            <div className={`w-1.5 h-1.5 rounded-full ${c.bg} mr-2`}></div>
                            {userProfile.nickname} 留下了 <span className="font-bold mx-1">{dayMessagesMe.length}</span> 张小纸条
                          </div>
                        )}
                        {dayMessagesPartner.length > 0 && (
                          <div className="flex items-center text-sm text-stone-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></div>
                            Ta 留下了 <span className="font-bold mx-1">{dayMessagesPartner.length}</span> 张小纸条
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-stone-100/60">
                        <p className="text-[11px] font-bold text-stone-400 mb-3 tracking-wide">当日纸条档案：</p>
                        <div className="grid grid-cols-2 gap-3">
                          {dayMessages.map(msg => (
                             <div key={msg.id} onClick={() => setSelectedNote(msg)} className={`${msg.bg} p-3 rounded-xl shadow-sm flex flex-col cursor-pointer border border-black/5 min-h-[90px]`}>
                               <div className="w-6 h-2 bg-black/10 absolute -top-1 left-1/2 -translate-x-1/2 rounded-full"></div>
                                {/* 纸条档案中显示缩略图 */}
                                {msg.type === 'photo' && (
                                  <div className="w-full h-12 bg-black/5 rounded-lg mb-2 flex items-center justify-center text-gray-500 overflow-hidden">
                                    {msg.mediaUrl ? <img src={msg.mediaUrl} className="w-full h-full object-cover" alt="photo" /> : <ImageIcon size={16} />}
                                  </div>
                                )}
                                {msg.type === 'video' && (
                                  <div className="w-full h-12 bg-black/5 rounded-lg mb-2 flex items-center justify-center text-gray-500 relative overflow-hidden">
                                    {msg.mediaUrl ? <video src={msg.mediaUrl} className="w-full h-full object-cover" /> : <Video size={16} />}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                      <div className="w-4 h-4 bg-white/60 rounded-full flex items-center justify-center backdrop-blur-sm pl-0.5"><div className="w-0 h-0 border-t-2 border-t-transparent border-l-4 border-l-gray-700 border-b-2 border-b-transparent"></div></div>
                                    </div>
                                  </div>
                                )}
                                <p className="text-gray-800 text-xs font-medium leading-relaxed flex-1 line-clamp-2 mt-1">{msg.text}</p>
                             </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {dayPlansCreated.length > 0 && (
                    <div className="bg-white/60 p-4 rounded-2xl border border-stone-100 shadow-sm">
                      <h4 className="text-xs font-bold text-stone-400 mb-3 flex items-center"><List size={14} className="mr-1.5"/> 设立的目标</h4>
                      <div className="text-sm text-stone-700 mb-2">今天你们新增了 <span className="font-bold mx-1">{dayPlansCreated.length}</span> 个计划：</div>
                      <ul className="space-y-2 mt-1">
                        {dayPlansCreated.map(p => (
                          <li key={p.id} className="text-xs text-stone-500 bg-stone-50/80 px-3 py-2 rounded-lg border border-stone-100 flex items-start">
                            <span className="mr-2 text-emerald-500">✦</span> <span className="flex-1 leading-relaxed">{p.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {dayPlansCompleted.length > 0 && (
                    <div className="bg-white/60 p-4 rounded-2xl border border-stone-100 shadow-sm">
                      <h4 className="text-xs font-bold text-stone-400 mb-3 flex items-center"><CheckCircle size={14} className="mr-1.5"/> 共同的成就</h4>
                      <div className="text-sm text-stone-700 mb-2">今天打卡完成了 <span className="font-bold mx-1 text-amber-600">{dayPlansCompleted.length}</span> 个约定：</div>
                      <ul className="space-y-2 mt-1">
                        {dayPlansCompleted.map(p => (
                          <li key={p.id} className="text-xs text-stone-400 bg-stone-50/80 px-3 py-2 rounded-lg border border-stone-100 flex items-start line-through">
                            <span className="mr-2 text-amber-500 no-underline">✓</span> <span className="flex-1 leading-relaxed">{p.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 opacity-60">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mb-3"><BookOpen className="w-5 h-5 text-stone-300" /></div>
                <p className="text-sm text-stone-400">这天是一张白纸呢</p>
                <p className="text-xs text-stone-300 mt-1">没有任何记录或打卡</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[390px] h-[800px] bg-white rounded-[40px] shadow-2xl relative overflow-hidden ring-8 ring-gray-900">
        <div className="absolute top-0 inset-x-0 h-6 bg-transparent flex justify-center z-50">
          <div className="w-32 h-6 bg-gray-900 rounded-b-2xl"></div>
        </div>

        {/* 小纸条页悬浮菜单控制 */}
        {activeTab === 'home' && (
          <>
            {showAddMenu && <div className="absolute inset-0 z-20" onClick={() => setShowAddMenu(false)}></div>}
            
            {showAddMenu && (
              <div className="absolute bottom-40 right-6 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 w-36 overflow-hidden">
                <button onClick={() => { setShowAddMenu(false); setShowAddNoteModal('text'); }} className="w-full px-4 py-3.5 text-left hover:bg-gray-50 text-sm font-bold text-gray-700 flex items-center border-b border-gray-50">
                  <Type size={16} className="mr-3 text-gray-400"/> 写文字
                </button>
                <button onClick={() => { setShowAddMenu(false); setShowAddNoteModal('photo'); }} className="w-full px-4 py-3.5 text-left hover:bg-gray-50 text-sm font-bold text-gray-700 flex items-center border-b border-gray-50">
                  <ImageIcon size={16} className="mr-3 text-emerald-400"/> 传照片
                </button>
                <button onClick={() => { setShowAddMenu(false); setShowAddNoteModal('video'); }} className="w-full px-4 py-3.5 text-left hover:bg-gray-50 text-sm font-bold text-gray-700 flex items-center">
                  <Video size={16} className="mr-3 text-blue-400"/> 发视频
                </button>
              </div>
            )}

            <button 
              onClick={() => setShowAddMenu(!showAddMenu)} 
              className={`absolute bottom-24 right-6 w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-gray-800 transition-transform z-30 ring-4 ring-gray-50/50 ${showAddMenu ? 'rotate-45' : 'hover:scale-105'}`}
            >
              <Plus size={28} />
            </button>
          </>
        )}

        <div className="h-full relative">
          {activeTab === 'home' && <HomeTab />}
          {activeTab === 'plan' && <PlanTab />}
          {activeTab === 'memory' && <MemoryTab />}
        </div>

        <TabBar />

        {/* ================== 弹窗区 ================== */}
        {/* 写纸条弹窗 (已加入调用相机/相册逻辑) */}
        {showAddNoteModal && (
          <div className="absolute inset-0 z-[80] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
             <div className="bg-white w-full rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
               <div className="flex justify-between items-center mb-5">
                 <h3 className="font-bold text-gray-800 text-lg flex items-center">
                   {showAddNoteModal === 'text' && <><Type size={18} className="mr-2 text-gray-400"/> 写纸条</>}
                   {showAddNoteModal === 'photo' && <><ImageIcon size={18} className="mr-2 text-emerald-400"/> 传照片</>}
                   {showAddNoteModal === 'video' && <><Video size={18} className="mr-2 text-blue-400"/> 发视频</>}
                 </h3>
                 <button onClick={() => { setShowAddNoteModal(null); setMediaPreview(null); setNewNoteText(''); }} className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200"><X size={18}/></button>
               </div>
               
               {/* 原生文件上传与预览区 */}
               {(showAddNoteModal === 'photo' || showAddNoteModal === 'video') && (
                 <label htmlFor="media-upload" className="w-full h-32 bg-gray-50 rounded-2xl mb-4 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden relative">
                    {mediaPreview ? (
                      showAddNoteModal === 'photo' ? (
                        <img src={mediaPreview} className="w-full h-full object-cover" alt="preview" />
                      ) : (
                        <video src={mediaPreview} className="w-full h-full object-cover" controls />
                      )
                    ) : (
                      <>
                        {showAddNoteModal === 'photo' ? <ImagePlus size={32} className="mb-2 text-gray-300"/> : <Video size={32} className="mb-2 text-gray-300"/>}
                        <span className="text-xs font-medium">点击选择{showAddNoteModal === 'photo' ? '图片' : '视频'}，可调用相机</span>
                      </>
                    )}
                    {/* HTML5 原生 File Input 自动适配手机系统相册与相机 */}
                    <input 
                      type="file" 
                      id="media-upload" 
                      accept={showAddNoteModal === 'photo' ? "image/*" : "video/*"} 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          // 使用 FileReader 将照片或视频转为可在前端预览的 Base64 URL
                          // 注意：在实际云端应用中，这部分应替换为先上传至 Firebase Storage 再保存 URL
                          const reader = new FileReader();
                          reader.onload = (e) => setMediaPreview(e.target.result);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                 </label>
               )}

               <textarea 
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  placeholder="想在这个纸条上写点什么..."
                  className="w-full bg-gray-50/50 p-4 rounded-2xl text-sm font-medium outline-none resize-none h-28 border border-gray-200 focus:border-gray-400 leading-relaxed"
                  autoFocus
               />
               <button 
                  onClick={handleSaveNewNote} 
                  disabled={!newNoteText.trim() && showAddNoteModal === 'text' && !mediaPreview}
                  className={`w-full py-4 mt-4 ${c.bg} text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50`}
               >
                 扔到客厅里
               </button>
             </div>
          </div>
        )}

        {/* 计划详情弹窗 */}
        {selectedPlan && (
          <div className="absolute inset-0 z-[75] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full rounded-3xl p-5 flex flex-col shadow-2xl max-h-[90%]">
              <div className="flex justify-between items-start mb-4">
                {isEditingPlan ? (
                  <input type="text" value={editPlanData.text} onChange={e => setEditPlanData({...editPlanData, text: e.target.value})} className="font-bold text-gray-800 flex-1 mr-4 text-lg leading-snug bg-gray-50 p-2 rounded-lg border border-gray-200 outline-none" />
                ) : (
                  <h3 className="font-bold text-gray-800 flex-1 pr-4 text-lg leading-snug">{selectedPlan.text}</h3>
                )}
                <div className="flex items-center space-x-2 shrink-0">
                  {isMe(selectedPlan.creatorRole) && !isEditingPlan && (
                    <button onClick={() => { setIsEditingPlan(true); setEditPlanData({...selectedPlan}); }} className="p-1.5 bg-gray-100 rounded-full text-gray-500"><Pencil size={16} /></button>
                  )}
                  {isEditingPlan && (
                    <button onClick={async () => {
                      await setDoc(doc(getCol('plans'), editPlanData._docId), editPlanData);
                      setIsEditingPlan(false);
                    }} className="p-1.5 bg-green-100 rounded-full text-green-600"><Check size={16} /></button>
                  )}
                  <button onClick={() => { setSelectedPlan(null); setIsEditingPlan(false); }} className="p-1.5 bg-gray-100 rounded-full text-gray-500"><X size={18} /></button>
                </div>
              </div>
              <div className="flex space-x-3 mb-5 border-b border-gray-100 pb-4">
                <div className="flex-1 bg-gray-50 p-2.5 rounded-xl">
                  <p className="text-[10px] text-gray-400 mb-1 flex items-center"><User size={12} className="mr-1"/>发起人</p>
                  <p className={`text-sm font-semibold ${isMe(selectedPlan.creatorRole) ? c.text : 'text-gray-700'}`}>{isMe(selectedPlan.creatorRole) ? userProfile.nickname : 'Ta'}</p>
                </div>
                <div className="flex-1 bg-gray-50 p-2.5 rounded-xl">
                  <p className="text-[10px] text-gray-400 mb-1 flex items-center"><Calendar size={12} className="mr-1"/>期限/区间</p>
                  {isEditingPlan ? (
                    <input type="text" value={editPlanData.deadline} onChange={e => setEditPlanData({...editPlanData, deadline: e.target.value})} className="text-sm font-semibold text-gray-700 bg-white p-1 rounded border border-gray-200 w-full outline-none" />
                  ) : (
                    <p className="text-sm font-semibold text-gray-700">{selectedPlan.deadline || '无期限'}</p>
                  )}
                </div>
              </div>
              <div className="overflow-y-auto flex-1 pb-4 scrollbar-hide space-y-5">
                <div>
                  <h4 className="text-xs font-bold text-gray-800 mb-2">计划详情</h4>
                  {isEditingPlan ? (
                    <textarea value={editPlanData.details} onChange={e => setEditPlanData({...editPlanData, details: e.target.value})} className="w-full bg-amber-50/50 p-4 rounded-2xl text-sm text-gray-700 leading-relaxed border border-amber-200 min-h-[80px] outline-none resize-none" />
                  ) : (
                    <div className="bg-amber-50/50 p-4 rounded-2xl text-sm text-gray-700 leading-relaxed border border-amber-100/50 min-h-[80px]">
                      {selectedPlan.details || '还没有写下具体的计划内容哦...'}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800 mb-2 flex items-center justify-between">图文记录</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {(selectedPlan.images || []).map((img, idx) => (
                      <div key={idx} className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200/50"><ImageIcon className="text-gray-300 w-8 h-8" /></div>
                    ))}
                    <button onClick={handleAddPlanImage} className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400"><Plus size={24} className="mb-2" /><span className="text-[10px] font-medium">添加图片</span></button>
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-gray-100">
                <button onClick={() => togglePlanCompletion(selectedPlan.id)} className={`w-full py-3.5 rounded-xl font-medium text-sm flex items-center justify-center ${selectedPlan.completed ? 'bg-gray-100 text-gray-500' : `${c.bg} text-white`}`}>
                  <CheckCircle size={18} className="mr-2" /> {selectedPlan.completed ? '取消打卡' : '标记为已完成'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 添加新计划弹窗 */}
        {showAddPlanModal && (
          <div className="absolute inset-0 z-[75] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full rounded-3xl p-5 flex flex-col shadow-2xl max-h-[90%]">
              <div className="flex justify-between items-center mb-5 shrink-0">
                <h3 className="font-bold text-gray-800 text-lg">{newPlan.type === 'small' ? '添加小计划' : '设立大目标'}</h3>
                <button onClick={() => setShowAddPlanModal(false)} className="p-1.5 bg-gray-100 rounded-full"><X size={18} /></button>
              </div>
              <div className="overflow-y-auto flex-1 pb-4 scrollbar-hide space-y-5">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">计划名称 <span className="text-red-400">*</span></label>
                  <input type="text" value={newPlan.text} onChange={e => setNewPlan({...newPlan, text: e.target.value})} className="w-full bg-gray-50 p-3.5 rounded-xl text-sm outline-none focus:border-gray-200" placeholder="例如：一起去阿勒泰看雪..." />
                </div>
                <div className="flex space-x-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">分类</label>
                    <div className="flex bg-gray-50 rounded-xl p-1">
                      <button onClick={() => setNewPlan({...newPlan, type: 'small'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${newPlan.type === 'small' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>小计划</button>
                      <button onClick={() => setNewPlan({...newPlan, type: 'big'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${newPlan.type === 'big' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>大目标</button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">发起人</label>
                    <div className="flex bg-gray-50 rounded-xl p-1">
                      <button onClick={() => setNewPlan({...newPlan, creatorRole: userProfile.gender})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${newPlan.creatorRole === userProfile.gender ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>我</button>
                      <button onClick={() => setNewPlan({...newPlan, creatorRole: userProfile.gender === 'female' ? 'male' : 'female'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${newPlan.creatorRole !== userProfile.gender ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>Ta</button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">期限/区间</label>
                  <input type="text" value={newPlan.deadline} onChange={e => setNewPlan({...newPlan, deadline: e.target.value})} className="w-full bg-gray-50 p-3.5 rounded-xl text-sm outline-none" placeholder="例如：本周末、2026年12月..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">计划详情 (可选)</label>
                  <textarea value={newPlan.details} onChange={e => setNewPlan({...newPlan, details: e.target.value})} className="w-full bg-gray-50 p-3.5 rounded-xl text-sm outline-none resize-none h-24" placeholder="写下具体的攻略、心愿描绘..." />
                </div>
              </div>
              <div className="pt-3 mt-1 shrink-0">
                <button onClick={handleSavePlan} disabled={!newPlan.text.trim()} className={`w-full py-3.5 rounded-xl font-bold text-sm ${!newPlan.text.trim() ? 'bg-gray-200 text-gray-400' : `${c.bg} text-white`}`}>创建计划</button>
              </div>
            </div>
          </div>
        )}

        {/* 纸条详情与回复弹窗 */}
        {selectedNote && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full rounded-3xl p-5 flex flex-col shadow-2xl max-h-[85%]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 flex items-center"><MessageSquare size={18} className="mr-2 text-amber-500" />纸条详情</h3>
                <div className="flex items-center space-x-2">
                  {isMe(selectedNote.creatorRole) && !isEditingNote && (
                    <button onClick={() => { setIsEditingNote(true); setEditNoteText(selectedNote.text); }} className="p-1.5 bg-gray-100 rounded-full text-gray-500"><Pencil size={16} /></button>
                  )}
                  <button onClick={() => { setSelectedNote(null); setIsEditingNote(false); }} className="p-1.5 bg-gray-100 rounded-full text-gray-500"><X size={18} /></button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 pb-4 scrollbar-hide">
                <div className={`${selectedNote.bg} p-5 rounded-2xl shadow-sm mb-6 relative border border-black/5`}>
                  <div className="w-10 h-3 bg-black/10 absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full"></div>
                  {/* 在详情页中显示大图或视频 */}
                  {selectedNote.type === 'photo' && (
                    <div className="w-full h-32 bg-black/5 rounded-xl mb-3 flex items-center justify-center text-gray-500 overflow-hidden">
                      {selectedNote.mediaUrl ? <img src={selectedNote.mediaUrl} className="w-full h-full object-cover" alt="photo" /> : <ImageIcon size={30} />}
                    </div>
                  )}
                  {selectedNote.type === 'video' && (
                    <div className="w-full h-32 bg-black/5 rounded-xl mb-3 flex items-center justify-center text-gray-500 relative overflow-hidden">
                      {selectedNote.mediaUrl ? <video src={selectedNote.mediaUrl} className="w-full h-full object-cover" controls /> : <Video size={30} />}
                    </div>
                  )}
                  
                  {isEditingNote ? (
                    <div className="flex flex-col items-end mt-1">
                      <textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)} className="w-full bg-white/60 p-3 rounded-lg text-[15px] font-medium outline-none resize-none" rows={3}/>
                      <button onClick={async () => { await setDoc(doc(getCol('messages'), selectedNote._docId), { text: editNoteText }, { merge: true }); setIsEditingNote(false); }} className={`mt-2 px-4 py-1.5 ${c.bg} text-white rounded-full text-xs flex items-center shadow-sm`}><Check size={14} className="mr-1" /> 保存</button>
                    </div>
                  ) : (
                    <p className="text-gray-800 text-[15px] font-medium leading-relaxed">{selectedNote.text}</p>
                  )}
                  <p className="text-right text-xs text-gray-500 mt-4">{selectedNote.date} · {selectedNote.time}</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 px-1 border-b border-gray-100 pb-2">回复记录</h4>
                  {(!selectedNote.replies || selectedNote.replies.length === 0) ? (
                    <p className="text-xs text-gray-400 px-1 italic">还没有回复，快去抢沙发吧~</p>
                  ) : (
                    selectedNote.replies.map((reply, idx) => (
                      <div key={idx} className="bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[10px] font-bold ${isMe(reply.creatorRole) ? c.text : 'text-gray-500'}`}>{isMe(reply.creatorRole) ? userProfile.nickname : 'Ta'}</span>
                          <span className="text-[10px] text-gray-400">{reply.time}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-snug">{reply.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center bg-gray-50 p-1.5 rounded-full border border-gray-200">
                <input type="text" className="flex-1 bg-transparent px-4 py-2 text-sm outline-none text-gray-700 placeholder-gray-400" placeholder="写下你的回复..." value={replyText} onChange={e => setReplyText(e.target.value)} />
                <button onClick={handleReplyNote} disabled={!replyText.trim()} className={`w-9 h-9 ${c.bg} text-white rounded-full flex items-center justify-center disabled:opacity-50`}><Send size={16} className="ml-0.5" /></button>
              </div>
            </div>
          </div>
        )}

        {/* 日历与纪念日弹窗 */}
        {showCalendarModal && (
          <div className="absolute inset-0 z-[60] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full h-[85%] rounded-t-3xl p-5 flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">日历与纪念日</h3>
                <button onClick={() => setShowCalendarModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-500"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto pb-6 scrollbar-hide">
                <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold text-gray-700">{currentMonthView.getFullYear()}年 {currentMonthView.getMonth() + 1}月</span>
                    <div className="flex space-x-2">
                      <button onClick={handlePrevMonth} className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-gray-500"><ChevronLeft size={14}/></button>
                      <button onClick={handleNextMonth} className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-gray-500"><ChevronRight size={14}/></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 font-medium mb-2"><div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div></div>
                  <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {getDaysInMonth(currentMonthView.getFullYear(), currentMonthView.getMonth()).map((d, idx) => {
                      if (!d) return <div key={idx} className="p-2"></div>;
                      const fDate = formatYMD(d);
                      const isToday = fDate === todayStr;
                      return (<div key={idx} className={`p-2 rounded-lg ${isToday ? `${c.bg} text-white font-bold shadow-md` : 'text-gray-700'}`}>{d.getDate()}</div>)
                    })}
                  </div>
                </div>
                <div className="flex justify-between items-center mb-3 px-1">
                  <h4 className="font-semibold text-gray-700 text-sm flex items-center"><Heart size={16} className={`mr-2 ${c.text}`} />即将到来</h4>
                  <button onClick={() => setShowAddAnniversary(true)} className="relative flex items-center justify-center w-8 h-8 rounded-full hover:scale-110 transition-transform bg-white shadow-sm border border-gray-100">
                    <Heart size={22} className={c.iconText} fill="currentColor" opacity={0.2} />
                    <Plus size={14} className={`absolute ${c.text}`} strokeWidth={3} />
                  </button>
                </div>
                <div className="space-y-3">
                  {anniversaries.map(anni => (
                    <div key={anni.id} className={`bg-gradient-to-r ${c.bgSoft} to-white p-4 rounded-xl flex justify-between items-center border ${c.borderHeart}`}>
                      <div><div className={`font-semibold ${c.text} text-sm`}>{anni.title}</div><div className="text-xs text-gray-400 mt-0.5">{anni.date}</div></div>
                      <div className="text-right"><div className="text-xs text-gray-500">还有</div><div className={`text-xl font-bold ${c.text}`}>{calculateDaysLeft(anni.date)}<span className="text-xs font-normal ml-0.5">天</span></div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 添加纪念日 */}
        {showAddAnniversary && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">添加纪念日</h3>
                <button onClick={() => setShowAddAnniversary(false)} className="p-1 bg-gray-100 rounded-full"><X size={16}/></button>
              </div>
              <div className="space-y-4">
                <div><label className="text-xs text-gray-500 mb-1 block">什么日子？</label><input type="text" value={newAnni.title} onChange={e => setNewAnni({...newAnni, title: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl text-sm outline-none"/></div>
                <div><label className="text-xs text-gray-500 mb-1 block">日期</label><input type="date" value={newAnni.date} onChange={e => setNewAnni({...newAnni, date: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl text-sm outline-none"/></div>
                <button onClick={handleSaveAnniversary} className={`w-full py-3 ${c.bg} text-white rounded-xl font-medium text-sm mt-2`}>保存</button>
              </div>
            </div>
          </div>
        )}

        {/* 个人偏好设置 */}
        {showProfileModal && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-800 flex items-center text-lg"><Settings size={20} className="mr-2 text-gray-600" />账户与偏好</h3>
                <button onClick={() => setShowProfileModal(false)} className="p-1.5 bg-gray-100 rounded-full"><X size={18}/></button>
              </div>
              <div className="space-y-5">
                <div><label className="text-xs font-semibold text-gray-500 mb-2 block">我的昵称</label><input type="text" value={editProfile.nickname} onChange={e => setEditProfile({...editProfile, nickname: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl text-sm outline-none"/></div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block">性别 (切换主题色)</label>
                  <div className="flex space-x-3">
                    <button onClick={() => setEditProfile({...editProfile, gender: 'male'})} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${editProfile.gender === 'male' ? 'border-blue-500 text-blue-500 bg-blue-50' : 'border-gray-100 text-gray-400 bg-white'}`}>男生</button>
                    <button onClick={() => setEditProfile({...editProfile, gender: 'female'})} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${editProfile.gender === 'female' ? 'border-rose-500 text-rose-500 bg-rose-50' : 'border-gray-100 text-gray-400 bg-white'}`}>女生</button>
                  </div>
                </div>
                <div className="pt-2 space-y-3">
                  <button onClick={handleSaveProfile} className={`w-full py-3.5 ${editProfile.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'} text-white rounded-xl font-medium text-sm shadow-md transition-colors`}>保存设置</button>
                  <button onClick={handleLogout} className="w-full py-3.5 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-xl font-medium text-sm transition-colors">退出当前小窝</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
