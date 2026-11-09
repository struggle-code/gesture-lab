const canvas = document.querySelector("#particleCanvas");
const ctx = canvas.getContext("2d");
const stage = document.querySelector("#stage");
const video = document.querySelector("#video");
const cameraButton = document.querySelector("#cameraButton");
const resetButton = document.querySelector("#resetButton");
const stageMessage = document.querySelector("#stageMessage");
const connectionLabel = document.querySelector("#connectionLabel");
const gestureLabel = document.querySelector("#gestureLabel");
const telemetryGesture = document.querySelector("#telemetryGesture");
const trackingValue = document.querySelector("#trackingValue");
const trackingMeter = document.querySelector("#trackingMeter");
const particleValue = document.querySelector("#particleValue");
const particleMeter = document.querySelector("#particleMeter");
const coordinateLabel = document.querySelector("#coordinateLabel");
const fpsLabel = document.querySelector("#fpsLabel");

let particles = [];
let pointer = { x: 0.5, y: 0.5, active: false };
let currentGesture = "等待手势";
let camera = null;
let lastFrame = performance.now();
let frames = 0;
let fps = 60;

const colors = ["#c8ff6a", "#67e8f9", "#d9e7ff", "#83a8ff"];

function resize() {
  const rect = stage.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

function spawn(x, y, amount = 5, burst = false) {
  const rect = stage.getBoundingClientRect();
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = burst ? Math.random() * 4 + 1 : Math.random() * 1.3 + .2;
    particles.push({
      x: x * rect.width, y: y * rect.height,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, size: Math.random() * 2.8 + 1, color: colors[Math.floor(Math.random() * colors.length)]
    });
  }
  if (particles.length > 700) particles.splice(0, particles.length - 700);
}

function draw() {
  const rect = stage.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (pointer.active) {
    const glow = ctx.createRadialGradient(pointer.x * rect.width, pointer.y * rect.height, 0, pointer.x * rect.width, pointer.y * rect.height, 100);
    glow.addColorStop(0, "rgba(200,255,106,.16)"); glow.addColorStop(1, "rgba(200,255,106,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, rect.width, rect.height);
    spawn(pointer.x, pointer.y, currentGesture === "张开手掌" ? 5 : 2);
  }
  particles.forEach((p) => {
    p.x += p.vx; p.y += p.vy; p.vx *= .985; p.vy *= .985; p.life -= .008;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color; ctx.shadowBlur = 12; ctx.shadowColor = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  particles = particles.filter((p) => p.life > 0);
  particleValue.textContent = String(particles.length).padStart(3, "0");
  particleMeter.style.width = `${Math.min(100, particles.length / 7)}%`;
  requestAnimationFrame(draw);
}
draw();

stage.addEventListener("pointermove", (event) => {
  const rect = stage.getBoundingClientRect();
  pointer = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, active: true };
  coordinateLabel.textContent = `X ${String(Math.round(pointer.x * 999)).padStart(3, "0")} / Y ${String(Math.round(pointer.y * 999)).padStart(3, "0")}`;
  if (!camera) setGesture("鼠标绘制");
});
stage.addEventListener("pointerleave", () => { if (!camera) pointer.active = false; });
resetButton.addEventListener("click", () => { particles = []; pointer.active = false; setGesture("等待手势"); });

function setGesture(label) {
  currentGesture = label;
  gestureLabel.textContent = label;
  telemetryGesture.textContent = label === "等待手势" ? "—" : label;
}

function onResults(results) {
  if (!results.multiHandLandmarks?.length) {
    pointer.active = false; setGesture("未检测到"); return;
  }
  const hand = results.multiHandLandmarks[0];
  const tip = hand[8];
  pointer = { x: 1 - tip.x, y: tip.y, active: true };
  coordinateLabel.textContent = `X ${String(Math.round(pointer.x * 999)).padStart(3, "0")} / Y ${String(Math.round(pointer.y * 999)).padStart(3, "0")}`;
  const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]].filter(([tipIndex, pipIndex]) => hand[tipIndex].y < hand[pipIndex].y).length;
  const isThumbOpen = Math.abs(hand[4].x - hand[2].x) > .08;
  if (fingers >= 3 && isThumbOpen) setGesture("张开手掌");
  else if (fingers === 0 && !isThumbOpen) setGesture("握紧拳头");
  else setGesture("移动食指");
  trackingValue.textContent = "ONLINE";
  trackingMeter.style.width = "96%";
}

async function startCamera() {
  if (!window.Hands || !window.Camera) {
    connectionLabel.textContent = "加载失败";
    setGesture("鼠标绘制");
    return;
  }
  try {
    const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: .65, minTrackingConfidence: .6 });
    hands.onResults(onResults);
    camera = new Camera(video, { onFrame: async () => hands.send({ image: video }), width: 640, height: 480 });
    await camera.start();
    stage.classList.add("active");
    cameraButton.innerHTML = '<span class="button-icon">◉</span> 摄像头已开启';
    connectionLabel.textContent = "摄像头已连接";
    trackingValue.textContent = "SEARCHING";
    stageMessage.style.opacity = "0";
  } catch (error) {
    console.error(error);
    connectionLabel.textContent = "权限未开启";
    setGesture("鼠标绘制");
  }
}
cameraButton.addEventListener("click", startCamera);

setInterval(() => {
  fps = Math.round(frames * 1000 / Math.max(1, performance.now() - lastFrame));
  frames = 0; lastFrame = performance.now(); fpsLabel.textContent = `${Math.min(60, fps)} FPS`;
}, 1000);
setInterval(() => { frames += 1; }, 16);
