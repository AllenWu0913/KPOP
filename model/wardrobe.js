const wardrobes = {
  hair: { label: '髮型', icon: '💇', options: [
    { id:'twintail',name:'星光雙馬尾',emoji:'🎀',color:'#3d2845',accent:'#ee73b2' }, { id:'bob',name:'俏皮短鮑伯',emoji:'💜',color:'#49334f',accent:'#ca81d7' },
    { id:'ponytail',name:'高馬尾舞者',emoji:'✨',color:'#29253d',accent:'#65d8dc' }, { id:'bun',name:'雙丸子頭',emoji:'🌸',color:'#583747',accent:'#f3a0bd' },
    { id:'waves',name:'夢幻長捲髮',emoji:'🪄',color:'#342844',accent:'#9271d2' }, { id:'silver',name:'銀紫層次短髮',emoji:'🌙',color:'#897b9e',accent:'#d9b4ef' },
  ]},
  top: { label: '上衣', icon: '👚', options: [
    {id:'jacket',name:'莓果舞台外套',emoji:'🧥',color:'#d84f9a',accent:'#ffe17c'}, {id:'sailor',name:'星星水手服',emoji:'⭐',color:'#6178cf',accent:'#fff2d0'},
    {id:'hoodie',name:'酷酷短版帽T',emoji:'💫',color:'#8958bf',accent:'#75e3e0'}, {id:'blouse',name:'蝴蝶結打歌衫',emoji:'🎤',color:'#f28bb9',accent:'#fff5dd'},
    {id:'sparkle',name:'銀河亮片上衣',emoji:'🌌',color:'#354e8d',accent:'#78e2e9'}, {id:'vest',name:'薄荷星光背心',emoji:'🍃',color:'#4bb9a0',accent:'#f5d97c'},
  ]},
  bottom: { label: '下身', icon: '👗', options: [
    {id:'pleated',name:'星星百褶裙',emoji:'🌟',color:'#8e5bb7',accent:'#f7c3df'}, {id:'shorts',name:'亮片舞台短褲',emoji:'🩳',color:'#426cbd',accent:'#72e2e3'},
    {id:'layered',name:'莓果蛋糕裙',emoji:'🍰',color:'#ed78ae',accent:'#ffe5a1'}, {id:'pants',name:'閃電長褲',emoji:'⚡',color:'#354b7c',accent:'#f7d569'},
    {id:'tutu',name:'月光蓬蓬裙',emoji:'🌙',color:'#aaa2e7',accent:'#f8d9ef'}, {id:'shortskirt',name:'薄荷不規則裙',emoji:'🪷',color:'#52ae9a',accent:'#d2fff0'},
  ]},
  socks: { label: '襪子', icon: '🧦', options: [
    {id:'kneehigh',name:'星星過膝襪',emoji:'⭐',color:'#f8efff',accent:'#f078b7'}, {id:'stripes',name:'粉紫條紋襪',emoji:'🩷',color:'#f2a0c7',accent:'#865dc0'},
    {id:'legwarmers',name:'蓬鬆腿套',emoji:'☁️',color:'#e8dcff',accent:'#83dfe2'}, {id:'ankle',name:'荷葉短襪',emoji:'🌼',color:'#fff5de',accent:'#f1a2c5'},
    {id:'sparklesocks',name:'夜空亮片襪',emoji:'✨',color:'#40456e',accent:'#f5d877'}, {id:'none',name:'不穿襪子',emoji:'🦵',color:'#eeb28e',accent:'#eeb28e'},
  ]},
  shoes: { label: '鞋子', icon: '👟', options: [
    {id:'boots',name:'粉紅舞台長靴',emoji:'👢',color:'#dc5f9d',accent:'#ffe083'}, {id:'sneakers',name:'閃電厚底球鞋',emoji:'👟',color:'#536dcc',accent:'#80ebea'},
    {id:'maryjanes',name:'星星瑪莉珍鞋',emoji:'🥿',color:'#743c86',accent:'#f8d376'}, {id:'highboots',name:'午夜酷酷短靴',emoji:'🥾',color:'#303047',accent:'#a48cda'},
    {id:'platform',name:'彩虹厚底鞋',emoji:'🌈',color:'#e884aa',accent:'#ffe182'}, {id:'sneakerpink',name:'薄荷演唱會球鞋',emoji:'💖',color:'#4aafa3',accent:'#fff1c6'},
  ]},
  accessory: { label: '配件', icon: '✨', options: [
    {id:'bow',name:'閃亮雙蝴蝶結',emoji:'🎀',color:'#f073ad',accent:'#ffe18a'}, {id:'crown',name:'小小星星王冠',emoji:'👑',color:'#f0c451',accent:'#fff1a5'},
    {id:'headphones',name:'霓虹耳機',emoji:'🎧',color:'#8c67db',accent:'#67e2df'}, {id:'moonclip',name:'月亮髮夾',emoji:'🌙',color:'#f0d177',accent:'#fff5be'},
    {id:'glasses',name:'星星舞台眼鏡',emoji:'🕶️',color:'#57d8d7',accent:'#f4a5dc'}, {id:'none',name:'不戴配件',emoji:'♡',color:'#a987bf',accent:'#eacbe9'},
  ]},
};

const selected = { hair:'twintail', top:'jacket', bottom:'pleated', socks:'kneehigh', shoes:'boots', accessory:'bow' };
const groups = { hair:'hairBack', top:'top', bottom:'bottom', socks:'socks', shoes:'shoes', accessory:'accessory' };
const tabs = document.querySelector('#tabs'), itemsNode = document.querySelector('#items');
let activeCategory = 'hair';

const optionFor = (category) => wardrobes[category].options.find((option) => option.id === selected[category]);
const detail = (x,y,fill='white',r=3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity=".9"/>`;

function drawHair(id,c,a){
  const cap=`<path d="M108 91Q105 30 160 27Q215 30 212 91L201 115Q195 80 183 68Q161 82 126 73L119 112Z" fill="${c}"/>`;
  const bang=`<path d="M112 76Q123 39 160 42Q195 39 208 77Q186 62 173 63Q151 81 128 68L117 93Z" fill="${c}"/>`;
  const shine=`<path d="M132 47Q151 33 169 39" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round" opacity=".85"/>`;
  const bow=(x,y)=>`<path d="M${x} ${y}q-17-16-17 0t17 0q17-16 17 0t-17 0" fill="${a}"/><circle cx="${x}" cy="${y}" r="4" fill="#ffe7a7"/>`;
  let back='';
  if(id==='twintail')back=`<path d="M121 65Q88 70 97 121Q99 153 83 177Q115 169 126 134L136 83ZM199 65Q232 70 223 121Q221 153 237 177Q205 169 194 134L184 83Z" fill="${c}"/><path d="M91 143q17 10 29 4M229 143q-17 10-29 4" fill="none" stroke="${a}" stroke-width="5"/>${bow(111,94)}${bow(209,94)}`;
  if(id==='bob')back=`<path d="M111 71Q96 128 119 151L132 121L126 86ZM209 71Q224 128 201 151L188 121L194 86Z" fill="${c}"/>`;
  if(id==='ponytail')back=`<path d="M197 52Q244 49 228 88Q218 105 244 131Q206 134 191 99L181 70Z" fill="${c}"/><path d="M207 81q19 2 25-7" fill="none" stroke="${a}" stroke-width="5"/>`;
  if(id==='bun')back=`<circle cx="119" cy="47" r="20" fill="${c}"/><circle cx="201" cy="47" r="20" fill="${c}"/><path d="M108 75Q95 127 121 148L135 99ZM212 75Q225 127 199 148L185 99Z" fill="${c}"/>${detail(119,47,a,4)}${detail(201,47,a,4)}`;
  if(id==='waves')back=`<path d="M112 69Q94 95 112 117Q93 140 116 160Q100 178 121 193Q145 164 134 132L137 77ZM208 69Q226 95 208 117Q227 140 204 160Q220 178 199 193Q175 164 186 132L183 77Z" fill="${c}"/><path d="M117 126q9 8 1 18m84-18q-9 8-1 18" fill="none" stroke="${a}" stroke-width="3" opacity=".75"/>`;
  if(id==='silver')back=`<path d="M112 68Q95 98 113 126L133 108L135 77ZM208 68Q225 98 207 126L187 108L185 77Z" fill="${c}"/>`;
  return {back:`<g>${back}</g>`,front:`<g>${cap}${bang}${shine}</g>`};
}

function drawTop(id,c,a){
  const shirt=`<path d="M132 145Q143 139 151 142L160 153L169 142Q178 139 188 145L205 157L193 180L185 173L190 247Q160 260 130 247L135 173L127 180L115 157Z" fill="${c}" stroke="#ffffff48" stroke-width="2"/>`;
  const sleeves=`<path d="M120 151L105 171L84 230Q87 241 97 238L128 181ZM200 151L215 171L236 230Q233 241 223 238L192 181Z" fill="${c}" stroke="#ffffff45" stroke-width="2"/>`;
  let trim='';
  if(id==='jacket')trim=`<path d="M140 148L153 159L145 202L132 177ZM180 148L167 159L175 202L188 177Z" fill="${a}"/><path d="M151 161L160 153L169 161L165 244H155Z" fill="#482b59"/>${detail(160,177,a,3)}${detail(160,195,a,3)}${detail(160,213,a,3)}`;
  if(id==='sailor')trim=`<path d="M140 147L160 169L180 147L173 188L160 178L147 188Z" fill="${a}"/><path d="M151 160l9 10 9-10" fill="none" stroke="#ffffff" stroke-width="3"/>`;
  if(id==='hoodie')trim=`<path d="M142 145Q160 132 178 145L174 167Q160 178 146 167Z" fill="${a}"/><path d="M153 166v24m14-24v24M143 220h34" stroke="#ffffff9a" stroke-width="3" stroke-linecap="round"/>`;
  if(id==='blouse')trim=`<path d="M151 151L160 161L169 151L166 188L160 194L154 188Z" fill="${a}"/><path d="M150 150q-13-14-18 2 10 2 18 10 10-8 18-10-5-16-18-2Z" fill="#fff2e4"/>`;
  if(id==='sparkle')trim=`<path d="M147 149l13 9 13-9-5 27h-16Z" fill="${a}" opacity=".75"/>${detail(139,200,a,3)}${detail(179,219,a,3)}${detail(148,230,a,2)}${detail(179,186,a,2)}`;
  if(id==='vest')trim=`<path d="M141 145L160 157L179 145L173 188L160 177L147 188Z" fill="${a}"/><path d="M160 157v87" stroke="#ffffffbb" stroke-width="2"/>`;
  const hem=id==='hoodie'?`<path d="M132 236Q160 242 188 236v13q-28 8-56 0Z" fill="${a}"/>`:'';
  return `<g>${sleeves}${shirt}${trim}${hem}</g>`;
}

function drawBottom(id,c,a){
  if(id==='shorts')return `<g><path d="M119 239Q160 247 201 239L196 300L164 302L160 270L155 302L124 300Z" fill="${c}" stroke="#ffffff55" stroke-width="2"/><path d="M121 251h78M160 254v35" stroke="${a}" stroke-width="4"/>${detail(142,269,a,3)}${detail(180,269,a,3)}</g>`;
  if(id==='pants')return `<g><path d="M122 240Q160 248 198 240L194 320L178 408L156 408L160 315L151 408L128 408L124 320Z" fill="${c}" stroke="#ffffff44" stroke-width="2"/><path d="M123 256h74M142 330l-3 54M178 330l-3 54" stroke="${a}" stroke-width="4" stroke-linecap="round"/>${detail(145,275,a,3)}${detail(177,287,a,3)}</g>`;
  const skirtShape=id==='layered'?`<path d="M116 251Q160 260 204 251L229 320Q160 339 91 320Z" fill="${c}"/><path d="M105 292Q160 308 215 292L229 320Q160 339 91 320Z" fill="${a}"/>`:id==='tutu'?`<path d="M116 251Q160 263 204 251L238 308Q160 327 82 308L99 282Z" fill="${c}" opacity=".9"/><path d="M101 275Q160 288 219 275L238 308Q160 327 82 308Z" fill="${a}" opacity=".63"/>`:id==='shortskirt'?`<path d="M117 251Q160 260 204 251L225 307L174 297L160 321L145 296L95 312Z" fill="${c}"/>`: `<path d="M117 251Q160 261 203 251L227 310Q160 330 93 310Z" fill="${c}"/>`;
  const pleats=id==='pleated'||id==='layered'||id==='tutu'?`<path d="M125 266l-9 42m26-38-4 44m22-42v46m22-46 5 42m17-47 10 41" stroke="${a}" stroke-width="3" opacity=".8"/>`:'';
  const belt=`<path d="M119 242Q160 251 201 242L203 260Q160 270 117 260Z" fill="${a}"/>`;
  return `<g>${skirtShape}${pleats}${belt}${detail(160,252,'#fff2a0',4)}</g>`;
}

function drawSocks(id,c,a){
  if(id==='none')return '';
  if(id==='kneehigh')return `<g><path d="M121 324L145 326L143 402Q133 409 121 401ZM176 326L200 324L200 401Q188 409 178 402Z" fill="${c}"/><path d="M122 336h22m34 0h21" stroke="${a}" stroke-width="6"/>${detail(133,367,a,3)}${detail(188,367,a,3)}</g>`;
  if(id==='stripes')return `<g><path d="M122 347h22l-2 56q-10 7-20 0Zm54 0h22l-1 56q-10 7-20 0Z" fill="${c}"/><path d="M123 360h21m33 0h21m-52 13h-22m52 0h22m-52 13h-22m52 0h22" stroke="${a}" stroke-width="5"/></g>`;
  if(id==='legwarmers')return `<g><path d="M118 341Q133 334 148 341L145 400Q132 409 117 400ZM172 341Q187 334 202 341L203 400Q188 409 175 400Z" fill="${c}"/><path d="M120 350h25m31 0h25m-80 9h23m34 0h23" stroke="${a}" stroke-width="4"/>${detail(132,379,a,3)}${detail(188,379,a,3)}</g>`;
  if(id==='ankle')return `<g><path d="M121 379q12 5 24 0l-2 25q-10 7-21 0Zm54 0q12 5 24 0l-1 25q-11 7-21 0Z" fill="${c}"/><path d="M121 382q12 10 24 0m30 0q12 10 24 0" fill="none" stroke="${a}" stroke-width="4"/></g>`;
  return `<g><path d="M122 348h22v54q-11 6-22 0Zm54 0h22v54q-11 6-22 0Z" fill="${c}"/><path d="M125 360l5 5m7 5 5 5m-17 8 5 5m49-28 5 5m7 5 5 5m-17 8 5 5" stroke="${a}" stroke-width="3"/>${detail(133,350,a,3)}${detail(187,350,a,3)}</g>`;
}

function drawShoes(id,c,a){
  const boots=id==='boots'||id==='highboots';
  const h=boots?(id==='boots'?58:40):31;
  const shape=`<path d="M121 404Q133 411 145 404L147 ${431-h/3}Q147 439 135 440L111 440Q107 434 115 428Z" fill="${c}" stroke="#ffffff55" stroke-width="2"/><path d="M175 404Q187 411 199 404L205 428Q213 434 209 440L185 440Q173 439 173 ${431-h/3}Z" fill="${c}" stroke="#ffffff55" stroke-width="2"/>`;
  const cuffs=boots?`<path d="M117 418h30m28 0h30" stroke="${a}" stroke-width="6"/>`:'';
  const straps=id==='maryjanes'?`<path d="M116 432h29m30 0h29" stroke="${a}" stroke-width="4"/>`:'';
  const soles=id==='platform'||id==='sneakers'||id==='sneakerpink'?`<path d="M111 438h37m25 0h38" stroke="${a}" stroke-width="7" stroke-linecap="round"/>`:'';
  return `<g>${shape}${cuffs}${straps}${soles}${detail(131,427,a,3)}${detail(189,427,a,3)}</g>`;
}

function drawAccessory(id,c,a){
  if(id==='none')return '';
  if(id==='bow')return `<g><path d="M123 57Q96 32 103 63Q107 75 126 68Q145 75 149 62Q153 34 128 58Z" fill="${c}" stroke="${a}" stroke-width="2"/><circle cx="127" cy="62" r="5" fill="${a}"/><path d="M197 57Q224 32 217 63Q213 75 194 68Q175 75 171 62Q167 34 192 58Z" fill="${c}" stroke="${a}" stroke-width="2"/><circle cx="193" cy="62" r="5" fill="${a}"/></g>`;
  if(id==='crown')return `<g><path d="M132 49l5-20 22 15 22-15 7 20Z" fill="${c}" stroke="${a}" stroke-width="3"/><path d="M137 49h45" stroke="#fff1ba" stroke-width="4"/>${detail(137,36,a,3)}${detail(159,42,a,3)}${detail(181,36,a,3)}</g>`;
  if(id==='headphones')return `<g><path d="M111 92Q109 34 160 31Q211 34 209 92" fill="none" stroke="${c}" stroke-width="9"/><rect x="105" y="83" width="15" height="28" rx="7" fill="${a}"/><rect x="200" y="83" width="15" height="28" rx="7" fill="${a}"/>${detail(160,31,'#fff',3)}</g>`;
  if(id==='moonclip')return `<g><path d="M190 44a13 13 0 1 0 14 18 15 15 0 1 1-14-18Z" fill="${c}" stroke="${a}" stroke-width="2}"/>${detail(213,62,a,3)}</g>`;
  return `<g><path d="M124 90h18m36 0h18" stroke="${c}" stroke-width="5" stroke-linecap="round"/><circle cx="134" cy="90" r="10" fill="none" stroke="${a}" stroke-width="3"/><circle cx="186" cy="90" r="10" fill="none" stroke="${a}" stroke-width="3"/><path d="M144 90h8m16 0h8" stroke="${a}" stroke-width="3"/>${detail(134,90,c,2)}${detail(186,90,c,2)}</g>`;
}

function renderCharacter(){
  const hair=optionFor('hair'),top=optionFor('top'),bottom=optionFor('bottom'),socks=optionFor('socks'),shoes=optionFor('shoes'),accessory=optionFor('accessory');
  const hairSvg=drawHair(hair.id,hair.color,hair.accent);
  document.querySelector('#hairBack').innerHTML=hairSvg.back;
  document.querySelector('#hairFront').innerHTML=hairSvg.front;
  document.querySelector('#top').innerHTML=drawTop(top.id,top.color,top.accent);
  document.querySelector('#bottom').innerHTML=drawBottom(bottom.id,bottom.color,bottom.accent);
  document.querySelector('#socks').innerHTML=drawSocks(socks.id,socks.color,socks.accent);
  document.querySelector('#shoes').innerHTML=drawShoes(shoes.id,shoes.color,shoes.accent);
  document.querySelector('#accessory').innerHTML=drawAccessory(accessory.id,accessory.color,accessory.accent);
  const styleName=`${hair.name}・${top.name}`;
  document.querySelector('#lookName').textContent=styleName;
  document.querySelector('#doll').setAttribute('aria-label',`目前造型：${hair.name}、${top.name}、${bottom.name}、${socks.name}、${shoes.name}、${accessory.name}`);
  document.querySelector('#savedCaption').textContent=`${hair.name}・${top.name}・${bottom.name}・${socks.name}・${shoes.name}`;
  document.querySelectorAll('.item').forEach((button)=>button.classList.toggle('selected',selected[activeCategory]===button.dataset.id));
  document.querySelectorAll('.tab').forEach((button)=>button.classList.toggle('active',activeCategory===button.dataset.category));
}

function renderTabs(){tabs.innerHTML=Object.entries(wardrobes).map(([key,category])=>`<button class="tab" data-category="${key}" type="button">${category.icon} ${category.label}</button>`).join('');tabs.querySelectorAll('.tab').forEach((button)=>button.addEventListener('click',()=>{activeCategory=button.dataset.category;renderItems();renderCharacter()}));}
function renderItems(){const options=wardrobes[activeCategory].options;document.querySelector('#itemCount').textContent=`${options.length} 款可選`;itemsNode.innerHTML=options.map((item)=>`<button class="item" data-id="${item.id}" type="button" aria-label="選擇${item.name}"><span class="item-emoji">${item.emoji}</span><span class="item-name">${item.name}</span></button>`).join('');itemsNode.querySelectorAll('.item').forEach((button)=>button.addEventListener('click',()=>{selected[activeCategory]=button.dataset.id;renderCharacter()}));}
function showToast(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),2300);}
document.querySelector('#random').addEventListener('click',()=>{for(const [key,category] of Object.entries(wardrobes)){selected[key]=category.options[Math.floor(Math.random()*category.options.length)].id;}renderCharacter();renderItems();showToast('全新舞台造型完成！✨');});
document.querySelector('#save').addEventListener('click',()=>{localStorage.setItem('moonlight-doll-look',JSON.stringify(selected));showToast('這套造型已收藏！♡');});
document.querySelector('#reset').addEventListener('click',()=>{Object.assign(selected,{hair:'twintail',top:'jacket',bottom:'pleated',socks:'kneehigh',shoes:'boots',accessory:'bow'});renderCharacter();renderItems();showToast('回到星光練習生的初始造型');});
try{const saved=JSON.parse(localStorage.getItem('moonlight-doll-look'));if(saved)Object.assign(selected,saved);}catch{}
document.querySelector('#comboCount').textContent=Object.values(wardrobes).reduce((total,category)=>total*category.options.length,1).toLocaleString('zh-TW');
renderTabs();renderItems();renderCharacter();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
