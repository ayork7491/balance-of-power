/**
 * AuthLayout — full-screen centered layout for auth screens.
 * Maintains the tactical/strategic visual identity of the app.
 */
import { Shield } from 'lucide-react';

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 tactical-grid">
      {/* Branding */}
      <div className="flex items-center gap-2 mb-8">
        <Shield className="w-6 h-6 text-primary" />
        <span className="font-mono text-base font-bold tracking-widest text-primary uppercase">
          Balance of Power
        </span>
      </div>

      <div className="w-full max-w-md">
        {/* Card header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 mb-4">
            <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wider uppercase text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>

        {/* Card */}
        <div className="panel p-8">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}