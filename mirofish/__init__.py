"""MiroFish quant integration package.

Bridges the Kronos K-line foundation model (price forecasting) with the
MiroFish swarm-intelligence engine (sentiment simulation) to produce
combined trade theses:

    Kronos forecast ("BTC +8% in 24h")
        -> MiroFish simulates how market participants react to that forecast
        -> price target + sentiment conviction = trade thesis
"""

from mirofish.kronos_bridge import MiroFishKronosAdapter

__all__ = ["MiroFishKronosAdapter"]
