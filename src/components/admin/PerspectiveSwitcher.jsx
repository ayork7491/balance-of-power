/**
 * PerspectiveSwitcher — Dropdown to switch view between different players.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function PerspectiveSwitcher({ campaign, players, currentPerspective, onPerspectiveChange }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(currentPerspective?.id || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSwitch = async () => {
    if (!selectedPlayerId) return;
    
    setIsLoading(true);
    try {
      // In a real implementation, this would switch the user context
      // For now, we'll just notify the parent component
      const player = players.find(p => p.id === selectedPlayerId);
      onPerspectiveChange?.(player);
      toast.success(`Switched to ${player?.display_name}'s perspective`);
    } catch (err) {
      toast.error('Failed to switch perspective');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs font-display tracking-widest uppercase text-muted-foreground">
          Player Perspective
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Switch view to see the game as any player would see it. Private staged decisions will be hidden per player.
      </p>

      <div className="space-y-2">
        <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Select player..." />
          </SelectTrigger>
          <SelectContent>
            {players.map((player) => (
              <SelectItem key={player.id} value={player.id}>
                {player.display_name} {player.user_id === currentPerspective?.user_id ? '(You)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          onClick={handleSwitch} 
          disabled={!selectedPlayerId || isLoading}
          className="w-full h-8 text-xs"
        >
          <Eye className="w-3 h-3 mr-1" />
          Switch Perspective
        </Button>
      </div>

      {currentPerspective && (
        <div className="p-2 rounded border border-border bg-muted/10 text-xs">
          <p className="text-muted-foreground">Current view:</p>
          <p className="font-medium text-foreground">{currentPerspective.display_name}</p>
        </div>
      )}
    </div>
  );
}