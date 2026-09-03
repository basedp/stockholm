# Stockholm 📈

Stockholm is a personal lightweight web-based stock trading application built with **FastAPI** and the **Alpaca Trading API**.

The application provides a simple interface for submitting stock orders through an Alpaca account. It supports market and limit orders, stock ticker search, buy and sell operations, and automatic checks for available buying power and owned shares.

Access to the application is protected using **Google OAuth authentication**, allowing access to be restricted to an authorized Google account.

## Features

* Buy and sell US stocks
* Search available and tradable stock symbols
* Submit market orders
* Submit limit orders
* Check available buying power before purchasing
* Check owned shares before selling
* Google OAuth authentication
* Alpaca Paper Trading support
* Alpaca API credential support
* Lightweight HTML, CSS, and JavaScript frontend
* FastAPI backend

## Tech Stack

* Python
* FastAPI
* Alpaca Trading API
* Google OAuth / OpenID Connect
* HTML
* CSS
* JavaScript
* uv

## Installation

Clone the repository:

```bash
git clone https://github.com/basedp/stockholm.git
cd stockholm
```

Install `uv` if it is not already installed:

```bash
pip install uv
```

Install the project dependencies:

```bash
uv sync
```

If `alpaca-py` is not installed with the other dependencies, install it manually:

```bash
uv add alpaca-py
```

## Environment Variables

Create a `.env` file inside the `backend` directory:

```text
backend/.env
```

You can use the provided `.env.example` file as a template:


## Running the Application

Start the FastAPI development server:

```bash
uv run fastapi dev backend/main.py
```

Then open the local URL displayed in the terminal.

## Authentication

Stockholm uses Google OAuth to protect access to the application.

Only the email address defined in:

```env
ALLOWED_EMAIL=
```

is authorized to access the trading interface.

Google OAuth credentials must be configured using:

```env
OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=
```

## Alpaca Paper Trading

Paper trading is enabled by default:

```env
ALPACA_PAPER=true
```

Paper trading allows you to test the application using simulated funds without placing real trades.

## Project Structure

```text
stockholm/
├── backend/
│   ├── .env.example
│   ├── main.py
│   ├── trading.py
│   └── ...
│
├── frontend/
│   ├── index.html
│   ├──login.html
│   ├── style.css
│   └── script.js
│
├── pyproject.toml
├── uv.lock
└── README.md
```

## Disclaimer

This project is intended for educational and personal use.

Trading involves financial risk. Always verify orders and account settings before using real funds.
