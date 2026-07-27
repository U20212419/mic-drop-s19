package com.twokb.micdrop.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.model.SystemSetting;
import com.twokb.micdrop.repository.SystemSettingRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SystemSettingService {

	private final SystemSettingRepository systemSettingRepository;

	@Transactional(readOnly = true)
	public Optional<String> getSetting(String key) {
		return systemSettingRepository.findById(key).map(SystemSetting::getSettingValue);
	}

	@Transactional(readOnly = true)
	public String getHostDiscordId() {
		return getSetting("season_host_id").orElse("");
	}

	@Transactional(readOnly = true)
	public List<SystemSetting> getAllSettings() {
		return systemSettingRepository.findAll();
	}

	@Transactional
	public SystemSetting setSetting(String key, String value, String requesterDiscordId) {
		requireHost(requesterDiscordId);

		SystemSetting systemSetting = systemSettingRepository.findById(key)
			.orElseThrow(() -> new IllegalArgumentException("Setting with key " + key + " not found."));

		systemSetting.setSettingValue(value);
		return systemSettingRepository.save(systemSetting);
	}

	@Transactional
	public void upsertSettings(Map<String, String> settings, String requesterDiscordId) {
		requireHost(requesterDiscordId);
		settings.forEach(this::setInternalSetting);
	}

	@Transactional
	public SystemSetting setInternalSetting(String key, String value) {
		SystemSetting setting = systemSettingRepository.findById(key).orElseGet(() -> new SystemSetting(key, value));
		setting.setSettingValue(value);
		return systemSettingRepository.save(setting);
	}

	private void requireHost(String requesterDiscordId) {
		if (!requesterDiscordId.equals(getHostDiscordId())) {
			throw new IllegalStateException("Only the host can change system settings.");
		}
	}

}
