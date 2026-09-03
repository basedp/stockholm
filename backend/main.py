import os
import traceback

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth

from pydantic import BaseModel, Field
from typing import Optional

from backend import trading


load_dotenv()

app = FastAPI(title="Stock Order API")


# ---------------------------------------------------
# STATIC FILES
# ---------------------------------------------------

app.mount(
    "/static",
    StaticFiles(directory="frontend"),
    name="static"
)


# ---------------------------------------------------
# SESSION
# ---------------------------------------------------

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET"],
    https_only=False,  # Change to True when using HTTPS
    same_site="lax",
)


# ---------------------------------------------------
# AUTH CHECK
# ---------------------------------------------------

def require_user(request: Request):
    user = request.session.get("user")

    if not user:
        raise HTTPException(
            status_code=401,
            detail="You must be logged in"
        )

    return user


# ---------------------------------------------------
# HOME PAGE = SIGN IN PAGE
# ---------------------------------------------------

@app.get("/")
def home(request: Request):

    # If already logged in, go directly to app
    if request.session.get("user"):
        return RedirectResponse("/app", status_code=303)

    return FileResponse("frontend/login.html")


# ---------------------------------------------------
# ACTUAL APP
# ---------------------------------------------------

@app.get("/app")
def trading_app(request: Request):

    # Not logged in
    if not request.session.get("user"):
        return RedirectResponse("/", status_code=303)

    return FileResponse("frontend/index.html")

@app.get("/api/me")
def get_current_user(
    user=Depends(require_user)
):
    return user



# ---------------------------------------------------
# GOOGLE OAUTH
# ---------------------------------------------------

oauth = OAuth()

oauth.register(
    name="google",

    client_id=os.environ["OAUTH_CLIENT_ID"],

    client_secret=os.environ["OAUTH_CLIENT_SECRET"],

    server_metadata_url=(
        "https://accounts.google.com/"
        ".well-known/openid-configuration"
    ),

    client_kwargs={
        "scope": "openid email profile"
    },
)


@app.get("/login")
async def login(request: Request):

    redirect_uri = request.url_for("auth")

    return await oauth.google.authorize_redirect(
        request,
        redirect_uri
    )


@app.get("/auth")
async def auth(request: Request):

    token = await oauth.google.authorize_access_token(request)

    user = token["userinfo"]

    # Only allow your email
    if user["email"] != os.environ["ALLOWED_EMAIL"]:

        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    request.session["user"] = {
        "email": user["email"],
        "name": user.get("name"),
        "picture": user.get("picture"),
    }

    # Login successful -> actual application
    return RedirectResponse("/app", status_code=303)


@app.get("/logout")
async def logout(request: Request):

    request.session.clear()

    return RedirectResponse("/", status_code=303)


# ---------------------------------------------------
# CORS
# ---------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------
# ORDER MODEL
# ---------------------------------------------------

class OrderPayload(BaseModel):
    id: Optional[str] = None
    api_key: Optional[str] = None
    secret_key: Optional[str] = None

    side: str = Field(..., example="BUY")
    stock: str = Field(..., example="AAPL")

    price: Optional[float] = Field(
        ...,
        gt=0,
        example=150.25
    )

    amount: float = Field(
        ...,
        gt=0,
        example=2.0
    )


# ---------------------------------------------------
# API - MAX SHARES
# ---------------------------------------------------

@app.get("/api/max-shares")
def get_max_shares(
    symbol: str,
    side: str,
    api_key: Optional[str] = None,
    secret_key: Optional[str] = None,
    user=Depends(require_user)
):

    try:

        key = (
            api_key
            if api_key and api_key.strip()
            else None
        )

        secret = (
            secret_key
            if secret_key and secret_key.strip()
            else None
        )

        data = trading.get_max_shares(
            symbol=symbol,
            side=side,
            api_key=key,
            secret_key=secret
        )

        return data

    except Exception as e:

        print(f"Error fetching max shares: {e}")

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


# ---------------------------------------------------
# API - STOCKS
# ---------------------------------------------------

@app.get("/api/stocks")
def get_stocks(
    user=Depends(require_user)
):

    try:

        stocks = trading.get_tradable_stock_symbols()

        return stocks

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )





# ---------------------------------------------------
# API - ORDER
# ---------------------------------------------------

@app.post("/api/order")
def submit_order(
    order: OrderPayload,
    user=Depends(require_user)
):

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
            "message": (
                f"{order.side} order for "
                f"{order.amount} shares of "
                f"{order.stock} submitted successfully!"
            ),
            "order_id": str(submitted_order.id),
            "status": str(submitted_order.status)
        }

    except ValueError as ve:

        raise HTTPException(
            status_code=400,
            detail=str(ve)
        )

    except Exception as e:

        print("Backend Error Traceback:")
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"Order failed: {str(e)}"
        )