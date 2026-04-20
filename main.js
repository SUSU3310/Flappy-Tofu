// --- 視窗縮放處理 ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);

    if (typeof initBird === 'function' && typeof gameSettings !== 'undefined' && gameSettings) {
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

// --- 多邊形碰撞檢測 (SAT) ---
function getAxes(poly) {
    let axes = [];
    for (let i = 0; i < poly.length; i++) {
        let p1 = poly[i];
        let p2 = poly[(i + 1) % poly.length];
        let edge = { x: p2.x - p1.x, y: p2.y - p1.y };
        let normal = { x: -edge.y, y: edge.x };
        // normalize
        let len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
        if (len !== 0) {
            axes.push({ x: normal.x / len, y: normal.y / len });
        }
    }
    return axes;
}

function projectPoly(poly, axis) {
    let min = (poly[0].x * axis.x + poly[0].y * axis.y);
    let max = min;
    for (let i = 1; i < poly.length; i++) {
        let p = poly[i].x * axis.x + poly[i].y * axis.y;
        if (p < min) min = p;
        if (p > max) max = p;
    }
    return { min, max };
}

function isPolygonCollision(poly1, poly2) {
    let axes = [...getAxes(poly1), ...getAxes(poly2)];
    for (let i = 0; i < axes.length; i++) {
        let proj1 = projectPoly(poly1, axes[i]);
        let proj2 = projectPoly(poly2, axes[i]);
        // overlap check
        if (proj1.max < proj2.min || proj2.max < proj1.min) {
            return false; // found a gap, no collision
        }
    }
    return true; // no gaps found
}

// 根據物體參數生成多邊形形狀
function createBirdPolygon(bird) {
    const cx = bird.x + bird.width / 2;
    const cy = bird.y + bird.height / 2;
    const w = bird.width * 0.8; // 稍微縮小碰撞框避免過於苛刻
    const h = bird.height * 0.8;
    const rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.1));
    
    // 計算旋轉後的四個頂點
    const corners = [
        { x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 },
        { x: w/2, y: h/2 }, { x: -w/2, y: h/2 }
    ];
    return corners.map(p => ({
        x: cx + p.x * Math.cos(rotation) - p.y * Math.sin(rotation),
        y: cy + p.x * Math.sin(rotation) + p.y * Math.cos(rotation)
    }));
}

function createPipePolygon(pipe, drawX, drawY, drawW, drawH) {
    // 預設縮小一點點當作通融空間
    const cx = drawX + drawW / 2;
    const paddingX = drawW * 0.1;
    const paddingY = drawH * 0.1;
    const minX = drawX + paddingX;
    const maxX = drawX + drawW - paddingX;
    const minY = drawY + paddingY;
    const maxY = drawY + drawH - paddingY;

    if (pipe.shape === 'diamond') {
        // 菱形
        return [
            { x: cx, y: minY },
            { x: maxX, y: drawY + drawH / 2 },
            { x: cx, y: maxY },
            { x: minX, y: drawY + drawH / 2 }
        ];
    } else {
        // 三角形 (如果是上下顛倒則需要調整尖端)
        if (pipe.type === 'top') {
            // 上方的水管，尖頭朝下？ 或平平的朝下？
            // 假設是正三角形往上長或往往下長的尖頭
            // 我們做一個底邊在上面，尖端在下方的三角形
            return [
                { x: minX, y: minY },
                { x: maxX, y: minY },
                { x: cx, y: maxY }
            ];
        } else if (pipe.type === 'bottom' || pipe.type === 'middle') {
            // 底邊在下方，尖端在上方
            return [
                { x: cx, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY }
            ];
        }
    }
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

    // 2. 每隔一定幀數產生一組新水管
    const settings = gameSettings[`ch${currentChapter}`];
    
    // 計算目前的生成間隔 (隨分數增加而變小，但有最小值保護)
    let currentSpawnInterval = settings.pipeSpawnFrames - (score * (settings.pipeSpawnAcceleration || 0));
    if (currentSpawnInterval < (settings.minPipeSpawnFrames || 30)) {
        currentSpawnInterval = settings.minPipeSpawnFrames || 30;
    }
    
    // 因為 currentSpawnInterval 可能不再是常數，當它變成 43、41 這種奇數時 % 很容易錯過
    // 所以我們使用一個倒數計時的概念：
    if (typeof window.nextPipeSpawnFrame === 'undefined') {
        window.nextPipeSpawnFrame = frame + currentSpawnInterval;
    }
    
    if (frame >= window.nextPipeSpawnFrame) {
        createPipe();
        window.nextPipeSpawnFrame = frame + currentSpawnInterval;
    }

    // 3. 遍歷並處理所有水管
    for (let i = pipes.length - 1; i >= 0; i--) {
        let p = pipes[i];
        
        // 移動水管：根據畫面寬度與設定的速度比例移動
        p.x -= (canvas.width * settings.speedMultiplier); 

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

        // --- C. 除錯模式：繪製紅色碰撞範圍 (多邊形) ---
        let birdPoly = createBirdPolygon(bird);
        let pipePoly = [];
        
        // 取得 pipePoly 並畫出來
        if (p.shape && p.img.complete && p.img.width > 0) {
            const imgRatio = p.img.width / p.img.height;
            const drawH = p.h;
            const drawW = drawH * imgRatio;
            const drawX = p.x + (p.width - drawW) / 2;
            const drawY = p.y;
            pipePoly = createPipePolygon(p, drawX, drawY, drawW, drawH);

            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pipePoly[0].x, pipePoly[0].y);
            for(let j=1; j<pipePoly.length; j++) ctx.lineTo(pipePoly[j].x, pipePoly[j].y);
            ctx.closePath();
            ctx.stroke();
        } else {
            // 圖片未載入時，安全 fallback 到方塊舊版
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.strokeRect(hX, hY, hW, hH);
        }

        ctx.strokeStyle = "lime";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(birdPoly[0].x, birdPoly[0].y);
        for(let j=1; j<birdPoly.length; j++) ctx.lineTo(birdPoly[j].x, birdPoly[j].y);
        ctx.closePath();
        ctx.stroke();

        // --- D. 碰撞偵測判定 ---
        if (pipePoly.length > 0) {
            // Polygon SAT collision
            if (isPolygonCollision(birdPoly, pipePoly)) {
                gameState = 'gameover';
            }
        } else {
            // AABB 備用判定
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
            }
        }
        
        // --- F. 清除超出螢幕邊界的水管以節省效能 ---
        // 同樣向左延展回收區域，使得過寬的圖片完全隱形後才被 splice 刪除，避免憑空消失
        if (p.x + p.width + canvas.height * 0.3 < 0) {
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
async function initGameSettings() {
    try {
        // 加上時間戳避免瀏覽器快取舊的 json 檔案
        const res = await fetch('./setting.json?t=' + new Date().getTime());
        gameSettings = await res.json();
    } catch(e) {
        console.error("無法載入 setting.json", e);
        // 提供預設設定以防萬一
        gameSettings = {
            "ch1": {
                "speedMultiplier": 0.005,
                "bgSpeed": 1.5,
                "pipeSpawnFrames": 60,
                "minPipeSpawnFrames": 30,
                "pipeSpawnAcceleration": 2,
                "pipeWidthRatio": 0.08,
                "pipeMinHeightRatio": 0.1,
                "pipeMaxHeightRatio": 0.4,
                "middlePipeHeightRatio": 0.2,
                "mobile": { "gravityRatio": 0.0005, "liftRatio": -0.01, "pipeGapRatio": 0.22 },
                "desktop": { "gravityRatio": 0.0006, "liftRatio": -0.012, "pipeGapRatio": 0.25 }
            }
        };
    }
    
    resizeCanvas();
    loadChapterAssets();
    gameLoop();
}

initGameSettings();