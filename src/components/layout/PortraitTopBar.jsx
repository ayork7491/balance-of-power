/**
 * PortraitTopBar — Isolated mobile header for portrait layout.
 *
 * ISOLATION RULES:
 *  - No framer-motion (no transform stacking context)
 *  - No Radix portals or complex dropdowns
 *  - Direct onClick/onPointerUp handlers only
 *  - Perspective and Admin use simple inline modals
 *
 * Lives as a direct child of the portrait shell's flex column.
 * Never nested inside map gesture containers or overflow-clipped panels.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, TestTube, User, Check, X } from 'lucide-react';
import PhaseTag from '@/components/ui/PhaseTag';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export default function PortraitTopBar({ campaign = null, isAdmin = false }) {
  const navigate = useNavigate();
  const { id: campaignId } = useParams();
  const [perspectiveOpen, setPerspectiveOpen] = useState(false);

  const {
    isTestMode,
    availableActingAsPlayers,
    actingAsCampaignPlayerId,
    setActingAsCampaignPlayerId,
    setViewingAsCampaignPlayerId,
  } = useCampaignTestContext();

  const testPlayers = availableActingAsPlayers.filter(p => p.is_test_player);
  const showPerspective = isAdmin && isTestMode && testPlayers.length > 0;

  const currentValue = actingAsCampaignPlayerId ?? 'self';
  const currentLabel = currentValue === 'self'
    ? 'View'
    : testPlayers.find(p => p.id === currentValue)?.display_name ?? 'View';

  function handleHome(e) {
    e.stopPropagation();
    console.log('[PortraitTopBar] Home clicked');
    navigate('/');
  }

  function handlePerspective(e) {
    e.stopPropagation();
    console.log('[PortraitTopBar] Perspective clicked');
    setPerspectiveOpen(true);
  }

  function handleAdmin(e) {
    e.stopPropagation();
    console.log('[PortraitTopBar] Admin clicked');
    navigate(`/campaigns/${campaignId}/admin`);
  }

  function handleSelectPerspective(val) {
    console.log('[PortraitTopBar] Perspective selected:', val);
    if (val === 'self') {
      setActingAsCampaignPlayerId(null);
      setViewingAsCampaignPlayerId(null);
    } else {
      setActingAsCampaignPlayerId(val);
      setViewingAsCampaignPlayerId(val);
    }
    setPerspectiveOpen(false);
  }

  return (
    <>
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '40px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1000,
          pointerEvents: 'auto',
          backgroundColor: 'hsl(var(--panel-header))',
          borderBottom: '1px solid hsl(var(--panel-border))',
          padding: '0 8px',
          gap: '6px',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        {/* Home button */}
        <button
          type="button"
          onClick={handleHome}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
            padding: '4px',
            borderRadius: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
          aria-label="Home"
        >
          <Shield style={{ width: '14px', height: '14px', color: 'hsl(var(--primary))' }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'hsl(var(--primary))',
            textTransform: 'uppercase',
          }}>BoP</span>
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '16px', background: 'hsl(var(--border))', flexShrink: 0 }} />

        {/* Campaign info */}
        {campaign ? (
          <>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'hsl(var(--foreground))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '72px',
              flexShrink: 1,
            }} title={campaign.name}>
              {campaign.name}
            </span>

            {campaign.current_phase && (
              <PhaseTag phase={campaign.current_phase} compact />
            )}

            {/* Spacer */}
            <div style={{ flex: 1, minWidth: 0 }} />

            {campaign.phase_deadline && (
              <CountdownTimer deadline={campaign.phase_deadline} compact />
            )}

            <span style={{
              fontSize: '10px',
              color: 'hsl(var(--muted-foreground))',
              flexShrink: 0,
            }}>
              R{campaign.current_round || 1}
            </span>
          </>
        ) : (
          <>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'uppercase',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              Balance of Power
            </span>
          </>
        )}

        {/* Admin controls */}
        {isAdmin && campaignId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '4px' }}>
            {showPerspective && (
              <button
                type="button"
                onClick={handlePerspective}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'hsl(var(--status-pending) / 0.1)',
                  border: '1px solid hsl(var(--status-pending) / 0.4)',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
                aria-label="Switch perspective"
              >
                <TestTube style={{ width: '12px', height: '12px', color: 'hsl(var(--status-pending))' }} />
                <span style={{
                  fontSize: '10px',
                  color: 'hsl(var(--status-pending))',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.04em',
                  maxWidth: '52px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {currentLabel}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAdmin}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                background: 'hsl(var(--status-pending) / 0.15)',
                border: '1px solid hsl(var(--status-pending) / 0.4)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
              aria-label="Admin Mode"
              title="Admin Mode"
            >
              <TestTube style={{ width: '12px', height: '12px', color: 'hsl(var(--status-pending))' }} />
            </button>
          </div>
        )}
      </header>

      {/* ── Perspective picker modal ────────────────────────────────── */}
      {perspectiveOpen && (
        <PerspectiveModal
          testPlayers={testPlayers}
          currentValue={currentValue}
          onSelect={handleSelectPerspective}
          onClose={() => setPerspectiveOpen(false)}
        />
      )}
    </>
  );
}

// ── Perspective modal — fixed, no portals, no Radix ──────────────────────────

function PerspectiveModal({ testPlayers, currentValue, onSelect, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'hsl(var(--panel-bg))',
          borderTop: '1px solid hsl(var(--panel-border))',
          borderRadius: '12px 12px 0 0',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'hsl(var(--border))' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TestTube style={{ width: '16px', height: '16px', color: 'hsl(var(--status-pending))' }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'hsl(var(--foreground))',
            }}>
              Switch Perspective
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'hsl(var(--muted-foreground))',
              touchAction: 'manipulation',
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Options */}
        <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <PickerOption
            label="Self (My Player)"
            icon={<User style={{ width: '16px', height: '16px', color: 'hsl(var(--muted-foreground))' }} />}
            isSelected={currentValue === 'self'}
            onSelect={() => onSelect('self')}
          />
          {testPlayers.map(player => (
            <PickerOption
              key={player.id}
              label={player.display_name}
              sublabel="Test Player"
              icon={<TestTube style={{ width: '16px', height: '16px', color: 'hsl(var(--status-pending))' }} />}
              isSelected={currentValue === player.id}
              onSelect={() => onSelect(player.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PickerOption({ label, sublabel, icon, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        textAlign: 'left',
        cursor: 'pointer',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        background: isSelected ? 'hsl(var(--status-pending) / 0.15)' : 'hsl(var(--secondary) / 0.4)',
        border: isSelected ? '1px solid hsl(var(--status-pending) / 0.5)' : '1px solid transparent',
        color: 'hsl(var(--foreground))',
      }}
    >
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{sublabel}</div>
        )}
      </div>
      {isSelected && <Check style={{ width: '16px', height: '16px', color: 'hsl(var(--status-pending))', flexShrink: 0 }} />}
    </button>
  );
}