

function count0Bits(n) { // apparently this works https://en.wikipedia.org/wiki/Hamming_weight 
    n >>>= 0;
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    n = (n + (n >>> 4)) & 0x0F0F0F0F;
    n = n + (n >>> 8);
    n = n + (n >>> 16);
    return 32 - (n & 0x3F); 
}

class Grid { // what the optimization fuck
             // should cause no issues unless using an ancient browser that doesn't support 32 bits of number

    constructor() {
        this.b0 = this.b1 = 0;
    }

    setGrid(b0, b1) {
        this.b0 = b0;
        this.b1 = b1;
    }

    clone() {
        var g = new Grid();
        g.setGrid(this.b0, this.b1);
        return g;
    }

    shifted1(x, y) {
        if (y <= 3) {
            return (1 << (7 - x)) << ((3 - y) * 8);
        } else {
            return (1 << (7 - x)) << ((7 - y) * 8);
        }
    }

    // shorten these 3 maybe, idk, 2 if statements + most of the code shared seems a bit redundant (lambdas + other things to shorten a lot)

    isBlockThere(x, y) {
        if (x > 7 || y > 7 || x < 0 || y < 0) {
            return 1;
        }
        if (y <= 3) {
            return this.b0 & this.shifted1(x, y);
        } else {
            return this.b1 & this.shifted1(x, y);
        }
    }

    addBlock(x, y) {
        if (y <= 3) {
            this.b0 |= this.shifted1(x, y);
        } else {
            this.b1 |= this.shifted1(x, y);
        }
    }

    removeBlock(x, y) {
        if (y <= 3) {
            this.b0 &= ~this.shifted1(x, y);
        } else {
            this.b1 &= ~this.shifted1(x, y);
        }
    }

    toggleBlock(x, y) {
        if (y <= 3) {
            this.b0 ^= this.shifted1(x, y);
        } else {
            this.b1 ^= this.shifted1(x, y);
        }
    }

    toString() {
        var s = "";
        for (var y = 0; y < 8; y++) {
            for (var x = 0; x < 8; x++) {
                s += (this.isBlockThere(x, y) ? "#" : "-");
            }
            s += "\n";
        }
        return s;
    }

    getAmountEmpty() {
        var empty = 0;
        empty += count0Bits(this.b0);
        empty += count0Bits(this.b1);
        return empty;
    }

}

class Scoring {
    constructor(clearedLines, seperateClears, smallSpaces, amountEmpty) {
        this.clearedLines = clearedLines;
        this.seperateClears = seperateClears;
        this.smallSpaces = smallSpaces;
        this.amountEmpty = amountEmpty;
        this.totalScore = 0;
    }
}

class GameGrid extends Grid {

    constructor() {
        super();
        this.clearedLines = 0;
        this.seperateClears = 0;
    }

    clone() {
        var g = new GameGrid();
        g.setGrid(this.b0, this.b1);
        g.clearedLines = this.clearedLines;
        g.seperateClears = this.seperateClears;
        return g;
    }

    addBlock(x, y) {
        if (y <= 3) {
            this.b0 |= this.shifted1(x, y);
        } else {
            this.b1 |= this.shifted1(x, y);
        }
        var xNotFull = false;
        var yNotFull = false;
        for (var i = 0; i < 8; i++) {
            if (!this.isBlockThere(i, y)) {
                xNotFull = true;
                break;
            }
        }
        for (var i = 0; i < 8; i++) {
            if (!this.isBlockThere(x, i)) {
                yNotFull = true;
                break;
            }
        }
        if (!xNotFull) {
            this.clearedLines++;
            for (var i = 0; i < 8; i++) {
                this.removeBlock(i, y);
            }
        }
        if (!yNotFull) {
            this.clearedLines++;
            for (var i = 0; i < 8; i++) {
                this.removeBlock(x, i);
            }
        }
        return !xNotFull || !yNotFull;
    }

    doesPieceFit(piece, x, y) {
        var no = false;
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                if (this.isBlockThere(x + i, y + j) && piece.isBlockThere(i, j)) {
                    no = true;
                    break;
                }
            }
            if (no) {
                break;
            }
        }
        return !no;
    }

    placePiece(piece, x, y) { // assuming prior checks if fits
        var hasCleared = false;
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                if (piece.isBlockThere(i, j)) {
                    if (this.addBlock(x + i, y + j)) {
                        hasCleared = true;
                    }
                }
            }
        }
        if (hasCleared) {
            this.seperateClears += 1;
        }
    }

    getAvailablePositions(piece) {
        var available = [];
        for (var x = 0; x < 8; x++) {
            for (var y = 0; y < 8; y++) {
                if (this.doesPieceFit(piece, x, y)) {
                    available.push([x, y]);
                }
            }
        }
        return available;
    }

    allPossibleMoves(pieces) {
        var moves = [];
        var i = 0;
        for (var p of pieces) {
            for (var pos of this.getAvailablePositions(p)) {
                moves.push([i, pos[0], pos[1]]);
            }
            i++;
        }
        return moves;
    }

    getSmallSpaces() { // all empty spaces smaller than 3 blocks 

        var visited = new Grid();
        var smallSpaces = 0;

        var bfs = (grid, sx, sy) => {
            var queue = [ [ sx, sy ] ];
            var size = 0;
            visited.addBlock(sx, sy);

            while (queue.length > 0) {
                var [ x, y ] = queue.shift();
                size++;
                
                for (var [ dx, dy ] of [ [0, 1], [1, 0], [0, -1], [-1, 0] ]) {
                    var nx = x + dx;
                    var ny = y + dy;
                    if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && !grid.isBlockThere(nx, ny) && !visited.isBlockThere(nx, ny)) {
                        visited.addBlock(nx, ny);
                        queue.push([ nx, ny ]);
                    }
                }
            }
            return size;
        };

        for (var x = 0; x < 8; x++) {
            for (var y = 0; y < 8; y++) {
                if (!this.isBlockThere(x, y) && !visited.isBlockThere(x, y)) {
                    if (bfs(this, x, y) <= 3) {
                        smallSpaces++;
                    }
                }
            }
        }

        return smallSpaces;

    }

    bestMove(pieces) {

        var limitHit = false;
        var answers = 0;

        var possibleMoves = [];

        var allMoves = this.allPossibleMoves(pieces);

        if (allMoves.length != 0) {

            for (var move of allMoves) {

                if (limitHit) {
                    break;
                }

                var newGame = this.clone();
                newGame.placePiece(pieces[move[0]], move[1], move[2]);
                var newPieces = pieces.slice();
                newPieces.splice(move[0], 1);
    
                var allMoves2 = newGame.allPossibleMoves(newPieces);
                if (allMoves2.length != 0) {
                    for (var move2 of allMoves2) {
                        
                        if (limitHit) {
                            break;
                        }

                        var newGame2 = newGame.clone();
                        newGame2.placePiece(newPieces[move2[0]], move2[1], move2[2]);
                        var newPieces2 = newPieces.slice();
                        newPieces2.splice(move2[0], 1);

                        var allMoves3 = newGame2.allPossibleMoves(newPieces2);
                        if (allMoves3.length != 0) {
                            for (var move3 of allMoves3) {
                                var newGame3 = newGame2.clone();
                                newGame3.placePiece(newPieces2[move3[0]], move3[1], move3[2]);
        
                                var score = new Scoring(newGame3.clearedLines, newGame3.seperateClears, newGame3.getSmallSpaces(), newGame3.getAmountEmpty());
                                possibleMoves.push([ [ move, move2, move3 ], score ]);
                                answers++;

                                if (answers > answerLimit) {
                                    limitHit = true;
                                    break;
                                }
        
                            }
                        }
                    }
                }
            }
        }

        var minClearedLines = Infinity;
        var maxClearedLines = -Infinity;
        var minSeperateClears = Infinity;
        var maxSeperateClears = -Infinity;
        var minSmallSpaces = Infinity;
        var maxSmallSpaces = -Infinity;
        var minAmountEmpty = Infinity;
        var maxAmountEmpty = -Infinity;
        
        for (var score of possibleMoves.map(m => m[1])) {
            minClearedLines = Math.min(score.clearedLines, minClearedLines);
            maxClearedLines = Math.max(score.clearedLines, maxClearedLines);
            minSeperateClears = Math.min(score.seperateClears, minSeperateClears);
            maxSeperateClears = Math.max(score.seperateClears, maxSeperateClears);
            minSmallSpaces = Math.min(score.smallSpaces, minSmallSpaces);
            maxSmallSpaces = Math.max(score.smallSpaces, maxSmallSpaces);
            minAmountEmpty = Math.min(score.amountEmpty, minAmountEmpty);
            maxAmountEmpty = Math.max(score.amountEmpty, maxAmountEmpty);
        }
        
        for (var score of possibleMoves.map(m => m[1])) {
            score.clearedLines = ((score.clearedLines - minClearedLines) / (maxClearedLines - minClearedLines)) * clearedLinesWeight;
            score.seperateClears = ((score.seperateClears - minSeperateClears) / (maxSeperateClears - minSeperateClears)) * seperateClearsWeight;
            score.smallSpaces = (1 - (score.smallSpaces - minSmallSpaces) / (maxSmallSpaces - minSmallSpaces)) * smallSpacesWeight;
            score.amountEmpty = ((score.amountEmpty - minAmountEmpty) / (maxAmountEmpty - minAmountEmpty)) * amountEmptyWeight;
            score.totalScore = score.clearedLines + score.seperateClears + score.smallSpaces + score.amountEmpty;
        }

        possibleMoves.sort((a, b) => b[1].totalScore - a[1].totalScore);
        
        return possibleMoves.length > 0 ? possibleMoves[0][0] : null;

    }

}

var clearedLinesWeight = 1.8;
var seperateClearsWeight = 1.2;
var smallSpacesWeight = 1.1;
var amountEmptyWeight = 0.6;
var answerLimit = 500000;

class UISyncedGrid extends Grid { 

    constructor(elId, uiInputDisabled, lineClearingEnabled) {
        super();

        this.element = document.getElementById(elId);
        
        this.element.innerHTML = "<div></div>".repeat(64);

        this.lineClearingEnabled = lineClearingEnabled;

        if (!uiInputDisabled) {
            for (let x = 0; x < 8; x++) {
                for (let y = 0; y < 8; y++) {
                    this.gridItemAt(x, y).addEventListener("click", _ => {
                        this.toggleBlock(x, y);
                    });
                }
            }
        }
    }

    reloadUI() {

        for (var x = 0; x < 8; x++) {
            for (var y = 0; y < 8; y++) {
                this.gridItemAt(x, y).classList[this.isBlockThere(x, y) ? "add" : "remove"]("filled");
            }
        }

    }

    setGrid(b0, b1) {
        var res = super.setGrid(b0, b1);
        this.reloadUI();
        return res;
    }

    clearLines(x, y) {
        if (this.lineClearingEnabled) {
            var xNotFull = false;
            var yNotFull = false;
            for (var i = 0; i < 8; i++) {
                if (!this.isBlockThere(i, y)) {
                    xNotFull = true;
                    break;
                }
            }
            for (var i = 0; i < 8; i++) {
                if (!this.isBlockThere(x, i)) {
                    yNotFull = true;
                    break;
                }
            }
            if (!xNotFull) {
                this.clearedLines++;
                for (var i = 0; i < 8; i++) {
                    this.removeBlock(i, y);
                }
            }
            if (!yNotFull) {
                this.clearedLines++;
                for (var i = 0; i < 8; i++) {
                    this.removeBlock(x, i);
                }
            }
        }
    }

    addBlock(x, y) {
        var res = super.addBlock(x, y);
        this.gridItemAt(x, y).classList.add("filled");
        this.clearLines(x, y);
        return res;
    }

    removeBlock(x, y) {
        var res = super.removeBlock(x, y);
        this.gridItemAt(x, y).classList.remove("filled");
        return res;
    }

    toggleBlock(x, y) {
        var res = super.toggleBlock(x, y);
        this.gridItemAt(x, y).classList.toggle("filled");
        this.clearLines(x, y);
        return res;
    }

    gridItemAt(x, y) {
        return this.element.children.item(8 * y + x);
    }

}

class UISyncedGridWithGhosts extends UISyncedGrid {

    addGhostPiece(piece, x, y) {
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                if (piece.isBlockThere(i, j)) {
                    this.gridItemAt(x + i, y + j).classList.add("filled-transparent");
                }
            }
        }
    }

    clearAllGhosts() {
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                this.gridItemAt(i, j).classList.remove("filled-transparent");
            }
        }
    }

}

function pieceToCorner(piece) {

    var rowsEmpty = 0;
    var colsEmpty = 0;

    for (var y = 0; y < 8; y++) {
        var empty = true;
        for (var x = 0; x < 8; x++) {
            if (piece.isBlockThere(x, y)) {
                empty = false;
                break;
            }
        }
        if (empty) {
            rowsEmpty++;
        } else {
            break;
        }
    }

    for (var x = 0; x < 8; x++) {
        var empty = true;
        for (var y = 0; y < 8; y++) {
            if (piece.isBlockThere(x, y)) {
                empty = false;
                break;
            }
        }
        if (empty) {
            colsEmpty++;
        } else {
            break;
        }
    }

    for (var x = 0; x < 8; x++) {
        for (var y = 0; y < 8; y++) {
            if (piece.isBlockThere(x, y)) {
                piece.removeBlock(x, y);
                piece.addBlock(x - colsEmpty, y - rowsEmpty);
            }
        }
    }

}

var mainGrid = new UISyncedGrid("main-grid", false, true);
var piece0Grid = new UISyncedGrid("piece-grid-0");
var piece1Grid = new UISyncedGrid("piece-grid-1");
var piece2Grid = new UISyncedGrid("piece-grid-2");
var solution0Grid = new UISyncedGridWithGhosts("solution-grid-0", true);
var solution1Grid = new UISyncedGridWithGhosts("solution-grid-1", true);
var solution2Grid = new UISyncedGridWithGhosts("solution-grid-2", true);

var currentSolution = null;
var currentSolutionPieces = [];

function prepareSolution() {

    var ggrid = new GameGrid();
    ggrid.setGrid(mainGrid.b0, mainGrid.b1);
    
    var p0 = new Grid();
    p0.setGrid(piece0Grid.b0, piece0Grid.b1);
    pieceToCorner(p0);
    
    var p1 = new Grid();
    p1.setGrid(piece1Grid.b0, piece1Grid.b1);
    pieceToCorner(p1);
    
    var p2 = new Grid();
    p2.setGrid(piece2Grid.b0, piece2Grid.b1);
    pieceToCorner(p2);

    var bestMove = ggrid.bestMove([ p0, p1, p2 ]);

    currentSolution = bestMove;
    currentSolutionPieces = [ p0, p1, p2 ];

    if (bestMove) {

        var ggrid = new GameGrid();
        ggrid.setGrid(mainGrid.b0, mainGrid.b1);
        var tpieces = [ p0, p1, p2 ];
        solution0Grid.setGrid(ggrid.b0, ggrid.b1);
        solution0Grid.addGhostPiece(tpieces[currentSolution[0][0]], currentSolution[0][1], currentSolution[0][2]);
    
        ggrid.placePiece(tpieces[currentSolution[0][0]], currentSolution[0][1], currentSolution[0][2]);
        solution1Grid.setGrid(ggrid.b0, ggrid.b1);
        tpieces.splice(currentSolution[0][0], 1);
        solution1Grid.addGhostPiece(tpieces[currentSolution[1][0]], currentSolution[1][1], currentSolution[1][2]);
    
        ggrid.placePiece(tpieces[currentSolution[1][0]], currentSolution[1][1], currentSolution[1][2]);
        solution2Grid.setGrid(ggrid.b0, ggrid.b1);
        tpieces.splice(currentSolution[1][0], 1);
        solution2Grid.addGhostPiece(tpieces[currentSolution[2][0]], currentSolution[2][1], currentSolution[2][2]);
        
    }

    document.getElementById("solution-overlay").classList.remove("hidden");
    document.getElementById("solution-status").innerHTML = (bestMove ? "" : "No ") + "Solution Found";

}

function acceptSolution() {

    if (!currentSolution) {
        return;
    }

    var ggrid = new GameGrid();
    ggrid.setGrid(mainGrid.b0, mainGrid.b1);
    ggrid.placePiece(currentSolutionPieces[currentSolution[0][0]], currentSolution[0][1], currentSolution[0][2]);
    currentSolutionPieces.splice(currentSolution[0][0], 1);
    ggrid.placePiece(currentSolutionPieces[currentSolution[1][0]], currentSolution[1][1], currentSolution[1][2]);
    currentSolutionPieces.splice(currentSolution[1][0], 1);
    ggrid.placePiece(currentSolutionPieces[currentSolution[2][0]], currentSolution[2][1], currentSolution[2][2]);
    currentSolutionPieces.splice(currentSolution[2][0], 1);

    mainGrid.setGrid(ggrid.b0, ggrid.b1);

    piece0Grid.setGrid(0, 0);
    piece1Grid.setGrid(0, 0);
    piece2Grid.setGrid(0, 0);
    solution0Grid.setGrid(0, 0);
    solution1Grid.setGrid(0, 0);
    solution2Grid.setGrid(0, 0);
    solution0Grid.clearAllGhosts();
    solution1Grid.clearAllGhosts();
    solution2Grid.clearAllGhosts();

    currentSolution = null;

}

function closeSolutions() {
    solution0Grid.clearAllGhosts();
    solution1Grid.clearAllGhosts();
    solution2Grid.clearAllGhosts();
    document.getElementById('solution-overlay').classList.add('hidden');
}