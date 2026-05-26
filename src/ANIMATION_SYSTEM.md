# Animation System

## Overview
Balance of Power uses framer-motion for all animations, providing smooth, GPU-accelerated transitions that feel premium and responsive.

---

## Animation Principles

### 1. Snappy but Smooth
- **Duration**: 0.15s - 0.3s for most UI transitions
- **Easing**: easeInOut for panel transitions, linear for loaders
- **Stagger**: 0.05s - 0.1s between sequential animations

### 2. Purposeful Motion
- Enter animations: Fade in + slide from direction of travel
- Exit animations: Fade out (no slide)
- State changes: Scale + opacity transitions
- Loading: Continuous rotation with glow effects

### 3. Performance First
- GPU-accelerated transforms (scale, translate)
- Opacity changes over layout changes
- AnimatePresence for clean mount/unmount
- No layout thrashing during animations

---

## Animation Catalog

### Page Transitions

#### Campaign Layout Mount
```javascript
// Main container
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
transition={{ duration: 0.2 }}

// Landscape content (staggered)
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
transition={{ duration: 0.3, delay: 0.1 }}
```

#### Dock Slide Animations
```javascript
// Left dock
initial={{ x: -20, opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: -20, opacity: 0 }}
transition={{ duration: 0.2 }}

// Right dock (mirrored)
initial={{ x: 20, opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: 20, opacity: 0 }}
transition={{ duration: 0.2 }}
```

---

### Panel Transitions

#### Dock Collapse/Expand
```javascript
// Width animation
animate={{ width: collapsed ? 32 : 256 }}
transition={{ duration: 0.2, ease: "easeInOut" }}

// Content fade
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
transition={{ duration: 0.15 }}
```

#### Panel Content
```javascript
// Inner padding wrapper
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.15 }}
>
  {children}
</motion.div>
```

---

### Map Animations

#### Territory Polygons
```javascript
<motion.g
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }}
>
  <motion.polygon
    animate={{
      fillOpacity: fillOpacity * terrain_cfg.extraOpacity,
      strokeWidth: strokeWidth
    }}
    transition={{ duration: 0.15 }}
    style={{ 
      filter: isSelected 
        ? 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.4))' 
        : 'none' 
    }}
  />
</motion.g>
```

#### Territory Labels
```javascript
<motion.text
  initial={{ opacity: 0 }}
  animate={{ opacity: transform.scale >= 0.7 ? 0.85 : 0 }}
  transition={{ duration: 0.2 }}
>
  {territory.name}
</motion.text>
```

#### Region Legend (Staggered)
```javascript
// Container
initial={{ x: -20, opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
transition={{ duration: 0.3, delay: 0.2 }}

// Each region item
initial={{ opacity: 0, x: -10 }}
animate={{ opacity: 1, x: 0 }}
transition={{ delay: 0.3 + (idx * 0.05) }}

// Color swatch hover
<motion.div whileHover={{ scale: 1.2 }} />

// Bonus badge
initial={{ scale: 0 }}
animate={{ scale: 1 }}
transition={{ delay: 0.4 + (idx * 0.05) }}
```

#### Zoom Controls
```javascript
initial={{ y: 20, opacity: 0 }}
animate={{ y: 0, opacity: 1 }}
transition={{ duration: 0.3, delay: 0.3 }}

// Individual buttons
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
```

---

### Button Animations

#### Bottom Rail Tabs
```javascript
<motion.button
  whileTap={{ scale: 0.95 }}
  whileHover={{ scale: 1.02 }}
>
  <motion.div
    animate={isActive ? { scale: 1.1 } : { scale: 1 }}
    transition={{ duration: 0.15 }}
  >
    <Icon />
  </motion.div>
</motion.button>
```

#### TopBar Brand Icon
```javascript
<motion.div
  whileHover={{ rotate: 15, scale: 1.1 }}
  transition={{ duration: 0.2 }}
>
  <Shield />
</motion.div>
```

#### Collapse Toggles
```javascript
className="... active:scale-95 transition-all"
```

---

### Loading Animations

#### LoadingScreen Spinner
```javascript
// Outer ring
animate={{ rotate: 360 }}
transition={{ duration: 2, repeat: Infinity, ease: "linear" }}

// Spinning ring
animate={{ rotate: 360 }}
transition={{ duration: 1, repeat: Infinity, ease: "linear" }}

// Center glow
animate={{ 
  scale: [1, 1.2, 1], 
  opacity: [0.3, 0.6, 0.3] 
}}
transition={{ duration: 1.5, repeat: Infinity }}

// Text
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.1 }}
```

#### Campaign Loading Overlay
```javascript
// Container
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
transition={{ duration: 0.2 }}

// Inner content
initial={{ scale: 0.9, y: 10 }}
animate={{ scale: 1, y: 0 }}
exit={{ scale: 0.9, y: 10 }}

// Spinner
animate={{ rotate: 360 }}
transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
```

---

### TopBar Element Staggering

```javascript
// Campaign name
initial={{ opacity: 0, x: -10 }}
animate={{ opacity: 1, x: 0 }}
transition={{ delay: 0.1 }}

// Round indicator
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
transition={{ delay: 0.15 }}

// Phase tag
initial={{ opacity: 0, scale: 0.9 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ delay: 0.2 }}

// Timer
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
transition={{ delay: 0.25 }}

// Lock status
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
transition={{ delay: 0.3 }}

// Test mode
initial={{ opacity: 0, scale: 0.9 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ delay: 0.3 }}
```

---

## Easing Functions

### Standard Easings
- **easeInOut**: Panel transitions, width animations
- **linear**: Continuous rotations (loaders)
- **ease-out**: Fade-ins, slide-ins

### Custom Timing
```javascript
// Snappy UI feedback
transition={{ duration: 0.15 }}

// Smooth panel transitions
transition={{ duration: 0.2, ease: "easeInOut" }}

// Staggered reveals
transition={{ duration: 0.3, delay: 0.2 + (idx * 0.05) }}

// Continuous animations
transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
```

---

## Touch Feedback Patterns

### whileTap
```javascript
whileTap={{ scale: 0.95 }}
```
Used on all interactive buttons for tactile feedback.

### whileHover
```javascript
whileHover={{ scale: 1.02 }}  // Subtle growth
whileHover={{ scale: 1.05 }}  // More pronounced
whileHover={{ rotate: 15, scale: 1.1 }}  // Playful rotation
```
Desktop hover states, never used on mobile-only elements.

### Active State (CSS)
```javascript
className="... active:scale-95 transition-transform"
```
Fallback for touch devices, works alongside framer-motion.

---

## Performance Best Practices

### Do ✅
- Use `animate()` for GPU-accelerated properties (scale, translate, opacity)
- Use AnimatePresence for mount/unmount animations
- Keep durations under 0.3s for UI feedback
- Stagger sequential animations by 0.05s-0.1s
- Use `ease: "easeInOut"` for bidirectional transitions

### Don't ❌
- Animate layout properties (width, height, margin, padding)
- Use durations over 0.5s for UI elements
- Chain too many sequential animations
- Animate on every render (use motion components wisely)
- Forget to add AnimatePresence for exit animations

---

## Animation Triggers

### Mount Animations
```javascript
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.2 }}
```

### State Change Animations
```javascript
animate={{ 
  scale: isActive ? 1.1 : 1,
  opacity: isVisible ? 1 : 0 
}}
transition={{ duration: 0.15 }}
```

### Hover/Tap Animations
```javascript
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
```

### Continuous Animations
```javascript
animate={{ rotate: 360 }}
transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
```

---

## Responsive Animation Rules

### Mobile (xs)
- Reduce animation complexity
- Shorter durations (0.15s)
- Less staggering
- Focus on essential motion

### Desktop
- Full animation suite
- Hover states enabled
- More elaborate staggering
- Can use longer durations (0.3s)

### Reduced Motion
- Respect `prefers-reduced-motion` (future enhancement)
- Provide fallback to instant transitions
- Keep essential feedback (opacity changes)

---

## Animation Delays & Staggering

### Pattern
```javascript
{items.map((item, idx) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ 
      delay: 0.2 + (idx * 0.05),
      duration: 0.2 
    }}
  />
))}
```

### Stagger Values
- **Fast**: 0.03s between items (subtle)
- **Standard**: 0.05s between items (recommended)
- **Slow**: 0.1s between items (dramatic)

### Base Delays
- **Immediate**: 0s (urgent UI)
- **Quick**: 0.1s (standard)
- **Standard**: 0.2s (layout elements)
- **Delayed**: 0.3s (secondary elements)

---

## Summary

**Animation Library**: framer-motion  
**Philosophy**: Snappy, purposeful, performant  
**Standard Duration**: 0.15s - 0.3s  
**Standard Easing**: easeInOut  
**Touch Feedback**: scale 0.95 (tap), 1.05 (hover)  
**Stagger**: 0.05s between items  

All animations are designed to feel responsive and premium while maintaining 60fps performance on modern devices.