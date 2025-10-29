# Box <-> Item Probability Explorer

Small static HTML/CSS/JS tool to explore which box is most/least likely to contain each item given simple hints.

Features
- Define number of boxes (one item per box) and the list of item names.
- For each box provide hints: "Is" (this box is that item) or multiple "Not" hints (this box is not that item).
- Exact probabilities are computed by enumerating all permutations consistent with the hints.
- Breakdown shows which box is best to choose for each item (and which to avoid).
- Simulation mode: generate a random hidden assignment, reveal boxes or ask a box for a random "not" hint (adds to hints).

Usage
1. Open `index.html` in a browser.
2. Edit number of boxes or add/remove items. One item per box is assumed.
3. Click "Generate Boxes".
4. Use the per-box controls to set hints and view live probabilities.
5. Click "Random assignment" to start simulation mode (then use "Reveal" or "Ask not").

Notes and limits
- This tool enumerates permutations. For n &gt; 9 this can be slow due to factorial growth. The UI prevents explosion by design; consider manual pruning or probabilistic sampling for large n.

Files
- `index.html` – UI
- `styles.css` – basic styles
- `script.js` – logic and probability engine

Enjoy. Feedback or feature requests welcome.

99.99% AI coded