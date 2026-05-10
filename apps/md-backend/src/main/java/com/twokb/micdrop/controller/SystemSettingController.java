package com.twokb.micdrop.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.twokb.micdrop.model.SystemSetting;
import com.twokb.micdrop.service.SystemSettingService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/system-settings")
@RequiredArgsConstructor
public class SystemSettingController {

	private final SystemSettingService systemSettingService;

	@GetMapping
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<List<SystemSetting>> getAllSettings() {
		return ResponseEntity.ok(systemSettingService.getAllSettings());
	}

	@PutMapping("/{key}")
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<SystemSetting> updateSetting(@PathVariable String key, @RequestBody String value) {
		SystemSetting updatedSetting = systemSettingService.setSetting(key, value);
		return ResponseEntity.ok(updatedSetting);
	}

}
