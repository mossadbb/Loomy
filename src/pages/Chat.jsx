import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Search, LogOut, User, MessageCircle, Moon, Sun, Edit3, X, Smile, CheckCircle, Gem, Rocket, ShieldCheck, Heart, Crown, ArrowLeft } from 'lucide-react';
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

    // Connect to Socket
    socketRef.current = io('/', { path: '/socket.io' });
    socketRef.current.emit('register_user', parsedUser.id);

    socketRef.current.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    fetchContacts(parsedUser.id);

    return () => {
      socketRef.current.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (activeContact && user) {
      fetchMessages(user.id, activeContact.id);
    }
  }, [activeContact, user]);

  const fetchContacts = async (currentUserId) => {
    try {
      const res = await fetch(`/api/users/contacts/${currentUserId}`);
      const data = await res.json();
      setContacts(data);
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

  const fetchMessages = async (userId, contactId) => {
    try {
      const res = await fetch(`/api/messages/${userId}`);
      const data = await res.json();
      const filtered = data.filter(
        m => (m.senderId === userId && m.receiverId === contactId) ||
             (m.senderId === contactId && m.receiverId === userId)
      );
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
      receiverId: activeContact.id,
      text: messageText,
    };
    
    socketRef.current.emit('send_message', newMsg);
    setMessageText('');
    setShowEmoji(false);
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
                        {contact.username.toLowerCase() === 'zell' && <span className="admin-badge" title="Администратор"><Crown size={12} style={{marginRight: '4px'}} /> STAFF</span>}
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
                    {contact.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-details">
                    <div className="contact-top">
                      <h4>
                        {contact.id === 0 && <CheckCircle size={14} className="verified-badge" title="Loomy Support" style={{marginRight: '4px'}} />}
                        {contact.name} 
                        {hasPremium(contact) && <Gem size={14} title="Loomy Premium" style={{color: '#a855f7', marginLeft: '4px'}} />}
                        {contact.username.toLowerCase() === 'zell' && <span className="admin-badge" title="Администратор"><Crown size={12} style={{marginRight: '4px'}} /> STAFF</span>}
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
                <div className="avatar">{activeContact.name?.charAt(0).toUpperCase()}</div>
                <div>
                  <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', margin: 0}}>
                    {activeContact.id === 0 && <CheckCircle size={16} className="verified-badge" />}
                    {activeContact.name} 
                    {hasPremium(activeContact) && <Gem size={16} style={{color: '#a855f7'}} title="Loomy Premium" />}
                    {activeContact.username.toLowerCase() === 'zell' && <span className="admin-badge" style={{display: 'flex', alignItems: 'center'}}><Crown size={12} style={{marginRight: '4px'}} /> STAFF</span>}
                  </h3>
                  <span className="status">@{activeContact.username}</span>
                </div>
                </div>
              </div>
            </div>

            <div className="messages-list">
              {messages.map(msg => (
                <div key={msg.id} className={`message-wrapper ${msg.senderId === user.id ? 'sent' : 'received'}`}>
                  <div className="message-bubble">
                    <p>{msg.text}</p>
                    <span className="message-time">
                      {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="message-input-area">
              <div className="input-actions">
                <button 
                  type="button" 
                  className="icon-btn emoji-btn" 
                  onClick={() => setShowEmoji(!showEmoji)}
                >
                  <Smile size={24} />
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
          <div className="profile-modal glass-panel" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowProfileModal(false)}><X size={24} /></button>
            
            <div className="profile-avatar">
              <User size={48} />
            </div>
            
            {profileView.id === user.id ? (
              <div className="profile-edit">
                <h2 style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
                  {user.name} 
                  {hasPremium(user) && <Gem size={20} style={{color: '#a855f7'}} title="Loomy Premium" />}
                  {user.username.toLowerCase() === 'zell' && <span className="admin-badge" style={{display: 'flex', alignItems: 'center'}}><Crown size={14} style={{marginRight: '4px'}} /> STAFF</span>}
                </h2>
                <div className="form-group">
                  <label>Юзернейм (только чтение)</label>
                  <input type="text" value={`@${user.username}`} disabled />
                </div>
                <div className="form-group">
                  <label>Имя</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>О себе (Bio)</label>
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows="3" />
                </div>
                <div className="achievements-section">
                  <h4>Достижения</h4>
                  <div className="achievements-list">
                    {renderAchievements(user.achievements)}
                  </div>
                </div>
                <button onClick={saveProfile} className="btn-primary">Сохранить</button>
              </div>
            ) : (
              <div className="profile-view">
                <h2 style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
                  {profileView.id === 0 && <CheckCircle size={20} className="verified-badge" />}
                  {profileView.name}
                  {hasPremium(profileView) && <Gem size={20} style={{color: '#a855f7'}} title="Loomy Premium" />}
                  {profileView.username.toLowerCase() === 'zell' && <span className="admin-badge" style={{display: 'flex', alignItems: 'center'}}><Crown size={14} style={{marginRight: '4px'}} /> STAFF</span>}
                </h2>
                <span className="profile-username">@{profileView.username}</span>
                <div className="profile-bio">
                  <h4>О себе</h4>
                  <p className={hasPremium(profileView) ? "premium-bio" : ""}>
                    {profileView.bio || 'Нет информации'}
                  </p>
                </div>
                <div className="achievements-section">
                  <h4>Достижения</h4>
                  <div className="achievements-list">
                    {renderAchievements(profileView.achievements)}
                  </div>
                </div>
                
                {user.username.toLowerCase() === 'zell' && profileView.id !== 0 && (
                  <div className="admin-actions" style={{marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', width: '100%'}}>
                    <h4 style={{textAlign: 'left', marginBottom: '8px', color: '#ef4444'}}>Панель администратора</h4>
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                      <button className="btn-secondary" onClick={() => handleGrantAchievement('sponsor')} style={{fontSize: '0.8rem', padding: '6px 12px'}}>Выдать Спонсора</button>
                      <button className="btn-secondary" onClick={() => handleGrantAchievement('premium')} style={{fontSize: '0.8rem', padding: '6px 12px'}}>Выдать Premium</button>
                      <button className="btn-secondary" onClick={() => handleGrantAchievement('staff')} style={{fontSize: '0.8rem', padding: '6px 12px'}}>Выдать Staff</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
