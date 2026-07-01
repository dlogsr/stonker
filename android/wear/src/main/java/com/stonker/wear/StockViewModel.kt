package com.stonker.wear

import android.app.Application
import android.content.Context
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONArray

sealed interface StockUiState {
    data object Loading : StockUiState
    data class Success(val stocks: List<StockItem>) : StockUiState
    data class Error(val message: String) : StockUiState
}

class StockViewModel(app: Application) : AndroidViewModel(app) {

    private val _uiState = MutableStateFlow<StockUiState>(StockUiState.Loading)
    val uiState: StateFlow<StockUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            // Pull any watchlist the phone already sent before we launched.
            syncFromDataLayer()
            while (true) {
                fetchOnce()
                delay(30_000)
            }
        }
    }

    fun refresh() {
        viewModelScope.launch { fetchOnce() }
    }

    private suspend fun syncFromDataLayer() {
        try {
            val items = Wearable.getDataClient(getApplication<Application>())
                .getDataItems(Uri.parse("wear:/*/watchlist"))
                .await()
            for (item in items) {
                val json = DataMapItem.fromDataItem(item).dataMap.getString("symbols")
                if (!json.isNullOrEmpty()) {
                    saveWatchlistToPrefs(json)
                    break
                }
            }
            items.release()
        } catch (_: Exception) {}
    }

    private suspend fun fetchOnce() {
        try {
            val stocks = StockRepository.fetchQuotes(getWatchlistSymbols())
            _uiState.value = StockUiState.Success(stocks)
        } catch (e: Exception) {
            if (_uiState.value !is StockUiState.Success) {
                _uiState.value = StockUiState.Error(e.message ?: "Unknown error")
            }
        }
    }

    private fun saveWatchlistToPrefs(json: String) {
        getApplication<Application>()
            .getSharedPreferences("stonker_prefs", Context.MODE_PRIVATE)
            .edit().putString("watchlist", json).apply()
    }

    private fun getWatchlistSymbols(): List<String> {
        return try {
            val prefs = getApplication<Application>()
                .getSharedPreferences("stonker_prefs", Context.MODE_PRIVATE)
            val json = prefs.getString("watchlist", null)
            if (!json.isNullOrEmpty()) {
                JSONArray(json).let { arr ->
                    (0 until arr.length()).map { arr.getString(it) }
                        .takeIf { it.isNotEmpty() }
                }
            } else null
        } catch (_: Exception) { null } ?: StockRepository.DEFAULT_SYMBOLS
    }
}
