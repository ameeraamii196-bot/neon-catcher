/**
 * Cosmic Catcher Game Logic
 */

// --- Constants & Config ---
const CONFIG = {
    lives: 3,
    baseSpeed: 3,
    spawnRate: 60, // frames
    basketWidth: 100,
    basketHeight: 20,
    // Map emojis to particle colors
    ballTypes: [
        { emoji: '⚽', color: '#ffffff' },
        { emoji: '🏀', color: '#ff9100' },
        { emoji: '🏈', color: '#8d6e63' },
        { emoji: '⚾', color: '#ff5252' },
        { emoji: '🥎', color: '#ffff00' },
        { emoji: '🎾', color: '#c6ff00' },
        { emoji: '🏐', color: '#e0e0e0' },
        { emoji: '🏉', color: '#8d6e63' }
    ]
};

// --- State Management ---
const state = {
    view: 'loading',
    score: 0,
    level: 1,
    lives: CONFIG.lives,
    isRunning: false,
    isPaused: false,
    soundEnabled: true,
    entities: {
        balls: [],
        particles: [],
        basket: { x: 0, y: 0, width: CONFIG.basketWidth, height: CONFIG.basketHeight }
    },
    canvas: null,
    ctx: null,
    frame: 0
};

// --- Audio System (Web Audio API) ---
// --- Music Engine (Generative Ambient) ---
const MusicEngine = {
    audioCtx: null,
    isPlaying: false,
    interval: null,
    nextNoteTime: 0,

    init(ctx) {
        this.audioCtx = ctx;
    },

    start() {
        if (this.isPlaying || !state.soundEnabled) return;
        this.isPlaying = true;
        this.nextNoteTime = this.audioCtx.currentTime;
        this.scheduler();
    },

    stop() {
        this.isPlaying = false;
        if (this.interval) clearTimeout(this.interval);
    },

    scheduler() {
        if (!this.isPlaying) return;
        while (this.nextNoteTime < this.audioCtx.currentTime + 0.1) {
            this.playNote(this.nextNoteTime);
            this.nextNoteTime += Math.random() * 2 + 1.5; // Random interval 1.5s - 3.5s
        }
        this.interval = setTimeout(() => this.scheduler(), 100);
    },

    playNote(time) {
        // Simple scale: C4, Eb4, F4, G4, Bb4 (C Minor Pentatonic)
        const freqs = [261.63, 311.13, 349.23, 392.00, 466.16, 523.25];
        const freq = freqs[Math.floor(Math.random() * freqs.length)];

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        // Envelope: Slow attack, long release (Pad/Ambient style)
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.05, time + 1); // Low volume
        gain.gain.exponentialRampToValueAtTime(0.001, time + 4);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(time);
        osc.stop(time + 4);
    }
};

// Update Audio Context reference and start music on interaction
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
MusicEngine.init(audioCtx);

const sounds = {
    catch: () => sfx(600, 'sine', 0.1),
    miss: () => sfx(150, 'sawtooth', 0.3),
    click: () => {
        sfx(400, 'triangle', 0.05);
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
            MusicEngine.start();
        }
    },
    levelUp: () => {
        sfx(400, 'sine', 0.1, 0);
        setTimeout(() => sfx(600, 'sine', 0.1, 0), 100);
        setTimeout(() => sfx(800, 'sine', 0.2, 0), 200);
    },
    gameOver: () => {
        sfx(300, 'sawtooth', 0.5, 0);
        setTimeout(() => sfx(200, 'sawtooth', 0.5, 0), 300);
    }
};

function sfx(freq, type, duration, delay = 0) {
    if (!state.soundEnabled) return;
    setTimeout(() => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        osc.type = type;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
    }, delay);
}

// --- DOM Elements ---
const dom = {
    app: document.getElementById('app'),
    screens: {
        loading: document.getElementById('loading-page'),
        home: document.getElementById('home-page'),
        level: document.getElementById('level-page'),
        game: document.getElementById('game-page')
    },
    ui: {
        score: document.getElementById('score-display'),
        level: document.getElementById('level-display'),
        lives: document.getElementById('lives-display'),
        loadingBar: document.getElementById('loading-bar')
    },
    modals: {
        game: document.getElementById('game-modal'),
        instructions: document.getElementById('instructions-modal')
    },
    buttons: {
        start: document.getElementById('btn-start'),
        instr: document.getElementById('btn-instructions'),
        closeInstr: document.getElementById('btn-close-instructions'),
        backHome: document.getElementById('btn-back-home'),
        pause: document.getElementById('btn-pause'),
        restart: document.getElementById('btn-restart'),
        quit: document.getElementById('btn-quit')
    }
};

// --- Initialization ---
window.onload = () => {
    initLoader();
    setupCanvas();
    setupEvents();
};

function initLoader() {
    let progress = 0;
    const interval = setInterval(() => {
        progress += 2;
        dom.ui.loadingBar.style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => switchView('home'), 500);
        }
    }, 30);
}

function setupCanvas() {
    state.canvas = document.getElementById('game-canvas');
    state.ctx = state.canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    state.canvas.width = window.innerWidth;
    state.canvas.height = window.innerHeight;
    state.entities.basket.y = window.innerHeight - 50;
    state.entities.basket.x = window.innerWidth / 2 - state.entities.basket.width / 2;
}

function setupEvents() {
    // Buttons
    // Start music on first interaction if needed
    dom.buttons.start.onclick = () => { sounds.click(); switchView('level'); MusicEngine.start(); };
    dom.buttons.instr.onclick = () => { sounds.click(); toggleModal('instructions', true); };
    dom.buttons.closeInstr.onclick = () => { sounds.click(); toggleModal('instructions', false); };
    dom.buttons.backHome.onclick = () => { sounds.click(); switchView('home'); };
    dom.buttons.pause.onclick = () => { sounds.click(); togglePause(); };
    dom.buttons.restart.onclick = () => { sounds.click(); startGame(state.level); toggleModal('game', false); };
    dom.buttons.quit.onclick = () => { sounds.click(); switchView('home'); toggleModal('game', false); };

    // Sound Toggle
    document.getElementById('sound-toggle').onchange = (e) => {
        state.soundEnabled = e.target.checked;
        if (state.soundEnabled) MusicEngine.start();
        else MusicEngine.stop();
    };

    // Level Generation
    const grid = document.getElementById('levels-grid');
    for (let i = 1; i <= 6; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.innerText = i;
        btn.onclick = () => { sounds.click(); startGame(i); };
        grid.appendChild(btn);
    }

    // Input Handling
    window.addEventListener('mousemove', (e) => {
        if (state.isRunning && !state.isPaused) {
            state.entities.basket.x = e.clientX - state.entities.basket.width / 2;
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (state.isRunning && !state.isPaused) {
            e.preventDefault();
            const touchX = e.touches[0].clientX;
            state.entities.basket.x = touchX - state.entities.basket.width / 2;
        }
    }, { passive: false });
}

// --- View Logic ---
function switchView(viewName) {
    Object.values(dom.screens).forEach(el => {
        el.classList.remove('active-page');
        el.classList.add('hidden-page');
    });
    dom.screens[viewName].classList.remove('hidden-page');
    dom.screens[viewName].classList.add('active-page');
    state.view = viewName;
}

function toggleModal(name, show) {
    const el = dom.modals[name];
    if (show) {
        el.classList.remove('hidden-modal');
    } else {
        el.classList.add('hidden-modal');
    }
}

// --- Game Logic ---
function startGame(level) {
    state.level = level;
    state.score = 0;
    state.lives = CONFIG.lives;
    state.entities.balls = [];
    state.entities.particles = [];
    state.isRunning = true;
    state.isPaused = false;
    state.frame = 0;

    updateUI();
    switchView('game');
    gameLoop();
}

function togglePause() {
    state.isPaused = !state.isPaused;
    document.getElementById('modal-title').innerText = 'Paused';
    document.getElementById('modal-message').innerText = `Current Score: ${state.score}`;
    document.getElementById('btn-restart').innerText = 'Resume';

    // Override resume button behavior for pause menu
    const resumeBtn = document.getElementById('btn-restart');
    const originalOnClick = resumeBtn.onclick;

    resumeBtn.onclick = () => {
        sounds.click();
        state.isPaused = false;
        toggleModal('game', false);
        resumeBtn.onclick = originalOnClick; // Restore restart functionality
        resumeBtn.innerText = 'Try Again';
        gameLoop();
    };

    toggleModal('game', true);
}

function gameOver() {
    state.isRunning = false;
    sounds.gameOver();
    document.getElementById('modal-title').innerText = 'Game Over';
    document.getElementById('modal-message').innerText = `Final Score: ${state.score}`;
    document.getElementById('btn-restart').innerText = 'Try Again';

    // Restore default restart behavior
    document.getElementById('btn-restart').onclick = () => {
        sounds.click();
        startGame(state.level);
        toggleModal('game', false);
    };

    toggleModal('game', true);
}

function spawnBall() {
    const size = Math.random() * 20 + 15; // Effectively radius for collision
    const x = Math.random() * (state.canvas.width - size * 2) + size;
    const speed = (CONFIG.baseSpeed + state.level) * (Math.random() * 0.5 + 0.8);

    // Select random ball type
    const type = CONFIG.ballTypes[Math.floor(Math.random() * CONFIG.ballTypes.length)];

    state.entities.balls.push({
        xOffset: x,
        y: -50,
        radius: size,
        speed: speed,
        color: type.color,
        emoji: type.emoji
    });
}

function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        state.entities.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color: color
        });
    }
}

function updateGame() {
    if (!state.isRunning || state.isPaused) return;

    // Spawn
    if (state.frame % (Math.max(20, CONFIG.spawnRate - state.level * 5)) === 0) {
        spawnBall();
    }

    // Update Balls
    for (let i = state.entities.balls.length - 1; i >= 0; i--) {
        let b = state.entities.balls[i];
        b.y += b.speed;

        // Collision with Basket
        const basket = state.entities.basket;
        // Simple AABB / Circle overlap check
        if (
            b.y + b.radius >= basket.y &&
            b.y - b.radius <= basket.y + basket.height &&
            b.xOffset >= basket.x &&
            b.xOffset <= basket.x + basket.width
        ) {
            // Caught
            state.score += 10;
            sounds.catch();
            createParticles(b.xOffset, b.y, b.color);
            state.entities.balls.splice(i, 1);

            if (state.score > 0 && state.score % 100 === 0) {
                state.level++;
                sounds.levelUp();
            }
            continue;
        }

        // Missed
        if (b.y > state.canvas.height) {
            state.lives--;
            sounds.miss();
            state.entities.balls.splice(i, 1);
            if (state.lives <= 0) {
                gameOver();
            }
        }
    }

    // Update Particles
    for (let i = state.entities.particles.length - 1; i >= 0; i--) {
        let p = state.entities.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) state.entities.particles.splice(i, 1);
    }

    state.frame++;
}

// Helper for rounded rect if not supported or for custom styling
function drawRoundedRect(ctx, x, y, width, height, radius) {
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
        ctx.fill();
        return;
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

function drawGame() {
    const ctx = state.ctx;
    ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);

    // Draw Basket
    const basket = state.entities.basket;

    // Glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00f2ff';

    // Basket Body
    const gradient = ctx.createLinearGradient(basket.x, basket.y, basket.x + basket.width, basket.y);
    gradient.addColorStop(0, '#750edc'); // Updated to user's new primary style
    gradient.addColorStop(1, '#bd00ff');
    ctx.fillStyle = gradient;

    drawRoundedRect(ctx, basket.x, basket.y, basket.width, basket.height, 10);

    ctx.shadowBlur = 0; // Reset

    // Draw Balls (Emojis)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    state.entities.balls.forEach(b => {
        // Font size based on radius (radius is half width, so size ~ radius * 2)
        ctx.font = `${b.radius * 2}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;

        ctx.shadowBlur = 15;
        ctx.shadowColor = b.color;

        ctx.fillStyle = '#fff'; // Text color
        ctx.fillText(b.emoji, b.xOffset, b.y);

        ctx.shadowBlur = 0;
    });

    // Draw Particles
    state.entities.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        // Simple circle particles
        ctx.beginPath();
        const pSize = Math.random() * 3 + 2;
        ctx.arc(p.x, p.y, pSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    updateUI();
}

function updateUI() {
    dom.ui.score.innerText = state.score;
    dom.ui.level.innerText = state.level;
    dom.ui.lives.innerText = '❤️'.repeat(Math.max(0, state.lives));
}

function gameLoop() {
    if (!state.isRunning || state.isPaused) return;
    updateGame();
    drawGame();
    requestAnimationFrame(gameLoop);
}
