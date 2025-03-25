class PoolGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentLevel = 1;
        this.score = 0;
        this.balls = [];
        this.pockets = [];
        this.cueBall = null;
        this.isAiming = false;
        this.power = 0;
        this.powerIncreasing = true;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.showHint = true;
        this.hintAnimation = {
            scale: 1,
            increasing: true,
            speed: 0.02,
            radius: 30  // 光圈半径
        };
        
        this.cueStick = {
            length: 200,  // 球杆长度
            width: 10,    // 球杆宽度
            offset: 30,   // 球杆与白球的距离
            angle: 0,     // 球杆角度
            isPulling: false,  // 是否正在后拉
            pullDistance: 0,   // 后拉距离
            maxPullDistance: 100  // 最大后拉距离
        };
        
        // 简化音效系统
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {
            hit: this.createBasicSound(800, 0.1),
            pocket: this.createBasicSound(400, 0.2),
            levelComplete: this.createBasicSound(600, 0.3),
            cuePull: this.createBasicSound(200, 0.1),
            cueRelease: this.createBasicSound(1000, 0.1)
        };
        
        // 初始化音频上下文
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.loadLevel(this.currentLevel);
        this.showMenu();
        this.gameLoop();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // 设置画布大小为容器大小
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;
        
        // 重新加载当前关卡以适应新的画布大小
        if (this.currentLevel) {
            this.loadLevel(this.currentLevel);
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());
        
        if (this.isMobile) {
            this.setupMobileControls();
        } else {
            this.setupDesktopControls();
        }
    }

    setupDesktopControls() {
        this.canvas.addEventListener('mousedown', (e) => this.startAiming(e));
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isAiming) {
                this.aim(e);
                // 计算后拉距离
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const dx = mouseX - this.cueBall.x;
                const dy = mouseY - this.cueBall.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > this.cueStick.offset) {
                    this.cueStick.isPulling = true;
                    this.cueStick.pullDistance = Math.min(
                        distance - this.cueStick.offset,
                        this.cueStick.maxPullDistance
                    );
                }
            }
        });
        this.canvas.addEventListener('mouseup', () => this.shoot());
    }

    setupMobileControls() {
        const shootBtn = document.getElementById('shootBtn');
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');

        shootBtn.addEventListener('touchstart', () => this.startAiming());
        shootBtn.addEventListener('touchend', () => this.shoot());
        
        leftBtn.addEventListener('touchstart', () => this.rotateCue(-1));
        rightBtn.addEventListener('touchstart', () => this.rotateCue(1));
    }

    loadLevel(level) {
        // 清空当前球桌
        this.balls = [];
        this.pockets = [];
        
        // 设置球桌尺寸
        const tableWidth = this.canvas.width * 0.9;
        const tableHeight = this.canvas.height * 0.8;
        const tableX = (this.canvas.width - tableWidth) / 2;
        const tableY = (this.canvas.height - tableHeight) / 2;

        // 创建球袋
        this.createPockets(tableX, tableY, tableWidth, tableHeight);

        // 创建关卡
        this.createLevel(level, tableX, tableY, tableWidth, tableHeight);

        // 创建白球
        this.cueBall = new Ball(
            tableX + tableWidth * 0.25,
            tableY + tableHeight / 2,
            15,
            '#FFFFFF'
        );
    }

    createPockets(tableX, tableY, tableWidth, tableHeight) {
        const pocketRadius = 20;
        const positions = [
            {x: tableX, y: tableY},
            {x: tableX + tableWidth/2, y: tableY},
            {x: tableX + tableWidth, y: tableY},
            {x: tableX, y: tableY + tableHeight},
            {x: tableX + tableWidth/2, y: tableY + tableHeight},
            {x: tableX + tableWidth, y: tableY + tableHeight}
        ];

        positions.forEach(pos => {
            this.pockets.push(new Pocket(pos.x, pos.y, pocketRadius));
        });
    }

    createTutorialLevel(tableX, tableY, tableWidth, tableHeight) {
        // 教程关卡：只有一个目标球
        this.balls.push(new Ball(
            tableX + tableWidth * 0.75,
            tableY + tableHeight / 2,
            15,
            '#FF0000'
        ));
    }

    createBeginnerLevel(tableX, tableY, tableWidth, tableHeight) {
        // 初级关卡：简单的三角形排列
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
        const startX = tableX + tableWidth * 0.75;
        const startY = tableY + tableHeight / 2;
        const ballSpacing = 30;

        for (let i = 0; i < 5; i++) {
            this.balls.push(new Ball(
                startX,
                startY - ballSpacing * 2 + ballSpacing * i,
                15,
                colors[i]
            ));
        }
    }

    createIntermediateLevel(tableX, tableY, tableWidth, tableHeight) {
        // 中级关卡：更复杂的排列
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'];
        const startX = tableX + tableWidth * 0.75;
        const startY = tableY + tableHeight / 2;
        const ballSpacing = 30;

        // 创建三角形排列
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col <= row; col++) {
                this.balls.push(new Ball(
                    startX - ballSpacing * row,
                    startY - ballSpacing * row + ballSpacing * col * 2,
                    15,
                    colors[this.balls.length]
                ));
            }
        }
    }

    startAiming(e) {
        if (!this.cueBall || this.cueBall.isMoving) return;
        
        this.isAiming = true;
        this.power = 0;
        this.powerIncreasing = true;
        this.cueStick.isPulling = false;
        this.cueStick.pullDistance = 0;
        this.showHint = false; // 开始瞄准时隐藏提示
        
        if (e) {
            this.aim(e);
        }
    }

    aim(e) {
        if (!this.isAiming) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 计算瞄准方向
        const dx = x - this.cueBall.x;
        const dy = y - this.cueBall.y;
        const angle = Math.atan2(dy, dx);
        
        this.cueBall.aimAngle = angle;
        this.cueStick.angle = angle;
        this.draw();
    }

    shoot() {
        if (!this.isAiming) return;

        this.isAiming = false;
        const power = Math.min(this.power, 100) / 100;
        
        // 播放击球音效
        this.playSound('cueRelease');
        
        const pullMultiplier = 1 + (this.cueStick.pullDistance / this.cueStick.maxPullDistance);
        
        this.cueBall.velocity.x = Math.cos(this.cueBall.aimAngle) * power * 20 * pullMultiplier;
        this.cueBall.velocity.y = Math.sin(this.cueBall.aimAngle) * power * 20 * pullMultiplier;
        
        setTimeout(() => {
            if (!this.cueBall.isMoving) {
                this.showHint = true;
            }
        }, 1000);
    }

    rotateCue(direction) {
        if (!this.cueBall || this.cueBall.isMoving) return;
        
        this.cueBall.aimAngle += direction * 0.1;
        this.draw();
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (!this.cueBall) return;
        
        [this.cueBall, ...this.balls].forEach(ball => {
            if (ball.isMoving) {
                ball.update();
                this.checkCollisions(ball);
                this.checkPocketCollisions(ball);
            }
        });
    }

    checkCollisions(ball) {
        // 检查球与球之间的碰撞
        [this.cueBall, ...this.balls].forEach(otherBall => {
            if (ball === otherBall) return;
            
            const dx = otherBall.x - ball.x;
            const dy = otherBall.y - ball.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < ball.radius + otherBall.radius) {
                this.resolveCollision(ball, otherBall);
            }
        });
    }

    resolveCollision(ball1, ball2) {
        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const normalX = dx / distance;
        const normalY = dy / distance;
        
        const relativeVelocityX = ball1.velocity.x - ball2.velocity.x;
        const relativeVelocityY = ball1.velocity.y - ball2.velocity.y;
        
        const speed = relativeVelocityX * normalX + relativeVelocityY * normalY;
        
        if (speed > 0) return;
        
        const impulse = 2 * speed;
        ball1.velocity.x += impulse * normalX;
        ball1.velocity.y += impulse * normalY;
        ball2.velocity.x -= impulse * normalX;
        ball2.velocity.y -= impulse * normalY;
        
        // 播放球碰撞音效
        this.playSound('hit');
    }

    checkPocketCollisions(ball) {
        this.pockets.forEach(pocket => {
            const dx = pocket.x - ball.x;
            const dy = pocket.y - ball.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < pocket.radius + ball.radius) {
                this.handlePocketCollision(ball, pocket);
            }
        });
    }

    handlePocketCollision(ball, pocket) {
        if (ball === this.cueBall) {
            // 白球进袋，重置位置
            this.resetCueBall();
        } else {
            // 播放进球音效
            this.playSound('pocket');
            
            // 目标球进袋，增加分数
            this.score += 100;
            document.getElementById('score').textContent = this.score;
            
            // 移除进袋的球
            const index = this.balls.indexOf(ball);
            if (index > -1) {
                this.balls.splice(index, 1);
            }
            
            // 检查是否完成关卡
            if (this.balls.length === 0) {
                this.completeLevel();
            }
        }
    }

    resetCueBall() {
        this.cueBall.x = this.canvas.width * 0.25;
        this.cueBall.y = this.canvas.height / 2;
        this.cueBall.velocity = { x: 0, y: 0 };
    }

    completeLevel() {
        // 播放关卡完成音效
        this.playSound('levelComplete');
        
        this.currentLevel++;
        document.getElementById('current-level').textContent = this.currentLevel;
        document.getElementById('levelScore').textContent = this.score;
        document.getElementById('levelComplete').style.display = 'block';
    }

    isGameActive() {
        return [this.cueBall, ...this.balls].some(ball => ball.isMoving);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawTable();
        
        this.pockets.forEach(pocket => pocket.draw(this.ctx));
        
        this.balls.forEach(ball => ball.draw(this.ctx));
        if (this.cueBall) {
            this.cueBall.draw(this.ctx);
            if (this.showHint && !this.isAiming && !this.cueBall.isMoving) {
                this.drawHintArrow();
            }
        }
        
        if (this.isAiming && this.cueBall) {
            this.drawAimLine();
        }
        
        this.updatePowerMeter();
    }

    drawTable() {
        // 绘制球桌边框
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 20;
        this.ctx.strokeRect(50, 50, this.canvas.width - 100, this.canvas.height - 100);
        
        // 绘制球桌表面
        this.ctx.fillStyle = '#2a5c2a';
        this.ctx.fillRect(50, 50, this.canvas.width - 100, this.canvas.height - 100);
    }

    drawHintArrow() {
        if (!this.cueBall) return;

        // 更新动画
        if (this.hintAnimation.increasing) {
            this.hintAnimation.scale += this.hintAnimation.speed;
            if (this.hintAnimation.scale >= 1.2) {
                this.hintAnimation.increasing = false;
            }
        } else {
            this.hintAnimation.scale -= this.hintAnimation.speed;
            if (this.hintAnimation.scale <= 0.8) {
                this.hintAnimation.increasing = true;
            }
        }

        // 绘制光圈
        const radius = this.hintAnimation.radius * this.hintAnimation.scale;
        
        // 绘制外圈
        this.ctx.beginPath();
        this.ctx.arc(this.cueBall.x, this.cueBall.y, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        // 绘制内圈
        this.ctx.beginPath();
        this.ctx.arc(this.cueBall.x, this.cueBall.y, radius * 0.8, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // 绘制中心点
        this.ctx.beginPath();
        this.ctx.arc(this.cueBall.x, this.cueBall.y, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fill();
    }

    drawAimLine() {
        const lineLength = 1000; // 将瞄准线长度从500增加到1000
        this.ctx.beginPath();
        this.ctx.moveTo(this.cueBall.x, this.cueBall.y);
        
        let endX = this.cueBall.x + Math.cos(this.cueBall.aimAngle) * lineLength;
        let endY = this.cueBall.y + Math.sin(this.cueBall.aimAngle) * lineLength;
        
        const tableBounds = {
            left: 50,
            right: this.canvas.width - 50,
            top: 50,
            bottom: this.canvas.height - 50
        };
        
        let intersection = this.findBoundaryIntersection(
            this.cueBall.x, this.cueBall.y,
            endX, endY,
            tableBounds
        );
        
        if (intersection) {
            endX = intersection.x;
            endY = intersection.y;
            this.drawReflectionLine(intersection, this.cueBall.aimAngle);
        }
        
        // 绘制渐变瞄准线
        const gradient = this.ctx.createLinearGradient(
            this.cueBall.x,
            this.cueBall.y,
            endX,
            endY
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.cueBall.x, this.cueBall.y);
        this.ctx.lineTo(endX, endY);
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.drawCueStick();
    }

    drawCueStick() {
        if (!this.isAiming) return;
        
        const cueAngle = this.cueBall.aimAngle;
        const pullOffset = this.cueStick.isPulling ? this.cueStick.pullDistance : 0;
        
        // 计算球杆起点和终点
        const startX = this.cueBall.x - Math.cos(cueAngle) * (this.cueStick.offset + pullOffset);
        const startY = this.cueBall.y - Math.sin(cueAngle) * (this.cueStick.offset + pullOffset);
        const endX = startX - Math.cos(cueAngle) * this.cueStick.length;
        const endY = startY - Math.sin(cueAngle) * this.cueStick.length;
        
        // 绘制球杆
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.strokeStyle = '#8B4513';  // 棕色
        this.ctx.lineWidth = this.cueStick.width;
        this.ctx.stroke();
        
        // 绘制球杆头部
        this.ctx.beginPath();
        this.ctx.arc(startX, startY, this.cueStick.width/2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#FFD700';  // 金色
        this.ctx.fill();
    }

    findBoundaryIntersection(x1, y1, x2, y2, bounds) {
        // 检查与四条边的交点
        const lines = [
            { x1: bounds.left, y1: bounds.top, x2: bounds.right, y2: bounds.top },    // 上边
            { x1: bounds.right, y1: bounds.top, x2: bounds.right, y2: bounds.bottom }, // 右边
            { x1: bounds.right, y1: bounds.bottom, x2: bounds.left, y2: bounds.bottom }, // 下边
            { x1: bounds.left, y1: bounds.bottom, x2: bounds.left, y2: bounds.top }     // 左边
        ];
        
        for (const line of lines) {
            const intersection = this.lineIntersection(
                x1, y1, x2, y2,
                line.x1, line.y1, line.x2, line.y2
            );
            if (intersection) return intersection;
        }
        
        return null;
    }

    lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denominator === 0) return null;
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
        
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }
        
        return null;
    }

    drawReflectionLine(intersection, angle) {
        // 计算反射角度
        let reflectionAngle = angle;
        if (Math.abs(intersection.x - 50) < 1 || Math.abs(intersection.x - (this.canvas.width - 50)) < 1) {
            // 碰到左右边界
            reflectionAngle = Math.PI - angle;
        } else {
            // 碰到上下边界
            reflectionAngle = -angle;
        }
        
        // 绘制反射线
        const reflectionLength = 200;
        this.ctx.beginPath();
        this.ctx.moveTo(intersection.x, intersection.y);
        this.ctx.lineTo(
            intersection.x + Math.cos(reflectionAngle) * reflectionLength,
            intersection.y + Math.sin(reflectionAngle) * reflectionLength
        );
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.stroke();
    }

    updatePowerMeter() {
        if (this.isAiming) {
            if (this.powerIncreasing) {
                this.power += 2;
                if (this.power >= 100) {
                    this.powerIncreasing = false;
                }
            } else {
                this.power -= 2;
                if (this.power <= 0) {
                    this.powerIncreasing = true;
                }
            }
            
            const powerMeter = document.querySelector('.power-meter');
            powerMeter.style.setProperty('--power', `${this.power}%`);
        }
    }

    showMenu() {
        document.getElementById('menu').style.display = 'block';
    }

    // 添加更多关卡生成方法
    createLevel(level, tableX, tableY, tableWidth, tableHeight) {
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000', '#FF4500'];
        const startX = tableX + tableWidth * 0.75;
        const startY = tableY + tableHeight / 2;
        const ballSpacing = 30;

        // 根据关卡难度生成不同的球阵
        if (level <= 3) {
            // 保持原有的三个关卡
            switch(level) {
                case 1:
                    this.createTutorialLevel(tableX, tableY, tableWidth, tableHeight);
                    break;
                case 2:
                    this.createBeginnerLevel(tableX, tableY, tableWidth, tableHeight);
                    break;
                case 3:
                    this.createIntermediateLevel(tableX, tableY, tableWidth, tableHeight);
                    break;
            }
        } else {
            // 生成新的关卡
            const numBalls = Math.min(3 + Math.floor(level / 5), 10); // 每5关增加一个球，最多10个
            const pattern = level % 4; // 4种不同的球阵模式

            switch(pattern) {
                case 0: // 三角形
                    for (let row = 0; row < Math.ceil(numBalls / 2); row++) {
                        for (let col = 0; col <= row; col++) {
                            if (this.balls.length < numBalls) {
                                this.balls.push(new Ball(
                                    startX - ballSpacing * row,
                                    startY - ballSpacing * row + ballSpacing * col * 2,
                                    15,
                                    colors[this.balls.length % colors.length]
                                ));
                            }
                        }
                    }
                    break;
                case 1: // 直线
                    for (let i = 0; i < numBalls; i++) {
                        this.balls.push(new Ball(
                            startX - ballSpacing * i,
                            startY,
                            15,
                            colors[i % colors.length]
                        ));
                    }
                    break;
                case 2: // 圆形
                    const radius = ballSpacing * Math.ceil(numBalls / 4);
                    for (let i = 0; i < numBalls; i++) {
                        const angle = (i / numBalls) * Math.PI * 2;
                        this.balls.push(new Ball(
                            startX + Math.cos(angle) * radius,
                            startY + Math.sin(angle) * radius,
                            15,
                            colors[i % colors.length]
                        ));
                    }
                    break;
                case 3: // 随机分布
                    for (let i = 0; i < numBalls; i++) {
                        const x = startX - ballSpacing * (i % 3);
                        const y = startY + ballSpacing * Math.floor(i / 3);
                        this.balls.push(new Ball(
                            x,
                            y,
                            15,
                            colors[i % colors.length]
                        ));
                    }
                    break;
            }
        }
    }

    // 创建基本音效
    createBasicSound(frequency, duration) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.5, this.audioContext.currentTime + duration);
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        return { oscillator, gainNode };
    }
    
    // 简化播放音效的方法
    playSound(soundName) {
        const sound = this.sounds[soundName];
        if (!sound) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = sound.oscillator.type;
        oscillator.frequency.setValueAtTime(sound.oscillator.frequency.value, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
            sound.oscillator.frequency.value * 0.5,
            this.audioContext.currentTime + 0.1
        );
        
        gainNode.gain.setValueAtTime(sound.gainNode.gain.value, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }

    // 添加重新开始和选择关卡的方法
    restartGame() {
        this.currentLevel = 1;
        this.score = 0;
        document.getElementById('current-level').textContent = this.currentLevel;
        document.getElementById('score').textContent = this.score;
        this.loadLevel(this.currentLevel);
    }

    selectLevel(level) {
        this.currentLevel = level;
        this.loadLevel(this.currentLevel);
    }
}

class Ball {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = { x: 0, y: 0 };
        this.aimAngle = 0;
        this.friction = 0.99;
    }

    get isMoving() {
        return Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.y) > 0.01;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        
        this.checkBoundaries();
    }

    checkBoundaries() {
        const padding = 50 + this.radius;
        const maxX = window.innerWidth - padding;
        const maxY = window.innerHeight - padding;
        
        // 左边界
        if (this.x - this.radius < padding) {
            this.x = padding + this.radius;
            this.velocity.x *= -0.8;
        }
        // 右边界
        if (this.x + this.radius > maxX) {
            this.x = maxX - this.radius;
            this.velocity.x *= -0.8;
        }
        // 上边界
        if (this.y - this.radius < padding) {
            this.y = padding + this.radius;
            this.velocity.y *= -0.8;
        }
        // 下边界
        if (this.y + this.radius > maxY) {
            this.y = maxY - this.radius;
            this.velocity.y *= -0.8;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Pocket {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
    }
}

// 修改初始化代码
document.addEventListener('DOMContentLoaded', () => {
    const game = new PoolGame();
    
    // 菜单控制
    document.getElementById('startGame').addEventListener('click', () => {
        document.getElementById('menu').style.display = 'none';
        game.loadLevel(1);
    });
    
    document.getElementById('nextLevel').addEventListener('click', () => {
        document.getElementById('levelComplete').style.display = 'none';
        game.loadLevel(game.currentLevel);
    });

    // 添加重新开始按钮事件
    document.getElementById('restartGame').addEventListener('click', () => {
        document.getElementById('menu').style.display = 'none';
        game.restartGame();
    });

    // 添加选择关卡按钮事件
    document.getElementById('selectLevel').addEventListener('click', () => {
        const level = parseInt(prompt('请输入要跳转的关卡号（1-100）：'));
        if (level >= 1 && level <= 100) {
            document.getElementById('menu').style.display = 'none';
            game.selectLevel(level);
        }
    });
}); 