// キャンバスとコンテキストの取得
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const highScoreElement = document.getElementById('highScore');
const timeElement = document.getElementById('time');
const linesElement = document.getElementById('lines');
const nextBlockCanvas1 = document.getElementById('nextBlock1');
const nextBlockContext1 = nextBlockCanvas1.getContext('2d');
const nextBlockCanvas2 = document.getElementById('nextBlock2');
const nextBlockContext2 = nextBlockCanvas2.getContext('2d');
const nextBlockCanvas3 = document.getElementById('nextBlock3');
const nextBlockContext3 = nextBlockCanvas3.getContext('2d');
const holdBlockCanvas = document.getElementById('holdBlock');
const holdBlockContext = holdBlockCanvas.getContext('2d');

// サウンドエフェクトの取得
const moveSound = document.getElementById('moveSound');
const rotateSound = document.getElementById('rotateSound');
const lineClearSound = document.getElementById('lineClearSound');
const gameOverSound = document.getElementById('gameOverSound');
const selectionSound = document.getElementById('selectionSound');
const backgroundMusic = document.getElementById('backgroundMusic');
const blockTouchSound = document.getElementById('blockTouchSound');

// ゲーム設定
const ROW = 20;
const COL = 10;
const SQ = 30;
const VACANT = "black";

// テトリミノの定義
const PIECES = [
    { shape: [[1, 1, 1, 1]], color: "#00CED1" }, // I-テトリミノ（水色）
    { shape: [[1, 1], [1, 1]], color: "#FFD700" }, // O-テトリミノ（黄色）
    { shape: [[0, 1, 1], [1, 1, 0]], color: "#3CB371" }, // S-テトリミノ（緑）
    { shape: [[1, 1, 0], [0, 1, 1]], color: "#FF6347" }, // Z-テトリミノ（赤）
    { shape: [[1, 0, 0], [1, 1, 1]], color: "#4682B4" }, // J-テトリミノ（青）
    { shape: [[0, 0, 1], [1, 1, 1]], color: "#FFA500" }, // L-テトリミノ（オレンジ）
    { shape: [[0, 1, 0], [1, 1, 1]], color: "#800080" }  // T-テトリミノ（紫）
];

// ハイスコアの取得
let highScore = localStorage.getItem('highScore') || 230;
highScoreElement.innerHTML = "ハイスコア: " + highScore;

// ブロックの描画
function drawSquare(context, x, y, color, sqSize = SQ) {
    context.fillStyle = color;
    context.fillRect(x * sqSize, y * sqSize, sqSize, sqSize);
    context.strokeStyle = "black";
    context.strokeRect(x * sqSize, y * sqSize, sqSize, sqSize);
}

// 次のブロックの描画
function drawNextBlocks() {
    nextBlockContext1.clearRect(0, 0, nextBlockCanvas1.width, nextBlockCanvas1.height);
    drawPiece(nextBlockContext1, nextPieces[0], 1, 1, 15);
    nextBlockContext2.clearRect(0, 0, nextBlockCanvas2.width, nextBlockCanvas2.height);
    drawPiece(nextBlockContext2, nextPieces[1], 1, 1, 15);
    nextBlockContext3.clearRect(0, 0, nextBlockCanvas3.width, nextBlockCanvas3.height);
    drawPiece(nextBlockContext3, nextPieces[2], 1, 1, 15);
}

// ホールドブロックの描画
function drawHoldBlock() {
    holdBlockContext.clearRect(0, 0, holdBlockCanvas.width, holdBlockCanvas.height);
    if (holdPiece) {
        drawPiece(holdBlockContext, holdPiece, 1, 1, 30);
    }
}

function drawPiece(context, piece, offsetX, offsetY, sqSize = SQ) {
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawSquare(context, x + offsetX, y + offsetY, piece.color, sqSize);
            }
        });
    });
}

// ゲーム盤面の設定
let board = Array.from({ length: ROW }, () => Array(COL).fill(VACANT));

// ゲーム盤面の描画
function drawBoard() {
    board.forEach((row, r) => {
        row.forEach((color, c) => {
            drawSquare(context, c, r, color);
        });
    });
}

drawBoard();

// テトリミノの生成
class Piece {
    constructor(shape, color) {
        this.shape = shape;
        this.color = color;
        this.x = 3;
        this.y = -2;
    }

    fill(color) {
        this.shape.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value) {
                    drawSquare(context, this.x + c, this.y + r, color);
                }
            });
        });
    }

    draw() {
        this.fill(this.color);
    }

    unDraw() {
        this.fill(VACANT);
    }

    moveDown() {
        if (!this.collision(0, 1)) {
            this.unDraw();
            this.y++;
            this.draw();
            if (soundOn) moveSound.play();
        } else {
            this.lock();
            p = nextPieces.shift();
            nextPieces.push(randomPiece());
            drawNextBlocks();
            holdUsed = false;
        }
    }

    moveRight() {
        if (!this.collision(1, 0)) {
            this.unDraw();
            this.x++;
            this.draw();
            if (soundOn) moveSound.play();
        }
    }

    moveLeft() {
        if (!this.collision(-1, 0)) {
            this.unDraw();
            this.x--;
            this.draw();
            if (soundOn) moveSound.play();
        }
    }

    rotate() {
        const nextPattern = rotateMatrix(this.shape);
        const kick = this.collision(0, 0, nextPattern) ? (this.x > COL / 2 ? -1 : 1) : 0;
        if (!this.collision(kick, 0, nextPattern)) {
            this.unDraw();
            this.x += kick;
            this.shape = nextPattern;
            this.draw();
            if (soundOn) rotateSound.play();
        }
    }

    collision(x, y, shape = this.shape) {
        return shape.some((row, r) => {
            return row.some((value, c) => {
                if (value) {
                    const newX = this.x + c + x;
                    const newY = this.y + r + y;
                    return newX < 0 || newX >= COL || newY >= ROW || (newY >= 0 && board[newY][newX] !== VACANT);
                }
                return false;
            });
        });
    }

    lock() {
        this.shape.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value) {
                    if (this.y + r < 0) {
                        if (soundOn) gameOverSound.play();
                        if (score > highScore) {
                            highScore = score;
                            localStorage.setItem('highScore', highScore);
                        }
                        alert("ゲームオーバー");
                        document.location.reload();
                    }
                    board[this.y + r][this.x + c] = this.color;
                }
            });
        });

        for (let r = 0; r < ROW; r++) {
            if (board[r].every(value => value !== VACANT)) {
                for (let y = r; y > 0; y--) {
                    board[y] = [...board[y - 1]];
                }
                board[0] = Array(COL).fill(VACANT);
                score += 10;
                if (soundOn) lineClearSound.play();
            }
        }
        scoreElement.innerHTML = `スコア: ${score}`;
        if (score % 100 === 0) {
            level++;
            levelElement.innerHTML = `レベル: ${level}`;
            if (dropInterval > 100) {
                dropInterval -= 50;
            }
        }
        if (soundOn) blockTouchSound.play();
        drawBoard();
    }
}

function rotateMatrix(matrix) {
    return matrix[0].map((_, i) => matrix.map(row => row[i])).reverse();
}

function randomPiece() {
    const { shape, color } = PIECES[Math.floor(Math.random() * PIECES.length)];
    return new Piece(shape, color);
}

let p = randomPiece();
let nextPieces = [randomPiece(), randomPiece(), randomPiece()];
let holdPiece = null;
let holdUsed = false;
let score = 0;
let level = 1;
let dropStart = Date.now();
let gameOver = false;
let dropInterval = 1000;
let paused = false;
let soundOn = true;

drawNextBlocks();

document.addEventListener("keydown", CONTROL);

function CONTROL(event) {
    if (event.keyCode == 37) {
        p.moveLeft();
        dropStart = Date.now();
    } else if (event.keyCode == 38) {
        p.rotate();
        dropStart = Date.now();
    } else if (event.keyCode == 39) {
        p.moveRight();
        dropStart = Date.now();
    } else if (event.keyCode == 40) {
        p.moveDown();
    } else if (event.keyCode == 32) {
        togglePause();
    } else if (event.keyCode == 72) {
        hold();
    }
}

document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('soundButton').addEventListener('click', toggleSound);
document.getElementById('volumeSlider').addEventListener('input', adjustVolume);

document.getElementById('leftButton').addEventListener('click', () => {
    p.moveLeft();
    dropStart = Date.now();
});

document.getElementById('rotateButton').addEventListener('click', () => {
    p.rotate();
    dropStart = Date.now();
});

document.getElementById('rightButton').addEventListener('click', () => {
    p.moveRight();
    dropStart = Date.now();
});

document.getElementById('downButton').addEventListener('click', () => {
    p.moveDown();
});

document.getElementById('pauseButton').addEventListener('click', () => {
    togglePause();
});

document.getElementById('holdButton').addEventListener('click', () => {
    hold();
});

function hold() {
    if (!holdUsed) {
        if (holdPiece) {
            const temp = holdPiece;
            holdPiece = p;
            p = temp;
        } else {
            holdPiece = p;
            p = nextPieces.shift();
            nextPieces.push(randomPiece());
            drawNextBlocks();
        }
        p.x = 3;
        p.y = -2;
        drawHoldBlock();
        holdUsed = true;
    }
}

function startGame() {
    selectionSound.play();  // 再生時に効果音を鳴らす
    backgroundMusic.loop = true;
    backgroundMusic.volume = document.getElementById('volumeSlider').value / 100;
    if (soundOn) backgroundMusic.play();
    document.getElementById('titleScreen').style.display = 'none';
    document.getElementById('game').style.display = 'flex';
    document.getElementById('controls').style.display = 'flex';
    drop();
}

function togglePause() {
    paused = !paused;
    document.getElementById('pauseButton').innerText = paused ? '再開' : '一時停止';
    if (!paused) {
        if (soundOn) backgroundMusic.play();
    } else {
        backgroundMusic.pause();
    }
}

function toggleSound() {
    soundOn = !soundOn;
    document.getElementById('soundButton').innerText = soundOn ? 'サウンド: オン' : 'サウンド: オフ';
    if (soundOn) {
        backgroundMusic.play();
    } else {
        backgroundMusic.pause();
    }
}

function adjustVolume() {
    backgroundMusic.volume = document.getElementById('volumeSlider').value / 100;
}

function drop() {
    if (!paused) {
        const now = Date.now();
        const delta = now - dropStart;
        if (delta > dropInterval) {
            p.moveDown();
            dropStart = Date.now();
        }
    }
    if (!gameOver) {
        requestAnimationFrame(drop);
    }
}
