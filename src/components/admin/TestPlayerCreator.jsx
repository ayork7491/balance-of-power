/**
 * TestPlayerCreator — Form to add test players to campaign lobby.
 * Works in lobby phase only. Creates CampaignPlayer records with is_test_player flag.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PLAYER_COLORS } from '@/config/theme';

export default function TestPlayerCreator({ onPlayerCreated }) {
  const { id } = useParams();
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (!id) return;
    base44.functions.invoke('getCampaignOverview', { campaign_id: id })
      .then(res => {
        setCampaign(res.data.campaign);
        setPlayers(res.data.players || []);
      })
      .catch(() => {});
  }, [id]);

  // Get available colors (not taken by existing players)
  const availableColors = PLAYER_COLORS.filter(
    pc => !players.some(p => p.color === pc.id)
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await base44.functions.invoke('addCampaignTestPlayer', {
        campaign_id: id,
        display_name: displayName,
        color,
      });

      toast.success(`Test player added: ${res.data.player.display_name}`);
      setDisplayName('');
      setColor('');
      onPlayerCreated?.(res.data.player);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add test player');
    } finally {
      setIsLoading(false);
    }
  };

  if (!campaign) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (campaign.status !== 'lobby') {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Test players can only be added during lobby phase.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Current status: <span className="text-foreground">{campaign.status}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate} className="space-y-3">
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
        <label className="text-xs text-muted-foreground">Player Color</label>
        {availableColors.length === 0 ? (
          <p className="text-xs text-destructive">All colors are taken</p>
        ) : (
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select a color" />
            </SelectTrigger>
            <SelectContent>
              {availableColors.map(pc => (
                <SelectItem key={pc.id} value={pc.id}>
                  <span className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-sm" 
                      style={{ backgroundColor: pc.hex }}
                    />
                    {pc.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-[10px] text-muted-foreground">
          Test players are added directly to the campaign lobby. They count toward player limits and participate in setup.
        </p>
      </div>

      <Button 
        type="submit" 
        disabled={isLoading || !color || availableColors.length === 0} 
        className="w-full h-8 text-xs"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
        Add Test Player to Lobby
      </Button>
    </form>
  );
}