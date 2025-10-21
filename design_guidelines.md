# Design Guidelines: Gamified Chore Tracker - Login Screen

## Design Approach
**Reference-Based**: Drawing inspiration from Duolingo's playful gamification, Headspace's approachable warmth, and Khan Academy Kids' family-friendly interface. This creates an inviting, game-like experience that reduces friction for all ages while maintaining modern polish.

## Core Design Elements

### A. Color Palette
**Primary Colors** (Light Mode Only - no dark mode for this family app):
- **Primary Brand**: 260 85% 65% (Vibrant purple - energetic, friendly)
- **Success/Reward**: 145 70% 55% (Fresh green for achievements)
- **Warning/Fun**: 35 95% 65% (Playful orange for energy)
- **Background Base**: 220 15% 97% (Soft off-white)
- **Surface**: 0 0% 100% (Pure white for cards)

**Supporting Colors**:
- **Text Primary**: 230 25% 20% (Deep charcoal, softer than black)
- **Text Secondary**: 230 15% 45% (Medium gray)
- **Borders/Dividers**: 220 15% 90% (Subtle light gray)
- **PIN Button**: 220 20% 95% (Light gray base, interactive)
- **PIN Button Active**: Primary color on press

### B. Typography
**Fonts** (via Google Fonts CDN):
- **Display/Headings**: 'Fredoka' (rounded, playful, weights: 500, 600, 700)
- **Body/UI**: 'Inter' (clean, readable, weights: 400, 500, 600)

**Scale**:
- **Welcome Message**: text-4xl md:text-5xl font-bold (Fredoka)
- **Profile Names**: text-xl font-semibold (Fredoka)
- **Instructions**: text-base font-medium (Inter)
- **PIN Display**: text-3xl tracking-widest (Fredoka)
- **Button Text**: text-lg font-semibold (Inter)

### C. Layout System
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16 for consistency.
- **Container padding**: p-6 md:p-8
- **Component gaps**: gap-4 md:gap-6
- **Section spacing**: space-y-8 md:space-y-12
- **Button padding**: px-8 py-4

**Grid System**:
- **Profile Selection**: grid grid-cols-2 md:grid-cols-4 gap-4 for avatar cards
- **PIN Pad**: grid grid-cols-3 gap-3 for number buttons

### D. Component Library

**1. Login Container**
- Centered card with max-w-2xl, rounded-3xl corners
- Shadow: shadow-2xl with subtle purple tint
- Background: white with optional subtle gradient overlay
- Padding: p-8 md:p-12

**2. Profile Avatar Cards**
- Size: 80x80 md:96x96 circular avatars
- Border: 4px solid with primary color on selection
- Background: Gradient circles matching avatar theme
- Hover: scale-105 transform with transition
- Active state: Ring effect with primary color
- Label below: Centered name in Fredoka font

**3. PIN Input Display**
- Width: full width, centered
- Height: h-16, rounded-2xl
- Background: Background Base color
- Border: 2px solid Borders color, becomes Primary on focus
- Display: Series of 4 dots (●) or numbers, large text-3xl
- Spacing: Letter-spacing increased for clarity

**4. PIN Number Pad**
- **Number Buttons**: 
  - Size: 60x60 md:72x72, rounded-2xl
  - Background: PIN Button color
  - Text: text-2xl md:text-3xl font-bold
  - Hover: Slight scale and darker background
  - Active: Primary color background, white text
  - Haptic feedback suggestion (comment in code)
  
- **Special Buttons** (0, delete):
  - Same size as numbers
  - Delete: Icon (Heroicons: backspace) instead of text
  - Positioned: 0 centered bottom, delete bottom-right

**5. Header Section**
- Cheerful welcome message: "Welcome Back!" or "Who's Ready to Help?"
- Icon above text: Star or trophy (Heroicons)
- Subtext: "Select your profile to get started"
- All centered with space-y-3

**6. Footer Helper**
- Centered text: "Forgot your PIN? Ask a parent!"
- Color: Text Secondary
- Size: text-sm
- Position: Bottom of card with pt-6

### E. Decorative Elements

**Background Treatment**:
- Full viewport gradient: from Background Base to a light tint of Primary (very subtle)
- Floating decorative shapes: 3-4 large circles/blobs in pastel versions of Success and Warning colors, positioned absolute with blur-3xl, opacity-20
- Positioned at corners and edges for playful depth

**Micro-interactions**:
- Profile selection: Gentle bounce animation on tap
- PIN entry: Each number button pulses slightly on press
- Success state: Confetti-like particle effect (use emoji ⭐🎉 scattered) when PIN correct
- Error state: Gentle shake animation on incorrect PIN

**State Feedback**:
- Loading: Spinner with Primary color after PIN entry
- Error: Red outline (0 75% 60%) on PIN display with shake
- Success: Green checkmark (Heroicons) appears, brief celebration

### F. Responsive Behavior
**Mobile (base)**:
- Single column, full width profile grid (2 cols max)
- Larger touch targets (minimum 44x44)
- Bottom-aligned PIN pad for thumb reach

**Tablet/Desktop (md:)**:
- Profile grid expands to 4 columns
- PIN pad slightly smaller, more compact
- Card centered with decorative background visible

## Images
**No hero image needed** - this is a functional login screen. Instead:

**Profile Avatars**: Use placeholder circular avatars with gradient backgrounds and illustrated characters or initials. Suggest using a service like DiceBear Avatars API for consistent, playful avatar generation (can be integrated via CDN).

**Decorative Illustrations**: Consider adding small celebratory icons (stars, checkmarks, trophies) around the header as SVG elements from Heroicons.

## Layout Structure
1. **Decorative Background Layer** (full viewport)
2. **Centered Login Card** (max-w-2xl)
3. **Header** (Welcome message + icon)
4. **Profile Grid** (2-4 columns, avatars)
5. **PIN Section** (Label + Display + Number Pad)
6. **Footer Helper** (Forgot PIN text)

All elements stack vertically with consistent spacing (space-y-8) for natural flow.