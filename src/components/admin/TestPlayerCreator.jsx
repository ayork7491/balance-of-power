/**
 * TestPlayerCreator — Form to create test player accounts.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TestPlayerCreator({ onPlayerCreated }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('user');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await base44.functions.invoke('createTestPlayer', {
        email,
        display_name: displayName,
        role,
      });

      toast.success(`Test player created: ${res.data.user.email}`);
      setEmail('');
      setDisplayName('');
      onPlayerCreated?.(res.data.user);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create test player');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="test1@example.com"
          className="h-8 text-xs"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Display Name</label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Player One"
          className="h-8 text-xs"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Role</label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Player (test account)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Test players are always created as regular users. Campaign admins should use the invite flow.
        </p>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full h-8 text-xs">
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
        Create Test Player
      </Button>
    </form>
  );
}