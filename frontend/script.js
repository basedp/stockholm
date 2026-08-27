// =============================================
// CONFIGURATION
// =============================================

const API_BASE_URL = "http://127.0.0.1:8000";
const STOCKS_URL = `${API_BASE_URL}/api/stocks`;
const ORDER_URL = `${API_BASE_URL}/api/order`;
const MAX_SHARES_URL = `${API_BASE_URL}/api/max-shares`;


// =============================================
// ELEMENTS
// =============================================

const orderForm = document.getElementById("orderForm");

const userIdInput = document.getElementById("userId");
const apiKeyInput = document.getElementById("apiKey");
const secretKeyInput = document.getElementById("secretKey");

// Searchable Stock Elements
const stockHiddenInput = document.getElementById("stock");
const stockSearchInput = document.getElementById("stockSearch");
const stockDropdown = document.getElementById("stockDropdown");
const stockOptionsContainer = document.getElementById("stockOptions");

const priceInput = document.getElementById("price");
const amountInput = document.getElementById("amount");
const maxAmountBtn = document.getElementById("maxAmountBtn");

const priceLabel = document.getElementById("priceLabel");

const submitButton = document.getElementById("submitButton");
const refreshStocksButton = document.getElementById("refreshStocks");

const messageBox = document.getElementById("message");

// Preview Elements
const previewSide = document.getElementById("previewSide");
const previewStock = document.getElementById("previewStock");
const previewPrice = document.getElementById("previewPrice");
const previewAmount = document.getElementById("previewAmount");

// Global state for available stocks
let availableStocks = [];


// =============================================
// GET CURRENT BUY / SELL SIDE
// =============================================

function getSide() {
    const selected = document.querySelector('input[name="side"]:checked');
    return selected ? selected.value : "BUY";
}


// =============================================
// SEARCHABLE DROPDOWN LOGIC
// =============================================

async function loadStocks() {
    stockSearchInput.disabled = true;
    stockSearchInput.value = "";
    stockHiddenInput.value = "";
    stockSearchInput.placeholder = "Loading stocks...";

    try {
        const response = await fetch(STOCKS_URL, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        availableStocks = Array.isArray(data) ? data : data.stocks;

        if (!Array.isArray(availableStocks) || availableStocks.length === 0) {
            stockSearchInput.placeholder = "No stocks available";
            return;
        }

        stockSearchInput.disabled = false;
        stockSearchInput.placeholder = "Search ticker (e.g. AAPL)...";
        renderOptions(availableStocks);

    } catch (error) {
        console.error(error);
        stockSearchInput.placeholder = "Failed to load stocks";
        showMessage("Could not get stock list from Python server.", "error");
    }
}

function renderOptions(stocksToRender) {
    stockOptionsContainer.innerHTML = "";

    if (stocksToRender.length === 0) {
        stockOptionsContainer.innerHTML = `
            <div class="dropdown-item message-item">No matching stocks</div>
        `;
        return;
    }

    stocksToRender.forEach(symbol => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = symbol;

        item.addEventListener("click", () => {
            selectStock(symbol);
        });

        stockOptionsContainer.appendChild(item);
    });
}

function selectStock(symbol) {
    stockHiddenInput.value = symbol;
    stockSearchInput.value = symbol;
    stockDropdown.classList.remove("open");
    updatePreview();
}


// =============================================
// CHANGE BUY / SELL UI
// =============================================

function updateOrderSide() {
    const side = getSide();

    if (side === "BUY") {
        priceLabel.textContent = "Buy Price (Optional - Leave blank for Market Order)";
        submitButton.textContent = "SUBMIT BUY ORDER";
        submitButton.classList.remove("sell-button");
        submitButton.classList.add("buy-button");
    } else {
        priceLabel.textContent = "Sell Price (Optional - Leave blank for Market Order)";
        submitButton.textContent = "SUBMIT SELL ORDER";
        submitButton.classList.remove("buy-button");
        submitButton.classList.add("sell-button");
    }

    updatePreview();
}


// =============================================
// MAX SHARES LOGIC
// =============================================

async function handleMaxAmount() {
    const symbol = stockHiddenInput.value.trim() || stockSearchInput.value.trim();
    if (!symbol) {
        showMessage("Please select a stock first.", "error");
        return;
    }

    const side = getSide();
    const apiKey = apiKeyInput.value.trim();
    const secretKey = secretKeyInput.value.trim();

    try {
        if (maxAmountBtn) maxAmountBtn.disabled = true;

        const params = new URLSearchParams({
            symbol: symbol,
            side: side,
            ...(apiKey && { api_key: apiKey }),
            ...(secretKey && { secret_key: secretKey })
        });

        const response = await fetch(`${MAX_SHARES_URL}?${params.toString()}`);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        const data = await response.json();

        if (side === "SELL") {
            amountInput.value = (data.max_qty || 0).toFixed(2);
        } else {
            const price = Number.parseFloat(priceInput.value);
            if (Number.isFinite(price) && price > 0) {
                const calculatedShares = Math.floor((data.buying_power / price) * 100) / 100;
                amountInput.value = calculatedShares.toFixed(2);
            } else {
                showMessage(`Buying Power: $${data.buying_power}. Enter a price to calculate exact max shares.`, "success");
            }
        }
        updatePreview();

    } catch (error) {
        console.error(error);
        showMessage("Could not fetch max shares count.", "error");
    } finally {
        if (maxAmountBtn) maxAmountBtn.disabled = false;
    }
}


// =============================================
// PREVIEW
// =============================================

function updatePreview() {
    previewSide.textContent = getSide();
    previewStock.textContent = stockHiddenInput.value || stockSearchInput.value || "—";

    const price = Number.parseFloat(priceInput.value);
    const amount = Number.parseFloat(amountInput.value);

    // Displays MARKET if price is left blank
    previewPrice.textContent = (Number.isFinite(price) && price > 0) ? price.toFixed(3) : "MARKET";
    previewAmount.textContent = Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}


// =============================================
// MESSAGE HELPERS
// =============================================

function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = `message ${type}`;
}

function clearMessage() {
    messageBox.textContent = "";
    messageBox.className = "message";
}


// =============================================
// SUBMIT ORDER TO PYTHON SERVER
// =============================================

orderForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    clearMessage();

    const side = getSide();
    const selectedStock = stockHiddenInput.value.trim() || stockSearchInput.value.trim();
    const rawPrice = Number.parseFloat(priceInput.value);
    const price = (Number.isFinite(rawPrice) && rawPrice > 0) ? rawPrice : null;
    const amount = Number.parseFloat(amountInput.value);

    // -----------------------------
    // Validation
    // -----------------------------

    if (!selectedStock) {
        showMessage("Please select or type a stock symbol.", "error");
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        showMessage("Please enter a valid amount.", "error");
        return;
    }

    // -----------------------------
    // Data sent to Python
    // -----------------------------

    const order = {
        id: userIdInput.value.trim(),
        api_key: apiKeyInput.value.trim(),
        secret_key: secretKeyInput.value.trim(),
        side: side,
        stock: selectedStock.toUpperCase(),
        price: price ? price.toFixed(3) : null,
        amount: amount.toFixed(2)
    };

    console.log("Submitting order:", {
        ...order,
        api_key: "***",
        secret_key: "***"
    });

    // -----------------------------
    // Send request
    // -----------------------------

    submitButton.disabled = true;
    submitButton.textContent = "SUBMITTING...";

    try {
        const response = await fetch(ORDER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(order)
        });

        let result = {};

        try {
            result = await response.json();
        } catch {
            result = {};
        }

        if (!response.ok) {
            throw new Error(result.detail || result.message || `Server returned ${response.status}`);
        }

        const orderTypeStr = price ? "LIMIT" : "MARKET";
        showMessage(
            result.message || `${side} ${orderTypeStr} order submitted successfully.`,
            "success"
        );

    } catch (error) {
        console.error(error);
        showMessage(error.message || "Unable to submit the order.", "error");

    } finally {
        submitButton.disabled = false;
        updateOrderSide();
    }
});


// =============================================
// EVENT LISTENERS
// =============================================

// Radio options for Buy/Sell
document.querySelectorAll('input[name="side"]').forEach(input => {
    input.addEventListener("change", updateOrderSide);
});

// Search Input Filtering & UI Events
stockSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toUpperCase().trim();
    stockHiddenInput.value = query;

    const filtered = availableStocks.filter(stock =>
        stock.toUpperCase().includes(query)
    );

    renderOptions(filtered);
    stockDropdown.classList.add("open");
    updatePreview();
});

stockSearchInput.addEventListener("focus", () => {
    if (availableStocks.length > 0) {
        stockDropdown.classList.add("open");
    }
});

// Close dropdown on outside click
document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-select-wrapper")) {
        stockDropdown.classList.remove("open");
    }
});

priceInput.addEventListener("input", updatePreview);
amountInput.addEventListener("input", updatePreview);
refreshStocksButton.addEventListener("click", loadStocks);

if (maxAmountBtn) {
    maxAmountBtn.addEventListener("click", handleMaxAmount);
}

// Formatting fields on blur
priceInput.addEventListener("blur", function() {
    const value = Number.parseFloat(priceInput.value);
    if (Number.isFinite(value) && value > 0) {
        priceInput.value = value.toFixed(3);
    } else {
        priceInput.value = "";
    }
    updatePreview();
});

amountInput.addEventListener("blur", function() {
    const value = Number.parseFloat(amountInput.value);
    if (Number.isFinite(value)) {
        amountInput.value = value.toFixed(2);
    }
    updatePreview();
});
// script.js
async function handleMaxAmount() {
    const symbol = stockHiddenInput.value.trim() || stockSearchInput.value.trim();
    if (!symbol) {
        showMessage("Please select a stock first.", "error");
        return;
    }

    const side = getSide();
    const apiKey = apiKeyInput.value.trim();
    const secretKey = secretKeyInput.value.trim();

    try {
        if (maxAmountBtn) maxAmountBtn.disabled = true;

        const params = new URLSearchParams({
            symbol: symbol,
            side: side,
            ...(apiKey && { api_key: apiKey }),
            ...(secretKey && { secret_key: secretKey })
        });

        const response = await fetch(`${MAX_SHARES_URL}?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `Server returned ${response.status}`);
        }

        if (side === "SELL") {
            amountInput.value = (data.max_qty || 0).toFixed(2);
            if (data.max_qty === 0) {
                showMessage(`You own 0 shares of ${symbol.toUpperCase()}.`, "error");
            }
        } else {
            const price = Number.parseFloat(priceInput.value);
            if (Number.isFinite(price) && price > 0) {
                const calculatedShares = Math.floor((data.buying_power / price) * 100) / 100;
                amountInput.value = calculatedShares.toFixed(2);
            } else {
                showMessage(`Buying Power: $${data.buying_power.toFixed(2)}. Enter a price to calculate max shares.`, "success");
            }
        }
        updatePreview();

    } catch (error) {
        console.error(error);
        showMessage(error.message || "Could not fetch max shares count.", "error");
    } finally {
        if (maxAmountBtn) maxAmountBtn.disabled = false;
    }
}

// =============================================
// INITIALIZATION
// =============================================

updateOrderSide();
loadStocks();