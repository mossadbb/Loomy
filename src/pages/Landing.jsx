import { Link } from 'react-router-dom';
import { MessageCircle, Shield, Zap, ArrowRight, Sparkles, Globe, Lock } from 'lucide-react';
import './Landing.css';

const Landing = () => {
  return (
    <div className="landing-container">
      {/* Background Blobs for UI/UX visual pop */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      <nav className="navbar glass-panel">
        <div className="logo">
          <div className="logo-icon-wrapper">
            <MessageCircle className="logo-icon" size={24} />
          </div>
          <span className="logo-text">Loomy</span>
          <span className="beta-badge">BETA</span>
        </div>
        <div className="nav-links">
          <Link to="/auth" className="btn-ghost">Войти</Link>
          <Link to="/auth?mode=register" className="btn-primary-glow">
            Начать сейчас
          </Link>
        </div>
      </nav>

      <main className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={16} className="text-accent" />
            <span>Новое поколение общения</span>
          </div>
          <h1 className="hero-title">
            Мессенджер, который <br/>
            работает <span className="text-gradient">прямо в браузере</span>
          </h1>
          <p className="hero-subtitle">
            Откройте для себя Loomy — быстрый, бесплатный и безопасный мессенджер. 
            Никаких установок, мгновенный доступ с любого устройства.
          </p>
          <div className="hero-actions">
            <Link to="/auth?mode=register" className="btn-primary-glow btn-large">
              Попробовать бесплатно <ArrowRight size={20} className="icon-right" />
            </Link>
            <Link to="/auth" className="btn-secondary btn-large">
              Уже есть аккаунт
            </Link>
          </div>
          
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-value">0</span>
              <span className="stat-label">Секунд на установку</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">100%</span>
              <span className="stat-label">Анонимность</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">24/7</span>
              <span className="stat-label">Синхронизация</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          {/* Mockup of the app */}
          <div className="app-mockup glass-panel">
            <div className="mockup-header">
              <div className="window-controls">
                <span></span><span></span><span></span>
              </div>
              <div className="window-title">loomy.app / @zell</div>
            </div>
            <div className="mockup-body">
              <div className="mockup-sidebar">
                <div className="mockup-item active"></div>
                <div className="mockup-item"></div>
                <div className="mockup-item"></div>
              </div>
              <div className="mockup-chat">
                <div className="mockup-message received">
                  <div className="mockup-bubble">Привет! Зацени новый дизайн Loomy! 🚀</div>
                </div>
                <div className="mockup-message sent">
                  <div className="mockup-bubble">Выглядит просто невероятно! 😍</div>
                </div>
                <div className="mockup-input"></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="features-section">
        <div className="section-header">
          <h2>Почему именно <span className="text-gradient">Loomy</span>?</h2>
          <p>Мы переосмыслили то, каким должен быть современный мессенджер.</p>
        </div>
        
        <div className="features-grid">
          <div className="feature-card glass-card hover-tilt">
            <div className="feature-icon-wrapper bg-blue">
              <Zap className="feature-icon" size={28} />
            </div>
            <h3>Молниеносная скорость</h3>
            <p>Технология WebSockets обеспечивает мгновенную доставку каждого сообщения без задержек.</p>
          </div>
          <div className="feature-card glass-card hover-tilt">
            <div className="feature-icon-wrapper bg-purple">
              <Lock className="feature-icon" size={28} />
            </div>
            <h3>Тотальная безопасность</h3>
            <p>Никаких сборов почты и телефонов. Регистрация только по юзернейму для вашей приватности.</p>
          </div>
          <div className="feature-card glass-card hover-tilt">
            <div className="feature-icon-wrapper bg-orange">
              <Globe className="feature-icon" size={28} />
            </div>
            <h3>Доступ отовсюду</h3>
            <p>Открывайте Loomy на телефоне, планшете или ПК прямо в браузере. Данные всегда синхронизированы.</p>
          </div>
        </div>
      </section>
      
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <MessageCircle size={20} />
            <span>Loomy</span>
          </div>
          <p>&copy; {new Date().getFullYear()} Разработано с ❤️ в рамках открытого бета-теста.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
