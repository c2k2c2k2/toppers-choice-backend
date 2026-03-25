# Design System Specification

## 1. Overview & Creative North Star: "The Academic Atelier"
This design system moves away from the sterile, "template-driven" look of traditional Learning Management Systems. Instead, it adopts the **Academic Atelier** philosophy: a high-end editorial approach that combines the authority of a prestigious university with the fluidity of a modern digital experience.

**The Creative North Star:** We prioritize "The Sophisticated Scholar." This means utilizing intentional asymmetry, expansive negative space, and a rejection of traditional containment (borders and lines) in favor of tonal depth. The interface should feel like a premium digital textbook—authoritative yet breathable.

---

## 2. Color & Surface Architecture
We move beyond flat hex codes to a tiered system of "Surface Intelligence." This establishes hierarchy through light and shadow rather than rigid lines.

### Palette Strategy
*   **Primary (Navy Authority):** Use `primary` (#001e40) for core brand moments and `primary_container` (#003366) for high-impact structural backgrounds.
*   **Tertiary (The Golden Path):** Use `tertiary_fixed_dim` (#ffb86f) and `on_tertiary_container` (#e18600) for CTAs. These are "intellectual sparks" that guide the student’s eye.
*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined solely through background shifts (e.g., a `surface_container_low` card sitting on a `surface` background).

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each level of "focus" requires a shift in the surface token:
1.  **Base Layer:** `surface` (#f8f9fa) – The canvas.
2.  **Section Layer:** `surface_container_low` (#f3f4f5) – To group large content areas.
3.  **Component Layer:** `surface_container_lowest` (#ffffff) – Used for cards and interactive modules to make them "pop" off the page.

### The "Glass & Gradient" Rule
To elevate the PWA feel, use **Glassmorphism** for floating headers and navigation bars. Use `surface` at 80% opacity with a `20px` backdrop-blur. Apply a subtle linear gradient (from `primary` to `primary_container`) on hero sections to provide a sense of "soul" and depth.

---

## 3. Typography: The Editorial Scale
We use a dual-font system to balance character with readability.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision. Use `display-lg` (3.5rem) and `headline-md` (1.75rem) to create an editorial feel. Headlines should have a tight letter-spacing (-0.02em) to look "locked in."
*   **Body & UI (Inter):** The workhorse for learning content. Use `body-md` (0.875rem) for most text. Inter’s high x-height ensures readability during long study sessions.
*   **Hierarchy Tip:** Never use "Bold" for body text; use "Medium" (500 weight) to maintain a premium, light-ink feel.

---

## 4. Elevation & Depth
Traditional shadows are too heavy for an educational tool. We use **Tonal Layering**.

*   **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` background. This creates a "soft lift" without the visual clutter of a shadow.
*   **Ambient Shadows:** For floating elements (Modals/Dropdowns), use a 12% opacity shadow tinted with `primary` (#001e40).
    *   *Spec:* `0px 10px 40px rgba(0, 30, 64, 0.08)`
*   **The "Ghost Border" Fallback:** If a container requires more definition on a white background, use the `outline_variant` token at **15% opacity**. This creates a suggestion of a boundary rather than a hard wall.

---

## 5. Signature Components

### Headers & Navigation
*   **Style:** Fixed glassmorphic bar.
*   **Structure:** `surface` background + 80% alpha + `blur(12px)`.
*   **Placement:** Use `surface_container_low` for the active nav state, avoiding heavy underline indicators.

### Buttons (The "Call to Action")
*   **Primary:** Background: `tertiary_container` (#4e2b00); Text: `on_tertiary_fixed`. Use `rounded-md` (0.375rem).
*   **Secondary:** Ghost style. No background, `primary` text, and a `Ghost Border` (15% opacity `outline`).
*   **Interaction:** On hover, shift the background to `tertiary_fixed` (#ffdcbd) for a "glow" effect.

### Feature Grids & Cards
*   **Constraint:** Forbid divider lines. Use `spacing-8` (2rem) of vertical white space to separate grid items.
*   **Card Anatomy:** Use `surface_container_lowest` for the card body. The header of the card should use `body-lg` in `primary` color for immediate legibility.

### Progress & LMS Dashboard Elements
*   **The Progress Ring:** Instead of a standard bar, use a circular stroke using `tertiary` for the "active" portion and `surface_variant` for the "track."
*   **Course Lists:** Use `surface_container_high` for list item hover states. Do not use dividers; use a `spacing-2` (0.5rem) gap between list items to allow the background to "breathe" through.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical margins (e.g., more padding on the left than the right in hero sections) to create an editorial, non-templated look.
*   **Do** leverage the `surface_bright` token for "Success" states instead of a jarring green; keep the palette sophisticated.
*   **Do** ensure all touch targets in the PWA are at least 48px high, utilizing the `spacing-12` scale.

### Don’t
*   **Don’t** use pure black (#000000) for text. Always use `on_surface` (#191c1d) to maintain a softer, high-end feel.
*   **Don’t** use 100% opaque borders. They create "visual noise" that distracts from the educational content.
*   **Don’t** crowd the layout. If a section feels full, increase the spacing to the next tier in the scale (e.g., move from `spacing-10` to `spacing-16`).