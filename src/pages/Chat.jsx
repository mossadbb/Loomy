import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Search, LogOut, User, Users, MessageCircle, Moon, Sun, Edit3, X, Smile, CheckCircle, Gem, Rocket, ShieldCheck, Heart, Crown, ArrowLeft, BarChart2, Clock, Plus, Eye } from 'lucide-react';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { useTheme } from '../context/ThemeContext';
import './Chat.css';

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
  const [profileView, setProfileView] = useState(null); // The user being viewed
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
  const [revealedSecrets, setRevealedSecrets] = useState({}); // msgId -> boolean

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
          // Prevent duplicates
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
      opt.votes = opt.votes.filter(id => id !== user.id); // remove existing vote
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
        // Update contact list locally
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
      if (a === 'beta') return <div key={a} className="achievement"><Rocket size={16} className="achievement-icon" style={{color: '#3b82f6'}} /><span className="achievement-text">Бета-тестер</span></div>;
      if (a === 'staff') return <div key={a} className="achievement"><ShieldCheck size={16} className="achievement-icon" style={{color: '#ef4444'}} /><span className="achievement-text">Команда</span></div>;
      if (a === 'sponsor') return <div key={a} className="achievement"><Heart size={16} className="achievement-icon" style={{color: '#ec4899'}} /><span className="achievement-text">Спонсор</span></div>;
      if (a === 'premium') return <div key={a} className="achievement"><Gem size={16} className="achievement-icon" style={{color: '#a855f7'}} /><span className="achievement-text">Loomy Premium</span></div>;
      return null;
    });
  };

  if (!user) return null;

  return (
    <div className="chat-container">
      <div className={`sidebar glass-panel mobile-sidebar-${showSidebarOnMobile ? 'show' : 'hide'}`}>
        <div className="sidebar-header">
          <div 
            className="user-profile clickable" 
            onClick={() => { setProfileView(user); setShowProfileModal(true); }}
            title="Мой профиль"
          >
            <div className="avatar bg-gradient">
              <User size={20} />
            </div>
            <div className="user-info">
              <h3>{user.name}</h3>
              <span className="status">@{user.username}</span>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={() => setShowCreateGroupModal(true)} className="icon-btn" title="Создать группу">
              <Users size={20} />
            </button>
            <button onClick={toggleTheme} className="icon-btn" title="Сменить тему">
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={handleLogout} className="icon-btn" title="Выйти">
              <LogOut size={20} />
            </button>
          </div>
        </div>
        
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Поиск по юзернейму..." 
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>

        <div className="contacts-list">
          {searchQuery ? (
            searchResults.length === 0 ? (
              <p className="no-contacts">Ничего не найдено</p>
            ) : (
              searchResults.map(contact => (
                <div 
                  key={contact.id} 
                  className={`contact-item ${activeContact?.id === contact.id ? 'active' : ''}`}
                  onClick={() => { setActiveContact(contact); setSearchQuery(''); setSearchResults([]); setShowSidebarOnMobile(false); }}
                >
                  <div className="avatar">
                    {contact.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-details">
                    <div className="contact-top">
                      <h4>
                        {contact.id === 0 && <CheckCircle size={14} className="verified-badge" title="Loomy Support" style={{marginRight: '4px'}} />}
                        {contact.name} 
                        {hasPremium(contact) && <Gem size={14} title="Loomy Premium" style={{color: '#a855f7', marginLeft: '4px'}} />}
                        {contact.username?.toLowerCase() === 'zell' && <span className="admin-badge" title="Администратор"><Crown size={12} style={{marginRight: '4px'}} /> STAFF</span>}
                      </h4>
                    </div>
                    <div className="contact-bottom">
                      <p className="last-message">@{contact.username}</p>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            <>
              {contacts.length === 0 && <p className="no-contacts">Нет контактов</p>}
              {contacts.map(contact => (
                <div 
                  key={contact.id} 
                  className={`contact-item ${activeContact?.id === contact.id ? 'active' : ''}`}
                  onClick={() => { setActiveContact(contact); setShowSidebarOnMobile(false); }}
                >
                  <div className="avatar">
                    {contact.isGroup ? <Users size={20}/> : contact.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-details">
                    <div className="contact-top">
                      <h4>
                        {contact.id === 0 && <CheckCircle size={14} className="verified-badge" title="Loomy Support" style={{marginRight: '4px'}} />}
                        {contact.name} 
                        {hasPremium(contact) && <Gem size={14} title="Loomy Premium" style={{color: '#a855f7', marginLeft: '4px'}} />}
                        {contact.username?.toLowerCase() === 'zell' && <span className="admin-badge" title="Администратор"><Crown size={12} style={{marginRight: '4px'}} /> STAFF</span>}
                      </h4>
                    </div>
                    <div className="contact-bottom">
                      <p className="last-message">@{contact.username}</p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={`chat-area glass-panel mobile-chat-${showSidebarOnMobile ? 'hide' : 'show'}`}>
        {activeContact ? (
          <>
            <div className="chat-header">
              <div className="chat-header-info">
                <button 
                  className="icon-btn mobile-back-btn" 
                  onClick={() => setShowSidebarOnMobile(true)}
                  title="Назад"
                >
                  <ArrowLeft size={24} />
                </button>
                <div 
                  className="clickable" 
                  onClick={() => { setProfileView(activeContact); setShowProfileModal(true); }}
                  style={{display: 'flex', alignItems: 'center', gap: '12px'}}
                >
                <div className="avatar">{activeContact.isGroup ? <Users size={24}/> : activeContact.name?.charAt(0).toUpperCase()}</div>
                <div>
                  <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', margin: 0}}>
                    {activeContact.id === 0 && <CheckCircle size={16} className="verified-badge" />}
                    {activeContact.name} 
                    {hasPremium(activeContact) && <Gem size={16} style={{color: '#a855f7'}} title="Loomy Premium" />}
                    {activeContact.username?.toLowerCase() === 'zell' && <span className="admin-badge" style={{display: 'flex', alignItems: 'center'}}><Crown size={12} style={{marginRight: '4px'}} /> STAFF</span>}
                  </h3>
                  <span className="status">@{activeContact.username}</span>
                </div>
                </div>
              </div>
            </div>

            <div className="messages-list">
              {messages.map(msg => {
                const isPoll = msg.metadata?.type === 'poll';
                const isSecret = msg.metadata?.type === 'secret';
                const reactions = msg.metadata?.reactions || {};
                
                return (
                <div key={msg.id} className={`message-wrapper ${msg.senderId === user.id ? 'sent' : 'received'}`}>
                  <div className="message-bubble" style={isSecret ? {background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444'} : {}}>
                    
                    {isSecret ? (
                      revealedSecrets[msg.id] ? (
                        <p>{msg.text}</p>
                      ) : (
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}} onClick={() => revealSecret(msg.id)}>
                          <Eye size={16} /> <span>Секретное сообщение (10 сек) - Нажми чтобы открыть</span>
                        </div>
                      )
                    ) : isPoll ? (
                      <div className="poll-container">
                        <p style={{fontWeight: 'bold', marginBottom: '12px'}}>{msg.text}</p>
                        {msg.metadata.options.map(opt => {
                          const totalVotes = msg.metadata.options.reduce((sum, o) => sum + o.votes.length, 0);
                          const percentage = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                          const hasVoted = opt.votes.includes(user.id);
                          return (
                            <div key={opt.id} className="poll-option" onClick={() => handleVote(msg, opt.id)} style={{cursor: 'pointer', marginBottom: '8px', background: 'var(--color-input-bg)', borderRadius: '4px', overflow: 'hidden', position: 'relative'}}>
                              <div style={{position: 'absolute', top: 0, left: 0, bottom: 0, width: `${percentage}%`, background: hasVoted ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.1)', zIndex: 1, transition: 'width 0.3s ease'}}></div>
                              <div style={{position: 'relative', zIndex: 2, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem'}}>
                                <span>{opt.text}</span>
                                <span>{percentage}%</span>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '8px', textAlign: 'right'}}>Всего голосов: {msg.metadata.options.reduce((sum, o) => sum + o.votes.length, 0)}</div>
                      </div>
                    ) : (
                      <p>{msg.text}</p>
                    )}
                    
                    <span className="message-time">
                      {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    
                    {/* Reactions Bar */}
                    {Object.keys(reactions).length > 0 && (
                      <div className="message-reactions" style={{display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap'}}>
                        {Object.entries(reactions).map(([emoji, userIds]) => (
                          <div key={emoji} onClick={() => handleReact(msg, emoji)} style={{background: userIds.includes(user.id) ? 'rgba(139, 92, 246, 0.3)' : 'var(--color-hover-bg)', padding: '2px 6px', borderRadius: '12px', fontSize: '0.8rem', cursor: 'pointer', border: userIds.includes(user.id) ? '1px solid var(--color-accent-primary)' : '1px solid transparent', color: 'var(--color-text-primary)'}}>
                            {emoji} {userIds.length}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="reaction-trigger" onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)} style={{fontSize: '0.75rem', color: 'var(--color-text-secondary)', cursor: 'pointer', marginTop: '4px', alignSelf: msg.senderId === user.id ? 'flex-end' : 'flex-start', opacity: 0.7}}>
                    Добавить реакцию
                  </div>
                  {activeReactionMsgId === msg.id && (
                    <div style={{position: 'absolute', zIndex: 50, marginTop: '20px', alignSelf: msg.senderId === user.id ? 'flex-end' : 'flex-start'}}>
                      <EmojiPicker onEmojiClick={(e) => handleReact(msg, e.emoji)} theme={isDark ? 'dark' : 'light'} width={280} height={350}/>
                    </div>
                  )}
                </div>
              )})}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="message-input-area">
              <div className="input-actions" style={{display: 'flex', gap: '4px'}}>
                <button type="button" className="icon-btn emoji-btn" onClick={() => setShowEmoji(!showEmoji)} title="Эмодзи">
                  <Smile size={24} />
                </button>
                <button type="button" className="icon-btn emoji-btn" onClick={() => setShowCreatePollModal(true)} title="Опрос" disabled={activeContact.id === 0}>
                  <BarChart2 size={24} />
                </button>
                <button type="button" className={`icon-btn emoji-btn ${isSecretMode ? 'active' : ''}`} onClick={() => setIsSecretMode(!isSecretMode)} style={{color: isSecretMode ? '#ef4444' : ''}} title="Секретное сообщение (10 сек)" disabled={activeContact.id === 0}>
                  <Clock size={24} />
                </button>
                {showEmoji && (
                  <div className="emoji-picker-container">
                    <EmojiPicker onEmojiClick={onEmojiClick} theme={isDark ? 'dark' : 'light'} />
                  </div>
                )}
              </div>
              <input 
                type="text" 
                placeholder={activeContact.id === 0 ? "Вы не можете отвечать системному боту" : "Напишите сообщение..."} 
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={activeContact.id === 0}
                style={isSecretMode ? {border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.1)'} : {}}
              />
              <button type="submit" className="send-btn" disabled={!messageText.trim() || activeContact.id === 0}>
                <Send size={20} />
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat">
            <MessageCircle size={48} className="empty-icon" />
            <h3>Выберите чат</h3>
            <p>Чтобы начать общение, выберите контакт слева</p>
          </div>
        )}
      </div>

      {showProfileModal && profileView && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            
            <div className={`profile-banner ${hasPremium(profileView) ? 'premium-banner' : ''}`}>
              <button className="close-btn" onClick={() => setShowProfileModal(false)}><X size={20} /></button>
            </div>
            
            <div className="profile-avatar-wrapper">
              <div className={`profile-avatar ${hasPremium(profileView) ? 'premium-avatar-glow' : ''}`}>
                <User size={48} />
              </div>
            </div>
            
            <div className="profile-content-container">
              <div className="profile-inner-card">
              {profileView.id === user.id ? (
                <div className="profile-edit-form">
                  <div className="profile-username-section" style={{borderBottom: 'none'}}>
                    <div>
                      <h2 className="profile-username">
                        {user.name} 
                        {hasPremium(user) && <Gem size={20} style={{color: '#a855f7'}} title="Loomy Premium" />}
                      </h2>
                      <span className="profile-handle">@{user.username}</span>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Имя</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>О себе</label>
                    <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows="3" />
                  </div>
                  
                  <div className="achievements-section">
                    <h4 className="section-title">Значки профиля</h4>
                    <div className="achievements-list">
                      {renderAchievements(user.achievements)}
                      {user.username?.toLowerCase() === 'zell' && <div className="achievement" style={{background: '#da373c', color: '#fff'}}><Crown size={16}/> Staff</div>}
                    </div>
                  </div>
                  
                  <div className="profile-actions">
                    <button onClick={saveProfile} className="discord-btn" style={{flex: 1}}>Сохранить изменения</button>
                    <button onClick={handleLogout} className="discord-btn danger" title="Выйти"><LogOut size={18} /></button>
                  </div>
                </div>
              ) : (
                <div className="profile-view">
                  <div className="profile-username-section">
                    <div>
                      <h2 className="profile-username">
                        {profileView.id === 0 && <CheckCircle size={20} style={{color: '#fff'}} />}
                        {profileView.name}
                      </h2>
                      <span className="profile-handle">@{profileView.username}</span>
                    </div>
                    
                    <div className="badges-container">
                      {hasPremium(profileView) && <div className="badge-icon" title="Loomy Premium"><Gem size={18} style={{color: '#a855f7'}}/></div>}
                      {profileView.username?.toLowerCase() === 'zell' && <div className="badge-icon" title="Staff"><Crown size={18} style={{color: '#da373c'}}/></div>}
                      {profileView.id === 0 && <div className="badge-icon" title="System"><ShieldCheck size={18} style={{color: '#3ba55e'}}/></div>}
                    </div>
                  </div>
                  
                  <div className="profile-bio">
                    <h4 className="section-title">Обо мне</h4>
                    <p className={hasPremium(profileView) ? "premium-bio" : ""}>
                      {profileView.bio || 'Этот пользователь пока ничего не написал о себе.'}
                    </p>
                  </div>
                  
                  <div className="achievements-section">
                    <h4 className="section-title">Роли и достижения</h4>
                    <div className="achievements-list">
                      {renderAchievements(profileView.achievements)}
                    </div>
                  </div>
                  
                  <div className="profile-actions">
                    <button className="discord-btn" style={{flex: 1}} onClick={() => { setActiveContact(profileView); setShowProfileModal(false); }}>
                      <MessageCircle size={18} /> Написать сообщение
                    </button>
                    <button className="discord-btn secondary" title="Добавить в друзья (Скоро)">
                      <Users size={18} />
                    </button>
                  </div>
                  
                  {user.username?.toLowerCase() === 'zell' && profileView.id !== 0 && (
                    <div className="admin-actions">
                      <h4 className="section-title" style={{color: '#da373c'}}>Панель администратора</h4>
                      <div className="profile-actions">
                        <button className="discord-btn secondary" onClick={() => handleGrantAchievement('sponsor')}>Спонсор</button>
                        <button className="discord-btn secondary" onClick={() => handleGrantAchievement('premium')}>Premium</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showCreateGroupModal && (
        <div className="modal-overlay" onClick={() => setShowCreateGroupModal(false)}>
          <div className="profile-modal glass-panel" onClick={e => e.stopPropagation()} style={{padding: '32px', maxWidth: '400px'}}>
            <button className="close-btn" onClick={() => setShowCreateGroupModal(false)}><X size={24} /></button>
            <h2 style={{marginBottom: '24px'}}>Создать группу</h2>
            <div className="form-group" style={{width: '100%', marginBottom: '16px'}}>
              <label>Название группы</label>
              <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Моя супер группа" style={{width: '100%', padding: '12px', background: 'var(--color-input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--color-text-primary)'}}/>
            </div>
            <div className="form-group" style={{width: '100%', marginBottom: '24px'}}>
              <label>Участники (ID через запятую, временно для теста)</label>
              <input type="text" onChange={e => setSelectedMembers(e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)))} placeholder="1, 2, 3" style={{width: '100%', padding: '12px', background: 'var(--color-input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--color-text-primary)'}}/>
            </div>
            <button className="btn-primary" onClick={handleCreateGroup} style={{width: '100%'}}>Создать</button>
          </div>
        </div>
      )}

      {showCreatePollModal && (
        <div className="modal-overlay" onClick={() => setShowCreatePollModal(false)}>
          <div className="profile-modal glass-panel" onClick={e => e.stopPropagation()} style={{padding: '32px', maxWidth: '400px', display: 'block', margin: 'auto', alignSelf: 'center'}}>
            <button className="close-btn" onClick={() => setShowCreatePollModal(false)}><X size={24} /></button>
            <h2 style={{marginBottom: '24px'}}>Создать опрос</h2>
            
            <div className="form-group" style={{width: '100%', marginBottom: '16px'}}>
              <label>Вопрос</label>
              <input type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Например: Как дела?" style={{width: '100%', padding: '12px', background: 'var(--color-input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--color-text-primary)'}}/>
            </div>
            
            <label style={{display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)'}}>Варианты ответа</label>
            {pollOptions.map((opt, i) => (
              <div key={i} style={{width: '100%', marginBottom: '12px', display: 'flex', gap: '8px'}}>
                <input type="text" value={opt} onChange={e => { const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts); }} placeholder={`Вариант ${i+1}`} style={{flex: 1, padding: '12px', background: 'var(--color-input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--color-text-primary)'}}/>
                {pollOptions.length > 2 && (
                  <button className="icon-btn" onClick={() => { const newOpts = pollOptions.filter((_, idx) => idx !== i); setPollOptions(newOpts); }}><X size={20}/></button>
                )}
              </div>
            ))}
            
            {pollOptions.length < 10 && (
              <button className="btn-secondary" onClick={() => setPollOptions([...pollOptions, ''])} style={{width: '100%', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'var(--color-hover-bg)'}}>
                <Plus size={18}/> Добавить вариант
              </button>
            )}
            
            <button className="btn-primary" onClick={handleSendPoll} style={{width: '100%', padding: '14px', borderRadius: '8px'}}>Создать опрос</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;
