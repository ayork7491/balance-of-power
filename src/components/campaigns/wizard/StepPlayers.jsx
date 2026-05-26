/**
 * StepPlayers — Invite players by email before campaign is created.
 */
import { useState } from 'react';
import { Plus, X, Mail, Users } from 'lucide-react';

export default function StepPlayers({ form, setField }) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState(null);

  const emails = form.invitee_emails || [];

  const addEmail = () => {
    const email = input.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInputError('Enter a valid email address.');
      return;
    }
    if (emails.includes(email)) {
      setInputError('This email has already been added.');
      return;
    }
    setInputError(null);
    setField('invitee_emails', [...emails, email]);
    setInput('');
  };

  const removeEmail = (email) => {
    setField('invitee_emails', emails.filter(e => e !== email));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Invite players by email. They'll receive an invite to join the lobby. You can also share the campaign's invite code after creation.
      </p>

      {/* Email input */}
      <div className="space-y-1">
        <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Player Email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={input}
            onChange={e => { setInput(e.target.value); if (inputError) setInputError(null); }}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
            placeholder="commander@example.com"
            className={`flex-1 bg-input border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${inputError ? 'border-destructive' : 'border-border'}`}
          />
          <button
            type="button"
            onClick={addEmail}
            disabled={!input.trim()}
            className="px-3 py-2 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {inputError && <p className="text-xs text-destructive">{inputError}</p>}
      </div>

      {/* Invite list */}
      {emails.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Invited ({emails.length})
          </p>
          {emails.map(email => (
            <div key={email} className="flex items-center justify-between px-3 py-2 rounded border border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-foreground">{email}</span>
              </div>
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded">
          No invites added yet. You can also invite players after the campaign is created.
        </p>
      )}
    </div>
  );
}