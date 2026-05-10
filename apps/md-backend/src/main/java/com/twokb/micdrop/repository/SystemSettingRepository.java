package com.twokb.micdrop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.twokb.micdrop.model.SystemSetting;

@Repository
public interface SystemSettingRepository extends JpaRepository<SystemSetting, String> {

}
