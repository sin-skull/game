
let currentPoints = 10000;
let currentBet = 10;
let records = [];
let recordTable = document.getElementById('recordTable');

// 役の回数を記録するオブジェクト
let recordCounts = {
    'ピンゾロ': 0,
    'ぞろ目': 0,
    'ヒフミ': 0,
    'シゴロ': 0,
    '役なし': 0
};

function rollDices() {
    if (currentPoints < currentBet) {
        alert("持ち点が不足しています。");
        return;
    }

    currentPoints -= currentBet;
    updatePointsDisplay();

    let diceValues = [];
    for (let i = 1; i <= 3; i++) {
        let dice = document.getElementById('dice' + i);
        dice.innerHTML = '';
        let diceValue = Math.floor(Math.random() * 6) + 1;
        diceValues.push(diceValue);
        for (let j = 0; j < diceValue; j++) {
            let dot = document.createElement('span');
            dot.className = 'dot';
            dice.appendChild(dot);
        }
        positionDots(dice);
    }
    let result = checkResult(diceValues);
    records.push({ diceValues, score: currentBet, result });
    if (records.length > 10) {
        records.shift();
    }
    updateRecordsDisplay();
}

function rollTenTimes() {
    for (let i = 0; i < 10; i++) {
        rollDices();
    }
}

function positionDots(dice) {
    const dots = dice.getElementsByClassName('dot');
    const positions = [
        ['center'],
        ['top-left', 'bottom-right'],
        ['top-left', 'center', 'bottom-right'],
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
        ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
    ];

    const currentPositions = positions[dots.length - 1];
    for (let i = 0; i < dots.length; i++) {
        dots[i].classList.add(currentPositions[i]);
        dots[i].style.display = 'block';
    }
}

function checkResult(values) {
    values.sort();
    let resultText = "";
    let multiplier = 0;

    if (values[0] === values[1] && values[1] === values[2]) {
         if (values[0] === 1) {
            resultText = "ピンゾロ";
            multiplier = 5;
            document.body.style.backgroundImage = "url('5bai.png')";
        } else {
            resultText = "ぞろ目";
            multiplier = 3;
            document.body.style.backgroundImage = "url('3bai.png')";
        }
    } else if (values.includes(1) && values.includes(2) && values.includes(3)) {
        resultText = "ヒフミ";
        multiplier = 2;
        document.body.style.backgroundImage = "url('2bai.png')";
    } else if (values.includes(4) && values.includes(5) && values.includes(6)) {
        resultText = "シゴロ";
        multiplier = 2;
        document.body.style.backgroundImage = "url('2bai.png')";
    } else {
        resultText = "役なし";
        multiplier = 0;
        document.body.style.backgroundImage = "url('0bai.png')";
    }

    // 役の回数を更新
    recordCounts[resultText]++;

    document.getElementById('result').innerText = "結果: " + resultText + " (倍数: " + multiplier + ")";
    currentPoints += currentBet * multiplier;
    updatePointsDisplay();
    return resultText;
}

function updatePointsDisplay() {
    document.getElementById('points').innerText = "持ち点: " + currentPoints + "点";
}

function updateRecordsDisplay() {
    // レコードテーブルをクリア
    recordTable.innerHTML = '<tr><th>役</th><th>回数</th></tr>';

    // 役の回数を表示
    for (let key in recordCounts) {
        let row = recordTable.insertRow();
        let cell1 = row.insertCell(0);
        let cell2 = row.insertCell(1);
        cell1.innerHTML = key;
        cell2.innerHTML = recordCounts[key];
    }
}

document.getElementById('bet').addEventListener('change', function () {
    currentBet = parseInt(this.value);
});
