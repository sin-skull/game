
// スロットゲームのJavaScriptコード
const symbols = ['🍒', '🍋', '🍇', '🍊', '🍉'];
let playerPoints = 10000; // プレイヤーの初期ポイント

// 絵柄の回数をカウントするオブジェクト
const symbolCounts = {
    '🍒': 0,
    '🍋': 0,
    '🍇': 0,
    '🍊': 0,
    '🍉': 0
};

function spin() {
    if (playerPoints <= 0) {
        document.getElementById('resultMessage').textContent = '持ち点が不足しています。';
        return;
    }

    playerPoints--; // スピンごとにポイントを減らす

    const result = [];
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * symbols.length);
        const symbol = symbols[randomIndex];
        result.push(symbol);
        // 絵柄の回数をカウント
        symbolCounts[symbol]++;
    }

    document.getElementById('slot1').textContent = result[0];
    document.getElementById('slot2').textContent = result[1];
    document.getElementById('slot3').textContent = result[2];

    // 結果を判定するロジック
    if (result[0] === result[1] && result[1] === result[2]) {
        playerPoints += 100; // 3つ揃った場合、ポイントを増やす
        document.getElementById('resultMessage').textContent = 'おめでとうございます！3つが揃いました！';
    } else {
        document.getElementById('resultMessage').textContent = '残念、もう一度挑戦しよう！';
    }

    // プレイヤーのポイントを更新
    document.getElementById('playerPoints').textContent = `持ち点: ${playerPoints}`;

    // 絵柄の回数と確率を更新
    updateSymbolCountsAndRates();
}

function spinTenTimes() {
    if (playerPoints < 10) {
        document.getElementById('resultMessage').textContent = '持ち点が不足しています。';
        return;
    }

    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            spin(); // 10回連続でスピン
        }, i * 1000); // 1秒ごとに実行
    }
}

function updateSymbolCountsAndRates() {
let totalSpins = 0;
for (const symbol of symbols) {
totalSpins += symbolCounts[symbol];
}

for (const symbol of symbols) {
const countElement = document.getElementById(`symbol${symbol}Count`);
const rateElement = document.getElementById(`symbol${symbol}Rate`);

const count = symbolCounts[symbol];
const rate = (count / totalSpins * 100).toFixed(2); // 確率を計算

countElement.textContent = count;
rateElement.textContent = rate + '%'; // パーセンテージ形式で表示
}
}


document.getElementById('spinButton').addEventListener('click', spin);
document.getElementById('spinTenButton').addEventListener('click', spinTenTimes);
