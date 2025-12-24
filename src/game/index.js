const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best-score");
const distanceEl = document.getElementById("distance");
const promptEl = document.getElementById("prompt");

function loadBestScore() {
  const value = Number(localStorage.getItem("santa-best"));
  return Number.isFinite(value) ? value : 0;
}

const STATE = {
  READY: "READY",
  PLAYING: "PLAYING",
  GAME_OVER: "GAME_OVER",
};

const world = {
  stars: [],
  terrain: [],
  obstacles: [],
  state: STATE.READY,
  lastTime: 0,
  scrollSpeed: 240,
  baseGround: 0,
  distance: 0,
  score: 0,
  best: loadBestScore(),
  spawnTimer: 0,
  spawnInterval: 1.7,
  elapsed: 0,
  skyShift: 0,
};

const santa = {
  x: 180,
  y: 0,
  width: 52,
  height: 72,
  vy: 0,
  gravity: 1600,
  jumpForce: 650,
  isJumping: false,
  isDucking: false,
  onGround: false,
  frame: 0,
  frameTimer: 0,
};

const colors = {
  sky: "#0c132b",
  skyline: "#101936",
  skylineDeep: "#0a1024",
  snow: "#dbe8ff",
  santa: "#e54b4b",
  santaTrim: "#ffffff",
  boots: "#1c1f2f",
};

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const { clientWidth } = canvas;
  const height = Math.round(clientWidth * (9 / 16));
  canvas.width = clientWidth * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  world.baseGround = height - 120;
  // Recreate stars for crispness after resize
  world.stars = createStars(80, clientWidth, height);
}

function createStars(count, w, h) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.5,
      size: Math.random() * 2 + 1,
      drift: Math.random() * 0.2 + 0.05,
      twinkle: Math.random() * 0.6 + 0.4,
    });
  }
  return stars;
}

function setupTerrain() {
  world.terrain = [];
  const width = canvas.clientWidth;
  const start = {
    x: 0,
    width: width,
    height: 0,
  };
  world.terrain.push(start);
  while (coverage() < width + 200) {
    appendSegment();
  }
  santa.y = world.baseGround - santa.height;
}

function coverage() {
  return world.terrain.reduce((acc, seg) => acc + seg.width, 0);
}

function generateSegment(prev) {
  const width = 160 + Math.random() * 140;
  const heightChange = Math.random() * 90 - 45; // rooftops up/down
  const gap = Math.random() * 70;
  const height = clamp(prev.height + heightChange, -60, 90);
  return {
    x: prev.x + prev.width + gap,
    width,
    height,
  };
}

function appendSegment() {
  const last = world.terrain[world.terrain.length - 1];
  world.terrain.push(generateSegment(last));
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function handleInputStart(isDuck) {
  if (world.state === STATE.READY) {
    startGame();
  }
  if (world.state === STATE.GAME_OVER) {
    resetGame();
    startGame();
  }
  if (isDuck) {
    santa.isDucking = true;
    santa.height = 52;
    const groundY = groundAt(santa.x + santa.width / 2);
    santa.y = groundY - santa.height;
  } else if (santa.onGround) {
    santa.vy = -santa.jumpForce;
    santa.onGround = false;
    santa.isJumping = true;
    playJump();
  }
}

function handleInputEnd() {
  santa.isDucking = false;
  santa.height = santa.isJumping ? 58 : 72;
  if (santa.onGround) {
    const groundY = groundAt(santa.x + santa.width / 2);
    santa.y = groundY - santa.height;
  }
}

function setupInput() {
  window.addEventListener("keydown", (e) => {
    if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
      e.preventDefault();
      handleInputStart(false);
    }
    if (["ArrowDown", "KeyS"].includes(e.code)) {
      e.preventDefault();
      handleInputStart(true);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (["ArrowDown", "KeyS"].includes(e.code)) {
      handleInputEnd();
    }
  });

  canvas.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const y = touch.clientY - rect.top;
    const isDuck = y > rect.height * 0.65;
    handleInputStart(isDuck);
    if (isDuck) {
      santa.touchDuck = true;
    }
  });

  canvas.addEventListener("touchend", () => {
    if (santa.touchDuck) {
      santa.touchDuck = false;
      handleInputEnd();
    }
  });
}

function startGame() {
  world.state = STATE.PLAYING;
  world.lastTime = performance.now();
  world.elapsed = 0;
  promptEl.textContent = "Leap over chimneys and antennas!";
}

function resetGame() {
  world.obstacles = [];
  world.state = STATE.READY;
  world.distance = 0;
  world.score = 0;
  world.elapsed = 0;
  world.spawnInterval = 1.7;
  world.spawnTimer = 0;
  world.terrain = [];
  setupTerrain();
  santa.vy = 0;
  santa.isJumping = false;
  santa.isDucking = false;
  santa.onGround = true;
  santa.height = 72;
  promptEl.textContent = "Tap or press Space to start";
}

function update(time) {
  const delta = Math.min((time - world.lastTime) / 1000, 0.033);
  world.lastTime = time;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawBackground(delta);

  if (world.state === STATE.PLAYING) {
    updateTerrain(delta);
    updateSanta(delta);
    updateObstacles(delta);
    updateScore(delta);
    drawTerrain();
    drawObstacles();
    drawSanta();
  } else {
    drawTerrain();
    drawSanta();
    drawObstacles();
  }

  updateHud();
  requestAnimationFrame(update);
}

function drawBackground(delta) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#0c1536");
  gradient.addColorStop(1, "#060917");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  world.skyShift = (world.skyShift + delta * 4) % w;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#ffffff";
  for (const star of world.stars) {
    star.x = (star.x - star.drift * delta * 40 + w) % w;
    const x = (star.x - world.skyShift * star.twinkle + w) % w;
    ctx.globalAlpha = 0.4 + star.twinkle * 0.6;
    ctx.fillRect(x, star.y, star.size, star.size);
  }
  ctx.restore();

  // Parallax skyline
  ctx.fillStyle = colors.skylineDeep;
  ctx.fillRect(0, h - 220, w, 220);
  ctx.fillStyle = colors.skyline;
  ctx.fillRect(0, h - 180, w, 180);
}

function updateTerrain(delta) {
  const speed = world.scrollSpeed + world.elapsed * 12;
  world.distance += speed * delta * 0.1;
  for (const seg of world.terrain) {
    seg.x -= speed * delta;
  }
  while (world.terrain.length && world.terrain[0].x + world.terrain[0].width < -180) {
    world.terrain.shift();
  }
  while (lastSegmentEnd() < canvas.clientWidth + 220) {
    appendSegment();
  }
  drawTerrain();
}

function lastSegmentEnd() {
  const last = world.terrain[world.terrain.length - 1];
  return last.x + last.width;
}

function drawTerrain() {
  ctx.strokeStyle = colors.snow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  world.terrain.forEach((seg, idx) => {
    const y = getGroundYFromHeight(seg.height);
    const xStart = seg.x;
    const xEnd = seg.x + seg.width;
    if (idx === 0) {
      ctx.moveTo(xStart, y);
    }
    ctx.lineTo(xEnd, y);
  });
  ctx.stroke();

  // Snow drift accent
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  world.terrain.forEach((seg, idx) => {
    const y = getGroundYFromHeight(seg.height) + 6;
    const xStart = seg.x;
    const xEnd = seg.x + seg.width;
    if (idx === 0) ctx.moveTo(xStart, y);
    ctx.lineTo(xEnd, y);
  });
  ctx.stroke();
}

function getGroundYFromHeight(height) {
  const base = world.baseGround;
  return clamp(base - height, 180, canvas.clientHeight - 40);
}

function groundAt(xPos) {
  for (const seg of world.terrain) {
    if (xPos >= seg.x && xPos <= seg.x + seg.width) {
      return getGroundYFromHeight(seg.height);
    }
  }
  const last = world.terrain[world.terrain.length - 1];
  return getGroundYFromHeight(last.height);
}

function updateSanta(delta) {
  const groundY = groundAt(santa.x + santa.width / 2);
  santa.vy += santa.gravity * delta;
  santa.y += santa.vy * delta;

  if (santa.y + santa.height >= groundY) {
    santa.y = groundY - santa.height;
    santa.vy = 0;
    santa.onGround = true;
    santa.isJumping = false;
  } else {
    santa.onGround = false;
  }

  santa.frameTimer += delta;
  const frameSpeed = santa.isDucking ? 0.08 : 0.12;
  if (santa.frameTimer >= frameSpeed) {
    santa.frame = (santa.frame + 1) % 4;
    santa.frameTimer = 0;
  }
}

function drawSanta() {
  ctx.save();
  ctx.translate(santa.x, santa.y);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(
    santa.width / 2,
    santa.height + 8,
    santa.width / 2,
    10,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const runOffset = santa.onGround ? Math.sin(santa.frame * 0.8) * 3 : 0;

  // Legs
  ctx.fillStyle = colors.boots;
  ctx.fillRect(8, santa.height - 18 + runOffset, 12, 18);
  ctx.fillRect(28, santa.height - 14 - runOffset, 12, 18);

  // Body
  const bodyHeight = santa.isDucking ? 38 : 48;
  ctx.fillStyle = colors.santa;
  ctx.fillRect(6, santa.height - 18 - bodyHeight, 40, bodyHeight);

  // Belt
  ctx.fillStyle = "#11131f";
  ctx.fillRect(6, santa.height - 30 - bodyHeight + 12, 40, 6);
  ctx.fillStyle = "#f5d76e";
  ctx.fillRect(22, santa.height - 32 - bodyHeight + 12, 8, 8);

  // Head
  ctx.fillStyle = colors.santa;
  ctx.fillRect(12, santa.height - bodyHeight - 42, 32, 28);
  ctx.fillStyle = colors.santaTrim;
  ctx.fillRect(10, santa.height - bodyHeight - 26, 36, 8);

  // Hat
  ctx.fillStyle = colors.santa;
  ctx.fillRect(12, santa.height - bodyHeight - 50, 28, 14);
  ctx.beginPath();
  ctx.moveTo(12, santa.height - bodyHeight - 50);
  ctx.lineTo(36, santa.height - bodyHeight - 64);
  ctx.lineTo(40, santa.height - bodyHeight - 50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.santaTrim;
  ctx.beginPath();
  ctx.arc(36, santa.height - bodyHeight - 64, 6, 0, Math.PI * 2);
  ctx.fill();

  // Beard
  ctx.fillStyle = colors.santaTrim;
  ctx.beginPath();
  ctx.moveTo(16, santa.height - bodyHeight - 18);
  ctx.lineTo(42, santa.height - bodyHeight - 18);
  ctx.lineTo(34, santa.height - bodyHeight - 6);
  ctx.lineTo(24, santa.height - bodyHeight - 6);
  ctx.closePath();
  ctx.fill();

  // Arms
  ctx.fillStyle = colors.santa;
  const armSwing = santa.onGround ? Math.sin(santa.frame * 0.8) * 8 : 2;
  ctx.fillRect(0, santa.height - bodyHeight - 12 + armSwing, 10, 22);
  ctx.fillRect(44, santa.height - bodyHeight - 22 - armSwing, 10, 22);
  ctx.fillStyle = colors.santaTrim;
  ctx.fillRect(0, santa.height - bodyHeight - 4 + armSwing, 10, 6);
  ctx.fillRect(44, santa.height - bodyHeight - 14 - armSwing, 10, 6);

  ctx.restore();
}

function obstacleTemplate(type, x, groundY) {
  const base = {
    x,
    vx: 0,
    type,
  };
  if (type === "chimney") {
    return {
      ...base,
      width: 46,
      height: 68,
      y: groundY - 68,
      color: "#b8403d",
    };
  }
  if (type === "antenna") {
    return {
      ...base,
      width: 24,
      height: 84,
      y: groundY - 84,
      color: "#9fb2d3",
    };
  }
  return {
    ...base,
    width: 60,
    height: 18,
    y: groundY - 18,
    color: "#cde6ff",
  };
}

function spawnObstacle() {
  const options = ["chimney", "antenna", "ice"];
  const type = options[Math.floor(Math.random() * options.length)];
  const targetX = canvas.clientWidth + 40;
  const groundY = groundAt(targetX + 80);
  world.obstacles.push(obstacleTemplate(type, targetX, groundY));
}

function updateObstacles(delta) {
  world.spawnTimer += delta;
  if (world.spawnTimer > world.spawnInterval) {
    spawnObstacle();
    world.spawnTimer = 0;
    world.spawnInterval = clamp(world.spawnInterval * 0.98, 0.65, 2);
  }

  const speed = world.scrollSpeed + world.elapsed * 12;
  world.obstacles.forEach((obs) => {
    obs.x -= speed * delta;
  });

  world.obstacles = world.obstacles.filter((obs) => obs.x + obs.width > -80);
  checkCollisions();
}

function drawObstacles() {
  for (const obs of world.obstacles) {
    ctx.fillStyle = obs.color;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    if (obs.type === "chimney") {
      ctx.fillStyle = "#f7f3ef";
      ctx.fillRect(obs.x, obs.y, obs.width, 12);
    }
    if (obs.type === "antenna") {
      ctx.strokeStyle = "#6c88b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width / 2, obs.y + obs.height - 10);
      ctx.lineTo(obs.x, obs.y + obs.height);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function checkCollisions() {
  const box = {
    x: santa.x + 8,
    y: santa.y + 6,
    width: santa.width - 16,
    height: santa.height - 12,
  };
  for (const obs of world.obstacles) {
    if (
      box.x < obs.x + obs.width &&
      box.x + box.width > obs.x &&
      box.y < obs.y + obs.height &&
      box.y + box.height > obs.y
    ) {
      handleCollision();
      break;
    }
  }
}

function handleCollision() {
  if (world.state !== STATE.PLAYING) return;
  playCollision();
  world.state = STATE.GAME_OVER;
  promptEl.textContent = "Santa slipped! Space/Tap to restart";
}

function updateScore(delta) {
  world.elapsed += delta;
  world.score = Math.floor(world.elapsed * 10 + world.distance);
  if (world.score > world.best) {
    world.best = world.score;
    localStorage.setItem("santa-best", world.best);
  }
}

function updateHud() {
  scoreEl.textContent = world.score.toString();
  bestEl.textContent = world.best.toString();
  distanceEl.textContent = `${Math.floor(world.distance)} m`;
}

// Simple SFX hooks
let audioCtx;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, gain = 0.08) {
  const ctxAudio = getAudioCtx();
  const osc = ctxAudio.createOscillator();
  const g = ctxAudio.createGain();
  osc.frequency.value = freq;
  osc.type = "triangle";
  osc.connect(g);
  g.connect(ctxAudio.destination);
  const now = ctxAudio.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

function playJump() {
  playTone(520, 0.15, 0.12);
}

function playCollision() {
  playTone(180, 0.4, 0.15);
}

function init() {
  resizeCanvas();
  setupTerrain();
  setupInput();
  updateHud();
  promptEl.textContent = "Tap or press Space to start";
  requestAnimationFrame((time) => {
    world.lastTime = time;
    update(time);
  });
}

window.addEventListener("resize", () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  resizeCanvas();
  setupTerrain();
});

init();
