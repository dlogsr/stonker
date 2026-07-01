package com.stonker.wear

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class StockItem(
    val symbol: String,
    val price: Double,
    val changePercent: Double,
)

object StockRepository {
    private const val API_BASE = "https://stonker-production.up.railway.app/api"
    val DEFAULT_SYMBOLS = listOf("AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META")

    suspend fun fetchQuotes(symbols: List<String>): List<StockItem> = withContext(Dispatchers.IO) {
        val url = URL("$API_BASE/quotes?symbols=${symbols.joinToString(",")}&timeScale=1D")
        val conn = url.openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000
        conn.setRequestProperty("Accept", "application/json")
        try {
            val response = conn.inputStream.bufferedReader().readText()
            val quotes = JSONObject(response).getJSONArray("quotes")
            (0 until quotes.length()).map { i ->
                val q = quotes.getJSONObject(i)
                StockItem(
                    symbol = q.getString("symbol"),
                    price = q.getDouble("price"),
                    changePercent = q.getDouble("changePercent"),
                )
            }
        } finally {
            conn.disconnect()
        }
    }
}
