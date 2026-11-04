import { useState, useEffect } from 'react';
import { adminLogin } from '../../../services/api';
import { getAdminSession } from '../../../services/adminAuth';

export default function AdminLoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const existing = getAdminSession();
    if (existing) {
      window.location.replace('/admin');
      return;
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const reason = params.get('reason');
      if (reason === 'expired') {
        setErrorMessage(
          'Tu sesión administrativa expiró o no es válida. Por favor iniciá sesión nuevamente.'
        );
      } else if (reason === 'forbidden') {
        setErrorMessage(
          'Acceso denegado (403): el servidor rechazó la solicitud porque la sesión no posee permisos de administrador (ROLE_ADMIN).'
        );
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!username.trim() || !password) {
      setErrorMessage('Por favor ingresá tu usuario y contraseña.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await adminLogin(username, password);
      setPassword('');
      window.location.replace('/admin');
    } catch (err) {
      setPassword('');
      setErrorMessage(
        err?.message ||
          'No se pudo iniciar sesión. Verificá tus credenciales e intentá nuevamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Bar: Return to Store */}
      <div className="mx-auto w-full max-w-7xl flex items-center justify-between">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-brand-dark/65 hover:text-brand-dark transition-colors"
        >
          <span aria-hidden="true">←</span>
          <span>Volver a la tienda pública</span>
        </a>
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-brand-dark/40">
          Acceso Restringido
        </span>
      </div>

      {/* Centered Login Card */}
      <div className="mx-auto w-full max-w-md my-12">
        <div className="bg-[#FAF9F6]/90 backdrop-blur-md border border-brand-dark/12 p-7 sm:p-9 rounded-xs shadow-xs space-y-6">
          {/* Brand Header */}
          <div className="space-y-2 border-b border-brand-dark/[0.08] pb-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-baseline text-lg font-bold tracking-[-0.03em] uppercase text-brand-dark select-none">
                THE OFFICE
                <sup className="text-[9px] font-bold tracking-tight relative -top-1.5 ml-0.5 leading-none text-brand-dark">
                  BA
                </sup>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-0.5 bg-brand-dark text-[#FAFAFA] rounded-xs">
                Admin
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-dark pt-1">
              Acceso Administrativo
            </h1>
            <p className="text-xs text-brand-dark/60 leading-relaxed">
              Ingresá tus credenciales de administrador para gestionar las
              consultas comerciales y confirmar pedidos.
            </p>
          </div>

          {/* Error Feedback */}
          {errorMessage && (
            <div
              className="p-3.5 bg-red-50/90 border border-red-200 rounded-xs text-xs text-red-800 space-y-1"
              role="alert"
            >
              <p className="font-semibold">Error de acceso</p>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="admin-username"
                className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/70"
              >
                Usuario
              </label>
              <input
                id="admin-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full h-11 px-3.5 text-sm text-brand-dark bg-white border border-brand-dark/20 rounded-xs placeholder:text-brand-dark/30 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="admin-password"
                className="block text-[11px] font-semibold uppercase tracking-wider text-brand-dark/70"
              >
                Contraseña
              </label>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 text-sm text-brand-dark bg-white border border-brand-dark/20 rounded-xs placeholder:text-brand-dark/30 focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark transition-colors"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full min-h-[46px] px-5 flex items-center justify-center gap-2 rounded-xs text-xs font-semibold uppercase tracking-wider transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 ${
                  isSubmitting
                    ? 'bg-brand-dark/40 text-[#FAFAFA]/80 cursor-not-allowed'
                    : 'bg-brand-dark text-[#FAFAFA] hover:opacity-90 active:scale-[0.99] cursor-pointer'
                }`}
              >
                {isSubmitting ? 'Verificando credenciales...' : 'Iniciar sesión'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom Notice */}
      <div className="mx-auto w-full max-w-7xl text-center text-[11px] text-brand-dark/40">
        Exclusivo para personal autorizado con rol ADMIN — The Office BA
      </div>
    </div>
  );
}

