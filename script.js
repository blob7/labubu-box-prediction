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
      input.addEventListener('input', ()=>{ items[idx] = input.value; if(hints.length) updateAll(); });
      const remove = document.createElement('button');
      remove.textContent = '-';
      remove.className = 'remove';
      remove.addEventListener('click', ()=>{
        items.splice(idx,1);
        // keep internal item array consistent and re-render the list
        ensureItemCount(items.length);
        renderItemsList();
      });
      li.appendChild(input);
      li.appendChild(remove);
      itemsList.appendChild(li);
    });
  }

  addItemBtn.addEventListener('click', ()=>{ items.push('Item '+(items.length+1)); renderItemsList(); });

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
      isLabel.textContent = 'Is:';
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
    const n = items.length;
    const indices = Array.from({length:n}, (_,i)=>i);
    if(n <= 9){
      // exact
      const counts = Array.from({length:n}, ()=>Array(n).fill(0));
      let total = 0;
      for(const perm of permutations(indices)){
        let ok = true;
        for(let b=0;b<n;b++){
          const p = perm[b];
          const h = hints[b];
          if(h.is !== null && p !== h.is){ ok=false; break; }
          if(h.not.has(p)){ ok=false; break; }
        }
        if(ok){ total++; for(let b=0;b<n;b++){ counts[b][perm[b]]++; } }
      }
      return Promise.resolve({total, counts, approx:false});
    }

    // Monte Carlo sampling for larger n
    const sampleSize = Math.max(20000, Math.min(100000, Math.floor(20000 * (11 / n))));
    let done = 0;
    let valid = 0;
    const counts = Array.from({length:n}, ()=>Array(n).fill(0));

    statusEl.textContent = `Sampling ${sampleSize} random permutations (approximate) ...`;

    return new Promise((resolve)=>{
      const chunk = 500; // iterations per event loop tick
      function runChunk(){
        const lim = Math.min(done + chunk, sampleSize);
        for(; done < lim; done++){
          // generate random permutation by shuffling indices
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
        if(done < sampleSize) setTimeout(runChunk, 0);
        else {
          statusEl.textContent = `Sampling complete — ${valid} valid permutations (approx).`;
          resolve({total: valid, counts, approx:true});
        }
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
      // also show total count
      const footer = document.createElement('div'); footer.className='small'; footer.textContent = res.approx ? `Sampled valid permutations: ${total} (approx)` : `Consistent permutations: ${total}`;
      if(table.nextSibling && table.nextSibling.className==='small') table.parentNode.removeChild(table.nextSibling);
      table.parentNode.appendChild(footer);
    }

    // breakdown: best for each item
    bestForItem.innerHTML = '<h4>Best boxes for each item</h4>';
    avoidForItem.innerHTML = '<h4>Boxes to avoid for each item</h4>';
    for(let i=0;i<n;i++){
      // find box with max probability for item i
      let bestP = -1, bestBoxes=[];
      let worstP = 2, worstBoxes=[];
      for(let b=0;b<n;b++){
        const c = total? counts[b][i] : 0;
        const p = total? c/total : 0;
        if(p > bestP){ bestP = p; bestBoxes = [b]; }
        else if(Math.abs(p-bestP) < 1e-12) bestBoxes.push(b);
        if(p < worstP){ worstP = p; worstBoxes = [b]; }
        else if(Math.abs(p-worstP) < 1e-12) worstBoxes.push(b);
      }
      const bdiv = document.createElement('div'); bdiv.className='chip';
      bdiv.textContent = `${items[i]} → best: ${bestBoxes.map(b=>'Box '+(b+1)).join(', ')} (${(bestP*100).toFixed(1)}%)`;
      bestForItem.appendChild(bdiv);

      const wdiv = document.createElement('div'); wdiv.className='chip';
      wdiv.textContent = `${items[i]} → avoid: ${worstBoxes.map(b=>'Box '+(b+1)).join(', ')} (${(worstP*100).toFixed(1)}%)`;
      avoidForItem.appendChild(wdiv);
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
