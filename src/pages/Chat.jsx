import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Search, LogOut, User, Users, MessageSquare, Moon, Sun, Edit3, X, Smile, CheckCircle, Gem, Rocket, ShieldCheck, Heart, Crown, ArrowLeft, BarChart2, Clock, Plus, Eye, Loader2 } from 'lucide-react';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { useTheme } from '../context/ThemeContext';

const Chat = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileView, setProfileView] = useState(null);
  const [editBio, setEditBio] = useState('');
  const [editName, setEditName] = useState('');
  
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true);
  
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const [isSecretMode, setIsSecretMode] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
  const [revealedSecrets, setRevealedSecrets] = useState({});

  const socketRef = useRef();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('loomy_user');
    if (!storedUser) {
      navigate('/auth');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    setEditBio(parsedUser.bio || '');
    setEditName(parsedUser.name || '');

    socketRef.current = io('/', { path: '/socket.io' });
    socketRef.current.emit('register_user', parsedUser.id);

    fetchContacts(parsedUser.id);

    return () => {
      socketRef.current.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    if (!socketRef.current) return;
    
    const handleReceive = (msg) => {
      setMessages(prev => {
        if (!activeContact) return prev;
        const isCurrentGroup = activeContact.isGroup && msg.groupId === activeContact.id;
        const isCurrentDirect = !activeContact.isGroup && !msg.groupId && 
          (msg.senderId === activeContact.id || msg.receiverId === activeContact.id || msg.senderId === user?.id);
        
        if (isCurrentGroup || isCurrentDirect) {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        }
        return prev;
      });
    };

    socketRef.current.on('receive_message', handleReceive);
    socketRef.current.on('message_updated', (updatedMsg) => {
      setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, metadata: updatedMsg.metadata } : m));
    });
    socketRef.current.on('message_deleted', (msgId) => {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    });

    return () => {
      socketRef.current.off('receive_message', handleReceive);
      socketRef.current.off('message_updated');
      socketRef.current.off('message_deleted');
    };
  }, [activeContact, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (activeContact && user) {
      fetchMessages(user.id, activeContact);
    }
  }, [activeContact, user]);

  const fetchContacts = async (currentUserId) => {
    try {
      const resUsers = await fetch(`/api/users/contacts/${currentUserId}`);
      const usersData = await resUsers.json();
      const resGroups = await fetch(`/api/groups/${currentUserId}`);
      const groupsData = await resGroups.json();
      setContacts([...groupsData, ...usersData]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/users/search?q=${q}`);
      const data = await res.json();
      setSearchResults(data.filter(u => u.id !== user.id));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (userId, contact) => {
    try {
      const res = await fetch(`/api/messages/${userId}`);
      const data = await res.json();
      const filtered = data.filter(m => {
        if (contact.isGroup) {
          return m.groupId === contact.id;
        } else {
          return !m.groupId && ((m.senderId === userId && m.receiverId === contact.id) || (m.senderId === contact.id && m.receiverId === userId));
        }
      });
      setMessages(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('loomy_user');
    navigate('/');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !activeContact) return;
    
    const newMsg = {
      senderId: user.id,
      receiverId: activeContact.isGroup ? null : activeContact.id,
      groupId: activeContact.isGroup ? activeContact.id : null,
      text: messageText,
      metadata: isSecretMode ? { type: 'secret', expires: 10 } : null
    };
    
    socketRef.current.emit('send_message', newMsg);
    setMessageText('');
    setShowEmoji(false);
    setIsSecretMode(false);
  };

  const handleSendPoll = () => {
    if (!pollQuestion.trim() || pollOptions.some(o => !o.trim())) return;
    const newMsg = {
      senderId: user.id,
      receiverId: activeContact.isGroup ? null : activeContact.id,
      groupId: activeContact.isGroup ? activeContact.id : null,
      text: "📊 Опрос: " + pollQuestion,
      metadata: {
        type: 'poll',
        question: pollQuestion,
        options: pollOptions.map((opt, i) => ({ id: i, text: opt, votes: [] }))
      }
    };
    socketRef.current.emit('send_message', newMsg);
    setShowCreatePollModal(false);
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  const handleVote = (msg, optionId) => {
    const updatedMetadata = JSON.parse(JSON.stringify(msg.metadata));
    updatedMetadata.options.forEach(opt => {
      opt.votes = opt.votes.filter(id => id !== user.id);
      if (opt.id === optionId) opt.votes.push(user.id);
    });
    socketRef.current.emit('update_message', { id: msg.id, metadata: updatedMetadata });
  };

  const handleReact = (msg, emojiStr) => {
    const updatedMetadata = msg.metadata ? JSON.parse(JSON.stringify(msg.metadata)) : {};
    if (!updatedMetadata.reactions) updatedMetadata.reactions = {};
    if (!updatedMetadata.reactions[emojiStr]) updatedMetadata.reactions[emojiStr] = [];
    
    if (!updatedMetadata.reactions[emojiStr].includes(user.id)) {
      updatedMetadata.reactions[emojiStr].push(user.id);
    } else {
      updatedMetadata.reactions[emojiStr] = updatedMetadata.reactions[emojiStr].filter(id => id !== user.id);
      if (updatedMetadata.reactions[emojiStr].length === 0) delete updatedMetadata.reactions[emojiStr];
    }
    socketRef.current.emit('update_message', { id: msg.id, metadata: updatedMetadata });
    setActiveReactionMsgId(null);
  };

  const revealSecret = (msgId) => {
    setRevealedSecrets(prev => ({...prev, [msgId]: true}));
    setTimeout(() => {
      socketRef.current.emit('delete_message', msgId);
    }, 10000);
  };

  const saveProfile = async () => {
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, name: editName, bio: editBio })
      });
      if (res.ok) {
        const updatedUser = { ...user, name: editName, bio: editBio };
        setUser(updatedUser);
        localStorage.setItem('loomy_user', JSON.stringify(updatedUser));
        setShowProfileModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onEmojiClick = (emojiData) => {
    setMessageText(prev => prev + emojiData.emoji);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0) return;
    try {
      const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name: newGroupName, ownerId: user.id, members: selectedMembers })
      });
      if (res.ok) {
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setSelectedMembers([]);
        fetchContacts(user.id);
      }
    } catch(e) { console.error(e) }
  };

  const handleGrantAchievement = async (achievement) => {
    try {
      const res = await fetch('/api/admin/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminUsername: user.username, 
          targetUserId: profileView.id, 
          achievement 
        })
      });
      if (res.ok) {
        const data = await res.json();
        setProfileView(prev => ({...prev, achievements: data.achievements}));
        setContacts(prev => prev.map(c => c.id === profileView.id ? {...c, achievements: data.achievements} : c));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const hasPremium = (u) => {
    if (!u || !u.achievements) return false;
    try {
      return JSON.parse(u.achievements).includes('premium');
    } catch(e) { return false; }
  };

  const renderAchievements = (achievementsStr) => {
    let list = ['beta'];
    try {
      const parsed = JSON.parse(achievementsStr || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
    } catch(e) {}
    
    return list.map(a => {
      if (a === 'beta') return <div key={a} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-xs font-medium"><Rocket size={14} className="text-[#3b82f6]" /><span>Бета-тестер</span></div>;
      if (a === 'staff') return <div key={a} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#ef4444]/10 border border-[#ef4444]/20 text-xs font-medium"><ShieldCheck size={14} className="text-[#ef4444]" /><span>Команда</span></div>;
      if (a === 'sponsor') return <div key={a} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#ec4899]/10 border border-[#ec4899]/20 text-xs font-medium"><Heart size={14} className="text-[#ec4899]" /><span>Спонсор</span></div>;
      if (a === 'premium') return <div key={a} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#a855f7]/10 border border-[#a855f7]/20 text-xs font-medium"><Gem size={14} className="text-[#a855f7]" /><span>Premium</span></div>;
      return null;
    });
  };

  if (!user) return null;

  return (
    <div className="flex h-screen w-full bg-[#050505] text-gray-200 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className={`flex flex-col w-full md:w-80 h-full border-r border-white/5 bg-[#0a0a0a] transition-transform ${showSidebarOnMobile ? 'flex' : 'hidden md:flex'}`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => { setProfileView(user); setShowProfileModal(true); }}
            title="Мой профиль"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${hasPremium(user) ? 'bg-gradient-to-tr from-fuchsia-500 to-purple-600' : 'bg-white/10'}`}>
              <User size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight flex items-center gap-1">{user.name}</h3>
              <span className="text-xs text-gray-500">@{user.username}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button onClick={() => setShowCreateGroupModal(true)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors" title="Создать группу">
              <Users size={18} />
            </button>
            <button onClick={toggleTheme} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors" title="Сменить тему">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={handleLogout} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors" title="Выйти">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="p-4 border-b border-white/5">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Поиск..." 
              value={searchQuery}
              onChange={handleSearch}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Contacts */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
          {searchQuery ? (
            searchResults.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">Ничего не найдено</div>
            ) : (
              searchResults.map(contact => (
                <div 
                  key={contact.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${activeContact?.id === contact.id ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                  onClick={() => { setActiveContact(contact); setSearchQuery(''); setSearchResults([]); setShowSidebarOnMobile(false); }}
                >
                  <div className="w-12 h-12 flex-shrink-0 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg">
                    {contact.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-medium text-sm truncate">{contact.name}</h4>
                      {contact.id === 0 && <CheckCircle size={14} className="text-green-500" title="System" />}
                      {hasPremium(contact) && <Gem size={14} className="text-purple-400" title="Premium" />}
                      {contact.username?.toLowerCase() === 'zell' && <Crown size={12} className="text-red-500" title="Staff" />}
                    </div>
                    <p className="text-xs text-gray-500 truncate">@{contact.username}</p>
                  </div>
                </div>
              ))
            )
          ) : (
            <>
              {contacts.length === 0 && <div className="text-center py-8 text-sm text-gray-500">Нет контактов</div>}
              {contacts.map(contact => (
                <div 
                  key={contact.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${activeContact?.id === contact.id ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                  onClick={() => { setActiveContact(contact); setShowSidebarOnMobile(false); }}
                >
                  <div className="w-12 h-12 flex-shrink-0 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg">
                    {contact.isGroup ? <Users size={20}/> : contact.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-medium text-sm truncate">{contact.name}</h4>
                      {contact.id === 0 && <CheckCircle size={14} className="text-green-500" title="System" />}
                      {hasPremium(contact) && <Gem size={14} className="text-purple-400" title="Premium" />}
                      {contact.username?.toLowerCase() === 'zell' && <Crown size={12} className="text-red-500" title="Staff" />}
                    </div>
                    <p className="text-xs text-gray-500 truncate">@{contact.username}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 bg-[#050505] ${!showSidebarOnMobile ? 'flex' : 'hidden md:flex'}`}>
        {activeContact ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-md sticky top-0 flex items-center gap-4 z-10">
              <button 
                className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white" 
                onClick={() => setShowSidebarOnMobile(true)}
              >
                <ArrowLeft size={20} />
              </button>
              
              <div 
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => { setProfileView(activeContact); setShowProfileModal(true); }}
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold">
                  {activeContact.isGroup ? <Users size={20}/> : activeContact.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    {activeContact.id === 0 && <CheckCircle size={14} className="text-green-500" />}
                    {activeContact.name}
                    {hasPremium(activeContact) && <Gem size={14} className="text-purple-400" />}
                    {activeContact.username?.toLowerCase() === 'zell' && <Crown size={12} className="text-red-500" />}
                  </h3>
                  <span className="text-xs text-gray-500">@{activeContact.username}</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map(msg => {
                const isMine = msg.senderId === user.id;
                const isPoll = msg.metadata?.type === 'poll';
                const isSecret = msg.metadata?.type === 'secret';
                const reactions = msg.metadata?.reactions || {};
                
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                    <div className="flex items-end gap-2 group relative">
                      
                      <div className={`
                        px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                        ${isMine 
                          ? 'bg-purple-600 text-white rounded-br-sm' 
                          : 'bg-white/10 text-gray-100 rounded-bl-sm border border-white/5'
                        }
                        ${isSecret ? 'bg-red-500/20 border-red-500/50 text-red-200' : ''}
                      `}>
                        {isSecret ? (
                          revealedSecrets[msg.id] ? (
                            <p>{msg.text}</p>
                          ) : (
                            <div className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100" onClick={() => revealSecret(msg.id)}>
                              <Eye size={16} /> <span>Секретное сообщение (нажми)</span>
                            </div>
                          )
                        ) : isPoll ? (
                          <div className="min-w-[240px]">
                            <p className="font-bold mb-4">{msg.text}</p>
                            <div className="space-y-2">
                              {msg.metadata.options.map(opt => {
                                const totalVotes = msg.metadata.options.reduce((sum, o) => sum + o.votes.length, 0);
                                const percentage = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                                const hasVoted = opt.votes.includes(user.id);
                                return (
                                  <div key={opt.id} onClick={() => handleVote(msg, opt.id)} className="relative overflow-hidden rounded-lg cursor-pointer bg-black/20 border border-white/10 hover:border-white/20 transition-colors">
                                    <div className="absolute inset-y-0 left-0 bg-purple-500/30 transition-all duration-500 ease-out" style={{width: `${percentage}%`}}></div>
                                    <div className="relative z-10 px-3 py-2 flex justify-between text-xs">
                                      <span>{opt.text}</span>
                                      <span className="font-medium">{percentage}%</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-[10px] text-white/50 text-right mt-2">Голосов: {msg.metadata.options.reduce((sum, o) => sum + o.votes.length, 0)}</div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        )}
                        
                        <div className={`text-[10px] mt-1.5 ${isMine ? 'text-purple-200/70 text-right' : 'text-gray-400 text-left'}`}>
                          {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>

                        {/* Reactions Display */}
                        {Object.keys(reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(reactions).map(([emoji, userIds]) => (
                              <div 
                                key={emoji} 
                                onClick={(e) => { e.stopPropagation(); handleReact(msg, emoji); }} 
                                className={`
                                  px-2 py-0.5 rounded-full text-xs cursor-pointer flex items-center gap-1 border
                                  ${userIds.includes(user.id) ? 'bg-purple-500/30 border-purple-500/50 text-white' : 'bg-black/30 border-white/10 text-gray-300'}
                                `}
                              >
                                {emoji} {userIds.length}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add Reaction Button (appears on hover) */}
                      <button 
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-white/10 text-gray-500"
                        onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                      >
                        <Smile size={16} />
                      </button>

                    </div>
                    
                    {/* Emoji Picker Popup */}
                    {activeReactionMsgId === msg.id && (
                      <div className={`mt-2 z-20 ${isMine ? 'mr-10' : 'ml-10'}`}>
                        <EmojiPicker onEmojiClick={(e) => handleReact(msg, e.emoji)} theme="dark" width={280} height={350}/>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-[#0a0a0a]">
              <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-4xl mx-auto">
                <div className="flex gap-1 mb-1">
                  <button type="button" className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors relative" onClick={() => setShowEmoji(!showEmoji)}>
                    <Smile size={20} />
                    {showEmoji && (
                      <div className="absolute bottom-12 left-0 z-50 shadow-2xl">
                        <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
                      </div>
                    )}
                  </button>
                  <button type="button" className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors" onClick={() => setShowCreatePollModal(true)} disabled={activeContact.id === 0}>
                    <BarChart2 size={20} />
                  </button>
                  <button type="button" className={`p-2.5 rounded-full transition-colors ${isSecretMode ? 'text-red-400 bg-red-500/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} onClick={() => setIsSecretMode(!isSecretMode)} disabled={activeContact.id === 0}>
                    <Clock size={20} />
                  </button>
                </div>
                
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder={activeContact.id === 0 ? "Системный бот..." : "Напишите сообщение..."} 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    disabled={activeContact.id === 0}
                    className={`w-full bg-white/5 border ${isSecretMode ? 'border-red-500/50 bg-red-500/5 placeholder:text-red-500/50' : 'border-white/10'} rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-white placeholder:text-gray-600`}
                  />
                  <button 
                    type="submit" 
                    disabled={!messageText.trim() || activeContact.id === 0}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 disabled:opacity-50 disabled:bg-gray-700 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-full">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/5">
              <MessageSquare size={32} className="opacity-50" />
            </div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">Выберите чат</h3>
            <p className="text-sm">Чтобы начать общение, выберите контакт слева</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {/* Profile Modal */}
      {showProfileModal && profileView && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowProfileModal(false)}>
          <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
            
            {/* Banner */}
            <div className={`h-32 ${hasPremium(profileView) ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500' : 'bg-white/10'}`}>
              <button className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors backdrop-blur-md" onClick={() => setShowProfileModal(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Avatar */}
            <div className="px-6 relative pb-6">
              <div className={`w-24 h-24 rounded-full -mt-12 mb-4 flex items-center justify-center text-3xl font-bold bg-[#111] border-4 border-[#111] relative z-10 ${hasPremium(profileView) ? 'ring-2 ring-purple-500 ring-offset-4 ring-offset-[#111]' : ''}`}>
                {profileView.isGroup ? <Users size={40} className="text-gray-400" /> : (
                  <div className="w-full h-full rounded-full bg-white/10 flex items-center justify-center text-white">
                    {profileView.name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {profileView.id === user.id ? (
                <div className="space-y-6 mt-2">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400 uppercase">Имя</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400 uppercase">О себе</label>
                      <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows="3" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none resize-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase block mb-2">Значки</label>
                    <div className="flex flex-wrap gap-2">
                      {renderAchievements(user.achievements)}
                      {user.username?.toLowerCase() === 'zell' && <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-500"><Crown size={14} /> Staff</div>}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex gap-3">
                    <button onClick={saveProfile} className="flex-1 bg-white text-black font-semibold rounded-lg py-2.5 text-sm hover:bg-gray-200 transition-colors">Сохранить</button>
                    <button onClick={handleLogout} className="px-4 bg-red-500/10 text-red-400 rounded-lg py-2.5 hover:bg-red-500/20 transition-colors" title="Выйти"><LogOut size={18} /></button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      {profileView.name}
                      {profileView.id === 0 && <CheckCircle size={18} className="text-green-500" />}
                      {hasPremium(profileView) && <Gem size={18} className="text-purple-400" />}
                      {profileView.username?.toLowerCase() === 'zell' && <Crown size={18} className="text-red-500" />}
                    </h2>
                    <p className="text-sm text-gray-400">@{profileView.username}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">О себе</label>
                    <p className="text-sm bg-black/50 p-3 rounded-xl border border-white/5">{profileView.bio || 'Этот пользователь пока ничего не написал о себе.'}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase block mb-2">Роли</label>
                    <div className="flex flex-wrap gap-2">
                      {renderAchievements(profileView.achievements)}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button onClick={() => { setActiveContact(profileView); setShowProfileModal(false); }} className="flex-1 bg-purple-600 text-white font-medium rounded-lg py-2.5 text-sm hover:bg-purple-500 transition-colors flex items-center justify-center gap-2">
                      <MessageSquare size={16} /> Написать
                    </button>
                  </div>

                  {user.username?.toLowerCase() === 'zell' && profileView.id !== 0 && (
                    <div className="pt-4 border-t border-white/10">
                      <label className="text-xs font-semibold text-red-400 uppercase block mb-2">Админ-панель</label>
                      <div className="flex gap-2">
                        <button className="flex-1 bg-black border border-white/10 hover:bg-white/5 text-sm py-2 rounded-lg transition-colors text-pink-400" onClick={() => handleGrantAchievement('sponsor')}>+ Спонсор</button>
                        <button className="flex-1 bg-black border border-white/10 hover:bg-white/5 text-sm py-2 rounded-lg transition-colors text-purple-400" onClick={() => handleGrantAchievement('premium')}>+ Premium</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreateGroupModal(false)}>
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-gray-400 hover:text-white" onClick={() => setShowCreateGroupModal(false)}><X size={20} /></button>
            <h2 className="text-lg font-bold mb-6">Создать группу</h2>
            
            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Название группы</label>
                <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Например: Разработка" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">ID участников (через запятую)</label>
                <input type="text" onChange={e => setSelectedMembers(e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)))} placeholder="1, 2, 3" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none text-white" />
              </div>
            </div>
            
            <button className="w-full bg-white text-black font-semibold rounded-lg py-2.5 text-sm hover:bg-gray-200 transition-colors" onClick={handleCreateGroup}>Создать</button>
          </div>
        </div>
      )}

      {/* Create Poll Modal */}
      {showCreatePollModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreatePollModal(false)}>
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-gray-400 hover:text-white" onClick={() => setShowCreatePollModal(false)}><X size={20} /></button>
            <h2 className="text-lg font-bold mb-6">Создать опрос</h2>
            
            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Вопрос</label>
                <input type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Что думаете?" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none text-white" />
              </div>
              
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-gray-400">Варианты</label>
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={opt} onChange={e => { const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts); }} placeholder={`Вариант ${i+1}`} className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none text-white" />
                    {pollOptions.length > 2 && (
                      <button className="p-2 text-gray-400 hover:text-red-400 bg-white/5 rounded-lg" onClick={() => { const newOpts = pollOptions.filter((_, idx) => idx !== i); setPollOptions(newOpts); }}><X size={16}/></button>
                    )}
                  </div>
                ))}
              </div>
              
              {pollOptions.length < 10 && (
                <button className="w-full bg-white/5 text-gray-300 border border-white/10 font-medium rounded-lg py-2 text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors" onClick={() => setPollOptions([...pollOptions, ''])}>
                  <Plus size={16} /> Добавить вариант
                </button>
              )}
            </div>
            
            <button className="w-full bg-purple-600 text-white font-semibold rounded-lg py-2.5 text-sm hover:bg-purple-500 transition-colors" onClick={handleSendPoll}>Отправить опрос</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;
