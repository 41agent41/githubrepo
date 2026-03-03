"""
Canonical data models for TradingApp shared package.
Broker-agnostic types used across ib_service, ctrader_service, etc.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class CandlestickBar(BaseModel):
    """Canonical OHLCV candlestick bar - broker-agnostic"""

    timestamp: float  # Unix timestamp in seconds
    open: float
    high: float
    low: float
    close: float
    volume: int

    # Optional technical indicator fields
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    ema_12: Optional[float] = None
    ema_26: Optional[float] = None
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_middle: Optional[float] = None
    bb_lower: Optional[float] = None
    stoch_k: Optional[float] = None
    stoch_d: Optional[float] = None
    atr: Optional[float] = None
    obv: Optional[float] = None
    vwap: Optional[float] = None
    volume_sma: Optional[float] = None


class HistoricalDataResponse(BaseModel):
    """Canonical historical data response - broker-agnostic"""

    symbol: str
    timeframe: str
    period: str = "1Y"
    bars: List[CandlestickBar]
    count: int
    last_updated: str
