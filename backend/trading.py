
import os
from dotenv import load_dotenv
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass
from alpaca.trading.enums import AssetStatus
from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.trading.requests import GetOrdersRequest
from alpaca.trading.enums import QueryOrderStatus

load_dotenv()

DEFAULT_API_KEY = os.getenv("ALPACA_API_KEY", "")
DEFAULT_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY", "")
PAPER = os.getenv("ALPACA_PAPER", "true").lower() == "true"


def get_client(api_key: str = None, secret_key: str = None) -> TradingClient:
    """Returns an Alpaca client using user-provided credentials or defaults to .env."""
    key = api_key.strip() if api_key and api_key.strip() else DEFAULT_API_KEY
    secret = secret_key.strip() if secret_key and secret_key.strip() else DEFAULT_SECRET_KEY

    if not key or not secret:
        raise ValueError("Missing Alpaca API credentials.")

    return TradingClient(key, secret, paper=PAPER)


def get_tradable_stock_symbols(api_key: str = None, secret_key: str = None, limit: int = 10000):
    """Fetches a simple list of tradable stock ticker strings."""
    client = get_client(api_key, secret_key)

    search_params = GetAssetsRequest(
        asset_class=AssetClass.US_EQUITY,
        status=AssetStatus.ACTIVE
    )
    assets = client.get_all_assets(search_params)

    # Filter for tradable stock symbols only
    symbols = [a.symbol for a in assets if a.tradable][:limit]
    popular = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY", "QQQ"]
    result = [s for s in popular if s in symbols]
    remaining = [s for s in sorted(symbols) if s not in set(popular)]
    return (symbols + remaining) [:limit]


def execute_order(
        symbol: str,
        qty: float,
        price: float = None,
        side: str = "BUY",
        api_key: str = None,
        secret_key: str = None
):
    client = get_client(api_key, secret_key)
    order_side = OrderSide.BUY if side.upper() == "BUY" else OrderSide.SELL

    # If price is provided and > 0, place a Limit Order. Otherwise, place a Market Order.
    if price and price > 0:
        order_data = LimitOrderRequest(
            symbol=symbol.upper(),
            qty=qty,
            limit_price=price,
            side=order_side,
            time_in_force=TimeInForce.DAY
        )
    else:
        order_data = MarketOrderRequest(
            symbol=symbol.upper(),
            qty=qty,
            side=order_side,
            time_in_force=TimeInForce.DAY
        )

    return client.submit_order(order_data=order_data)


# backend/trading.py
from alpaca.common.exceptions import APIError


def get_max_shares(symbol: str, side: str, api_key: str = None, secret_key: str = None):
    client = get_client(api_key, secret_key)
    symbol_upper = symbol.upper().strip()

    if side.upper() == "SELL":
        try:
            position = client.get_open_position(symbol_upper)
            return {"max_qty": float(position.qty), "type": "sell"}
        except APIError:
            # You don't hold any position in this stock
            return {"max_qty": 0.0, "type": "sell"}
        except Exception as e:
            # Fallback for general errors
            return {"max_qty": 0.0, "type": "sell"}

    else:  # BUY
        account = client.get_account()
        buying_power = float(account.buying_power)
        return {"buying_power": buying_power, "type": "buy"}