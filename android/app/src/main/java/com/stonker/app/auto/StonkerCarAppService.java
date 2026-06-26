package com.stonker.app.auto;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

public class StonkerCarAppService extends CarAppService {

    @NonNull
    @Override
    public Session onCreateSession() {
        return new StonkerSession();
    }

    @NonNull
    @Override
    public HostValidator createHostValidator() {
        // ALLOW_ALL is fine for sideloaded APKs; restrict to known hosts for Play Store releases.
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
    }
}
