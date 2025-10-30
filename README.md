# Box ↔ Item Probability Explorer

Run Online: https://blob7.github.io/labubu-box-prediction/

What this is:
 - A tool that helps you reason about which box is most likely to contain a particular item when you get partial hints.
 - You provide a list of items (one per box). For each box you can add hints: either "Is" (this box is that item) or several "Not" (this box is not that item).
 - The app computes — exactly for small problems, and approximately for larger ones — how likely each item is to be in each box and shows a simple breakdown to help you pick or avoid boxes.

How to use
1. Add item names using the + Add item button (the number of items = number of boxes).
2. Click "Generate Boxes / Reset Hints" to create the box grid and hint controls.
3. For each box you can choose an "Is" value or check one or more "Not" boxes to indicate which items it cannot be.
4. Choose a computation mode (Auto / Sampling / Exact). Auto uses exact math for small problems and sampling for large ones.
5. If you select Sampling, set the sample size (more samples → better estimate but slower). Then change hints or click Generate to recompute.
6. The status line and progress bar show computation progress. The breakdown section shows, for each item, the boxes ordered from most → least likely and colored as a heatmap (zero-probability boxes are omitted).
7. To experiment, click "Random assignment (simulation)" — this hides a random true assignment you can reveal per box or ask boxes for simulated "not" hints.

Computation modes
 - **Auto:** exact enumeration for n ≤ 9, sampling for larger n (default behavior).
 - **Sampling:** Monte Carlo sampling using the configured sample size (controls appear when this mode is active).
 - **Exact:** attempts to enumerate every permutation but runs in asynchronous chunks and reports progress; it can be very slow for n &gt; 9.

Why the app sometimes uses sampling
 - Enumerating every possible assignment is exact but grows factorially: n items → n! permutations. That becomes impractical quickly (10! = 3.6M, 12! = 479M, ...).
 - For n > 9 the app switches to a Monte Carlo sampler (unless you pick Exact). Sampling gives an approximate answer faster and keeps the page responsive.

Files
 - `index.html` — single-page UI and documentation text.
 - `styles.css` — layout and styling, including the breakdown heatmap and progress bar styles.
 - `script.js` — app logic: UI wiring, permutation enumeration (Heap's algorithm), Monte Carlo sampler, async chunked exact enumeration with progress, and the breakdown rendering
  
 
Credits & notes
 - This tool assumes each item is present in the set. (Don't include secrets / rares)
 - Made possible with an addiction to collecting labubus and AI
