const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdContext = holdCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const highScoreElement = document.getElementById('highScore');
const pauseButton = document.getElementById('pauseButton');
const titleScreen = document.getElementById('titleScreen');
const gameScreen = document.getElementById('game');
const controlsScreen = document.getElementById('controls');
const gameOverScreen = document.getElementById('gameOverScreen');

const moveSound = document.getElementById('moveSound');
const rotateSound = document.getElementById('rotateSound');
const lineClearSound = document.getElementById('lineClearSound');
const gameOverSound = document.getElementById('gameOverSound');

const ROW = 20;
const COL = 10;
const SQ = 30;
const VACANT = "black"; // 空いているセルの色

let gamePaused = false;
let soundEnabled = true;
let gameOver = false;
let dropInterval = 1000;

document.getElementById('toggleSound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('toggleSound').innerText = soundEnabled ? "サウンド: オン" : "サウンド: オフ";
});

pauseButton.addEventListener('click', () => {
    gamePaused = !gamePaused;
    pauseButton.innerText = gamePaused ? "再開" : "一旦停止";
    if (!gamePaused) {
        drop();
    }
});

document.getElementById('retryButton').addEventListener('click', () => {
    document.location.reload();
});

const startGame = (difficulty) => {
    titleScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    controlsScreen.style.display = 'flex';
    dropInterval = difficulty;
    drop();
}

document.getElementById('startEasy').addEventListener('click', () => startGame(1000));
document.getElementById('startNormal').addEventListener('click', () => startGame(500));
document.getElementById('startHard').addEventListener('click', () => startGame(200));

// カスタマイズしたブロックの形と色
const Z = [
    [ [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0] ],
    [ [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0] ]
];

const S = [
    [ [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0] ],
    [ [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0] ]
];

const T = [
    [ [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0] ],
    [ [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0] ],
    [ [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0] ],
    [ [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0] ]
];

const O = [
    [ [1, 1],
      [1, 1] ]
];

const L = [
    [ [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0] ],
    [ [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1] ],
    [ [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0] ],
    [ [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0] ]
];

const I = [
    [ [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0] ],
    [ [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0] ]
];

const J = [
    [ [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0] ],
    [ [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0] ],
    [ [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1] ],
    [ [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0] ]
];

// カスタマイズしたブロックの色
const PIECES = [
    [Z, "#FF6347"], // Tomato
    [S, "#3CB371"], // MediumSeaGreen
    [T, "#DAA520"], // GoldenRod
    [O, "#4682B4"], // SteelBlue
    [L, "#9370DB"], // MediumPurple
    [I, "#00CED1"], // DarkTurquoise
    [J, "#FF8C00"]  // DarkOrange
];

// ハイスコアの取得
let highScore = localStorage.getItem('highScore') || 0;
highScoreElement.innerHTML = "ハイスコア: " + highScore;

// ブロックの描画
function drawSquare(x, y, color, ctx = context) {
    ctx.fillStyle = color;
    ctx.fillRect(x * SQ, y * SQ, SQ, SQ);

    ctx.strokeStyle = "black";
    ctx.strokeRect(x * SQ, y * SQ, SQ, SQ);
}

// ゲーム盤面
let board = [];
for (let r = 0; r < ROW; r++) {
    board[r] = [];
    for (let c = 0; c < COL; c++) {
        board[r][c] = VACANT;
    }
}

// ゲーム盤面を描画
function drawBoard() {
    for (let r = 0; r < ROW; r++) {
        for (let c = 0; c < COL; c++) {
            drawSquare(c, r, board[r][c]);
        }
    }
}

drawBoard();

// テトリスブロックの生成
function Piece(tetromino, color) {
    this.tetromino = tetromino;
    this.color = color;

    this.tetrominoN = 0;
    this.activeTetromino = this.tetromino[this.tetrominoN];

    this.x = 3;
    this.y = -2;
}

// ブロックの塗りつぶし
Piece.prototype.fill = function(color, ctx = context) {
    for (let r = 0; r < this.activeTetromino.length; r++) {
        for (let c = 0; c < this.activeTetromino[r].length; c++) {
            if (this.activeTetromino[r][c]) {
                drawSquare(this.x + c, this.y + r, color, ctx);
            }
        }
    }
}

// ブロックを描画
Piece.prototype.draw = function(ctx = context) {
    this.fill(this.color, ctx);
}

// ブロックを消去
Piece.prototype.unDraw = function(ctx = context) {
    this.fill(VACANT, ctx);
}

// ブロックを下に移動
Piece.prototype.moveDown = function() {
    if (!this.collision(0, 1, this.activeTetromino)) {
        this.unDraw();
        this.y++;
        this.draw();
        if (soundEnabled) moveSound.play();
    } else {
        this.lock();
        p = nextPiece;
        nextPiece = randomPiece();
        displayNextPiece();
    }
}

// ブロックを右に移動
Piece.prototype.moveRight = function() {
    if (!this.collision(1, 0, this.activeTetromino)) {
        this.unDraw();
        this.x++;
        this.draw();
        if (soundEnabled) moveSound.play();
    }
}

// ブロックを左に移動
Piece.prototype.moveLeft = function() {
    if (!this.collision(-1, 0, this.activeTetromino)) {
        this.unDraw();
        this.x--;
        this.draw();
        if (soundEnabled) moveSound.play();
    }
}

// ブロックを回転
Piece.prototype.rotate = function() {
    let nextPattern = this.tetromino[(this.tetrominoN + 1) % this.tetromino.length];
    let kick = 0;

    if (this.collision(0, 0, nextPattern)) {
        if (this.x > COL / 2) {
            kick = -1;
        } else {
            kick = 1;
        }
    }

    if (!this.collision(kick, 0, nextPattern)) {
        this.unDraw();
        this.x += kick;
        this.tetrominoN = (this.tetrominoN + 1) % this.tetromino.length;
        this.activeTetromino = this.tetromino[this.tetrominoN];
        this.draw();
        if (soundEnabled) rotateSound.play();
    }
}

// 衝突判定
Piece.prototype.collision = function(x, y, piece) {
    for (let r = 0; r < piece.length; r++) {
        for (let c = 0; c < piece[r].length; c++) {
            if (!piece[r][c]) {
                continue;
            }

            let newX = this.x + c + x;
            let newY = this.y + r + y;

            if (newX < 0 || newX >= COL || newY >= ROW) {
                return true;
            }

            if (newY < 0) {
                continue;
            }

            if (board[newY][newX] !== VACANT) {
                return true;
            }
        }
    }
    return false;
}

// ブロックを固定
Piece.prototype.lock = function() {
    for (let r = 0; r < this.activeTetromino.length; r++) {
        for (let c = 0; c < this.activeTetromino[r].length; c++) {
            if (!this.activeTetromino[r][c]) {
                continue;
            }

            if (this.y + r < 0) {
                if (soundEnabled) gameOverSound.play();
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('highScore', highScore);
                }
                gameOverScreen.style.display = 'flex';
                gameScreen.style.display = 'none';
                controlsScreen.style.display = 'none';
                return;
            }

            board[this.y + r][this.x + c] = this.color;
        }
    }

    // ラインが揃ったかチェック
    for (let r = 0; r < ROW; r++) {
        let isRowFull = true;
        for (let c = 0; c < COL; c++) {
            isRowFull = isRowFull && (board[r][c] !== VACANT);
        }
        if (isRowFull) {
            // ラインが揃ったらスコアを加算
            score += 10;
            scoreElement.innerHTML = "スコア: " + score;

            for (let y = r; y > 1; y--) {
                for (let c = 0; c < COL; c++) {
                    board[y][c] = board[y - 1][c];
                }
            }

            for (let c = 0; c < COL; c++) {
                board[0][c] = VACANT;
            }

            if (soundEnabled) lineClearSound.play();

            // レベルアップ判定
            if (score % 100 === 0) {
                level++;
                levelElement.innerHTML = "レベル: " + level;
                if (dropInterval > 100) {
                    dropInterval -= 50;
                }
            }
        }
    }

    drawBoard();
}

// ゴーストピースを描画
Piece.prototype.drawGhost = function() {
    let ghostY = this.y;
    while (!this.collision(0, 1, this.activeTetromino)) {
        ghostY++;
    }
    ghostY--;
    for (let r = 0; r < this.activeTetromino.length; r++) {
        for (let c = 0; c < this.activeTetromino[r].length; c++) {
            if (this.activeTetromino[r][c]) {
                drawSquare(this.x + c, ghostY + r, 'rgba(255, 255, 255, 0.3)');
            }
        }
    }
}

// ランダムなテトリスブロックを生成
function randomPiece() {
    let r = Math.floor(Math.random() * PIECES.length);
    return new Piece(PIECES[r][0], PIECES[r][1]);
}

// 次のテトリスブロックを表示
function displayNextPiece() {
    nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextPiece.draw(nextContext);
}

// 保留ブロックを表示
function displayHoldPiece() {
    holdContext.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    holdPiece.draw(holdContext);
}

let p = randomPiece();
let nextPiece = randomPiece();
let holdPiece = null;
let holdUsed = false;
let score = 0;
let level = 1;

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
    } else if (event.keyCode == 67) { // 'C'キーでブロックを保留
        hold();
    }
}

// タッチコントロール
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

document.getElementById('holdButton').addEventListener('click', () => {
    hold();
});

function hold() {
    if (!holdUsed) {
        p.unDraw();
        if (holdPiece === null) {
            holdPiece = p;
            p = nextPiece;
            nextPiece = randomPiece();
            displayNextPiece();
        } else {
            let temp = p;
            p = holdPiece;
            holdPiece = temp;
        }
        holdPiece.x = 3;
        holdPiece.y = -2;
        displayHoldPiece();
        holdUsed = true;
    }
}

let dropStart = Date.now();

function drop() {
    if (gamePaused || gameOver) return;
    let now = Date.now();
    let delta = now - dropStart;
    if (delta > dropInterval) {
        p.moveDown();
        dropStart = Date.now();
    }
    if (!gameOver) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawBoard();
        p.drawGhost();
        p.draw();
        requestAnimationFrame(drop);
    }
}

displayNextPiece();
drop();
