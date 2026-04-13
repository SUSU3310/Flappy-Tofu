// --- 畫布基礎 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 素材管理 ---
let currentChapter = 1;
const bgImg = new Image();
const stoneImages = [new Image(), new Image(), new Image(), new Image()];
let showTitleTimer = 0;

function loadChapterAssets(chapter) {
    const path = `./assets/ch${chapter}/`;
    bgImg.src = `${path}background.png`;
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

function initBird() {
    bird.y = canvas.height / 2;
    bird.gravity = canvas.height * 0.0006;
    bird.lift = canvas.height * -0.012;
    bird.velocity = 0;
}

function resetGame() {
    score = 0;
    currentChapter = 1;
    loadChapterAssets(currentChapter);
    initBird();
    pipes = [];
    frame = 0;
}

function createPipe() {
    const pWidth = 60;
    const minH = 100; 
    const maxH = canvas.height * 0.4; 
    const gap = 180; // 雙石頭模式的間距

    // 隨機決定生成類型：0 為上下同時，1 為中間單個
    const spawnType = Math.random() < 0.5 ? 0 : 1;

    // 輔助函式：根據位置過濾圖片
    // position: 'top', 'bottom', 'middle'
    function getRandomImgFor(position) {
        let pool = [0, 1, 2, 3]; // 代表 stone1, 2, 3, 4
        
        if (position === 'top') {
            // 上方不能出現 stone4 (索引 3)
            pool = pool.filter(index => index !== 3);
        } else if (position === 'bottom') {
            // 下方不能出現 stone2 (索引 1)
            pool = pool.filter(index => index !== 1);
        } else if (position === 'middle') {
            // 中間不能出現 stone2 (索引 1) 和 stone4 (索引 3)
            pool = pool.filter(index => index !== 1 && index !== 3);
        }
        
        const randomIndex = pool[Math.floor(Math.random() * pool.length)];
        return stoneImages[randomIndex];
    }

    if (spawnType === 0) {
        // --- 1. 上下同時有石頭 ---
        const topImg = getRandomImgFor('top');
        const bottomImg = getRandomImgFor('bottom');
        const topH = Math.random() * (maxH - minH) + minH;
        
        // 上方石頭
        pipes.push({
            x: canvas.width, y: 0, width: pWidth, h: topH,
            img: topImg, type: 'top', passed: false
        });

        // 下方石頭
        pipes.push({
            x: canvas.width, y: topH + gap, width: pWidth,
            h: canvas.height - (topH + gap),
            img: bottomImg, type: 'bottom', passed: false
        });

    } else {
        // --- 2. 中間有石頭 ---
        const middleImg = getRandomImgFor('middle');
        const middleH = 150;
        const middleY = Math.random() * (canvas.height - middleH - 200) + 100;

        pipes.push({
            x: canvas.width, y: middleY, width: pWidth, h: middleH,
            img: middleImg, type: 'middle', passed: false
        });
    }
}

// --- 繪製函式集 ---
function drawBackground() {
    const bgScale = canvas.height / bgImg.height;
    const bgScaledWidth = bgImg.width * bgScale;
    const numBgNeeded = Math.ceil(canvas.width / bgScaledWidth) + 1;
    
    if (gameState === 'play') {
        bgOffset -= 1;
        if (bgOffset <= -bgScaledWidth) bgOffset = 0;
    }
    
    for (let i = 0; i < numBgNeeded; i++) {
        ctx.drawImage(bgImg, (i * bgScaledWidth) + bgOffset, 0, bgScaledWidth, canvas.height);
    }
}

function showStartScreen() {
    // 繪製靜止的小鳥
    ctx.fillStyle = "yellow";
    ctx.fillRect(bird.x, canvas.height / 2, bird.width, bird.height);

    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("FLAPPY Tofu", canvas.width / 2, canvas.height / 2 - 50);

    // --- 動態偵測裝置顯示文字 ---
    // 判斷是否為觸控裝置
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
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "24px Arial";
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