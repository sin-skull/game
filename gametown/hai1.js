
        let card = 1; // 場にあるトランプのカード番号
        let totalPoints = 10000; // 持ち点
        let betPoints = 0; // 賭け点

        function updateCardDisplay(cardNumber, elementId) {
            // カードの絵柄と色を決定
            let suit, color;
            if (cardNumber <= 13) {
                suit = '♦︎';
                color = 'red';
            } else if (cardNumber <= 26) {
                suit = '♥︎';
                color = 'red';
                cardNumber -= 13;
            } else if (cardNumber <= 39) {
                suit = '♣︎';
                color = 'black';
                cardNumber -= 26;
            } else {
                suit = '♠︎';
                color = 'black';
                cardNumber -= 39;
            }

            // カードの表示を更新
            let cardHtml = "<div class='number top-left' style='color: " + color + "'>" + cardNumber + suit + "</div>";
            cardHtml += "<div class='number bottom-right' style='color: " + color + "'>" + cardNumber + suit + "</div>";
            document.getElementById(elementId).innerHTML = cardHtml;
        }

       
        function High_Low(Hi_L) {
            // 賭け点の入力チェック
            betPoints = parseInt(document.getElementById("betInput").value);
            if (isNaN(betPoints) || betPoints <= 0 || betPoints > totalPoints) {
                alert("無効な賭け点です。1から" + totalPoints + "の範囲で入力してください。");
                return;
            }

            // 新しいカードをランダムに選ぶ
            let newCard = Math.floor(Math.random() * 13) + 1;
            updateCardDisplay(newCard, "Card_img_After");

            // 勝ち負けの判定
            let win = false;
            if (Hi_L === 1 && newCard > card || Hi_L === 0 && newCard < card) {
                win = true;
            }

            // 結果の更新
            if (win) {
                totalPoints += betPoints;
                alert("勝ち！賭け点が倍になりました。");
            } else {
                totalPoints -= betPoints;
                alert("負け…賭け点を失いました。");
            }

            // 持ち点の表示を更新
            document.getElementById("pointsDisplay").textContent = "持ち点: " + totalPoints + "点";

            // 次のカードを現在のカードとして設定
            card = newCard;
            calculateWinningProbability();
        }

        window.onload = function() {
            updateCardDisplay(card, "Card_img_Before");
            calculateWinningProbability();
        };
  