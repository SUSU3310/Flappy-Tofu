// --- 視窗縮放處理 ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);

    if (typeof initBird === 'function') {
        initBird(isMobile); 
    }
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 200);
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

    const linksUI = document.getElementById('author-links');
    if (linksUI) {
        linksUI.style.display = (gameState === 'start' || gameState === 'gameover') ? 'flex' : 'none';
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

/**
 * 遊戲核心邏輯驅動
 * 負責：物理運動、繪製、碰撞偵測、計分、場景切換
 */
function playGameLogic() {
    // 1. 小鳥物理運動
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    
    // 繪製小鳥本體 (黃色豆腐)
    ctx.fillStyle = "yellow";
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);

    // 2. 每隔 90 幀產生一組新水管
    if (frame % 90 === 0) createPipe();

    // 3. 遍歷並處理所有水管
    for (let i = pipes.length - 1; i >= 0; i--) {
        let p = pipes[i];
        
        // 移動水管：根據畫面寬度比例移動，確保不同裝置體感速度一致
        p.x -= (canvas.width * 0.005); 

        // --- A. 視覺繪製：等比例不拉伸 ---
        if (p.img.complete && p.img.width > 0) {
            const img = p.img;
            const imgRatio = img.width / img.height;

            if (p.type === 'middle') {
                // 中間石頭：使用 Contain 模式 (不裁切，置中縮放)
                const scale = Math.min(p.width / img.width, p.h / img.height);
                const drawW = img.width * scale;
                const drawH = img.height * scale;
                ctx.drawImage(img, p.x + (p.width - drawW) / 2, p.y + (p.h - drawH) / 2, drawW, drawH);
            } else {
                // 上下石頭：使用 Height Fit 模式 (高度對齊，寬度等比例，水平置中)
                const drawH = p.h;
                const drawW = drawH * imgRatio;
                ctx.drawImage(img, p.x + (p.width - drawW) / 2, p.y, drawW, drawH);
            }
        } else {
            // 圖片未載入時的備案
            ctx.fillStyle = "gray";
            ctx.fillRect(p.x, p.y, p.width, p.h);
        }

        // --- B. 碰撞參數計算：讀取由 createPipe 產生的 hitW / hitH ---
        let hX = p.x + (p.width - p.hitW) / 2; // 判定框水平置中
        let hY = p.y;
        let hW = p.hitW;
        let hH = p.hitH;

        if (p.type === 'bottom' && p.hitYOffset) {
            hY = p.y + p.hitYOffset; // 下石頭判定框從底部向上偏移，避開尖端空氣牆
        } else if (p.type === 'middle') {
            hY = p.y + (p.h - p.hitH) / 2; // 中間石頭判定框垂直置中
        }

        // --- C. 除錯模式：繪製紅色碰撞範圍 (正式發布時可註解掉) ---
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.strokeRect(hX, hY, hW, hH); // 顯示石頭殺傷區

        ctx.strokeStyle = "lime";
        ctx.strokeRect(bird.x, bird.y, bird.width, bird.height); // 顯示小鳥判定區

        // --- D. 碰撞偵測判定 ---
        if (bird.x < hX + hW && bird.x + bird.width > hX &&
            bird.y < hY + hH && bird.y + bird.height > hY) {
            gameState = 'gameover';
        }

        // --- E. 計分與關卡切換 ---
        if (!p.passed && bird.x > p.x + p.width) {
            p.passed = true;
            // 為了不重複計分，我們只在通過「上石頭」或「中間石頭」時加分
            if (p.type === 'top' || p.type === 'middle') {
                score++;
                // 每 10 分切換下一個章節
                if (score % 10 === 0) {
                    currentChapter = (currentChapter % 3) + 1; 
                    loadChapterAssets(currentChapter);
                }
            }
        }
        
        // --- F. 清除超出螢幕的水管以節省效能 ---
        if (p.x + p.width < 0) {
            pipes.splice(i, 1);
        }
    }

    // 4. 邊界判定：掉出螢幕下方或飛出上方
    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameState = 'gameover';
    }

    // 5. 繪製分數 UI 與 章節文字
    drawUI();

    // 增加全局幀計數
    frame++;
}

// --- 控制器整合 (與原本一致) ---
const handleAction = (e) => {
    if (e && (e.target.tagName === 'A' || e.target.closest('a'))) return;

    if (gameState === 'start') {
        gameState = 'play';
    } else if (gameState === 'play') {
        bird.velocity = bird.lift;
    } else if (gameState === 'gameover') {
        resetGame();
        gameState = 'start';
    }
};

window.addEventListener('keydown', (e) => { 
    if (e.code === 'Space') handleAction(e); 
});

window.addEventListener('touchstart', (e) => { 
    if (e.target.tagName !== 'A' && !e.target.closest('a')) {
        // 在手機上開始後，防止點擊造成頁面捲動
        if (gameState === 'play') e.preventDefault(); 
        handleAction(e); 
    }
}, { passive: false });

window.addEventListener('mousedown', (e) => {
    handleAction(e);
});

// --- 啟動遊戲 ---
resizeCanvas();
loadChapterAssets(1);
gameLoop();