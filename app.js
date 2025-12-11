let userScore = 0;
let computerScore = 0;

const userScoreSpan = document.getElementById("user-score");
const computerScoreSpan = document.getElementById("computer-score");
const resultText = document.getElementById("resultText");
const actionMsg = document.getElementById("action-msg");
const rockDiv = document.getElementById("r");
const paperDiv = document.getElementById("p");
const scissorsDiv = document.getElementById("s");
const connectBtn = document.getElementById("connectBtn");
const walletAddressSpan = document.getElementById("walletAddress");
const betAmountText = document.getElementById("betAmountText");
const historyList = document.getElementById("historyList");

let provider;
let signer;
let contract;
let currentAddress = null;
let currentHistory = [];

const BET_AMOUNT = "0.0001";

const contractAddress = "0xF26E2c96fe430327B66C2378dC03BACB794EDfdC";

const contractABI = [
  {
    inputs: [{ internalType: "uint8", name: "_playerMove", type: "uint8" }],
    name: "play",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "betAmount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "player",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "playerMove",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "computerMove",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "string",
        name: "result",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amountWon",
        type: "uint256",
      },
    ],
    name: "GamePlayed",
    type: "event",
  },
];

// Move conversion helpers
function convertToWord(letter) {
  if (letter === "r") return "Rock";
  if (letter === "p") return "Paper";
  return "Scissors";
}

function moveToEnumIndex(letter) {
  if (letter === "r") return 0;
  if (letter === "p") return 1;
  return 2;
}

function enumIndexToLetter(idx) {
  if (idx === 0) return "r";
  if (idx === 1) return "p";
  return "s";
}

function setChoicesDisabled(disabled) {
  [rockDiv, paperDiv, scissorsDiv].forEach((el) => {
    if (disabled) el.classList.add("disabled");
    else el.classList.remove("disabled");
  });
}

function historyKey(address) {
  return `rps_history_${address.toLowerCase()}`;
}

function loadHistory(address) {
  historyList.innerHTML = "";
  currentHistory = [];

  const saved = localStorage.getItem(historyKey(address));
  if (!saved) {
    renderHistory();
    return;
  }

  try {
    currentHistory = JSON.parse(saved);
  } catch (_) {
    currentHistory = [];
  }

  renderHistory();
}

function saveHistory(address) {
  localStorage.setItem(historyKey(address), JSON.stringify(currentHistory));
}

function shortenHash(hash) {
  return hash.slice(0, 6) + "..." + hash.slice(-4);
}

function renderHistory() {
  historyList.innerHTML = "";

  if (currentHistory.length === 0) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.textContent = "No games played yet.";
    historyList.appendChild(li);
    return;
  }

  [...currentHistory].reverse().forEach((entry) => {
    const li = document.createElement("li");
    li.className = "history-item";

    li.innerHTML = `
            <span><span class="label">Result:</span> ${entry.result.toUpperCase()}</span>
            <span><span class="label">You:</span> ${entry.playerMove} | 
                  <span class="label">Computer:</span> ${
                    entry.computerMove
                  }</span>
            <span><span class="label">Amount won:</span> ${
              entry.amountWon
            } tBNB</span>
            <span><span class="label">Tx:</span> 
              <a href="https://testnet.bscscan.com/tx/${
                entry.txHash
              }" target="_blank">
                ${shortenHash(entry.txHash)}
              </a>
            </span>
            <span><span class="label">Time:</span> ${entry.timestamp}</span>
        `;
    historyList.appendChild(li);
  });
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask is required!");
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();

  currentAddress = await signer.getAddress();
  walletAddressSpan.textContent =
    currentAddress.slice(0, 6) + "..." + currentAddress.slice(-4);

  contract = new ethers.Contract(contractAddress, contractABI, signer);

  const betFromContract = await contract.betAmount();
  betAmountText.textContent =
    ethers.utils.formatEther(betFromContract) + " tBNB";

  resultText.textContent = "Wallet connected. Choose your move!";
  actionMsg.textContent = "Each round is an on-chain transaction.";

  loadHistory(currentAddress);
}

async function game(userChoiceLetter) {
  if (!contract || !signer) {
    resultText.textContent = "Please connect your wallet first.";
    return;
  }

  const moveIndex = moveToEnumIndex(userChoiceLetter);

  try {
    setChoicesDisabled(true);

    const tx = await contract.play(moveIndex, {
      value: ethers.utils.parseEther(BET_AMOUNT),
    });

    resultText.textContent = "Waiting for transaction confirmation…";

    const receipt = await tx.wait();

    const event = receipt.events?.find((e) => e.event === "GamePlayed");
    if (!event) {
      resultText.textContent = "Game finished, but event not found.";
      return;
    }

    const playerMove = enumIndexToLetter(event.args.playerMove);
    const cpuMove = enumIndexToLetter(event.args.computerMove);
    const result = event.args.result;
    const wonAmount = ethers.utils.formatEther(event.args.amountWon);

    if (result === "win") userScore++;
    else if (result === "lose") computerScore++;

    userScoreSpan.textContent = userScore;
    computerScoreSpan.textContent = computerScore;

    resultText.textContent = `${convertToWord(
      userChoiceLetter
    )} vs ${convertToWord(cpuMove)} → ${result.toUpperCase()}`;

    // Save to history
    const entry = {
      playerMove: convertToWord(playerMove),
      computerMove: convertToWord(cpuMove),
      result: result,
      amountWon: wonAmount,
      txHash: receipt.transactionHash,
      timestamp: new Date().toLocaleString(),
    };

    currentHistory.push(entry);
    saveHistory(currentAddress);
    renderHistory();
  } catch (err) {
    console.error(err);
    resultText.textContent = "Transaction failed.";
  } finally {
    setChoicesDisabled(false);
  }
}
if (window.ethereum) {
  window.ethereum.on("accountsChanged", async (accounts) => {
    const newAddress = accounts[0];

    signer = provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);

    walletAddressSpan.textContent =
      newAddress.slice(0, 6) + "..." + newAddress.slice(-4);

    historyList.innerHTML = "";

    loadHistory(newAddress);

    resultText.textContent = "Wallet switched. Choose your move.";
    currentAddress = newAddress; // FIXED
  });
}


function init() {
  connectBtn.addEventListener("click", connectWallet);
  rockDiv.addEventListener("click", () => game("r"));
  paperDiv.addEventListener("click", () => game("p"));
  scissorsDiv.addEventListener("click", () => game("s"));
}

init();
