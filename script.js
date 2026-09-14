let canvas = null;
let ctx = null;
let joyX = 0, joyY = 0, isJoyActive = false;

// Координаты и физика
let loc_x = 0;
let loc_y = -100; 
let vel_x = 0;
let vel_y = 0;
let is_grounded = false;
let face_dir = 1; // 1 = смотрит вправо, -1 = смотрит влево

const BLOCK_SIZE = 32; 
const PLAYER_W = 20;   
const PLAYER_H = 30;   

let local_blocks = {};
let current_block = 1; 

// Время (для дня и ночи)
let game_time = 0; 

// Редактор HUD
let is_hud_edit = false;

window.addEventListener('DOMContentLoaded', () => {
    init_map();
    generate_flat_world();
    load_hud_positions();
    requestAnimationFrame(draw_map);
});

function generate_flat_world() {
    for(let i = -60; i <= 60; i++) {
        local_blocks[i + '_0'] = 1; 
        local_blocks[i + '_1'] = 2; 
        local_blocks[i + '_2'] = 2; 
        local_blocks[i + '_3'] = 3; 
    }
    // Построим пару стенок для тестов паркура
    local_blocks['5_-1'] = 2; local_blocks['5_-2'] = 2;
    local_blocks['9_-3'] = 2;
}

window.select_slot = function(id) {
    if(is_hud_edit) return; // В режиме редактирования не выбираем блоки
    current_block = id;
    document.querySelectorAll('.hotbar-slot').forEach(el => el.classList.remove('active'));
    document.querySelector(`.hotbar-slot[data-block="${id}"]`).classList.add('active');
}

function init_map() {
    canvas = document.getElementById('rtp-canvas');
    if (canvas) ctx = canvas.getContext('2d');
    
    // Джойстик
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

    // Прыжок
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

    // Клик по миру
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
    
    if(Math.hypot(worldX - loc_x, worldY - loc_y) > 180) return; // Дистанция строительства
    let key = gridX + '_' + gridY;
    
    if (current_block === 0) {
        delete local_blocks[key];
    } else {
        let pL = Math.floor((loc_x - PLAYER_W/2) / BLOCK_SIZE);
        let pR = Math.floor((loc_x + PLAYER_W/2 - 0.1) / BLOCK_SIZE);
        let pT = Math.floor((loc_y - PLAYER_H) / BLOCK_SIZE);
        let pB = Math.floor((loc_y - 0.1) / BLOCK_SIZE);
        if (gridX >= pL && gridX <= pR && gridY >= pT && gridY <= pB) return; // Внутри себя нельзя
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
            if (local_blocks[bx + '_' + by]) return true; 
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
    
    game_time += 0.002; // Скорость течения времени
    let time_cycle = Math.sin(game_time); // от -1 до 1
    let is_day = time_cycle > 0;
    
    // --- Движение ---
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

    // Обновляем текст
    document.getElementById('map-x').innerText = Math.floor(loc_x / BLOCK_SIZE);
    document.getElementById('map-y').innerText = -Math.floor(loc_y / BLOCK_SIZE);
    document.getElementById('time-display').innerText = is_day ? "☀️ День" : "🌙 Ночь";

    // --- РЕНДЕР НЕБА И СВЕТИЛ ---
    // Плавно меняем цвет неба: от голубого (день) к темно-синему (ночь)
    let skyR = Math.floor(10 + ((time_cycle + 1)/2) * (135 - 10));
    let skyG = Math.floor(10 + ((time_cycle + 1)/2) * (206 - 10));
    let skyB = Math.floor(42 + ((time_cycle + 1)/2) * (235 - 42));
    ctx.fillStyle = `rgb(${skyR},${skyG},${skyB})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
    
    let cx = canvas.width / 2; let cy = canvas.height / 2;

    // Солнце и луна (двигаются по дуге)
    let sunX = cx - Math.cos(game_time) * (canvas.width/1.5);
    let sunY = cy + Math.sin(game_time) * (canvas.height) + 100; // Y инвертирован, чтобы всходило сверху
    
    let moonX = cx + Math.cos(game_time) * (canvas.width/1.5);
    let moonY = cy - Math.sin(game_time) * (canvas.height) + 100;

    // Солнце
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(sunX, sunY, 25, 0, Math.PI*2); ctx.fill();
    // Луна
    ctx.fillStyle = '#DDDDDD';
    ctx.beginPath(); ctx.arc(moonX, moonY, 20, 0, Math.PI*2); ctx.fill();

    // --- РЕНДЕР БЛОКОВ ---
    // Ночью блоки чуть темнее
    let blockDarken = is_day ? 0 : 40;

    for (let key in local_blocks) {
        let coords = key.split('_');
        let screenX = cx + (parseInt(coords[0]) * BLOCK_SIZE - loc_x);
        let screenY = cy + (parseInt(coords[1]) * BLOCK_SIZE - loc_y + (PLAYER_H/2));

        if (screenX > -BLOCK_SIZE && screenX < canvas.width && screenY > -BLOCK_SIZE && screenY < canvas.height) {
            let type = local_blocks[key];
            
            if (type === 1) ctx.fillStyle = `rgb(${101-blockDarken}, ${67-blockDarken}, ${33-blockDarken})`; // Земля
            if (type === 2) ctx.fillStyle = `rgb(${128-blockDarken}, ${128-blockDarken}, ${128-blockDarken})`; // Камень
            if (type === 3) ctx.fillStyle = '#1e0036'; // Обсидиан (всегда темный)
            
            ctx.fillRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);
            if (type === 1) { // Трава
                ctx.fillStyle = `rgb(${34-blockDarken/2}, ${139-blockDarken/2}, ${34-blockDarken/2})`;
                ctx.fillRect(screenX, screenY, BLOCK_SIZE, 6);
            }
            ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
            ctx.strokeRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);
        }
    }

    // --- РЕНДЕР ИГРОКА (С АНИМАЦИЯМИ) ---
    // Вычисляем фазу анимации при ходьбе (от -1 до 1)
    let walk_anim = Math.sin(Date.now() / 100) * (Math.abs(vel_x) > 0.5 ? 1 : 0);
    
    // Задняя рука (Алмазный цвет)
    ctx.fillStyle = '#29d'; 
    ctx.fillRect(cx - 2 + (face_dir * 10) - (walk_anim * 6 * face_dir), cy - 4, 6, 14);

    // Задняя нога (Синие штаны)
    ctx.fillStyle = '#114'; 
    ctx.fillRect(cx - 3 + (face_dir * 4) + (walk_anim * 8 * face_dir), cy + 12, 6, 10);

    // Тело (Нагрудник)
    ctx.fillStyle = '#2bf'; 
    ctx.fillRect(cx - 9, cy - 4, 18, 16);
    
    // Передняя нога
    ctx.fillStyle = '#115'; 
    ctx.fillRect(cx - 3 - (face_dir * 4) - (walk_anim * 8 * face_dir), cy + 12, 6, 10);

    // Голова (Лицо)
    ctx.fillStyle = '#f5c6a5'; 
    ctx.fillRect(cx - 8, cy - 20, 16, 16);
    
    // Глаза (смотрят в face_dir)
    let eyeOffsetX = face_dir === 1 ? 2 : -4;
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 2 + eyeOffsetX, cy - 16, 4, 4); // левый глаз
    ctx.fillRect(cx + 4 + eyeOffsetX, cy - 16, 4, 4); // правый глаз
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 1 + eyeOffsetX + (face_dir===1?1:0), cy - 15, 2, 2); 
    ctx.fillRect(cx + 5 + eyeOffsetX + (face_dir===1?1:0), cy - 15, 2, 2);

    // Передняя рука
    ctx.fillStyle = '#2bf'; 
    ctx.fillRect(cx - 4 - (face_dir * 8) + (walk_anim * 6 * face_dir), cy - 4, 6, 14);

    requestAnimationFrame(draw_map);
}

// ==========================================
// ЛОГИКА КАСТОМИЗАЦИИ HUD (DRAG AND DROP)
// ==========================================
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
            
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            startX = clientX; startY = clientY;
            initialX = activeDrag.offsetLeft;
            initialY = activeDrag.offsetTop;
            
            // Сбрасываем привязки bottom/right/transform, чтобы drag работал чисто по left/top
            activeDrag.style.bottom = 'auto';
            activeDrag.style.right = 'auto';
            activeDrag.style.transform = 'none';
            activeDrag.style.left = initialX + 'px';
            activeDrag.style.top = initialY + 'px';
        };
        el.addEventListener('touchstart', handleStart, {passive: false});
        el.addEventListener('mousedown', handleStart);
    });

    let handleMove = (e) => {
        if(!activeDrag || !is_hud_edit) return;
        e.preventDefault();
        let clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        let dx = clientX - startX;
        let dy = clientY - startY;
        
        activeDrag.style.left = (initialX + dx) + 'px';
        activeDrag.style.top = (initialY + dy) + 'px';
    };

    let handleEnd = (e) => {
        if(!activeDrag || !is_hud_edit) return;
        // Сохраняем позицию в память телефона
        localStorage.setItem('v4_hud_' + activeDrag.id, JSON.stringify({
            left: activeDrag.style.left,
            top: activeDrag.style.top
        }));
        activeDrag = null;
    };

    document.addEventListener('touchmove', handleMove, {passive: false});
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
}

function load_hud_positions() {
    document.querySelectorAll('.draggable-hud').forEach(el => {
        let saved = localStorage.getItem('v4_hud_' + el.id);
        if(saved) {
            let pos = JSON.parse(saved);
            el.style.bottom = 'auto';
            el.style.right = 'auto';
            el.style.transform = 'none';
            el.style.left = pos.left;
            el.style.top = pos.top;
        }
    });
}
