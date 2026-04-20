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

// --- 像素級碰撞檢測 ---
function isPixelCollision(birdParams, pipeParams) {
    // 取得兩者的 AABB (框框) 交集區域 (Broad Phase)
    const left = Math.max(birdParams.x, pipeParams.x);
    const right = Math.min(birdParams.x + birdParams.w, pipeParams.x + pipeParams.w);
    const top = Math.max(birdParams.y, pipeParams.y);
    const bottom = Math.min(birdParams.y + birdParams.h, pipeParams.y + pipeParams.h);

    // 如果沒有重疊，直接不會撞到
    if (left >= right || top >= bottom) return false;

    const width = Math.floor(right - left);
    const height = Math.floor(bottom - top);
    if (width <= 0 || height <= 0) return false;

    // 建立或共用的離屏 Canvas (用來只畫交集區域)
    if (!window.hitCanvas) {
        window.hitCanvas = document.createElement('canvas');
        window.hitCtx = window.hitCanvas.getContext('2d', { willReadFrequently: true });
    }
    const hitCtx = window.hitCtx;
    window.hitCanvas.width = width;
    window.hitCanvas.height = height;

    // 1. 畫出小鳥在該交集區的像素並取出
    hitCtx.clearRect(0, 0, width, height);
    hitCtx.save();
    hitCtx.translate(-left, -top); // 確保座標基準對齊交集區左上角
    hitCtx.translate(birdParams.x + birdParams.w / 2, birdParams.y + birdParams.h / 2);
    hitCtx.rotate(birdParams.rotation);
    hitCtx.drawImage(birdParams.img, -birdParams.w / 2, -birdParams.h / 2, birdParams.w, birdParams.h);
    hitCtx.restore();
    
    let data1;
    let data2;
    try {
        data1 = hitCtx.getImageData(0, 0, width, height).data;
        
        // 2. 畫出在此交集區的水管像素並取出
        hitCtx.clearRect(0, 0, width, height);
        hitCtx.save();
        hitCtx.translate(-left, -top);
        hitCtx.drawImage(pipeParams.img, pipeParams.x, pipeParams.y, pipeParams.w, pipeParams.h);
        hitCtx.restore();

        data2 = hitCtx.getImageData(0, 0, width, height).data;
    } catch(e) { 
        // 若圖片因為直接開啟檔案 (file://) 等跨域安全限制導致無法讀取像素，則退回以前的方塊式碰撞
        return true; 
    }

    // 3. 像素比對：設定透明度閥值 (大於 50 視為實體，避免邊緣半透明光暈造成過度判定)
    for (let i = 3; i < data1.length; i += 4) {
        if (data1[i] > 50 && data2[i] > 50) {
            return true;
        }
    }

    return false;
}

/**
 * 遊戲核心邏輯驅動
 * 負責：物理運動、繪製、碰撞偵測、計分、場景切換
 */
function playGameLogic() {
    // 1. 小鳥物理運動
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    
    // --- 修改：繪製圖片玩家替代黃色方塊 ---
    if (birdImg.complete && birdImg.width > 0) {
        ctx.save(); // 保存目前的畫布狀態（座標系、旋轉等）
        
        // 將畫布的原點移動到小鳥的中心點
        ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
        
        // 根據垂直速度計算旋轉角度
        // bird.velocity 為正（掉落時）會順時針轉，為負（跳躍時）會逆時針轉
        // Math.PI / 4 大約是 45 度，限制最大轉動範圍
        let rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.1));
        ctx.rotate(rotation);
        
        // 繪製圖片：因為原點已經移到中心，所以圖片要往回偏置寬高的一半
        ctx.drawImage(birdImg, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
        
        ctx.restore(); // 恢復畫布狀態，避免影響後續水管的繪製
    } else {
        // 如果圖片還沒載入，暫時畫黃色方塊
        ctx.fillStyle = "yellow";
        ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    }

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

            // 統一使用 Height Fit 模式 (高度對齊，寬度等比例，水平置中)
            const drawH = p.h;
            const drawW = drawH * imgRatio;
            ctx.drawImage(img, p.x + (p.width - drawW) / 2, p.y, drawW, drawH);
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
        ctx.strokeRect(bird.x, bird.y, bird.width, bird.height);

        // --- D. 碰撞偵測判定 ---
        let birdRotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.1));

        // 若圖片存在，使用像素級精確檢測 (Pixel-Perfect Collision)
        if (birdImg.complete && birdImg.width > 0 && p.img.complete && p.img.width > 0) {
            const imgRatio = p.img.width / p.img.height;
            const drawH = p.h;
            const drawW = drawH * imgRatio;
            const drawX = p.x + (p.width - drawW) / 2;
            const drawY = p.y;
            
            // 先使用原來的 AABB (紅框與綠框) 進行廣泛檢測，如果連框框都沒重疊，就絕不可能撞到
            let isHit = false;
            if (bird.x < hX + hW && bird.x + bird.width > hX &&
                bird.y < hY + hH && bird.y + bird.height > hY) {
                // 如果外框重疊了，才進入消耗效能的像素檢測
                isHit = isPixelCollision(
                    { x: bird.x, y: bird.y, w: bird.width, h: bird.height, rotation: birdRotation, img: birdImg },
                    { x: drawX, y: drawY, w: drawW, h: drawH, img: p.img }
                );
            }

            if (isHit) gameState = 'gameover';
        } else {
            // AABB 備用判定 (當圖片未準備好時)
            if (bird.x < hX + hW && bird.x + bird.width > hX &&
                bird.y < hY + hH && bird.y + bird.height > hY) {
                gameState = 'gameover';
            }
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