import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import './Auth.css';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(searchParams.get('mode') === 'register' ? 'register' : 'login');
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value.trim() });
    setError('');
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/register' : '/api/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка авторизации');
      }

      localStorage.setItem('loomy_user', JSON.stringify(data));
      navigate('/chat');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className="page-container auth-page">
      <Link to="/" className="back-btn">
        <ArrowLeft size={20} /> На главную
      </Link>
      
      <div className="auth-container glass-panel">
        <div className="auth-header">
          <MessageCircle className="logo-icon" size={40} />
          <h2>{mode === 'login' ? 'С возвращением!' : 'Создать аккаунт'}</h2>
          <p>{mode === 'login' ? 'Войдите, чтобы продолжить общение' : 'Присоединяйтесь к открытому бета-тесту Loomy'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>Юзернейм</label>
            <input 
              type="text" 
              name="username" 
              placeholder="@username" 
              value={formData.username}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group">
            <label>Пароль</label>
            <input 
              type="password" 
              name="password" 
              placeholder="••••••••" 
              value={formData.password}
              onChange={handleChange}
            />
          </div>
          
          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? 'Загрузка...' : (mode === 'login' ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <p>Нет аккаунта? <button type="button" onClick={toggleMode} className="switch-btn">Создать</button></p>
          ) : (
            <p>Уже есть аккаунт? <button type="button" onClick={toggleMode} className="switch-btn">Войти</button></p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
