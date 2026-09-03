// =============================================
// API ENDPOINTS
// Relative URLs work locally and through HTTPS/tunnels.
// =============================================

const STOCKS_URL = "/api/stocks";
const ORDER_URL = "/api/order";
const MAX_SHARES_URL = "/api/max-shares";
const ME_URL = "/api/me";


// =============================================
// ELEMENTS
// =============================================

const orderForm = document.getElementById("orderForm");

const userName = document.getElementById("userName");
const userPicture = document.getElementById("userPicture");

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

const previewSide = document.getElementById("previewSide");
const previewStock = document.getElementById("previewStock");
const previewPrice = document.getElementById("previewPrice");
const previewAmount = document.getElementById("previewAmount");

let availableStocks = [];


// =============================================
// AUTH
// =============================================
// =============================================
// AUTH
// =============================================

async function loadCurrentUser() {

    const response = await fetch(
        ME_URL,
        {
            headers: {
                "Accept": "application/json"
            },

            credentials: "same-origin"
        }
    );


    if (response.status === 401) {

        window.location.href = "/";

        return false;
    }


    if (!response.ok) {

        throw new Error(
            `Could not load session (${response.status})`
        );
    }


    const user =
        await response.json();


    userName.textContent =
        user.name ||
        user.email;


    if (user.picture) {

        userPicture.src =
            user.picture;

        userPicture.hidden =
            false;
    }


    return true;
}


function redirectIfUnauthorized(response) {

    if (response.status === 401) {

        window.location.href = "/";

        return true;
    }


    return false;
}
// =============================================
// BUY / SELL
// =============================================

function getSide() {
    const selected =
        document.querySelector('input[name="side"]:checked');

    return selected ? selected.value : "BUY";
}


function updateOrderSide() {
    const side = getSide();

    if (side === "BUY") {
        priceLabel.textContent =
            "Buy Price (Optional - Leave blank for Market Order)";

        submitButton.textContent =
            "SUBMIT BUY ORDER";

        submitButton.classList.remove("sell-button");
        submitButton.classList.add("buy-button");

    } else {
        priceLabel.textContent =
            "Sell Price (Optional - Leave blank for Market Order)";

        submitButton.textContent =
            "SUBMIT SELL ORDER";

        submitButton.classList.remove("buy-button");
        submitButton.classList.add("sell-button");
    }

    updatePreview();
}


// =============================================
// STOCK SEARCH
// =============================================

async function loadStocks() {
    stockSearchInput.disabled = true;
    stockSearchInput.value = "";
    stockHiddenInput.value = "";

    stockSearchInput.placeholder =
        "Loading stocks...";

    try {
        const response = await fetch(STOCKS_URL, {
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        });

        if (redirectIfUnauthorized(response)) {
            return;
        }

        if (!response.ok) {
            throw new Error(
                `Server returned ${response.status}`
            );
        }

        const data = await response.json();

        availableStocks =
            Array.isArray(data)
                ? data
                : data.stocks;

        if (
            !Array.isArray(availableStocks) ||
            availableStocks.length === 0
        ) {
            stockSearchInput.placeholder =
                "No stocks available";

            return;
        }

        stockSearchInput.disabled = false;

        stockSearchInput.placeholder =
            "Search ticker (e.g. AAPL)...";

        renderOptions(availableStocks);

    } catch (error) {
        console.error(error);

        stockSearchInput.placeholder =
            "Failed to load stocks";

        showMessage(
            "Could not get stock list from the server.",
            "error"
        );
    }
}


function renderOptions(stocksToRender) {
    stockOptionsContainer.innerHTML = "";

    if (stocksToRender.length === 0) {
        stockOptionsContainer.innerHTML = `
            <div class="dropdown-item message-item">
                No matching stocks
            </div>
        `;

        return;
    }

    stocksToRender.forEach(symbol => {
        const item =
            document.createElement("div");

        item.className =
            "dropdown-item";

        item.textContent =
            symbol;

        item.addEventListener(
            "click",
            () => selectStock(symbol)
        );

        stockOptionsContainer.appendChild(item);
    });
}


function selectStock(symbol) {
    stockHiddenInput.value =
        symbol;

    stockSearchInput.value =
        symbol;

    stockDropdown.classList.remove("open");

    updatePreview();
}


// =============================================
// MAX AMOUNT
// =============================================

async function handleMaxAmount() {
    const symbol =
        stockHiddenInput.value.trim() ||
        stockSearchInput.value.trim();

    if (!symbol) {
        showMessage(
            "Please select a stock first.",
            "error"
        );

        return;
    }

    const side = getSide();

    try {
        maxAmountBtn.disabled = true;

        const params =
            new URLSearchParams({
                symbol: symbol.toUpperCase(),
                side: side
            });

        const response =
            await fetch(
                `${MAX_SHARES_URL}?${params.toString()}`,
                {
                    headers: {
                        "Accept": "application/json"
                    },
                    credentials: "same-origin"
                }
            );

        if (redirectIfUnauthorized(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                `Server returned ${response.status}`
            );
        }

        if (side === "SELL") {
            const maxQty =
                Number(data.max_qty || 0);

            amountInput.value =
                maxQty.toFixed(2);

            if (maxQty === 0) {
                showMessage(
                    `You own 0 shares of ${symbol.toUpperCase()}.`,
                    "error"
                );
            }

        } else {
            const buyingPower =
                Number(data.buying_power || 0);

            const price =
                Number.parseFloat(
                    priceInput.value
                );

            if (
                Number.isFinite(price) &&
                price > 0
            ) {
                const calculatedShares =
                    Math.floor(
                        (buyingPower / price) * 100
                    ) / 100;

                amountInput.value =
                    calculatedShares.toFixed(2);

            } else {
                showMessage(
                    `Buying Power: $${buyingPower.toFixed(2)}. Enter a price to calculate max shares.`,
                    "success"
                );
            }
        }

        updatePreview();

    } catch (error) {
        console.error(error);

        showMessage(
            error.message ||
            "Could not fetch max shares.",
            "error"
        );

    } finally {
        maxAmountBtn.disabled = false;
    }
}


// =============================================
// PREVIEW / MESSAGES
// =============================================

function updatePreview() {
    previewSide.textContent =
        getSide();

    previewStock.textContent =
        stockHiddenInput.value ||
        stockSearchInput.value ||
        "—";

    const price =
        Number.parseFloat(
            priceInput.value
        );

    const amount =
        Number.parseFloat(
            amountInput.value
        );

    previewPrice.textContent =
        Number.isFinite(price) &&
        price > 0
            ? price.toFixed(3)
            : "MARKET";

    previewAmount.textContent =
        Number.isFinite(amount)
            ? amount.toFixed(2)
            : "0.00";
}


function showMessage(text, type) {
    messageBox.textContent =
        text;

    messageBox.className =
        `message ${type}`;
}


function clearMessage() {
    messageBox.textContent = "";

    messageBox.className =
        "message";
}


// =============================================
// SUBMIT ORDER
// =============================================

orderForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        clearMessage();

        const side =
            getSide();

        const selectedStock =
            stockHiddenInput.value.trim() ||
            stockSearchInput.value.trim();

        const rawPrice =
            Number.parseFloat(
                priceInput.value
            );

        const price =
            Number.isFinite(rawPrice) &&
            rawPrice > 0
                ? rawPrice
                : null;

        const amount =
            Number.parseFloat(
                amountInput.value
            );

        if (!selectedStock) {
            showMessage(
                "Please select or type a stock symbol.",
                "error"
            );

            return;
        }

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            showMessage(
                "Please enter a valid amount.",
                "error"
            );

            return;
        }

        const order = {
            side: side,
            stock: selectedStock.toUpperCase(),
            price: price,
            amount: amount
        };

        submitButton.disabled = true;

        submitButton.textContent =
            "SUBMITTING...";

        try {
            const response =
                await fetch(
                    ORDER_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        credentials:
                            "same-origin",

                        body:
                            JSON.stringify(order)
                    }
                );

            if (redirectIfUnauthorized(response)) {
                return;
            }

            let result = {};

            try {
                result =
                    await response.json();
            } catch {
                result = {};
            }

            if (!response.ok) {
                throw new Error(
                    result.detail ||
                    result.message ||
                    `Server returned ${response.status}`
                );
            }

            const orderType =
                price
                    ? "LIMIT"
                    : "MARKET";

            showMessage(
                result.message ||
                `${side} ${orderType} order submitted successfully.`,
                "success"
            );

        } catch (error) {
            console.error(error);

            showMessage(
                error.message ||
                "Unable to submit the order.",
                "error"
            );

        } finally {
            submitButton.disabled =
                false;

            updateOrderSide();
        }
    }
);


// =============================================
// EVENTS
// =============================================

document
    .querySelectorAll(
        'input[name="side"]'
    )
    .forEach(input => {

        input.addEventListener(
            "change",
            updateOrderSide
        );

    });


stockSearchInput.addEventListener(
    "input",
    event => {

        const query =
            event.target.value
                .toUpperCase()
                .trim();

        stockHiddenInput.value =
            query;

        const filtered =
            availableStocks.filter(
                stock =>
                    stock
                        .toUpperCase()
                        .includes(query)
            );

        renderOptions(filtered);

        stockDropdown.classList.add(
            "open"
        );

        updatePreview();
    }
);


stockSearchInput.addEventListener(
    "focus",
    () => {

        if (availableStocks.length > 0) {
            stockDropdown.classList.add(
                "open"
            );
        }

    }
);


document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                ".custom-select-wrapper"
            )
        ) {
            stockDropdown.classList.remove(
                "open"
            );
        }

    }
);


priceInput.addEventListener(
    "input",
    updatePreview
);


amountInput.addEventListener(
    "input",
    updatePreview
);


refreshStocksButton.addEventListener(
    "click",
    loadStocks
);


maxAmountBtn.addEventListener(
    "click",
    handleMaxAmount
);


priceInput.addEventListener(
    "blur",
    () => {

        const value =
            Number.parseFloat(
                priceInput.value
            );

        priceInput.value =
            Number.isFinite(value) &&
            value > 0
                ? value.toFixed(3)
                : "";

        updatePreview();
    }
);


amountInput.addEventListener(
    "blur",
    () => {

        const value =
            Number.parseFloat(
                amountInput.value
            );

        if (Number.isFinite(value)) {
            amountInput.value =
                value.toFixed(2);
        }

        updatePreview();
    }
);


// =============================================
// INITIALIZATION
// =============================================

async function initialize() {
    try {
        const authenticated =
            await loadCurrentUser();

        if (!authenticated) {
            return;
        }

        updateOrderSide();

        await loadStocks();

    } catch (error) {
        console.error(error);

        showMessage(
            error.message ||
            "Unable to initialize the app.",
            "error"
        );
    }
}


initialize();


