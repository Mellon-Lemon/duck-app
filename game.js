(() => {
  "use strict";

  const CONFIG = {
    maxDpr: 2,
    maxLives: 3,
    assetPaths: {
      duck: "assets/player-duck.svg",
      duckAngry: "assets/player-duck-angry.svg",
      duckHit: "assets/player-duck-hit.svg",
      coin: "assets/coin.svg",
      sparkle: "assets/coin-sparkle.svg",
      crate: "assets/crate.svg",
      cactus: "assets/cactus.svg",
      puddle: "assets/puddle.svg",
      rock: "assets/rock.svg",
      cloud1: "assets/cloud-1.svg",
      cloud2: "assets/cloud-2.svg",
      cloud3: "assets/cloud-3.svg",
      hills: "assets/bg-hills.svg",
      bushes: "assets/bg-bushes.svg",
      sun: "assets/bg-sun.svg",
      moon: "assets/bg-moon.svg",
      magnet: "assets/magnet.svg",
      shield: "assets/shield.svg",
      heart: "assets/heart.svg",
      feather: "assets/feather.svg",
      sound: "assets/icon-sound.svg",
      muted: "assets/icon-muted.svg"
    },
    storage: {
      highscore: "daanDuck.highscore",
      bestCoins: "daanDuck.bestCoins",
      muted: "daanDuck.muted",
      achievements: "daanDuck.achievements",
      skin: "daanDuck.skin"
    },
    physics: {
      gravity: 2250,
      jumpVelocity: 820,
      maxFallSpeed: 1300,
      coyoteTime: 0.08,
      jumpBuffer: 0.1,
      jumpCut: 0.48
    },
    game: {
      baseSpeed: 245,
      speedStep: 32,
      speedDrift: 1.15,
      maxSpeed: 565,
      comboTimeout: 1.5,
      maxCombo: 5,
      invulnerability: 1.2,
      magnetDuration: 8,
      featherDuration: 10,
      magnetRadius: 170
    },
    achievements: [
      { id: "firstCoin", name: "Eerste Munt", text: "pak je eerste munt" },
      { id: "coinMagnet", name: "Muntenmagneet", text: "pak 25 munten in een run" },
      { id: "survivor", name: "Boze Overlever", text: "overleef 60 seconden" },
      { id: "combo", name: "Combo Kwaker", text: "bereik combo x5" },
      { id: "legend", name: "Nieuwe Legende", text: "verbeter highscore" }
    ]
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  const lerp = (a, b, t) => a + (b - a) * t;

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const value = parseInt(normalized, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }

  function mixColor(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return `rgb(${Math.round(lerp(ca.r, cb.r, t))}, ${Math.round(lerp(ca.g, cb.g, t))}, ${Math.round(lerp(ca.b, cb.b, t))})`;
  }

  const Storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage can be unavailable in strict private modes; the game still runs.
      }
    }
  };

  class AssetLoader {
    constructor(paths) {
      this.paths = paths;
      this.images = new Map();
    }

    loadAll() {
      const jobs = Object.entries(this.paths).map(([key, src]) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.images.set(key, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
      }));
      return Promise.all(jobs);
    }

    get(key) {
      return this.images.get(key);
    }
  }

  class AudioManager {
    constructor() {
      this.context = null;
      this.master = null;
      this.muted = Boolean(Storage.get(CONFIG.storage.muted, false));
    }

    unlock() {
      if (this.context || this.muted) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.26;
      this.master.connect(this.context.destination);
      if (this.context.state === "suspended") {
        this.context.resume();
      }
    }

    setMuted(value) {
      this.muted = value;
      Storage.set(CONFIG.storage.muted, this.muted);
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.26;
    }

    toggle() {
      this.setMuted(!this.muted);
      if (!this.muted) this.unlock();
      return this.muted;
    }

    beep(freq, duration, type = "sine", gain = 0.35, when = 0, slideTo = null) {
      if (this.muted || !this.context || !this.master) return;
      const now = this.context.currentTime + when;
      const osc = this.context.createOscillator();
      const amp = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp);
      amp.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    noise(duration, gain = 0.18) {
      if (this.muted || !this.context || !this.master) return;
      const sampleRate = this.context.sampleRate;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const source = this.context.createBufferSource();
      const amp = this.context.createGain();
      amp.gain.value = gain;
      source.buffer = buffer;
      source.connect(amp);
      amp.connect(this.master);
      source.start();
    }

    play(name) {
      if (this.muted) return;
      this.unlock();
      switch (name) {
        case "jump":
          this.beep(280, 0.12, "triangle", 0.28, 0, 640);
          break;
        case "coin":
          this.beep(720, 0.07, "sine", 0.26);
          this.beep(1120, 0.09, "sine", 0.2, 0.055);
          break;
        case "combo":
          this.beep(920, 0.07, "square", 0.2);
          this.beep(1320, 0.1, "sine", 0.2, 0.045);
          break;
        case "hit":
          this.noise(0.18, 0.22);
          this.beep(210, 0.18, "sawtooth", 0.2, 0, 80);
          break;
        case "shield":
          this.beep(360, 0.12, "triangle", 0.24, 0, 900);
          this.beep(900, 0.12, "sine", 0.18, 0.08);
          break;
        case "powerup":
          this.beep(540, 0.08, "triangle", 0.25);
          this.beep(760, 0.08, "triangle", 0.22, 0.07);
          this.beep(980, 0.1, "triangle", 0.2, 0.14);
          break;
        case "countdown":
          this.beep(620, 0.08, "square", 0.2);
          break;
        case "go":
          this.beep(840, 0.12, "square", 0.24);
          this.beep(1260, 0.15, "sine", 0.22, 0.08);
          break;
        case "gameover":
          this.beep(320, 0.16, "sawtooth", 0.22, 0, 180);
          this.beep(210, 0.24, "triangle", 0.18, 0.14, 90);
          break;
        case "button":
          this.beep(520, 0.06, "triangle", 0.16);
          break;
        default:
          break;
      }
    }
  }

  class InputManager {
    constructor(game) {
      this.game = game;
      this.pointerHeld = false;
      this.bind();
    }

    bind() {
      const app = this.game.el.app;
      app.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button")) return;
        event.preventDefault();
        this.pointerHeld = true;
        this.game.handlePrimaryInput();
      }, { passive: false });

      window.addEventListener("pointerup", () => {
        if (!this.pointerHeld) return;
        this.pointerHeld = false;
        this.game.releaseJump();
      }, { passive: true });

      window.addEventListener("keydown", (event) => {
        const key = event.key;
        if ([" ", "ArrowUp", "Escape", "p", "P", "r", "R"].includes(key)) {
          event.preventDefault();
        }
        this.game.audio.unlock();
        if ((key === " " || key === "ArrowUp") && !event.repeat) {
          this.game.handlePrimaryInput();
        }
        if (key === "p" || key === "P" || key === "Escape") {
          this.game.togglePause();
        }
        if ((key === "r" || key === "R") && this.game.state === "gameover") {
          this.game.startRun();
        }
      }, { passive: false });

      window.addEventListener("keyup", (event) => {
        if (event.key === " " || event.key === "ArrowUp") {
          this.game.releaseJump();
        }
      }, { passive: true });
    }
  }

  class AchievementManager {
    constructor(game) {
      this.game = game;
      this.definitions = CONFIG.achievements;
      this.unlocked = Storage.get(CONFIG.storage.achievements, {});
      this.runUnlocked = [];
    }

    resetRun() {
      this.runUnlocked = [];
    }

    unlock(id) {
      if (this.unlocked[id]) return;
      const definition = this.definitions.find((item) => item.id === id);
      if (!definition) return;
      this.unlocked[id] = true;
      this.runUnlocked.push(definition);
      Storage.set(CONFIG.storage.achievements, this.unlocked);
      this.game.showToast(`Achievement: ${definition.name}`);
    }

    render(container, mode = "all") {
      const source = mode === "run"
        ? this.runUnlocked
        : this.definitions.filter((definition) => this.unlocked[definition.id]);
      container.innerHTML = "";
      source.forEach((definition) => {
        const chip = document.createElement("span");
        chip.className = "achievement-chip";
        chip.textContent = definition.name;
        chip.title = definition.text;
        container.appendChild(chip);
      });
    }
  }

  class Particle {
    constructor(x, y, options = {}) {
      this.x = x;
      this.y = y;
      this.vx = options.vx ?? rand(-100, 100);
      this.vy = options.vy ?? rand(-160, -40);
      this.size = options.size ?? rand(4, 9);
      this.color = options.color ?? "#fff6a8";
      this.image = options.image ?? null;
      this.life = options.life ?? rand(0.35, 0.75);
      this.maxLife = this.life;
      this.gravity = options.gravity ?? 620;
      this.dead = false;
    }

    update(dt) {
      this.life -= dt;
      if (this.life <= 0) {
        this.dead = true;
        return;
      }
      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    draw(ctx) {
      const alpha = clamp(this.life / this.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (this.image) {
        const size = this.size * 2.8 * alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate((1 - alpha) * Math.PI);
        ctx.drawImage(this.image, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  class FloatingText {
    constructor(text, x, y, color = "#fff") {
      this.text = text;
      this.x = x;
      this.y = y;
      this.vy = -58;
      this.life = 0.85;
      this.maxLife = this.life;
      this.color = color;
      this.dead = false;
    }

    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      this.y += this.vy * dt;
    }

    draw(ctx) {
      const alpha = clamp(this.life / this.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "900 24px Trebuchet MS, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#24304a";
      ctx.fillStyle = this.color;
      ctx.strokeText(this.text, this.x, this.y);
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  class Player {
    constructor(game) {
      this.game = game;
      this.reset();
    }

    reset() {
      this.w = 74 * this.game.scale;
      this.h = 64 * this.game.scale;
      this.x = Math.max(42, this.game.width * 0.18);
      this.y = this.game.groundY - this.h;
      this.vy = 0;
      this.onGround = true;
      this.wasGrounded = true;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.invulnerable = 0;
      this.hitTimer = 0;
      this.squash = 0;
      this.usedDoubleJump = false;
    }

    resize() {
      const bottomOffset = this.game.groundY - (this.y + this.h);
      this.w = 74 * this.game.scale;
      this.h = 64 * this.game.scale;
      this.x = Math.max(42, this.game.width * 0.18);
      this.y = this.game.groundY - this.h - Math.max(0, bottomOffset);
      if (this.onGround) this.y = this.game.groundY - this.h;
    }

    requestJump() {
      this.jumpBuffer = CONFIG.physics.jumpBuffer;
    }

    releaseJump() {
      if (this.vy < 0) {
        this.vy *= CONFIG.physics.jumpCut;
      }
    }

    performJump(isDouble = false) {
      this.vy = -CONFIG.physics.jumpVelocity * this.game.scale;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = isDouble ? -0.22 : -0.16;
      if (isDouble) this.usedDoubleJump = true;
      this.game.audio.play("jump");
      this.game.spawnDust(this.x + this.w * 0.35, this.game.groundY, isDouble ? "#9be7ff" : "#db9b4a", 8);
    }

    update(dt) {
      this.wasGrounded = this.onGround;
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.hitTimer = Math.max(0, this.hitTimer - dt);
      this.coyote = this.onGround ? CONFIG.physics.coyoteTime : Math.max(0, this.coyote - dt);

      if (this.jumpBuffer > 0) {
        if (this.onGround || this.coyote > 0) {
          this.performJump(false);
        } else if (this.game.activePowerups.feather > 0 && !this.usedDoubleJump) {
          this.performJump(true);
        }
      }

      this.vy += CONFIG.physics.gravity * this.game.scale * dt;
      this.vy = Math.min(this.vy, CONFIG.physics.maxFallSpeed * this.game.scale);
      this.y += this.vy * dt;

      const groundY = this.game.groundY - this.h;
      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.onGround = true;
        this.coyote = CONFIG.physics.coyoteTime;
        this.usedDoubleJump = false;
        if (!this.wasGrounded) {
          this.squash = 0.24;
          this.game.spawnDust(this.x + this.w * 0.45, this.game.groundY, "#d08a39", 10);
        }
      } else {
        this.onGround = false;
      }

      this.squash = lerp(this.squash, 0, clamp(dt * 12, 0, 1));
    }

    takeHit() {
      this.invulnerable = CONFIG.game.invulnerability;
      this.hitTimer = 0.45;
      this.squash = 0.36;
      this.vy = -260 * this.game.scale;
    }

    collisionBox() {
      return {
        x: this.x + this.w * 0.18,
        y: this.y + this.h * 0.12,
        w: this.w * 0.64,
        h: this.h * 0.76
      };
    }

    center() {
      return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
    }

    draw(ctx) {
      const img = this.pickImage();
      if (!img) return;
      const time = this.game.visualTime;
      const bob = this.onGround ? Math.sin(time * 13) * 3 * this.game.scale : 0;
      const blink = this.invulnerable > 0 && Math.floor(time * 18) % 2 === 0;
      const sx = 1 + this.squash;
      const sy = 1 - this.squash * 0.55;
      const rotation = this.onGround ? Math.sin(time * 8) * 0.035 : clamp(this.vy / 2200, -0.2, 0.25);

      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2 + bob);

      if (this.game.activePowerups.shield) {
        ctx.save();
        ctx.globalAlpha = 0.42 + Math.sin(time * 7) * 0.12;
        ctx.strokeStyle = "#59c7ff";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.ellipse(0, 1, this.w * 0.64, this.h * 0.72, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (this.game.activePowerups.magnet > 0) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 10]);
        ctx.rotate(time * 0.7);
        ctx.beginPath();
        ctx.ellipse(0, 0, this.w * 1.15, this.h * 0.95, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(rotation);
      ctx.scale(sx, sy);
      ctx.globalAlpha = blink ? 0.38 : 1;

      if (this.game.skin === "night") {
        ctx.filter = "hue-rotate(35deg) saturate(0.85) brightness(0.95)";
      }
      ctx.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.filter = "none";

      if (this.game.skin === "scarf") {
        ctx.fillStyle = "#ef4444";
        ctx.strokeStyle = "#3b2517";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.w * 0.05, -this.h * 0.02);
        ctx.lineTo(this.w * 0.33, this.h * 0.08);
        ctx.lineTo(this.w * 0.08, this.h * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (this.game.skin === "night") {
        ctx.fillStyle = "#3757d6";
        ctx.strokeStyle = "#24304a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(2, -this.h * 0.43, 8 * this.game.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      if (this.game.activePowerups.feather > 0) {
        const feather = this.game.assets.get("feather");
        if (feather) {
          ctx.globalAlpha = 0.92;
          ctx.drawImage(feather, -this.w * 0.68, -this.h * 0.45, this.w * 0.36, this.h * 0.55);
        }
      }

      ctx.restore();
    }

    pickImage() {
      if (this.hitTimer > 0) return this.game.assets.get("duckHit");
      if (this.game.lives <= 1 || this.invulnerable > 0) return this.game.assets.get("duckAngry");
      return this.game.assets.get("duck");
    }
  }

  class Obstacle {
    constructor(game, type) {
      this.game = game;
      this.type = type;
      const scale = game.scale;
      const specs = {
        crate: { w: 62, h: 62, img: "crate", inset: [0.16, 0.12, 0.22, 0.12] },
        cactus: { w: 56, h: 76, img: "cactus", inset: [0.2, 0.08, 0.24, 0.08] },
        puddle: { w: 92, h: 36, img: "puddle", inset: [0.12, 0.46, 0.12, 0.08] },
        rock: { w: 62, h: 50, img: "rock", inset: [0.14, 0.2, 0.16, 0.12] }
      };
      const spec = specs[type];
      this.w = spec.w * scale;
      this.h = spec.h * scale;
      this.imgKey = spec.img;
      this.inset = spec.inset;
      this.x = game.width + this.w + rand(6, 70);
      this.y = game.groundY - this.h + (type === "puddle" ? this.h * 0.18 : 0);
      this.dead = false;
      this.hit = false;
    }

    update(dt, speed) {
      this.x -= speed * dt;
      if (this.x + this.w < -80) this.dead = true;
    }

    collisionBox() {
      const [l, t, r, b] = this.inset;
      return {
        x: this.x + this.w * l,
        y: this.y + this.h * t,
        w: this.w * (1 - l - r),
        h: this.h * (1 - t - b)
      };
    }

    draw(ctx) {
      const img = this.game.assets.get(this.imgKey);
      if (!img) return;
      ctx.save();
      ctx.shadowColor = "rgba(36, 48, 74, 0.18)";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 7 * this.game.scale;
      ctx.drawImage(img, this.x, this.y, this.w, this.h);
      ctx.restore();
    }
  }

  class Coin {
    constructor(game, x, y) {
      this.game = game;
      this.x = x;
      this.baseY = y;
      this.y = y;
      this.w = 34 * game.scale;
      this.h = 34 * game.scale;
      this.phase = rand(0, Math.PI * 2);
      this.dead = false;
    }

    update(dt, speed) {
      this.x -= speed * dt;
      this.y = this.baseY + Math.sin(this.game.visualTime * 5 + this.phase) * 6 * this.game.scale;

      if (this.game.activePowerups.magnet > 0) {
        const target = this.game.player.center();
        const here = { x: this.x + this.w / 2, y: this.y + this.h / 2 };
        const d = distance(here, target);
        if (d < CONFIG.game.magnetRadius * this.game.scale) {
          const pull = clamp(1 - d / (CONFIG.game.magnetRadius * this.game.scale), 0.12, 1);
          this.x += ((target.x - here.x) / Math.max(d, 1)) * 520 * pull * dt * this.game.scale;
          this.baseY += ((target.y - here.y) / Math.max(d, 1)) * 520 * pull * dt * this.game.scale;
        }
      }

      if (this.x + this.w < -50) this.dead = true;
    }

    collisionBox() {
      return {
        x: this.x + this.w * 0.12,
        y: this.y + this.h * 0.12,
        w: this.w * 0.76,
        h: this.h * 0.76
      };
    }

    draw(ctx) {
      const img = this.game.assets.get("coin");
      if (!img) return;
      const spin = Math.abs(Math.cos(this.game.visualTime * 9 + this.phase));
      const sx = clamp(spin, 0.22, 1);
      const pulse = 1 + Math.sin(this.game.visualTime * 7 + this.phase) * 0.06;
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.scale(sx * pulse, pulse);
      ctx.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    }
  }

  class PowerUp {
    constructor(game, type) {
      this.game = game;
      this.type = type;
      this.imgKey = type;
      this.w = 42 * game.scale;
      this.h = 42 * game.scale;
      this.x = game.width + this.w + rand(40, 120);
      this.baseY = game.groundY - rand(105, 205) * game.scale;
      this.y = this.baseY;
      this.phase = rand(0, Math.PI * 2);
      this.dead = false;
    }

    update(dt, speed) {
      this.x -= speed * dt;
      this.y = this.baseY + Math.sin(this.game.visualTime * 4 + this.phase) * 8 * this.game.scale;
      if (this.x + this.w < -60) this.dead = true;
    }

    collisionBox() {
      return {
        x: this.x + this.w * 0.12,
        y: this.y + this.h * 0.12,
        w: this.w * 0.76,
        h: this.h * 0.76
      };
    }

    draw(ctx) {
      const img = this.game.assets.get(this.imgKey);
      if (!img) return;
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(Math.sin(this.game.visualTime * 3 + this.phase) * 0.15);
      ctx.globalAlpha = 0.95;
      ctx.shadowColor = this.type === "shield" ? "#59c7ff" : "#ffd84f";
      ctx.shadowBlur = 14;
      ctx.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    }
  }

  class Game {
    constructor() {
      this.el = this.getElements();
      this.ctx = this.el.canvas.getContext("2d");
      this.assets = new AssetLoader(CONFIG.assetPaths);
      this.audio = new AudioManager();
      this.achievements = new AchievementManager(this);
      this.state = "loading";
      this.visualTime = 0;
      this.lastFrame = 0;
      this.width = 1;
      this.height = 1;
      this.dpr = 1;
      this.scale = 1;
      this.groundY = 1;
      this.skin = Storage.get(CONFIG.storage.skin, "classic");
      this.highscore = Number(Storage.get(CONFIG.storage.highscore, 0)) || 0;
      this.bestCoins = Number(Storage.get(CONFIG.storage.bestCoins, 0)) || 0;
      this.clouds = [];
      this.obstacles = [];
      this.coins = [];
      this.powerups = [];
      this.particles = [];
      this.floatingTexts = [];
      this.activePowerups = { magnet: 0, feather: 0, shield: false };
      this.player = new Player(this);
      this.input = new InputManager(this);
      this.bindUi();
      this.resize();
      this.updateMuteIcons();
      this.updateSkinButtons();
      this.renderStartMeta();
      this.assets.loadAll().then(() => {
        this.setState("start");
        this.hide(this.el.loadingScreen);
        this.show(this.el.startScreen);
        this.renderStartMeta();
      });
      requestAnimationFrame((time) => this.loop(time));
    }

    getElements() {
      const $ = (id) => document.getElementById(id);
      return {
        app: $("app"),
        canvas: $("gameCanvas"),
        hud: $("hud"),
        loadingScreen: $("loadingScreen"),
        startScreen: $("startScreen"),
        countdownScreen: $("countdownScreen"),
        pauseScreen: $("pauseScreen"),
        gameOverScreen: $("gameOverScreen"),
        countdownText: $("countdownText"),
        scoreText: $("scoreText"),
        coinText: $("coinText"),
        comboText: $("comboText"),
        speedText: $("speedText"),
        heartHud: $("heartHud"),
        powerHud: $("powerHud"),
        startHighscore: $("startHighscore"),
        startBestCoins: $("startBestCoins"),
        startAchievements: $("startAchievements"),
        gameOverAchievements: $("gameOverAchievements"),
        finalScore: $("finalScore"),
        finalCoins: $("finalCoins"),
        bestScore: $("bestScore"),
        newHighscoreText: $("newHighscoreText"),
        toastRoot: $("toastRoot"),
        screenFlash: $("screenFlash"),
        muteIcon: $("muteIcon"),
        startMuteIcon: $("startMuteIcon"),
        startBtn: $("startBtn"),
        muteBtn: $("muteBtn"),
        startMuteBtn: $("startMuteBtn"),
        pauseBtn: $("pauseBtn"),
        resumeBtn: $("resumeBtn"),
        pauseRestartBtn: $("pauseRestartBtn"),
        pauseMuteBtn: $("pauseMuteBtn"),
        restartBtn: $("restartBtn"),
        backStartBtn: $("backStartBtn"),
        skinButtons: Array.from(document.querySelectorAll(".skin-button"))
      };
    }

    bindUi() {
      window.addEventListener("resize", () => this.resize(), { passive: true });
      window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 140), { passive: true });

      this.el.startBtn.addEventListener("click", () => this.buttonAction(() => this.startRun()));
      this.el.pauseBtn.addEventListener("click", () => this.buttonAction(() => this.pause()));
      this.el.resumeBtn.addEventListener("click", () => this.buttonAction(() => this.resume()));
      this.el.pauseRestartBtn.addEventListener("click", () => this.buttonAction(() => this.startRun()));
      this.el.restartBtn.addEventListener("click", () => this.buttonAction(() => this.startRun()));
      this.el.backStartBtn.addEventListener("click", () => this.buttonAction(() => this.showStart()));
      this.el.muteBtn.addEventListener("click", () => this.buttonAction(() => this.toggleMute(), false));
      this.el.startMuteBtn.addEventListener("click", () => this.buttonAction(() => this.toggleMute(), false));
      this.el.pauseMuteBtn.addEventListener("click", () => this.buttonAction(() => this.toggleMute(), false));

      this.el.skinButtons.forEach((button) => {
        button.addEventListener("click", () => this.buttonAction(() => {
          this.skin = button.dataset.skin;
          Storage.set(CONFIG.storage.skin, this.skin);
          this.updateSkinButtons();
        }));
      });
    }

    buttonAction(action, playSound = true) {
      this.audio.unlock();
      if (playSound) this.audio.play("button");
      action();
    }

    resize() {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      this.width = width;
      this.height = height;
      this.dpr = clamp(window.devicePixelRatio || 1, 1, CONFIG.maxDpr);
      this.el.canvas.width = Math.floor(width * this.dpr);
      this.el.canvas.height = Math.floor(height * this.dpr);
      this.el.canvas.style.width = `${width}px`;
      this.el.canvas.style.height = `${height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.scale = clamp(Math.min(width / 390, height / 760), 0.82, 1.18);
      this.groundY = height - clamp(height * 0.16, 92, 148);
      if (this.player) this.player.resize();
      if (!this.clouds.length) this.initClouds();
    }

    initClouds() {
      this.clouds = Array.from({ length: 7 }, (_, index) => ({
        x: rand(0, this.width) + index * 28,
        y: rand(38, Math.max(90, this.height * 0.32)),
        scale: rand(0.46, 0.88),
        speed: rand(7, 20),
        img: pick(["cloud1", "cloud2", "cloud3"])
      }));
    }

    setState(state) {
      this.state = state;
    }

    show(element) {
      element.classList.remove("hidden");
    }

    hide(element) {
      element.classList.add("hidden");
    }

    handlePrimaryInput() {
      this.audio.unlock();
      if (this.state === "start") {
        this.startRun();
      } else if (this.state === "playing") {
        this.player.requestJump();
      }
    }

    releaseJump() {
      if (this.state === "playing") this.player.releaseJump();
    }

    startRun() {
      this.resetRun();
      this.hide(this.el.startScreen);
      this.hide(this.el.pauseScreen);
      this.hide(this.el.gameOverScreen);
      this.show(this.el.hud);
      this.show(this.el.countdownScreen);
      this.setState("countdown");
      this.countdownTimer = 3.45;
      this.lastCountdownLabel = "";
      this.updateHud(true);
    }

    resetRun() {
      this.elapsed = 0;
      this.distance = 0;
      this.score = 0;
      this.runCoins = 0;
      this.lives = CONFIG.maxLives;
      this.comboMultiplier = 1;
      this.comboTimer = 0;
      this.obstacleTimer = 1.05;
      this.coinTimer = 0.65;
      this.powerTimer = rand(8, 14);
      this.shakeTime = 0;
      this.shakeAmount = 0;
      this.hudTimer = 0;
      this.newHighscore = false;
      this.obstacles = [];
      this.coins = [];
      this.powerups = [];
      this.particles = [];
      this.floatingTexts = [];
      this.activePowerups = { magnet: 0, feather: 0, shield: false };
      this.achievements.resetRun();
      this.player.reset();
    }

    showStart() {
      this.setState("start");
      this.hide(this.el.hud);
      this.hide(this.el.countdownScreen);
      this.hide(this.el.pauseScreen);
      this.hide(this.el.gameOverScreen);
      this.show(this.el.startScreen);
      this.renderStartMeta();
    }

    pause() {
      if (this.state !== "playing" && this.state !== "countdown") return;
      this.previousState = this.state;
      this.setState("paused");
      this.hide(this.el.countdownScreen);
      this.show(this.el.pauseScreen);
    }

    resume() {
      if (this.state !== "paused") return;
      this.setState(this.previousState || "playing");
      this.hide(this.el.pauseScreen);
      if (this.state === "countdown") this.show(this.el.countdownScreen);
    }

    togglePause() {
      if (this.state === "playing" || this.state === "countdown") {
        this.pause();
      } else if (this.state === "paused") {
        this.resume();
      }
    }

    toggleMute() {
      this.audio.toggle();
      this.updateMuteIcons();
    }

    updateMuteIcons() {
      const src = this.audio.muted ? CONFIG.assetPaths.muted : CONFIG.assetPaths.sound;
      this.el.muteIcon.src = src;
      this.el.startMuteIcon.src = src;
      this.el.muteBtn.setAttribute("aria-label", this.audio.muted ? "Geluid aanzetten" : "Geluid dempen");
      this.el.startMuteBtn.setAttribute("aria-label", this.audio.muted ? "Geluid aanzetten" : "Geluid dempen");
      this.el.pauseMuteBtn.textContent = this.audio.muted ? "Geluid aan" : "Geluid uit";
    }

    updateSkinButtons() {
      this.el.skinButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.skin === this.skin);
      });
    }

    renderStartMeta() {
      this.el.startHighscore.textContent = Math.floor(this.highscore);
      this.el.startBestCoins.textContent = Math.floor(this.bestCoins);
      this.achievements.render(this.el.startAchievements, "all");
    }

    loop(time) {
      const dt = Math.min((time - (this.lastFrame || time)) / 1000, 1 / 30);
      this.lastFrame = time;
      this.visualTime += dt;

      if (this.state === "countdown") {
        this.updateCountdown(dt);
      } else if (this.state === "playing") {
        this.update(dt);
      }

      this.render();
      requestAnimationFrame((nextTime) => this.loop(nextTime));
    }

    updateCountdown(dt) {
      this.countdownTimer -= dt;
      let label = "GO!";
      if (this.countdownTimer > 2.35) label = "3";
      else if (this.countdownTimer > 1.35) label = "2";
      else if (this.countdownTimer > 0.35) label = "1";

      if (label !== this.lastCountdownLabel) {
        this.lastCountdownLabel = label;
        this.el.countdownText.textContent = label;
        this.audio.play(label === "GO!" ? "go" : "countdown");
      }

      if (this.countdownTimer <= 0) {
        this.hide(this.el.countdownScreen);
        this.setState("playing");
      }
    }

    currentSpeed() {
      const level = Math.floor(this.elapsed / 15);
      const raw = CONFIG.game.baseSpeed + level * CONFIG.game.speedStep + this.elapsed * CONFIG.game.speedDrift;
      return clamp(raw, CONFIG.game.baseSpeed, CONFIG.game.maxSpeed) * this.scale;
    }

    update(dt) {
      const speed = this.currentSpeed();
      this.elapsed += dt;
      this.distance += speed * dt;
      this.score += speed * dt * 0.075;
      this.hudTimer += dt;

      if (this.elapsed >= 60) this.achievements.unlock("survivor");

      this.activePowerups.magnet = Math.max(0, this.activePowerups.magnet - dt);
      this.activePowerups.feather = Math.max(0, this.activePowerups.feather - dt);
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = 1;
        this.comboTimer = 0;
      }

      this.player.update(dt);
      this.updateClouds(dt);
      this.updateSpawning(dt);

      this.coins.forEach((coin) => coin.update(dt, speed));
      this.powerups.forEach((powerup) => powerup.update(dt, speed));
      this.obstacles.forEach((obstacle) => obstacle.update(dt, speed));
      this.particles.forEach((particle) => particle.update(dt));
      this.floatingTexts.forEach((text) => text.update(dt));

      this.checkCollisions();
      this.cleanupEntities();

      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.hudTimer > 0.08) {
        this.hudTimer = 0;
        this.updateHud(false);
      }
    }

    updateClouds(dt) {
      this.clouds.forEach((cloud) => {
        cloud.x -= cloud.speed * dt;
        const width = 160 * cloud.scale;
        if (cloud.x + width < -20) {
          cloud.x = this.width + rand(20, 160);
          cloud.y = rand(36, Math.max(90, this.height * 0.34));
          cloud.scale = rand(0.46, 0.9);
          cloud.speed = rand(7, 20);
          cloud.img = pick(["cloud1", "cloud2", "cloud3"]);
        }
      });
    }

    updateSpawning(dt) {
      const level = Math.floor(this.elapsed / 15);
      this.obstacleTimer -= dt;
      this.coinTimer -= dt;
      this.powerTimer -= dt;

      if (this.obstacleTimer <= 0) {
        this.spawnObstacle();
        const minGap = clamp(1.35 - level * 0.06, 0.72, 1.35);
        this.obstacleTimer = rand(minGap, minGap + clamp(0.55 - level * 0.025, 0.22, 0.55));
      }

      if (this.coinTimer <= 0) {
        this.spawnCoinPattern();
        this.coinTimer = rand(1.0, 1.55) - Math.min(level * 0.035, 0.24);
      }

      if (this.powerTimer <= 0) {
        this.spawnPowerUp();
        this.powerTimer = rand(12.5, 20);
      }
    }

    spawnObstacle() {
      const level = Math.floor(this.elapsed / 15);
      const pool = level < 1 ? ["crate", "rock", "puddle"] : ["crate", "cactus", "puddle", "rock"];
      this.obstacles.push(new Obstacle(this, pick(pool)));
    }

    spawnCoinPattern() {
      const x = this.width + 48;
      const count = Math.floor(rand(4, 7));
      const gap = 43 * this.scale;
      const level = Math.floor(this.elapsed / 15);
      const minY = Math.max(86, this.height * 0.2);
      const maxY = this.groundY - 126 * this.scale;
      const baseY = clamp(this.groundY - rand(112, level > 2 ? 245 : 205) * this.scale, minY, maxY);
      const pattern = pick(level > 1 ? ["line", "arc", "stair", "cluster"] : ["line", "arc", "cluster"]);

      for (let i = 0; i < count; i += 1) {
        let cx = x + i * gap;
        let cy = baseY;
        if (pattern === "arc") {
          const mid = (count - 1) / 2;
          cy = baseY - (1 - Math.abs(i - mid) / Math.max(mid, 1)) * 58 * this.scale;
        } else if (pattern === "stair") {
          cy = baseY - i * 18 * this.scale;
        } else if (pattern === "cluster") {
          cx = x + (i % 3) * gap * 0.82 + Math.floor(i / 3) * gap * 2.6;
          cy = baseY + (i % 2) * 35 * this.scale;
        }
        this.coins.push(new Coin(this, cx, clamp(cy, minY, this.groundY - 72 * this.scale)));
      }
    }

    spawnPowerUp() {
      const types = this.lives < CONFIG.maxLives
        ? ["magnet", "shield", "heart", "feather", "magnet"]
        : ["magnet", "shield", "feather", "magnet", "shield"];
      this.powerups.push(new PowerUp(this, pick(types)));
    }

    checkCollisions() {
      const playerBox = this.player.collisionBox();

      this.coins.forEach((coin) => {
        if (!coin.dead && rectsOverlap(playerBox, coin.collisionBox())) {
          this.collectCoin(coin);
        }
      });

      this.powerups.forEach((powerup) => {
        if (!powerup.dead && rectsOverlap(playerBox, powerup.collisionBox())) {
          this.collectPowerUp(powerup);
        }
      });

      this.obstacles.forEach((obstacle) => {
        if (!obstacle.dead && !obstacle.hit && rectsOverlap(playerBox, obstacle.collisionBox())) {
          this.hitObstacle(obstacle);
        }
      });
    }

    collectCoin(coin) {
      coin.dead = true;
      const wasCombo = this.comboTimer > 0;
      this.comboMultiplier = wasCombo ? clamp(this.comboMultiplier + 1, 1, CONFIG.game.maxCombo) : 1;
      this.comboTimer = CONFIG.game.comboTimeout;
      this.runCoins += 1;
      const bonus = 10 * this.comboMultiplier;
      this.score += bonus;
      this.audio.play(this.comboMultiplier >= 3 ? "combo" : "coin");
      this.spawnSparkles(coin.x + coin.w / 2, coin.y + coin.h / 2, this.comboMultiplier);
      this.floatingTexts.push(new FloatingText(`+${bonus}`, coin.x + coin.w / 2, coin.y, "#fff176"));

      if (this.comboMultiplier > 1) {
        this.floatingTexts.push(new FloatingText(`COMBO x${this.comboMultiplier}`, coin.x + coin.w / 2, coin.y - 24, "#8ee5ff"));
      }
      if (this.comboMultiplier >= CONFIG.game.maxCombo) this.achievements.unlock("combo");
      if (this.runCoins === 1) this.achievements.unlock("firstCoin");
      if (this.runCoins >= 25) this.achievements.unlock("coinMagnet");
    }

    collectPowerUp(powerup) {
      powerup.dead = true;
      this.audio.play("powerup");
      const x = powerup.x + powerup.w / 2;
      const y = powerup.y + powerup.h / 2;
      this.spawnPowerParticles(x, y, powerup.type);

      if (powerup.type === "magnet") {
        this.activePowerups.magnet = CONFIG.game.magnetDuration;
        this.floatingTexts.push(new FloatingText("MAGNET!", x, y, "#ffb4b4"));
      } else if (powerup.type === "shield") {
        this.activePowerups.shield = true;
        this.floatingTexts.push(new FloatingText("SHIELD!", x, y, "#9be7ff"));
      } else if (powerup.type === "heart") {
        this.lives = clamp(this.lives + 1, 0, CONFIG.maxLives);
        this.floatingTexts.push(new FloatingText("+HART", x, y, "#ff9ab0"));
      } else if (powerup.type === "feather") {
        this.activePowerups.feather = CONFIG.game.featherDuration;
        this.player.usedDoubleJump = false;
        this.floatingTexts.push(new FloatingText("VEER!", x, y, "#9be7ff"));
      }
      this.updateHud(true);
    }

    hitObstacle(obstacle) {
      obstacle.hit = true;
      if (this.player.invulnerable > 0) return;

      if (this.activePowerups.shield) {
        this.activePowerups.shield = false;
        this.audio.play("shield");
        this.shake(8 * this.scale, 0.18);
        this.spawnPowerParticles(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, "shield");
        this.floatingTexts.push(new FloatingText("SHIELD!", obstacle.x + obstacle.w / 2, obstacle.y, "#9be7ff"));
        obstacle.dead = true;
        this.updateHud(true);
        return;
      }

      this.lives -= 1;
      this.player.takeHit();
      this.audio.play("hit");
      this.shake(15 * this.scale, 0.32);
      this.flash();
      this.spawnDebris(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2);
      this.floatingTexts.push(new FloatingText(pick(["AU!", "KWAAK!", "OEI!"]), this.player.x + this.player.w * 0.72, this.player.y, "#ffb4b4"));
      this.updateHud(true);

      if (this.lives <= 0) {
        this.gameOver();
      }
    }

    gameOver() {
      this.setState("gameover");
      this.audio.play("gameover");
      this.hide(this.el.hud);
      this.hide(this.el.countdownScreen);
      this.show(this.el.gameOverScreen);
      this.shake(18 * this.scale, 0.45);

      const finalScore = Math.floor(this.score);
      this.newHighscore = finalScore > this.highscore;
      if (this.newHighscore) {
        this.highscore = finalScore;
        Storage.set(CONFIG.storage.highscore, this.highscore);
        this.achievements.unlock("legend");
      }
      if (this.runCoins > this.bestCoins) {
        this.bestCoins = this.runCoins;
        Storage.set(CONFIG.storage.bestCoins, this.bestCoins);
      }

      this.el.finalScore.textContent = finalScore;
      this.el.finalCoins.textContent = this.runCoins;
      this.el.bestScore.textContent = this.highscore;
      this.el.newHighscoreText.classList.toggle("hidden", !this.newHighscore);
      this.achievements.render(this.el.gameOverAchievements, "run");
      this.renderStartMeta();
    }

    cleanupEntities() {
      this.coins = this.coins.filter((coin) => !coin.dead);
      this.powerups = this.powerups.filter((powerup) => !powerup.dead);
      this.obstacles = this.obstacles.filter((obstacle) => !obstacle.dead);
      this.particles = this.particles.filter((particle) => !particle.dead);
      this.floatingTexts = this.floatingTexts.filter((text) => !text.dead);
    }

    updateHud(force) {
      if (!force && this.state !== "playing") return;
      this.el.scoreText.textContent = Math.floor(this.score);
      this.el.coinText.textContent = this.runCoins;
      this.el.comboText.textContent = `x${this.comboMultiplier}`;
      this.el.speedText.textContent = `${(this.currentSpeed() / (CONFIG.game.baseSpeed * this.scale)).toFixed(1)}x`;
      this.renderHearts();
      this.renderPowerHud();
    }

    renderHearts() {
      this.el.heartHud.innerHTML = "";
      for (let i = 0; i < CONFIG.maxLives; i += 1) {
        const img = document.createElement("img");
        img.src = CONFIG.assetPaths.heart;
        img.alt = i < this.lives ? "vol hart" : "leeg hart";
        if (i >= this.lives) img.className = "is-empty";
        this.el.heartHud.appendChild(img);
      }
    }

    renderPowerHud() {
      this.el.powerHud.innerHTML = "";
      const items = [];
      if (this.activePowerups.magnet > 0) items.push(["magnet", `Magnet ${Math.ceil(this.activePowerups.magnet)}s`]);
      if (this.activePowerups.shield) items.push(["shield", "Shield"]);
      if (this.activePowerups.feather > 0) items.push(["feather", `Veer ${Math.ceil(this.activePowerups.feather)}s`]);

      items.forEach(([type, label]) => {
        const badge = document.createElement("div");
        badge.className = "power-badge";
        const img = document.createElement("img");
        img.src = CONFIG.assetPaths[type];
        img.alt = "";
        const span = document.createElement("span");
        span.textContent = label;
        badge.append(img, span);
        this.el.powerHud.appendChild(badge);
      });
    }

    showToast(message) {
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      this.el.toastRoot.appendChild(toast);
      window.setTimeout(() => toast.remove(), 2300);
    }

    flash() {
      this.el.screenFlash.classList.remove("is-active");
      void this.el.screenFlash.offsetWidth;
      this.el.screenFlash.classList.add("is-active");
    }

    shake(amount, duration) {
      this.shakeAmount = Math.max(this.shakeAmount || 0, amount);
      this.shakeTime = Math.max(this.shakeTime || 0, duration);
    }

    spawnDust(x, y, color, count) {
      for (let i = 0; i < count; i += 1) {
        this.particles.push(new Particle(x + rand(-18, 18) * this.scale, y - 4 * this.scale, {
          vx: rand(-140, 95) * this.scale,
          vy: rand(-135, -35) * this.scale,
          size: rand(3, 7) * this.scale,
          color,
          life: rand(0.28, 0.54),
          gravity: 720 * this.scale
        }));
      }
    }

    spawnSparkles(x, y, multiplier) {
      const count = 7 + multiplier * 2;
      const sparkle = this.assets.get("sparkle");
      for (let i = 0; i < count; i += 1) {
        this.particles.push(new Particle(x, y, {
          vx: rand(-190, 190) * this.scale,
          vy: rand(-230, -50) * this.scale,
          size: rand(3, 8 + multiplier) * this.scale,
          color: pick(["#fff6a8", "#ffd84f", "#ffffff", "#8ee5ff"]),
          image: i % 4 === 0 ? sparkle : null,
          life: rand(0.38, 0.78),
          gravity: 520 * this.scale
        }));
      }
    }

    spawnPowerParticles(x, y, type) {
      const colors = {
        magnet: ["#ef4444", "#ffb4b4", "#fff"],
        shield: ["#59c7ff", "#9be7ff", "#fff"],
        heart: ["#ff4f6d", "#ffb3c0", "#fff"],
        feather: ["#9be7ff", "#ffffff", "#ffd84f"]
      }[type] || ["#ffd84f"];

      for (let i = 0; i < 18; i += 1) {
        this.particles.push(new Particle(x, y, {
          vx: rand(-220, 220) * this.scale,
          vy: rand(-240, 90) * this.scale,
          size: rand(4, 10) * this.scale,
          color: pick(colors),
          life: rand(0.45, 0.9),
          gravity: 360 * this.scale
        }));
      }
    }

    spawnDebris(x, y) {
      for (let i = 0; i < 14; i += 1) {
        this.particles.push(new Particle(x, y, {
          vx: rand(-240, 180) * this.scale,
          vy: rand(-260, -30) * this.scale,
          size: rand(4, 10) * this.scale,
          color: pick(["#8d96a8", "#c47a33", "#ff8d2a", "#fff3b0"]),
          life: rand(0.34, 0.72),
          gravity: 740 * this.scale
        }));
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      this.drawSky(ctx);

      ctx.save();
      if (this.shakeTime > 0) {
        const progress = this.shakeTime / 0.45;
        const amount = this.shakeAmount * clamp(progress, 0.25, 1);
        ctx.translate(rand(-amount, amount), rand(-amount, amount));
      }

      this.drawWorld(ctx);
      this.coins.forEach((coin) => coin.draw(ctx));
      this.powerups.forEach((powerup) => powerup.draw(ctx));
      this.obstacles.forEach((obstacle) => obstacle.draw(ctx));
      this.player.draw(ctx);
      this.particles.forEach((particle) => particle.draw(ctx));
      this.floatingTexts.forEach((text) => text.draw(ctx));
      ctx.restore();
    }

    drawSky(ctx) {
      const cycle = clamp((this.elapsed || 0) / 95, 0, 1);
      const top = mixColor("#67c9ff", "#4a58a8", cycle);
      const bottom = mixColor("#c9f4ff", "#f5a95a", cycle * 0.8);
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      const sun = this.assets.get("sun");
      const moon = this.assets.get("moon");
      const size = 64 * this.scale;
      if (sun) {
        ctx.save();
        ctx.globalAlpha = 1 - cycle;
        ctx.drawImage(sun, this.width * 0.72, 46 + this.height * 0.18 * cycle, size, size);
        ctx.restore();
      }
      if (moon) {
        ctx.save();
        ctx.globalAlpha = cycle;
        ctx.drawImage(moon, this.width * 0.7, 44, size * 0.92, size * 0.92);
        ctx.restore();
      }

      this.clouds.forEach((cloud) => {
        const img = this.assets.get(cloud.img);
        if (!img) return;
        const w = 160 * cloud.scale;
        const h = 72 * cloud.scale;
        ctx.save();
        ctx.globalAlpha = 0.92 - cycle * 0.25;
        ctx.drawImage(img, cloud.x, cloud.y, w, h);
        ctx.restore();
      });
    }

    drawWorld(ctx) {
      this.drawRepeatingLayer(ctx, "hills", this.groundY - 150 * this.scale, 160 * this.scale, 0.16);
      this.drawRepeatingLayer(ctx, "bushes", this.groundY - 78 * this.scale, 100 * this.scale, 0.42);
      this.drawGround(ctx);
    }

    drawRepeatingLayer(ctx, key, y, h, speedFactor) {
      const img = this.assets.get(key);
      if (!img) return;
      const tileW = h * (640 / (key === "hills" ? 180 : 112));
      const offset = (this.distance * speedFactor) % tileW;
      for (let x = -offset - tileW; x < this.width + tileW; x += tileW) {
        ctx.drawImage(img, x, y, tileW, h);
      }
    }

    drawGround(ctx) {
      const y = this.groundY;
      ctx.fillStyle = "#f6c95b";
      ctx.fillRect(0, y, this.width, this.height - y);
      ctx.fillStyle = "#e5a143";
      ctx.fillRect(0, y, this.width, 12 * this.scale);
      ctx.strokeStyle = "#9a632a";
      ctx.lineWidth = 5 * this.scale;
      ctx.beginPath();
      ctx.moveTo(0, y + 3 * this.scale);
      ctx.lineTo(this.width, y + 3 * this.scale);
      ctx.stroke();

      const stripeW = 52 * this.scale;
      const offset = (this.distance * 0.9) % stripeW;
      ctx.fillStyle = "rgba(154, 99, 42, 0.18)";
      for (let x = -offset; x < this.width + stripeW; x += stripeW) {
        ctx.beginPath();
        ctx.ellipse(x, y + 50 * this.scale, 20 * this.scale, 5 * this.scale, -0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    new Game();
  });
})();
