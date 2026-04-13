// --- 畫布基礎與素材管理 (保持原樣) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let currentChapter = 1;
const bgImg = new Image();
const stoneImages = [new Image(), new Image(), new Image(), new Image()];
let showTitleTimer = 0;

function loadChapterAssets(chapter) {
    const path = `./assets/ch${chapter}/`;
    const bgUrl = `${path}background.png`;
    bgImg.src = bgUrl;
    const blurBg = document.getElementById('blur-bg');
    if (blurBg) blurBg.style.backgroundImage = `url('${bgUrl}')`;
    for (let i = 0; i < 4; i++) {
        stoneImages[i].src = `${path}stone${i + 1}.png`;
    }
    showTitleTimer = 100; 
}

// --- 遊戲變數 ---
let gameState = 'start'; 
let score = 0;
let bird = { x: 50, y: 0, width: 40, height: 30, gravity: 0, lift: 0, velocity: 0 };
let pipes = [];
let frame = 0;
let bgOffset = 0;

// --- 初始化小鳥 ---
function initBird(isMobile = false) {
    bird.x = isMobile ? canvas.width * 0.2 : canvas.width * 0.1;
    bird.y = canvas.height / 2;
    bird.width = 40;
    bird.height = 30;
    if (isMobile) {
        bird.gravity = canvas.height * 0.0005; 
        bird.lift = canvas.height * -0.01;
    } else {
        bird.gravity = canvas.height * 0.0006;
        bird.lift = canvas.height * -0.012;
    }
    bird.velocity = 0;
}

function resetGame() {
    score = 0;
    currentChapter = 1;
    loadChapterAssets(currentChapter);
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    initBird(isMobile);
    pipes = [];
    frame = 0;
}

// --- 核心修改：產生水管與碰撞參數 ---
function createPipe() {
    const pWidth = canvas.height * 0.08; 
    const minH = canvas.height * 0.1; 
    const maxH = canvas.height * 0.4; 
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    const gap = isMobile ? canvas.height * 0.22 : canvas.height * 0.25; 

    const spawnType = Math.random() < 0.5 ? 0 : 1;

    function getRandomImgFor(position) {
        let pool = [0, 1, 2, 3];
        if (position === 'top') pool = pool.filter(index => index !== 3);
        else if (position === 'bottom') pool = pool.filter(index => index !== 1);
        else if (position === 'middle') pool = pool.filter(index => index !== 1 && index !== 3);
        return stoneImages[pool[Math.floor(Math.random() * pool.length)]];
    }

    if (spawnType === 0) {
        // --- 上下石頭模式 ---
        const topImg = getRandomImgFor('top');
        const bottomImg = getRandomImgFor('bottom');
        const topH = Math.random() * (maxH - minH) + minH;
        
        // 上石頭
        pipes.push({
            x: canvas.width, y: 0, width: pWidth, h: topH,
            img: topImg, type: 'top', passed: false,
            hitW: pWidth * 0.6, // 碰撞框寬度縮小
            hitH: topH * 0.8    // 尖端判定縮小
        });

        // 下石頭
        const bottomH = canvas.height - (topH + gap);
        pipes.push({
            x: canvas.width, y: topH + gap, width: pWidth, h: bottomH,
            img: bottomImg, type: 'bottom', passed: false,
            hitW: pWidth * 0.6,
            hitH: bottomH * 0.8,
            hitYOffset: bottomH * 0.2 // 從底部往上移 20%
        });
    } else {
        // --- 中間石頭模式 ---
        const middleImg = getRandomImgFor('middle');
        const middleH = canvas.height * 0.2; 
        const middleY = Math.random() * (canvas.height - middleH - (canvas.height * 0.2)) + (canvas.height * 0.1);

        pipes.push({
            x: canvas.width, y: middleY, width: pWidth, h: middleH,
            img: middleImg, type: 'middle', passed: false,
            hitW: pWidth * 0.7, // 中間石頭通常比較圓，縮小一點點即可
            hitH: middleH * 0.7
        });
    }
}

// --- 背景與 UI 繪製 (保持原樣) ---
function drawBackground() {
    const bgScale = canvas.height / bgImg.height;
    const bgScaledWidth = bgImg.width * bgScale;
    const numBgNeeded = Math.ceil(canvas.width / bgScaledWidth) + 1;
    if (gameState === 'play') {
        bgOffset -= 1.5; 
        if (bgOffset <= -bgScaledWidth) bgOffset = 0;
    }
    for (let i = 0; i < numBgNeeded; i++) {
        ctx.drawImage(bgImg, (i * bgScaledWidth) + bgOffset, 0, bgScaledWidth, canvas.height);
    }
}

function showStartScreen() {
    ctx.fillStyle = "yellow";
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("FLAPPY TOFU", canvas.width / 2, canvas.height / 2 - 50);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const startText = isTouchDevice ? "點擊畫面開始遊戲" : "按下 [空白鍵] 開始遊戲";
    ctx.font = "20px Arial";
    ctx.fillText(startText, canvas.width / 2, canvas.height / 2 + 50);
}

function showGameOverScreen() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const restartText = isTouchDevice ? "點擊畫面再次挑戰" : "按下 [空白鍵] 再次挑戰";
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "20px Arial";
    ctx.fillText(`得分: ${score}`, canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillText(restartText, canvas.width / 2, canvas.height / 2 + 80);
}

function drawUI() {
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "left";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "black";
    ctx.fillText(`Score: ${score}`, 20, 40);
    ctx.shadowBlur = 0;

    if (showTitleTimer > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${showTitleTimer / 100})`;
        ctx.font = "bold 40px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`Chapter ${currentChapter}`, canvas.width / 2, canvas.height / 2);
        showTitleTimer--;
    }
}