package com.stonker.wear

import android.content.Context
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

class WatchlistListenerService : WearableListenerService() {

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type == DataEvent.TYPE_CHANGED &&
                event.dataItem.uri.path == "/watchlist"
            ) {
                val json = DataMapItem.fromDataItem(event.dataItem)
                    .dataMap.getString("symbols") ?: continue
                getSharedPreferences("stonker_prefs", Context.MODE_PRIVATE)
                    .edit()
                    .putString("watchlist", json)
                    .apply()
            }
        }
    }
}
