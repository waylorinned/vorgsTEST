// Отключаем Firebase для песочницы, чтобы не портить боевую базу
let nickname = "Tester";
let vrgk = 1000000;
let skrepki = 0;
let cur_energy = 1000, max_energy = 1000;

// ФИЗИКА И ДВИЖОК 2D
let canvas = null;
let ctx = null;
let joyX = 0, joyY = 0, isJoyActive = false;

// Координаты персонажа (теперь X и Y, а не Z)
let loc_x = 0;
let loc_y = -50; // Начинаем чуть выше земли, чтобы упасть
let vel_x = 0;
let vel_y = 0;
let is_grounded = false;

const BLOCK_SIZE = 32; // Размер одного кубика (блока) в пикселях
const PLAYER_W = 20;   // Ширина хитбокса игрока
const PLAYER_H = 30;   // Высота хитбокса игрока

// Хранилище поставленных блоков (в памяти)
// Формат: "x_y": type (1-земля, 2-камень, 3-обсидиан)
let local_blocks = {};
let current_block = 1; // Текущий блок в руке (по умолчанию Земля)

window.addEventListener('DOMContentLoaded', () => {
    init_map();
    generate_flat_world();
    requestAnimationFrame(draw_map);
});

// Генерируем плоский пол при запуске
function generate_flat_world() {
    for(let i = -50; i <= 50; i++) {
        local_blocks[i + '_0'] = 1; // Слой земли
        local_blocks[i + '_1'] = 2; // Слой камня
        local_blocks[i + '_2'] = 2; // Слой камня
        local_blocks[i + '_3'] = 3; // Обсидиан / бедрок внизу
    }
}

// Выбор блока в хотбаре
window.select_slot = function(id) {
    current_block = id;
    document.querySelectorAll('.hotbar-slot').forEach(el => el.classList.remove('active'));
    document.querySelector(`.hotbar-slot[data-block="${id}"]`).classList.add('active');
}

function init_map() {
    canvas = document.getElementById('rtp-canvas');
    if (canvas) ctx = canvas.getContext('2d');
    
    // Джойстик (только X координата теперь управляет бегом)
    let joyZone = document.getElementById('joystick-zone'); 
    let joyKnob = document.getElementById('joystick-knob'); 
    let jRect = null;
    
    if(joyZone) {
        joyZone.addEventListener('touchstart', e => { e.preventDefault(); isJoyActive = true; jRect = joyZone.getBoundingClientRect(); handleJoy(e.touches[0]); }, {passive:false});
        joyZone.addEventListener('touchmove', e => { e.preventDefault(); if(isJoyActive) handleJoy(e.touches[0]); }, {passive:false});
        joyZone.addEventListener('touchend', e => { e.preventDefault(); isJoyActive = false; joyX = 0; joyY = 0; if(joyKnob) joyKnob.style.transform = `translate(0px, 0px)`; }, {passive:false});
    }
    
    function handleJoy(t) { 
        let dx = t.clientX - (jRect.left + 50); let dy = t.clientY - (jRect.top + 50); 
        let dist = Math.sqrt(dx*dx + dy*dy); let maxD = 35; 
        if(dist > maxD) { dx = (dx/dist)*maxD; dy = (dy/dist)*maxD; } 
        if(joyKnob) joyKnob.style.transform = `translate(${dx}px, ${dy}px)`; 
        joyX = dx / maxD; // Нормализованное отклонение (-1 до 1)
    }

    // Кнопка прыжка
    let btnJump = document.getElementById('btn-jump');
    if(btnJump) {
        btnJump.addEventListener('touchstart', e => {
            e.preventDefault();
            if(is_grounded) {
                vel_y = -8; // Сила прыжка вверх
                is_grounded = false;
            }
        }, {passive:false});
        btnJump.addEventListener('mousedown', e => {
            e.preventDefault();
            if(is_grounded) { vel_y = -8; is_grounded = false; }
        });
    }

    // Клик по экрану для стройки и разрушения
    if (canvas) {
        canvas.addEventListener('touchstart', handle_build_touch, {passive:false});
        canvas.addEventListener('mousedown', handle_build_mouse);
    }
}

function handle_build_touch(e) {
    e.preventDefault();
    let rect = canvas.getBoundingClientRect();
    let tx = e.touches[0].clientX - rect.left;
    let ty = e.touches[0].clientY - rect.top;
    process_build_click(tx, ty);
}

function handle_build_mouse(e) {
    let rect = canvas.getBoundingClientRect();
    let tx = e.clientX - rect.left;
    let ty = e.clientY - rect.top;
    process_build_click(tx, ty);
}

function process_build_click(tx, ty) {
    // Вычисляем, куда нажал игрок в координатах мира
    let cx = canvas.width / 2;
    let cy = canvas.height / 2;
    
    let worldX = tx - cx + loc_x;
    let worldY = ty - cy + loc_y - (PLAYER_H / 2); // Центруем по телу
    
    let gridX = Math.floor(worldX / BLOCK_SIZE);
    let gridY = Math.floor(worldY / BLOCK_SIZE);
    
    // Проверка дальности (чтобы нельзя было строить за 1000 блоков)
    let dist = Math.hypot(worldX - loc_x, worldY - loc_y);
    if(dist > 150) return; // Слишком далеко
    
    let key = gridX + '_' + gridY;
    
    if (current_block === 0) {
        // КИРКА: ломаем блок
        delete local_blocks[key];
    } else {
        // БЛОК: ставим, если внутри клетки не стоит сам игрок
        let pLeft = Math.floor((loc_x - PLAYER_W/2) / BLOCK_SIZE);
        let pRight = Math.floor((loc_x + PLAYER_W/2 - 1) / BLOCK_SIZE);
        let pTop = Math.floor((loc_y - PLAYER_H) / BLOCK_SIZE);
        let pBottom = Math.floor((loc_y - 1) / BLOCK_SIZE);
        
        // Запрещаем ставить блок прямо в себя
        if (gridX >= pLeft && gridX <= pRight && gridY >= pTop && gridY <= pBottom) {
            return; 
        }
        
        local_blocks[key] = current_block;
    }
}

// Проверка столкновений (Коллизия)
function check_collision(nx, ny) {
    // Углы хитбокса игрока (коробки)
    let left = Math.floor((nx - PLAYER_W/2) / BLOCK_SIZE);
    let right = Math.floor((nx + PLAYER_W/2 - 0.1) / BLOCK_SIZE);
    let top = Math.floor((ny - PLAYER_H) / BLOCK_SIZE);
    let bottom = Math.floor((ny - 0.1) / BLOCK_SIZE);

    // Проверяем, есть ли хоть один блок в этих координатах
    for (let bx = left; bx <= right; bx++) {
        for (let by = top; by <= bottom; by++) {
            if (local_blocks[bx + '_' + by]) return true; // Врезались!
        }
    }
    return false; // Свободно
}

function draw_map() {
    let wrap = document.getElementById('map-wrapper');
    if (!canvas) canvas = document.getElementById('rtp-canvas');
    if (canvas && !ctx) ctx = canvas.getContext('2d');
    
    if (wrap && canvas && (canvas.width !== wrap.clientWidth || canvas.height !== wrap.clientHeight)) {
        canvas.width = wrap.clientWidth;
        canvas.height = wrap.clientHeight;
    }
    
    if (!ctx) return requestAnimationFrame(draw_map);
    
    // ----------------------------------------
    // ФИЗИКА И ДВИЖЕНИЕ
    // ----------------------------------------
    if (isJoyActive) {
        vel_x = joyX * 4; // Скорость бега
    } else {
        vel_x = 0;
    }

    vel_y += 0.4; // Гравитация (тянет вниз)
    if (vel_y > 12) vel_y = 12; // Максимальная скорость падения
    
    // Просчет столкновений по оси X
    loc_x += vel_x;
    if (check_collision(loc_x, loc_y)) {
        loc_x -= vel_x; // Если стена - отменяем шаг
        vel_x = 0;
    }

    // Просчет столкновений по оси Y
    is_grounded = false;
    loc_y += vel_y;
    if (check_collision(loc_x, loc_y)) {
        loc_y -= vel_y; // Отменяем падение
        if (vel_y > 0) is_grounded = true; // Мы упали на пол
        vel_y = 0;
        
        // Маленькое выравнивание, чтобы не застревать
        if (is_grounded) loc_y = Math.floor(loc_y); 
    }

    // Обновляем UI с координатами
    let mapX = document.getElementById('map-x');
    let mapY = document.getElementById('map-y');
    if(mapX) mapX.innerText = Math.floor(loc_x / BLOCK_SIZE);
    if(mapY) mapY.innerText = -Math.floor(loc_y / BLOCK_SIZE); // В майнкрафте Y вверх это плюс

    // ----------------------------------------
    // РЕНДЕР
    // ----------------------------------------
    // Голубое небо
    ctx.fillStyle = '#87CEEB'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
    
    let cx = canvas.width / 2; 
    let cy = canvas.height / 2;

    // Отрисовка блоков
    for (let key in local_blocks) {
        let coords = key.split('_');
        let bx = parseInt(coords[0]);
        let by = parseInt(coords[1]);
        
        // Экранные координаты блока
        let screenX = cx + (bx * BLOCK_SIZE - loc_x);
        let screenY = cy + (by * BLOCK_SIZE - loc_y + (PLAYER_H/2));

        // Рисуем только те блоки, которые видно на экране
        if (screenX > -BLOCK_SIZE && screenX < canvas.width && screenY > -BLOCK_SIZE && screenY < canvas.height) {
            let type = local_blocks[key];
            
            if (type === 1) ctx.fillStyle = '#654321'; // Земля (коричневая)
            if (type === 2) ctx.fillStyle = '#808080'; // Камень (серый)
            if (type === 3) ctx.fillStyle = '#1e0036'; // Обсидиан (темно-фиолетовый)
            
            ctx.fillRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);
            
            // Если это земля, рисуем зеленую травку сверху
            if (type === 1) {
                ctx.fillStyle = '#228B22';
                ctx.fillRect(screenX, screenY, BLOCK_SIZE, 6);
            }
            
            // Рисуем рамку блока
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);
        }
    }

    // Отрисовка Игрока (по центру экрана)
    ctx.fillStyle = '#f5c6a5'; // Лицо
    ctx.fillRect(cx - 8, cy - 20, 16, 16);
    
    // Глаза
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 5, cy - 16, 4, 4);
    ctx.fillRect(cx + 1, cy - 16, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 4, cy - 15, 2, 2);
    ctx.fillRect(cx + 2, cy - 15, 2, 2);
    
    // Тело (в броне)
    ctx.fillStyle = '#2bf'; // Алмазный нагрудник
    ctx.fillRect(cx - 10, cy - 4, 20, 16);
    
    // Ноги
    ctx.fillStyle = '#115'; // Синие штаны
    ctx.fillRect(cx - 8, cy + 12, 6, 8);
    ctx.fillRect(cx + 2, cy + 12, 6, 8);

    // Подсветка блока на который наведена мышка/палец (условно по центру экрана перед игроком)
    let reachX = loc_x + (joyX * 40); // Куда смотрит
    let reachY = loc_y;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(cx + (Math.floor(reachX/BLOCK_SIZE)*BLOCK_SIZE - loc_x), cy + (Math.floor((reachY-16)/BLOCK_SIZE)*BLOCK_SIZE - loc_y + 16), BLOCK_SIZE, BLOCK_SIZE);

    requestAnimationFrame(draw_map);
}

// Заглушки для UI кнопок
window.sw_tab = function(tabid, el) { 
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); 
    let target = document.getElementById(`tab-${tabid}`); if(target) target.classList.add('active'); if(el) el.classList.add('active'); 
};
