import { useState, useEffect } from 'react';
import { adminLogin } from '../../../services/api';
import { getAdminSession } from '../../../services/adminAuth';
import Button from './ui/Button';
import Field, { inputClass } from './ui/Field';
import Icon from './ui/icons';

export default function AdminLoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          'Tu sesión administrativa expiró o no es válida. Iniciá sesión de nuevo.'
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
      setErrorMessage('Ingresá tu usuario y contraseña.');
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
      setShowPassword(false);
      setErrorMessage(
        err?.message ||
          'No se pudo iniciar sesión. Verificá tus credenciales e intentá nuevamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between px-4 py-6 sm:px-6">
      {/* Top bar: volver a la tienda */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <a
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-sm font-medium text-ink-muted transition-colors hover:text-brand-dark"
        >
          <Icon name="chevronLeft" size={16} />
          <span>Volver a la tienda</span>
        </a>
      </div>

      {/* Card de login (blanca sobre el mármol) */}
      <div className="mx-auto my-8 w-full max-w-[420px]">
        <div className="rounded-tile bg-white p-6 shadow-card sm:p-9">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex select-none items-baseline text-lg font-bold uppercase tracking-[-0.03em] text-brand-dark">
              THE OFFICE
              <sup className="relative -top-1.5 ml-0.5 text-[10px] leading-none">BA</sup>
            </span>
            <span className="rounded-full bg-brand-sand px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
              Admin
            </span>
          </div>
          <h1 className="mt-6 text-[1.625rem] font-semibold leading-tight tracking-[-0.025em] text-brand-dark">
            Ingresá al panel
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-muted">
            Gestioná productos, consultas y pedidos.
          </p>

          {errorMessage && (
            <div
              className="mt-5 rounded-card bg-red-50 p-3.5 text-sm text-red-900"
              role="alert"
            >
              <p className="font-semibold">No pudimos iniciar sesión</p>
              <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="Usuario" id="admin-username">
              <input
                name="username"
                type="text"
                autoComplete="username"
                required
                disabled={isSubmitting}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className={inputClass}
              />
            </Field>

            <Field label="Contraseña" id="admin-password">
              {(controlProps) => (
              <div className="relative">
                <input
                  {...controlProps}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  aria-controls="admin-password"
                  disabled={isSubmitting}
                  className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-ink-muted transition-colors hover:text-brand-dark disabled:opacity-50"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} />
                </button>
              </div>
              )}
            </Field>

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={isSubmitting}
              loadingText="Verificando credenciales…"
              className="mt-2 h-12"
            >
              Iniciar sesión
            </Button>
          </form>
        </div>
      </div>

      <p className="text-center text-[13px] text-ink-muted">
        Acceso solo para personal autorizado · The Office BA
      </p>
    </div>
  );
}
