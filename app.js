let userScore = 0;
let computerScore = 0;

// DOM elements
const userScore_span = document.getElementById('user-score');
const computerScore_span = document.getElementById('computer-score');
const result_p = document.getElementById('resultText');
const action_msg = document.getElementById('action-msg');
const rock_div = document.getElementById('r');
const paper_div = document.getElementById('p');
const scissors_div = document.getElementById('s');
const connectBtn = document.getElementById('connectBtn');
const walletAddressSpan = document.getElementById('walletAddress');
const betAmountText = document.getElementById('betAmountText');

// Web3 / ethers state
let provider;
let signer;
let contract;

// Must match BET_AMOUNT in contract (0.0001 ether)
const BET_AMOUNT = "0.0001";

// TODO: replace this with your deployed contract address from Remix
const contractAddress = "0xF3a38CA80918ec6E9ee80151D624d07e51068556";

// TODO: in Remix, after compiling, copy the ABI JSON and paste it here:
const contractABI = [
    {
        "inputs": [],
        "name": "fundContract",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "player",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint8",
                "name": "playerMove",
                "type": "uint8"
            },
            {
                "indexed": false,
                "internalType": "uint8",
                "name": "computerMove",
                "type": "uint8"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "result",
                "type": "string"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amountWon",
                "type": "uint256"
            }
        ],
        "name": "GamePlayed",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "uint8",
                "name": "_playerMove",
                "type": "uint8"
            }
        ],
        "name": "play",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "betAmount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "contractBalance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]
function convertToWord(letter) {
    if (letter === 'r') return "Rock";
    if (letter === 'p') return "Paper";
    return "Scissors";
}

function moveToEnumIndex(letter) {
    // enum Move { Rock, Paper, Scissors } => 0,1,2
    if (letter === 'r') return 0;
    if (letter === 'p') return 1;
    return 2;
}

function enumIndexToLetter(idx) {
    if (idx === 0) return 'r';
    if (idx === 1) return 'p';
    return 's';
}

function setChoicesDisabled(disabled) {
    [rock_div, paper_div, scissors_div].forEach(c => {
        if (disabled) c.classList.add('disabled');
        else c.classList.remove('disabled');
    });
}

async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        alert("MetaMask (or another Web3 wallet) is required to play this game.");
        return;
    }

    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();

        const address = await signer.getAddress();
        walletAddressSpan.textContent = address.slice(0, 6) + "..." + address.slice(-4);

        contract = new ethers.Contract(contractAddress, contractABI, signer);

        // Optional: read bet from contract so UI is always in sync
        const bet = await contract.betAmount();

        betAmountText.textContent = ethers.utils.formatEther(bet) + " tBNB";

        result_p.textContent = "Wallet connected. Choose Rock, Paper, or Scissors.";
        action_msg.textContent = "Each round is a blockchain transaction. Please wait for confirmation.";

    } catch (err) {
        console.error(err);
        result_p.textContent = "Failed to connect wallet. Check console.";
    }
}

async function game(userChoice) {
    if (!contract || !signer) {
        result_p.textContent = "Please connect your wallet first.";
        return;
    }

    const moveIndex = moveToEnumIndex(userChoice);

    try {
        // Disable choices to prevent multiple clicks
        setChoicesDisabled(true);

        const tx = await contract.play(moveIndex, {
            value: ethers.utils.parseEther("0.0001") // Fixed bet size
        });

        // Wait for the transaction to be mined
        await tx.wait();

        // Fetch the last game result after the transaction
        const player = await signer.getAddress();
        const last = await contract.getLastGame(player); // изменили на getLastGame

        // If `getLastGame` returns a struct, extract values correctly
        const cpuIdx = last.computerMove; // это уже напрямую возвращает нужное значение
        const resultIndex = last.result;

        // Convert the move from the contract index (0=rock, 1=paper, 2=scissors)
        const cpuMove = parseInt(cpuIdx);
        const cpuChoice = cpuMove === 0 ? 'r' : cpuMove === 1 ? 'p' : 's';

        // Determine win/loss/draw
        if (resultIndex === 2) userScore++;
        if (resultIndex === 1) { /* Draw, do nothing to scores */ }
        if (resultIndex === 0) computerScore++;

        userScore_span.textContent = userScore;
        computerScore_span.textContent = computerScore;

        result_p.textContent = `${convertToWord(userChoice)} vs ${convertToWord(cpuChoice)} → ${resultIndex === 2 ? "win" : "lose"}`;
        action_msg.textContent = "Play again when you're ready.";

    } catch (err) {
        console.error(err);
        result_p.textContent = "Transaction failed.";
        action_msg.textContent = "Check wallet, network, or contract status.";
    } finally {
        // Re-enable choices after transaction is done
        setChoicesDisabled(false);
    }
}


function convertToWord(letter) {
    if (letter === 'r') return "Rock";
    if (letter === 'p') return "Paper";
    return "Scissors";
}

function moveToEnumIndex(letter) {
    if (letter === 'r') return 0;
    if (letter === 'p') return 1;
    return 2;
}

function enumIndexToLetter(idx) {
    if (idx === 0) return 'r';
    if (idx === 1) return 'p';
    return 's';
}

// Disable buttons during transaction to prevent spam
function setChoicesDisabled(disabled) {
    const choices = [rock_div, paper_div, scissors_div];
    choices.forEach(c => {
        if (disabled) {
            c.classList.add('disabled');
        } else {
            c.classList.remove('disabled');
        }
    });
}

function main() {
    connectBtn.addEventListener('click', connectWallet);

    rock_div.addEventListener('click', async() => await game('r'));
    paper_div.addEventListener('click', async() => await game('p'));
    scissors_div.addEventListener('click', async() => await game('s'));
}

main();