import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MessageCircle, ArrowLeft, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Animated Aurora Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/30 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft size={16} /> На главную
        </Link>
        
        <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <MessageCircle size={32} />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight">
                {mode === 'login' ? 'С возвращением!' : 'Создать аккаунт'}
              </CardTitle>
              <CardDescription className="text-base">
                {mode === 'login' ? 'Войдите, чтобы продолжить общение' : 'Присоединяйтесь к открытому бета-тесту Loomy'}
              </CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg text-center font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                  Юзернейм
                </label>
                <Input 
                  type="text" 
                  name="username" 
                  placeholder="@username" 
                  value={formData.username}
                  onChange={handleChange}
                  className="bg-black/20 border-white/10 focus-visible:ring-purple-500/50"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                  Пароль
                </label>
                <Input 
                  type="password" 
                  name="password" 
                  placeholder="••••••••" 
                  value={formData.password}
                  onChange={handleChange}
                  className="bg-black/20 border-white/10 focus-visible:ring-purple-500/50"
                />
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/25 border-0" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  mode === 'login' ? 'Войти' : 'Зарегистрироваться'
                )}
              </Button>
              
              <div className="text-sm text-center text-muted-foreground w-full">
                {mode === 'login' ? (
                  <>
                    Нет аккаунта?{' '}
                    <button type="button" onClick={toggleMode} className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                      Создать
                    </button>
                  </>
                ) : (
                  <>
                    Уже есть аккаунт?{' '}
                    <button type="button" onClick={toggleMode} className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                      Войти
                    </button>
                  </>
                )}
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
