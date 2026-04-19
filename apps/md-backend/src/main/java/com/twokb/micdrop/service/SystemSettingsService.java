package com.twokb.micdrop.service;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.model.SystemSettings;
import com.twokb.micdrop.repository.SystemSettingsRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SystemSettingsService {

	private final SystemSettingsRepository systemSettingsRepository;

	@Transactional(readOnly = true)
	public Optional<String> getSetting(String key) {
		return systemSettingsRepository.findById(key).map(SystemSettings::getValue);
	}

	@Transactional
	public void setSetting(String key, String value) {
		systemSettingsRepository.findById(key).ifPresentOrElse(setting -> setting.setValue(value), () -> {
			var setting = new SystemSettings();
			setting.setKey(key);
			setting.setValue(value);
			systemSettingsRepository.save(setting);
		});
	}

}
