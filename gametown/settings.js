let difficulty = '普通';
let soundOn = true;

document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('titleScreen').style.display = 'none';
    document.getElementById('game').style.display = 'flex';
    document.getElementById('controls').style.display = 'flex';
    initializeGame();
});

document.getElementById('difficultyButton').addEventListener('click', () => {
    if (difficulty === '簡単') {
        difficulty = '普通';
        dropInterval = 1000;
    } else if (difficulty === '普通') {
        difficulty = '難しい';
        dropInterval = 500;
    } else {
        difficulty = '簡単';
        dropInterval = 1500;
    }
    document.getElementById('difficultyButton').innerText = '難易度: ' + difficulty;
});

document.getElementById('soundButton').addEventListener('click', () => {
    soundOn = !soundOn;
    document.getElementById('soundButton').innerText = 'サウンド: ' + (soundOn ? 'オン' : 'オフ');
});

function togglePause() {
    paused = !paused;
    document.getElementById('pauseButton').innerText = paused ? '再開' : '一時停止';
}

function initializeGame() {
    p = randomPiece();
    nextPiece = randomPiece();
    drawNextBlock();
    score = 0;
    level = 1;
    scoreElement.innerHTML = "スコア: " + score;
    levelElement.innerHTML = "レベル: " + level;
    highScoreElement.innerHTML = "ハイスコア: " + highScore;
    dropStart = Date.now();
    gameOver = false;
    paused = false;
    drop();
}
