(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const DOCS_KEY = 'forma.presentations.v1';
  const ACTIVE_KEY = 'forma.activePresentation';
  const themes = {
    violet: {name:'Studio', background:'#ffffff', ink:'#292744', accent:'#6f5be5', pale:'#f1edff'},
    midnight: {name:'Midnight', background:'#17182e', ink:'#ffffff', accent:'#a49aff', pale:'#292844'},
    paper: {name:'Paper', background:'#fcf8f0', ink:'#302b23', accent:'#bd7451', pale:'#f4e9dc'},
    ocean: {name:'Coastal', background:'#eff8fb', ink:'#18374a', accent:'#258ba5', pale:'#d9eff3'}
  };
  let docs = [];
  let activeDocumentId = '';
  let deck = null;
  let selectedSlide = 0;
  let selectedObject = null;
  let history = [];
  let future = [];
  let saveTimer = null;
  let textEditSnapshot = null;
  let toastTimer = null;
  let activeLaunchTab = 'home';
  let presenterIndex = 0;

  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Date().toISOString();
  const createText = (text, x, y, w, h, size, color, weight=500, extra={}) => ({id:uid(),type:'text',text,x,y,w,h,fontSize:size,color,weight,...extra});
  const createShape = (x,y,w,h,fill,shape='rect',extra={}) => ({id:uid(),type:'shape',shape,x,y,w,h,fill,...extra});
  function starterDeck(title='A fresh perspective') {
    return {
      id: uid(), title, createdAt: today(), updatedAt: today(),
      slides: [
        {id:uid(),theme:'violet',layout:'Title slide',notes:'Start with a pause. Introduce the central idea, then let the room sit with it for a moment.',objects:[
          createShape(0,0,1.15,100,'#6f5be5'),
          createText('FIELDNOTES     /     01',7.2,10,38,4,10,'#796ab8',700,{letterSpacing:'2px'}),
          createText('The art of\na clear idea.',7.2,29,77,27,54,'#292744',700,{lineHeight:1.03,letterSpacing:'-1.8px'}),
          createText('A small guide to making your next big thing make sense.',7.4,65,58,9,18,'#76758c',400,{lineHeight:1.35}),
          createShape(76,67,14,14,'#f2efff','circle'),
          createShape(82,60,6,6,'#b8adff','circle'),
          createText('YOUR NAME     ·     MAY 2026',7.3,88,44,4,9,'#9290a6',600,{letterSpacing:'1.5px'})
        ]},
        {id:uid(),theme:'midnight',layout:'Section header',notes:'A clear idea gives every detail a job to do.',objects:[
          createText('01    /    THE FOUNDATION',7.2,10,54,4,10,'#aaa3ec',700,{letterSpacing:'2px'}),
          createText('Start with\nthe why.',7.2,26,60,26,48,'#ffffff',700,{lineHeight:1.05,letterSpacing:'-1.5px'}),
          createText('The strongest work begins with one honest question: what should someone understand, feel, or do?',7.4,61,56,13,16,'#c5c4d7',400,{lineHeight:1.45}),
          createShape(73,24,18,52,'#272844','rect',{radius:5}),
          createShape(78,31,8,8,'#8172e8','circle'),
          createText('CLARITY',75,49,14,5,12,'#ffffff',700,{align:'center',letterSpacing:'1px'}),
          createText('One idea.\nRoom to breathe.',75,58,14,10,10,'#c5c4d7',400,{align:'center',lineHeight:1.35})
        ]},
        {id:uid(),theme:'ocean',layout:'Title and content',notes:'Keep this simple: choose a direction, test it in the real world, then make it better.',objects:[
          createText('02    /    A PRACTICAL APPROACH',7.2,9,63,4,10,'#398ba0',700,{letterSpacing:'1.8px'}),
          createText('Make the complex\nfeel simple.',7.2,20,74,18,39,'#18374a',700,{lineHeight:1.08,letterSpacing:'-1.3px'}),
          createShape(7.3,50,25,1,'#258ba5'),
          createText('01',7.3,57,8,7,19,'#258ba5',700),createText('Find the signal',13,57,27,7,16,'#18374a',700),
          createText('Name the one thing that matters most.',13,66,34,8,12,'#617d8c',400),
          createText('02',53,57,8,7,19,'#258ba5',700),createText('Make it visible',59,57,27,7,16,'#18374a',700),
          createText('Give the main idea room to land.',59,66,34,8,12,'#617d8c',400),
          createShape(7.3,84,85,.5,'#d5e8ed'),
          createText('LESS, BUT BETTER',7.3,87,40,4,9,'#398ba0',700,{letterSpacing:'1.5px'})
        ]}
      ]
    };
  }
  async function loadDocs() {
    if (window.formaDesktop) {
      try {
        const saved = await window.formaDesktop.loadWorkspace();
        docs = Array.isArray(saved?.documents) ? saved.documents : [];
        activeDocumentId = typeof saved?.activeId === 'string' ? saved.activeId : '';
      } catch (error) { console.error('Could not load Forma workspace:', error); docs=[]; }
    } else {
      try { docs = JSON.parse(localStorage.getItem(DOCS_KEY) || '[]'); if (!Array.isArray(docs)) docs=[]; activeDocumentId=localStorage.getItem(ACTIVE_KEY)||''; } catch { docs=[];activeDocumentId=''; }
    }
    docs = docs.filter(d => d && d.id && Array.isArray(d.slides));
  }
  function persistDocs() {
    if (window.formaDesktop) return window.formaDesktop.saveWorkspace({documents:docs,activeId:activeDocumentId});
    try { localStorage.setItem(DOCS_KEY, JSON.stringify(docs));localStorage.setItem(ACTIVE_KEY,activeDocumentId);return Promise.resolve(true); }
    catch (error) { return Promise.reject(error); }
  }
  function activeDoc() { return docs.find(d => d.id === activeDocumentId) || docs[0] || null; }
  function markActive(d) { activeDocumentId=d.id; }
  function openDocument(id) {
    const found = docs.find(d=>d.id===id);
    if (!found) return;
    deck = found; markActive(deck); selectedSlide=0;selectedObject=null;history=[];future=[];
    showSlides(); renderEditor();
    persistDocs().catch(error=>console.error('Could not save Forma workspace:',error));
  }
  function createPresentation() {
    const d = starterDeck('Untitled presentation'); docs.unshift(d); markActive(d); openDocument(d.id);
  }
  function showSlides() { $('#launcher').hidden=true;$('#slidesApp').hidden=false;document.title=`${deck?.title || 'Slides'} — Forma`; }
  function showLauncher() { $('#slidesApp').hidden=true;$('#launcher').hidden=false;document.title='Forma — your creative workspace';renderLauncher(); }
  function toast(message, editor=false) {
    const el = $(editor?'#toastEditor':'#toast'); if (!el) return;
    el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);
  }
  function snapshot() { return JSON.stringify(deck); }
  function pushHistory() { if (!deck) return;history.push(snapshot());if(history.length>35)history.shift();future=[];updateUndoButtons(); }
  function restoreSnapshot(value) { deck=JSON.parse(value);docs[docs.findIndex(d=>d.id===deck.id)]=deck;selectedObject=null;saveNow();renderEditor(); }
  function undo() { if(!history.length)return;future.push(snapshot());restoreSnapshot(history.pop()); }
  function redo() { if(!future.length)return;history.push(snapshot());restoreSnapshot(future.pop()); }
  function updateUndoButtons(){ $('#undoBtn').disabled=!history.length;$('#redoBtn').disabled=!future.length; }
  function saveSoon() {
    if(!deck)return;
    $('#saveStatus').textContent='Saving…';
    clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,320);
  }
  function saveNow() {
    if(!deck)return;
    deck.updatedAt=today();
    const i=docs.findIndex(d=>d.id===deck.id);if(i<0)docs.unshift(deck);else docs[i]=deck;
    persistDocs().then(()=>{$('#saveStatus').textContent='Saved to this device';$('#saveStatus').previousElementSibling?.classList.add('saved');renderLauncher();}).catch(error=>{console.error('Could not save Forma workspace:',error);$('#saveStatus').textContent='Could not save';toast('Could not save your work. Export a copy to keep it safe.',true);});
  }
  function formatRelative(date) {
    const t=new Date(date).getTime();if(!t)return 'Recently edited';
    const diff=Math.max(0,Date.now()-t);if(diff<60000)return 'Just now';if(diff<3600000)return `${Math.floor(diff/60000)} min ago`;if(diff<86400000)return `${Math.floor(diff/3600000)} hr ago`;if(diff<172800000)return 'Yesterday';return new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  }
  function dateLabel(){const d=new Date();return d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();}
  function renderLauncher() {
    $('#currentDate').textContent=dateLabel();
    const list=$('#recentList');list.innerHTML='';
    const sorted=[...docs].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
    $('#emptyState').hidden=sorted.length>0;list.hidden=sorted.length===0;
    sorted.slice(0,5).forEach(d=>{
      const row=document.createElement('div');row.className='recent-row';row.tabIndex=0;row.setAttribute('role','button');row.dataset.docId=d.id;
      const first=d.slides?.[0];const th=themes[first?.theme]||themes.violet;
      row.innerHTML=`<div class="recent-preview" style="background:${esc(th.background)}"><span class="preview-title" style="color:${esc(th.accent)}">${esc((d.title||'Untitled').slice(0,19))}</span></div><div class="recent-meta"><div class="recent-name">${esc(d.title||'Untitled presentation')}</div><div class="recent-detail">Slides · ${d.slides?.length||0} ${(d.slides?.length||0)===1?'slide':'slides'}</div></div><span class="recent-time">${formatRelative(d.updatedAt)}</span><span class="recent-open">→</span>`;
      list.append(row);
    });
    const active=$('.nav-item[data-launch-tab="'+activeLaunchTab+'"]');$$('.nav-item[data-launch-tab]').forEach(b=>b.classList.toggle('active',b===active));
    if(activeLaunchTab==='recent'){$('#launchEyebrow').textContent='YOUR WORK, IN PROGRESS';$('#launchTitle').innerHTML='Welcome back, Alex <span>✦</span>';$('#launchSubtitle').textContent='Pick up right where you left off.';$('#recentHeading').textContent='Recently opened';$('#recentDescription').textContent='The presentations you have been working on.';}
    else if(activeLaunchTab==='files'){$('#launchEyebrow').textContent='YOUR CREATIVE WORKSPACE';$('#launchTitle').innerHTML='Your files <span>✦</span>';$('#launchSubtitle').textContent='All your presentations, saved on this device.';$('#recentHeading').textContent='All presentations';$('#recentDescription').textContent='Your local Forma presentation files.';}
    else{$('#launchEyebrow').textContent='YOUR CREATIVE WORKSPACE';$('#launchTitle').innerHTML='Good morning, Alex <span>✦</span>';$('#launchSubtitle').textContent='A little space for your biggest ideas.';$('#recentHeading').textContent='Pick up where you left off';$('#recentDescription').textContent='Your presentations, right where you need them.';}
  }
  function formatObject(obj, scale=1, editable=false) {
    const style=`left:${obj.x}%;top:${obj.y}%;width:${obj.w}%;height:${obj.h}%;`;
    if(obj.type==='text'){
      const extra=[obj.align?`text-align:${obj.align}`:'',obj.letterSpacing?`letter-spacing:${obj.letterSpacing}`:'',obj.lineHeight?`line-height:${obj.lineHeight}`:''].filter(Boolean).join(';');
      return `<div class="slide-object slide-text" data-object-id="${esc(obj.id)}" style="${style}font-size:${(obj.fontSize||18)*scale}px;font-family:${esc(obj.fontFamily||'Manrope')},sans-serif;color:${esc(obj.color||'#292744')};font-weight:${obj.weight||500};${extra}" ${editable?'contenteditable="true" spellcheck="false"':''}>${esc(obj.text||'').replace(/\n/g,'<br>')}</div>`;
    }
    if(obj.type==='image') return `<div class="slide-object" data-object-id="${esc(obj.id)}" style="${style}"><img class="slide-image" src="${esc(obj.src)}" alt="${esc(obj.alt||'Slide image')}" style="border-radius:${obj.radius||0}px"></div>`;
    const shape=obj.shape||'rect';
    return `<div class="slide-object" data-object-id="${esc(obj.id)}" style="${style}"><div class="slide-shape" style="background:${esc(obj.fill||'#7564df')};border-radius:${shape==='circle'?'50%':(obj.radius||0)+'px'};${obj.stroke?`border:${obj.strokeWidth||1}px solid ${esc(obj.stroke)}`:''}"></div></div>`;
  }
  function fillCanvas(container, slide, options={}) {
    if(!container||!slide)return;
    const theme=themes[slide.theme]||themes.violet;const width=container.clientWidth||900;
    container.dataset.theme=slide.theme||'violet';container.style.background=theme.background;
    container.innerHTML=(slide.objects||[]).map(o=>formatObject(o,width/900,!options.preview)).join('');
    container.querySelectorAll('.slide-object').forEach(el=>el.classList.toggle('selected-object',!options.preview&&el.dataset.objectId===selectedObject));
  }
  function renderThumbnails() {
    const list=$('#thumbnailList');list.innerHTML='';
    deck.slides.forEach((slide,i)=>{
      const item=document.createElement('button');item.className='thumbnail-item'+(i===selectedSlide?' selected':'');item.dataset.slide=i;item.setAttribute('aria-label',`Slide ${i+1}: ${slide.layout||'Slide'}`);
      const th=themes[slide.theme]||themes.violet;
      item.innerHTML=`<span class="thumbnail-number">${i+1}</span><div class="thumb-frame"><div class="thumb-render" style="width:900px;height:506px;transform:scale(${143/900});transform-origin:top left;background:${esc(th.background)}">${(slide.objects||[]).map(o=>formatObject(o,1)).join('')}</div></div>`;
      list.append(item);
    });
    $('#slideCount').textContent=`${deck.slides.length} ${deck.slides.length===1?'slide':'slides'}`;
  }
  function renderEditor() {
    if(!deck)return;
    $('#deckTitle').value=deck.title;$('#canvasDeckTitle').textContent=deck.title;
    const slide=deck.slides[selectedSlide];if(!slide)return;
    $('#speakerNotes').value=slide.notes||'';
    renderThumbnails();fillCanvas($('#slideCanvas'),slide);renderInspector();updateUndoButtons();
    const selected=$(`.thumbnail-item[data-slide="${selectedSlide}"]`);selected?.scrollIntoView({block:'nearest'});
  }
  const themesMarkup=()=>`<div class="theme-picker">${Object.entries(themes).map(([key,t])=>`<button class="theme-option ${deck.slides[selectedSlide].theme===key?'active':''}" data-theme-choice="${key}" title="${t.name}"><span class="theme-sample" style="background:${t.background};--sample-ink:${t.ink};--sample-accent:${t.accent}"></span><span>${t.name}</span></button>`).join('')}</div>`;
  function renderInspector() {
    const root=$('#inspectorContent');if(!deck)return;
    const slide=deck.slides[selectedSlide];const obj=slide.objects.find(o=>o.id===selectedObject);
    let html='';
    if(obj?.type==='text'){
      html=`<div class="inspector-section"><div class="inspector-section-title">Text options <span>⌄</span></div><label class="inspector-label">Font family</label><select class="inspector-select" id="fontFamily"><option>Manrope</option><option>DM Sans</option><option>Georgia</option><option>Arial</option></select><div class="inspector-row" style="margin-top:10px"><div class="inspector-field"><label class="inspector-label">Size</label><input class="inspector-input" id="fontSizeInput" type="number" min="8" max="96" value="${obj.fontSize||18}"></div><div class="inspector-field"><label class="inspector-label">Weight</label><select class="inspector-select" id="fontWeight"><option value="400" ${obj.weight<600?'selected':''}>Regular</option><option value="600" ${obj.weight>=600?'selected':''}>Semibold</option><option value="700" ${obj.weight>=700?'selected':''}>Bold</option></select></div></div><label class="inspector-label" style="margin-top:10px">Text color</label><div class="swatch-row">${['#292744','#6f5be5','#258ba5','#d66c51','#ffffff','#17182e'].map(c=>`<button class="swatch ${obj.color===c?'active':''}" data-text-color="${c}" style="background:${c}" aria-label="Text color ${c}"></button>`).join('')}</div></div><div class="inspector-section"><div class="inspector-section-title">Position and size</div><div class="inspector-row"><div class="inspector-field"><label class="inspector-label">X position</label><input class="inspector-input position-input" data-prop="x" type="number" value="${Math.round(obj.x)}"></div><div class="inspector-field"><label class="inspector-label">Y position</label><input class="inspector-input position-input" data-prop="y" type="number" value="${Math.round(obj.y)}"></div></div></div>`;
    } else if(obj?.type==='shape'){
      html=`<div class="inspector-section"><div class="inspector-section-title">Shape options</div><label class="inspector-label">Fill color</label><div class="swatch-row">${['#6f5be5','#292744','#258ba5','#d66c51','#f2c05d','#ffffff'].map(c=>`<button class="swatch ${obj.fill===c?'active':''}" data-shape-color="${c}" style="background:${c}" aria-label="Fill color ${c}"></button>`).join('')}</div></div><div class="inspector-section"><div class="inspector-section-title">Position and size</div><div class="inspector-row">${[['x','X'],['y','Y'],['w','W'],['h','H']].map(([key,label])=>`<div class="inspector-field"><label class="inspector-label">${label}</label><input class="inspector-input position-input" data-prop="${key}" type="number" value="${Math.round(obj[key])}"></div>`).join('')}</div></div>`;
    } else if(obj?.type==='image'){
      html=`<div class="inspector-section"><div class="inspector-section-title">Image options</div><label class="inspector-label">Description</label><input class="inspector-input" id="imageAlt" value="${esc(obj.alt||'')}" placeholder="Describe this image"></div><div class="inspector-section"><div class="inspector-section-title">Position and size</div><div class="inspector-row">${[['x','X'],['y','Y'],['w','W'],['h','H']].map(([key,label])=>`<div class="inspector-field"><label class="inspector-label">${label}</label><input class="inspector-input position-input" data-prop="${key}" type="number" value="${Math.round(obj[key])}"></div>`).join('')}</div></div>`;
    } else {
      html=`<div class="inspector-section"><div class="inspector-section-title">Slide background <span>▱</span></div>${themesMarkup()}<p class="inspector-description">A theme gives every slide a harmonious set of colors. Choose one to change this slide.</p></div><div class="inspector-section"><div class="inspector-section-title">Layout</div><select class="inspector-select" id="layoutSelect">${['Title slide','Title and content','Section header','Two columns','Blank'].map(l=>`<option ${slide.layout===l?'selected':''}>${l}</option>`).join('')}</select><p class="inspector-description">Layout presets are a starting point. Every element stays editable.</p></div><div class="inspector-section"><div class="inspector-section-title">Transition</div><select class="inspector-select" id="transitionSelect"><option>Fade</option><option>Push</option><option>Wipe</option><option>None</option></select></div>`;
    }
    root.innerHTML=html;
    $('#inspector').querySelector('.inspector-header h3').textContent=obj?({text:'Text',shape:'Shape',image:'Image'}[obj.type]||'Format'):'Format';
  }
  function actionButton(action,label,iconName,extra='') {return `<button class="ribbon-action ${extra}" data-action="${action}">${icon(iconName)}<span>${label}</span></button>`;}
  function group(label,content){return `<div class="ribbon-group">${content}<span class="ribbon-group-label">${label}</span></div>`;}
  function renderRibbon(tab='Home') {
    let content='';
    if(tab==='Home'){
      content=group('Slides',actionButton('new-slide','New slide','plus','big')+actionButton('duplicate-slide','Duplicate','layout')+actionButton('delete-slide','Delete','close'))+
      group('Insert',actionButton('text','Text box','text')+actionButton('shape','Shape','shape')+actionButton('image','Image','image'))+
      group('Text',`<select class="ribbon-select" id="ribbonFont"><option>Manrope</option><option>DM Sans</option><option>Georgia</option></select><select class="ribbon-select" id="ribbonSize"><option>18</option><option>24</option><option>32</option><option>40</option><option>48</option></select>${actionButton('bold','Bold','text')}<button class="ribbon-color" data-action="text-color"><span class="color-line"></span>A</button>`)+
      group('Arrange',actionButton('bring-front','Bring forward','layout')+actionButton('delete-object','Remove','close'))+
      group('File',actionButton('export','Download file','save')+actionButton('import','Open file','folder'));
    } else if(tab==='Insert'){
      content=group('Add to your slide',actionButton('text','Text box','text','big')+actionButton('shape','Shape','shape','big')+actionButton('image','Picture','image','big'))+
      group('Build',actionButton('new-slide','New slide','plus','big')+actionButton('duplicate-slide','Duplicate slide','layout'))+
      group('Your file',actionButton('speaker-notes','Speaker notes','text')+actionButton('export','Download file','save')+actionButton('import','Open file','folder'));
    } else if(tab==='Design'){
      content=group('Themes',Object.entries(themes).map(([key,t])=>`<button class="ribbon-action theme-ribbon" data-theme-choice="${key}"><span class="theme-sample" style="width:33px;height:24px;background:${t.background};--sample-ink:${t.ink};--sample-accent:${t.accent};border:1px solid #e6e5ec;border-radius:3px"></span><span>${t.name}</span></button>`).join(''))+
      group('Page setup',`<button class="ribbon-action" data-action="fit"><span style="font-size:18px">▱</span><span>Widescreen</span></button>${actionButton('background','Background','shape')}`);
    } else if(tab==='Transitions'){
      content=group('Transition to this slide',`<select class="ribbon-select" id="ribbonTransition"><option>Fade</option><option>Push</option><option>Wipe</option><option>None</option></select><button class="ribbon-action" data-action="apply-all"><span style="font-size:18px">✦</span><span>Apply to all</span></button>`)+group('Preview',actionButton('preview-transition','Preview','play'));
    } else if(tab==='Review'){
      content=group('Notes',actionButton('speaker-notes','Speaker notes','text','big'))+group('Check',`<button class="ribbon-action" data-action="accessibility">${icon('check')}<span>Accessibility</span></button><button class="ribbon-action" data-action="spellcheck"><span style="font-size:17px">Aa</span><span>Spelling</span></button>`);
    } else {
      content=group('View',`<button class="ribbon-action" data-action="grid">${icon('layout')}<span>Guides</span></button>${actionButton('fit','Fit to window','layout')}<button class="ribbon-action" data-action="notes"><span style="font-size:18px">▤</span><span>Notes</span></button>`)+group('Presentation',actionButton('present','Start slideshow','play','big'));
    }
    $('#ribbon').innerHTML=content;
  }
  function setSlideTheme(key) {
    if(!themes[key])return;pushHistory();deck.slides[selectedSlide].theme=key;selectedObject=null;renderEditor();saveSoon();
  }
  function addSlide() {
    pushHistory();const t=themes[deck.slides[selectedSlide]?.theme||'violet'];
    const slide={id:uid(),theme:deck.slides[selectedSlide]?.theme||'violet',layout:'Title and content',notes:'',objects:[createText('A new idea',7.2,12,72,12,39,t.ink,700,{lineHeight:1.08,letterSpacing:'-1px'}),createShape(7.3,31,14,.8,t.accent),createText('Add a little context here.',7.3,38,65,8,17,'#77778c',400)]};
    deck.slides.splice(selectedSlide+1,0,slide);selectedSlide++;selectedObject=null;renderEditor();saveSoon();$('#slideCanvas [contenteditable="true"]')?.focus();
  }
  function duplicateSlide() {
    pushHistory();const copy=JSON.parse(JSON.stringify(deck.slides[selectedSlide]));copy.id=uid();copy.objects.forEach(o=>o.id=uid());deck.slides.splice(selectedSlide+1,0,copy);selectedSlide++;selectedObject=null;renderEditor();saveSoon();
  }
  function deleteSlide() {
    if(deck.slides.length<2){toast('A presentation needs at least one slide.',true);return;}
    pushHistory();deck.slides.splice(selectedSlide,1);selectedSlide=Math.min(selectedSlide,deck.slides.length-1);selectedObject=null;renderEditor();saveSoon();
  }
  function addObject(type) {
    pushHistory();const objs=deck.slides[selectedSlide].objects;
    let obj;
    if(type==='text')obj=createText('Type something wonderful',25,40,50,13,25,themes[deck.slides[selectedSlide].theme].ink,600,{align:'center'});
    else if(type==='shape')obj=createShape(39,38,22,22,'#8273e8','circle');
    if(!obj)return;objs.push(obj);selectedObject=obj.id;renderEditor();saveSoon();
    if(type==='text'){const el=$(`#slideCanvas [data-object-id="${obj.id}"]`);el?.focus();document.execCommand?.('selectAll',false,null);}
  }
  function openImagePicker(){ $('#imageUpload').click(); }
  function addImage(file) {
    if(!file||!file.type.startsWith('image/'))return;
    if(file.size>8*1024*1024){toast('Choose an image smaller than 8 MB.',true);return;}
    const reader=new FileReader();reader.onload=()=>{pushHistory();const obj={id:uid(),type:'image',src:reader.result,alt:file.name.replace(/\.[^.]+$/,''),x:24,y:22,w:52,h:56};deck.slides[selectedSlide].objects.push(obj);selectedObject=obj.id;renderEditor();saveSoon();};reader.readAsDataURL(file);
  }
  function doAction(action) {
    switch(action){
      case 'new-slide':addSlide();break;case 'duplicate-slide':duplicateSlide();break;case 'delete-slide':deleteSlide();break;
      case 'text':addObject('text');break;case 'shape':addObject('shape');break;case 'image':openImagePicker();break;
      case 'delete-object':if(selectedObject){pushHistory();deck.slides[selectedSlide].objects=deck.slides[selectedSlide].objects.filter(o=>o.id!==selectedObject);selectedObject=null;renderEditor();saveSoon();}else toast('Select an object on the slide first.',true);break;
      case 'export':exportDeck();break;case 'import':$('#importInput').click();break;case 'present':startPresentation();break;case 'background':renderInspector();toast('Choose a theme in the Format panel.',true);break;
      case 'fit':fitZoom();break;case 'grid':$('#slideCanvas').classList.toggle('guides');toast('Layout guides toggled.',true);break;
      case 'notes':$('#notesToggle').click();break;case 'speaker-notes':$('#speakerNotes').focus();break;
      case 'apply-all':{const theme=deck.slides[selectedSlide].theme;pushHistory();deck.slides.forEach(s=>s.theme=theme);renderEditor();saveSoon();toast('Theme applied to every slide.',true);break;}
      case 'preview-transition':toast('Transition preview is ready for the next update.',true);break;
      case 'accessibility':toast(accessibilityReport(),true);break;
      case 'spellcheck':toast('Spell-check is available in your browser.',true);break;
      case 'bold':toggleBold();break;case 'text-color':cycleTextColor();break;
      case 'bring-front':if(selectedObject){pushHistory();const a=deck.slides[selectedSlide].objects;const i=a.findIndex(o=>o.id===selectedObject);a.push(a.splice(i,1)[0]);renderEditor();saveSoon();}break;
    }
  }
  function accessibilityReport(){let noAlt=0,small=0;for(const o of deck.slides.flatMap(s=>s.objects)){if(o.type==='image'&&!o.alt)noAlt++;if(o.type==='text'&&o.fontSize<13)small++;}return noAlt||small?`Review ${noAlt?`${noAlt} image description${noAlt>1?'s':''}`:''}${noAlt&&small?' and ':''}${small?`${small} small text item${small>1?'s':''}`:''} for accessibility.`:'Looks good — no common accessibility issues found.';}
  function toggleBold(){const obj=deck.slides[selectedSlide].objects.find(o=>o.id===selectedObject);if(!obj||obj.type!=='text'){toast('Select a text box first.',true);return;}pushHistory();obj.weight=obj.weight>=700?400:700;renderEditor();saveSoon();}
  function cycleTextColor(){const obj=deck.slides[selectedSlide].objects.find(o=>o.id===selectedObject);if(!obj||obj.type!=='text'){toast('Select a text box first.',true);return;}const colors=['#292744','#6f5be5','#258ba5','#d66c51'];obj.color=colors[(colors.indexOf(obj.color)+1)%colors.length];renderEditor();saveSoon();}
  function exportDeck() {
    const data=JSON.stringify({format:'forma-presentation',version:1,presentation:deck},null,2);
    const blob=new Blob([data],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(deck.title||'presentation').replace(/[\\/:*?"<>|]/g,'-')+'.forma';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Presentation file downloaded.',true);
  }
  function importDeck(file) {
    if(!file)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);const d=data.presentation||data;if(!Array.isArray(d.slides)||!d.slides.length)throw Error('This file has no slides');d.id=uid();d.title=d.title||file.name.replace(/\.[^.]+$/,'');d.createdAt=today();d.updatedAt=today();d.slides.forEach(s=>{s.id=uid();s.objects?.forEach(o=>o.id=uid());});docs.unshift(d);openDocument(d.id);toast('Presentation opened.',true);}catch{toast('That file is not a Forma presentation.',true);}};r.readAsText(file);
  }
  function fitZoom(){const range=$('#zoomRange');range.value=100;setZoom(100);}
  function setZoom(value){value=Math.max(55,Math.min(110,Number(value)));$('#zoomRange').value=value;$('#zoomLabel').textContent=`${value}%`;$('#statusZoom').textContent=`${value}%`;$('#zoomProgress').style.width=`${((value-55)/55)*100}%`;const canvas=$('#slideCanvas');canvas.style.width=`min(${value}%, 900px)`;fillCanvas(canvas,deck.slides[selectedSlide]);}
  function startPresentation(){presenterIndex=selectedSlide;$('#presenter').hidden=false;document.body.style.overflow='hidden';renderPresenter();}
  function renderPresenter(){const container=$('#presenterSlide');fillCanvas(container,deck.slides[presenterIndex],{preview:true});$('#presenterCounter').textContent=`${presenterIndex+1} / ${deck.slides.length}`;$('#prevPresent').disabled=presenterIndex===0;$('#nextPresent').disabled=presenterIndex===deck.slides.length-1;}
  function stopPresentation(){ $('#presenter').hidden=true;document.body.style.overflow=''; }
  function modal(title,copy,primary='Sounds good',secondary='Maybe later',callback=null){$('#modalTitle').textContent=title;$('#modalCopy').textContent=copy;$('#modalPrimary').textContent=primary;$('#modalSecondary').textContent=secondary;$('#modalBackdrop').hidden=false;$('#modalPrimary').onclick=()=>{$('#modalBackdrop').hidden=true;callback?.();};$('#modalSecondary').onclick=()=>$('#modalBackdrop').hidden=true;}

  // Launcher interactions
  $('#launcher').addEventListener('click',e=>{
    const tab=e.target.closest('[data-launch-tab]');if(tab){activeLaunchTab=tab.dataset.launchTab;renderLauncher();return;}
    const recent=e.target.closest('.recent-row');if(recent){openDocument(recent.dataset.docId);return;}
    const card=e.target.closest('.app-card');if(card){if(card.hasAttribute('data-open-slides'))createPresentation();else modal(`${card.dataset.coming} is on its way`,`We’re building ${card.dataset.coming} as part of the Forma family. It will have its own app and installer.`,'Lovely','Close');return;}
    if(e.target.closest('[data-open-slides]')){const d=activeDoc();if(d)openDocument(d.id);else createPresentation();return;}
    if(e.target.closest('[data-coming]')){const name=e.target.closest('[data-coming]').dataset.coming;modal(`${name} is on its way`,`We’re building ${name} as part of the Forma family. It will have its own app and installer.`,'Lovely','Close');return;}
    if(e.target.closest('#installApps')||e.target.closest('#seeAllApps')){modal('More good things are coming.','Writer, Sheets, and PDF Studio are planned as separate apps you can install only if you need them.','Got it','Close');return;}
    if(e.target.closest('#viewAllRecent')){activeLaunchTab='files';renderLauncher();return;}
    if(e.target.closest('#emptyState [data-open-slides]'))createPresentation();
  });
  $('#recentList').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.recent-row')){e.preventDefault();openDocument(e.target.dataset.docId);}});
  $('#globalSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();$$('.recent-row').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q));});
  $('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const first=$('.recent-row:not([hidden])');if(first)openDocument(first.dataset.docId);else if(e.target.value.toLowerCase().includes('slide'))createPresentation();}});
  $('#backToLauncher').addEventListener('click',showLauncher);
  $('#deckTitle').addEventListener('change',e=>{deck.title=e.target.value.trim()||'Untitled presentation';$('#canvasDeckTitle').textContent=deck.title;saveSoon();});
  $('#deckTitle').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur();});
  $('#saveBtn').addEventListener('click',()=>{saveNow();toast('All changes saved to this device.',true);});
  $('#undoBtn').addEventListener('click',undo);$('#redoBtn').addEventListener('click',redo);
  $('#presentBtn').addEventListener('click',startPresentation);$('#exitPresent').addEventListener('click',stopPresentation);
  $('#prevPresent').addEventListener('click',()=>{presenterIndex=Math.max(0,presenterIndex-1);renderPresenter();});$('#nextPresent').addEventListener('click',()=>{presenterIndex=Math.min(deck.slides.length-1,presenterIndex+1);renderPresenter();});
  $('#ribbon').addEventListener('click',e=>{const theme=e.target.closest('[data-theme-choice]');if(theme){setSlideTheme(theme.dataset.themeChoice);return;}const btn=e.target.closest('[data-action]');if(btn)doAction(btn.dataset.action);});
  $$('.ribbon-tab').forEach(tab=>tab.addEventListener('click',()=>{$$('.ribbon-tab').forEach(t=>t.classList.toggle('selected',t===tab));renderRibbon(tab.dataset.tab);}));
  $('#thumbnailList').addEventListener('click',e=>{const item=e.target.closest('[data-slide]');if(!item)return;selectedSlide=Number(item.dataset.slide);selectedObject=null;renderEditor();});
  $('#addSlideTop').addEventListener('click',addSlide);$('#addSlideBottom').addEventListener('click',addSlide);
  $('#slideMenuBtn').addEventListener('click',()=>modal('Slide options','Duplicate or remove the current slide from the Home ribbon.','Okay','Close'));
  $('#slideCanvas').addEventListener('click',e=>{const el=e.target.closest('[data-object-id]');if(el){selectedObject=el.dataset.objectId;$$('.slide-object',$('#slideCanvas')).forEach(node=>node.classList.toggle('selected-object',node===el));renderInspector();}else{selectedObject=null;$$('.slide-object',$('#slideCanvas')).forEach(node=>node.classList.remove('selected-object'));renderInspector();}});
  $('#slideCanvas').addEventListener('focusin',e=>{if(e.target.matches('.slide-text[contenteditable="true"]'))textEditSnapshot=snapshot();});
  $('#slideCanvas').addEventListener('focusout',e=>{if(e.target.matches('.slide-text[contenteditable="true"]'))textEditSnapshot=null;});
  $('#slideCanvas').addEventListener('input',e=>{const el=e.target.closest('.slide-text');if(!el)return;const obj=deck.slides[selectedSlide].objects.find(o=>o.id===el.dataset.objectId);if(obj){if(textEditSnapshot){history.push(textEditSnapshot);if(history.length>35)history.shift();future=[];textEditSnapshot=null;updateUndoButtons();}obj.text=el.innerText.replace(/\n+$/,'');saveSoon();}});
  $('#speakerNotes').addEventListener('input',e=>{deck.slides[selectedSlide].notes=e.target.value;saveSoon();});
  $('#notesToggle').addEventListener('click',()=>$('.notes-panel').classList.toggle('collapsed'));$('#notesStatus').addEventListener('click',()=>{$('.notes-panel').classList.remove('collapsed');$('#speakerNotes').focus();});
  $('#zoomRange').addEventListener('input',e=>setZoom(e.target.value));$('#zoomOut').addEventListener('click',()=>setZoom(Number($('#zoomRange').value)-10));$('#zoomIn').addEventListener('click',()=>setZoom(Number($('#zoomRange').value)+10));$('#fitBtn').addEventListener('click',fitZoom);$('#fitStatus').addEventListener('click',fitZoom);$('#gridBtn').addEventListener('click',()=>$('#slideCanvas').classList.toggle('guides'));
  $('#imageUpload').addEventListener('change',e=>{addImage(e.target.files?.[0]);e.target.value='';});$('#importInput').addEventListener('change',e=>{importDeck(e.target.files?.[0]);e.target.value='';});
  $('#inspectorContent').addEventListener('click',e=>{
    const theme=e.target.closest('[data-theme-choice]');if(theme){setSlideTheme(theme.dataset.themeChoice);return;}
    const textColor=e.target.closest('[data-text-color]');if(textColor){const obj=deck.slides[selectedSlide].objects.find(o=>o.id===selectedObject);if(obj){pushHistory();obj.color=textColor.dataset.textColor;fillCanvas($('#slideCanvas'),deck.slides[selectedSlide]);renderInspector();saveSoon();}return;}
    const shapeColor=e.target.closest('[data-shape-color]');if(shapeColor){const obj=deck.slides[selectedSlide].objects.find(o=>o.id===selectedObject);if(obj){pushHistory();obj.fill=shapeColor.dataset.shapeColor;fillCanvas($('#slideCanvas'),deck.slides[selectedSlide]);renderInspector();saveSoon();}}
  });
  $('#inspectorContent').addEventListener('change',e=>{
    const obj=deck.slides[selectedSlide].objects.find(o=>o.id===selectedObject);
    if(e.target.id==='fontSizeInput'&&obj){pushHistory();obj.fontSize=Math.max(8,Math.min(96,Number(e.target.value)||18));renderEditor();saveSoon();}
    else if(e.target.id==='fontWeight'&&obj){pushHistory();obj.weight=Number(e.target.value);renderEditor();saveSoon();}
    else if(e.target.id==='fontFamily'&&obj){pushHistory();obj.fontFamily=e.target.value;renderEditor();saveSoon();}
    else if(e.target.id==='layoutSelect'){pushHistory();deck.slides[selectedSlide].layout=e.target.value;saveSoon();}
    else if(e.target.id==='imageAlt'&&obj){obj.alt=e.target.value;saveSoon();}
    else if(e.target.classList.contains('position-input')&&obj){pushHistory();const key=e.target.dataset.prop;obj[key]=Math.max(0,Math.min(100,Number(e.target.value)||0));renderEditor();saveSoon();}
  });
  $('#inspectorContent').addEventListener('input',e=>{if(e.target.id==='fontSizeInput')return;});
  $('#modalClose').addEventListener('click',()=>$('#modalBackdrop').hidden=true);$('#modalBackdrop').addEventListener('click',e=>{if(e.target===$('#modalBackdrop'))$('#modalBackdrop').hidden=true;});
  $('#shareBtn').addEventListener('click',()=>modal('Sharing is coming soon.','Your presentation is saved locally on this device. You can download a .forma file to share it.','Download file','Close',exportDeck));
  $('#spellCheck').addEventListener('click',()=>toast('Spell-check is available in your browser.',true));
  document.addEventListener('keydown',e=>{
    const mac=e.metaKey,ctrl=e.ctrlKey,mod=mac||ctrl;
    if($('#presenter').hidden===false){if(e.key==='Escape'){stopPresentation();return;}if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();$('#nextPresent').click();}if(e.key==='ArrowLeft'){e.preventDefault();$('#prevPresent').click();}return;}
    if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();if(deck){saveNow();toast('All changes saved to this device.',true);}return;}
    if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
    if(mod&&e.key==='Enter'&&!$('#slidesApp').hidden){e.preventDefault();addSlide();return;}
    if(e.key==='Escape'&&$('#modalBackdrop').hidden===false){$('#modalBackdrop').hidden=true;return;}
    if((e.key==='Delete'||e.key==='Backspace')&&deck&&selectedObject&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.activeElement.isContentEditable){e.preventDefault();doAction('delete-object');}
  });
  window.addEventListener('resize',()=>{if(deck&&!$('#slidesApp').hidden)fillCanvas($('#slideCanvas'),deck.slides[selectedSlide]);if(!$('#presenter').hidden&&deck)renderPresenter();});
  $('#ribbon').addEventListener('change',e=>{if(e.target.id==='ribbonFont'||e.target.id==='ribbonSize'){const obj=deck.slides[selectedSlide].objects.find(o=>o.id===selectedObject);if(!obj||obj.type!=='text'){toast('Select a text box first.',true);return;}pushHistory();if(e.target.id==='ribbonFont')obj.fontFamily=e.target.value;else obj.fontSize=Number(e.target.value);renderEditor();saveSoon();}if(e.target.id==='ribbonTransition'){deck.slides[selectedSlide].transition=e.target.value;saveSoon();toast(`${e.target.value} transition selected.`,true);}});

  $('#checkUpdates').addEventListener('click',async()=>{
    if(!window.formaDesktop){modal('Desktop updates','Automatic updates are checked by the installed Forma app. This browser preview does not install desktop releases.','Got it','Close');return;}
    const result=await window.formaDesktop.checkForUpdates();toast(result.message,false);
  });
  if(window.formaDesktop){
    window.formaDesktop.getVersion().then(version=>{document.title=`Forma ${version} — your creative workspace`;}).catch(()=>{});
    window.formaDesktop.onUpdateStatus(status=>toast(status.message,false));
  }
  renderRibbon();
  loadDocs().then(renderLauncher).catch(error=>{console.error('Forma startup failed:',error);renderLauncher();});
})();
