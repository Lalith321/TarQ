import { Link } from 'react-router-dom';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" stroke="url(#sil)" strokeWidth="1.5" fill="rgba(59,130,246,0.12)"/>
            <circle cx="12" cy="12" r="3" fill="url(#sil)"/>
            <defs>
              <linearGradient id="sil" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b82f6"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
          </svg>
          <span className="text-sm font-bold tracking-tight">TarQ</span>
        </div>

        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            AI Data Intelligence
          </p>
          <h2 className="text-3xl font-light leading-snug" style={{ color: 'var(--text-primary)' }}>
            Analyze the signal<br />
            <span className="font-semibold" style={{ color: 'var(--accent)' }}>in your data.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Your agent fleet is ready. Configure, inject, and surface insights from any dataset.
          </p>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>© 2025 TarQ. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Sign in to your TarQ workspace.
            </p>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-muted)')}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Password</label>
                <a href="#" className="text-xs transition-colors hover:text-white" style={{ color: 'var(--accent)' }}>
                  Forgot?
                </a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-muted)')}
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-cyan))', boxShadow: '0 4px 16px var(--accent-glow)' }}
            >
              Continue
            </button>
          </form>

          <p className="mt-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium transition-colors hover:text-white" style={{ color: 'var(--accent)' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
