// --- 畫布基礎與素材管理 (保持原樣) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let currentChapter = 1;
let gameSettings = null; // 存放所有的全域設定

const bgImg = new Image();
const stoneImages = [new Image(), new Image(), new Image(), new Image()];
const birdImg = new Image();
birdImg.src = './assets/player.png'; // 請確保路徑正確
let currentStonePool = []; 

function loadChapterAssets() {
    const path = `./assets/ch1/`;
    const bgUrl = `${path}background.png`;
    
    // 背景處理：直接換主背景
    bgImg.src = bgUrl;
    
    const blurBg = document.getElementById('blur-bg');
    if (blurBg) blurBg.style.backgroundImage = `url('${bgUrl}')`;

    // 更新「當前資源池」
    currentStonePool = [];
    for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = `${path}stone${i + 1}.png`;
        // 設定圖片對應的形狀: stone1(0), stone3(2) 為菱形; stone2(1), stone4(3) 為三角形
        const shape = (i === 0 || i === 2) ? 'diamond' : 'triangle';
        currentStonePool.push({ img: img, shape: shape });
    }
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
    // 根據螢幕比例決定小鳥位置
    bird.x = isMobile ? canvas.width * 0.2 : canvas.width * 0.1;
    bird.y = canvas.height / 2;

    // --- 調整小鳥大小與比例 ---
    // 我們設定一個基礎高度，寬度則根據圖片原始比例計算
    const baseHeight = isMobile ? canvas.height * 0.05 : 40; 
    bird.height = baseHeight;
    
    // 如果圖片已載入，依比例設定寬度；否則暫設為與高度相同
    if (birdImg.complete && birdImg.width > 0) {
        const ratio = birdImg.width / birdImg.height;
        bird.width = bird.height * ratio;
    } else {
        bird.width = bird.height * 1.2; // 預設比例
    }

    // 重力與跳躍力 (從設定檔讀取比例，並轉換為實際比例常數)
    const settings = gameSettings[`ch${currentChapter}`];
    const platform = isMobile ? settings.mobile : settings.desktop;

    bird.gravity = canvas.height * (platform.gravityRatio / 10000); // 介面上是5、6，還原為0.0005
    bird.lift = canvas.height * (-platform.liftRatio / 1000); // 介面上是10、12，還原為-0.01
    bird.velocity = 0;
}

function resetGame() {
    score = 0;
    loadChapterAssets();
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    initBird(isMobile);
    pipes = [];
    frame = 0;
    window.nextPipeSpawnFrame = undefined; // 重置水管生成倒數
}

// --- 核心修改：產生水管與碰撞參數 ---
function createPipe() {
    const settings = gameSettings[`ch${currentChapter}`];
    const platform = window.innerWidth < 768 || ('ontouchstart' in window) ? settings.mobile : settings.desktop;

    const pWidth = canvas.height * (settings.pipeWidthRatio / 100); 
    const minH = canvas.height * (settings.pipeMinHeightRatio / 100); 
    const maxH = canvas.height * (settings.pipeMaxHeightRatio / 100); 
    const gap = canvas.height * (platform.pipeGapRatio / 100); 
    
    // 設定一個足夠在畫面外的生成點 (避免圖片寬度超過 hitbox 導致憑空飛入)
    const startX = canvas.width + canvas.height * 0.3;

    const spawnType = Math.random() < 0.5 ? 0 : 1;

    // 內部輔助函式：根據位置從「當前的池子」選圖
    function getImgFromPool(position) {
        if (currentStonePool.length === 0) return null; // 防止池子還沒準備好

        let indices = [0, 1, 2, 3];
        if (position === 'top') indices = indices.filter(i => i !== 3);
        else if (position === 'bottom') indices = indices.filter(i => i !== 1);
        else if (position === 'middle') indices = indices.filter(i => i !== 1 && i !== 3);
        
        const idx = indices[Math.floor(Math.random() * indices.length)];
        return currentStonePool[idx]; // 回傳圖片物件的「引用」
    }

    if (spawnType === 0) {
        const topH = Math.random() * (maxH - minH) + minH;
        const bottomH = canvas.height - (topH + gap);
        
        // 抓取當下的圖片物件
        const tImg = getImgFromPool('top');
        const bImg = getImgFromPool('bottom');

        // 上石頭
        pipes.push({
            x: startX, y: 0, width: pWidth, h: topH,
            img: tImg.img, // 綁定圖片
            shape: tImg.shape, // 綁定碰撞形狀
            type: 'top', passed: false,
            hitW: pWidth, hitH: topH // 碰撞直接根據圖片原始繪製區域來產生多邊形
        });

        // 下石頭
        pipes.push({
            x: startX, y: topH + gap, width: pWidth, h: bottomH,
            img: bImg.img, // 綁定圖片
            shape: bImg.shape, // 綁定碰撞形狀
            type: 'bottom', passed: false,
            hitW: pWidth, hitH: bottomH
        });
    } else {
        // 中間石頭
        const mImgObj = getImgFromPool('middle');
        const middleH = canvas.height * (settings.middlePipeHeightRatio / 100); 
        const middleY = Math.random() * (canvas.height - middleH - (canvas.height * 0.2)) + (canvas.height * 0.1);

        pipes.push({
            x: startX, y: middleY, width: pWidth, h: middleH,
            img: mImgObj.img, // 綁定圖片
            shape: mImgObj.shape, // 綁定碰撞形狀
            type: 'middle', passed: false,
            hitW: pWidth, hitH: middleH
        });
    }
}

// --- 背景與 UI 繪製  ---
function drawBackground() {
    const bgScale = canvas.height / bgImg.height;
    const bgScaledWidth = bgImg.width * bgScale;
    
    if (gameState === 'play') {
        const settings = gameSettings[`ch${currentChapter}`];
        bgOffset -= (settings.bgSpeed / 10); 
        if (bgOffset <= -bgScaledWidth) {
            bgOffset = 0;
        }
    }
    
    // 繪製邏輯
    const numBgNeeded = Math.ceil(canvas.width / bgScaledWidth) + 1;
    for (let i = 0; i < numBgNeeded; i++) {
        ctx.drawImage(bgImg, (i * bgScaledWidth) + bgOffset, 0, bgScaledWidth, canvas.height);
    }
}

function showStartScreen() {
    if (birdImg.complete && birdImg.width > 0) {
        ctx.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
    } else {
        ctx.fillStyle = "yellow";
        ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    }

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
}