// --- 視窗縮放處理 ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // 判斷是否為手機 (寬度小於 768px 或 具有觸控功能)
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);

    // 傳送裝置資訊給 initBird，讓 game.js 決定小鳥的物理數值
    if (typeof initBird === 'function') {
        initBird(isMobile); 
    }
}

// 監聽各種縮放與轉向事件
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 200); // 延遲一下確保寬高已更新
});
window.addEventListener('load', resizeCanvas);

// --- 遊戲主循環 ---
function gameLoop() {
    if (!bgImg.complete) {
        requestAnimationFrame(gameLoop);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    // 連結 UI 的顯示控制
    const linksUI = document.getElementById('author-links');
    if (linksUI) {
        if (gameState === 'start' || gameState === 'gameover') {
            linksUI.style.display = 'flex';
        } else {
            linksUI.style.display = 'none';
        }
    }

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
}

// --- 遊戲邏輯驅動 ---
function playGameLogic() {
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    
    // 繪製小鳥 (這裡可以保留你的黃色方塊或改為圖片)
    ctx.fillStyle = "yellow";
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);

    // 水管生成速度，如果是手機版也可以考慮稍微放慢 (例如 100)
    if (frame % 90 === 0) createPipe();

    for (let i = pipes.length - 1; i >= 0; i--) {
        let p = pipes[i];
        p.x -= 4; // 移動速度

        ctx.drawImage(p.img, p.x, p.y, p.width, p.h);

        // 計分邏輯 (優化：只針對 top 或 middle 計分，避免一組水管加兩次分)
        if (!p.passed && bird.x > p.x + p.width) {
            p.passed = true;
            if (p.type === 'top' || p.type === 'middle') {
                score++;
                // 每 10 分切換章節
                // if (score % 10 === 0) {
                //     currentChapter = (currentChapter % 3) + 1; 
                //     loadChapterAssets(currentChapter);
                // }
            }
        }

        // 碰撞偵測
        if (bird.x < p.x + p.width && bird.x + bird.width > p.x &&
            bird.y < p.y + p.h && bird.y + bird.height > p.y) {
            gameState = 'gameover';
        }
        
        // 移除超出畫面水管
        if (p.x + p.width < 0) pipes.splice(i, 1);
    }

    // 掉出畫布或飛太高判定
    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameState = 'gameover';
    }

    drawUI();
    frame++;
}

// --- 控制器整合 ---
const handleAction = (e) => {
    // 防止點擊連結時觸發遊戲動作
    if (e && e.target.tagName === 'A' || (e && e.target.closest('a'))) return;

    if (gameState === 'start') {
        gameState = 'play';
    } else if (gameState === 'play') {
        bird.velocity = bird.lift;
    } else if (gameState === 'gameover') {
        resetGame();
        gameState = 'start';
    }
};

// 鍵盤監聽
window.addEventListener('keydown', (e) => { 
    if (e.code === 'Space') handleAction(e); 
});

// 觸控監聽：如果是點擊連結則不阻止預設行為
window.addEventListener('touchstart', (e) => { 
    if (e.target.tagName !== 'A' && !e.target.closest('a')) {
        e.preventDefault(); 
        handleAction(e); 
    }
}, { passive: false });

// 滑鼠點擊支援
window.addEventListener('mousedown', (e) => {
    handleAction(e);
});

// --- 啟動遊戲 ---
resizeCanvas();
loadChapterAssets(1);
gameLoop();