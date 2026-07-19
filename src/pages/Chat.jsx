import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Search, LogOut, User, Users, MessageCircle, Moon, Sun, Edit3, X, Smile, CheckCircle, Gem, Rocket, ShieldCheck, Heart, Crown, ArrowLeft, BarChart2, Clock, Plus, Eye } from 'lucide-react';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { useTheme } from '../context/ThemeContext';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
      if (a === 'beta') return <Badge key={a} variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-2 py-1"><Rocket size={14} className="mr-1.5" /> Бета-тестер</Badge>;
      if (a === 'staff') return <Badge key={a} variant="secondary" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2 py-1"><ShieldCheck size={14} className="mr-1.5" /> Команда</Badge>;
      if (a === 'sponsor') return <Badge key={a} variant="secondary" className="bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 px-2 py-1"><Heart size={14} className="mr-1.5" /> Спонсор</Badge>;
      if (a === 'premium') return <Badge key={a} variant="secondary" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 px-2 py-1"><Gem size={14} className="mr-1.5" /> Loomy Premium</Badge>;
      return null;
    });
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <div className={`w-full md:w-80 md:min-w-80 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col transition-transform duration-300 ${showSidebarOnMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} fixed md:relative z-20 h-full`}>
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors group"
            onClick={() => { setProfileView(user); setShowProfileModal(true); }}
          >
            <Avatar className={`h-10 w-10 border border-white/10 ${hasPremium(user) ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-background' : ''}`}>
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
                {user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-sm leading-tight flex items-center gap-1 group-hover:text-purple-400 transition-colors">
                {user.name}
              </span>
              <span className="text-xs text-muted-foreground">@{user.username}</span>
            </div>
          </div>
          
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full" onClick={() => setShowCreateGroupModal(true)}>
              <Users size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full" onClick={toggleTheme}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full" onClick={handleLogout}>
              <LogOut size={16} />
            </Button>
          </div>
        </div>
        
        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Поиск..." 
              value={searchQuery}
              onChange={handleSearch}
              className="pl-9 bg-black/20 border-white/10 focus-visible:ring-purple-500/50 rounded-full h-9 text-sm"
            />
          </div>
        </div>

        {/* Contacts */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-scrollbar">
          {searchQuery ? (
            searchResults.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">Ничего не найдено</div>
            ) : (
              searchResults.map(contact => (
                <div 
                  key={contact.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeContact?.id === contact.id ? 'bg-purple-500/20 border border-purple-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                  onClick={() => { setActiveContact(contact); setSearchQuery(''); setSearchResults([]); setShowSidebarOnMobile(false); }}
                >
                  <Avatar className="h-12 w-12 border border-white/10">
                    <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-900 text-white">
                      {contact.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-medium text-sm flex items-center gap-1.5 truncate">
                        {contact.id === 0 && <CheckCircle size={14} className="text-blue-500" />}
                        {contact.name}
                        {hasPremium(contact) && <Gem size={12} className="text-purple-400" />}
                        {contact.username.toLowerCase() === 'zell' && <Crown size={12} className="text-yellow-500" />}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">@{contact.username}</p>
                  </div>
                </div>
              ))
            )
          ) : (
            <>
              {contacts.length === 0 && <div className="text-center text-muted-foreground text-sm py-8">Нет контактов</div>}
              {contacts.map(contact => (
                <div 
                  key={contact.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeContact?.id === contact.id ? 'bg-purple-500/20 border border-purple-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                  onClick={() => { setActiveContact(contact); setShowSidebarOnMobile(false); }}
                >
                  <Avatar className={`h-12 w-12 border border-white/10 ${hasPremium(contact) ? 'ring-1 ring-purple-500 ring-offset-1 ring-offset-background' : ''}`}>
                    <AvatarFallback className={contact.isGroup ? 'bg-blue-500/20 text-blue-400' : 'bg-gradient-to-br from-zinc-700 to-zinc-900 text-white'}>
                      {contact.isGroup ? <Users size={20}/> : contact.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-medium text-sm flex items-center gap-1.5 truncate">
                        {contact.id === 0 && <CheckCircle size={14} className="text-blue-500" />}
                        {contact.name}
                        {hasPremium(contact) && <Gem size={12} className="text-purple-400" />}
                        {contact.username.toLowerCase() === 'zell' && <Crown size={12} className="text-yellow-500" />}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">@{contact.username}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className={`flex-1 flex flex-col bg-background/50 relative ${showSidebarOnMobile ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Aurora BG in chat area */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-screen overflow-hidden">
          <div className="absolute top-[20%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-purple-600/30 blur-[100px] animate-pulse"></div>
        </div>

        {activeContact ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-border bg-card/50 backdrop-blur-xl flex items-center px-4 gap-4 z-10 shrink-0">
              <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground rounded-full" onClick={() => setShowSidebarOnMobile(true)}>
                <ArrowLeft size={20} />
              </Button>
              
              <div 
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => { setProfileView(activeContact); setShowProfileModal(true); }}
              >
                <Avatar className="h-10 w-10 border border-white/10 group-hover:scale-105 transition-transform">
                  <AvatarFallback className={activeContact.isGroup ? 'bg-blue-500/20 text-blue-400' : 'bg-gradient-to-br from-zinc-700 to-zinc-900 text-white'}>
                    {activeContact.isGroup ? <Users size={18}/> : activeContact.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    {activeContact.id === 0 && <CheckCircle size={14} className="text-blue-500" />}
                    {activeContact.name} 
                    {hasPremium(activeContact) && <Gem size={12} className="text-purple-400" />}
                    {activeContact.username.toLowerCase() === 'zell' && <Badge variant="outline" className="text-[10px] h-4 px-1 bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Crown size={10} className="mr-1" /> STAFF</Badge>}
                  </h3>
                  <span className="text-xs text-muted-foreground">@{activeContact.username}</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 z-10 custom-scrollbar">
              {messages.map(msg => {
                const isSent = msg.senderId === user.id;
                const isPoll = msg.metadata?.type === 'poll';
                const isSecret = msg.metadata?.type === 'secret';
                const reactions = msg.metadata?.reactions || {};
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isSent ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    
                    <div className={`group relative max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm backdrop-blur-md border ${
                      isSecret 
                        ? 'bg-red-500/10 border-red-500/30 text-red-50' 
                        : isSent 
                          ? 'bg-purple-600/20 border-purple-500/30 text-white rounded-br-sm' 
                          : 'bg-card border-white/5 text-foreground rounded-bl-sm'
                    }`}>
                      
                      {isSecret ? (
                        revealedSecrets[msg.id] ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        ) : (
                          <div className="flex items-center gap-2 cursor-pointer text-red-300 hover:text-red-200 text-sm font-medium" onClick={() => revealSecret(msg.id)}>
                            <Eye size={16} /> <span>Секретное сообщение (10 сек)</span>
                          </div>
                        )
                      ) : isPoll ? (
                        <div className="space-y-4 min-w-[200px] sm:min-w-[280px]">
                          <p className="font-semibold text-[15px]">{msg.text}</p>
                          <div className="space-y-2">
                            {msg.metadata.options.map(opt => {
                              const totalVotes = msg.metadata.options.reduce((sum, o) => sum + o.votes.length, 0);
                              const percentage = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                              const hasVoted = opt.votes.includes(user.id);
                              return (
                                <div key={opt.id} onClick={() => handleVote(msg, opt.id)} className="cursor-pointer space-y-1.5 group/poll">
                                  <div className="flex justify-between text-sm">
                                    <span className={hasVoted ? 'text-purple-300 font-medium' : ''}>{opt.text}</span>
                                    <span className="font-semibold">{percentage}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${hasVoted ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-white/20 group-hover/poll:bg-white/30'}`} style={{ width: `${percentage}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-[11px] text-muted-foreground text-right pt-2 border-t border-white/5">
                            Всего голосов: {msg.metadata.options.reduce((sum, o) => sum + o.votes.length, 0)}
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{msg.text}</p>
                      )}
                      
                      <div className={`text-[11px] mt-2 opacity-60 flex items-center gap-1.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
                        {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      
                      {/* Reactions Display */}
                      {Object.keys(reactions).length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-3 ${isSent ? 'justify-end' : 'justify-start'}`}>
                          {Object.entries(reactions).map(([emoji, userIds]) => {
                            const hasReacted = userIds.includes(user.id);
                            return (
                              <Badge 
                                key={emoji} 
                                variant="outline" 
                                className={`cursor-pointer hover:scale-105 transition-transform px-1.5 py-0.5 text-xs gap-1 bg-black/20 ${hasReacted ? 'border-purple-500/50 text-purple-200' : 'border-white/10 text-muted-foreground'}`}
                                onClick={() => handleReact(msg, emoji)}
                              >
                                <span>{emoji}</span>
                                <span>{userIds.length}</span>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Add Reaction Button */}
                    <div className="mt-1 relative">
                      <button 
                        onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)} 
                        className={`text-[11px] text-muted-foreground hover:text-foreground transition-colors ${isSent ? 'mr-1' : 'ml-1'}`}
                      >
                        Ответить реакцией
                      </button>
                      {activeReactionMsgId === msg.id && (
                        <div className={`absolute z-50 mt-2 ${isSent ? 'right-0' : 'left-0'}`}>
                          <EmojiPicker onEmojiClick={(e) => handleReact(msg, e.emoji)} theme={isDark ? 'dark' : 'light'} width={280} height={350} />
                        </div>
                      )}
                    </div>
                    
                  </div>
                )
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-card/50 backdrop-blur-xl border-t border-border z-10 shrink-0">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-end gap-2">
                <div className="flex bg-black/20 border border-white/10 rounded-2xl p-1 gap-1">
                  <div className="relative">
                    <Button type="button" variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => setShowEmoji(!showEmoji)}>
                      <Smile size={20} />
                    </Button>
                    {showEmoji && (
                      <div className="absolute bottom-14 left-0 z-50 shadow-2xl">
                        <EmojiPicker onEmojiClick={onEmojiClick} theme={isDark ? 'dark' : 'light'} />
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => setShowCreatePollModal(true)} disabled={activeContact.id === 0}>
                    <BarChart2 size={20} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className={`rounded-xl h-10 w-10 ${isSecretMode ? 'bg-red-500/20 text-red-500 hover:text-red-400 hover:bg-red-500/30' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setIsSecretMode(!isSecretMode)} disabled={activeContact.id === 0}>
                    <Clock size={20} />
                  </Button>
                </div>
                
                <div className="flex-1 relative">
                  <Input 
                    type="text" 
                    placeholder={activeContact.id === 0 ? "Вы не можете отвечать системному боту" : "Напишите сообщение..."} 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    disabled={activeContact.id === 0}
                    className={`h-12 rounded-2xl bg-black/20 border-white/10 px-4 focus-visible:ring-purple-500/50 ${isSecretMode ? 'border-red-500/50 focus-visible:ring-red-500/50 placeholder:text-red-500/50 text-red-100' : ''}`}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={!messageText.trim() || activeContact.id === 0}
                  className={`h-12 w-12 rounded-2xl shrink-0 p-0 ${isSecretMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20'}`}
                >
                  <Send size={20} />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 z-10">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/5 flex items-center justify-center mb-6">
              <MessageCircle size={48} className="text-purple-400 opacity-80" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Выберите чат</h3>
            <p className="text-muted-foreground max-w-sm">Начните общение, выбрав контакт или группу в меню слева. Создавайте опросы и отправляйте исчезающие сообщения.</p>
          </div>
        )}
      </div>

      {/* MODALS */}
      
      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden">
          <div className={`h-32 w-full ${profileView && hasPremium(profileView) ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600' : 'bg-gradient-to-r from-zinc-800 to-zinc-900'}`}></div>
          
          <div className="px-6 pb-6 pt-0 relative">
            <div className="flex justify-center -mt-16 mb-4 relative z-10">
              <Avatar className={`h-32 w-32 border-4 border-background ${profileView && hasPremium(profileView) ? 'shadow-[0_0_30px_rgba(168,85,247,0.5)]' : ''}`}>
                <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-900 text-4xl text-white">
                  {profileView?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {profileView?.id === user?.id ? (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold flex items-center justify-center gap-2">
                    {user.name}
                    {hasPremium(user) && <Gem size={18} className="text-purple-400" />}
                  </h2>
                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Имя</label>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-black/20 border-white/10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">О себе</label>
                    <textarea 
                      value={editBio} 
                      onChange={e => setEditBio(e.target.value)} 
                      rows={3}
                      className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 custom-scrollbar"
                    />
                  </div>
                  
                  <div className="pt-2">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Достижения</label>
                    <div className="flex flex-wrap gap-2">
                      {renderAchievements(user.achievements)}
                      {!user.achievements?.includes('beta') && <div className="text-xs text-muted-foreground italic">Пока нет достижений</div>}
                    </div>
                  </div>
                  
                  <Button onClick={saveProfile} className="w-full bg-purple-600 hover:bg-purple-500 text-white mt-4">
                    Сохранить изменения
                  </Button>
                </div>
              </div>
            ) : profileView ? (
              <div className="space-y-6 text-center">
                <div>
                  <h2 className="text-xl font-bold flex items-center justify-center gap-2">
                    {profileView.id === 0 && <CheckCircle size={18} className="text-blue-500" />}
                    {profileView.name}
                    {hasPremium(profileView) && <Gem size={18} className="text-purple-400" />}
                    {profileView.username.toLowerCase() === 'zell' && <Crown size={14} className="text-yellow-500" />}
                  </h2>
                  <p className="text-sm text-muted-foreground">@{profileView.username}</p>
                </div>
                
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 text-left">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">О себе</label>
                  <p className={`text-sm ${hasPremium(profileView) ? 'text-purple-100 font-medium' : 'text-foreground'}`}>
                    {profileView.bio || 'Нет информации'}
                  </p>
                </div>
                
                <div className="text-left">
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Достижения</label>
                  <div className="flex flex-wrap gap-2">
                    {renderAchievements(profileView.achievements)}
                  </div>
                </div>
                
                {user?.username.toLowerCase() === 'zell' && profileView.id !== 0 && (
                  <div className="mt-6 pt-4 border-t border-red-500/20 text-left">
                    <label className="text-xs font-bold text-red-500 mb-2 block flex items-center gap-1"><ShieldCheck size={14}/> Панель администратора</label>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="border-pink-500/30 text-pink-500 hover:bg-pink-500/10 text-xs" onClick={() => handleGrantAchievement('sponsor')}>Выдать Спонсора</Button>
                      <Button variant="outline" size="sm" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs" onClick={() => handleGrantAchievement('premium')}>Выдать Premium</Button>
                      <Button variant="outline" size="sm" className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs" onClick={() => handleGrantAchievement('staff')}>Выдать Staff</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Group Modal */}
      <Dialog open={showCreateGroupModal} onOpenChange={setShowCreateGroupModal}>
        <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle>Создать группу</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Название группы</label>
              <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Design Team" className="bg-black/20 border-white/10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Участники (ID через запятую)</label>
              <Input 
                onChange={e => setSelectedMembers(e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)))} 
                placeholder="1, 2, 3" 
                className="bg-black/20 border-white/10" 
              />
              <p className="text-xs text-muted-foreground">Временное решение для беты. Введите ID пользователей.</p>
            </div>
            <Button onClick={handleCreateGroup} className="w-full bg-purple-600 hover:bg-purple-500 text-white mt-2">
              Создать пространство
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Poll Modal */}
      <Dialog open={showCreatePollModal} onOpenChange={setShowCreatePollModal}>
        <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur-xl border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle>Создать опрос</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Вопрос</label>
              <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Например: Куда пойдем на выходных?" className="bg-black/20 border-white/10" />
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Варианты ответа</label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input 
                    value={opt} 
                    onChange={e => { const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts); }} 
                    placeholder={`Вариант ${i+1}`} 
                    className="bg-black/20 border-white/10"
                  />
                  {pollOptions.length > 2 && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-red-400" onClick={() => { const newOpts = pollOptions.filter((_, idx) => idx !== i); setPollOptions(newOpts); }}>
                      <X size={16}/>
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            {pollOptions.length < 10 && (
              <Button variant="outline" className="w-full border-dashed border-white/20 hover:bg-white/5" onClick={() => setPollOptions([...pollOptions, ''])}>
                <Plus size={16} className="mr-2"/> Добавить вариант
              </Button>
            )}
            
            <Button onClick={handleSendPoll} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white mt-4 border-0">
              Отправить опрос
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Chat;
