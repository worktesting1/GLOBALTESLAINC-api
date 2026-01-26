// app/api/stocks/quote/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol parameter is required" },
        { status: 400 },
      );
    }

    const cleanSymbol = symbol.toUpperCase();

    // Choose your stock data provider:

    // Option 1: Finnhub (free tier available)
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${cleanSymbol}&token=${finnhubKey}`,
        { next: { revalidate: 60 } }, // Cache for 60 seconds
      );

      if (response.ok) {
        const data = await response.json();

        // Transform Finnhub response to your format
        return NextResponse.json({
          symbol: cleanSymbol,
          price: data.c,
          change: data.d,
          changePercent: data.dp,
          high: data.h,
          low: data.l,
          open: data.o,
          previousClose: data.pc,
          timestamp: data.t,
          volume: data.v,
        });
      }
    }

    // Option 2: Alpha Vantage
    const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (alphaVantageKey) {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${cleanSymbol}&apikey=${alphaVantageKey}`,
        { next: { revalidate: 60 } },
      );

      if (response.ok) {
        const data = await response.json();
        const quote = data["Global Quote"];

        if (quote) {
          return NextResponse.json({
            symbol: cleanSymbol,
            price: parseFloat(quote["05. price"]),
            change: parseFloat(quote["09. change"]),
            changePercent: parseFloat(quote["10. change percent"]),
            volume: parseInt(quote["06. volume"]),
            high: parseFloat(quote["03. high"]),
            low: parseFloat(quote["04. low"]),
            open: parseFloat(quote["02. open"]),
            previousClose: parseFloat(quote["08. previous close"]),
          });
        }
      }
    }

    // Option 3: Yahoo Finance (unofficial API)
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}`,
        { next: { revalidate: 60 } },
      );

      if (response.ok) {
        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (result) {
          const meta = result.meta;
          const quote = result.indicators?.quote?.[0];

          return NextResponse.json({
            symbol: cleanSymbol,
            price: meta.regularMarketPrice,
            change: meta.regularMarketPrice - meta.previousClose,
            changePercent:
              ((meta.regularMarketPrice - meta.previousClose) /
                meta.previousClose) *
              100,
            high: meta.regularMarketDayHigh,
            low: meta.regularMarketDayLow,
            open: meta.regularMarketOpen,
            previousClose: meta.previousClose,
            volume: meta.regularMarketVolume,
            currency: meta.currency,
            exchange: meta.exchangeName,
            name: meta.longName || meta.shortName || cleanSymbol,
          });
        }
      }
    } catch (yahooError) {
      console.warn("Yahoo Finance API failed:", yahooError.message);
    }

    // If no API works, return fallback
    return NextResponse.json({
      symbol: cleanSymbol,
      price: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      name: cleanSymbol,
      currency: "USD",
    });
  } catch (error) {
    console.error("Stock quote API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch stock data",
        symbol: request.nextUrl.searchParams.get("symbol"),
      },
      { status: 500 },
    );
  }
}
