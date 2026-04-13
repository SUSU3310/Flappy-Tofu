// --- 畫布基礎 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 素材管理 ---
let currentChapter = 1;
const bgImg = new Image();
const stoneImages = [new Image(), new Image(), new Image(), new Image()];
let showTitleTimer = 0;

// game.js 中的 loadChapterAssets

function loadChapterAssets(chapter) {
    const path = `./assets/ch${chapter}/`;
    const bgUrl = `${path}background.png`;
    
    bgImg.src = bgUrl;
    
    // 同步更新 HTML 中的模糊背景
    const blurBg = document.getElementById('blur-bg');
    if (blurBg) {
        blurBg.style.backgroundImage = `url('${bgUrl}')`;
    }

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

// game.js

function initBird(isMobile = false) {
    // 如果是手機(直屏)，讓小鳥離左邊緣遠一點，通常 20% 是比較舒服的反應距離
    // 如果是電腦(橫屏)，則維持固定位置或 10%
    bird.x = isMobile ? canvas.width * 0.2 : canvas.width * 0.1;
    
    bird.y = canvas.height / 2;
    bird.width = 40;
    bird.height = 30;

    if (isMobile) {
        // 手機高度對齊後，垂直空間很大，重力感要稍微輕一點
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
    
    // 重新呼叫時也判斷一次裝置
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    initBird(isMobile);
    
    pipes = [];
    frame = 0;
}

function createPipe() {
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    const pWidth = 80;
    const minH = 100; 
    const maxH = canvas.height * 0.4; 
    
    // 手機版 gap 給大一點點，增加通過率
    const gap = isMobile ? canvas.height * 0.22 : 180; 

    const spawnType = Math.random() < 0.5 ? 0 : 1;

    function getRandomImgFor(position) {
        let pool = [0, 1, 2, 3];
        if (position === 'top') {
            pool = pool.filter(index => index !== 3);
        } else if (position === 'bottom') {
            pool = pool.filter(index => index !== 1);
        } else if (position === 'middle') {
            pool = pool.filter(index => index !== 1 && index !== 3);
        }
        const randomIndex = pool[Math.floor(Math.random() * pool.length)];
        return stoneImages[randomIndex];
    }

    if (spawnType === 0) {
        const topImg = getRandomImgFor('top');
        const bottomImg = getRandomImgFor('bottom');
        const topH = Math.random() * (maxH - minH) + minH;
        
        pipes.push({
            x: canvas.width, y: 0, width: pWidth, h: topH,
            img: topImg, type: 'top', passed: false
        });

        pipes.push({
            x: canvas.width, y: topH + gap, width: pWidth,
            h: canvas.height - (topH + gap),
            img: bottomImg, type: 'bottom', passed: false
        });
    } else {
        const middleImg = getRandomImgFor('middle');
        const middleH = 150;
        // 確保中間石頭不會太靠邊緣
        const middleY = Math.random() * (canvas.height - middleH - 200) + 100;

        pipes.push({
            x: canvas.width, y: middleY, width: pWidth, h: middleH,
            img: middleImg, type: 'middle', passed: false
        });
    }
}

// 修改背景繪製邏輯，確保背景圖也能跟著放大對齊
function drawBackground() {
    // 以高度為基準縮放
    const bgScale = canvas.height / bgImg.height;
    const bgScaledWidth = bgImg.width * bgScale;
    
    // 計算需要幾張圖才能填滿寬度（直屏通常 1-2 張就夠，但電腦版需要多張）
    const numBgNeeded = Math.ceil(canvas.width / bgScaledWidth) + 1;
    
    if (gameState === 'play') {
        bgOffset -= 1.5; 
        if (bgOffset <= -bgScaledWidth) bgOffset = 0;
    }
    
    for (let i = 0; i < numBgNeeded; i++) {
        ctx.drawImage(bgImg, (i * bgScaledWidth) + bgOffset, 0, bgScaledWidth, canvas.height);
    }
}

// ... showStartScreen, showGameOverScreen, drawUI 保持原樣 ...
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