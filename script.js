let canvas = null;
let ctx = null;
let joyX = 0, joyY = 0, isJoyActive = false;

// Координаты и физика
let loc_x = 0;
let loc_y = -800; // Спавнимся в небе над ландшафтом
let vel_x = 0;
let vel_y = 0;
let is_grounded = false;
let face_dir = 1; 

const BLOCK_SIZE = 32; 
const PLAYER_W = 20;   
const PLAYER_H = 30;   

let local_blocks = {};
let game_time = 0; 
let is_hud_edit = false;

// ИНВЕНТАРЬ И ХОТБАР
let active_slot = 0; 
let hotbar_items = [0, 1, 2, 8, 3]; 

// БАЗА ДАННЫХ ВСЕХ 40 БЛОКОВ
const BLOCK_DB = {
    0: { name: "Кирка", icon: "⛏️", color: "transparent" },
    1: { name: "Земля", icon: "🟫", color: "#654321" },
    2: { name: "Камень", icon: "🪨", color: "#808080" },
    3: { name: "Обсидиан", icon: "⬛", color: "#1e0036" },
    4: { name: "Лазурит", icon: "🔷", color: "#808080", ore: "#1E90FF" },
    5: { name: "Алмаз", icon: "💎", color: "#808080", ore: "#00FFFF" },
    6: { name: "Изумруд", icon: "🟩", color: "#808080", ore: "#32CD32" },
    7: { name: "Железо", icon: "🪙", color: "#808080", ore: "#FFDAB9" },
    8: { name: "Дерево", icon: "🪵", color: "#5c3a21" },
    9: { name: "Доски", icon: "🟫", color: "#b58253" },
    10: { name: "Стекло", icon: "🧊", color: "rgba(200,255,255,0.4)" },
    11: { name: "Песок", icon: "🟨", color: "#edd27e" },
    12: { name: "Кирпич", icon: "🧱", color: "#a13c32" },
    13: { name: "Золото", icon: "🟡", color: "#808080", ore: "#FFD700" },
    14: { name: "Уголь", icon: "🖤", color: "#808080", ore: "#222" },
    15: { name: "Редст. Руда", icon: "🔴", color: "#808080", ore: "#FF0000" },
    16: { name: "ТНТ", icon: "🧨", color: "#d13838" },
    17: { name: "Верстак", icon: "🛠️", color: "#8c603a" },
    18: { name: "Печь", icon: "🪨", color: "#555555" },
    19: { name: "Сундук", icon: "📦", color: "#a87132" },
    20: { name: "Чары", icon: "🔮", color: "#222" },
    21: { name: "Воронка", icon: "🔽", color: "#555" },
    22: { name: "Варочная", icon: "🧪", color: "#999" },
    23: { name: "Редстоун", icon: "🩸", color: "rgba(255,0,0,0.5)" }, 
    24: { name: "Факел", icon: "🏮", color: "#fff" },
    25: { name: "Повторитель", icon: "🎚️", color: "#ddd" },
    26: { name: "Компаратор", icon: "⚖️", color: "#ddd" },
    27: { name: "Поршень", icon: "⚙️", color: "#9e8666" },
    28: { name: "Липкий пор.", icon: "🍯", color: "#77a641" },
    29: { name: "Слизь", icon: "🟩", color: "rgba(100,255,100,0.6)" },
    30: { name: "Мёд", icon: "🟧", color: "rgba(255,170,0,0.6)" },
    31: { name: "Плита", icon: "➖", color: "#777" },
    32: { name: "Рычаг", icon: "🕹️", color: "transparent" },
    33: { name: "Кнопка", icon: "🔘", color: "#888" },
    34: { name: "Раздатчик", icon: "🏹", color: "#666" },
    35: { name: "Наблюдатель", icon: "👁️", color: "#555" },
    36: { name: "Лампа", icon: "💡", color: "#804000" },
    37: { name: "Решетка", icon: "⛓️", color: "transparent" },
    38: { name: "Люк", icon: "🚪", color: "transparent" },
    39: { name: "Бедрок", icon: "🌑", color: "#111" },
    
    // Скрытые технические блоки (состояния)
    321: { name: "Рычаг ВКЛ", icon: "", color: "transparent" },
    381: { name: "Люк ОТКРЫТ", icon: "", color: "transparent" }
};

window.addEventListener('DOMContentLoaded', () => {
    init_map();
    generate_landscape();
    load_hud_positions();
    update_hotbar_ui();
    requestAnimationFrame(draw_map);
});

function generate_landscape() {
    for(let x = -200; x <= 200; x++) {
        let surfaceY = Math.floor(Math.sin(x * 0.1) * 4 + Math.cos(x * 0.05) * 6);
        for(let y = surfaceY; y <= surfaceY + 2; y++) local_blocks[x + '_' + y] = 1; 
        
        for(let y = surfaceY + 3; y <= surfaceY + 60; y++) {
            let caveNoise = Math.sin(x * 0.2) * Math.cos(y * 0.2) + Math.sin(x * 0.1);
            if (caveNoise > 0.65) continue; 

            let block = 2; 
            let r = Math.random();
            if (y > surfaceY + 40) { 
                if (r < 0.015) block = 5; else if (r < 0.02) block = 6; else if (r < 0.04) block = 4; else if (r < 0.05) block = 15; else if (r < 0.08) block = 13;
            } else if (y > surfaceY + 15) { 
                if (r < 0.04) block = 7; else if (r < 0.02) block = 13; else if (r < 0.05) block = 14;
            } else { 
                if (r < 0.06) block = 14;
            }
            local_blocks[x + '_' + y] = block;
        }
        local_blocks[x + '_' + (surfaceY + 61)] = 39; 
    }
}

window.select_slot = function(index) {
    if(is_hud_edit) return; 
    active_slot = index;
    update_hotbar_ui();
}

function update_hotbar_ui() {
    for(let i=0; i<5; i++) {
        let slot = document.getElementById('hb-'+i);
        let icon = document.getElementById('hi-'+i);
        let label = document.getElementById('hl-'+i);
        
        if (i === active_slot) slot.classList.add('active');
        else slot.classList.remove('active');
        
        let blockId = hotbar_items[i];
        icon.innerText = BLOCK_DB[blockId].icon;
        label.innerText = BLOCK_DB[blockId].name;
    }
}

window.open_block_inventory = function() {
    if(is_hud_edit) return;
    let grid = document.getElementById('sandbox-inv-grid');
    let html = '';
    for(let key in BLOCK_DB) {
        if(key >= 300) continue; // Пропускаем технические блоки из инвентаря
        let b = BLOCK_DB[key];
        html += `<div class="inv-item-2d" onclick="set_hotbar_item(${key})">
                    ${b.icon}
                    <div class="inv-item-name">${b.name}</div>
                 </div>`;
    }
    grid.innerHTML = html;
    document.getElementById('sandbox-inventory-modal').style.display = 'flex';
}

window.set_hotbar_item = function(blockId) {
    hotbar_items[active_slot] = blockId;
    update_hotbar_ui();
    document.getElementById('sandbox-inventory-modal').style.display = 'none';
}

function init_map() {
    canvas = document.getElementById('rtp-canvas');
    if (canvas) ctx = canvas.getContext('2d');
    
    let joyZone = document.getElementById('joystick-zone'); 
    let joyKnob = document.getElementById('joystick-knob'); 
    let jRect = null;
    
    if(joyZone) {
        joyZone.addEventListener('touchstart', e => { if(is_hud_edit) return; e.preventDefault(); isJoyActive = true; jRect = joyZone.getBoundingClientRect(); handleJoy(e.touches[0]); }, {passive:false});
        joyZone.addEventListener('touchmove', e => { if(is_hud_edit) return; e.preventDefault(); if(isJoyActive) handleJoy(e.touches[0]); }, {passive:false});
        joyZone.addEventListener('touchend', e => { if(is_hud_edit) return; e.preventDefault(); isJoyActive = false; joyX = 0; joyY = 0; if(joyKnob) joyKnob.style.transform = `translate(0px, 0px)`; }, {passive:false});
    }
    function handleJoy(t) { 
        let dx = t.clientX - (jRect.left + 50); let dy = t.clientY - (jRect.top + 50); 
        let dist = Math.sqrt(dx*dx + dy*dy); let maxD = 35; 
        if(dist > maxD) { dx = (dx/dist)*maxD; dy = (dy/dist)*maxD; } 
        if(joyKnob) joyKnob.style.transform = `translate(${dx}px, ${dy}px)`; 
        joyX = dx / maxD; 
    }

    let btnJump = document.getElementById('btn-jump');
    if(btnJump) {
        let jumpFn = (e) => {
            if(is_hud_edit) return;
            e.preventDefault();
            if(is_grounded) { vel_y = -8.5; is_grounded = false; }
        };
        btnJump.addEventListener('touchstart', jumpFn, {passive:false});
        btnJump.addEventListener('mousedown', jumpFn);
    }

    if (canvas) {
        canvas.addEventListener('touchstart', e => {
            if(is_hud_edit) return;
            let rect = canvas.getBoundingClientRect();
            process_build_click(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        }, {passive:true});
        canvas.addEventListener('mousedown', e => {
            if(is_hud_edit) return;
            let rect = canvas.getBoundingClientRect();
            process_build_click(e.clientX - rect.left, e.clientY - rect.top);
        });
    }
    setup_hud_drag();
}

function process_build_click(tx, ty) {
    let cx = canvas.width / 2; let cy = canvas.height / 2;
    let worldX = tx - cx + loc_x; let worldY = ty - cy + loc_y - (PLAYER_H / 2);
    let gridX = Math.floor(worldX / BLOCK_SIZE); let gridY = Math.floor(worldY / BLOCK_SIZE);
    
    if(Math.hypot(worldX - loc_x, worldY - loc_y) > 200) return; 
    let key = gridX + '_' + gridY;
    
    let current_block = hotbar_items[active_slot];
    let clicked_block = local_blocks[key];

    // ИНТЕРАКТИВ ИЛИ ЛОМАНИЕ
    if (clicked_block) {
        if (current_block === 0) {
            // Кирка - значит ломаем
            delete local_blocks[key];
            return;
        } else {
            // Если в руках не кирка, пытаемся взаимодействовать
            if (clicked_block === 32) { local_blocks[key] = 321; return; } // Рычаг ВКЛ
            if (clicked_block === 321) { local_blocks[key] = 32; return; } // Рычаг ВЫКЛ
            if (clicked_block === 38) { local_blocks[key] = 381; return; } // Люк ОТКРЫТ
            if (clicked_block === 381) { local_blocks[key] = 38; return; } // Люк ЗАКРЫТ
            if (clicked_block === 19) { alert("📦 Открываем сундук..."); return; }
            if (clicked_block === 17) { alert("🛠️ Открываем верстак..."); return; }
            if (clicked_block === 20) { alert("🔮 Открываем стол зачарований..."); return; }
        }
    }

    // СТРОИТЕЛЬСТВО
    if (current_block !== 0 && !clicked_block) {
        let pL = Math.floor((loc_x - PLAYER_W/2) / BLOCK_SIZE);
        let pR = Math.floor((loc_x + PLAYER_W/2 - 0.1) / BLOCK_SIZE);
        let pT = Math.floor((loc_y - PLAYER_H) / BLOCK_SIZE);
        let pB = Math.floor((loc_y - 0.1) / BLOCK_SIZE);
        
        let isSolid = ![23, 24, 30, 31, 32, 33, 37, 38, 381, 321].includes(current_block);
        if (isSolid && gridX >= pL && gridX <= pR && gridY >= pT && gridY <= pB) return; 
        
        local_blocks[key] = current_block;
    }
}

function check_collision(nx, ny) {
    let left = Math.floor((nx - PLAYER_W/2) / BLOCK_SIZE);
    let right = Math.floor((nx + PLAYER_W/2 - 0.1) / BLOCK_SIZE);
    let top = Math.floor((ny - PLAYER_H) / BLOCK_SIZE);
    let bottom = Math.floor((ny - 0.1) / BLOCK_SIZE);

    for (let bx = left; bx <= right; bx++) {
        for (let by = top; by <= bottom; by++) {
            let bId = local_blocks[bx + '_' + by];
            if (bId) {
                // Блоки, сквозь которые можно пройти
                let passThrough = [23, 24, 30, 31, 32, 321, 33, 37, 381].includes(bId); // 381 = открытый люк!
                if (!passThrough) return true;
            }
        }
    }
    return false; 
}

function draw_map() {
    let wrap = document.getElementById('map-wrapper');
    if (!canvas) return requestAnimationFrame(draw_map);
    if (canvas.width !== wrap.clientWidth || canvas.height !== wrap.clientHeight) {
        canvas.width = wrap.clientWidth; canvas.height = wrap.clientHeight;
    }
    
    game_time += 0.002; 
    let time_cycle = Math.sin(game_time); 
    let is_day = time_cycle > 0;
    
    if (!is_hud_edit) {
        vel_x = joyX * 5; 
        if(vel_x > 0.1) face_dir = 1;
        if(vel_x < -0.1) face_dir = -1;
    } else { vel_x = 0; }

    vel_y += 0.45; if (vel_y > 14) vel_y = 14; 
    
    loc_x += vel_x;
    if (check_collision(loc_x, loc_y)) { loc_x -= vel_x; vel_x = 0; }

    is_grounded = false;
    loc_y += vel_y;
    if (check_collision(loc_x, loc_y)) {
        loc_y -= vel_y; 
        if (vel_y > 0) is_grounded = true; 
        vel_y = 0;
        if (is_grounded) loc_y = Math.floor(loc_y); 
    }

    document.getElementById('map-x').innerText = Math.floor(loc_x / BLOCK_SIZE);
    document.getElementById('map-y').innerText = -Math.floor(loc_y / BLOCK_SIZE);
    document.getElementById('time-display').innerText = is_day ? "☀️ День" : "🌙 Ночь";

    // Небо
    let skyR = Math.floor(10 + ((time_cycle + 1)/2) * (135 - 10));
    let skyG = Math.floor(10 + ((time_cycle + 1)/2) * (206 - 10));
    let skyB = Math.floor(42 + ((time_cycle + 1)/2) * (235 - 42));
    ctx.fillStyle = `rgb(${skyR},${skyG},${skyB})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
    
    let cx = canvas.width / 2; let cy = canvas.height / 2;

    let sunX = cx - Math.cos(game_time) * (canvas.width/1.5);
    let sunY = cy + Math.sin(game_time) * (canvas.height) + 100; 
    let moonX = cx + Math.cos(game_time) * (canvas.width/1.5);
    let moonY = cy - Math.sin(game_time) * (canvas.height) + 100;

    ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(sunX, sunY, 25, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#DDDDDD'; ctx.beginPath(); ctx.arc(moonX, moonY, 20, 0, Math.PI*2); ctx.fill();

    let blockDarken = is_day ? 0 : 40;

    // Отрисовка блоков
    for (let key in local_blocks) {
        let coords = key.split('_');
        let screenX = cx + (parseInt(coords[0]) * BLOCK_SIZE - loc_x);
        let screenY = cy + (parseInt(coords[1]) * BLOCK_SIZE - loc_y + (PLAYER_H/2));

        if (screenX > -BLOCK_SIZE && screenX < canvas.width && screenY > -BLOCK_SIZE && screenY < canvas.height) {
            let bId = local_blocks[key];
            let blockDef = BLOCK_DB[bId];
            
            // Отрисовка кастомных форм блоков
            if (bId === 32 || bId === 321) { // РЫЧАГ
                ctx.fillStyle = '#444'; ctx.fillRect(screenX+8, screenY+24, 16, 8); // База
                ctx.fillStyle = '#8B4513'; // Палка
                if (bId === 32) ctx.fillRect(screenX+14, screenY+10, 4, 14); // Выкл (вверх)
                else ctx.fillRect(screenX+22, screenY+18, 10, 4); // Вкл (вбок)
            }
            else if (bId === 38 || bId === 381) { // ЛЮК
                ctx.fillStyle = '#7a5531';
                if (bId === 38) ctx.fillRect(screenX, screenY+24, BLOCK_SIZE, 8); // Закрыт
                else ctx.fillRect(screenX+24, screenY, 8, BLOCK_SIZE); // Открыт (встал вертикально)
                ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(screenX, screenY+24, BLOCK_SIZE, 8);
            }
            else {
                // Стандартные блоки
                ctx.fillStyle = blockDef.color;
                if (ctx.fillStyle !== 'rgba(0, 0, 0, 0)' && ctx.fillStyle !== 'transparent') {
                    ctx.fillRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);
                }
                
                // Декорации
                if (bId === 1) { // Трава
                    ctx.fillStyle = `rgb(${34-blockDarken/2}, ${139-blockDarken/2}, ${34-blockDarken/2})`;
                    ctx.fillRect(screenX, screenY, BLOCK_SIZE, 6);
                } else if (blockDef.ore) { // Руды
                    ctx.fillStyle = blockDef.ore; 
                    ctx.fillRect(screenX+6, screenY+6, 5, 5); ctx.fillRect(screenX+20, screenY+16, 6, 6); ctx.fillRect(screenX+8, screenY+22, 4, 4);
                } else if (bId === 20) { // Стол зачарований
                    ctx.fillStyle = '#8B0000'; ctx.fillRect(screenX, screenY, BLOCK_SIZE, 8);
                    ctx.fillStyle = '#FFD700'; ctx.fillRect(screenX+12, screenY-6, 8, 6); 
                } else if (bId === 23) { // Редстоун пыль
                    ctx.fillStyle = '#F00'; ctx.fillRect(screenX, screenY+28, BLOCK_SIZE, 4);
                } else if (bId === 37) { // Решетка
                    ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(screenX+16, screenY); ctx.lineTo(screenX+16, screenY+32); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(screenX, screenY+16); ctx.lineTo(screenX+32, screenY+16); ctx.stroke();
                }

                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
                ctx.strokeRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);
            }
        }
    }

    // Игрок
    let walk_anim = Math.sin(Date.now() / 100) * (Math.abs(vel_x) > 0.5 ? 1 : 0);
    ctx.fillStyle = '#29d'; ctx.fillRect(cx - 2 + (face_dir * 10) - (walk_anim * 6 * face_dir), cy - 4, 6, 14);
    ctx.fillStyle = '#114'; ctx.fillRect(cx - 3 + (face_dir * 4) + (walk_anim * 8 * face_dir), cy + 12, 6, 10);
    ctx.fillStyle = '#2bf'; ctx.fillRect(cx - 9, cy - 4, 18, 16);
    ctx.fillStyle = '#115'; ctx.fillRect(cx - 3 - (face_dir * 4) - (walk_anim * 8 * face_dir), cy + 12, 6, 10);
    ctx.fillStyle = '#f5c6a5'; ctx.fillRect(cx - 8, cy - 20, 16, 16);
    
    let eyeOffsetX = face_dir === 1 ? 2 : -4;
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 2 + eyeOffsetX, cy - 16, 4, 4); ctx.fillRect(cx + 4 + eyeOffsetX, cy - 16, 4, 4); 
    ctx.fillStyle = '#000'; ctx.fillRect(cx - 1 + eyeOffsetX + (face_dir===1?1:0), cy - 15, 2, 2); ctx.fillRect(cx + 5 + eyeOffsetX + (face_dir===1?1:0), cy - 15, 2, 2);
    ctx.fillStyle = '#2bf'; ctx.fillRect(cx - 4 - (face_dir * 8) + (walk_anim * 6 * face_dir), cy - 4, 6, 14);

    requestAnimationFrame(draw_map);
}

// Редактор HUD (Drag & Drop)
window.toggle_hud_edit = function() {
    is_hud_edit = !is_hud_edit;
    let btn = document.getElementById('btn-edit-hud');
    let wrap = document.getElementById('map-wrapper');
    if (is_hud_edit) {
        btn.innerText = "💾 СОХРАНИТЬ HUD";
        btn.style.background = "#0f0"; btn.style.color = "#000";
        wrap.classList.add('hud-edit-mode');
    } else {
        btn.innerText = "РЕДАКТИРОВАТЬ HUD";
        btn.style.background = ""; btn.style.color = "";
        wrap.classList.remove('hud-edit-mode');
    }
}

function setup_hud_drag() {
    let activeDrag = null;
    let startX, startY, initialX, initialY;

    document.querySelectorAll('.draggable-hud').forEach(el => {
        let handleStart = (e) => {
            if(!is_hud_edit) return;
            e.preventDefault(); e.stopPropagation();
            activeDrag = el;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX; let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX; startY = clientY; initialX = activeDrag.offsetLeft; initialY = activeDrag.offsetTop;
            activeDrag.style.bottom = 'auto'; activeDrag.style.right = 'auto'; activeDrag.style.transform = 'none';
            activeDrag.style.left = initialX + 'px'; activeDrag.style.top = initialY + 'px';
        };
        el.addEventListener('touchstart', handleStart, {passive: false}); el.addEventListener('mousedown', handleStart);
    });

    let handleMove = (e) => {
        if(!activeDrag || !is_hud_edit) return;
        e.preventDefault();
        let clientX = e.touches ? e.touches[0].clientX : e.clientX; let clientY = e.touches ? e.touches[0].clientY : e.clientY;
        activeDrag.style.left = (initialX + (clientX - startX)) + 'px'; activeDrag.style.top = (initialY + (clientY - startY)) + 'px';
    };

    let handleEnd = (e) => {
        if(!activeDrag || !is_hud_edit) return;
        localStorage.setItem('v4_hud_' + activeDrag.id, JSON.stringify({ left: activeDrag.style.left, top: activeDrag.style.top }));
        activeDrag = null;
    };

    document.addEventListener('touchmove', handleMove, {passive: false}); document.addEventListener('touchend', handleEnd);
    document.addEventListener('mousemove', handleMove); document.addEventListener('mouseup', handleEnd);
}

function load_hud_positions() {
    document.querySelectorAll('.draggable-hud').forEach(el => {
        let saved = localStorage.getItem('v4_hud_' + el.id);
        if(saved) {
            let pos = JSON.parse(saved);
            el.style.bottom = 'auto'; el.style.right = 'auto'; el.style.transform = 'none';
            el.style.left = pos.left; el.style.top = pos.top;
        }
    });
}
