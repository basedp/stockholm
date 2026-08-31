
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from backend import trading

#since its just plain html css
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="Stock Order API")

app.mount(
    "/static",
    StaticFiles(directory="frontend"),
    name="static"
)

@app.get("/")
def home():
    return FileResponse("frontend/index.html")



# Enable CORS so frontend (HTML/JS) can call backend endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schema matching payload sent from frontend orderForm
class OrderPayload(BaseModel):
    id: Optional[str] = None
    api_key: Optional[str] = None
    secret_key: Optional[str] = None
    side: str = Field(..., example="BUY")
    stock: str = Field(..., example="AAPL")
    price: Optional[float] = Field(..., gt=0, example=150.25)
    amount: float = Field(..., gt=0, example=2.0)  # Quantity of shares

@app.get("/api/max-shares")
def get_max_shares(symbol: str, side: str, api_key: Optional[str] = None, secret_key: Optional[str] = None):
    """Returns max shares available to sell, or buying power for purchases."""
    try:
        # Clean up optional query params
        key = api_key if api_key and api_key.strip() else None
        secret = secret_key if secret_key and secret_key.strip() else None

        data = trading.get_max_shares(
            symbol=symbol,
            side=side,
            api_key=key,
            secret_key=secret
        )
        return data
    except Exception as e:
        print(f"Error fetching max shares: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/stocks")
def get_stocks():
    """Returns a JSON list of stock symbols: ["AAPL", "MSFT", ...]"""
    try:
        stocks = trading.get_tradable_stock_symbols()
        return stocks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/order")
def submit_order(order: OrderPayload):
    """Handles BUY and SELL orders submitted from JS frontend."""
    try:
        submitted_order = trading.execute_order(
            symbol=order.stock,
            qty=order.amount,
            price=order.price,
            side=order.side,
            api_key=order.api_key,
            secret_key=order.secret_key
        )
        return {
            "message": f"{order.side} order for {order.amount} shares of {order.stock} submitted successfully!",
            "order_id": str(submitted_order.id),
            "status": str(submitted_order.status)
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order failed: {str(e)}")



