package com.twokb.micdrop.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.twokb.micdrop.model.SystemSetting;

public interface SystemSettingRepository extends JpaRepository<SystemSetting, String> {

}
