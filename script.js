// Script for Box↔Item Probability Explorer
(function(){
  const itemsList = document.getElementById('itemsList');
  const addItemBtn = document.getElementById('addItemBtn');
  const generateBtn = document.getElementById('generateBtn');
  const boxesGrid = document.getElementById('boxesGrid');
  const bestForItem = document.getElementById('bestForItem');
  const avoidForItem = document.getElementById('avoidForItem');
  const randomAssignBtn = document.getElementById('randomAssignBtn');
  const clearSimBtn = document.getElementById('clearSimBtn');
  const statusEl = document.getElementById('status');
  const computeModeEl = document.getElementById('computeMode');
  const sampleSizeInput = document.getElementById('sampleSizeInput');
  const progressBar = document.getElementById('progressBar');
  const progressWrap = document.getElementById('progressWrap');

  let currentRunId = 0; // used to cancel outdated computations

  let items = [];
  let hints = []; // hints per box: {is: index|null, not:Set}
  let simulationTruth = null; // array mapping box->itemIndex

  function ensureItemCount(n){
    while(items.length < n) items.push('Item ' + (items.length+1));
    while(items.length > n) items.pop();
  }

  function renderItemsList(){
    itemsList.innerHTML = '';
    items.forEach((name, idx)=>{
      const li = document.createElement('li');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = name;
      input.addEventListener('input', ()=>{ items[idx] = input.value; if(hints.length) { refreshHintControls(); updateAll(); } });
      const remove = document.createElement('button');
      remove.textContent = '-';
      remove.className = 'remove';
      remove.addEventListener('click', ()=>{
        items.splice(idx,1);
        // keep internal item array consistent and re-render the list
        ensureItemCount(items.length);
        renderItemsList();
        if(document.getElementById('box-0')) refreshHintControls();
      });
      li.appendChild(input);
      li.appendChild(remove);
      itemsList.appendChild(li);
    });
  }

  addItemBtn.addEventListener('click', ()=>{ items.push('Item '+(items.length+1)); renderItemsList(); if(document.getElementById('box-0')) refreshHintControls(); });

  // Refresh hint controls (select options and not-check labels) to reflect current item names.
  // Preserves hint state in `hints` and only updates the UI elements if boxes exist.
  function refreshHintControls(){
    if(!hints || hints.length === 0) return;
    for(let b=0;b<hints.length;b++){
      const boxEl = document.getElementById(`box-${b}`);
      if(!boxEl) continue;
      // update select options
      const sel = boxEl.querySelector('select');
      if(sel){
        const curVal = sel.value;
        sel.innerHTML = '';
        const optNone = document.createElement('option'); optNone.value = ''; optNone.textContent = '(none)'; sel.appendChild(optNone);
        items.forEach((it,idx)=>{ const o = document.createElement('option'); o.value = idx; o.textContent = it; sel.appendChild(o); });
        // restore selected value from hints
        sel.value = (hints[b].is === null) ? '' : String(hints[b].is);
      }
      // update not checkboxes
      const notList = boxEl.querySelector('.notList');
      if(notList){
        notList.innerHTML = '';
        items.forEach((it,idx)=>{
          const cb = document.createElement('label'); cb.style.marginRight='8px';
          const input = document.createElement('input'); input.type='checkbox'; input.className='notChk';
          input.dataset.item = idx; input.dataset.box = b;
          input.checked = hints[b].not.has(idx);
          input.addEventListener('change', ()=>{
            const box = Number(input.dataset.box);
            const item = Number(input.dataset.item);
            if(input.checked) hints[box].not.add(item); else hints[box].not.delete(item);
            if(hints[box].is===item){ hints[box].is = null; const sel2 = document.querySelector(`#box-${box} select`); if(sel2) sel2.value = ''; }
            updateAll();
          });
          cb.appendChild(input);
          cb.appendChild(document.createTextNode(' '+it));
          notList.appendChild(cb);
        });
      }
    }
  }

  // toggle sample size control visibility depending on compute mode
  function updateComputeControlsVisibility(){
    if(!computeModeEl) return;
    const mode = computeModeEl.value;
    const sampleLabel = document.getElementById('sampleSizeLabel');
    if(sampleLabel) sampleLabel.style.display = (mode === 'sample') ? '' : 'none';
  }
  if(computeModeEl){
    computeModeEl.addEventListener('change', ()=>{ updateComputeControlsVisibility(); updateAll(); });
  }
  if(sampleSizeInput){ sampleSizeInput.addEventListener('change', ()=>{ if(computeModeEl && computeModeEl.value==='sample') updateAll(); }); }
  // initial visibility
  updateComputeControlsVisibility();

  // progress helper
  function setProgress(percent, indeterminate = false){
    if(!progressBar || !progressWrap) return;
    if(percent === null){ progressWrap.style.display = 'none'; progressBar.classList.remove('indeterminate'); progressBar.style.width = '0%'; progressBar.setAttribute('aria-valuenow', '0'); return; }
    progressWrap.style.display = 'block';
    if(indeterminate){ progressBar.classList.add('indeterminate'); progressBar.style.width = '100%'; progressBar.setAttribute('aria-valuenow', '0'); }
    else { progressBar.classList.remove('indeterminate'); const p = Math.max(0, Math.min(100, percent)); progressBar.style.width = p + '%'; progressBar.setAttribute('aria-valuenow', String(Math.round(p))); }
  }

  function initHints(n){
    hints = [];
    for(let i=0;i<n;i++) hints.push({is:null, not:new Set()});
  }

  function generateBoxes(){
    const n = items.length;
    if(n < 1) return;
    initHints(n);
    simulationTruth = null;
    boxesGrid.innerHTML = '';
    for(let b=0;b<n;b++){
      const card = document.createElement('div'); card.className='boxCard';
      const header = document.createElement('div'); header.className='boxHeader';
      const title = document.createElement('div'); title.textContent = 'Box '+(b+1);
      header.appendChild(title);
      const controls = document.createElement('div'); controls.className='controls';

      // Reveal and Ask-not controls are only shown when a simulation assignment exists.
      const revealBtn = document.createElement('button'); revealBtn.textContent='Reveal';
      revealBtn.style.display = 'none';
      revealBtn.className = 'revealBtn';
      revealBtn.addEventListener('click', ()=>{
        alert('Box '+(b+1)+' is: '+items[simulationTruth[b]]);
      });

      const askNotBtn = document.createElement('button'); askNotBtn.textContent='Ask not';
      askNotBtn.style.display = 'none';
      askNotBtn.className = 'askNotBtn';
      askNotBtn.addEventListener('click', ()=>{
        // pick a random item that is not the true item and not already in not hints
        const trueIdx = simulationTruth[b];
        const available = items.map((_,i)=>i).filter(i=>i!==trueIdx && !hints[b].not.has(i) && hints[b].is!==i);
        if(available.length===0){ alert('No more "not" hints available for this box'); return; }
        const pick = available[Math.floor(Math.random()*available.length)];
        hints[b].not.add(pick);
        // update corresponding UI controls (checkbox)
        const chk = document.querySelector(`#box-${b} .notChk[data-item="${pick}"]`);
        if(chk){ chk.checked = true; }
        updateAll();
      });

      controls.appendChild(revealBtn);
      controls.appendChild(askNotBtn);
      header.appendChild(controls);

      card.appendChild(header);

      // hint controls
      const hintsDiv = document.createElement('div'); hintsDiv.className='hints';
      // Is selector
      const isLabel = document.createElement('label'); isLabel.className='small';
      isLabel.textContent = 'Is: ';
      const isSelect = document.createElement('select'); isSelect.dataset.box = b;
      const optNone = document.createElement('option'); optNone.value=''; optNone.textContent='(none)'; isSelect.appendChild(optNone);
      items.forEach((it,idx)=>{ const o=document.createElement('option'); o.value=idx; o.textContent=it; isSelect.appendChild(o); });
      isSelect.addEventListener('change', ()=>{
        const box = Number(isSelect.dataset.box);
        const val = isSelect.value === '' ? null : Number(isSelect.value);
        hints[box].is = val;
        if(val !== null){ hints[box].not.delete(val); // remove contradictory not
          // uncheck its not checkbox if exists
          const chk = document.querySelector(`#box-${box} .notChk[data-item="${val}"]`);
          if(chk) chk.checked = false;
        }
        updateAll();
      });
      isLabel.appendChild(isSelect);
      hintsDiv.appendChild(isLabel);

      // Not checkboxes
      const notWrap = document.createElement('div'); notWrap.className='small';
      notWrap.textContent = 'Not:';
      const notList = document.createElement('div'); notList.className='notList';
      items.forEach((it,idx)=>{
        const cb = document.createElement('label'); cb.style.marginRight='8px';
        const input = document.createElement('input'); input.type='checkbox'; input.className='notChk';
        input.dataset.item = idx; input.dataset.box = b;
        input.addEventListener('change', ()=>{
          const box = Number(input.dataset.box);
          const item = Number(input.dataset.item);
          if(input.checked) hints[box].not.add(item); else hints[box].not.delete(item);
          // if we added a not that conflicts with an 'is', clear is
          if(hints[box].is===item){ hints[box].is = null; const sel = document.querySelector(`#box-${box} select`); if(sel) sel.value = ''; }
          updateAll();
        });
        cb.appendChild(input);
        cb.appendChild(document.createTextNode(' '+it));
        notList.appendChild(cb);
      });
      notWrap.appendChild(notList);
      hintsDiv.appendChild(notWrap);

      card.appendChild(hintsDiv);

      // probability table
      const probTable = document.createElement('table'); probTable.className='probTable'; probTable.dataset.box = b; probTable.id = 'box-'+b+'-probs';
      card.appendChild(probTable);

      card.id = 'box-'+b;
      boxesGrid.appendChild(card);
    }
    updateAll();
  }

  // permutation generator (Heap's algorithm)
  function *permutations(arr){
    const a = arr.slice();
    const n = a.length;
    const c = new Array(n).fill(0);
    yield a.slice();
    let i = 0;
    while(i < n){
      if(c[i] < i){
        if(i % 2 === 0) { [a[0], a[i]] = [a[i], a[0]]; }
        else { [a[c[i]], a[i]] = [a[i], a[c[i]]]; }
        yield a.slice();
        c[i]++;
        i = 0;
      } else { c[i] = 0; i++; }
    }
  }

  // For small n (<=9) we enumerate exactly. For larger n, we run a Monte Carlo sampler
  // to estimate probabilities. The sampler runs in async chunks so the UI can update a status
  // element and remain responsive.
  function computeProbabilitiesAsync(){
    const runId = ++currentRunId;
    const n = items.length;
    const indices = Array.from({length:n}, (_,i)=>i);
    const mode = computeModeEl ? computeModeEl.value : 'auto';

    // helper to check for cancellation
    const isCanceled = ()=> runId !== currentRunId;

    // small n exact synchronous (fast)
    if(mode !== 'sample' && n <= 9){
      const counts = Array.from({length:n}, ()=>Array(n).fill(0));
      let total = 0;
      setProgress(0, false);
      for(const perm of permutations(indices)){
        if(isCanceled()){ setProgress(null); return Promise.resolve({total:0, counts, approx:false}); }
        let ok = true;
        for(let b=0;b<n;b++){
          const p = perm[b];
          const h = hints[b];
          if(h.is !== null && p !== h.is){ ok=false; break; }
          if(h.not.has(p)){ ok=false; break; }
        }
        if(ok){ total++; for(let b=0;b<n;b++){ counts[b][perm[b]]++; } }
      }
      statusEl.textContent = `Computed exact over ${total} consistent permutations`;
      setProgress(100, false);
      return Promise.resolve({total, counts, approx:false});
    }

    // If mode is 'sample' or (auto and n>9) -> sampling
    if(mode === 'sample' || (mode === 'auto' && n > 9)){
      const defaultSample = Math.max(20000, Math.min(100000, Math.floor(20000 * (11 / n))));
      let sampleSize = defaultSample;
      if(sampleSizeInput){ const v = Number(sampleSizeInput.value); if(!Number.isNaN(v) && v>0) sampleSize = Math.min(1000000, Math.max(100, Math.floor(v))); }
      let done = 0;
      let valid = 0;
      const counts = Array.from({length:n}, ()=>Array(n).fill(0));

      statusEl.textContent = `Sampling ${sampleSize} random permutations (approximate) ...`;
      setProgress(0, false);

      return new Promise((resolve)=>{
        const chunk = 500;
        function runChunk(){
          if(isCanceled()){ statusEl.textContent = 'Sampling canceled'; return resolve({total:0, counts, approx:true}); }
          const lim = Math.min(done + chunk, sampleSize);
          for(; done < lim; done++){
            const perm = indices.slice();
            for(let i=n-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [perm[i],perm[j]]=[perm[j],perm[i]]; }
            let ok = true;
            for(let b=0;b<n;b++){
              const p = perm[b];
              const h = hints[b];
              if(h.is !== null && p !== h.is){ ok=false; break; }
              if(h.not.has(p)){ ok=false; break; }
            }
            if(ok){ valid++; for(let b=0;b<n;b++){ counts[b][perm[b]]++; } }
          }
          statusEl.textContent = `Sampling ${sampleSize} permutations — done ${done}/${sampleSize}, valid ${valid}`;
          setProgress((done / sampleSize) * 100, false);
          if(done < sampleSize) setTimeout(runChunk, 0);
          else { statusEl.textContent = `Sampling complete — ${valid} valid permutations (approx).`; setProgress(100, false); resolve({total: valid, counts, approx:true}); }
        }
        setTimeout(runChunk, 0);
      });
    }

    // Otherwise mode==='exact' and n may be large: run an exact enumeration asynchronously in chunks
    // This will compute every permutation (may take a long time) but will update status. It can be canceled by starting another run.
    return new Promise((resolve)=>{
      const counts = Array.from({length:n}, ()=>Array(n).fill(0));
      let valid = 0;
      let processed = 0;
      const gen = permutations(indices);
      // compute total permutations for status using BigInt
      function factorialBig(n){ let f = 1n; for(let i=2;i<=n;i++) f *= BigInt(i); return f; }
      const totalPermsBig = factorialBig(n);
      const totalPermsStr = totalPermsBig.toString();
      const canDeterminate = totalPermsBig <= BigInt(Number.MAX_SAFE_INTEGER);
      const totalPermsNum = canDeterminate ? Number(totalPermsBig) : null;
      setProgress(0, !canDeterminate);
      const chunk = 500;
      function runChunk(){
  if(isCanceled()){ statusEl.textContent = 'Exact computation canceled'; setProgress(null); return resolve({total:valid, counts, approx:false}); }
        let iter = 0;
        while(iter < chunk){
          const nxt = gen.next();
          if(nxt.done){ statusEl.textContent = `Exact complete — ${valid} valid permutations`; setProgress(100, false); return resolve({total:valid, counts, approx:false}); }
          processed++;
          const perm = nxt.value;
          let ok = true;
          for(let b=0;b<n;b++){
            const p = perm[b];
            const h = hints[b];
            if(h.is !== null && p !== h.is){ ok=false; break; }
            if(h.not.has(p)){ ok=false; break; }
          }
          if(ok){ valid++; for(let b=0;b<n;b++){ counts[b][perm[b]]++; } }
          iter++;
        }
        if(canDeterminate){
          const pct = (processed / totalPermsNum) * 100;
          setProgress(pct, false);
          statusEl.textContent = `Exact enumeration — processed ${processed.toLocaleString()} of ${totalPermsStr} permutations — valid ${valid}`;
        } else {
          // indeterminate progress
          setProgress(0, true);
          statusEl.textContent = `Exact enumeration — processed ${processed.toLocaleString()} permutations (total ${totalPermsStr}) — valid ${valid}`;
        }
        setTimeout(runChunk, 0);
      }
      setTimeout(runChunk, 0);
    });
  }

  async function updateAll(){
    const n = items.length;
    statusEl.textContent = 'Computing...';
    const res = await computeProbabilitiesAsync();
    const total = res.total;
    const counts = res.counts;
    // update Reveal/Ask-not button visibility based on simulationTruth
    for(let b=0;b<n;b++){
      const revealBtn = document.querySelector(`#box-${b} .revealBtn`);
      const askBtn = document.querySelector(`#box-${b} .askNotBtn`);
      if(revealBtn) revealBtn.style.display = simulationTruth ? '' : 'none';
      if(askBtn) askBtn.style.display = simulationTruth ? '' : 'none';
    }

    // update each box table
    for(let b=0;b<n;b++){
      const table = document.getElementById(`box-${b}-probs`);
      table.innerHTML = '';
      for(let i=0;i<n;i++){
        const tr = document.createElement('tr');
        const td1 = document.createElement('td'); td1.textContent = items[i];
        const td2 = document.createElement('td');
        const c = total? counts[b][i] : 0;
        const pct = total ? (100*c/total) : 0;
        td2.textContent = total ? (pct.toFixed(1)+'%') : '—';
        if(simulationTruth && simulationTruth[b] === i){ tr.classList.add('simRevealed'); td2.textContent += ' (true)'; }
        if(c>0) td1.classList.add('probHigh');
        tr.appendChild(td1); tr.appendChild(td2);
        table.appendChild(tr);
      }
      // no per-box footer (we show computation status in the single global status area)
      if(table.nextSibling && table.nextSibling.className==='small') table.parentNode.removeChild(table.nextSibling);
    }

    // breakdown: best for each item
      bestForItem.innerHTML = '<h4>Probability breakdown — boxes are ordered most → least likely for each item</h4>' +
        '<p class="small">Colors show relative likelihood across all items: greener = more likely (scaled against the overall min/max). Boxes with 0% are omitted.</p>';
      // clear avoid section (we show full breakdown instead)
      avoidForItem.innerHTML = '';
      // If there are no valid permutations at all, show a short message
      if(!total){
        const note = document.createElement('div'); note.className = 'small'; note.textContent = 'No valid permutations (hints are contradictory or leave no possibilities).';
        bestForItem.appendChild(note);
        return;
      }

      // compute global min/max across all non-zero probabilities so colors are comparable between items
      const allP = [];
      const nonOneP = [];
      for(let b=0;b<n;b++){
        for(let i=0;i<n;i++){
          const c = total? counts[b][i] : 0;
          const p = total? c/total : 0;
          if(p>0){ allP.push(p); if(p !== 1) nonOneP.push(p); }
        }
      }
      let globalMin, globalMax, globalRange;
      if(nonOneP.length > 0){
        globalMin = Math.min(...nonOneP);
        globalMax = Math.max(...nonOneP);
        globalRange = globalMax - globalMin;
      } else if(allP.length > 0){
        // all non-zero probabilities are 1 — use 0..1 range so 1 can still be vivid but won't compress others
        globalMin = 0; globalMax = 1; globalRange = 1;
      } else { globalMin = 0; globalMax = 0; globalRange = 0; }

      for(let i=0;i<n;i++){
        const row = document.createElement('div'); row.className = 'breakdownItem';
        const label = document.createElement('div'); label.className = 'breakdownItemLabel'; label.textContent = items[i];
        row.appendChild(label);

        // build array of boxes with probability (omit zeros)
        const boxes = [];
        for(let b=0;b<n;b++){ const c = total? counts[b][i] : 0; const p = total? c/total : 0; if(p>0) boxes.push({b,p}); }
        if(boxes.length === 0){
          const none = document.createElement('div'); none.className = 'small'; none.textContent = 'No possible boxes (0% for all)'; row.appendChild(none); bestForItem.appendChild(row); continue;
        }

        // sort descending (most likely left)
        boxes.sort((a,bb)=> bb.p - a.p);

    // we'll use globalRange/globalMin/globalMax to scale colors so items are comparable

        const list = document.createElement('div'); list.className = 'breakdownList';
        boxes.forEach((obj, idx)=>{
          const b = obj.b; const p = obj.p;
          const span = document.createElement('span'); span.className = 'boxProb';
          if(idx===0) span.classList.add('best'); // best box highlight

    // compute relative scale within [0,1] using global min/max; fallback to 1 when equal
    let rel = (globalRange > 0) ? (p - globalMin) / globalRange : 1;
    // slightly compress differences so nearby values remain visually similar (exponent <1)
    rel = Math.pow(Math.max(0, rel), 0.9);

    // special-case exact 100% to show vivid green
    if(p === 1) rel = 1;

    // map rel to hue 0 (red) -> 140 (green)
    const hue = Math.round(rel * 140);
    // map rel to lightness (higher rel -> darker)
    const light = Math.round(92 - rel * 50);
          const bg = `hsl(${hue} 75% ${light}%)`;
          span.style.background = bg;
          // text color for contrast
          const textColor = rel > 0.55 ? '#fff' : '#111';
          span.style.color = textColor;

          const boxSpan = document.createElement('span'); boxSpan.className = 'boxLabel'; boxSpan.textContent = 'Box '+(b+1);
          const pct = document.createElement('span'); pct.className = 'boxPct'; pct.textContent = total ? (' '+(p*100).toFixed(1)+'%') : ' —';
          pct.style.color = textColor;

          span.appendChild(boxSpan);
          span.appendChild(pct);
          span.title = `Box ${b+1}: ${(p*100).toFixed(2)}%`;
          list.appendChild(span);
        });

        row.appendChild(list);
        bestForItem.appendChild(row);
      }
    // leave status as final message (already set by sampler), or clear for exact
    if(!res.approx) statusEl.textContent = `Computed exact over ${total} consistent permutations`;
  }

  function randomAssign(){
    const n = items.length;
    const indices = Array.from({length:n}, (_,i)=>i);
    // shuffle
    for(let i=n-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [indices[i],indices[j]]=[indices[j],indices[i]]; }
    simulationTruth = indices.slice();
    updateAll();
    alert('Random assignment created. Reveal/Ask-not buttons are now visible.');
  }

  function clearSimulation(){ simulationTruth = null; updateAll(); }

  // initial
  ensureItemCount(6);
  renderItemsList();
  generateBtn.addEventListener('click', generateBoxes);
  randomAssignBtn.addEventListener('click', randomAssign);
  clearSimBtn.addEventListener('click', clearSimulation);
  // auto-generate first time
  generateBoxes();
})();
