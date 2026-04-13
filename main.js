// --- 視窗縮放處理 ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initBird(); // 縮放時重置鳥的位置避免跑版
}
window.addEventListener('resize', resizeCanvas);

// --- 遊戲主循環 ---
function gameLoop() {
    // 檢查資源
    if (!bgImg.complete) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // 清除畫布並繪製背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    if (gameState === 'start') {
        showStartScreen();
    } 
    else if (gameState === 'play') {
        playGameLogic();
    } 
    else if (gameState === 'gameover') {
        showGameOverScreen();
    }

    requestAnimationFrame(gameLoop);
    

    // 在 main.js 的 gameLoop 函式內執行
    const linksUI = document.getElementById('author-links');

    if (gameState === 'start' || gameState === 'gameover') {
        linksUI.style.display = 'flex'; // 暫停/結束畫面時顯示
    } else {
        linksUI.style.display = 'none'; // 遊戲進行中隱藏
    }
}

// --- 遊戲邏輯驅動 ---
function playGameLogic() {
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    
    // 繪製小鳥
    ctx.fillStyle = "yellow";
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);

    if (frame % 90 === 0) createPipe();

    for (let i = pipes.length - 1; i >= 0; i--) {
        let p = pipes[i];
        p.x -= 4;

        // 無論是 type === 'top', 'bottom', 或 'middle'，都用同一種繪製方式
        ctx.drawImage(p.img, p.x, p.y, p.width, p.h);
        // ------------------------------------------------------------------

        if (!p.passed && bird.x > p.x + p.width) {
            p.passed = true;
            score++;
            if (score % 10 === 0) {
                // 這裡被註解掉了，需要切換章節時可以解開
                // currentChapter = (currentChapter % 3) + 1; 
                // loadChapterAssets(currentChapter);
            }
        }

        if (bird.x < p.x + p.width && bird.x + bird.width > p.x &&
            bird.y < p.y + p.h && bird.y + bird.height > p.y) {
            gameState = 'gameover';
        }
        if (p.x + p.width < 0) pipes.splice(i, 1);
    }

    if (bird.y + bird.height > canvas.height || bird.y < 0) gameState = 'gameover';

    drawUI();
    frame++;
}

// --- 控制器整合 ---
const handleAction = () => {
    if (gameState === 'start') {
        gameState = 'play';
    } else if (gameState === 'play') {
        bird.velocity = bird.lift;
    } else if (gameState === 'gameover') {
        resetGame();
        gameState = 'start';
    }
};

window.addEventListener('keydown', (e) => { if (e.code === 'Space') handleAction(); });
window.addEventListener('touchstart', (e) => { e.preventDefault(); handleAction(); }, { passive: false });

// --- 啟動遊戲 ---
resizeCanvas();
loadChapterAssets(1);
gameLoop();