package com.stonker.wear

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface StockUiState {
    data object Loading : StockUiState
    data class Success(val stocks: List<StockItem>) : StockUiState
    data class Error(val message: String) : StockUiState
}

class StockViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<StockUiState>(StockUiState.Loading)
    val uiState: StateFlow<StockUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            while (true) {
                fetchOnce()
                delay(30_000)
            }
        }
    }

    fun refresh() {
        viewModelScope.launch { fetchOnce() }
    }

    private suspend fun fetchOnce() {
        try {
            val stocks = StockRepository.fetchQuotes(StockRepository.DEFAULT_SYMBOLS)
            _uiState.value = StockUiState.Success(stocks)
        } catch (e: Exception) {
            if (_uiState.value !is StockUiState.Success) {
                _uiState.value = StockUiState.Error(e.message ?: "Unknown error")
            }
        }
    }
}
