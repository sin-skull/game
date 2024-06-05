
        const gameInfo = document.getElementById('gameInfo');
        const restartButton = document.querySelector('button');
        let playerScore = 0;
        let computerScore = 0;

        document.addEventListener('DOMContentLoaded', () => {
            const gameBoard = document.getElementById('gameBoard');
            const boardSize = 8;
            let board = [];
            let currentColor = 'black';

            function initBoard() {
                for (let i = 0; i < boardSize; i++) {
                    board[i] = [];
                    for (let j = 0; j < boardSize; j++) {
                        board[i][j] = null;
                        let cell = document.createElement('div');
                        cell.classList.add('cell');
                        cell.dataset.row = i;
                        cell.dataset.col = j;
                        cell.addEventListener('click', handleCellClick);
                        gameBoard.appendChild(cell);
                    }
                }

                placeDisc(3, 3, 'white');
                placeDisc(4, 4, 'white');
                placeDisc(3, 4, 'black');
                placeDisc(4, 3, 'black');
                updateGameInfo();
            }

            function handleCellClick(e) {
                let row = parseInt(e.target.dataset.row);
                let col = parseInt(e.target.dataset.col);
                if (isValidMove(row, col, currentColor)) {
                    placeDisc(row, col, currentColor);
                    flipDiscs(row, col, currentColor);
                    currentColor = currentColor === 'black' ? 'white' : 'black';
                    if (!hasValidMove(currentColor)) {
                        currentColor = currentColor === 'black' ? 'white' : 'black';
                        if (!hasValidMove(currentColor)) {
                            endGame();
                        }
                    }
                    updateGameInfo();
                    setTimeout(computerMove, 1000);
                }
            }

            function placeDisc(row, col, color) {
                let disc = document.createElement('div');
                disc.classList.add('disc', color);
                board[row][col] = color;
                gameBoard.children[row * boardSize + col].appendChild(disc);
            }

            function isValidMove(row, col, color) {
                if (board[row][col] !== null) {
                    return false;
                }

                let directions = [
                    { dr: -1, dc: 0 },
                    { dr: 1, dc: 0 },
                    { dr: 0, dc: -1 },
                    { dr: 0, dc: 1 },
                    { dr: -1, dc: -1 },
                    { dr: -1, dc: 1 },
                    { dr: 1, dc: -1 },
                    { dr: 1, dc: 1 }
                ];

                let valid = false;

                for (let direction of directions) {
                    let r = row + direction.dr;
                    let c = col + direction.dc;
                    let foundOpposite = false;

                    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                        if (board[r][c] === null) {
                            break;
                        } else if (board[r][c] === color) {
                            if (foundOpposite) {
                                valid = true;
                            }
                            break;
                        } else {
                            foundOpposite = true;
                        }
                        r += direction.dr;
                        c += direction.dc;
                    }
                }

                return valid;
            }

            function flipDiscs(row, col, color) {
                let directions = [
                    { dr: -1, dc: 0 },
                    { dr: 1, dc: 0 },
                    { dr: 0, dc: -1 },
                    { dr: 0, dc: 1 },
                    { dr: -1, dc: -1 },
                    { dr: -1, dc: 1 },
                    { dr: 1, dc: -1 },
                    { dr: 1, dc: 1 }
                ];

                for (let direction of directions) {
                    let r = row + direction.dr;
                    let c = col + direction.dc;
                    let discsToFlip = [];

                    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                        if (board[r][c] === null) {
                            break;
                        } else if (board[r][c] === color) {
                            if (discsToFlip.length > 0) {
                                for (let disc of discsToFlip) {
                                    flipDisc(disc.row, disc.col, color);
                                }
                                break;
                            }
                        } else {
                            discsToFlip.push({ row: r, col: c });
                        }
                        r += direction.dr;
                        c += direction.dc;
                    }
                }
            }

            function flipDisc(row, col, color) {
                board[row][col] = color;
                let discElement = gameBoard.children[row * boardSize + col].querySelector('.disc');
                if (discElement) {
                    discElement.className = `disc ${color}`;
                }
            }

            function hasValidMove(color) {
                for (let row = 0; row < boardSize; row++) {
                    for (let col = 0; col < boardSize; col++) {
                        if (isValidMove(row, col, color)) {
                            return true;
                        }
                    }
                }
                return false;
            }

            function computerMove() {
                let validMoves = [];
                for (let row = 0; row < boardSize; row++) {
                    for (let col = 0; col < boardSize; col++) {
                        if (isValidMove(row, col, 'white')) {
                            validMoves.push({ row, col });
                        }
                    }
                }

                if (validMoves.length > 0) {
                    let randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                    placeDisc(randomMove.row, randomMove.col, 'white');
                    flipDiscs(randomMove.row, randomMove.col, 'white');
                    currentColor = 'black';
                } else {
                    if (!hasValidMove('black')) {
                        endGame();
                    } else {
                        currentColor = 'black';
                    }
                }
                updateGameInfo();
            }

            function endGame() {
                let blackCount = 0;
                let whiteCount = 0;
                for (let row = 0; row < boardSize; row++) {
                    for (let col = 0; col < boardSize; col++) {
                        if (board[row][col] === 'black') {
                            blackCount++;
                        } else if (board[row][col] === 'white') {
                            whiteCount++;
                        }
                    }
                }

                let resultMessage = '';
                if (blackCount > whiteCount) {
                    resultMessage = `Player wins! Black: ${blackCount}, White: ${whiteCount}`;
                    playerScore++;
                } else if (whiteCount > blackCount) {
                    resultMessage = `Computer wins! White: ${whiteCount}, Black: ${blackCount}`;
                    computerScore++;
                } else {
                    resultMessage = `It's a tie! Black: ${blackCount}, White: ${whiteCount}`;
                }

                alert(resultMessage);
                updateGameInfo();
            }

            function updateGameInfo() {
                gameInfo.textContent = `${currentColor === '黒' ? "あなたのターン" : "相手のターン"} | 自分: ${playerScore}, 相手: ${computerScore}`;
            }

            function restartGame() {
                gameBoard.innerHTML = '';
                board = [];
                currentColor = 'black';
                initBoard();
                playerScore = 0;
                computerScore = 0;
                updateGameInfo();
            }

            initBoard();
        });
   
        // Your existing JavaScript code here
        // ...

        let playerPieces = 2; // Initial player piece count
        let computerPieces = 2; // Initial computer piece count

        function initBoard() {
            // ... Your existing initBoard function ...

            // Update the piece counters
            updatePieceCounters();
        }

        
        function placeDisc(row, col, color) {
            // ... Your existing placeDisc function ...

            // Update the piece counters
            if (color === 'black') {
                playerPieces++;
            } else {
                computerPieces++;
            }
            updatePieceCounters();
        }

        function flipDisc(row, col, color) {
            // ... Your existing flipDisc function ...

            // Update the piece counters
            if (color === 'black') {
                playerPieces++;
                computerPieces--;
            } else {
                playerPieces--;
                computerPieces++;
            }
            updatePieceCounters();
        }

        function endGame() {
            // ... Your existing endGame function ...

            // Update the piece counters
            updatePieceCounters();
        }
  
        // Your existing JavaScript code here
        // ...


        function initBoard() {
            // ... Your existing initBoard function ...

            // Update the piece counters
            updatePieceCounters();
        }

        function updatePieceCounters() {
            const playerCounter = document.getElementById('playerCounter');
            const computerCounter = document.getElementById('computerCounter');
            playerCounter.textContent = `Player: ${playerPieces}`;
            computerCounter.textContent = `Computer: ${computerPieces}`;
        }

        function placeDisc(row, col, color) {
            // ... Your existing placeDisc function ...

            // Update the piece counters
            if (color === 'black') {
                playerPieces++;
            } else {
                computerPieces++;
            }
            updatePieceCounters();
        }

        function flipDisc(row, col, color) {
            // ... Your existing flipDisc function ...

            // Update the piece counters
            if (color === 'black') {
                playerPieces++;
                computerPieces--;
            } else {
                playerPieces--;
                computerPieces++;
            }
            updatePieceCounters();
        }

        function endGame() {
        
            // ... Your existing endGame function ...

            // Update the piece counters
            updatePieceCounters();
        }
   