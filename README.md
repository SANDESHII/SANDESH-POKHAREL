# Quantitative Football AI: Football Prediction & Analysis Engine

A professional-grade football analytics platform and prediction engine. This application leverages advanced statistical modeling, Bayesian state estimation, and AI-driven insights to identify value in football markets.

## Core Features

- **Bayesian Latent State Estimation**: Tracks team "true strength" (npxG) over time using a custom **Kalman Filter** (`SignalFilter`), providing a dynamic view of team form that filters out match-to-match noise.
- **Dixon-Coles Statistical Modeling**: Implements the industry-standard Dixon-Coles model for match score probability estimation, including parameter fitting for attack/defense strengths and home-field advantage.
- **Monte Carlo Simulations**: Propagates uncertainty through the model by running thousands of match simulations to generate robust probability distributions for various betting markets.
- **AI-Enriched Data Ingestion**: Uses **Google Gemini** to estimate team statistics and context (weather, injuries, morale) when high-fidelity historical data is sparse or missing.
- **Market Edge Detection**: Automatically calculates expected value (EV) by comparing model-generated probabilities against real-time market odds.
- **Walk-Forward Backtesting**: Includes a dedicated backtesting suite to validate model performance using historical results and measuring accuracy via Brier Scores and calibration metrics.

## Architecture Overview

The application follows a modular full-stack architecture:

### Backend (Express + TypeScript)
- **Ingestion Service**: Orchestrates data flow from external providers (`FootballDataProvider`, `LiveOddsProvider`).
- **Signal Filter**: Manages the persistence and update of latent team states in Firestore.
- **Match Engine**: The central coordinator that runs the statistical models and simulation loops for upcoming matches.
- **Stats Cleaner**: Handles data validation, outlier detection, and standardization of raw match statistics.

### Infrastructure & Resilience
- **Firebase Firestore**: Used as the primary durable store for team states and historical match data.
- **Circuit Breakers & Retries**: Robust ingestion logic to handle API rate limits and transient failures.
- **Vite Middleware**: Serves the React frontend with Hot Module Replacement (HMR) in development.

### Frontend (React + Tailwind CSS)
- **Interactive Dashboards**: Real-time visualization of match projections and market edges.
- **Backtest Viewer**: Detailed breakdowns of historical model performance and calibration curves.
- **Motion UI**: Smooth transitions and data-driven animations using `motion`.

## Environment Variables

The following variables must be configured in your environment or `.env` file:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | API key for Google Gemini (required for AI-driven estimation). |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON string of the Firebase Service Account key for Firestore access. |
| `ODDS_API_KEY` | API key for fetching real-time market odds. |

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

4. **Start Production Server**:
   ```bash
   npm run start
   ```
