
let deck = [];
let playerHand = [];
let dealerHand = [];
let playerScore = 0;
let dealerScore = 0;
let playerBalance = 10000;
let currentBet = 100;

// カードデッキを初期化
function initializeDeck() {
    const suits = ['ハート', 'ダイヤ', 'スペード', 'クラブ'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    deck = []; // デッキをリセット
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
}

// カードデッキからランダムにカードを1枚取得
function drawCard() {
    const randomIndex = Math.floor(Math.random() * deck.length);
    return deck.splice(randomIndex, 1)[0];
}

// カードの値を計算
function calculateCardValue(card) {
    if (card.rank === 'A') return 11; // エースは11として計算
    if (['K', 'Q', 'J'].includes(card.rank)) return 10; // 絵札は10として計算
    return parseInt(card.rank); // それ以外の数字はその数値として計算
}

// 手札の合計値を計算
function calculateHandValue(hand) {
    let value = 0;
    let aceCount = 0;

    for (const card of hand) {
        value += calculateCardValue(card);
        if (card.rank === 'A') aceCount++;
    }

    // エースの扱いを調整
    while (aceCount > 0 && value > 21) {
        value -= 10;
        aceCount--;
    }

    return value;
}

// ゲームを開始
function startGame() {
    initializeDeck();
    playerHand = [drawCard(), drawCard()];
    dealerHand = [drawCard(), drawCard()];
    playerScore = calculateHandValue(playerHand);
    dealerScore = calculateHandValue(dealerHand);

    // プレイヤーのカードを表示
    document.getElementById('player-hand').innerHTML = '';
    for (const card of playerHand) {
        updateCardDisplay(card, 'player-hand');
    }

    // ディーラーの最初のカードを表示（2枚目は伏せておく）
    document.getElementById('dealer-hand').innerHTML = '';
    updateCardDisplay(dealerHand[0], 'dealer-hand');
    const holeCard = document.createElement('div');
    holeCard.className = 'card hole-card';
    document.getElementById('dealer-hand').appendChild(holeCard);

    // ボタンの状態を更新
    document.getElementById('deal-button').disabled = true;
    document.getElementById('hit-button').disabled = false;
    document.getElementById('stand-button').disabled = false;

    // スコアを表示
    document.getElementById('player-score').textContent = playerScore;
    document.getElementById('dealer-score').textContent = '?'; // ディーラーの2枚目のカードは伏せている

    // ゲームメッセージをクリア
    document.getElementById('game-message').textContent = '';
}

// プレイヤーがヒットする処理
function hit() {
    const card = drawCard();
    playerHand.push(card);
    playerScore = calculateHandValue(playerHand);

    // プレイヤーのカードを表示
    updateCardDisplay(card, 'player-hand');

    // スコアを表示
    document.getElementById('player-score').textContent = playerScore;

    if (playerScore > 21) {
        endGame('ディーラーの勝利');
        playerBalance -= currentBet;
        updatePlayerBalance();
    }
}

// プレイヤーがスタンドする処理
function stand() {
    while (calculateHandValue(dealerHand) < 17) {
        const card = drawCard();
        dealerHand.push(card);

        // ディーラーのカードを表示
        updateCardDisplay(card, 'dealer-hand');
    }

    dealerScore = calculateHandValue(dealerHand);
    document.getElementById('dealer-score').textContent = dealerScore;
 
    if (dealerScore > 21 || dealerScore < playerScore) {
        endGame('プレイヤーの勝利');
        playerBalance += currentBet * 2;
        updatePlayerBalance();
    } else if (dealerScore > playerScore) {
        endGame('ディーラーの勝利');
        playerBalance -= currentBet;
        updatePlayerBalance();
    } else {
        endGame('引き分け');
    }
}

// ゲーム終了
function endGame(message) {
    // ボタンの状態を更新
    document.getElementById('deal-button').disabled = false;
    document.getElementById('hit-button').disabled = true;
    document.getElementById('stand-button').disabled = true;

    // ゲームメッセージを表示
    document.getElementById('game-message').textContent = message;
}

// カードの表示を更新する関数
function updateCardDisplay(card, containerId) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    const cardValue = getCardValue(card.rank);
    const suitSymbol = getSuitSymbol(card.suit);
    const cardColor = (card.suit === 'ハート' || card.suit === 'ダイヤ') ? 'red' : 'White';

    cardElement.innerHTML = `
        <div class="number top-left ${cardColor}">${cardValue}</div>
        <div class="number bottom-right ${cardColor}">${cardValue}</div>
        <div class="suit ${cardColor}">${suitSymbol}</div>
    `;
    document.getElementById(containerId).appendChild(cardElement);
}

// カードの値を取得する関数
function getCardValue(rank) {
    switch (rank) {
        case 'A': return 'A';
        case 'K': return 'K';
        case 'Q': return 'Q';
        case 'J': return 'J';
        default: return rank;
    }
}

// 絵柄のシンボルを取得する関数
function getSuitSymbol(suit) {
    switch (suit) {
        case 'ハート': return '♥';
        case 'ダイヤ': return '♦';
        case 'スペード': return '♠';
        case 'クラブ': return '♣';
        default: return '';
    }
}

// 賭け点の変更時に呼ばれる関数
function changeBet() {
    currentBet = parseInt(document.getElementById('bet-select').value);
}

// 持ち点の表示を更新
function updatePlayerBalance() {
    document.getElementById('player-balance').textContent = playerBalance;
}

// セレクトボックスのイベントリスナーを追加
document.getElementById('bet-select').addEventListener('change', changeBet);

// 初期表示
updatePlayerBalance();
