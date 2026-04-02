import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../utils/firebase';

const loginStyles = `
  @media (max-width: 480px) {
    .login-container {
      padding: 1.5rem !important;
    }
    .login-logo {
      max-width: 240px !important;
      max-height: 55px !important;
    }
  }
`;

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess();
    } catch (err: any) {
      setError('Invalid email or password');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{loginStyles}</style>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #002147 0%, #1e3a8a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        boxSizing: 'border-box'
      }}>
        <div 
          className="login-container"
          style={{
            background: 'white',
            borderRadius: '20px',
            padding: '3rem',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center',
            boxSizing: 'border-box'
          }}
        >
          <img 
            src="/assets/spireslogo.svg" 
            alt="Spires Taxis" 
            className="login-logo"
            style={{
              height: 'auto',
              width: '100%',
              maxWidth: '280px',
              maxHeight: '65px',
              marginBottom: '1rem',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto 1rem auto'
            }}
          />
        <p style={{
          color: '#C5A572',
          fontWeight: 500,
          marginBottom: '2rem',
          fontSize: '0.9rem'
        }}>
          Admin Dashboard Access
        </p>

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '0.75rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              color: '#002147',
              fontWeight: 600,
              marginBottom: '0.5rem',
              fontSize: '0.9rem'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '1rem',
                background: '#f8fafc'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              color: '#002147',
              fontWeight: 600,
              marginBottom: '0.5rem',
              fontSize: '0.9rem'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '1rem',
                background: '#f8fafc'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #002147 0%, #1e3a8a 100%)',
              color: 'white',
              padding: '1rem',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              marginTop: '1rem'
            }}
          >
            {loading ? 'Checking...' : 'Access Dashboard'}
          </button>
        </form>

        <div style={{
          background: '#f0f9ff',
          color: '#0c4a6e',
          padding: '1rem',
          borderRadius: '8px',
          marginTop: '1.5rem',
          fontSize: '0.85rem',
          borderLeft: '4px solid #002147'
        }}>
          <strong>🔒 Secure Access</strong><br />
          This area is restricted to authorized personnel only.
        </div>
      </div>
    </div>
    </>
  );
};

export default Login;